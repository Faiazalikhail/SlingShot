import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class TrajectoryPredictor {
  constructor(engine) {
    this.engine = engine;
    this.numPoints = 30; // Number of points in the trajectory line
    this.timeStep = 1 / 60; // Step size for prediction calculation

    // Create dotted line material
    const lineMat = new THREE.LineDashedMaterial({
      color: 0xffffff,
      linewidth: 2,
      dashSize: 0.2,
      gapSize: 0.2,
      opacity: 0.5,
      transparent: true
    });

    this.geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.numPoints * 3);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.line = new THREE.Line(this.geometry, lineMat);
    this.line.computeLineDistances(); // Required for dashed material

    // Hidden by default
    this.line.visible = false;
    this.engine.scene.add(this.line);
  }

  update(startPosition, initialVelocity, currentMode) {
    // Fade out / Hide for Long Range mode to increase difficulty
    if (currentMode === 'LONG') {
        this.line.visible = false;
        return;
    }

    if (initialVelocity.length() < 0.1) {
        this.line.visible = false;
        return;
    }

    this.line.visible = true;

    // Simulate projectile physics manually to draw the line
    // We ignore air resistance and collisions for the simple predictor
    const positions = this.geometry.attributes.position.array;

    const gravity = this.engine.world.gravity;
    const mass = 1; // Projectile mass

    // Clone vectors to avoid mutating original
    const pos = new CANNON.Vec3().copy(startPosition);
    // Since impulse is applied: V = P / m
    const vel = new CANNON.Vec3(initialVelocity.x, initialVelocity.y, initialVelocity.z).scale(1/mass);

    for (let i = 0; i < this.numPoints; i++) {
        // v = u + at
        // p = p + vt
        vel.x += gravity.x * this.timeStep;
        vel.y += gravity.y * this.timeStep;
        vel.z += gravity.z * this.timeStep;

        pos.x += vel.x * this.timeStep;
        pos.y += vel.y * this.timeStep;
        pos.z += vel.z * this.timeStep;

        positions[i * 3] = pos.x;
        positions[i * 3 + 1] = pos.y;
        positions[i * 3 + 2] = pos.z;

        // Stop drawing if it hits the ground plane approx
        if (pos.y < 0) {
            // Fill remainder with last position to prevent tail artifacts
            for (let j = i + 1; j < this.numPoints; j++) {
                positions[j * 3] = pos.x;
                positions[j * 3 + 1] = pos.y;
                positions[j * 3 + 2] = pos.z;
            }
            break;
        }
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.line.computeLineDistances();
  }

  hide() {
      this.line.visible = false;
  }
}
