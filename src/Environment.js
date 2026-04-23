import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Environment {
  constructor(engine) {
    this.engine = engine;
    this._time  = 0;
    this.movingTargets = []; // updated every frame

    this.mudBrickMat = new THREE.MeshStandardMaterial({ color: 0x8a7b66, roughness: 0.95, metalness: 0.05 });
    this.stoneMat    = new THREE.MeshStandardMaterial({ color: 0x6a6055, roughness: 0.9,  metalness: 0.05 });
    this.woodMat     = this._mat(0x7a5c2e, 0x2a1a00, 0.3);

    // Bright target materials
    this.tRed    = this._mat(0xff2200, 0x661100, 0.8);
    this.tBlue   = this._mat(0x0088ff, 0x002266, 0.8);
    this.tOrange = this._mat(0xff8800, 0x442200, 0.7);
    this.tGold   = this._mat(0xffcc00, 0x664400, 1.0);
    this.tGreen  = this._mat(0x00dd44, 0x005522, 0.7);
    this.tPurple = this._mat(0xcc00ff, 0x440066, 0.8);
    this.tCyan   = this._mat(0x00ffee, 0x004433, 0.9);

    this.buildPerimeter();
    this.buildDecorations();
    this.buildZone1_10m();
    this.buildZone2_20m();
    this.buildZone3_32m();
    this.buildZone4_42m();
    this.buildZone5_55m();
    this.buildZone6_68m();
    this.buildZone7_80m();
    this.buildMovingTargets();
    this.buildDistanceMarkers();
  }

  _mat(color, emissive, emissiveIntensity) {
    return new THREE.MeshStandardMaterial({
      color, emissive: new THREE.Color(emissive),
      emissiveIntensity, roughness: 0.6, metalness: 0.2
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  _staticBox(w, h, d, x, y, z, mat) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const body = new CANNON.Body({
      mass: 0, material: this.engine.defaultMaterial,
      shape: new CANNON.Box(new CANNON.Vec3(w/2, h/2, d/2)),
      position: new CANNON.Vec3(x, y, z)
    });
    this.engine.addPhysicsObject(mesh, body);
    return { mesh, body };
  }

  _dynBox(w, h, d, x, y, z, mat, mass = 1) {
    // y is the centre — caller must pass (surfaceY + h/2) to sit on a surface
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    const body = new CANNON.Body({
      mass, material: this.engine.defaultMaterial,
      shape: new CANNON.Box(new CANNON.Vec3(w/2, h/2, d/2)),
      position: new CANNON.Vec3(x, y, z)
    });
    this.engine.addPhysicsObject(mesh, body);
    return { mesh, body };
  }

  _dynSphere(r, x, y, z, mat, mass = 1) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 16), mat);
    mesh.castShadow = true;
    const body = new CANNON.Body({
      mass, material: this.engine.defaultMaterial,
      shape: new CANNON.Sphere(r),
      position: new CANNON.Vec3(x, y, z)
    });
    this.engine.addPhysicsObject(mesh, body);
    return { mesh, body };
  }

  _dynCylinder(rT, rB, h, x, y, z, mat, mass = 1) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rT, rB, h, 16), mat);
    mesh.castShadow = true;
    const shape = new CANNON.Cylinder(rT, rB, h, 16);
    const body = new CANNON.Body({
      mass, material: this.engine.defaultMaterial,
      shape,
      position: new CANNON.Vec3(x, y, z)
    });
    this.engine.addPhysicsObject(mesh, body);
    return { mesh, body };
  }

  _label(text, color, x, y, z, scaleX = 5, scaleY = 2.5) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 128);
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.beginPath();
    ctx.roundRect(4, 4, 248, 120, 14);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = 'bold 58px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 64);
    const tex = new THREE.CanvasTexture(canvas);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sp.position.set(x, y, z);
    sp.scale.set(scaleX, scaleY, 1);
    this.engine.scene.add(sp);
  }

  // ── World structure ───────────────────────────────────────────────────────

  buildPerimeter() {
    const H = 6, T = 2;
    // Side walls (x=±30), running z=25 → z=-90
    this._staticBox(T, H, 120, -30, H/2, -32, this.mudBrickMat);
    this._staticBox(T, H, 120,  30, H/2, -32, this.mudBrickMat);
    // Far wall
    this._staticBox(62, H, T,  0, H/2, -93, this.mudBrickMat);
    // Back wall (behind player)
    this._staticBox(62, H, T,  0, H/2, 25,  this.mudBrickMat);
  }

  buildDecorations() {
    // Scattered rock boulders for visual interest (static)
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x7a7060, roughness: 1, metalness: 0 });
    const rocks = [
      [-22, 1, -5], [22, 1.2, -8], [-20, 0.8, -18], [25, 0.9, -35],
      [-25, 1.1, -48], [23, 1, -60], [-21, 0.9, -72], [24, 1.2, -80],
    ];
    for (const [x, r, z] of rocks) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), rockMat);
      mesh.position.set(x, r * 0.5, z);
      mesh.castShadow = true; mesh.receiveShadow = true;
      this.engine.scene.add(mesh);
      // static physics
      const body = new CANNON.Body({
        mass: 0, material: this.engine.defaultMaterial,
        shape: new CANNON.Sphere(r),
        position: new CANNON.Vec3(x, r * 0.5, z)
      });
      this.engine.world.addBody(body);
    }

    // Wooden target stands (static posts) at each zone — purely decorative poles
    const postMat = new THREE.MeshStandardMaterial({ color: 0x5a3e1c, roughness: 0.9 });
    const poleZ = [0, -10, -22, -32, -45, -58, -70];
    for (const z of poleZ) {
      for (const x of [-14, 14]) {
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 3.5, 8), postMat);
        mesh.position.set(x, 1.75, z);
        mesh.castShadow = true;
        this.engine.scene.add(mesh);
      }
    }
  }

  // ── Target Zones (Y = surfaceY + halfHeight) ──────────────────────────────

  buildZone1_10m() {
    // z=0  |  3 large easy targets on ground
    // Ground surface y=0, target h=1.5 → centre y=0.75
    this._dynSphere(0.9, -7,  0.9,  0,  this.tRed,   1);
    this._dynBox(1.5, 1.5, 1.5,  0, 0.75,  0, this.tBlue,  1);
    this._dynSphere(0.9,  7,  0.9,  0,  this.tRed,   1);
  }

  buildZone2_20m() {
    // z=-10  |  medium targets; one stacked pair
    this._dynBox(1.2, 1.2, 1.2, -8, 0.6, -10, this.tOrange, 1);
    // Stack: base then top
    this._dynBox(1.2, 1.2, 1.2,  0, 0.6, -10, this.tOrange, 1);
    this._dynBox(0.9, 0.9, 0.9,  0, 1.65,-10, this.tGold,   1); // top of stack
    this._dynSphere(0.55, 8, 0.55, -10, this.tOrange, 1);
  }

  buildZone3_32m() {
    // z=-22  |  platform on left, cylinders + small box ground level
    // Platform (static): w6 h3 d6 at (-12, 1.5, -22) → top at y=3
    this._staticBox(6, 3, 6, -12, 1.5, -22, this.stoneMat);
    // Target ON platform: centre = 3 + 0.7 = 3.7
    this._dynSphere(0.7, -12, 3.7, -22, this.tPurple, 1);

    // Cylinders on ground (r=0.4, h=1.2 → centre y=0.6)
    this._dynCylinder(0.4, 0.4, 1.2, -5, 0.6, -22, this.tCyan, 1);
    this._dynCylinder(0.4, 0.4, 1.2,  5, 0.6, -22, this.tCyan, 1);

    // Small gold bonus box
    this._dynBox(0.8, 0.8, 0.8, 0, 0.4, -24, this.tGold, 1);
  }

  buildZone4_42m() {
    // z=-32  |  cover blocks with targets peeking around them
    // Cover (static): 2x2x2 cubes
    this._staticBox(2.5, 2.5, 2.5, -6, 1.25, -30, this.mudBrickMat);
    this._staticBox(2.5, 2.5, 2.5,  6, 1.25, -30, this.mudBrickMat);

    // Targets at sides of cover and far gap
    this._dynBox(1.0, 1.0, 1.0, -10, 0.5, -32, this.tBlue,  1);
    this._dynSphere(0.6,    0, 0.6, -33, this.tRed,   1); // centre gap target
    this._dynBox(1.0, 1.0, 1.0,  10, 0.5, -32, this.tBlue,  1);
  }

  buildZone5_55m() {
    // z=-45  |  wall with targets on top
    // Wall: w36 h6 d2 centre at (0, 3, -45) → top at y=6
    this._staticBox(36, 6, 2, 0, 3, -45, this.mudBrickMat);

    // Arched gap in centre (decorative arch lintel)
    this._staticBox(4, 1, 2.5, 0, 5.5, -45, this.mudBrickMat);

    // Targets on wall top: centre = 6 + h/2
    this._dynBox(1.0, 1.0, 1.0, -10, 6.5, -44.5, this.tOrange, 1.5);
    this._dynBox(1.0, 1.0, 1.0,   0, 6.5, -44.5, this.tGold,   1.5);
    this._dynBox(1.0, 1.0, 1.0,  10, 6.5, -44.5, this.tOrange, 1.5);

    // Small targets on top tier
    this._dynSphere(0.4, -5, 6.4, -44.5, this.tCyan, 1);
    this._dynSphere(0.4,  5, 6.4, -44.5, this.tCyan, 1);
  }

  buildZone6_68m() {
    // z=-58  |  varied standalone challenge targets
    // Tall platform (static): h5 → top y=5
    this._staticBox(3, 5, 3, -12, 2.5, -58, this.stoneMat);
    this._dynSphere(0.6, -12, 5.6, -58, this.tPurple, 1);

    // Ground targets at different heights (some on small plinths)
    this._staticBox(1, 0.5, 1,  0, 0.25, -58, this.stoneMat); // plinth
    this._dynSphere(0.55,  0, 1.05, -58, this.tGold, 1);

    this._dynBox(0.8, 0.8, 0.8,  8, 0.4, -58, this.tRed,  1);
    this._dynBox(0.8, 0.8, 0.8, 14, 0.4, -60, this.tRed,  1);
    this._dynSphere(0.5, -6, 0.5, -60, this.tGreen, 1);
  }

  buildZone7_80m() {
    // z=-75  |  extreme long-shot zone — tiny targets, one very high
    // Tall tower (static): h=10 → top y=10
    this._staticBox(2, 10, 2, 0, 5, -75, this.stoneMat);
    // Target on tower: tiny, centre = 10 + 0.35 = 10.35
    this._dynBox(0.7, 0.7, 0.7, 0, 10.35, -75, this.tGold, 1);

    // Side small targets on ground
    this._dynSphere(0.45, -8, 0.45, -77, this.tCyan,   1);
    this._dynSphere(0.45,  8, 0.45, -77, this.tCyan,   1);
    this._dynBox(0.6, 0.6, 0.6, -14, 0.3, -75, this.tPurple, 1);
    this._dynBox(0.6, 0.6, 0.6,  14, 0.3, -75, this.tPurple, 1);
  }

  // ── Moving targets ───────────────────────────────────────────────────────

  buildMovingTargets() {
    const postMat = new THREE.MeshStandardMaterial({ color: 0x5a3e1c, roughness: 0.9 });

    // ── Pendulum 1 (20 m zone) — swings ±5 m horizontally ──────────────────
    {
      const cx = 0, cy = 1.0, cz = -10;
      // Rail post
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.5, 8), postMat);
      post.position.set(cx, 1.25, cz);
      this.engine.scene.add(post);

      const { mesh, body } = this._dynSphere(0.6, cx, cy, cz, this.tGreen, 1);
      body.type = CANNON.Body.KINEMATIC;
      this.movingTargets.push({
        mesh, body,
        tick: (t) => {
          const x = cx + 5.0 * Math.sin(t * 1.1);
          body.position.set(x, cy, cz);
        }
      });
    }

    // ── Pendulum 2 (42 m zone) — faster swing, smaller arc ─────────────────
    {
      const cx = 4, cy = 0.7, cz = -32;
      const { mesh, body } = this._dynSphere(0.55, cx, cy, cz, this.tCyan, 1);
      body.type = CANNON.Body.KINEMATIC;
      this.movingTargets.push({
        mesh, body,
        tick: (t) => {
          const x = cx + 4.5 * Math.sin(t * 1.8);
          body.position.set(x, cy, cz);
        }
      });
    }

    // ── Slider (55 m zone) — box that slides left↔right on wall top ────────
    {
      const cy = 7.0, cz = -44.5;  // on top of the 6-m wall
      const { mesh, body } = this._dynBox(1.2, 1.2, 1.2, 5, cy, cz, this.tPurple, 1.5);
      body.type = CANNON.Body.KINEMATIC;
      this.movingTargets.push({
        mesh, body,
        tick: (t) => {
          const x = 5 + 7.0 * Math.sin(t * 0.7);
          body.position.set(x, cy, cz);
        }
      });
    }
  }

  // Called from main.js each frame
  update(dt) {
    this._time += dt;
    for (const mt of this.movingTargets) {
      mt.tick(this._time);
      // Sync the mesh to the kinematic body position
      mt.mesh.position.copy(mt.body.position);
    }
  }

  // ── Distance markers ─────────────────────────────────────────────────────

  buildDistanceMarkers() {
    const zones = [
      { dist: '10m',  z:   0, color: '#44ff88' },
      { dist: '20m',  z: -10, color: '#ffff00' },
      { dist: '32m',  z: -22, color: '#ff9900' },
      { dist: '42m',  z: -32, color: '#ff4400' },
      { dist: '55m',  z: -45, color: '#ff2266' },
      { dist: '68m',  z: -58, color: '#cc00ff' },
      { dist: '80m',  z: -75, color: '#4488ff' },
    ];

    for (const { dist, z, color } of zones) {
      // Coloured stripe on ground
      const stripeMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color), roughness: 0.8,
        transparent: true, opacity: 0.35
      });
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(60, 0.5), stripeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(0, 0.01, z);
      this.engine.scene.add(stripe);

      // Label sprites on both sides
      this._label(dist, color, -27, 3, z, 4, 2);
      this._label(dist, color,  27, 3, z, 4, 2);
    }
  }
}
