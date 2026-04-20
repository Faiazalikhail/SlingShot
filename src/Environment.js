import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Environment {
  constructor(engine) {
    this.engine = engine;

    // Materials
    this.mudBrickMaterial = new THREE.MeshStandardMaterial({
      color: 0x8a7b66,
      roughness: 0.95,
      metalness: 0.05
    });

    this.potteryMaterial = new THREE.MeshStandardMaterial({
      color: 0xa87c65,
      roughness: 0.8,
      metalness: 0.1
    });

    this.woodMaterial = new THREE.MeshStandardMaterial({
      color: 0x5a4b3c,
      roughness: 0.9,
      metalness: 0.0
    });

    this.buildBalaHissar();
    this.buildTargetCourse();
  }

  createStaticBox(width, height, depth, x, y, z, material) {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const shape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2));
    const body = new CANNON.Body({
      mass: 0,
      shape: shape,
      position: new CANNON.Vec3(x, y, z),
      material: this.engine.defaultMaterial
    });

    this.engine.addPhysicsObject(mesh, body);
    return { mesh, body };
  }

  createDynamicBox(width, height, depth, x, y, z, material, mass) {
      const geo = new THREE.BoxGeometry(width, height, depth);
      const mesh = new THREE.Mesh(geo, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const shape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2));
      const body = new CANNON.Body({
        mass: mass,
        shape: shape,
        position: new CANNON.Vec3(x, y, z),
        material: this.engine.defaultMaterial
      });

      this.engine.addPhysicsObject(mesh, body);
      return { mesh, body };
  }

  buildBalaHissar() {
      // Large walls to walk around
      this.createStaticBox(40, 8, 2, 0, 4, -30, this.mudBrickMaterial); // Back wall
      this.createStaticBox(2, 8, 40, -20, 4, -10, this.mudBrickMaterial); // Left wall
      this.createStaticBox(2, 8, 40, 20, 4, -10, this.mudBrickMaterial); // Right wall

      // Some platforms and ruins
      this.createStaticBox(6, 4, 6, -10, 2, -20, this.mudBrickMaterial);
      this.createStaticBox(8, 2, 8, 12, 1, -15, this.mudBrickMaterial);
  }

  buildTargetCourse() {
      // 3 Ground Targets (Small clay pots on the floor/low walls)
      this.createDynamicBox(0.6, 0.6, 0.6, -5, 0.3, -10, this.potteryMaterial, 1);
      this.createDynamicBox(0.6, 0.6, 0.6, 0, 0.3, -15, this.potteryMaterial, 1);
      this.createDynamicBox(0.6, 0.6, 0.6, 5, 0.3, -12, this.potteryMaterial, 1);

      // 2 Hanging/Floating Targets (Resting high up on walls)
      // Placed on the ruins platforms
      this.createDynamicBox(0.8, 0.8, 0.8, -10, 4.4, -20, this.potteryMaterial, 1);
      this.createDynamicBox(0.8, 0.8, 0.8, 12, 2.4, -15, this.potteryMaterial, 1);

      // 1 Extreme-Range Target (Far back on the main wall)
      // Small structural pile
      const exX = 0;
      const exZ = -29;
      const exY = 8.5; // Top of the 8-unit high wall
      this.createDynamicBox(1, 1, 1, exX, exY, exZ, this.woodMaterial, 2);
      this.createDynamicBox(1, 1, 1, exX - 1.2, exY, exZ, this.woodMaterial, 2);
      this.createDynamicBox(1, 1, 1, exX + 1.2, exY, exZ, this.woodMaterial, 2);
      this.createDynamicBox(1.2, 1.2, 1.2, exX, exY + 1.1, exZ, this.potteryMaterial, 1); // The prize
  }
}
