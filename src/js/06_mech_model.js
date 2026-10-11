// =====================================================================
// 06 | RENDERING | PROCEDURAL MECH MODELS (modular, rebuilt per design)
// =====================================================================
const LEG_HIP = { l_str: 2.75, l_spr: 2.45, l_stk: 2.95, l_atl: 2.3, l_crw: 1.7, l_jug: 1.9, l_hov: 1.6 };
const TORSO_DIM = { t_box: { w: 2.2, h: 1.8, d: 1.6 }, t_wdg: { w: 2.1, h: 1.7, d: 1.6 }, t_spn: { w: 1.6, h: 2.0, d: 1.2 }, t_brl: { w: 2.3, h: 1.8, d: 2.3 }, t_frt: { w: 2.8, h: 2.0, d: 2.0 } };
const Z_AXIS = new V3(0, 0, 1);

// Pure dimension info (used by the simulation even without rendering)
function mechDims(d) {
  const C = PARTS[d.parts.chassis] || PARTS.c_wsp;
  const s = C.size;
  const hip = LEG_HIP[d.parts.legs] || 2.6;
  const td = TORSO_DIM[d.parts.torso] || TORSO_DIM.t_box;
  const base = hip + 0.15;
  return {
    s, hip: hip * s,
    y: {
      legL: hip * 0.5 * s, legR: hip * 0.5 * s,
      torso: (base + td.h * 0.5) * s, reactor: (base + td.h * 0.4) * s,
      head: (base + td.h + 0.4) * s,
      armL: (base + td.h * 0.8 - 0.9) * s, armR: (base + td.h * 0.8 - 0.9) * s,
      shL: (base + td.h + 0.5) * s, shR: (base + td.h + 0.5) * s, back: (base + td.h * 0.7) * s,
      core0: (base + td.h * 0.5) * s, core1: (base + td.h * 0.5) * s, core2: (base + td.h * 0.5) * s, core3: (base + td.h * 0.5) * s,
    },
    side: { armL: (td.w / 2 + 0.35) * s, armR: -(td.w / 2 + 0.35) * s, shL: td.w * 0.32 * s, shR: -td.w * 0.32 * s, legL: 0.8 * s, legR: -0.8 * s },
    radius: (Math.max(td.w, td.d) / 2 + 0.9) * s,
    height: (base + td.h + 0.9) * s,
  };
}

function mechMats(paint, seed) {
  const p = paint || DEFAULT_PAINT;
  const tex = patternTex(p.pattern || 'solid', p.p, p.s, p.a, seed);
  const accent = new THREE.Color(p.a);
  return {
    primary: new THREE.MeshStandardMaterial({ map: tex, metalness: 0.12, roughness: 0.62 }),
    secondary: new THREE.MeshStandardMaterial({ color: p.s, metalness: 0.18, roughness: 0.6 }),
    accent: new THREE.MeshStandardMaterial({ color: p.a, metalness: 0.1, roughness: 0.45 }),
    joint: new THREE.MeshStandardMaterial({ color: 0x4a4f57, metalness: 0.3, roughness: 0.5 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x6a717b, metalness: 0.3, roughness: 0.45 }),
    dark: sharedMats().dark,
    rubber: sharedMats().rubber,
    chrome: sharedMats().chrome,
    glow: new THREE.MeshStandardMaterial({ color: 0x111111, emissive: accent, emissiveIntensity: 2.4 }),
    lens: new THREE.MeshStandardMaterial({ color: 0x0b2a30, emissive: 0x2fd6e8, emissiveIntensity: 1.8 }),
    plasma: new THREE.MeshStandardMaterial({ color: 0x300a30, emissive: 0xff40d0, emissiveIntensity: 1.6 }),
    fire: new THREE.MeshStandardMaterial({ color: 0x301000, emissive: 0xff7a1a, emissiveIntensity: 2 }),
    vent: new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xff5a1a, emissiveIntensity: 0.12 }),
    num: new THREE.MeshStandardMaterial({ map: plateTex(String(p.num || '00').slice(0, 3), p.a, p.s, false), metalness: 0.2, roughness: 0.6 }),
    name: new THREE.MeshStandardMaterial({ map: plateTex(String(p.plate || 'FORGE').slice(0, 10).toUpperCase(), p.a, '#14161a', true), metalness: 0.2, roughness: 0.6 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff2c0, emissiveIntensity: 3 }),
    flame: new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
  };
}

function buildMech(design, opts = {}) {
  const d = design;
  const C = PARTS[d.parts.chassis] || PARTS.c_wsp;
  const L = PARTS[d.parts.legs] || PARTS.l_str;
  const T = PARTS[d.parts.torso] || PARTS.t_box;
  const H = PARTS[d.parts.head] || PARTS.h_opt;
  const R = PARTS[d.parts.reactor] || PARTS.r_emb;
  const M = mechMats(d.paint, hashStr(d.id || d.name || 'x'));
  const rig = {
    root: new THREE.Group(), mats: M, parts: {}, muzzles: {}, spinners: {}, jets: [], boosts: [], drones: [],
    panels: { f: [], l: [], r: [], b: [], t: [] }, mounts: {}, legs: {}, arms: {}, legType: L.type, rev: !!L.rev,
    anim: { phase: 0, bob: 0, recoil: {}, swing: {}, wheel: 0 }, size: C.size,
  };
  rig.root.name = 'mech';
  const body = grp(rig.root); // scaled body
  body.scale.setScalar(C.size);
  rig.body = body;
  const tilt = grp(body); // for limp and death tilt
  rig.tilt = tilt;
  const hip = LEG_HIP[L.id] || 2.6;
  rig.hipY = hip;

  const anchor = (parent, id, x, y, z, nx, ny, nz) => {
    const a = grp(parent, x, y, z);
    a.quaternion.setFromUnitVectors(Z_AXIS, new V3(nx, ny, nz).normalize());
    a.userData.mount = id; rig.mounts[id] = a;
    return a;
  };

  // ---------------- LEGS ----------------
  const legsG = grp(tilt);
  rig.legsG = legsG;
  if (L.type === 'biped') buildBipedLegs(rig, legsG, M, L, hip, anchor);
  else if (L.type === 'quad') buildQuadLegs(rig, legsG, M, L, hip, anchor);
  else if (L.type === 'tracked') buildTrackLegs(rig, legsG, M, L, hip, anchor);
  else buildHoverLegs(rig, legsG, M, L, hip, anchor);

  // ---------------- TORSO ----------------
  const torsoPivot = grp(tilt, 0, hip, 0);
  rig.torsoPivot = torsoPivot;
  const td = TORSO_DIM[T.id] || TORSO_DIM.t_box;
  const tg = grp(torsoPivot);
  rig.parts.torso = tg;
  const A = buildTorso(rig, tg, M, T, td, R, anchor);

  // ---------------- HEAD ----------------
  const hg = grp(tg, A.head.x, A.head.y, A.head.z);
  buildHead(hg, M, H);
  rig.parts.head = hg;

  // ---------------- ARMS ----------------
  for (const side of [1, -1]) {
    const key = side > 0 ? 'armL' : 'armR';
    const p = PARTS[d.parts[key]];
    if (!p) continue;
    const ap = A.shoulder;
    const pivot = grp(tg, side * ap.x, ap.y, ap.z);
    rig.arms[key] = { pivot };
    rig.parts[key] = pivot;
    mk(GEO.sph(0.42, 12, 8), M.joint, 0, 0, 0, pivot);
    const paul = mk(GEO.box(0.85, 0.55, 1.0), M.primary, side * 0.12, 0.28, 0, pivot);
    paul.userData.panel = side > 0 ? 'l' : 'r';
    rig.panels[side > 0 ? 'l' : 'r'].push(paul);
    mk(GEO.plane(0.5, 0.5), M.num, side * 0.556, 0.28, 0, pivot, { ry: side * Math.PI / 2, shadow: false });
    mk(GEO.box(0.45, 0.85, 0.5), M.secondary, side * 0.1, -0.5, 0, pivot);
    mk(GEO.sph(0.26, 10, 8), M.joint, side * 0.1, -1.0, 0, pivot);
    anchor(pivot, side > 0 ? 'aoL' : 'aoR', side * 0.34, -0.45, 0, side, 0, 0);
    const wg = grp(pivot, side * 0.1, -1.05, 0.12);
    const W = buildWeapon(wg, p, M, side);
    rig.muzzles[key] = W.muzzle;
    if (W.spin) rig.spinners[key] = W.spin;
    rig.arms[key].wg = wg;
    if (p.kind === 'shield') rig.arms[key].shield = W.g;
  }

  // ---------------- SHOULDERS ----------------
  for (const side of [1, -1]) {
    const key = side > 0 ? 'shL' : 'shR';
    const p = PARTS[d.parts[key]];
    if (!p) continue;
    const sp = A.shMount;
    const g = grp(tg, side * sp.x, sp.y, sp.z);
    mk(GEO.box(0.35, 0.3, 0.45), M.joint, 0, 0.15, 0, g);
    const wg = grp(g, 0, 0.55, -0.1);
    const W = buildWeapon(wg, p, M, side, true);
    rig.parts[key] = g;
    rig.muzzles[key] = W.muzzle;
    if (W.spin) rig.spinners[key] = W.spin;
  }

  // ---------------- BACK ----------------
  {
    const p = PARTS[d.parts.back];
    if (p) {
      const bp = A.back;
      const g = grp(tg, bp.x, bp.y, bp.z);
      rig.parts.back = g;
      if (p.slot === 'weapon') {
        mk(GEO.box(0.6, 0.6, 0.4), M.joint, 0, 0.1, 0, g);
        const wg = grp(g, 0, 0.75, 0.0);
        const W = buildWeapon(wg, p, M, 1, true);
        rig.muzzles.back = W.muzzle;
      } else buildBackSystem(rig, g, M, p);
    }
  }

  // ---------------- PLATES AND MODULES ----------------
  rig.plateMeshes = {};
  for (const [mid, pid] of Object.entries(d.plates || {})) {
    const a = rig.mounts[mid], p = PARTS[pid];
    if (!a || !p) continue;
    const small = /^(lf|lo|ao)/.test(mid);
    const g = grp(a);
    if (small) g.scale.setScalar(0.72);
    buildPlate(g, M, p);
    rig.plateMeshes[mid] = g;
    if (p.slot === 'plate') { g.userData.panel = MOUNT_BY_ID[mid].facing; rig.panels[MOUNT_BY_ID[mid].facing].unshift(g); }
  }

  rig.root.traverse((o) => { if (o.isMesh) { o.castShadow = o.castShadow && !o.material.transparent; o.receiveShadow = true; } });
  rig.dims = mechDims(d);
  return rig;
}

// ---------- LEG BUILDERS ----------
function buildBipedLegs(rig, g, M, L, hip, anchor) {
  const heavy = L.id === 'l_stk', W = heavy ? 1.18 : L.rev ? 0.9 : 1;
  mk(GEO.box(1.55 * W, 0.55, 1.0 * W), M.secondary, 0, hip, 0, g);
  mk(GEO.cyl(0.18, 0.18, 1.9 * W, 8), M.joint, 0, hip, 0, g, { rz: Math.PI / 2 });
  for (const side of [1, -1]) {
    const key = side > 0 ? 'legL' : 'legR';
    const hipP = grp(g, side * 0.8 * W, hip, 0);
    mk(GEO.sph(0.36 * W, 10, 8), M.joint, 0, 0, 0, hipP);
    mk(GEO.box(0.58 * W, 1.3, 0.68 * W), M.primary, 0, -0.6, 0, hipP);
    if (heavy) mk(GEO.box(0.7 * W, 0.9, 0.2), M.secondary, 0, -0.6, 0.4 * W, hipP);
    const kneeP = grp(hipP, 0, -1.25, 0);
    mk(GEO.sph(0.3 * W, 10, 8), M.joint, 0, 0, 0, kneeP);
    mk(GEO.box(0.42 * W, 0.42, 0.22), M.accent, 0, 0.05, L.rev ? -0.32 * W : 0.32 * W, kneeP);
    mk(GEO.box(0.5 * W, 1.3, 0.58 * W), M.secondary, 0, -0.65, 0, kneeP);
    mk(GEO.cyl(0.07, 0.07, 1.0, 6), M.chrome, 0, -0.6, L.rev ? 0.34 * W : -0.34 * W, kneeP);
    const ankP = grp(kneeP, 0, -1.3, 0);
    mk(GEO.box(0.8 * W, 0.26, 1.25 * W), M.metal, 0, -0.1, 0.15, ankP);
    mk(GEO.box(0.6 * W, 0.18, 0.4), M.joint, 0, -0.12, -0.5 * W, ankP);
    anchor(hipP, side > 0 ? 'lfL' : 'lfR', 0, -0.55, 0.34 * W + 0.04, 0, 0, 1);
    anchor(hipP, side > 0 ? 'loL' : 'loR', side * (0.29 * W + 0.04), -0.55, 0, side, 0, 0);
    rig.legs[key] = { hip: hipP, knee: kneeP, ankle: ankP, lower: kneeP };
    rig.parts[key] = hipP;
  }
}
function buildQuadLegs(rig, g, M, L, hip, anchor) {
  mk(GEO.box(1.9, 0.7, 1.9), M.secondary, 0, hip, 0, g);
  mk(GEO.box(1.4, 0.3, 1.4), M.primary, 0, hip - 0.45, 0, g);
  rig.quad = [];
  const corners = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
  corners.forEach(([sx, sz], i) => {
    const lp = grp(g, sx * 0.85, hip, sz * 0.8);
    const baseY = Math.atan2(sx, sz);
    lp.rotation.y = baseY;
    const th = grp(lp); th.rotation.x = -0.5;
    mk(GEO.sph(0.32, 10, 8), M.joint, 0, 0, 0, lp);
    mk(GEO.box(0.42, 0.42, 1.55), M.primary, 0, 0, 0.75, th);
    const kn = grp(th, 0, 0, 1.5); kn.rotation.x = 0.5;
    mk(GEO.sph(0.27, 10, 8), M.joint, 0, 0, 0, kn);
    mk(GEO.box(0.36, 3.0, 0.36), M.secondary, 0, -1.5, 0, kn);
    mk(GEO.cyl(0.28, 0.36, 0.25, 8), M.metal, 0, -2.95, 0, kn);
    rig.quad.push({ lp, th, kn, baseY, pair: (i === 0 || i === 3) ? 0 : 1 });
    if (sz > 0) {
      const key = sx > 0 ? 'legL' : 'legR';
      rig.legs[key] = { lower: kn, hip: lp };
      rig.parts[key] = lp;
      anchor(th, sx > 0 ? 'lfL' : 'lfR', 0, 0.24, 0.8, 0, 1, 0.3);
    }
  });
  anchor(g, 'loL', 1.0, hip, 0, 1, 0, 0);
  anchor(g, 'loR', -1.0, hip, 0, -1, 0, 0);
}
function buildTrackLegs(rig, g, M, L, hip, anchor) {
  const heavy = !!L.heavy, W = heavy ? 1.22 : 1;
  mk(GEO.box(1.6 * W, 0.65, 2.3 * W), M.secondary, 0, hip - 0.45, 0, g);
  mk(GEO.cyl(0.85, 0.95, 0.35, 12), M.joint, 0, hip - 0.1, 0, g);
  rig.wheels = [];
  for (const side of [1, -1]) {
    const key = side > 0 ? 'legL' : 'legR';
    const tr = grp(g, side * 1.2 * W, 0, 0);
    mk(GEO.box(0.9 * W, 1.0 * W, 3.2 * W), M.rubber, 0, 0.55 * W, 0, tr);
    for (let k = 0; k < 4; k++) {
      const wh = mk(GEO.cyl(0.38 * W, 0.38 * W, 0.96 * W, 10), M.metal, 0, 0.5 * W, (-1.15 + k * 0.77) * W, tr, { rz: Math.PI / 2 });
      rig.wheels.push(wh);
    }
    const skirt = mk(GEO.box(1.0 * W, 0.4, 3.35 * W), M.primary, 0, 1.15 * W, 0, tr);
    skirt.userData.panel = side > 0 ? 'l' : 'r';
    rig.panels[side > 0 ? 'l' : 'r'].push(skirt);
    mk(GEO.box(0.95 * W, 0.5, 0.45), M.secondary, 0, 0.75 * W, 1.62 * W, tr, { rx: 0.6 });
    if (heavy) mk(GEO.box(0.2, 0.8, 3.0), M.accent, side * 0.55 * W, 0.7, 0, tr);
    anchor(tr, side > 0 ? 'lfL' : 'lfR', 0, 0.95 * W, 1.78 * W, 0, 0.3, 1);
    anchor(tr, side > 0 ? 'loL' : 'loR', side * 0.52 * W, 0.6 * W, 0, side, 0, 0);
    rig.legs[key] = { lower: skirt, hip: tr };
    rig.parts[key] = tr;
  }
}
function buildHoverLegs(rig, g, M, L, hip, anchor) {
  const hov = grp(g, 0, 0, 0);
  rig.hover = hov;
  mk(GEO.cyl(1.4, 1.8, 0.55, 10), M.secondary, 0, 0.85, 0, hov);
  mk(GEO.cyl(1.45, 1.45, 0.22, 10), M.primary, 0, 1.2, 0, hov);
  mk(GEO.torus(1.62, 0.1, 28), M.lens, 0, 0.56, 0, hov, { rx: Math.PI / 2, shadow: false });
  mk(GEO.cyl(0.5, 0.5, 0.5, 10), M.joint, 0, hip - 0.15, 0, hov);
  for (const side of [1, -1]) {
    const key = side > 0 ? 'legL' : 'legR';
    const pod = grp(hov, side * 1.85, 0.95, 0);
    mk(GEO.cyl(0.58, 0.62, 0.6, 10), M.primary, 0, 0, 0, pod);
    mk(GEO.cyl(0.45, 0.45, 0.05, 10), M.lens, 0, -0.32, 0, pod, { shadow: false });
    mk(GEO.box(0.6, 0.18, 0.3), M.joint, -side * 0.5, 0.1, 0, pod);
    anchor(pod, side > 0 ? 'loL' : 'loR', side * 0.62, 0, 0, side, 0, 0);
    rig.legs[key] = { lower: pod, hip: pod };
    rig.parts[key] = pod;
  }
  anchor(hov, 'lfL', 0.7, 0.9, 1.55, 0, 0.2, 1);
  anchor(hov, 'lfR', -0.7, 0.9, 1.55, 0, 0.2, 1);
}

// ---------- TORSO ----------
function buildTorso(rig, g, M, T, td, R, anchor) {
  const { w, h, d } = td;
  const y0 = 0.15, cy = y0 + h / 2;
  const panel = (mesh, f) => { mesh.userData.panel = f; rig.panels[f].push(mesh); return mesh; };
  mk(GEO.cyl(0.5, 0.6, 0.35, 10), M.joint, 0, 0.1, 0, g);
  if (T.id === 't_brl') {
    mk(GEO.cyl(w / 2, w / 2, h, 10), M.secondary, 0, cy, 0, g);
    mk(GEO.torus(w / 2 + 0.02, 0.08, 20), M.accent, 0, y0 + 0.2, 0, g, { rx: Math.PI / 2 });
    mk(GEO.torus(w / 2 + 0.02, 0.08, 20), M.accent, 0, y0 + h - 0.2, 0, g, { rx: Math.PI / 2 });
    panel(mk(GEO.box(w * 0.7, h * 0.55, 0.2), M.primary, 0, y0 + h * 0.55, d / 2 - 0.02, g), 'f');
    panel(mk(GEO.box(0.2, h * 0.6, w * 0.6), M.primary, w / 2 - 0.02, cy, 0, g), 'l');
    panel(mk(GEO.box(0.2, h * 0.6, w * 0.6), M.primary, -w / 2 + 0.02, cy, 0, g), 'r');
    panel(mk(GEO.box(w * 0.6, h * 0.6, 0.2), M.primary, 0, cy, -d / 2 + 0.02, g), 'b');
    panel(mk(GEO.cyl(w / 2 - 0.1, w / 2, 0.16, 10), M.primary, 0, y0 + h + 0.08, 0, g), 't');
  } else if (T.id === 't_wdg') {
    mk(GEO.box(w * 0.92, h, d * 0.72), M.secondary, 0, cy, -d * 0.12, g);
    panel(mk(GEO.box(w * 0.88, h * 0.6, 0.18), M.primary, 0, y0 + h * 0.72, d * 0.3, g, { rx: -0.55 }), 'f');
    panel(mk(GEO.box(w * 0.8, h * 0.55, 0.18), M.primary, 0, y0 + h * 0.28, d * 0.3, g, { rx: 0.55 }), 'f');
    mk(GEO.box(w * 0.9, 0.12, 0.12), M.accent, 0, y0 + h * 0.5, d * 0.45, g);
    panel(mk(GEO.box(0.16, h * 0.8, d * 0.7), M.primary, w * 0.47, cy, -0.05, g), 'l');
    panel(mk(GEO.box(0.16, h * 0.8, d * 0.7), M.primary, -w * 0.47, cy, -0.05, g), 'r');
    panel(mk(GEO.box(w * 0.8, h * 0.7, 0.16), M.secondary, 0, cy, -d / 2 + 0.02, g), 'b');
    panel(mk(GEO.box(w * 0.85, 0.16, d * 0.6), M.primary, 0, y0 + h + 0.06, -0.15, g), 't');
  } else {
    const fort = T.id === 't_frt', spine = T.id === 't_spn';
    mk(GEO.box(w, h, d), M.secondary, 0, cy, 0, g);
    panel(mk(GEO.box(w * 0.86, h * 0.44, 0.16), M.primary, 0, y0 + h * 0.64, d / 2 + 0.07, g), 'f');
    panel(mk(GEO.box(w * 0.7, h * 0.3, 0.14), M.primary, 0, y0 + h * 0.24, d / 2 + 0.06, g), 'f');
    panel(mk(GEO.box(0.16, h * 0.72, d * 0.8), M.primary, w / 2 + 0.07, y0 + h * 0.55, 0, g), 'l');
    panel(mk(GEO.box(0.16, h * 0.72, d * 0.8), M.primary, -w / 2 - 0.07, y0 + h * 0.55, 0, g), 'r');
    panel(mk(GEO.box(w * 0.8, h * 0.62, 0.16), M.primary, 0, y0 + h * 0.5, -d / 2 - 0.07, g), 'b');
    panel(mk(GEO.box(w * 0.86, 0.16, d * 0.7), M.primary, 0, y0 + h + 0.07, -0.1, g), 't');
    if (fort) {
      for (const sx of [1, -1]) for (const sz of [1, -1]) mk(GEO.box(0.42, h + 0.2, 0.42), M.accent, sx * (w / 2 - 0.05), cy, sz * (d / 2 - 0.05), g);
      for (let i = -1; i <= 1; i++) mk(GEO.box(0.4, 0.3, 0.4), M.secondary, i * 0.8, y0 + h + 0.3, -d * 0.3, g);
    }
    if (spine) for (let i = 0; i < 3; i++) mk(GEO.box(0.22, 0.42, 0.3), M.accent, 0, y0 + 0.4 + i * 0.6, -d / 2 - 0.2, g);
  }
  // cockpit and vents
  const front = T.id === 't_wdg' ? d * 0.42 : d / 2;
  mk(GEO.box(w * 0.42, 0.16, 0.06), M.glow, 0, y0 + h * 0.86, front + 0.14, g, { shadow: false });
  mk(GEO.box(0.42, 0.12, 0.06), M.vent, w * 0.28, y0 + 0.14, front + 0.12, g, { shadow: false });
  mk(GEO.box(0.42, 0.12, 0.06), M.vent, -w * 0.28, y0 + 0.14, front + 0.12, g, { shadow: false });
  // reactor glow
  const rcol = { r_emb: 0xffb000, r_cld: 0x5fe9ff, r_frg: 0xff7a1a, r_ovd: 0xff3030, r_sun: 0xfff0a0 }[R.id] || 0xffb000;
  const rm = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: rcol, emissiveIntensity: 2.2 });
  rig.mats.reactor = rm;
  mk(GEO.box(0.5, 0.3, 0.08), rm, 0, y0 + h * 0.18, -d / 2 - 0.12, g, { shadow: false });
  // name plate on back
  mk(GEO.plane(Math.min(1.6, w * 0.7), 0.36), M.name, 0, y0 + h * 0.62, -d / 2 - 0.165, g, { ry: Math.PI, shadow: false });
  // mounting points
  anchor(g, 'tf1', 0, y0 + h * 0.62, front + 0.17, 0, 0, 1);
  anchor(g, 'tf2', 0, y0 + h * 0.26, front + 0.15, 0, 0, 1);
  anchor(g, 'tsL', w / 2 + 0.16, y0 + h * 0.42, 0, 1, 0, 0);
  anchor(g, 'tsR', -w / 2 - 0.16, y0 + h * 0.42, 0, -1, 0, 0);
  anchor(g, 'spL', w / 2 - 0.1, y0 + h + 0.12, d * 0.25, 0.6, 1, 0);
  anchor(g, 'spR', -w / 2 + 0.1, y0 + h + 0.12, d * 0.25, -0.6, 1, 0);
  anchor(g, 'tb', 0, y0 + h * 0.28, -d / 2 - 0.16, 0, 0, -1);
  anchor(g, 'tt', 0, y0 + h + 0.16, -d * 0.12, 0, 1, 0);
  return {
    head: { x: 0, y: y0 + h, z: d * 0.1 },
    shoulder: { x: w / 2 + 0.35, y: y0 + h * 0.8, z: 0 },
    shMount: { x: w * 0.32, y: y0 + h + 0.05, z: -0.1 },
    back: { x: 0, y: y0 + h * 0.62, z: -d / 2 - 0.25 },
  };
}

// ---------- HEAD ----------
function buildHead(g, M, H) {
  mk(GEO.cyl(0.22, 0.26, 0.25, 8), M.joint, 0, 0.1, 0, g);
  if (H.id === 'h_crn') {
    mk(GEO.cyl(0.5, 0.55, 0.3, 12), M.secondary, 0, 0.3, 0, g);
    mk(GEO.hemi(0.52), M.primary, 0, 0.44, 0, g);
    mk(GEO.box(0.55, 0.07, 0.1), M.glow, 0, 0.5, 0.48, g, { shadow: false });
  } else if (H.id === 'h_hwk') {
    mk(GEO.box(0.62, 0.46, 0.66), M.secondary, 0, 0.42, 0, g);
    mk(GEO.box(0.5, 0.12, 0.06), M.glow, 0, 0.46, 0.34, g, { shadow: false });
    const dish = grp(g, 0.42, 0.62, -0.05); dish.rotation.set(-0.3, 0.6, 0);
    mk(GEO.cyl(0.32, 0.12, 0.12, 12), M.chrome, 0, 0, 0, dish, { rx: Math.PI / 2 });
    mk(GEO.cyl(0.025, 0.025, 1.1, 5), M.metal, -0.24, 1.0, -0.12, g);
    mk(GEO.sph(0.06, 6, 4), M.glow, -0.24, 1.55, -0.12, g, { shadow: false });
  } else if (H.id === 'h_wsc') {
    mk(GEO.box(1.25, 0.36, 0.58), M.secondary, 0, 0.35, 0, g);
    mk(GEO.box(1.3, 0.08, 0.62), M.accent, 0, 0.55, 0, g);
    for (const x of [-0.38, 0, 0.38]) mk(GEO.cyl(0.1, 0.1, 0.08, 10), M.lens, x, 0.36, 0.31, g, { rx: Math.PI / 2, shadow: false });
  } else {
    mk(GEO.box(0.75, 0.5, 0.72), M.secondary, 0, 0.42, 0, g);
    mk(GEO.box(0.58, 0.12, 0.06), M.glow, 0, 0.47, 0.37, g, { shadow: false });
    mk(GEO.box(0.06, 0.4, 0.06), M.metal, 0.28, 0.85, -0.2, g);
  }
}

// ---------- WEAPONS (built along +Z, base at origin) ----------
function buildWeapon(g, p, M, side, mounted) {
  const out = { g, muzzle: null, spin: null };
  const muzzle = (z, y = 0, x = 0) => { out.muzzle = grp(g, x, y, z); };
  const barrel = (r, len, z, mat = M.metal, x = 0, y = 0) => mk(GEO.cyl(r, r, len, 10), mat, x, y, z + len / 2, g, { rx: Math.PI / 2 });
  switch (p.model) {
    case 'lac':
      mk(GEO.box(0.38, 0.38, 0.8), M.secondary, 0, 0, 0.3, g); barrel(0.07, 1.0, 0.65); mk(GEO.box(0.12, 0.2, 0.3), M.accent, 0, 0.25, 0.2, g); muzzle(1.7); break;
    case 'ac':
      mk(GEO.box(0.5, 0.56, 1.0), M.primary, 0, 0, 0.35, g); barrel(0.11, 1.4, 0.8); mk(GEO.box(0.26, 0.26, 0.26), M.dark, 0, 0, 2.15, g);
      mk(GEO.cyl(0.24, 0.24, 0.32, 10), M.secondary, 0, -0.38, 0.3, g, { rz: Math.PI / 2 }); muzzle(2.3); break;
    case 'hac':
      mk(GEO.box(0.72, 0.72, 1.3), M.primary, 0, 0, 0.4, g); barrel(0.17, 1.9, 1.0); mk(GEO.box(0.4, 0.4, 0.36), M.dark, 0, 0, 2.95, g);
      mk(GEO.box(0.2, 0.3, 1.0), M.accent, 0, 0.45, 0.4, g); muzzle(3.15); break;
    case 'gat': {
      mk(GEO.cyl(0.3, 0.3, 0.7, 12), M.secondary, 0, 0, 0.3, g, { rx: Math.PI / 2 });
      const sp = grp(g, 0, 0, 0.65);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; mk(GEO.cyl(0.055, 0.055, 1.1, 6), M.metal, Math.cos(a) * 0.16, Math.sin(a) * 0.16, 0.55, sp, { rx: Math.PI / 2 }); }
      mk(GEO.torus(0.2, 0.04, 12), M.dark, 0, 0, 1.0, sp);
      out.spin = sp; muzzle(1.8); break;
    }
    case 'sgc':
      mk(GEO.box(0.72, 0.46, 0.9), M.primary, 0, 0, 0.35, g); barrel(0.14, 0.7, 0.75, M.dark, 0.17); barrel(0.14, 0.7, 0.75, M.dark, -0.17);
      mk(GEO.box(0.8, 0.1, 0.3), M.accent, 0, 0.28, 0.1, g); muzzle(1.5); break;
    case 'rail': case 'ndl': {
      const big = p.model === 'rail', L = big ? 2.6 : 1.6, sp = big ? 0.17 : 0.11;
      mk(GEO.box(big ? 0.46 : 0.32, big ? 0.52 : 0.36, big ? 1.0 : 0.7), M.secondary, 0, 0, 0.2, g);
      mk(GEO.box(big ? 0.1 : 0.07, big ? 0.2 : 0.13, L), M.metal, sp, 0, 0.6 + L / 2, g);
      mk(GEO.box(big ? 0.1 : 0.07, big ? 0.2 : 0.13, L), M.metal, -sp, 0, 0.6 + L / 2, g);
      const n = big ? 5 : 3;
      for (let i = 0; i < n; i++) mk(GEO.box(sp * 1.6, big ? 0.12 : 0.08, 0.12), M.lens, 0, 0, 0.8 + (i / n) * L * 0.85, g, { shadow: false });
      muzzle(0.65 + L); break;
    }
    case 'mlas':
      mk(GEO.box(0.3, 0.3, 0.55), M.secondary, 0, 0, 0.25, g); mk(GEO.cyl(0.09, 0.09, 0.08, 10), M.lens, 0, 0, 0.56, g, { rx: Math.PI / 2, shadow: false }); muzzle(0.66); break;
    case 'plas':
      mk(GEO.box(0.42, 0.42, 0.8), M.primary, 0, 0, 0.3, g); barrel(0.1, 0.6, 0.7);
      for (let i = 0; i < 3; i++) mk(GEO.torus(0.14, 0.035, 12), M.lens, 0, 0, 0.82 + i * 0.16, g, { shadow: false });
      muzzle(1.35); break;
    case 'beam': case 'sol': {
      const big = p.model === 'sol', r = big ? 0.3 : 0.2, L = big ? 2.2 : 1.6;
      barrel(r, L, 0, M.secondary);
      const nf = big ? 6 : 4;
      for (let i = 0; i < nf; i++) mk(GEO.box(r * 3, 0.05, 0.22), M.metal, 0, 0, 0.3 + i * (L * 0.6 / nf), g);
      mk(GEO.cyl(r * 0.78, r * 0.78, 0.1, 12), M.lens, 0, 0, L + 0.03, g, { rx: Math.PI / 2, shadow: false });
      mk(GEO.box(0.16, r * 1.4, 0.6), M.accent, 0, r, L * 0.3, g);
      muzzle(L + 0.12); break;
    }
    case 'plz':
      mk(GEO.sph(0.38, 12, 10), M.plasma, 0, 0, 0.3, g, { shadow: false }); mk(GEO.box(0.5, 0.2, 0.7), M.secondary, 0, -0.32, 0.3, g);
      mk(GEO.cone(0.22, 0.6, 10), M.metal, 0, 0, 0.92, g, { rx: Math.PI / 2 }); muzzle(1.25); break;
    case 'flm':
      barrel(0.1, 0.9, 0.25); mk(GEO.cyl(0.2, 0.2, 0.8, 10), M.accent, 0, -0.28, 0.35, g, { rx: Math.PI / 2 });
      mk(GEO.sph(0.07, 6, 4), M.fire, 0, 0.08, 1.15, g, { shadow: false }); muzzle(1.2); break;
    case 'srm': case 'swm': {
      const n = p.model === 'srm' ? 2 : 3, W = n * 0.3 + 0.1;
      mk(GEO.box(W, W * 0.85, 0.6), M.primary, 0, 0, 0.2, g);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) mk(GEO.cyl(0.09, 0.09, 0.06, 8), M.dark, (i - (n - 1) / 2) * 0.28, (j - (n - 1) / 2) * 0.24, 0.51, g, { rx: Math.PI / 2, shadow: false });
      mk(GEO.box(W + 0.04, 0.08, 0.62), M.accent, 0, W * 0.43, 0.2, g);
      muzzle(0.6); break;
    }
    case 'lrm': {
      const h = grp(g, 0, 0, 0); h.rotation.x = -0.25;
      mk(GEO.box(1.05, 0.72, 0.9), M.primary, 0, 0, 0.2, h);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) mk(GEO.cyl(0.11, 0.11, 0.06, 8), M.dark, (i - 1) * 0.3, (j - 0.5) * 0.3, 0.66, h, { rx: Math.PI / 2, shadow: false });
      mk(GEO.box(1.1, 0.08, 0.92), M.accent, 0, 0.4, 0.2, h);
      out.muzzle = grp(h, 0, 0, 0.7); break;
    }
    case 'art': {
      mk(GEO.box(0.85, 0.5, 1.1), M.secondary, 0, 0, 0, g);
      const h = grp(g, 0, 0.2, 0); h.rotation.x = -0.45;
      mk(GEO.box(0.5, 0.5, 0.7), M.primary, 0, 0, 0.1, h);
      mk(GEO.cyl(0.18, 0.2, 3.1, 10), M.metal, 0, 0, 1.9, h, { rx: Math.PI / 2 });
      mk(GEO.box(0.38, 0.38, 0.3), M.dark, 0, 0, 3.4, h);
      out.muzzle = grp(h, 0, 0, 3.6); break;
    }
    case 'mor': {
      const h = grp(g, 0, 0, 0); h.rotation.x = -0.8;
      mk(GEO.box(0.5, 0.4, 0.5), M.secondary, 0, 0, 0, h);
      mk(GEO.cyl(0.24, 0.27, 1.0, 10), M.metal, 0, 0, 0.6, h, { rx: Math.PI / 2 });
      out.muzzle = grp(h, 0, 0, 1.15); break;
    }
    case 'bld':
      mk(GEO.box(0.42, 0.42, 0.6), M.secondary, 0, 0, 0.25, g);
      mk(GEO.box(0.08, 0.38, 2.1), M.chrome, 0, 0, 1.55, g);
      mk(GEO.box(0.03, 0.08, 2.0), M.glow, 0, -0.2, 1.55, g, { shadow: false });
      muzzle(2.4); break;
    case 'fst':
      mk(GEO.box(0.56, 0.56, 0.8), M.secondary, 0, 0, 0.35, g);
      mk(GEO.box(0.78, 0.72, 0.6), M.primary, 0, 0, 1.05, g);
      for (let i = 0; i < 4; i++) mk(GEO.box(0.15, 0.2, 0.25), M.joint, (i - 1.5) * 0.18, 0.18, 1.42, g);
      mk(GEO.cyl(0.06, 0.06, 0.9, 6), M.chrome, 0.32, 0, 0.5, g, { rx: Math.PI / 2 });
      mk(GEO.cyl(0.06, 0.06, 0.9, 6), M.chrome, -0.32, 0, 0.5, g, { rx: Math.PI / 2 });
      muzzle(1.45); break;
    case 'shd': case 'tsh': {
      const big = p.model === 'tsh', W = big ? 1.9 : 1.5, Hh = big ? 2.9 : 2.2;
      const sg = grp(g, side * 0.05, 0.25, 0.65);
      mk(GEO.box(W, Hh, big ? 0.3 : 0.22), M.primary, 0, 0, 0, sg);
      mk(GEO.box(W * 0.95, 0.14, (big ? 0.3 : 0.22) + 0.04), M.accent, 0, Hh * 0.3, 0, sg);
      mk(GEO.box(0.2, Hh * 0.9, 0.1), M.secondary, 0, 0, 0.15, sg);
      out.g = sg; muzzle(0.8); break;
    }
    default:
      mk(GEO.box(0.4, 0.4, 0.8), M.secondary, 0, 0, 0.3, g); muzzle(0.8);
  }
  if (!out.muzzle) muzzle(1);
  return out;
}

function buildBackSystem(rig, g, M, p) {
  if (p.model === 'jj') {
    mk(GEO.box(1.3, 0.85, 0.45), M.secondary, 0, 0, 0, g);
    for (const x of [-0.42, 0.42]) {
      mk(GEO.cyl(0.18, 0.26, 0.6, 10), M.metal, x, -0.6, -0.05, g);
      const f = mk(GEO.cone(0.22, 1.4, 10), M.flame, x, -1.6, -0.05, g, { rx: Math.PI, shadow: false });
      f.visible = false; rig.jets.push(f);
    }
  } else if (p.model === 'bst') {
    mk(GEO.box(1.1, 0.6, 0.5), M.secondary, 0, 0, 0, g);
    for (const x of [-0.35, 0.35]) {
      mk(GEO.cyl(0.16, 0.24, 0.5, 10), M.metal, x, 0, -0.4, g, { rx: Math.PI / 2 });
      const f = mk(GEO.cone(0.2, 1.3, 10), M.flame, x, 0, -1.25, g, { rx: -Math.PI / 2, shadow: false });
      f.visible = false; rig.boosts.push(f);
    }
  } else if (p.model === 'drn') {
    mk(GEO.box(1.1, 0.65, 0.55), M.secondary, 0, 0, 0, g);
    mk(GEO.box(0.9, 0.1, 0.5), M.accent, 0, 0.36, 0, g);
    for (const x of [-0.6, 0.6]) {
      const dr = grp(g, x, 1.2, -0.3);
      mk(GEO.sph(0.18, 8, 6), M.metal, 0, 0, 0, dr);
      mk(GEO.box(0.6, 0.03, 0.08), M.joint, 0, 0.12, 0, dr);
      mk(GEO.sph(0.06, 6, 4), M.lens, 0, -0.1, 0.12, dr, { shadow: false });
      rig.drones.push({ g: dr, x, base: 1.2 });
    }
  } else if (p.model === 'rad') {
    for (let i = 0; i < 5; i++) mk(GEO.box(0.06, 1.15, 0.6), M.metal, (i - 2) * 0.22, 0.1, 0, g);
    mk(GEO.box(1.0, 0.12, 0.5), M.vent, 0, -0.5, 0, g, { shadow: false });
  } else mk(GEO.box(0.8, 0.6, 0.4), M.secondary, 0, 0, 0, g);
}

function buildPlate(g, M, p) {
  switch (p.id) {
    case 'p_lgt': mk(GEO.box(0.9, 0.7, 0.1), M.primary, 0, 0, 0.05, g); break;
    case 'p_hvy':
      mk(GEO.box(1.05, 0.85, 0.2), M.secondary, 0, 0, 0.1, g);
      for (const x of [-0.4, 0.4]) for (const y of [-0.3, 0.3]) mk(GEO.cyl(0.05, 0.05, 0.06, 6), M.chrome, x, y, 0.22, g, { rx: Math.PI / 2, shadow: false });
      break;
    case 'p_slp': mk(GEO.box(1.0, 0.82, 0.15), M.primary, 0, 0, 0.12, g, { rx: 0.35 }); mk(GEO.box(1.02, 0.08, 0.17), M.accent, 0, 0.36, 0.25, g, { rx: 0.35 }); break;
    case 'p_spc':
      mk(GEO.box(0.95, 0.75, 0.07), M.secondary, 0, 0, 0.04, g); mk(GEO.box(0.95, 0.75, 0.07), M.primary, 0, 0, 0.3, g);
      for (const x of [-0.35, 0.35]) mk(GEO.cyl(0.04, 0.04, 0.25, 5), M.metal, x, 0, 0.17, g, { rx: Math.PI / 2 });
      break;
    case 'p_blk': mk(GEO.box(1.3, 1.0, 0.32), M.secondary, 0, 0, 0.16, g); mk(GEO.box(1.32, 0.12, 0.34), M.accent, 0, 0.25, 0.16, g); break;
    case 'm_fin': for (let i = 0; i < 4; i++) mk(GEO.box(0.05, 0.55, 0.36), M.metal, (i - 1.5) * 0.15, 0, 0.18, g); mk(GEO.box(0.55, 0.06, 0.1), M.vent, 0, -0.3, 0.05, g, { shadow: false }); break;
    case 'm_flr': mk(GEO.box(0.42, 0.3, 0.3), M.secondary, 0, 0, 0.15, g); for (let i = 0; i < 3; i++) mk(GEO.cyl(0.05, 0.05, 0.1, 6), M.dark, (i - 1) * 0.12, 0, 0.32, g, { rx: Math.PI / 2 }); break;
    case 'm_spk': mk(GEO.cyl(0.03, 0.05, 0.9, 5), M.metal, 0, 0.3, 0.2, g, { rx: 0.4 }); mk(GEO.sph(0.06, 6, 4), M.glow, 0, 0.72, 0.38, g, { shadow: false }); break;
    case 'm_pch': mk(GEO.box(0.45, 0.36, 0.3), M.rubber, 0, 0, 0.15, g); mk(GEO.box(0.47, 0.06, 0.32), M.accent, 0, 0.08, 0.15, g); break;
    case 'm_lmp': mk(GEO.cyl(0.15, 0.15, 0.22, 10), M.secondary, 0, 0, 0.12, g, { rx: Math.PI / 2 }); mk(GEO.cyl(0.12, 0.12, 0.03, 10), M.lamp, 0, 0, 0.24, g, { rx: Math.PI / 2, shadow: false }); break;
    case 'm_bat': mk(GEO.box(0.42, 0.3, 0.26), M.secondary, 0, 0, 0.13, g); mk(GEO.box(0.3, 0.05, 0.03), M.lens, 0, 0.05, 0.27, g, { shadow: false }); break;
    default: mk(GEO.box(0.5, 0.5, 0.1), M.primary, 0, 0, 0.05, g);
  }
}

// ---------- ANIMATION ----------
// st: { spd (0..1 forward speed ratio, negative for reverse), turn, torsoYaw, pitch, heat, jumping, boosting, firing:{slot:t}, dead, t }
function animateRig(rig, st, dt) {
  const a = rig.anim;
  const sp = st.spd || 0;
  const speedAbs = Math.abs(sp);
  a.phase += (st.stride || 0) * dt;
  const ph = a.phase;
  if (rig.legType === 'biped') {
    const A = 0.5 * Math.min(1, speedAbs * 1.3 + Math.abs(st.turn || 0) * 0.3);
    const baseH = rig.rev ? -0.45 : -0.12, baseK = rig.rev ? 1.0 : 0.25, baseA = rig.rev ? -0.55 : -0.13;
    [['legL', 0], ['legR', Math.PI]].forEach(([k, off]) => {
      const L = rig.legs[k];
      if (!L) return;
      const s = Math.sin(ph + off), c = Math.cos(ph + off);
      const hipA = baseH + A * s;
      const kneeA = baseK + A * 1.1 * Math.max(0, c) * (rig.rev ? -0.6 : 1);
      L.hip.rotation.x = L.lost ? 0.5 : hipA;
      L.knee.rotation.x = kneeA;
      L.ankle.rotation.x = baseA - (hipA - baseH) - (kneeA - baseK) * 0.9;
    });
    a.bob = Math.abs(Math.cos(ph)) * 0.12 * Math.min(1, speedAbs * 1.5);
  } else if (rig.legType === 'quad' && rig.quad) {
    const A = 0.3 * Math.min(1, speedAbs * 1.4 + Math.abs(st.turn || 0) * 0.3);
    for (const q of rig.quad) {
      const off = q.pair ? Math.PI : 0;
      q.lp.rotation.y = q.baseY + A * Math.sin(ph + off);
      q.th.rotation.x = -0.5 - A * 0.9 * Math.max(0, Math.cos(ph + off));
      q.kn.rotation.x = 0.5 + A * 0.5 * Math.max(0, Math.cos(ph + off));
    }
    a.bob = Math.abs(Math.sin(ph * 2)) * 0.05 * Math.min(1, speedAbs * 1.5);
  } else if (rig.legType === 'tracked') {
    a.wheel += (st.vel || 0) * dt * 2.5;
    if (rig.wheels) for (const w of rig.wheels) w.rotation.x = a.wheel;
    a.bob = Math.sin(st.t * 30) * 0.015 * speedAbs;
  } else if (rig.hover) {
    a.bob = Math.sin(st.t * 2.2) * 0.12 + 0.05;
    rig.hover.rotation.z = -(st.strafe || 0) * 0.12;
    rig.hover.rotation.x = sp * 0.08;
  }
  rig.tilt.position.y = a.bob + (rig.hover ? a.bob * 0.5 : 0);
  // torso
  rig.torsoPivot.rotation.y = st.torsoYaw || 0;
  // arms pitch + recoil + melee swing
  for (const k of ['armL', 'armR']) {
    const arm = rig.arms[k];
    if (!arm) continue;
    let px = -(st.pitch || 0);
    const sw = a.swing[k];
    if (sw > 0) { a.swing[k] = Math.max(0, sw - dt * 2.4); const t = 1 - a.swing[k]; px += t < 0.4 ? -1.4 * (t / 0.4) : -1.4 + 2.0 * Math.min(1, (t - 0.4) / 0.25) * (1 - Math.max(0, t - 0.65) / 0.35); }
    arm.pivot.rotation.x = px;
    const rc = a.recoil[k] || 0;
    if (rc > 0) a.recoil[k] = Math.max(0, rc - dt * 6);
    if (arm.wg) arm.wg.position.z = 0.12 - rc * 0.35;
  }
  for (const k in rig.spinners) {
    a['sp' + k] = (a['sp' + k] || 0) * Math.exp(-dt * 1.5) + (st.firing && st.firing[k] ? 30 : 0) * dt;
    rig.spinners[k].rotation.z += a['sp' + k] * dt * 4;
  }
  // jets
  const jt = !!st.jumping, bt = !!st.boosting;
  for (const f of rig.jets) { f.visible = jt; if (jt) f.scale.set(1, 0.8 + Math.random() * 0.5, 1); }
  for (const f of rig.boosts) { f.visible = bt; if (bt) f.scale.set(1, 0.8 + Math.random() * 0.6, 1); }
  for (const dr of rig.drones) {
    if (!dr.g.parent) continue;
    dr.g.position.y = dr.base + Math.sin(st.t * 3 + dr.x * 4) * 0.15;
    dr.g.rotation.y += dt * 6;
  }
  // heat glow
  const h = clamp(st.heat || 0, 0, 1.3);
  const M = rig.mats;
  if (!st.dead) {
    M.vent.emissiveIntensity = 0.12 + h * h * 3.5;
    const e = Math.max(0, h - 0.45) / 0.55;
    M.primary.emissive.setRGB(e * e * 0.55, e * e * 0.14, 0);
    M.secondary.emissive.setRGB(e * e * 0.45, e * e * 0.1, 0);
    M.joint.emissive.setRGB(e * 0.6, e * 0.16, 0);
  }
}

function charMech(rig) {
  const M = rig.mats;
  for (const k of ['primary', 'secondary', 'accent', 'joint', 'metal']) {
    M[k].color.setHex(k === 'primary' ? 0x3a332e : 0x1e1a17);
    M[k].emissive.setRGB(0.08, 0.02, 0);
    M[k].roughness = 0.95;
  }
  M.glow.emissiveIntensity = 0; M.lens.emissiveIntensity = 0.1; M.vent.emissiveIntensity = 1.2;
  if (M.reactor) M.reactor.emissiveIntensity = 0;
}

function disposeMech(rig) {
  if (!rig) return;
  if (rig.root.parent) rig.root.parent.remove(rig.root);
  for (const k in rig.mats) {
    const m = rig.mats[k];
    if (m && m.dispose && m !== MAT.dark && m !== MAT.rubber && m !== MAT.chrome) m.dispose();
  }
}
