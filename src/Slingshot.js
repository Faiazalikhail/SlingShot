import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Slingshot {
  constructor(engine) {
    this.engine = engine;

    this.slingshotGroup = new THREE.Group();
    // Position slingshot slightly in front of the camera
    this.slingshotGroup.position.set(0, 2, 6);
    this.engine.scene.add(this.slingshotGroup);

    this.buildYFrame();
    this.buildSling();

    // Projectile setup
    this.projectileRadius = 0.3;
    this.projectileMass = 1;
    this.currentProjectile = null;
    this.projectileReady = true;

    this.loadProjectile();
  }

  buildYFrame() {
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x4a3b2c,
      roughness: 0.8
    });

    // Handle (Base)
    const handleGeo = new THREE.CylinderGeometry(0.1, 0.15, 1, 8);
    const handle = new THREE.Mesh(handleGeo, woodMat);
    handle.position.y = -0.5;
    handle.castShadow = true;
    this.slingshotGroup.add(handle);

    // Left Prong
    const prongGeo = new THREE.CylinderGeometry(0.05, 0.1, 1, 8);
    const leftProng = new THREE.Mesh(prongGeo, woodMat);
    leftProng.position.set(-0.4, 0.4, 0);
    leftProng.rotation.z = -Math.PI / 6;
    leftProng.castShadow = true;
    this.slingshotGroup.add(leftProng);

    // Right Prong
    const rightProng = new THREE.Mesh(prongGeo, woodMat);
    rightProng.position.set(0.4, 0.4, 0);
    rightProng.rotation.z = Math.PI / 6;
    rightProng.castShadow = true;
    this.slingshotGroup.add(rightProng);

    // Anchor points for the sling band
    this.leftAnchor = new THREE.Vector3(-0.6, 0.8, 0);
    this.rightAnchor = new THREE.Vector3(0.6, 0.8, 0);
  }

  buildSling() {
    // We use a Line to represent the dynamic elastic band
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x884444,
      linewidth: 3
    });

    // 3 points: Left Anchor -> Pouch/Pull Point -> Right Anchor
    this.pullPoint = new THREE.Vector3(0, 0.8, 0);

    const points = [
      this.leftAnchor,
      this.pullPoint,
      this.rightAnchor
    ];

    this.lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    this.slingLine = new THREE.Line(this.lineGeo, lineMat);
    this.slingshotGroup.add(this.slingLine);
  }

  updateSling(pullVector) {
    // pullVector is relative to the slingshot center
    // Default resting position
    const restingPos = new THREE.Vector3(0, 0.8, 0);

    // Add pull offset
    this.pullPoint.copy(restingPos).add(pullVector);

    // Update geometry
    const points = [
      this.leftAnchor,
      this.pullPoint,
      this.rightAnchor
    ];
    this.lineGeo.setFromPoints(points);

    // If there is a loaded projectile, move it with the pouch
    if (this.currentProjectile && this.projectileReady) {
      // The pullPoint is relative to the slingshotGroup
      // We need to set the projectile mesh position in world space for visual
      const worldPouchPos = this.pullPoint.clone().applyMatrix4(this.slingshotGroup.matrixWorld);
      this.currentProjectile.mesh.position.copy(worldPouchPos);
    }
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

    // Start body as kinematic so it doesn't fall while aiming
    body.type = CANNON.Body.KINEMATIC;
    body.collisionFilterGroup = 0; // Disable collision temporarily while loaded
    body.collisionFilterMask = 0;

    // Set initial position to resting pouch point
    const worldPouchPos = new THREE.Vector3(0, 0.8, 0).applyMatrix4(this.slingshotGroup.matrixWorld);
    mesh.position.copy(worldPouchPos);
    body.position.copy(worldPouchPos);

    this.engine.scene.add(mesh);
    this.engine.world.addBody(body);

    this.currentProjectile = { mesh, body };
    this.projectileReady = true;
  }

  fire(forceVector) {
    if (!this.currentProjectile || !this.projectileReady) return;

    const proj = this.currentProjectile;
    this.projectileReady = false;

    // Enable physics
    proj.body.type = CANNON.Body.DYNAMIC;
    proj.body.collisionFilterGroup = 1;
    proj.body.collisionFilterMask = 1;
    proj.body.wakeUp();

    // Ensure physics body is at exact release point
    proj.body.position.copy(proj.mesh.position);

    // Apply impulse
    proj.body.applyImpulse(new CANNON.Vec3(forceVector.x, forceVector.y, forceVector.z), proj.body.position);

    // Register with engine for sync
    this.engine.physicsObjects.push(proj);

    // Snap sling back to rest
    this.updateSling(new THREE.Vector3(0,0,0));

    // Reload after a delay
    setTimeout(() => {
      this.cleanupProjectile(proj);
      this.loadProjectile();
    }, 4000);
  }

  cleanupProjectile(proj) {
    // Optionally clean up old projectiles to save memory
    // Only keeping a few recent ones
    const maxProjectiles = 5;
    const allProjObjects = this.engine.physicsObjects.filter(obj => obj.mesh.geometry.type === 'SphereGeometry');

    if (allProjObjects.length > maxProjectiles) {
        const oldest = allProjObjects[0];
        this.engine.scene.remove(oldest.mesh);
        this.engine.world.removeBody(oldest.body);
        this.engine.physicsObjects = this.engine.physicsObjects.filter(obj => obj !== oldest);
    }
  }
}
