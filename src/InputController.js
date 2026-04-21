import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import gsap from 'gsap';
import { TrajectoryPredictor } from './TrajectoryPredictor.js';

// ─── Ammo definitions ────────────────────────────────────────────────────────
const AMMO_TYPES = [
  {
    id: 0, name: 'Stone',    key: '3',
    desc: 'Balanced shot — reliable arc',
    color: 0x444444, radius: 0.10, mass: 1,
    maxForce: 80, chargeRate: 0.7, explosive: false, burst: false
  },
  {
    id: 1, name: 'Boulder',  key: '4',
    desc: 'Heavy hit — slow charge, massive knockback',
    color: 0x222222, radius: 0.22, mass: 6,
    maxForce: 160, chargeRate: 0.35, explosive: false, burst: false
  },
  {
    id: 2, name: 'Explosive', key: '5',
    desc: 'AOE blast — hits everything within 5 m',
    color: 0xff4400, radius: 0.10, mass: 0.6,
    maxForce: 80, chargeRate: 0.8, explosive: true, burst: false
  },
  {
    id: 3, name: 'Burst',    key: '6',
    desc: 'Scatter — fires 5 spread projectiles',
    color: 0x44aaff, radius: 0.08, mass: 0.5,
    maxForce: 75, chargeRate: 0.9, explosive: false, burst: true
  },
];

export class InputController {
  constructor(engine, slingshot, playerController) {
    this.engine           = engine;
    this.slingshot        = slingshot;
    this.playerController = playerController;

    this.isCharging   = false;
    this.chargeAmount = 0;

    this.ammoIndex = 0;
    this._applyAmmo(0);

    this.forceMeterFill = document.getElementById('force-meter-fill');
    this.modeIndicator  = document.getElementById('mode-indicator');

    this.trajectory = new TrajectoryPredictor(this.engine);

    this.bindEvents();
    this._refreshAmmoUI();
  }

  _applyAmmo(index) {
    this.ammoIndex   = index;
    const t          = AMMO_TYPES[index];
    this.maxForce    = t.maxForce;
    this.chargeRate  = t.chargeRate;
    this.slingshot.setProjectileSpec({ radius: t.radius, mass: t.mass, color: t.color });
  }

  bindEvents() {
    window.addEventListener('mousedown', () => {
      if (this.playerController.controls.isLocked) {
        this.isCharging   = true;
        this.chargeAmount = 0;
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isCharging) {
        this.fireWeapon();
        this.isCharging = false;
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Digit1') {
        this.slingshot.switchWeapon(1);
        document.getElementById('weapon-info').innerText = 'Weapon: Precision Sling';
      } else if (e.code === 'Digit2') {
        this.slingshot.switchWeapon(2);
        document.getElementById('weapon-info').innerText = 'Weapon: Staff Sling';
      } else if (e.code === 'Digit3') { this._selectAmmo(0); }
        else if (e.code === 'Digit4') { this._selectAmmo(1); }
        else if (e.code === 'Digit5') { this._selectAmmo(2); }
        else if (e.code === 'Digit6') { this._selectAmmo(3); }
    });
  }

  _selectAmmo(index) {
    if (this.isCharging) return; // don't swap mid-charge
    this._applyAmmo(index);
    this._refreshAmmoUI();
  }

  _refreshAmmoUI() {
    AMMO_TYPES.forEach((t, i) => {
      const el = document.getElementById(`ammo-slot-${i}`);
      if (!el) return;
      el.classList.toggle('ammo-active', i === this.ammoIndex);
    });
    const t = AMMO_TYPES[this.ammoIndex];
    const desc = document.getElementById('ammo-desc');
    if (desc) desc.innerText = t.desc;
  }

  update(dt) {
    if (this.isCharging && this.slingshot.projectileReady) {
      this.chargeAmount = Math.min(this.chargeAmount + this.chargeRate * dt, 1.0);

      if (this.slingshot.activeWeapon === 1) {
        this.slingshot.updateSling(this.chargeAmount);

        const targetFOV = 75 - 18 * this.chargeAmount;
        this.engine.camera.fov = THREE.MathUtils.lerp(this.engine.camera.fov, targetFOV, 0.1);
        this.engine.camera.updateProjectionMatrix();

        if (this.chargeAmount > 0.8) {
          this.modeIndicator.style.opacity = 1;
          this.slingshot.slingLine.material.color.setHex(0xff0000);
        } else {
          this.modeIndicator.style.opacity = 0;
          this.slingshot.slingLine.material.color.setHex(0x884444);
        }

        // Build trajectory from crosshair (camera eye) — matches actual fire position
        const forceMag = this.maxForce * this.chargeAmount;
        const forceDir = this._aimDir();
        const finalForce = forceDir.clone().multiplyScalar(forceMag);
        const startPos = this._fireStartPos();
        this.trajectory.update(startPos, finalForce, 'NORMAL');

      } else {
        this.slingshot.updateStaff(this.chargeAmount, dt);
        this.trajectory.hide();
      }

      this.forceMeterFill.style.width      = `${this.chargeAmount * 100}%`;
      this.forceMeterFill.style.background = this.chargeAmount > 0.8 ? '#ff4400' : '#ffffff';

    } else {
      if (this.slingshot.activeWeapon === 1) {
        this.engine.camera.fov = THREE.MathUtils.lerp(this.engine.camera.fov, 75, 0.1);
        this.engine.camera.updateProjectionMatrix();
      } else {
        this.slingshot.updateStaff(0, dt);
      }
      this.trajectory.hide();
      this.forceMeterFill.style.width = '0%';
      this.modeIndicator.style.opacity = 0;
      this.slingshot.slingLine.material.color.setHex(0x884444);
    }
  }

  _aimDir() {
    const d = new THREE.Vector3();
    this.engine.camera.getWorldDirection(d);
    d.normalize();
    d.y += 0.06; // small, consistent arc bias
    return d;
  }

  _fireStartPos() {
    const d = new THREE.Vector3();
    this.engine.camera.getWorldDirection(d);
    return this.engine.camera.position.clone().addScaledVector(d, 0.9);
  }

  fireWeapon() {
    if (!this.slingshot.projectileReady || this.chargeAmount < 0.1) {
      this.chargeAmount = 0;
      if (this.slingshot.activeWeapon === 1) this.slingshot.updateSling(0);
      return;
    }

    const t        = AMMO_TYPES[this.ammoIndex];
    const forceMag = this.maxForce * this.chargeAmount;
    const finalForce = this._aimDir().multiplyScalar(forceMag);

    if (t.burst) {
      // Primary shot through normal slingshot channel
      this.slingshot.fire(finalForce);
      // 4 spread companions
      const spreads = [-0.18, -0.09, 0.09, 0.18];
      for (const offset of spreads) {
        const sf = new THREE.Vector3(
          finalForce.x + finalForce.z * offset,
          finalForce.y + Math.abs(finalForce.length()) * 0.04,
          finalForce.z - finalForce.x * offset
        );
        this._spawnLooseShot(sf, t);
      }
    } else {
      this.slingshot.fire(finalForce);
      if (t.explosive && this.slingshot.lastFiredBody) {
        this._armExplosive(this.slingshot.lastFiredBody);
      }
    }

    this.triggerRecoil(t.id === 1 ? 0.4 : 0.2);
    this.chargeAmount = 0;
  }

  // ── Projectile helpers ────────────────────────────────────────────────────

  _spawnLooseShot(forceVec, spec) {
    const r   = spec.radius * 0.85;
    const geo = new THREE.SphereGeometry(r, 10, 10);
    const mat = new THREE.MeshStandardMaterial({
      color: spec.color,
      emissive: new THREE.Color(spec.color).multiplyScalar(0.2),
      emissiveIntensity: 0.5, roughness: 0.7
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;

    const body = new CANNON.Body({
      mass: spec.mass,
      shape: new CANNON.Sphere(r),
      material: this.engine.defaultMaterial
    });
    const fp = this._fireStartPos();
    body.position.set(fp.x, fp.y, fp.z);
    body.applyImpulse(new CANNON.Vec3(forceVec.x, forceVec.y, forceVec.z), body.position);

    this.engine.scene.add(mesh);
    this.engine.world.addBody(body);
    this.engine.physicsObjects.push({ mesh, body });

    setTimeout(() => {
      this.engine.scene.remove(mesh);
      this.engine.world.removeBody(body);
      this.engine.physicsObjects = this.engine.physicsObjects.filter(o => o.body !== body);
    }, 5000);
  }

  _armExplosive(body) {
    let triggered = false;
    const onHit = () => {
      if (triggered) return;
      triggered = true;
      body.removeEventListener('collide', onHit);
      this._explode(body.position, 5.5, 500);
    };
    body.addEventListener('collide', onHit);
  }

  _explode(pos, radius, force) {
    for (const obj of this.engine.physicsObjects) {
      if (!obj.body || obj.body.mass === 0) continue;
      const dx = obj.body.position.x - pos.x;
      const dy = obj.body.position.y - pos.y;
      const dz = obj.body.position.z - pos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < radius && dist > 0.05) {
        const mag = force * (1 - dist / radius);
        obj.body.applyImpulse(
          new CANNON.Vec3((dx / dist) * mag, (dy / dist) * mag + mag * 0.4, (dz / dist) * mag),
          obj.body.position
        );
      }
    }
    this.triggerRecoil(1.2);

    // Orange flash overlay
    const flash = document.createElement('div');
    flash.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,120,0,0.45);pointer-events:none;z-index:100;transition:opacity 0.35s ease';
    document.body.appendChild(flash);
    requestAnimationFrame(() => { flash.style.opacity = '0'; });
    setTimeout(() => flash.remove(), 400);
  }

  triggerRecoil(intensity) {
    const orig = this.engine.camera.rotation.x;
    gsap.to(this.engine.camera.rotation, {
      x: orig + intensity, duration: 0.05,
      yoyo: true, repeat: 1
    });
  }
}
