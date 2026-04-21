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

    // Default projectile spec — overridden by InputController per ammo type
    this.projectileSpec = { radius: 0.1, mass: 1, color: 0x333333 };

    this.currentProjectile = null;
    this.projectileReady = true;
    this.lastFiredBody = null;

    this.activeWeapon = 1;
    this.switchWeapon(1);
    this.loadProjectile();
  }

  buildYFrame() {
    this.yFrameGroup = new THREE.Group();
    // Smaller and closer than before
    this.yFrameGroup.position.set(0.32, -0.48, -0.85);
    this.yFrameGroup.rotation.y = -0.2;
    this.yFrameGroup.scale.set(0.55, 0.55, 0.55);

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3b2c, roughness: 0.8 });

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.8, 8), woodMat);
    handle.position.y = -0.4;
    this.yFrameGroup.add(handle);

    const prongGeo = new THREE.CylinderGeometry(0.03, 0.05, 0.6, 8);
    const leftProng = new THREE.Mesh(prongGeo, woodMat);
    leftProng.position.set(-0.25, 0.25, 0);
    leftProng.rotation.z = -Math.PI / 6;
    this.yFrameGroup.add(leftProng);

    const rightProng = new THREE.Mesh(prongGeo, woodMat);
    rightProng.position.set(0.25, 0.25, 0);
    rightProng.rotation.z = Math.PI / 6;
    this.yFrameGroup.add(rightProng);

    this.leftAnchor  = new THREE.Vector3(-0.35, 0.5, 0);
    this.rightAnchor = new THREE.Vector3( 0.35, 0.5, 0);

    this.slingshotGroup.add(this.yFrameGroup);
  }

  buildSling() {
    const lineMat = new THREE.LineBasicMaterial({ color: 0x884444, linewidth: 2 });
    this.pullPoint = new THREE.Vector3(0, 0.5, 0);
    this.lineGeo = new THREE.BufferGeometry().setFromPoints([
      this.leftAnchor, this.pullPoint, this.rightAnchor
    ]);
    this.slingLine = new THREE.Line(this.lineGeo, lineMat);
    this.yFrameGroup.add(this.slingLine);
  }

  buildStaff() {
    this.staffGroup = new THREE.Group();
    this.staffGroup.position.set(0.5, -0.7, -0.75);
    this.staffGroup.scale.set(0.6, 0.6, 0.6);

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3b2c, roughness: 0.9 });
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.5, 8), woodMat);
    staff.rotation.x = Math.PI / 4;
    this.staffGroup.add(staff);

    this.cupGroup = new THREE.Group();
    this.cupGroup.position.set(0, 0.75, 0);
    const stringMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.01, 0.8),
      new THREE.MeshBasicMaterial({ color: 0xaaaaaa })
    );
    stringMesh.position.y = 0.4;
    this.cupGroup.add(stringMesh);
    this.staffGroup.add(this.cupGroup);
    this.slingshotGroup.add(this.staffGroup);
  }

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
    // If idle, immediately swap to the new ammo so player can see the colour
    if (this.projectileReady && this.currentProjectile) {
      this.engine.scene.remove(this.currentProjectile.mesh);
      this.engine.world.removeBody(this.currentProjectile.body);
      this.engine.physicsObjects = this.engine.physicsObjects.filter(o => o !== this.currentProjectile);
      this.currentProjectile = null;
      this.loadProjectile();
    }
  }

  updateSling(pullAmount) {
    const restingPos = new THREE.Vector3(0, 0.5, 0);
    const pullOffset = new THREE.Vector3(0, -0.12, 0.9).multiplyScalar(pullAmount);
    this.pullPoint.copy(restingPos).add(pullOffset);
    this.lineGeo.setFromPoints([this.leftAnchor, this.pullPoint, this.rightAnchor]);
    this.updateProjectilePosition();
  }

  updateStaff(whirlAmount, dt) {
    if (whirlAmount > 0) {
      this.staffGroup.rotation.z += 15 * whirlAmount * dt;
      this.staffGroup.rotation.x  = Math.sin(Date.now() * 0.01) * 0.2;
    } else {
      this.staffGroup.rotation.z = THREE.MathUtils.lerp(this.staffGroup.rotation.z, 0, 0.1);
      this.staffGroup.rotation.x = THREE.MathUtils.lerp(this.staffGroup.rotation.x, 0, 0.1);
    }
    this.updateProjectilePosition();
  }

  updateProjectilePosition() {
    if (!this.currentProjectile || !this.projectileReady) return;
    let worldPos = new THREE.Vector3();
    if (this.activeWeapon === 1) {
      worldPos = this.pullPoint.clone().applyMatrix4(this.yFrameGroup.matrixWorld);
    } else {
      worldPos = new THREE.Vector3(0, 0.8, 0).applyMatrix4(this.cupGroup.matrixWorld);
    }
    this.currentProjectile.mesh.position.copy(worldPos);
    this.currentProjectile.body.position.set(worldPos.x, worldPos.y, worldPos.z);
  }

  loadProjectile() {
    const s = this.projectileSpec;
    const geo = new THREE.SphereGeometry(s.radius, 14, 14);
    const mat = new THREE.MeshStandardMaterial({
      color: s.color,
      emissive: new THREE.Color(s.color).multiplyScalar(0.25),
      emissiveIntensity: 0.5,
      roughness: 0.7,
      metalness: 0.3
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;

    const body = new CANNON.Body({
      mass: s.mass,
      shape: new CANNON.Sphere(s.radius),
      material: this.engine.defaultMaterial
    });
    body.type = CANNON.Body.KINEMATIC;
    body.collisionFilterGroup = 0;
    body.collisionFilterMask  = 0;

    this.engine.scene.add(mesh);
    this.engine.world.addBody(body);

    this.currentProjectile = { mesh, body };
    this.projectileReady = true;
    this.updateProjectilePosition();
  }

  fire(forceVector) {
    if (!this.currentProjectile || !this.projectileReady) return;

    const proj = this.currentProjectile;
    this.projectileReady = false;
    this.lastFiredBody   = proj.body;

    proj.body.type = CANNON.Body.DYNAMIC;
    proj.body.collisionFilterGroup = 1;
    proj.body.collisionFilterMask  = 1;
    proj.body.wakeUp();

    // Fire from camera centre so trajectory matches crosshair
    const camDir = new THREE.Vector3();
    this.engine.camera.getWorldDirection(camDir);
    const firePos = this.engine.camera.position.clone().addScaledVector(camDir, 0.9);
    proj.body.position.set(firePos.x, firePos.y, firePos.z);
    proj.mesh.position.copy(firePos);

    proj.body.applyImpulse(
      new CANNON.Vec3(forceVector.x, forceVector.y, forceVector.z),
      proj.body.position
    );

    this.engine.physicsObjects.push(proj);

    if (this.activeWeapon === 1) this.updateSling(0);
    else this.staffGroup.rotation.x = -Math.PI / 4;

    setTimeout(() => {
      this._cleanupOldProjectiles();
      this.loadProjectile();
    }, 4000);
  }

  _cleanupOldProjectiles() {
    const all = this.engine.physicsObjects.filter(o => o.mesh.geometry.type === 'SphereGeometry');
    if (all.length > 18) {
      const oldest = all[0];
      this.engine.scene.remove(oldest.mesh);
      this.engine.world.removeBody(oldest.body);
      this.engine.physicsObjects = this.engine.physicsObjects.filter(o => o !== oldest);
    }
  }
}
