// =====================================================================
// 05 | RENDERING CORE | RENDERER, GEOMETRY CACHE, TEXTURES, CAMERA CONTROL
// =====================================================================
const V3 = THREE.Vector3;
const GFX = { renderer: null, w: 1, h: 1, scene: null, camera: null, orbit: null, quality: 'high', ready: false };

function qualityProfile(q) {
  return {
    low: { pr: 1, shadows: false, shadowSize: 1024, particles: 0.45 },
    med: { pr: 1.25, shadows: true, shadowSize: 1024, particles: 0.75 },
    high: { pr: 2, shadows: true, shadowSize: 2048, particles: 1 },
  }[q] || { pr: 1.5, shadows: true, shadowSize: 2048, particles: 1 };
}

function initRenderer() {
  const canvas = $('#gl');
  let r;
  try {
    r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    r = null;
  }
  GFX.renderer = r;
  if (!r) return false;
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.05;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  applyQuality();
  GFX.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 900);
  GFX.orbit = new OrbitCtl(GFX.camera, canvas);
  onResize();
  window.addEventListener('resize', onResize);
  GFX.ready = true;
  return true;
}
function applyQuality() {
  const q = qualityProfile(S ? S.settings.quality : 'high');
  GFX.qp = q;
  if (!GFX.renderer) return;
  GFX.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pr));
  GFX.renderer.shadowMap.enabled = q.shadows;
  GFX.renderer.shadowMap.needsUpdate = true;
}
function onResize() {
  GFX.w = window.innerWidth; GFX.h = window.innerHeight;
  if (GFX.renderer) GFX.renderer.setSize(GFX.w, GFX.h, false);
  if (GFX.camera) { GFX.camera.aspect = GFX.w / GFX.h; GFX.camera.updateProjectionMatrix(); }
  if (typeof UI !== 'undefined' && UI.onResize) UI.onResize();
}

// ---------- geometry cache ----------
const GEO = {
  _c: new Map(),
  _k(a) { return a.map((v) => (typeof v === 'number' ? v.toFixed(3) : v)).join(','); },
  get(key, make) { let g = this._c.get(key); if (!g) { g = make(); this._c.set(key, g); } return g; },
  box(w, h, d) { return this.get('b' + this._k([w, h, d]), () => new THREE.BoxGeometry(w, h, d)); },
  cyl(rt, rb, h, seg = 12, open = false) { return this.get('c' + this._k([rt, rb, h, seg, open ? 1 : 0]), () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open)); },
  sph(r, ws = 12, hs = 8) { return this.get('s' + this._k([r, ws, hs]), () => new THREE.SphereGeometry(r, ws, hs)); },
  hemi(r) { return this.get('h' + this._k([r]), () => new THREE.SphereGeometry(r, 14, 8, 0, TAU, 0, Math.PI / 2)); },
  cone(r, h, seg = 10) { return this.get('o' + this._k([r, h, seg]), () => new THREE.ConeGeometry(r, h, seg)); },
  torus(r, t, seg = 24) { return this.get('t' + this._k([r, t, seg]), () => new THREE.TorusGeometry(r, t, 6, seg)); },
  plane(w, h) { return this.get('p' + this._k([w, h]), () => new THREE.PlaneGeometry(w, h)); },
  ico(r, detail = 0) { return this.get('i' + this._k([r, detail]), () => new THREE.IcosahedronGeometry(r, detail)); },
  dodec(r) { return this.get('d' + this._k([r]), () => new THREE.DodecahedronGeometry(r, 0)); },
  wedge(w, h, d) {
    return this.get('w' + this._k([w, h, d]), () => {
      const s = new THREE.Shape();
      s.moveTo(-d / 2, -h / 2); s.lineTo(d / 2, -h / 2 + h * 0.35); s.lineTo(d / 2, h / 2 - h * 0.35); s.lineTo(-d / 2, h / 2); s.lineTo(-d / 2, -h / 2);
      const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
      g.translate(0, 0, -w / 2); g.rotateY(-Math.PI / 2);
      return g;
    });
  },
};
function mk(geo, mat, x = 0, y = 0, z = 0, parent = null, o = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
  if (o.s) m.scale.setScalar(o.s);
  if (o.sx) m.scale.set(o.sx, o.sy || 1, o.sz || 1);
  m.castShadow = o.shadow !== false; m.receiveShadow = !!o.receive;
  if (parent) parent.add(m);
  return m;
}
function grp(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (parent) parent.add(g);
  return g;
}

// ---------- canvas textures ----------
const TEX = { _c: new Map() };
function canvasTex(key, w, h, draw, repeat) {
  let t = TEX._c.get(key);
  if (t) {
    if (TEX.lru && TEX.lru.has(key)) { TEX.lru.delete(key); TEX.lru.add(key); }
    return t;
  }
  // paint and decal textures change often while editing, so keep only the most recent ones
  if (/^(pat|pl)\|/.test(key)) {
    TEX.lru = TEX.lru || new Set();
    TEX.lru.add(key);
    if (TEX.lru.size > 48) { const old = TEX.lru.values().next().value; TEX.lru.delete(old); const ot = TEX._c.get(old); if (ot) ot.dispose(); TEX._c.delete(old); }
  }
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  TEX._c.set(key, t);
  return t;
}
function patternTex(pattern, p, s, a, seed = 1) {
  return canvasTex('pat|' + pattern + p + s + a + seed, 256, 256, (g, w, h) => {
    const r = mulberry32(seed);
    g.fillStyle = p; g.fillRect(0, 0, w, h);
    // panel lines and wear
    g.globalAlpha = 0.08; g.fillStyle = '#000';
    for (let i = 0; i < 40; i++) g.fillRect(r() * w, r() * h, r() * 30 + 4, r() * 3 + 1);
    g.globalAlpha = 1;
    g.fillStyle = s;
    if (pattern === 'stripes') {
      g.save(); g.translate(w / 2, h / 2); g.rotate(-Math.PI / 4);
      for (let x = -w; x < w; x += 85) g.fillRect(x, -h, 16, h * 2);
      g.restore();
    } else if (pattern === 'hazard') {
      g.save(); g.translate(w / 2, h / 2); g.rotate(-Math.PI / 4);
      g.fillStyle = a;
      for (let x = -w; x < w; x += 48) g.fillRect(x, -h, 24, h * 2);
      g.restore();
      g.fillStyle = p; g.fillRect(0, 40, w, h - 80);
    } else if (pattern === 'camo') {
      for (let i = 0; i < 26; i++) {
        g.beginPath();
        const cx = r() * w, cy = r() * h, rad = 14 + r() * 34;
        for (let k = 0; k < 9; k++) {
          const an = (k / 9) * TAU, rr = rad * (0.6 + r() * 0.6);
          k ? g.lineTo(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr) : g.moveTo(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr);
        }
        g.closePath(); g.fillStyle = i % 3 === 0 ? shade(p, -0.35) : s; g.fill();
      }
    } else if (pattern === 'splinter') {
      for (let i = 0; i < 14; i++) {
        g.beginPath();
        g.moveTo(r() * w, r() * h); g.lineTo(r() * w, r() * h); g.lineTo(r() * w, r() * h);
        g.closePath(); g.fillStyle = i % 2 ? s : shade(p, -0.25); g.fill();
      }
    } else if (pattern === 'digital') {
      const cs = 16;
      for (let x = 0; x < w; x += cs) for (let y = 0; y < h; y += cs) {
        const v = r();
        if (v < 0.25) { g.fillStyle = s; g.fillRect(x, y, cs, cs); } else if (v < 0.35) { g.fillStyle = shade(p, -0.3); g.fillRect(x, y, cs, cs); }
      }
    } else if (pattern === 'twotone') {
      g.fillRect(0, h * 0.55, w, h * 0.45);
      g.fillStyle = a; g.fillRect(0, h * 0.52, w, 8);
    }
    // grime
    g.globalAlpha = 0.12;
    for (let i = 0; i < 120; i++) { g.fillStyle = r() < 0.5 ? '#000' : '#fff'; g.fillRect(r() * w, r() * h, 2, 2); }
    g.globalAlpha = 1;
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2);
  });
}
function plateTex(text, fg, bg, wide) {
  return canvasTex('pl|' + text + fg + bg + (wide ? 1 : 0), wide ? 256 : 128, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    const size = wide ? Math.min(72, Math.floor(400 / Math.max(3, text.length))) : (text.length > 2 ? 58 : 84);
    g.font = '900 ' + size + 'px Impact, "Arial Black", sans-serif';
    g.fillText(text, w / 2, h / 2 + 4);
  });
}
function stripeTex(c1 = '#ffb000', c2 = '#16181c') {
  return canvasTex('stripe|' + c1 + c2, 128, 32, (g, w, h) => {
    g.fillStyle = c2; g.fillRect(0, 0, w, h);
    g.fillStyle = c1;
    for (let x = -h; x < w + h; x += 32) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 16, h); g.lineTo(x + 16 + h, 0); g.lineTo(x + h, 0); g.closePath(); g.fill(); }
  }, [1, 1]);
}
function noiseTex(key, base, var1, size = 256, rep = [8, 8], extra) {
  return canvasTex('n|' + key, size, size, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const r = mulberry32(hashStr(key));
    for (let i = 0; i < 2600; i++) {
      g.globalAlpha = 0.05 + r() * 0.1;
      g.fillStyle = r() < 0.5 ? var1 : shade(base, 0.12);
      const s = 1 + r() * 6;
      g.fillRect(r() * w, r() * h, s, s);
    }
    g.globalAlpha = 1;
    if (extra) extra(g, w, h, r);
  }, rep);
}

// ---------- shared materials ----------
const MAT = {};
function sharedMats() {
  if (MAT.ready) return MAT;
  MAT.metal = new THREE.MeshStandardMaterial({ color: 0x5a616b, metalness: 0.3, roughness: 0.45 });
  MAT.dark = new THREE.MeshStandardMaterial({ color: 0x1c1f23, metalness: 0.2, roughness: 0.6 });
  MAT.rubber = new THREE.MeshStandardMaterial({ color: 0x1b1b1d, metalness: 0.1, roughness: 0.9 });
  MAT.chrome = new THREE.MeshStandardMaterial({ color: 0xc4ccd6, metalness: 0.45, roughness: 0.25 });
  MAT.char = new THREE.MeshStandardMaterial({ color: 0x1a1512, metalness: 0.2, roughness: 0.95 });
  MAT.marker = new THREE.MeshBasicMaterial({ color: 0x2fd6e8, transparent: true, opacity: 0.8, depthTest: false });
  MAT.markerOn = new THREE.MeshBasicMaterial({ color: 0xffb000, transparent: true, opacity: 0.95, depthTest: false });
  MAT.ready = true;
  return MAT;
}

// ---------- orbit camera controller ----------
class OrbitCtl {
  constructor(cam, dom) {
    this.cam = cam; this.dom = dom;
    this.target = new V3(0, 3, 0); this.tTarget = new V3(0, 3, 0);
    this.yaw = 0.6; this.pitch = 0.32; this.dist = 16;
    this.tYaw = 0.6; this.tPitch = 0.32; this.tDist = 16;
    this.minDist = 5; this.maxDist = 60; this.minPitch = 0.02; this.maxPitch = 1.45;
    this.enabled = true; this.autoRotate = 0; this.dragging = false; this.moved = 0;
    this.ptrs = new Map(); this.onClick = null; this.onUserInput = null; this.bounds = null;
    dom.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.move(e));
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', (e) => this.up(e));
    dom.addEventListener('wheel', (e) => { if (!this.enabled) return; e.preventDefault(); this.tDist = clamp(this.tDist * Math.pow(1.0015, e.deltaY), this.minDist, this.maxDist); this.onUserInput && this.onUserInput(); }, { passive: false });
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  down(e) {
    if (!this.enabled) return;
    this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button, sx: e.clientX, sy: e.clientY });
    this.dragging = true; this.moved = 0;
    try { this.dom.setPointerCapture(e.pointerId); } catch (err) {}
  }
  move(e) {
    const p = this.ptrs.get(e.pointerId);
    if (!p || !this.enabled) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    this.moved += Math.abs(dx) + Math.abs(dy);
    if (this.ptrs.size === 2) {
      const pts = [...this.ptrs.values()];
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (this._pinch) this.tDist = clamp(this.tDist * (this._pinch / Math.max(1, d)), this.minDist, this.maxDist);
      this._pinch = d;
      this.onUserInput && this.onUserInput();
      return;
    }
    if (p.b === 2 || e.shiftKey) {
      const s = this.dist * 0.0016;
      const right = new V3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const fwd = new V3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      this.tTarget.addScaledVector(right, -dx * s).addScaledVector(fwd, -dy * s);
      if (this.bounds) { this.tTarget.x = clamp(this.tTarget.x, -this.bounds, this.bounds); this.tTarget.z = clamp(this.tTarget.z, -this.bounds, this.bounds); }
    } else {
      this.tYaw -= dx * 0.006;
      this.tPitch = clamp(this.tPitch + dy * 0.004, this.minPitch, this.maxPitch);
    }
    if (this.moved > 4) this.onUserInput && this.onUserInput();
  }
  up(e) {
    const p = this.ptrs.get(e.pointerId);
    if (!p) return;
    this.ptrs.delete(e.pointerId);
    if (this.ptrs.size < 2) this._pinch = 0;
    if (!this.ptrs.size) this.dragging = false;
    if (this.moved < 6 && this.onClick && p.b === 0) this.onClick(e);
  }
  snap() { this.yaw = this.tYaw; this.pitch = this.tPitch; this.dist = this.tDist; this.target.copy(this.tTarget); }
  update(dt) {
    if (this.autoRotate && !this.dragging) this.tYaw += this.autoRotate * dt;
    this.yaw = damp(this.yaw, this.tYaw, 10, dt);
    this.pitch = damp(this.pitch, this.tPitch, 10, dt);
    this.dist = damp(this.dist, this.tDist, 8, dt);
    this.target.lerp(this.tTarget, 1 - Math.exp(-8 * dt));
    const cp = Math.cos(this.pitch);
    this.cam.position.set(this.target.x + Math.sin(this.yaw) * cp * this.dist, this.target.y + Math.sin(this.pitch) * this.dist, this.target.z + Math.cos(this.yaw) * cp * this.dist);
    this.cam.lookAt(this.target);
  }
}
