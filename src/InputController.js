import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import gsap from 'gsap';
import { TrajectoryPredictor } from './TrajectoryPredictor.js';

// ─── Ammo catalogue ───────────────────────────────────────────────────────────
// count: Infinity = unlimited (stone)
const AMMO = [
  {
    id: 0, key: '3', name: 'Stone',
    desc: 'Unlimited · Reliable arc',
    color: 0x666666, dotColor: '#888',
    radius: 0.10, mass: 1.0, maxForce: 80, chargeRate: 0.70,
    staminaCost: 12, count: Infinity,
    burst: false, explosive: false, acid: false
  },
  {
    id: 1, key: '4', name: 'Burst',
    desc: '15 rounds · Fan of 5 pellets',
    color: 0x44aaff, dotColor: '#4af',
    radius: 0.08, mass: 0.5, maxForce: 75, chargeRate: 0.90,
    staminaCost: 25, count: 15,
    burst: true, explosive: false, acid: false
  },
  {
    id: 2, key: '5', name: 'Explosive',
    desc: '8 rounds · AOE blast on impact',
    color: 0xff4400, dotColor: '#f40',
    radius: 0.12, mass: 0.7, maxForce: 80, chargeRate: 0.80,
    staminaCost: 30, count: 8,
    burst: false, explosive: true, acid: false
  },
  {
    id: 3, key: '6', name: 'Acid Pot',
    desc: '6 pots · Melts targets over 3 s',
    color: 0x44ff66, dotColor: '#4f6',
    radius: 0.13, mass: 0.9, maxForce: 70, chargeRate: 0.70,
    staminaCost: 20, count: 6,
    burst: false, explosive: false, acid: true
  },
];

export class InputController {
  constructor(engine, slingshot, playerController) {
    this.engine           = engine;
    this.slingshot        = slingshot;
    this.playerController = playerController;

    // Clone counts so the original definitions stay pristine
    this.inventory = AMMO.map(a => ({ ...a }));

    // Stamina
    this.stamina    = 100;
    this.maxStamina = 100;
    this.staminaRegen = 15; // per second

    // Shooting state
    this.ammoIndex    = 0;
    this.isCharging   = false;
    this.isAiming     = false;  // RMB held
    this.chargeAmount = 0;

    // Apply initial ammo spec to slingshot
    this._applyAmmo(0);

    // DOM refs
    this.forceMeterFill = document.getElementById('force-meter-fill');
    this.modeIndicator  = document.getElementById('mode-indicator');
    this.staminaFill    = document.getElementById('stamina-fill');
    this.hitFeedback    = document.getElementById('hit-feedback');

    this.trajectory = new TrajectoryPredictor(this.engine);

    // Prevent right-click context menu on canvas
    document.addEventListener('contextmenu', e => e.preventDefault());

    this.bindEvents();
    this._refreshUI();
  }

  // ─── Ammo / inventory ──────────────────────────────────────────────────────

  _applyAmmo(index) {
    this.ammoIndex  = index;
    const a         = this.inventory[index];
    this.maxForce   = a.maxForce;
    this.chargeRate = a.chargeRate;
    this.slingshot.setProjectileSpec({ radius: a.radius, mass: a.mass, color: a.color });
  }

  _selectAmmo(index) {
    if (this.isCharging) return;
    const a = this.inventory[index];
    if (a.count <= 0) {
      this._flash('#ff0000', 0.25, 300);
      this._showFeedback('OUT OF AMMO', '#ff4444');
      return;
    }
    this._applyAmmo(index);
    this._refreshUI();
  }

  _consumeAmmo() {
    const a = this.inventory[this.ammoIndex];
    if (a.count !== Infinity) {
      a.count = Math.max(0, a.count - 1);
      if (a.count === 0) {
        // Auto-switch to stone
        setTimeout(() => {
          this._applyAmmo(0);
          this._refreshUI();
        }, 300);
      }
    }
    this._refreshUI();
  }

  // ─── Stamina ───────────────────────────────────────────────────────────────

  _canFire() {
    const cost = this.inventory[this.ammoIndex].staminaCost;
    if (this.stamina < cost) {
      this._showFeedback('LOW STAMINA', '#ffaa00');
      return false;
    }
    return true;
  }

  _drainStamina() {
    const cost = this.inventory[this.ammoIndex].staminaCost;
    this.stamina = Math.max(0, this.stamina - cost);
    this._updateStaminaBar();
  }

  _regenStamina(dt) {
    if (this.stamina < this.maxStamina) {
      this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRegen * dt);
      this._updateStaminaBar();
    }
  }

  _updateStaminaBar() {
    if (!this.staminaFill) return;
    const pct = this.stamina / this.maxStamina;
    this.staminaFill.style.width = `${pct * 100}%`;
    this.staminaFill.style.background =
      pct > 0.5 ? '#44dd66' : pct > 0.25 ? '#ffbb00' : '#ff3300';
  }

  // ─── Events ────────────────────────────────────────────────────────────────

  bindEvents() {
    window.addEventListener('mousedown', (e) => {
      if (!this.playerController.controls.isLocked) return;
      if (e.button === 2) {           // RMB → aim
        this.isAiming = true;
      }
      if (e.button === 0) {           // LMB → charge
        this.isCharging   = true;
        this.chargeAmount = 0;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) {
        this.isAiming = false;
      }
      if (e.button === 0 && this.isCharging) {
        this.isCharging = false;
        this.fireWeapon();
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

  // ─── Per-frame update ──────────────────────────────────────────────────────

  update(dt) {
    // Stamina regenerates when not firing
    if (!this.isCharging) this._regenStamina(dt);

    const charging = this.isCharging && this.slingshot.projectileReady;

    // ── ADS zoom (RMB) ──────────────────────────────────────────────────────
    const targetFOV = this.isAiming ? 52 : 75;
    this.engine.camera.fov = THREE.MathUtils.lerp(this.engine.camera.fov, targetFOV, 0.12);
    this.engine.camera.updateProjectionMatrix();

    // ── Charging ────────────────────────────────────────────────────────────
    if (charging) {
      this.chargeAmount = Math.min(this.chargeAmount + this.chargeRate * dt, 1.0);

      if (this.slingshot.activeWeapon === 1) {
        this.slingshot.updateSling(this.chargeAmount);
        if (this.chargeAmount > 0.85) {
          this.modeIndicator.style.opacity = 1;
          this.slingshot.slingLine.material.color.setHex(0xff2200);
        } else {
          this.modeIndicator.style.opacity = 0;
          this.slingshot.slingLine.material.color.setHex(0x884444);
        }
      } else {
        this.slingshot.updateStaff(this.chargeAmount, dt);
      }

      // Show trajectory from the ball's sling position
      const startPos  = this.slingshot.getProjectileWorldPos();
      const aimForce  = this._buildForceVec(this.chargeAmount, startPos);
      this.trajectory.update(startPos, aimForce, 'NORMAL');

      this.forceMeterFill.style.width      = `${this.chargeAmount * 100}%`;
      this.forceMeterFill.style.background = this.chargeAmount > 0.85 ? '#ff4400' : '#ffffff';
    } else {
      // Idle / releasing
      if (this.slingshot.activeWeapon === 1) {
        this.slingshot.updateSling(0);
      } else {
        this.slingshot.updateStaff(0, dt);
      }
      this.trajectory.hide();
      this.forceMeterFill.style.width     = '0%';
      this.modeIndicator.style.opacity    = 0;
      this.slingshot.slingLine.material.color.setHex(0x884444);
    }
  }

  // ─── Firing ────────────────────────────────────────────────────────────────

  fireWeapon() {
    if (!this.slingshot.projectileReady || this.chargeAmount < 0.08) {
      this.chargeAmount = 0;
      return;
    }
    if (!this._canFire()) {
      this.chargeAmount = 0;
      return;
    }

    const startPos   = this.slingshot.getProjectileWorldPos();
    const finalForce = this._buildForceVec(this.chargeAmount, startPos);
    const ammo       = this.inventory[this.ammoIndex];

    if (ammo.burst) {
      // Primary shot through normal slingshot channel
      this.slingshot.fire(finalForce);
      this._armHitDetection(this.slingshot.lastFiredBody, ammo);

      // 4 companion pellets fanned around the primary
      const spreads = [-0.18, -0.09, 0.09, 0.18];
      for (const offset of spreads) {
        const sf = new THREE.Vector3(
          finalForce.x + finalForce.z * offset,
          finalForce.y + finalForce.length() * 0.03,
          finalForce.z - finalForce.x * offset
        );
        this._spawnLooseShot(sf, ammo, startPos);
      }
    } else {
      this.slingshot.fire(finalForce);
      this._armHitDetection(this.slingshot.lastFiredBody, ammo);
    }

    this._drainStamina();
    this._consumeAmmo();
    this._triggerRecoil(ammo.id === 1 ? 0.15 : 0.25);
    this.chargeAmount = 0;
  }

  // ─── Force vector ──────────────────────────────────────────────────────────

  /**
   * Compute fire force from the sling release position toward the crosshair.
   * Direction = from sling pos toward a far point along camera forward.
   */
  _buildForceVec(charge, slingSlingPos) {
    const camDir = new THREE.Vector3();
    this.engine.camera.getWorldDirection(camDir);

    // Aim point: 120 m along camera direction from camera eye
    const aimPoint = this.engine.camera.position.clone().addScaledVector(camDir, 120);

    // Direction from sling to aim point
    const dir = aimPoint.clone().sub(slingSlingPos).normalize();
    dir.y += 0.05; // tiny consistent upward arc

    return dir.multiplyScalar(this.maxForce * charge);
  }

  // ─── Hit detection & effects ───────────────────────────────────────────────

  _armHitDetection(body, ammo) {
    if (!body) return;
    let fired = false;
    const onHit = (event) => {
      if (fired) return;
      fired = true;
      body.removeEventListener('collide', onHit);

      const otherBody   = event.body;
      const contact     = event.contact;

      // Determine contact vector relative to the other body
      const rOther = contact.bi === body ? contact.rj : contact.ri;

      if (ammo.explosive) this._explode(body.position, 6.0, 550);
      if (ammo.acid)      this._meltTarget(otherBody);

      // Headshot: contact point well above the hit body's centre
      if (otherBody.mass > 0 && rOther && rOther.y > 0.28) {
        this._onHeadshot(otherBody);
      }
    };
    body.addEventListener('collide', onHit);
  }

  // ── Explosion ──────────────────────────────────────────────────────────────

  _explode(pos, radius, force) {
    for (const obj of this.engine.physicsObjects) {
      if (!obj.body || obj.body.mass === 0) continue;
      const dx   = obj.body.position.x - pos.x;
      const dy   = obj.body.position.y - pos.y;
      const dz   = obj.body.position.z - pos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > 0.1 && dist < radius) {
        const mag = force * (1 - dist / radius);
        obj.body.applyImpulse(
          new CANNON.Vec3((dx / dist) * mag, (dy / dist) * mag + mag * 0.35, (dz / dist) * mag),
          obj.body.position
        );
      }
    }

    // Visual: expanding ring + flash
    this._flash('rgba(255,140,0,0.5)', 0.4, 350);
    this._showFeedback('BOOM!', '#ff8800');

    // Expanding sphere marker
    const geo  = new THREE.SphereGeometry(0.5, 12, 12);
    const mat  = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.6, wireframe: true });
    const ring = new THREE.Mesh(geo, mat);
    ring.position.set(pos.x, pos.y, pos.z);
    this.engine.scene.add(ring);
    gsap.to(ring.scale, { x: radius * 2, y: radius * 2, z: radius * 2, duration: 0.4, ease: 'power2.out' });
    gsap.to(mat,        { opacity: 0, duration: 0.4, onComplete: () => this.engine.scene.remove(ring) });

    this._triggerRecoil(1.0);
  }

  // ── Acid melt ──────────────────────────────────────────────────────────────

  _meltTarget(hitBody) {
    if (!hitBody || hitBody.mass === 0) return;
    const obj = this.engine.physicsObjects.find(o => o.body === hitBody);
    if (!obj || !obj.mesh || obj._melting) return;
    obj._melting = true;

    // Freeze physics so the melting target stays in place
    hitBody.type = CANNON.Body.STATIC;
    hitBody.mass = 0;
    hitBody.updateMassProperties();

    // Clone material so only this instance changes
    obj.mesh.material = obj.mesh.material.clone();
    obj.mesh.material.transparent = true;
    obj.mesh.material.emissive     = new THREE.Color(0x44ff44);
    obj.mesh.material.emissiveIntensity = 1.0;

    gsap.to(obj.mesh.material.color, { r: 0.1, g: 1.0, b: 0.2, duration: 0.6 });
    gsap.to(obj.mesh.scale,          { x: 0.0, y: 0.0, z: 0.0, duration: 3.0, delay: 0.4,
      ease: 'power1.in',
      onComplete: () => {
        this.engine.scene.remove(obj.mesh);
        this.engine.world.removeBody(hitBody);
        this.engine.physicsObjects = this.engine.physicsObjects.filter(o => o !== obj);
      }
    });
    gsap.to(obj.mesh.material, { opacity: 0, duration: 2.0, delay: 1.2 });

    this._showFeedback('MELTING!', '#44ff66');
  }

  // ── Headshot ───────────────────────────────────────────────────────────────

  _onHeadshot(targetBody) {
    // Massive upward + backward launch
    targetBody.applyImpulse(
      new CANNON.Vec3(0, 900, -50),
      targetBody.position
    );
    this._flash('rgba(255,255,255,0.5)', 0.3, 300);
    this._showFeedback('HEADSHOT!', '#ffe040');
    this._triggerRecoil(0.5);
  }

  // ─── Loose-shot spawner (burst companions) ─────────────────────────────────

  _spawnLooseShot(forceVec, spec, startPos) {
    const r   = spec.radius * 0.8;
    const mat = new THREE.MeshStandardMaterial({
      color: spec.color, roughness: 0.7,
      emissive: new THREE.Color(spec.color).multiplyScalar(0.2),
      emissiveIntensity: 0.4
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 10), mat);
    mesh.castShadow = true;

    const body = new CANNON.Body({
      mass: spec.mass,
      shape: new CANNON.Sphere(r),
      material: this.engine.defaultMaterial
    });
    body.fixedRotation  = true;
    body.angularDamping = 0.999;
    body.position.set(startPos.x, startPos.y, startPos.z);
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

  // ─── Recoil ────────────────────────────────────────────────────────────────

  _triggerRecoil(intensity) {
    const orig = this.engine.camera.rotation.x;
    gsap.to(this.engine.camera.rotation, {
      x: orig + intensity, duration: 0.06,
      yoyo: true, repeat: 1
    });
  }

  // ─── Visual helpers ────────────────────────────────────────────────────────

  _flash(color, opacity, durationMs) {
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:${color};opacity:${opacity};pointer-events:none;z-index:100;transition:opacity ${durationMs}ms ease`;
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = '0'; });
    setTimeout(() => el.remove(), durationMs + 50);
  }

  _showFeedback(text, color) {
    if (!this.hitFeedback) return;
    this.hitFeedback.innerText  = text;
    this.hitFeedback.style.color   = color;
    this.hitFeedback.style.opacity = '1';
    clearTimeout(this._feedbackTimer);
    this._feedbackTimer = setTimeout(() => {
      this.hitFeedback.style.opacity = '0';
    }, 800);
  }

  // ─── UI refresh ────────────────────────────────────────────────────────────

  _refreshUI() {
    this.inventory.forEach((a, i) => {
      const slot = document.getElementById(`ammo-slot-${i}`);
      if (!slot) return;
      slot.classList.toggle('ammo-active', i === this.ammoIndex);
      slot.classList.toggle('ammo-empty',  a.count <= 0);

      const countEl = slot.querySelector('.ammo-count');
      if (countEl) {
        countEl.innerText = a.count === Infinity ? '∞' : a.count;
      }
    });
    const desc = document.getElementById('ammo-desc');
    if (desc) desc.innerText = this.inventory[this.ammoIndex].desc;

    this._updateStaminaBar();
  }
}
