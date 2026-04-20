import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Slingshot {
  constructor(engine, playerController) {
    this.engine = engine;
    this.playerController = playerController;

    this.slingshotGroup = new THREE.Group();
    // Attach directly to the camera for first-person view
    this.engine.camera.add(this.slingshotGroup);
    this.engine.scene.add(this.engine.camera); // Ensure camera is in scene to render children

    this.buildYFrame();
    this.buildSling();
    this.buildStaff();

    // Projectile setup
    this.projectileRadius = 0.2;
    this.projectileMass = 1;
    this.currentProjectile = null;
    this.projectileReady = true;

    this.activeWeapon = 1; // 1 = Y-Frame, 2 = Staff

    this.switchWeapon(1);
    this.loadProjectile();
  }

  buildYFrame() {
    this.yFrameGroup = new THREE.Group();
    // Position slingshot slightly in front and to the right of camera
    this.yFrameGroup.position.set(0.5, -0.4, -1.5);
    // Angle it slightly
    this.yFrameGroup.rotation.y = -0.2;

    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x4a3b2c,
      roughness: 0.8
    });

    // Handle
    const handleGeo = new THREE.CylinderGeometry(0.05, 0.08, 0.8, 8);
    const handle = new THREE.Mesh(handleGeo, woodMat);
    handle.position.y = -0.4;
    this.yFrameGroup.add(handle);

    // Left Prong
    const prongGeo = new THREE.CylinderGeometry(0.03, 0.05, 0.6, 8);
    const leftProng = new THREE.Mesh(prongGeo, woodMat);
    leftProng.position.set(-0.25, 0.25, 0);
    leftProng.rotation.z = -Math.PI / 6;
    this.yFrameGroup.add(leftProng);

    // Right Prong
    const rightProng = new THREE.Mesh(prongGeo, woodMat);
    rightProng.position.set(0.25, 0.25, 0);
    rightProng.rotation.z = Math.PI / 6;
    this.yFrameGroup.add(rightProng);

    // Anchor points
    this.leftAnchor = new THREE.Vector3(-0.35, 0.5, 0);
    this.rightAnchor = new THREE.Vector3(0.35, 0.5, 0);

    this.slingshotGroup.add(this.yFrameGroup);
  }

  buildSling() {
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x884444,
      linewidth: 3
    });

    this.pullPoint = new THREE.Vector3(0, 0.5, 0);

    const points = [
      this.leftAnchor,
      this.pullPoint,
      this.rightAnchor
    ];

    this.lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    this.slingLine = new THREE.Line(this.lineGeo, lineMat);
    this.yFrameGroup.add(this.slingLine);
  }

  buildStaff() {
    this.staffGroup = new THREE.Group();
    // Position staff mostly off screen, acting like an arm holding a sling
    this.staffGroup.position.set(0.8, -1, -1);

    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x4a3b2c,
      roughness: 0.9
    });

    const staffGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.5, 8);
    const staff = new THREE.Mesh(staffGeo, woodMat);
    // Angle it forward
    staff.rotation.x = Math.PI / 4;
    this.staffGroup.add(staff);

    // Leather cup visual for the staff
    this.cupGroup = new THREE.Group();
    this.cupGroup.position.set(0, 0.75, 0); // End of staff

    const stringGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.8);
    const stringMat = new THREE.MeshBasicMaterial({color: 0xaaaaaa});
    const stringMesh = new THREE.Mesh(stringGeo, stringMat);
    stringMesh.position.y = 0.4;
    this.cupGroup.add(stringMesh);

    this.staffGroup.add(this.cupGroup);
    this.slingshotGroup.add(this.staffGroup);
  }

  switchWeapon(id) {
    this.activeWeapon = id;
    if (id === 1) {
        this.yFrameGroup.visible = true;
        this.staffGroup.visible = false;
        // Reset pull
        this.updateSling(0);
    } else {
        this.yFrameGroup.visible = false;
        this.staffGroup.visible = true;
        // Reset rotation
        this.staffGroup.rotation.set(0,0,0);
    }

    if(!this.currentProjectile) {
        this.loadProjectile();
    } else {
        this.updateProjectilePosition();
    }
  }

  updateSling(pullAmount) {
    // pullAmount is 0 to 1
    const restingPos = new THREE.Vector3(0, 0.5, 0);
    // Pull backwards (positive Z) and slightly down
    const pullOffset = new THREE.Vector3(0, -0.2, 1.5).multiplyScalar(pullAmount);

    this.pullPoint.copy(restingPos).add(pullOffset);

    const points = [
      this.leftAnchor,
      this.pullPoint,
      this.rightAnchor
    ];
    this.lineGeo.setFromPoints(points);

    this.updateProjectilePosition();
  }

  updateStaff(whirlAmount, dt) {
     // Whirl animation based on charge
     if (whirlAmount > 0) {
         // Rotate the entire staff group wildly
         const speed = 15 * whirlAmount; // Faster based on charge
         this.staffGroup.rotation.z += speed * dt;
         // Slight wobble
         this.staffGroup.rotation.x = Math.sin(Date.now() * 0.01) * 0.2;
     } else {
         // Reset smoothly
         this.staffGroup.rotation.z = THREE.MathUtils.lerp(this.staffGroup.rotation.z, 0, 0.1);
         this.staffGroup.rotation.x = THREE.MathUtils.lerp(this.staffGroup.rotation.x, 0, 0.1);
     }
     this.updateProjectilePosition();
  }

  updateProjectilePosition() {
    if (!this.currentProjectile || !this.projectileReady) return;

    let worldPouchPos = new THREE.Vector3();

    if (this.activeWeapon === 1) {
        worldPouchPos = this.pullPoint.clone().applyMatrix4(this.yFrameGroup.matrixWorld);
    } else {
        // Top of the string on the staff
        worldPouchPos = new THREE.Vector3(0, 0.8, 0).applyMatrix4(this.cupGroup.matrixWorld);
    }

    this.currentProjectile.mesh.position.copy(worldPouchPos);
  }

  loadProjectile() {
    const projGeo = new THREE.SphereGeometry(this.projectileRadius, 16, 16);
    const projMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.7,
      metalness: 0.3
    });
    const mesh = new THREE.Mesh(projGeo, projMat);
    mesh.castShadow = true;

    const shape = new CANNON.Sphere(this.projectileRadius);
    const body = new CANNON.Body({
      mass: this.projectileMass,
      shape: shape,
      material: this.engine.defaultMaterial
    });

    body.type = CANNON.Body.KINEMATIC;
    body.collisionFilterGroup = 0;
    body.collisionFilterMask = 0;

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

    proj.body.type = CANNON.Body.DYNAMIC;
    proj.body.collisionFilterGroup = 1;
    proj.body.collisionFilterMask = 1;
    proj.body.wakeUp();

    proj.body.position.copy(proj.mesh.position);

    proj.body.applyImpulse(new CANNON.Vec3(forceVector.x, forceVector.y, forceVector.z), proj.body.position);

    this.engine.physicsObjects.push(proj);

    if (this.activeWeapon === 1) {
        this.updateSling(0);
    } else {
        // Staff follow through
        this.staffGroup.rotation.x = -Math.PI / 4;
    }

    setTimeout(() => {
      this.cleanupProjectile(proj);
      this.loadProjectile();
    }, 4000);
  }

  cleanupProjectile(proj) {
    const maxProjectiles = 15; // Increased since course is bigger
    const allProjObjects = this.engine.physicsObjects.filter(obj => obj.mesh.geometry.type === 'SphereGeometry');

    if (allProjObjects.length > maxProjectiles) {
        const oldest = allProjObjects[0];
        this.engine.scene.remove(oldest.mesh);
        this.engine.world.removeBody(oldest.body);
        this.engine.physicsObjects = this.engine.physicsObjects.filter(obj => obj !== oldest);
    }
  }
}
