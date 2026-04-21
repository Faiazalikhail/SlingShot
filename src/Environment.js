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

    // Bright red-orange pots — easy to spot against sandy/grey environment
    this.potteryMaterial = new THREE.MeshStandardMaterial({
      color: 0xff3300,
      roughness: 0.6,
      metalness: 0.1,
      emissive: new THREE.Color(0x661100),
      emissiveIntensity: 0.6
    });

    // Bright blue elevated targets
    this.elevatedTargetMaterial = new THREE.MeshStandardMaterial({
      color: 0x0077ff,
      roughness: 0.5,
      metalness: 0.2,
      emissive: new THREE.Color(0x002266),
      emissiveIntensity: 0.6
    });

    // Bright gold prize target
    this.prizeMaterial = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      roughness: 0.3,
      metalness: 0.7,
      emissive: new THREE.Color(0x664400),
      emissiveIntensity: 0.8
    });

    this.woodMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b6914,
      roughness: 0.8,
      metalness: 0.0,
      emissive: new THREE.Color(0x332200),
      emissiveIntensity: 0.3
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
      // 3 Ground Targets — bright red, 1m cubes so they're easy to see and hit
      this.createDynamicBox(1.0, 1.0, 1.0, -5, 0.5, -10, this.potteryMaterial, 1);
      this.createDynamicBox(1.0, 1.0, 1.0, 0,  0.5, -15, this.potteryMaterial, 1);
      this.createDynamicBox(1.0, 1.0, 1.0, 5,  0.5, -12, this.potteryMaterial, 1);

      // 2 Elevated Targets — bright blue on the platforms
      this.createDynamicBox(1.2, 1.2, 1.2, -10, 4.6, -20, this.elevatedTargetMaterial, 1);
      this.createDynamicBox(1.2, 1.2, 1.2,  12, 2.6, -15, this.elevatedTargetMaterial, 1);

      // Long-range stack — larger wooden blocks with a glowing gold prize on top
      const exX = 0;
      const exZ = -29;
      const exY = 8.5;
      this.createDynamicBox(1.5, 1.5, 1.5, exX,        exY,       exZ, this.woodMaterial, 2);
      this.createDynamicBox(1.5, 1.5, 1.5, exX - 1.8,  exY,       exZ, this.woodMaterial, 2);
      this.createDynamicBox(1.5, 1.5, 1.5, exX + 1.8,  exY,       exZ, this.woodMaterial, 2);
      this.createDynamicBox(1.5, 1.5, 1.5, exX,        exY + 1.6, exZ, this.prizeMaterial, 1); // The prize
  }
}
