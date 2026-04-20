import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Engine {
  constructor() {
    this.container = document.getElementById('canvas-container');

    // --- Three.js Setup ---
    this.scene = new THREE.Scene();
    // Desaturated, dusty atmosphere (fog)
    this.scene.background = new THREE.Color(0xa0a0a0);
    this.scene.fog = new THREE.Fog(0xa0a0a0, 10, 50);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    // Position camera behind the slingshot
    this.camera.position.set(0, 2, 8);
    this.camera.lookAt(0, 2, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffeedd, 0.8);
    dirLight.position.set(5, 10, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 50;
    dirLight.shadow.camera.left = -15;
    dirLight.shadow.camera.right = 15;
    dirLight.shadow.camera.top = 15;
    dirLight.shadow.camera.bottom = -15;
    this.scene.add(dirLight);

    // --- Cannon-es Setup ---
    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.81, 0);
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.solver.iterations = 10;

    // Default Physics Material
    this.defaultMaterial = new CANNON.Material('default');
    const defaultContactMaterial = new CANNON.ContactMaterial(
      this.defaultMaterial,
      this.defaultMaterial,
      {
        friction: 0.5,
        restitution: 0.3,
      }
    );
    this.world.addContactMaterial(defaultContactMaterial);

    // Arrays to keep track of bodies to update meshes
    this.physicsObjects = [];

    // --- Ground ---
    this.createGround();

    // Resize handling
    window.addEventListener('resize', this.onWindowResize.bind(this));

    // Clock for time stepping
    this.clock = new THREE.Clock();
  }

  createGround() {
    // Three.js Ground
    const groundGeo = new THREE.PlaneGeometry(100, 100);
    // Sandy-grey material
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x9e9581,
      roughness: 0.9,
      metalness: 0.1
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    this.scene.add(groundMesh);

    // Cannon-es Ground
    const groundShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({
      mass: 0, // static
      shape: groundShape,
      material: this.defaultMaterial
    });
    // Cannon planes face Z by default, rotate to face Y
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    this.world.addBody(groundBody);
  }

  addPhysicsObject(mesh, body) {
    this.scene.add(mesh);
    this.world.addBody(body);
    this.physicsObjects.push({ mesh, body });
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  update() {
    const dt = Math.min(this.clock.getDelta(), 0.1); // Cap dt

    // Step physics world
    this.world.step(1 / 60, dt, 3);

    // Sync meshes with bodies
    for (const obj of this.physicsObjects) {
      obj.mesh.position.copy(obj.body.position);
      obj.mesh.quaternion.copy(obj.body.quaternion);
    }

    // Render
    this.renderer.render(this.scene, this.camera);
  }
}
