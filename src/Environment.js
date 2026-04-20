import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Environment {
  constructor(engine) {
    this.engine = engine;

    // Materials
    this.mudBrickMaterial = new THREE.MeshStandardMaterial({
      color: 0x8a7b66, // Desaturated mud color
      roughness: 0.95,
      metalness: 0.05
    });

    this.potteryMaterial = new THREE.MeshStandardMaterial({
      color: 0xa87c65, // Terracotta-ish but dusty
      roughness: 0.8,
      metalness: 0.1
    });

    this.woodMaterial = new THREE.MeshStandardMaterial({
      color: 0x5a4b3c, // Dark dusty wood
      roughness: 0.9,
      metalness: 0.0
    });

    this.buildExerciseA();
    this.buildExerciseB();
    this.buildExerciseC();
  }

  // Helper to create a static box
  createStaticBox(width, height, depth, x, y, z, material) {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const shape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2));
    const body = new CANNON.Body({
      mass: 0, // static
      shape: shape,
      position: new CANNON.Vec3(x, y, z),
      material: this.engine.defaultMaterial
    });

    this.engine.addPhysicsObject(mesh, body);
    return { mesh, body };
  }

  // Helper to create a dynamic object
  createDynamicObject(mesh, shape, mass, x, y, z) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const body = new CANNON.Body({
      mass: mass,
      shape: shape,
      position: new CANNON.Vec3(x, y, z),
      material: this.engine.defaultMaterial
    });

    this.engine.addPhysicsObject(mesh, body);
    return { mesh, body };
  }

  buildExerciseA() {
    // Exercise A: Precision Hit (Center Left)
    // A mud-brick wall with a clay pot on top
    const wallX = -6;
    const wallZ = -10;

    // Wall
    this.createStaticBox(3, 2, 0.5, wallX, 1, wallZ, this.mudBrickMaterial);

    // Clay Pot Target
    const potGeo = new THREE.CylinderGeometry(0.3, 0.2, 0.6, 8);
    const potShape = new CANNON.Cylinder(0.3, 0.2, 0.6, 8);
    // Adjust shape orientation for Cannon cylinder
    const q = new CANNON.Quaternion();
    q.setFromAxisAngle(new CANNON.Vec3(1,0,0), -Math.PI/2);
    // Since cannon-es shapes are oriented differently, we need to handle rotation
    // Actually, cannon-es cylinder is oriented along Z. Let's use a box for simplicity and reliability,
    // or properly rotate the shape.

    // Let's use a simpler Box shape for the pot to avoid orientation mismatch bugs easily
    const simplePotShape = new CANNON.Box(new CANNON.Vec3(0.3, 0.3, 0.3));

    this.createDynamicObject(
      new THREE.Mesh(potGeo, this.potteryMaterial),
      simplePotShape,
      1, // mass
      wallX, 2 + 0.3, wallZ
    );
  }

  buildExerciseB() {
    // Exercise B: Arced Trajectory (Center Right, further back)
    // A collapsed archway with a target hidden behind it
    const archX = 6;
    const archZ = -18;

    // Left Pillar
    this.createStaticBox(1, 4, 1, archX - 2, 2, archZ, this.mudBrickMaterial);
    // Right Pillar
    this.createStaticBox(1, 4, 1, archX + 2, 2, archZ, this.mudBrickMaterial);
    // Top Arch (Lintel)
    this.createStaticBox(5, 1, 1, archX, 4.5, archZ, this.mudBrickMaterial);

    // Obstacle Wall in front of target
    this.createStaticBox(4, 2, 0.5, archX, 1, archZ - 1, this.mudBrickMaterial);

    // Target hidden behind
    const targetGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const targetShape = new CANNON.Box(new CANNON.Vec3(0.4, 0.4, 0.4));

    this.createDynamicObject(
      new THREE.Mesh(targetGeo, this.potteryMaterial),
      targetShape,
      1,
      archX, 0.4, archZ - 3
    );
  }

  buildExerciseC() {
    // Exercise C: Structural Impact (Center, very far)
    // Timber support holding up rubble
    const structX = 0;
    const structZ = -25;

    // Timber support (Tall, thin box) - Dynamic but resting
    const supportGeo = new THREE.BoxGeometry(0.4, 4, 0.4);
    const supportShape = new CANNON.Box(new CANNON.Vec3(0.2, 2, 0.2));

    this.createDynamicObject(
      new THREE.Mesh(supportGeo, this.woodMaterial),
      supportShape,
      5, // mass
      structX, 2, structZ
    );

    // Rubble on top (Stack of boxes)
    const rubbleSize = 0.6;
    const rubbleGeo = new THREE.BoxGeometry(rubbleSize, rubbleSize, rubbleSize);
    const rubbleShape = new CANNON.Box(new CANNON.Vec3(rubbleSize/2, rubbleSize/2, rubbleSize/2));

    const numBoxes = 3;
    for(let i=0; i<numBoxes; i++) {
        for(let j=0; j<numBoxes; j++) {
            this.createDynamicObject(
                new THREE.Mesh(rubbleGeo, this.mudBrickMaterial),
                rubbleShape,
                2,
                structX - (rubbleSize) + (i*rubbleSize),
                4 + (rubbleSize/2) + (j*rubbleSize),
                structZ
            );
        }
    }

    // Add a plank under the rubble resting on the support
    const plankGeo = new THREE.BoxGeometry(3, 0.2, 1);
    const plankShape = new CANNON.Box(new CANNON.Vec3(1.5, 0.1, 0.5));
    this.createDynamicObject(
        new THREE.Mesh(plankGeo, this.woodMaterial),
        plankShape,
        2,
        structX, 4.1, structZ
    );
  }
}
