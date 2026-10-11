// =====================================================================
// 07 | RENDERING | ARENAS AND HANGAR SCENES
// =====================================================================
function skyDome(top, bottom) {
  const geo = new THREE.SphereGeometry(700, 24, 12);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, bottom: { value: new THREE.Color(bottom) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y*1.6+0.08,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, pow(h,0.7)),1.0); }',
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = -10;
  return m;
}

function arenaMaterials(map) {
  const k = map.id;
  const ground = noiseTex('ground' + k, map.ground, map.ground2, 512, [map.hx / 6, map.hz / 6], (g, w, h, r) => {
    if (k === 'ruins') { g.fillStyle = 'rgba(230,220,180,0.35)'; for (let i = 0; i < 4; i++) g.fillRect(0, i * 128 + 60, w, 4); g.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 30; i++) g.fillRect(r() * w, r() * h, 3 + r() * 40, 2); }
    if (k === 'yard') { g.fillStyle = 'rgba(255,190,40,0.55)'; g.fillRect(0, 250, w, 6); g.fillRect(250, 0, 6, h); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; for (let i = 0; i < 8; i++) g.strokeRect(i * 64, 0, 64, h); }
    if (k === 'pad') { g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 2; for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); } }
    if (k === 'canyon' || k === 'field') { g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1.5; for (let i = 0; i < 20; i++) { g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y); for (let j = 0; j < 5; j++) { x += (r() - 0.5) * 60; y += (r() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); } }
  });
  const rockCol = { field: '#8a7656', ruins: '#6d6a66', canyon: '#8d4b31', yard: '#6f6c66', pad: '#77797d' }[k] || '#777';
  return {
    ground: new THREE.MeshStandardMaterial({ map: ground, roughness: 0.95, metalness: 0.02 }),
    rock: new THREE.MeshStandardMaterial({ color: rockCol, roughness: 0.92, flatShading: true }),
    rock2: new THREE.MeshStandardMaterial({ color: shade(rockCol, -0.18), roughness: 0.95, flatShading: true }),
    concrete: new THREE.MeshStandardMaterial({ map: noiseTex('concrete', '#8b8a86', '#5a5955', 256, [2, 2]), roughness: 0.9 }),
    building: new THREE.MeshStandardMaterial({
      map: canvasTex('bldg', 128, 256, (g, w, h) => {
        g.fillStyle = '#76736d'; g.fillRect(0, 0, w, h);
        const r = mulberry32(7);
        for (let y = 10; y < h - 10; y += 30) for (let x = 10; x < w - 10; x += 28) { g.fillStyle = r() < 0.3 ? '#1b1c1e' : '#2c2f33'; g.fillRect(x, y, 16, 18); }
        g.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 40; i++) g.fillRect(r() * w, r() * h, r() * 20, r() * 30);
      }), roughness: 0.9,
    }),
    containerRib: canvasTex('ribs', 128, 64, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,0.22)'; for (let x = 0; x < w; x += 8) g.fillRect(x, 0, 3, h); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, 0, w, 4); g.fillRect(0, h - 4, w, 4); }),
    tank: new THREE.MeshStandardMaterial({ color: 0xc9c4b8, metalness: 0.2, roughness: 0.5 }),
    stripe: new THREE.MeshStandardMaterial({ map: stripeTex('#ffb000', '#1a1c20'), roughness: 0.7 }),
    pipe: new THREE.MeshStandardMaterial({ color: 0x8a5a2a, metalness: 0.2, roughness: 0.5 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x5a6069, metalness: 0.3, roughness: 0.5 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff0c0, emissiveIntensity: 2 }),
    crowd: new THREE.MeshStandardMaterial({
      map: canvasTex('crowd', 256, 64, (g, w, h) => {
        g.fillStyle = '#2a2c30'; g.fillRect(0, 0, w, h);
        const r = mulberry32(3);
        for (let i = 0; i < 420; i++) { g.fillStyle = 'hsl(' + Math.floor(r() * 360) + ',40%,' + Math.floor(30 + r() * 40) + '%)'; g.fillRect(r() * w, r() * h, 3, 4); }
      }, [6, 1]), roughness: 1,
    }),
  };
}

function obstacleMesh(o, M) {
  const g = new THREE.Group();
  g.position.set(o.x, 0, o.z);
  const r = mulberry32(hashStr(o.x.toFixed(2) + o.z.toFixed(2)));
  switch (o.style) {
    case 'rock': {
      const m = mk(GEO.dodec(1), r() < 0.5 ? M.rock : M.rock2, 0, o.h * 0.42, 0, g, { receive: true });
      m.scale.set(o.r * 1.05, o.h * 0.58, o.r * 1.05); m.rotation.set(r(), r() * 6, r() * 0.3);
      const m2 = mk(GEO.dodec(1), M.rock2, o.r * 0.5, o.h * 0.2, -o.r * 0.3, g);
      m2.scale.set(o.r * 0.55, o.h * 0.3, o.r * 0.5);
      break;
    }
    case 'ridge': case 'rubble': {
      const n = o.style === 'rubble' ? 4 : 3;
      for (let i = 0; i < n; i++) {
        const m = mk(GEO.box(1, 1, 1), i % 2 ? M.rock : M.rock2, (r() - 0.5) * o.w * 0.4, o.h * (0.35 + r() * 0.15), (r() - 0.5) * o.d * 0.4, g, { receive: true });
        m.scale.set(o.w * (0.55 + r() * 0.45), o.h * (0.7 + r() * 0.4), o.d * (0.6 + r() * 0.4)); m.rotation.set((r() - 0.5) * 0.3, (r() - 0.5) * 0.3, (r() - 0.5) * 0.3);
      }
      break;
    }
    case 'ruin': {
      mk(GEO.box(o.w, o.h, o.d), M.building, 0, o.h / 2, 0, g, { receive: true });
      for (let i = 0; i < 3; i++) {
        const m = mk(GEO.box(o.w * (0.2 + r() * 0.3), 1 + r() * 2.5, o.d * (0.2 + r() * 0.3)), M.concrete, (r() - 0.5) * o.w * 0.6, o.h + 0.5, (r() - 0.5) * o.d * 0.6, g);
        m.rotation.set((r() - 0.5) * 0.4, r(), (r() - 0.5) * 0.4);
      }
      mk(GEO.box(o.w + 0.3, 0.4, o.d + 0.3), M.concrete, 0, o.h * 0.5, 0, g);
      break;
    }
    case 'fountain':
      mk(GEO.cyl(o.r, o.r + 0.4, 1.2, 16), M.concrete, 0, 0.6, 0, g, { receive: true });
      mk(GEO.cyl(0.8, 1, o.h, 10), M.concrete, 0, o.h / 2, 0, g);
      mk(GEO.sph(1.1, 10, 8), M.steel, 0, o.h + 0.6, 0, g);
      break;
    case 'mesa':
      mk(GEO.cyl(o.r * 0.85, o.r, o.h * 0.6, 7), M.rock, 0, o.h * 0.3, 0, g, { receive: true });
      mk(GEO.cyl(o.r * 0.62, o.r * 0.82, o.h * 0.42, 7), M.rock2, 0, o.h * 0.79, 0, g, { ry: 0.4, receive: true });
      break;
    case 'container': {
      const stacks = Math.round(o.h / 2.8);
      for (let i = 0; i < stacks; i++) {
        const mat = new THREE.MeshStandardMaterial({ color: i ? shade(o.color, 0.12) : o.color, map: M.containerRib, roughness: 0.7, metalness: 0.3 });
        mk(GEO.box(o.w - 0.05, 2.75, o.d - 0.05), mat, 0, 1.4 + i * 2.8, 0, g, { receive: true });
      }
      break;
    }
    case 'tank':
      mk(GEO.cyl(o.r, o.r, o.h, 18), M.tank, 0, o.h / 2, 0, g, { receive: true });
      mk(GEO.hemi(o.r), M.tank, 0, o.h, 0, g, { s: 1 });
      mk(GEO.cyl(o.r + 0.05, o.r + 0.05, 0.5, 18), M.stripe, 0, o.h * 0.35, 0, g);
      mk(GEO.box(0.3, o.h, 0.3), M.steel, o.r, o.h / 2, 0, g);
      break;
    case 'pipes': {
      const horiz = o.w > o.d, L = Math.max(o.w, o.d);
      for (const off of [-0.35, 0.35]) mk(GEO.cyl(0.32, 0.32, L, 10), M.pipe, horiz ? 0 : off, o.h - 0.4, horiz ? off : 0, g, horiz ? { rz: Math.PI / 2 } : { rx: Math.PI / 2 });
      for (let i = -1; i <= 1; i++) mk(GEO.box(horiz ? 0.25 : 1.3, o.h, horiz ? 1.3 : 0.25), M.steel, horiz ? i * L * 0.4 : 0, o.h / 2, horiz ? 0 : i * L * 0.4, g);
      break;
    }
    case 'drums':
      for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; mk(GEO.cyl(0.45, 0.45, 1.3, 10), M.pipe, Math.cos(a) * 0.55, 0.65, Math.sin(a) * 0.55, g); }
      break;
    case 'barrier':
      mk(GEO.box(o.w, o.h, o.d), M.stripe, 0, o.h / 2, 0, g, { receive: true });
      break;
    case 'pillar':
      mk(GEO.cyl(o.r, o.r, o.h, 14), M.concrete, 0, o.h / 2, 0, g, { receive: true });
      mk(GEO.cyl(o.r + 0.05, o.r + 0.05, 0.4, 14), M.stripe, 0, o.h - 0.6, 0, g);
      break;
    default:
      if (o.t === 'box') mk(GEO.box(o.w, o.h, o.d), M.concrete, 0, o.h / 2, 0, g);
      else mk(GEO.cyl(o.r, o.r, o.h, 12), M.concrete, 0, o.h / 2, 0, g);
  }
  return g;
}

function buildArena(mapId) {
  const map = MAPS[mapId];
  const rng = mulberry32(hashStr('map_' + mapId));
  const obstacles = map.gen(rng);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(map.fog, map.fogD[0], map.fogD[1]);
  scene.add(skyDome(map.sky[0], map.sky[1]));
  const hemi = new THREE.HemisphereLight(map.sky[0], map.ground, map.amb * 2.2);
  scene.add(hemi);
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const sun = new THREE.DirectionalLight(map.sun, 2.4);
  sun.position.set(60, 110, 40);
  sun.castShadow = true;
  const ext = Math.max(map.hx, map.hz) + 15;
  Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 10, far: 320 });
  const qs = (GFX.qp && GFX.qp.shadowSize) || 2048;
  sun.shadow.mapSize.set(qs, qs);
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
  scene.add(sun); scene.add(sun.target);
  const M = arenaMaterials(map);
  const ground = mk(new THREE.PlaneGeometry(map.hx * 2 + 500, map.hz * 2 + 500), M.ground, 0, 0, 0, scene, { rx: -Math.PI / 2, receive: true, shadow: false });
  M.ground.map.repeat.set((map.hx * 2 + 500) / 12, (map.hz * 2 + 500) / 12);
  ground.name = 'ground';
  for (const o of obstacles) scene.add(obstacleMesh(o, M));
  // boundary
  const bh = 1.4;
  if (map.walls) {
    for (const s of [1, -1]) {
      for (let i = 0; i < 9; i++) {
        const z = -map.hz - 10 + i * ((map.hz * 2 + 20) / 8);
        const m = mk(GEO.box(1, 1, 1), i % 2 ? M.rock : M.rock2, s * (map.hx + 10 + rng() * 4), 12, z, scene, { receive: true });
        m.scale.set(16 + rng() * 6, 26 + rng() * 14, 26 + rng() * 6); m.rotation.y = (rng() - 0.5) * 0.3;
      }
    }
    for (const s of [1, -1]) mk(GEO.box(map.hx * 2, bh, 1), M.stripe, 0, bh / 2, s * (map.hz + 0.5), scene);
  } else {
    for (const s of [1, -1]) {
      mk(GEO.box(map.hx * 2 + 2, bh, 1), M.stripe, 0, bh / 2, s * (map.hz + 0.5), scene);
      mk(GEO.box(1, bh, map.hz * 2 + 2), M.stripe, s * (map.hx + 0.5), bh / 2, 0, scene);
      // crowd stands
      const st = grp(scene, 0, 0, s * (map.hz + 14));
      for (let i = 0; i < 4; i++) {
        mk(GEO.box(map.hx * 1.6, 2, 4), M.concrete, 0, 1 + i * 2, s * i * 4, st, { receive: true });
        mk(GEO.box(map.hx * 1.6, 1.2, 0.2), M.crowd, 0, 2.6 + i * 2, s * (i * 4 - 2.1), st, { shadow: false, ry: s > 0 ? Math.PI : 0 });
      }
    }
    for (const sx of [1, -1]) for (const sz of [1, -1]) {
      const t = grp(scene, sx * (map.hx + 4), 0, sz * (map.hz + 4));
      mk(GEO.box(0.8, 22, 0.8), M.steel, 0, 11, 0, t);
      mk(GEO.box(3.2, 1.4, 0.8), M.steel, 0, 22, 0, t);
      mk(GEO.box(2.8, 1.0, 0.2), M.lamp, 0, 22, -sz * 0.45, t, { shadow: false });
    }
  }
  const flashes = [];
  for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffa040, 0, 30, 2); scene.add(l); flashes.push({ l, t: 0, max: 0 }); }
  return { scene, map, obstacles, hx: map.hx, hz: map.hz, sun, flashes, mats: M };
}

// --------------------------- HANGAR SCENE ---------------------------
function buildHangarScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0f12);
  scene.fog = new THREE.Fog(0x0d0f12, 30, 70);
  scene.add(new THREE.HemisphereLight(0xb8c8dc, 0x2a2c30, 1.4));
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.DirectionalLight(0xfff0dd, 2.8);
  key.position.set(8, 16, 10); key.castShadow = true;
  Object.assign(key.shadow.camera, { left: -10, right: 10, top: 12, bottom: -4, near: 1, far: 50 });
  key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0005;
  scene.add(key);
  const amber = new THREE.PointLight(0xffa020, 90, 34, 2); amber.position.set(-9, 6, 6); scene.add(amber);
  const fill = new THREE.DirectionalLight(0x9fc4ff, 1.0); fill.position.set(-10, 6, 12); scene.add(fill);
  const cyan = new THREE.PointLight(0x2fd6e8, 70, 30, 2); cyan.position.set(9, 4, -5); scene.add(cyan);
  const floorTex = noiseTex('hangarfloor', '#2a2d32', '#15171a', 512, [6, 6], (g, w, h) => {
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 3;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, h); g.moveTo(0, i * 128); g.lineTo(w, i * 128); g.stroke(); }
  });
  mk(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.75, metalness: 0.3 }), 0, 0, 0, scene, { rx: -Math.PI / 2, receive: true, shadow: false });
  // turntable with hazard ring
  const tt = grp(scene);
  mk(GEO.cyl(5.2, 5.4, 0.3, 40), new THREE.MeshStandardMaterial({ color: 0x30343a, metalness: 0.6, roughness: 0.4 }), 0, 0.15, 0, tt, { receive: true });
  const ringTex = stripeTex('#ffb000', '#16181c');
  const ringMat = new THREE.MeshStandardMaterial({ map: ringTex, roughness: 0.6 });
  ringTex.repeat.set(24, 1);
  mk(new THREE.CylinderGeometry(5.45, 5.45, 0.32, 48, 1, true), ringMat, 0, 0.16, 0, tt, { receive: true });
  mk(GEO.torus(4.6, 0.04, 48), new THREE.MeshBasicMaterial({ color: 0x2fd6e8 }), 0, 0.31, 0, tt, { rx: Math.PI / 2, shadow: false });
  // back walls with panels
  const wallMat = new THREE.MeshStandardMaterial({ map: noiseTex('hangarwall', '#24272c', '#16181b', 256, [8, 2], (g, w, h) => { g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 4; for (let i = 0; i <= 4; i++) { g.strokeRect(i * 64 + 4, 8, 56, h - 16); } }), roughness: 0.8, metalness: 0.4 });
  mk(new THREE.PlaneGeometry(80, 26), wallMat, 0, 13, -16, scene, { receive: true, shadow: false });
  mk(new THREE.PlaneGeometry(60, 26), wallMat, -22, 13, 0, scene, { ry: Math.PI / 2, receive: true, shadow: false });
  mk(new THREE.PlaneGeometry(60, 26), wallMat, 22, 13, 0, scene, { ry: -Math.PI / 2, receive: true, shadow: false });
  const strMat = new THREE.MeshStandardMaterial({ map: stripeTex('#ffb000', '#16181c'), roughness: 0.7 });
  strMat.map.repeat.set(20, 1);
  mk(new THREE.PlaneGeometry(80, 1.2), strMat, 0, 0.6, -15.9, scene, { shadow: false });
  // gantry
  const steel = new THREE.MeshStandardMaterial({ color: 0x3a3f46, metalness: 0.7, roughness: 0.4 });
  for (const x of [-7, 7]) mk(GEO.box(0.6, 14, 0.6), steel, x, 7, -6, scene);
  mk(GEO.box(14.6, 0.8, 0.8), steel, 0, 14, -6, scene);
  const lampM = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xfff0d0, emissiveIntensity: 2.5 });
  for (const x of [-4, 0, 4]) mk(GEO.box(1.8, 0.2, 0.6), lampM, x, 13.55, -6, scene, { shadow: false });
  // crates and props
  const crateM = new THREE.MeshStandardMaterial({ color: 0x5a4a32, roughness: 0.8 });
  mk(GEO.box(2, 1.6, 2), crateM, -13, 0.8, -9, scene);
  mk(GEO.box(1.6, 1.2, 1.6), crateM, -11.2, 0.6, -10.5, scene);
  mk(GEO.box(1.4, 1.4, 1.4), crateM, -13, 2.3, -9, scene);
  mk(GEO.cyl(0.7, 0.7, 1.6, 12), new THREE.MeshStandardMaterial({ color: 0x8a2a1a, roughness: 0.6 }), 12, 0.8, -10, scene);
  mk(GEO.cyl(0.7, 0.7, 1.6, 12), new THREE.MeshStandardMaterial({ color: 0x2a5a8a, roughness: 0.6 }), 13.6, 0.8, -9, scene);
  return { scene, turntable: tt };
}
