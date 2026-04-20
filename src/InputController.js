import * as THREE from 'three';
import gsap from 'gsap';
import { TrajectoryPredictor } from './TrajectoryPredictor.js';

export class InputController {
  constructor(engine, slingshot, playerController) {
    this.engine = engine;
    this.slingshot = slingshot;
    this.playerController = playerController;

    this.isCharging = false;
    this.chargeAmount = 0; // 0 to 1
    this.chargeRate = 0.5; // per second

    // Physics constants
    this.maxForce = 120; // Max force applied to projectile

    // DOM Elements for HUD
    this.forceMeterFill = document.getElementById('force-meter-fill');
    this.modeIndicator = document.getElementById('mode-indicator');

    // Trajectory Predictor
    this.trajectory = new TrajectoryPredictor(this.engine);

    this.bindEvents();
  }

  bindEvents() {
    window.addEventListener('mousedown', (e) => {
        if(this.playerController.controls.isLocked) {
            this.isCharging = true;
            this.chargeAmount = 0;
        }
    });

    window.addEventListener('mouseup', (e) => {
        if(this.isCharging) {
            this.fireWeapon();
            this.isCharging = false;
        }
    });

    window.addEventListener('keydown', (e) => {
        if(e.code === 'Digit1') {
            this.slingshot.switchWeapon(1);
            document.getElementById('weapon-info').innerText = "Weapon: Precision Sling";
        } else if (e.code === 'Digit2') {
            this.slingshot.switchWeapon(2);
            document.getElementById('weapon-info').innerText = "Weapon: Staff Sling";
        }
    });
  }

  update(dt) {
    if (this.isCharging && this.slingshot.projectileReady) {
        this.chargeAmount = Math.min(this.chargeAmount + this.chargeRate * dt, 1.0);

        // Update visuals based on weapon
        if (this.slingshot.activeWeapon === 1) {
            this.slingshot.updateSling(this.chargeAmount);

            // Zoom FOV
            const targetFOV = 75 - (20 * this.chargeAmount);
            this.engine.camera.fov = THREE.MathUtils.lerp(this.engine.camera.fov, targetFOV, 0.1);
            this.engine.camera.updateProjectionMatrix();

            // Screen shake at high charge
            if(this.chargeAmount > 0.8) {
                this.triggerRecoil(0.02);
                this.modeIndicator.style.opacity = 1;
                this.slingshot.slingLine.material.color.setHex(0xff0000);
            } else {
                this.modeIndicator.style.opacity = 0;
                this.slingshot.slingLine.material.color.setHex(0x884444);
            }

            // Calculate Force
            const forceMag = this.maxForce * this.chargeAmount;
            const forceDir = new THREE.Vector3();
            this.engine.camera.getWorldDirection(forceDir);
            forceDir.y += 0.1; // Baseline arc
            forceDir.normalize();

            const finalForce = forceDir.clone().multiplyScalar(forceMag);

            // Show trajectory
            const startPos = this.slingshot.currentProjectile.body.position;
            const mode = this.chargeAmount > 0.8 ? 'LONG' : 'NORMAL';
            this.trajectory.update(startPos, finalForce, mode);

        } else if (this.slingshot.activeWeapon === 2) {
            // Staff Sling Whirling
            this.slingshot.updateStaff(this.chargeAmount, dt);

            // Hide trajectory
            this.trajectory.hide();
        }

        // Update HUD
        this.forceMeterFill.style.width = `${this.chargeAmount * 100}%`;
        if (this.chargeAmount > 0.8) {
            this.forceMeterFill.style.background = 'red';
        } else {
            this.forceMeterFill.style.background = 'white';
        }

    } else {
        // Not charging
        if (this.slingshot.activeWeapon === 1) {
            this.engine.camera.fov = THREE.MathUtils.lerp(this.engine.camera.fov, 75, 0.1);
            this.engine.camera.updateProjectionMatrix();
        } else {
            this.slingshot.updateStaff(0, dt);
        }
        this.trajectory.hide();
        this.forceMeterFill.style.width = `0%`;
        this.modeIndicator.style.opacity = 0;
        this.slingshot.slingLine.material.color.setHex(0x884444);
    }
  }

  fireWeapon() {
      if (!this.slingshot.projectileReady || this.chargeAmount < 0.1) {
          this.chargeAmount = 0;
          if(this.slingshot.activeWeapon === 1) this.slingshot.updateSling(0);
          return;
      }

      // Calculate force based on camera look direction
      const forceMag = this.maxForce * this.chargeAmount;
      const forceDir = new THREE.Vector3();
      this.engine.camera.getWorldDirection(forceDir);

      // Add slight upward angle
      forceDir.y += 0.1;
      forceDir.normalize();

      const finalForce = forceDir.multiplyScalar(forceMag);

      this.slingshot.fire(finalForce);

      // Recoil
      this.triggerRecoil(this.slingshot.activeWeapon === 1 ? 0.2 : 0.5);

      this.chargeAmount = 0;
  }

  triggerRecoil(intensity) {
    // Simple screen shake using GSAP on camera rotation
    const originalX = this.engine.camera.rotation.x;
    gsap.to(this.engine.camera.rotation, {
        x: originalX + intensity,
        duration: 0.05,
        yoyo: true,
        repeat: 1
    });
  }
}
