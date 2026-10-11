// =====================================================================
// 08 | RENDERING | PARTICLES, TRACERS, BEAMS, DEBRIS, DECALS, SHAKE
// =====================================================================
class ParticleSys {
  constructor(max, additive) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.grow = new Float32Array(max); this.grav = new Float32Array(max); this.drag = new Float32Array(max); this.a0 = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('color', this.aCol); g.setAttribute('size', this.aSize); g.setAttribute('alpha', this.aAlpha);
    g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, vertexColors: true,
      uniforms: { scale: { value: 600 } },
      vertexShader: 'attribute float size; attribute float alpha; varying vec3 vC; varying float vA; uniform float scale; void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / max(0.5,-mv.z); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec3 vC; varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d,d)*4.0; if(r>1.0) discard; float f = ' + (additive ? '(1.0-r)*(1.0-r)' : '(1.0-r)*0.9') + '; gl_FragColor = vec4(vC, vA*f); }',
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 5 : 4;
  }
  emit(x, y, z, vx, vy, vz, life, size, r, g, b, alpha = 1, grow = 0, grav = 0, drag = 0) {
    if (this.n >= this.max) return;
    const i = this.n++;
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.col[i3] = r; this.col[i3 + 1] = g; this.col[i3 + 2] = b;
    this.life[i] = life; this.maxLife[i] = life; this.size[i] = size; this.alpha[i] = alpha; this.a0[i] = alpha;
    this.grow[i] = grow; this.grav[i] = grav; this.drag[i] = drag;
  }
  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.kill(i); continue; }
      const i3 = i * 3;
      const dr = Math.exp(-this.drag[i] * dt);
      this.vel[i3] *= dr; this.vel[i3 + 1] = this.vel[i3 + 1] * dr - this.grav[i] * dt; this.vel[i3 + 2] *= dr;
      this.pos[i3] += this.vel[i3] * dt; this.pos[i3 + 1] += this.vel[i3 + 1] * dt; this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      if (this.pos[i3 + 1] < 0.05) { this.pos[i3 + 1] = 0.05; this.vel[i3 + 1] *= -0.3; }
      this.size[i] += this.grow[i] * dt;
      const t = this.life[i] / this.maxLife[i];
      this.alpha[i] = this.a0[i] * Math.min(1, t * 2.2);
      i++;
    }
    const g = this.points.geometry;
    g.setDrawRange(0, this.n);
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = this.aAlpha.needsUpdate = true;
  }
  kill(i) {
    const j = --this.n;
    if (i === j) return;
    const i3 = i * 3, j3 = j * 3;
    for (let k = 0; k < 3; k++) { this.pos[i3 + k] = this.pos[j3 + k]; this.vel[i3 + k] = this.vel[j3 + k]; this.col[i3 + k] = this.col[j3 + k]; }
    this.life[i] = this.life[j]; this.maxLife[i] = this.maxLife[j]; this.size[i] = this.size[j]; this.alpha[i] = this.alpha[j]; this.a0[i] = this.a0[j];
    this.grow[i] = this.grow[j]; this.grav[i] = this.grav[j]; this.drag[i] = this.drag[j];
  }
  clear() { this.n = 0; this.points.geometry.setDrawRange(0, 0); }
}

class FX {
  constructor(scene, arena) {
    this.scene = scene; this.arena = arena;
    const q = (GFX.qp && GFX.qp.particles) || 1;
    this.q = q;
    this.add = new ParticleSys(Math.floor(5000 * q) + 500, true);
    this.smoke = new ParticleSys(Math.floor(3500 * q) + 400, false);
    scene.add(this.add.points); scene.add(this.smoke.points);
    this.shake = 0;
    this.tracers = []; this.beams = []; this.debris = []; this.decals = []; this.rings = [];
    this.tracerMat = new THREE.MeshBasicMaterial({ color: 0xffd080, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    const scorch = canvasTex('scorch', 128, 128, (g, w, h) => {
      const r = mulberry32(5);
      const gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(0,0,0,0.95)'); gr.addColorStop(0.45, 'rgba(10,8,6,0.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(0,0,0,0.5)';
      for (let i = 0; i < 14; i++) { const a = r() * TAU, d = 20 + r() * 34; g.beginPath(); g.arc(w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d, 2 + r() * 6, 0, TAU); g.fill(); }
    });
    scorch.colorSpace = THREE.NoColorSpace;
    this.decalMat = new THREE.MeshBasicMaterial({ color: 0xffffff, map: scorch, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xffc080, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.projMeshes = new Map();
    this._v = new V3(); this._v2 = new V3();
  }
  setScale(h) { this.add.mat.uniforms.scale.value = this.smoke.mat.uniforms.scale.value = h * 0.6; }
  rate(n) { return Math.max(1, Math.round(n * this.q)); }
  sparks(p, n = 10, spd = 12, col = [1, 0.75, 0.3], size = 0.25) {
    n = this.rate(n);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, e = Math.random() * 1.2 - 0.2;
      const s = spd * (0.3 + Math.random() * 0.8);
      this.add.emit(p.x, p.y, p.z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + 2, Math.sin(a) * Math.cos(e) * s, 0.25 + Math.random() * 0.4, size * (0.6 + Math.random() * 0.8), col[0], col[1], col[2], 1, -size, 18, 1.5);
    }
  }
  flash(p, size = 2, col = [1, 0.8, 0.5], life = 0.12) { this.add.emit(p.x, p.y, p.z, 0, 0, 0, life, size, col[0], col[1], col[2], 1, size * 4, 0, 0); }
  smokePuff(p, n = 3, size = 1.2, dark = 0.25, life = 2.2, rise = 1.5) {
    n = this.rate(n);
    for (let i = 0; i < n; i++) {
      const c = dark + Math.random() * 0.1;
      this.smoke.emit(p.x + rand(-0.4, 0.4), p.y + rand(-0.2, 0.3), p.z + rand(-0.4, 0.4), rand(-0.8, 0.8), rise * (0.6 + Math.random() * 0.8), rand(-0.8, 0.8), life * (0.7 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.6), c, c * 0.95, c * 0.9, 0.55, size * 0.9, -0.2, 0.6);
    }
  }
  fire(p, n = 2, size = 0.8) {
    n = this.rate(n);
    for (let i = 0; i < n; i++) this.add.emit(p.x + rand(-0.3, 0.3), p.y + rand(0, 0.3), p.z + rand(-0.3, 0.3), rand(-0.5, 0.5), 2 + Math.random() * 2, rand(-0.5, 0.5), 0.35 + Math.random() * 0.35, size * (0.6 + Math.random() * 0.6), 1, 0.45 + Math.random() * 0.3, 0.1, 0.9, -size * 0.8, -1, 0.5);
  }
  dust(p, n = 6, size = 1.4, col = [0.55, 0.48, 0.38]) {
    n = this.rate(n);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = 2 + Math.random() * 4;
      this.smoke.emit(p.x, 0.3, p.z, Math.cos(a) * s, 0.5 + Math.random(), Math.sin(a) * s, 1 + Math.random(), size * (0.6 + Math.random() * 0.6), col[0], col[1], col[2], 0.45, size * 1.2, 0, 2);
    }
  }
  explosion(p, size = 1, opts = {}) {
    const n = Math.round(30 * size);
    this.flash(p, 5 * size, [1, 0.85, 0.55], 0.18);
    for (let i = 0; i < this.rate(n); i++) {
      const a = Math.random() * TAU, e = Math.random() * 1.4 - 0.2, s = (4 + Math.random() * 9) * Math.sqrt(size);
      this.add.emit(p.x, p.y, p.z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s, Math.sin(a) * Math.cos(e) * s, 0.35 + Math.random() * 0.5, (0.8 + Math.random() * 1.2) * size, 1, 0.5 + Math.random() * 0.35, 0.15, 1, size * 2.2, 2, 3);
    }
    this.sparks(p, 20 * size, 18 * Math.sqrt(size));
    this.smokePuff(p, 10 * size, 2.2 * size, 0.18, 3, 2.5);
    if (p.y < 3) this.dust(p, 8 * size, 1.6 * size);
    if (opts.decal !== false && p.y < 2.5) this.decal(p.x, p.z, 1.5 * size + 1);
    this.ring(p, size);
    this.light(p, 30 * size, 0.35 + 0.15 * size);
    this.shake = Math.min(1.2, this.shake + 0.25 * size * (opts.shakeMul == null ? 1 : opts.shakeMul));
  }
  ring(p, size) {
    let r = this.rings.find((x) => !x.m.visible);
    if (!r) { if (this.rings.length > 10) return; r = { m: mk(GEO.torus(1, 0.08, 24), this.ringMat.clone(), 0, 0, 0, this.scene, { shadow: false }) }; this.rings.push(r); }
    r.m.visible = true; r.m.position.set(p.x, Math.max(0.3, p.y * 0.3), p.z); r.m.rotation.x = Math.PI / 2; r.t = 0; r.size = size; r.m.scale.setScalar(0.5);
  }
  light(p, intensity, dur) {
    if (!this.arena || !this.arena.flashes) return;
    const f = this.arena.flashes.reduce((a, b) => (a.t < b.t ? a : b));
    f.l.position.set(p.x, p.y + 1, p.z); f.max = intensity; f.dur = dur; f.t = dur; f.l.intensity = intensity;
  }
  decal(x, z, r) {
    let d;
    if (this.decals.length < 60) { d = mk(GEO.plane(1, 1), this.decalMat, 0, 0, 0, this.scene, { rx: -Math.PI / 2, shadow: false }); d.renderOrder = 1; this.decals.push(d); }
    else { d = this.decals.shift(); this.decals.push(d); }
    d.position.set(x, 0.03 + Math.random() * 0.01, z); d.scale.set(r * 2, r * 2, 1); d.rotation.z = Math.random() * TAU;
  }
  tracer(from, to, col = 0xffd080, width = 0.08, life = 0.08) {
    let t = this.tracers.find((x) => !x.m.visible);
    if (!t) { t = { m: mk(GEO.box(1, 1, 1), this.tracerMat.clone(), 0, 0, 0, this.scene, { shadow: false }) }; this.tracers.push(t); }
    t.m.visible = true; t.m.material.color.setHex(col); t.m.material.opacity = 1;
    const len = from.distanceTo(to);
    t.m.position.copy(from).lerp(to, 0.5); t.m.scale.set(width, width, len); t.m.lookAt(to);
    t.life = life; t.max = life;
  }
  // visual for an active projectile (keyed by sim projectile)
  projMesh(pr) {
    let m = this.projMeshes.get(pr);
    if (m) return m;
    const k = pr.vis;
    if (k === 'missile') m = mk(GEO.box(0.18, 0.18, 0.7), new THREE.MeshBasicMaterial({ color: 0xfff0d0 }), 0, 0, 0, this.scene, { shadow: false });
    else if (k === 'shell') m = mk(GEO.sph(0.3, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe0a0 }), 0, 0, 0, this.scene, { shadow: false });
    else if (k === 'plasma') m = mk(GEO.sph(0.45, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff60e0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }), 0, 0, 0, this.scene, { shadow: false });
    else m = mk(GEO.box(1, 1, 1), new THREE.MeshBasicMaterial({ color: pr.big ? 0xffc060 : 0xffe0a0, transparent: true, blending: THREE.AdditiveBlending }), 0, 0, 0, this.scene, { shadow: false });
    this.projMeshes.set(pr, m);
    return m;
  }
  dropProj(pr) { const m = this.projMeshes.get(pr); if (m) { this.scene.remove(m); m.material.dispose(); this.projMeshes.delete(pr); } }
  beam(id, from, to, col, width) {
    let b = this.beams.find((x) => x.id === id);
    if (!b) {
      b = this.beams.find((x) => !x.m.visible);
      if (!b) {
        const m = mk(GEO.cyl(1, 1, 1, 8, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 0, 0, this.scene, { shadow: false });
        const core = mk(GEO.cyl(1, 1, 1, 6, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 0, 0, this.scene, { shadow: false });
        b = { m, core }; this.beams.push(b);
      }
      b.id = id;
    }
    b.m.visible = b.core.visible = true; b.m.material.color.setHex(col); b.seen = true;
    const len = Math.max(0.01, from.distanceTo(to));
    for (const [mm, w] of [[b.m, width], [b.core, width * 0.35]]) {
      mm.position.copy(from).lerp(to, 0.5);
      mm.scale.set(w * (0.85 + Math.random() * 0.3), len, w * (0.85 + Math.random() * 0.3));
      mm.quaternion.setFromUnitVectors(new V3(0, 1, 0), this._v.copy(to).sub(from).normalize());
    }
  }
  endFrameBeams() { for (const b of this.beams) { if (!b.seen) { b.m.visible = b.core.visible = false; b.id = null; } b.seen = false; } }
  addDebris(obj, vel, spin, smoke = true, life = 7) {
    this.scene.attach(obj);
    obj.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.debris.push({ obj, v: vel.clone(), w: spin.clone(), t: 0, life, smoke, rest: false });
    if (this.debris.length > 50) { const d = this.debris.shift(); this.scene.remove(d.obj); }
  }
  update(dt, camPos) {
    this.add.update(dt); this.smoke.update(dt);
    for (const t of this.tracers) if (t.m.visible) { t.life -= dt; t.m.material.opacity = Math.max(0, t.life / t.max); if (t.life <= 0) t.m.visible = false; }
    for (const r of this.rings) if (r.m.visible) { r.t += dt; const k = r.t / 0.45; r.m.scale.setScalar(0.5 + k * 7 * r.size); r.m.material.opacity = Math.max(0, 0.45 * (1 - k)); if (k >= 1) r.m.visible = false; }
    if (this.arena) for (const f of this.arena.flashes) if (f.t > 0) { f.t -= dt; f.l.intensity = Math.max(0, f.max * (f.t / f.dur)); }
    for (const d of this.debris) {
      d.t += dt;
      if (!d.rest) {
        d.v.y -= 20 * dt;
        d.obj.position.addScaledVector(d.v, dt);
        d.obj.rotation.x += d.w.x * dt; d.obj.rotation.y += d.w.y * dt; d.obj.rotation.z += d.w.z * dt;
        if (d.obj.position.y < 0.3) {
          d.obj.position.y = 0.3;
          if (Math.abs(d.v.y) > 3) { d.v.y *= -0.35; d.v.x *= 0.6; d.v.z *= 0.6; d.w.multiplyScalar(0.5); this.dust(d.obj.position, 2, 0.8); }
          else { d.rest = true; }
        }
      }
      if (d.smoke && d.t < d.life && Math.random() < dt * 8) this.smokePuff(d.obj.position, 1, 0.8, 0.15, 1.5);
      if (d.smoke && d.t < d.life * 0.4 && Math.random() < dt * 10) this.fire(d.obj.position, 1, 0.5);
    }
    this.shake = Math.max(0, this.shake - dt * 1.8);
  }
  dispose() {
    for (const [pr, m] of this.projMeshes) { this.scene.remove(m); m.material.dispose(); }
    this.projMeshes.clear();
  }
}
