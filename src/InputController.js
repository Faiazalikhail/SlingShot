import * as THREE from 'three';
import gsap from 'gsap';
import { TrajectoryPredictor } from './TrajectoryPredictor.js';

export class InputController {
  constructor(engine, slingshot) {
    this.engine = engine;
    this.slingshot = slingshot;

    this.isDragging = false;
    this.dragStart = new THREE.Vector2();
    this.currentDrag = new THREE.Vector2();

    // Physics constants
    this.kNormal = 40;   // Spring constant for normal mode
    this.kLong = 80;     // Spring constant for long range mode
    this.thresholdT = 2.0; // Pull distance to trigger Long Range
    this.maxPull = 4.0;    // Absolute max pull distance

    this.currentMode = 'NORMAL';
    this.pullVector3D = new THREE.Vector3();

    // DOM Elements for HUD
    this.forceMeterFill = document.getElementById('force-meter-fill');
    this.modeIndicator = document.getElementById('mode-indicator');

    // Trajectory Predictor
    this.trajectory = new TrajectoryPredictor(this.engine);

    // Create an invisible interaction plane in front of the camera
    this.raycaster = new THREE.Raycaster();
    this.interactionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -6); // z=6 matches slingshot

    this.bindEvents();
  }

  bindEvents() {
    window.addEventListener('mousedown', this.onPointerDown.bind(this));
    window.addEventListener('mousemove', this.onPointerMove.bind(this));
    window.addEventListener('mouseup', this.onPointerUp.bind(this));

    window.addEventListener('touchstart', this.onTouchDown.bind(this), {passive: false});
    window.addEventListener('touchmove', this.onTouchMove.bind(this), {passive: false});
    window.addEventListener('touchend', this.onTouchUp.bind(this), {passive: false});
  }

  getPointerIntersection(clientX, clientY) {
    const mouse = new THREE.Vector2();
    mouse.x = (clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(mouse, this.engine.camera);
    const intersectPoint = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.interactionPlane, intersectPoint);
    return intersectPoint;
  }

  onPointerDown(e) {
    if (!this.slingshot.projectileReady) return;

    const pt = this.getPointerIntersection(e.clientX, e.clientY);
    if(pt) {
        this.isDragging = true;
        // Projectile rest pos in world space is approx (0, 2.8, 6)
        // We use the intersection point as the start
        this.dragStartPoint = pt.clone();
    }
  }

  onPointerMove(e) {
    if (!this.isDragging || !this.slingshot.projectileReady) return;

    const pt = this.getPointerIntersection(e.clientX, e.clientY);
    if(pt) {
        // Calculate raw pull vector (opposite to drag direction to represent pulling back)
        // Actually, if we drag down-left, we are pulling the band down-left.
        // The pull vector relative to center is pt - center.
        // Center is (0, 2.8, 6).
        const center = new THREE.Vector3(0, 2.8, 6);
        let pullVec = pt.clone().sub(center);

        // Lock Z so we only pull in X/Y plane relative to camera
        pullVec.z = 0;

        // Cap pull distance
        if (pullVec.length() > this.maxPull) {
            pullVec.normalize().multiplyScalar(this.maxPull);
        }

        this.pullVector3D.copy(pullVec);
        this.slingshot.updateSling(this.pullVector3D);

        this.updateHUD(pullVec.length());
        this.checkModeSwitch(pullVec.length());
    }
  }

  onPointerUp(e) {
    if (!this.isDragging) return;
    this.isDragging = false;

    const distance = this.pullVector3D.length();
    if (distance > 0.5 && this.slingshot.projectileReady) {
        // Calculate Force F = k * x
        const k = this.currentMode === 'NORMAL' ? this.kNormal : this.kLong;

        // Force direction is opposite to pull vector
        const forceDir = this.pullVector3D.clone().normalize().negate();

        // Add a slight upward angle baseline for better arcs
        forceDir.y += 0.2;
        forceDir.z = -1; // Shoot into the screen
        forceDir.normalize();

        const forceMag = k * distance;
        const finalForce = forceDir.multiplyScalar(forceMag);

        this.slingshot.fire(finalForce);

        // Visual recoil/shake
        this.triggerRecoil();
    } else {
        // Cancel shot
        this.slingshot.updateSling(new THREE.Vector3(0,0,0));
    }

    // Reset HUD and Mode
    this.pullVector3D.set(0,0,0);
    this.updateHUD(0);
    if(this.currentMode !== 'NORMAL') this.switchMode('NORMAL');
  }

  onTouchDown(e) {
    e.preventDefault();
    this.onPointerDown(e.touches[0]);
  }
  onTouchMove(e) {
    e.preventDefault();
    this.onPointerMove(e.touches[0]);
  }
  onTouchUp(e) {
    e.preventDefault();
    this.onPointerUp(e);
  }

  checkModeSwitch(distance) {
    if (distance > this.thresholdT && this.currentMode === 'NORMAL') {
        this.switchMode('LONG');
    } else if (distance <= this.thresholdT && this.currentMode === 'LONG') {
        this.switchMode('NORMAL');
    }
  }

  switchMode(mode) {
    this.currentMode = mode;

    if (mode === 'LONG') {
        // Trigger Overdraw visual feedback
        gsap.to(this.engine.camera, { fov: 75, duration: 0.3, onUpdate: () => this.engine.camera.updateProjectionMatrix() });
        gsap.to(this.modeIndicator, { opacity: 1, duration: 0.2, yoyo: true, repeat: -1 });
        this.modeIndicator.style.color = '#ff4444';

        // Change sling color
        this.slingshot.slingLine.material.color.setHex(0xff0000);
    } else {
        // Revert to Normal
        gsap.to(this.engine.camera, { fov: 60, duration: 0.3, onUpdate: () => this.engine.camera.updateProjectionMatrix() });
        gsap.killTweensOf(this.modeIndicator);
        gsap.to(this.modeIndicator, { opacity: 0, duration: 0.2 });

        this.slingshot.slingLine.material.color.setHex(0x884444);
    }
  }

  updateHUD(distance) {
    const percent = Math.min((distance / this.maxPull) * 100, 100);
    this.forceMeterFill.style.width = `${percent}%`;

    if (this.currentMode === 'LONG') {
        this.forceMeterFill.style.background = 'red';
    } else {
        this.forceMeterFill.style.background = 'white';
    }

    // Trajectory Prediction
    if (this.slingshot.currentProjectile && this.isDragging && distance > 0.5) {
        const k = this.currentMode === 'NORMAL' ? this.kNormal : this.kLong;
        const forceDir = this.pullVector3D.clone().normalize().negate();
        forceDir.y += 0.2;
        forceDir.z = -1;
        forceDir.normalize();

        const forceMag = k * distance;
        const finalForce = forceDir.multiplyScalar(forceMag);

        const startPos = this.slingshot.currentProjectile.body.position;
        this.trajectory.update(startPos, finalForce, this.currentMode);
    } else {
        this.trajectory.hide();
    }
  }

  triggerRecoil() {
    const intensity = this.currentMode === 'LONG' ? 0.5 : 0.1;

    // Simple screen shake using GSAP on camera position
    const startY = 2;
    gsap.to(this.engine.camera.position, {
        y: startY + intensity,
        duration: 0.05,
        yoyo: true,
        repeat: 3,
        onComplete: () => {
            gsap.to(this.engine.camera.position, { y: startY, duration: 0.1 });
        }
    });
  }
}
