import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Slingshot {
  constructor(engine, playerController) {
    this.engine = engine;
    this.playerController = playerController;

    this.slingshotGroup = new THREE.Group();
    this.engine.camera.add(this.slingshotGroup);
    this.engine.scene.add(this.engine.camera);

    this.buildYFrame();
    this.buildSling();
    this.buildStaff();

    this.projectileSpec = { radius: 0.10, mass: 1, color: 0x666666 };
    this.currentProjectile = null;
    this.projectileReady   = true;
    this.lastFiredBody     = null;

    this.activeWeapon = 1;
    this.switchWeapon(1);

    // Ensure world matrices are computed before placing the ball in the sling
    this.engine.scene.updateMatrixWorld(true);
    this.loadProjectile();
  }

  // ── Build slingshot visuals ───────────────────────────────────────────────

  buildYFrame() {
    this.yFrameGroup = new THREE.Group();
    this.yFrameGroup.position.set(0.32, -0.48, -0.85);
    this.yFrameGroup.rotation.y = -0.2;
    this.yFrameGroup.scale.set(0.55, 0.55, 0.55);

    const wood = new THREE.MeshStandardMaterial({ color: 0x4a3b2c, roughness: 0.8 });

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.8, 8), wood);
    handle.position.y = -0.4;
    this.yFrameGroup.add(handle);

    const pGeo = new THREE.CylinderGeometry(0.03, 0.05, 0.6, 8);
    const lp = new THREE.Mesh(pGeo, wood);
    lp.position.set(-0.25, 0.25, 0); lp.rotation.z = -Math.PI / 6;
    this.yFrameGroup.add(lp);

    const rp = new THREE.Mesh(pGeo, wood);
    rp.position.set(0.25, 0.25, 0); rp.rotation.z = Math.PI / 6;
    this.yFrameGroup.add(rp);

    this.leftAnchor  = new THREE.Vector3(-0.35, 0.5, 0);
    this.rightAnchor = new THREE.Vector3( 0.35, 0.5, 0);
    this.slingshotGroup.add(this.yFrameGroup);
  }

  buildSling() {
    const mat = new THREE.LineBasicMaterial({ color: 0x884444, linewidth: 2 });
    this.pullPoint = new THREE.Vector3(0, 0.5, 0);
    this.lineGeo   = new THREE.BufferGeometry().setFromPoints([
      this.leftAnchor, this.pullPoint, this.rightAnchor
    ]);
    this.slingLine = new THREE.Line(this.lineGeo, mat);
    this.yFrameGroup.add(this.slingLine);
  }

  buildStaff() {
    this.staffGroup = new THREE.Group();
    this.staffGroup.position.set(0.5, -0.7, -0.75);
    this.staffGroup.scale.set(0.6, 0.6, 0.6);

    const wood = new THREE.MeshStandardMaterial({ color: 0x4a3b2c, roughness: 0.9 });
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.5, 8), wood);
    staff.rotation.x = Math.PI / 4;
    this.staffGroup.add(staff);

    this.cupGroup = new THREE.Group();
    this.cupGroup.position.set(0, 0.75, 0);
    const str = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.01, 0.8),
      new THREE.MeshBasicMaterial({ color: 0xaaaaaa })
    );
    str.position.y = 0.4;
    this.cupGroup.add(str);
    this.staffGroup.add(this.cupGroup);
    this.slingshotGroup.add(this.staffGroup);
  }

  // ── Weapon switching ──────────────────────────────────────────────────────

  switchWeapon(id) {
    this.activeWeapon = id;
    if (id === 1) {
      this.yFrameGroup.visible = true;
      this.staffGroup.visible  = false;
      this.updateSling(0);
    } else {
      this.yFrameGroup.visible = false;
      this.staffGroup.visible  = true;
      this.staffGroup.rotation.set(0, 0, 0);
    }
    if (!this.currentProjectile) this.loadProjectile();
    else this.updateProjectilePosition();
  }

  setProjectileSpec(spec) {
    this.projectileSpec = spec;
    if (this.projectileReady && this.currentProjectile) {
      this.engine.scene.remove(this.currentProjectile.mesh);
      this.engine.world.removeBody(this.currentProjectile.body);
      this.engine.physicsObjects = this.engine.physicsObjects.filter(o => o !== this.currentProjectile);
      this.currentProjectile = null;
      this.loadProjectile();
    }
  }

  // ── Animation ─────────────────────────────────────────────────────────────

  updateSling(pullAmount) {
    const rest   = new THREE.Vector3(0, 0.5, 0);
    const offset = new THREE.Vector3(0, -0.12, 0.9).multiplyScalar(pullAmount);
    this.pullPoint.copy(rest).add(offset);
    this.lineGeo.setFromPoints([this.leftAnchor, this.pullPoint, this.rightAnchor]);
    this.updateProjectilePosition();
  }

  updateStaff(whirl, dt) {
    if (whirl > 0) {
      this.staffGroup.rotation.z += 15 * whirl * dt;
      this.staffGroup.rotation.x  = Math.sin(Date.now() * 0.01) * 0.2;
    } else {
      this.staffGroup.rotation.z = THREE.MathUtils.lerp(this.staffGroup.rotation.z, 0, 0.1);
      this.staffGroup.rotation.x = THREE.MathUtils.lerp(this.staffGroup.rotation.x, 0, 0.1);
    }
    this.updateProjectilePosition();
  }

  updateProjectilePosition() {
    if (!this.currentProjectile || !this.projectileReady) return;

    // Force-update world matrices so applyMatrix4 is always correct
    this.yFrameGroup.updateWorldMatrix(true, false);
    this.cupGroup.updateWorldMatrix(true, false);

    let wp = new THREE.Vector3();
    if (this.activeWeapon === 1) {
      wp = this.pullPoint.clone().applyMatrix4(this.yFrameGroup.matrixWorld);
    } else {
      wp = new THREE.Vector3(0, 0.8, 0).applyMatrix4(this.cupGroup.matrixWorld);
    }
    this.currentProjectile.mesh.position.copy(wp);
    this.currentProjectile.body.position.set(wp.x, wp.y, wp.z);
  }

  // ── Projectile ────────────────────────────────────────────────────────────

  loadProjectile() {
    const s   = this.projectileSpec;
    const mat = new THREE.MeshStandardMaterial({
      color:    s.color,
      emissive: new THREE.Color(s.color).multiplyScalar(0.2),
      emissiveIntensity: 0.5,
      roughness: 0.7, metalness: 0.25
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(s.radius, 14, 14), mat);
    mesh.castShadow = true;

    const body = new CANNON.Body({
      mass: s.mass,
      shape: new CANNON.Sphere(s.radius),
      material: this.engine.defaultMaterial
    });
    body.type = CANNON.Body.KINEMATIC;
    body.collisionFilterGroup = 0;
    body.collisionFilterMask  = 0;
    // Prevent the projectile from tumbling wildly once fired
    body.fixedRotation  = true;
    body.angularDamping = 0.999;

    this.engine.scene.add(mesh);
    this.engine.world.addBody(body);
    this.currentProjectile = { mesh, body };
    this.projectileReady   = true;

    // Update world matrix so the ball appears in the sling immediately
    this.engine.scene.updateMatrixWorld(true);
    this.updateProjectilePosition();
  }

  /** Fire from the exact sling release point toward the camera aim direction */
  fire(forceVector) {
    if (!this.currentProjectile || !this.projectileReady) return;

    const proj = this.currentProjectile;
    this.projectileReady = false;
    this.lastFiredBody   = proj.body;

    proj.body.type = CANNON.Body.DYNAMIC;
    proj.body.collisionFilterGroup = 1;
    proj.body.collisionFilterMask  = 1;
    proj.body.fixedRotation  = true;  // keep no-spin after release
    proj.body.angularDamping = 0.999;
    proj.body.wakeUp();

    // Release from the sling pouch world position (already synced in body.position)
    proj.body.applyImpulse(
      new CANNON.Vec3(forceVector.x, forceVector.y, forceVector.z),
      proj.body.position
    );

    this.engine.physicsObjects.push(proj);

    if (this.activeWeapon === 1) this.updateSling(0);
    else this.staffGroup.rotation.x = -Math.PI / 4;

    setTimeout(() => {
      this._pruneOldProjectiles();
      this.loadProjectile();
    }, 4500);
  }

  _pruneOldProjectiles() {
    const spheres = this.engine.physicsObjects.filter(
      o => o.mesh?.geometry?.type === 'SphereGeometry'
    );
    if (spheres.length > 20) {
      const old = spheres[0];
      this.engine.scene.remove(old.mesh);
      this.engine.world.removeBody(old.body);
      this.engine.physicsObjects = this.engine.physicsObjects.filter(o => o !== old);
    }
  }

  /** World position of the ball right now — used by InputController for trajectory */
  getProjectileWorldPos() {
    if (!this.currentProjectile) return new THREE.Vector3();
    return this.currentProjectile.mesh.position.clone();
  }
}
