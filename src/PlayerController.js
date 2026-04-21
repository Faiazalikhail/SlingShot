import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

export class PlayerController {
  constructor(engine) {
    this.engine = engine;

    // PointerLock controls
    this.controls = new PointerLockControls(this.engine.camera, document.body);

    // Overlay to handle Pointer Lock API
    this.blocker = document.createElement('div');
    this.blocker.style.position = 'absolute';
    this.blocker.style.top = '0';
    this.blocker.style.left = '0';
    this.blocker.style.width = '100%';
    this.blocker.style.height = '100%';
    this.blocker.style.backgroundColor = 'rgba(0,0,0,0.5)';
    this.blocker.style.display = 'flex';
    this.blocker.style.flexDirection = 'column';
    this.blocker.style.justifyContent = 'center';
    this.blocker.style.alignItems = 'center';
    this.blocker.style.color = 'white';
    this.blocker.style.zIndex = '10';

    const instructions = document.createElement('div');
    instructions.style.fontSize = '36px';
    instructions.innerText = 'Click to Play';
    this.blocker.appendChild(instructions);

    const help = document.createElement('div');
    help.style.marginTop = '20px';
    help.style.fontSize = '16px';
    help.innerText = 'WASD: Move | Mouse: Look | 1: Precision Sling | 2: Staff Sling | LMB: Charge/Fire';
    this.blocker.appendChild(help);

    document.body.appendChild(this.blocker);

    // Crosshair
    const crosshair = document.createElement('div');
    crosshair.style.position = 'absolute';
    crosshair.style.top = '50%';
    crosshair.style.left = '50%';
    crosshair.style.width = '6px';
    crosshair.style.height = '6px';
    crosshair.style.backgroundColor = 'white';
    crosshair.style.borderRadius = '50%';
    crosshair.style.transform = 'translate(-50%, -50%)';
    crosshair.style.pointerEvents = 'none';
    crosshair.style.zIndex = '5';
    document.body.appendChild(crosshair);

    this.blocker.addEventListener('click', () => {
      this.controls.lock();
    });

    this.controls.addEventListener('lock', () => {
      this.blocker.style.display = 'none';
    });

    this.controls.addEventListener('unlock', () => {
      this.blocker.style.display = 'flex';
    });

    // Physics Body for Player
    this.playerRadius = 0.5;
    this.playerHeight = 1.8;
    this.mass = 60; // kg

    const shape = new CANNON.Cylinder(this.playerRadius, this.playerRadius, this.playerHeight, 16);
    // Cylinder is aligned along Z in cannon-es, rotate it to be upright (Y)
    const q = new CANNON.Quaternion();
    q.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);

    // We use a sphere for bottom so it doesn't get stuck on edges easily
    const physicsShape = new CANNON.Sphere(this.playerRadius);

    this.body = new CANNON.Body({
      mass: this.mass,
      shape: physicsShape,
      position: new CANNON.Vec3(0, 5, 10), // Start a bit high
      material: this.engine.defaultMaterial,
      fixedRotation: true // Prevent falling over
    });

    this.body.linearDamping = 0.05;
    this.engine.world.addBody(this.body);

    // Movement state
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.canJump = false;

    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();

    this.bindEvents();
  }

  bindEvents() {
    const onKeyDown = (event) => {
      switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
          this.moveForward = true;
          break;
        case 'ArrowLeft':
        case 'KeyA':
          this.moveLeft = true;
          break;
        case 'ArrowDown':
        case 'KeyS':
          this.moveBackward = true;
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.moveRight = true;
          break;
        case 'Space':
          if (this.canJump === true) {
             this.body.velocity.y = 8;
             this.canJump = false;
          }
          break;
      }
    };

    const onKeyUp = (event) => {
      switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
          this.moveForward = false;
          break;
        case 'ArrowLeft':
        case 'KeyA':
          this.moveLeft = false;
          break;
        case 'ArrowDown':
        case 'KeyS':
          this.moveBackward = false;
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.moveRight = false;
          break;
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // Simple raycast down to check if grounded
    this.engine.world.addEventListener('postStep', () => {
        // Assume grounded if vertical velocity is very small and we are touching something
        // A proper implementation uses contact equations, but this works for prototype
        const contacts = this.engine.world.contacts;
        let isGrounded = false;
        for (let i = 0; i < contacts.length; i++) {
            if (contacts[i].bi.id === this.body.id || contacts[i].bj.id === this.body.id) {
                // If the contact normal is mostly pointing up
                if(contacts[i].ni.y > 0.5 || contacts[i].ni.y < -0.5) {
                   isGrounded = true;
                   break;
                }
            }
        }
        if(isGrounded) this.canJump = true;
    });
  }

  update(dt) {
    if (this.controls.isLocked) {
      const speed = 8; // m/s — direct velocity control for responsive movement

      this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
      this.direction.x = Number(this.moveRight) - Number(this.moveLeft);

      if (this.direction.x !== 0 || this.direction.z !== 0) {
        this.direction.normalize();
      }

      const camForward = new THREE.Vector3();
      this.engine.camera.getWorldDirection(camForward);
      camForward.y = 0;
      camForward.normalize();

      const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.engine.camera.quaternion);
      camRight.y = 0;
      camRight.normalize();

      // Set XZ velocity directly — Y is left alone so gravity and jumping still work
      this.body.velocity.x = (camForward.x * this.direction.z + camRight.x * this.direction.x) * speed;
      this.body.velocity.z = (camForward.z * this.direction.z + camRight.z * this.direction.x) * speed;
    }

    // Sync camera to physics body
    this.engine.camera.position.copy(this.body.position);
    this.engine.camera.position.y += this.playerHeight / 2;
  }
}
