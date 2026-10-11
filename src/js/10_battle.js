// =====================================================================
// 10 | SYSTEMS | BATTLE SIMULATION (combat, damage, heat, power)
// Pure simulation: no rendering. Emits events for the view layer.
// =====================================================================
const SIM_DT = 1 / 60;
const HIT_TABLE = {
  f: { torso: 38, head: 7, armL: 12, armR: 12, legL: 10, legR: 10, shL: 4, shR: 4 },
  l: { torso: 28, head: 4, armL: 30, shL: 10, legL: 25, armR: 2, legR: 3 },
  r: { torso: 28, head: 4, armR: 30, shR: 10, legR: 25, armL: 2, legL: 3 },
  b: { torso: 42, back: 22, legL: 11, legR: 11, shL: 5, shR: 5, head: 4 },
  t: { torso: 30, head: 16, shL: 14, shR: 14, back: 14, armL: 4, armR: 4, legL: 1, legR: 1 },
};
const INTERNAL = ['reactor', 'core0', 'core1', 'core2', 'core3'];
const COMP_NAMES = { torso: 'Torso', head: 'Head', legL: 'Left Leg', legR: 'Right Leg', armL: 'Left Arm', armR: 'Right Arm', shL: 'Left Shoulder', shR: 'Right Shoulder', back: 'Back Mount', reactor: 'Reactor', core0: 'Core 1', core1: 'Core 2', core2: 'Core 3', core3: 'Core 4' };
const fwdX = (a) => Math.sin(a), fwdZ = (a) => Math.cos(a);

// ---------------------------------------------------------------------
// NAVIGATION GRID + A*
// ---------------------------------------------------------------------
class NavGrid {
  constructor(hx, hz, obstacles, cs = 3, inflate = 2.4) {
    this.cs = cs; this.hx = hx; this.hz = hz;
    this.nx = Math.ceil((hx * 2) / cs); this.nz = Math.ceil((hz * 2) / cs);
    this.blocked = new Uint8Array(this.nx * this.nz);
    for (let j = 0; j < this.nz; j++) for (let i = 0; i < this.nx; i++) {
      const x = -hx + (i + 0.5) * cs, z = -hz + (j + 0.5) * cs;
      let b = Math.abs(x) > hx - 2 || Math.abs(z) > hz - 2;
      if (!b) for (const o of obstacles) { if (pointInObstacle(o, x, z, inflate)) { b = true; break; } }
      this.blocked[j * this.nx + i] = b ? 1 : 0;
    }
  }
  cell(x, z) { return [clamp(Math.floor((x + this.hx) / this.cs), 0, this.nx - 1), clamp(Math.floor((z + this.hz) / this.cs), 0, this.nz - 1)]; }
  center(i, j) { return { x: -this.hx + (i + 0.5) * this.cs, z: -this.hz + (j + 0.5) * this.cs }; }
  free(i, j) { return i >= 0 && j >= 0 && i < this.nx && j < this.nz && !this.blocked[j * this.nx + i]; }
  nearestFree(i, j) {
    if (this.free(i, j)) return [i, j];
    for (let r = 1; r < 12; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.abs(di) !== r && Math.abs(dj) !== r) continue;
      if (this.free(i + di, j + dj)) return [i + di, j + dj];
    }
    return [i, j];
  }
  lineFree(x0, z0, x1, z1) {
    const d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d / (this.cs * 0.5));
    for (let k = 1; k < n; k++) {
      const t = k / n, [i, j] = this.cell(lerp(x0, x1, t), lerp(z0, z1, t));
      if (!this.free(i, j)) return false;
    }
    return true;
  }
  path(x0, z0, x1, z1) {
    const [si, sj] = this.nearestFree(...this.cell(x0, z0));
    const [ti, tj] = this.nearestFree(...this.cell(x1, z1));
    const nx = this.nx, N = nx * this.nz;
    const g = new Float32Array(N).fill(1e9), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const start = sj * nx + si, goal = tj * nx + ti;
    const h = (i, j) => { const dx = Math.abs(i - ti), dz = Math.abs(j - tj); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    const heap = [[h(si, sj), start]];
    g[start] = 0;
    let iter = 0;
    while (heap.length && iter++ < 6000) {
      // pop min
      let bi = 0;
      for (let k = 1; k < heap.length; k++) if (heap[k][0] < heap[bi][0]) bi = k;
      const [, cur] = heap[bi]; heap[bi] = heap[heap.length - 1]; heap.pop();
      if (closed[cur]) continue;
      closed[cur] = 1;
      if (cur === goal) break;
      const ci = cur % nx, cj = (cur / nx) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di, nj = cj + dj;
        if (!this.free(ni, nj)) continue;
        if (di && dj && (!this.free(ci + di, cj) || !this.free(ci, cj + dj))) continue;
        const n = nj * nx + ni;
        if (closed[n]) continue;
        const ng = g[cur] + (di && dj ? 1.414 : 1);
        if (ng < g[n]) { g[n] = ng; came[n] = cur; heap.push([ng + h(ni, nj), n]); }
      }
    }
    if (came[goal] < 0 && goal !== start) return null;
    const pts = [];
    for (let c = goal; c !== -1 && c !== start; c = came[c]) pts.push(this.center(c % nx, (c / nx) | 0));
    pts.reverse();
    // string pulling
    const out = [];
    let ax = x0, az = z0, k = 0;
    while (k < pts.length) {
      let far = k;
      for (let m = pts.length - 1; m > k; m--) if (this.lineFree(ax, az, pts[m].x, pts[m].z)) { far = m; break; }
      out.push(pts[far]); ax = pts[far].x; az = pts[far].z; k = far + 1;
    }
    return out;
  }
}
function pointInObstacle(o, x, z, inflate = 0) {
  if (o.t === 'cyl') return Math.hypot(x - o.x, z - o.z) < o.r + inflate;
  return Math.abs(x - o.x) < o.w / 2 + inflate && Math.abs(z - o.z) < o.d / 2 + inflate;
}
// returns t in [0,1] of first intersection of segment with obstacle footprint, or -1
function segObstacle(o, x0, z0, x1, z1, inflate = 0) {
  const dx = x1 - x0, dz = z1 - z0;
  if (o.t === 'cyl') {
    const r = o.r + inflate, fx = x0 - o.x, fz = z0 - o.z;
    const a = dx * dx + dz * dz, b = 2 * (fx * dx + fz * dz), c = fx * fx + fz * fz - r * r;
    if (c < 0) return 0;
    const disc = b * b - 4 * a * c;
    if (disc < 0 || a === 0) return -1;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    return t >= 0 && t <= 1 ? t : -1;
  }
  const minX = o.x - o.w / 2 - inflate, maxX = o.x + o.w / 2 + inflate, minZ = o.z - o.d / 2 - inflate, maxZ = o.z + o.d / 2 + inflate;
  let t0 = 0, t1 = 1;
  for (const [p, d, lo, hi] of [[x0, dx, minX, maxX], [z0, dz, minZ, maxZ]]) {
    if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) return -1; continue; }
    let ta = (lo - p) / d, tb = (hi - p) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return -1;
  }
  return t0;
}

// ---------------------------------------------------------------------
// UNIT
// ---------------------------------------------------------------------
class Unit {
  constructor(b, cfg, team, idx) {
    const d = cfg.design;
    this.b = b; this.team = team; this.idx = idx; this.uid = b.nextId++;
    this.design = d; this.pilot = cfg.pilot || null;
    this.skill = cfg.skill != null ? cfg.skill : 0.5;
    this.name = cfg.name || d.name; this.call = cfg.call || (this.pilot ? this.pilot.call : '');
    this.isPlayer = !!cfg.player; this.dummy = !!cfg.dummy;
    const st = (this.st = computeStats(d, this.pilot));
    this.dims = mechDims(d);
    this.radius = this.dims.radius; this.height = this.dims.height;
    this.ptrait = this.pilot ? PILOT_TRAITS[this.pilot.trait] || {} : {};
    this.plevel = this.pilot ? this.pilot.level : 1;
    this.x = cfg.x; this.z = cfg.z; this.y = 0; this.vx = 0; this.vz = 0; this.vy = 0;
    this.heading = cfg.heading || 0; this.torsoYaw = 0; this.pitch = 0;
    this.armor = Object.assign({}, st.armor); this.armorMax = Object.assign({}, st.armor);
    this.comps = {};
    for (const [k, hp] of Object.entries(st.comps)) this.comps[k] = { hp, max: hp, alive: true };
    if (this.dummy) {
      for (const c of Object.values(this.comps)) { c.hp *= 8; c.max *= 8; }
      for (const f of FACINGS) { this.armor[f] *= 4; this.armorMax[f] *= 4; }
    }
    this.heat = 0; this.alive = true; this.shutdown = 0; this.stagger = -1; this.meltdown = 0; this.dead = false;
    this.weapons = st.weapons.map((w) => ({
      slot: w.slot, p: w.part, cd: rand(0.2, 1.0), ammo: w.ammo, ammoMax: w.ammo, spin: 0, charging: 0, beam: null, burstLeft: 0, burstT: 0, swingT: 0, flameT: 0,
      off: false, s: { shots: 0, hits: 0, dmg: 0, rangeSum: 0, dryAt: -1 },
    }));
    this.shields = {};
    for (const k of ['armL', 'armR']) { const p = PARTS[d.parts[k]]; if (p && p.kind === 'shield') this.shields[k] = { hp: p.shield, max: p.shield, block: p.block, absorbed: 0 }; }
    this.backSys = st.sys.back || null;
    this.jumpCd = 2; this.boostCd = 2; this.jumping = false; this.jumpT = 0; this.boostT = 0; this.jvx = 0; this.jvz = 0;
    this.barrier = 0; this.barrierMax = 0; this.barrierT = 0; this.reflexCd = 0;
    this.repairPool = 0;
    this.lastHitT = -10; this.lastAttacker = null;
    this.speedNow = 0; this.stridePhase = 0; this.strafe = 0;
    this.s = { dmgTaken: { f: 0, l: 0, r: 0, b: 0, t: 0 }, armorAbsorbed: { f: 0, l: 0, r: 0, b: 0, t: 0 }, structTaken: 0, partsLost: [], hotTime: 0, shutdowns: 0, kills: 0, barrierAbs: 0, repaired: 0, armorBrokeAt: {}, lowPower: 0, cookoffs: 0, heatLog: [], deflects: 0, dealt: 0 };
    this.ai = { state: 'engage', think: rand(0, 0.2), target: null, aimComp: 'torso', aimT: 0, path: null, pathI: 0, pathT: 0, strafeDir: chance(0.5) ? 1 : -1, strafeT: rand(2, 5), losT: 0, retreated: false, stateT: 0, mx: 0, mz: 0, face: null, spdMul: 1, los: true, cover: false, dist: 999, bigHit: 0, lastPos: null };
    // initial values
    this.recalc(true);
    this.heatCap0 = this.heatCap;
    this.barrier = this.barrierMax;
    let pool = 0;
    for (const c of st.cores) if (c.part.rpool) pool += c.part.rpool;
    if (this.backSys && this.backSys.rpool) pool += this.backSys.rpool;
    if (this.ptrait.fix) pool += 150;
    this.repairPool = pool;
  }
  alive_(k) { const c = this.comps[k]; return !!(c && c.alive); }
  recalc() {
    const st = this.st, C = st.C, L = st.L, H = st.H, R = st.R, T = st.T;
    let hcap = BASE_HEATCAP, dis = BASE_DISSIP, acc = 0, gacc = 0, ecm = 0, flare = 0, supply = 0, draw = 0, stab = L.stab, repair = 0, barrier = 0, reflex = false, ammoB = 0;
    const addP = (p) => {
      if (!p) return;
      hcap += p.hcap || 0; dis += p.dis || 0; if (p.slot !== 'weapon') acc += p.acc || 0; gacc += p.gacc || 0; ecm += p.ecm || 0; flare += p.flare || 0; stab += p.stab || 0;
      if (p.pw > 0) draw += p.pw; else if (p.pw < 0) supply += -p.pw;
      supply += p.pwOut || 0; repair += p.repair || 0; barrier += p.barrier || 0; ammoB += p.ammoB || 0;
      if (p.reflex) reflex = true;
    };
    const nLegs = (this.alive_('legL') ? 1 : 0) + (this.alive_('legR') ? 1 : 0);
    if (nLegs) addP(L);
    if (this.alive_('head')) addP(H); else acc -= 0.22;
    if (this.alive_('reactor')) { const c = this.comps.reactor; const f = c.hp / c.max; supply += R.out * (f > 0.5 ? 1 : 0.5 + f); dis += R.dis || 0; }
    else supply += R.out * 0.25;
    for (const w of this.weapons) { w.off = !this.alive_(w.slot); if (!w.off) addP(w.p); if (w.off) { w.beam = null; w.burstLeft = 0; w.charging = 0; } }
    for (const k in this.shields) if (!this.alive_(k)) this.shields[k].hp = 0;
    if (this.backSys && this.alive_('back')) addP(this.backSys);
    for (const c of st.cores) if (this.alive_(c.slot)) addP(c.part);
    for (const m of st.modules) { const comp = MOUNT_BY_ID[m.mount].comp; if (comp === 'torso' || this.alive_(comp)) addP(m.part); }
    this.heatCap = Math.max(10, hcap);
    this.dissip = dis * (1 + (this.ptrait.dis || 0));
    this.accB = acc + (this.ptrait.acc || 0) + (this.plevel - 1) * 0.01;
    this.gaccB = gacc + (this.ptrait.gacc || 0);
    this.ecm = ecm; this.flare = Math.min(0.3, flare); this.stab = Math.min(1, stab);
    this.supply = supply; this.draw = draw; this.pwEff = draw > 0 ? Math.min(1, supply / draw) : 1;
    this.sensor = this.alive_('head') ? H.sensor : 45;
    this.legMul = nLegs === 2 ? 1 : nLegs === 1 ? 0.55 : 0.22;
    this.nLegs = nLegs;
    const back = this.backSys && this.alive_('back') ? this.backSys : null;
    this.hasJump = !!(back && back.jump && nLegs === 2);
    this.hasBoost = !!(back && back.boost && nLegs > 0);
    this.repairRate = repair + (this.ptrait.fix || 0);
    this.barrierMax = barrier;
    if (!barrier) this.barrier = 0;
    this.hasReflex = reflex;
    this.turnRate = st.turn * DEG * (nLegs === 2 ? 1 : 0.7);
    this.twist = T.twist * DEG;
  }
  get structFrac() { const c = this.comps.torso; return c.hp / c.max; }
  get armorFrac() { let a = 0, m = 0; for (const f of FACINGS) { a += this.armor[f]; m += this.armorMax[f]; } return m ? a / m : 0; }
  get hpFrac() { return clamp(this.structFrac * 0.65 + this.armorFrac * 0.35, 0, 1); }
  get heatFrac() { return this.heat / this.heatCap; }
  get torsoWorld() { return this.heading + this.torsoYaw; }
  maxSpeed() {
    let s = this.st.speed * this.legMul;
    const hf = this.heatFrac;
    if (hf > 0.7) s *= 1 - Math.min(0.45, (hf - 0.7) * 1.5);
    s *= 0.7 + 0.3 * this.pwEff;
    if (this.stagger > 0) s *= 0.4;
    return s;
  }
  addHeat(h) { this.heat += h; }
  compPos(k, out) {
    const yaw = this.torsoWorld;
    const side = this.dims.side[k] || 0;
    out.x = this.x + Math.cos(yaw) * side; out.z = this.z - Math.sin(yaw) * side;
    out.y = this.y + (this.dims.y[k] || this.dims.y.torso);
    return out;
  }
  muzzlePos(slot, out) {
    this.compPos(slot, out);
    const yaw = this.torsoWorld, f = 1.4 * this.dims.s;
    out.x += Math.sin(yaw) * f; out.z += Math.cos(yaw) * f;
    if (slot === 'back') out.y += 1.0 * this.dims.s;
    return out;
  }

  update(dt) {
    if (!this.alive) return;
    const b = this.b;
    // meltdown
    if (this.meltdown > 0) {
      this.meltdown -= dt;
      if (Math.random() < dt * 10) b.ev({ t: 'sparks', u: this, comp: 'torso' });
      if (this.meltdown <= 0) { b.reactorBlast(this); return; }
    }
    if (this.stagger > -1) this.stagger -= dt;
    if (this.reflexCd > 0) this.reflexCd -= dt;
    this.jumpCd -= dt; this.boostCd -= dt;
    // barrier regen
    if (this.barrierMax > 0 && b.t - this.lastHitT > 4 && this.barrier < this.barrierMax) {
      const aeg = this.st.cores.find((c) => c.part.barrier && this.alive_(c.slot));
      this.barrier = Math.min(this.barrierMax, this.barrier + (aeg ? aeg.part.bregen : 10) * dt);
    }
    // repair
    if (this.repairRate > 0 && this.repairPool > 0) {
      let worst = null, wf = 0.98;
      for (const [k, c] of Object.entries(this.comps)) { if (!c.alive) continue; const f = c.hp / c.max; if (f < wf) { wf = f; worst = c; } }
      if (worst) { const amt = Math.min(this.repairRate * dt, this.repairPool, worst.max - worst.hp); worst.hp += amt; this.repairPool -= amt; this.s.repaired += amt; }
    }
    this.updateHeat(dt);
    if (b.t < 0) return;
    if (this.dummy) { this.speedNow = 0; return; }
    if (!this.shutdown) {
      this.ai.think -= dt;
      if (this.ai.think <= 0) { this.ai.think = 0.2; AI.think(this); }
    } else { this.ai.mx = this.ai.mz = 0; }
    this.move(dt);
    this.aim(dt);
    if (!this.shutdown) this.updateWeapons(dt);
    if (this.pwEff < 1) this.s.lowPower += dt;
  }

  updateHeat(dt) {
    const R = this.st.R;
    let cool = this.dissip * (this.shutdown ? 1.6 : 1);
    this.heat = Math.max(0, this.heat - cool * dt + (R.pheat && this.alive_('reactor') ? R.pheat * dt : 0));
    const hf = this.heatFrac;
    if (hf > 0.85) this.s.hotTime += dt;
    if (!this.shutdown && this.heat >= this.heatCap) {
      this.shutdown = 2.5; this.s.shutdowns++;
      for (const w of this.weapons) { w.beam = null; w.burstLeft = 0; w.charging = 0; }
      this.b.ev({ t: 'shutdown', u: this });
      this.b.log(this.label() + ' overheated | Emergency shutdown', 'warn');
    }
    if (this.shutdown) {
      this.shutdown = Math.max(0.0001, this.shutdown - dt);
      if (this.shutdown <= 0.0001 && this.heat < this.heatCap * 0.4) { this.shutdown = 0; this.b.ev({ t: 'restart', u: this }); }
    }
    if (this.heat > this.heatCap) {
      const over = (this.heat - this.heatCap) * 0.6 + 3;
      this.damageComp('torso', over * dt, null, null, true);
    }
  }

  label() { return this.name + (this.call ? ' [' + this.call + ']' : ''); }

  // ---------------- movement ----------------
  move(dt) {
    const ai = this.ai, st = this.st;
    const maxS = this.shutdown ? 0 : this.maxSpeed() * ai.spdMul;
    let tvx = 0, tvz = 0;
    const mag = Math.min(1, Math.hypot(ai.mx, ai.mz));
    const moveAng = Math.atan2(ai.mx, ai.mz);
    const face = ai.face != null ? ai.face : moveAng;
    const turn = this.turnRate * (this.jumping ? 0.5 : 1);
    const turnTo = (ang) => { const d = angDiff(this.heading, ang); this.heading += clamp(d, -turn * dt, turn * dt); return d; };
    const lt = st.legType;
    let reverse = false, strafe = 0;
    if (this.shutdown) {
      // nothing
    } else if (lt === 'quad' || lt === 'hover') {
      turnTo(mag > 0.05 && ai.face == null ? moveAng : face);
      if (mag > 0.05) {
        let k = 1;
        if (lt === 'quad') { const rel = Math.abs(angDiff(this.heading, moveAng)); k = rel > Math.PI / 2 ? 0.75 : 1 - 0.15 * Math.sin(rel); }
        tvx = Math.sin(moveAng) * maxS * mag * k; tvz = Math.cos(moveAng) * maxS * mag * k;
        strafe = Math.sin(angDiff(this.heading, moveAng));
      }
    } else {
      if (mag < 0.05) turnTo(face);
      else {
        reverse = Math.abs(angDiff(moveAng, face)) > 1.95;
        const want = reverse ? moveAng + Math.PI : moveAng;
        const d = turnTo(want);
        const align = Math.cos(clamp(d, -Math.PI / 2, Math.PI / 2));
        let k = lt === 'tracked' ? Math.pow(Math.max(0, align), 2) : Math.max(0, (align + 0.25) / 1.25);
        const spd = maxS * mag * k * (reverse ? (lt === 'tracked' ? 0.6 : 0.55) : 1);
        const dir = reverse ? -1 : 1;
        tvx = Math.sin(this.heading) * spd * dir; tvz = Math.cos(this.heading) * spd * dir;
      }
    }
    // boost
    if (this.boostT > 0) {
      this.boostT -= dt;
      tvx = this.jvx; tvz = this.jvz;
    }
    const k = this.jumping ? 1.5 : lt === 'hover' ? 1.8 : lt === 'tracked' ? 2.6 : 4;
    if (this.jumping) { tvx = this.jvx; tvz = this.jvz; }
    const kk = this.boostT > 0 ? 10 : k;
    this.vx = damp(this.vx, tvx, kk, dt); this.vz = damp(this.vz, tvz, kk, dt);
    this.x += this.vx * dt; this.z += this.vz * dt;
    // jump arc
    if (this.jumping) {
      this.jumpT += dt;
      const dur = 1.5, k2 = this.jumpT / dur;
      this.y = Math.max(0, 7 * 4 * k2 * (1 - k2));
      if (k2 >= 1) { this.jumping = false; this.y = 0; this.b.ev({ t: 'land', u: this }); }
    }
    this.collide();
    const sp = Math.hypot(this.vx, this.vz);
    this.speedNow = sp;
    this.reverse = reverse;
    this.strafe = damp(this.strafe, strafe, 4, dt);
    const fwd = this.vx * Math.sin(this.heading) + this.vz * Math.cos(this.heading);
    this.fwdSpeed = fwd;
  }
  collide() {
    const b = this.b, r = this.radius * 0.8;
    for (const o of b.obstacles) {
      if (this.jumping && o.h < 7.5 && this.y > o.h * 0.6) continue;
      if (o.t === 'cyl') {
        const dx = this.x - o.x, dz = this.z - o.z, d = Math.hypot(dx, dz), m = o.r + r;
        if (d < m && d > 1e-6) { this.x = o.x + (dx / d) * m; this.z = o.z + (dz / d) * m; }
      } else {
        const cx = clamp(this.x, o.x - o.w / 2, o.x + o.w / 2), cz = clamp(this.z, o.z - o.d / 2, o.z + o.d / 2);
        const dx = this.x - cx, dz = this.z - cz, d = Math.hypot(dx, dz);
        if (d < r) {
          if (d > 1e-6) { this.x = cx + (dx / d) * r; this.z = cz + (dz / d) * r; }
          else {
            const px = o.w / 2 + r - Math.abs(this.x - o.x), pz = o.d / 2 + r - Math.abs(this.z - o.z);
            if (px < pz) this.x += Math.sign(this.x - o.x || 1) * px; else this.z += Math.sign(this.z - o.z || 1) * pz;
          }
        }
      }
    }
    for (const u of b.units) {
      if (u === this || !u.alive && !u.wreck) continue;
      const dx = this.x - u.x, dz = this.z - u.z, d = Math.hypot(dx, dz), m = (r + u.radius * 0.8) * 0.9;
      if (d < m && d > 1e-6) {
        const push = (m - d) * (u.alive && !u.dummy ? 0.5 : 1);
        this.x += (dx / d) * push; this.z += (dz / d) * push;
      }
    }
    this.x = clamp(this.x, -b.hx + r, b.hx - r); this.z = clamp(this.z, -b.hz + r, b.hz - r);
  }
  aim(dt) {
    const t = this.ai.target;
    let want = 0, pitch = 0;
    if (t && t.alive) {
      const ang = angTo(this.x, this.z, t.x, t.z);
      want = clamp(angDiff(this.heading, ang), -this.twist, this.twist);
      const d = Math.max(1, dist2d(this.x, this.z, t.x, t.z));
      pitch = clamp(Math.atan2(t.y + t.dims.y.torso - (this.y + this.dims.y.armL), d), -0.35, 0.35);
    }
    this.torsoYaw += clamp(angDiff(this.torsoYaw, want), -3.2 * dt, 3.2 * dt);
    this.pitch = damp(this.pitch, pitch, 6, dt);
  }

  jump(tx, tz) {
    if (!this.hasJump || this.jumpCd > 0 || this.jumping || this.shutdown) return false;
    const d = Math.min(26, dist2d(this.x, this.z, tx, tz));
    const a = angTo(this.x, this.z, tx, tz);
    this.jumping = true; this.jumpT = 0;
    this.jvx = Math.sin(a) * d / 1.5; this.jvz = Math.cos(a) * d / 1.5;
    this.jumpCd = this.backSys.jump; this.addHeat(this.backSys.jht || 5);
    this.b.ev({ t: 'jump', u: this });
    return true;
  }
  boost(ang) {
    if (!this.hasBoost || this.boostCd > 0 || this.shutdown || this.jumping) return false;
    const sp = Math.max(this.st.speed, 8) * 2.6;
    this.jvx = Math.sin(ang) * sp; this.jvz = Math.cos(ang) * sp;
    this.boostT = 0.55; this.boostCd = this.backSys.boost; this.addHeat(this.backSys.bht || 4);
    this.b.ev({ t: 'boost', u: this });
    return true;
  }

  // ---------------- weapons ----------------
  updateWeapons(dt) {
    const b = this.b, t = this.ai.target;
    const tgtOk = t && t.alive;
    const dist = tgtOk ? dist2d(this.x, this.z, t.x, t.z) : 999;
    for (const w of this.weapons) {
      if (w.off || w.p.kind === 'shield') continue;
      const p = w.p;
      if (w.cd > 0) w.cd -= dt * this.pwEff;
      if (p.spin) w.spin = Math.max(0, w.spin - dt * 0.6);
      // ongoing actions
      if (w.burstLeft > 0) {
        w.burstT -= dt;
        if (w.burstT <= 0) {
          if (w.tgt && w.tgt.alive) this.shoot(w, w.tgt);
          w.burstLeft--; w.burstT = p.kind === 'missile' ? 0.07 : 0.09;
        }
        continue;
      }
      if (w.charging > 0) {
        w.charging -= dt;
        if (w.charging <= 0 && w.tgt && w.tgt.alive) this.shoot(w, w.tgt);
        continue;
      }
      if (w.beam) { this.updateBeam(w, dt); continue; }
      if (w.swingT > 0) {
        w.swingT -= dt;
        if (w.swingT <= 0 && w.tgt && w.tgt.alive) this.meleeStrike(w, w.tgt);
        continue;
      }
      if (!tgtOk || w.cd > 0 || this.stagger > 0) continue;
      if (p.ammo && w.ammo <= 0) continue;
      const reach = p.kind === 'melee' ? p.max + this.radius * 0.6 + t.radius * 0.6 : p.max;
      if (dist > reach || dist < (p.min || 0)) continue;
      // firing arc
      const ang = angTo(this.x, this.z, t.x, t.z);
      const off = Math.abs(angDiff(this.torsoWorld, ang));
      const arc = p.indirect ? 0.9 : p.kind === 'missile' ? 0.45 : p.kind === 'melee' ? 0.6 : 0.22;
      if (off > arc) continue;
      // line of sight
      const los = this.ai.los;
      if (!los && !p.indirect) continue;
      if (!los && p.indirect && !b.spotted(this.team, t) && dist > this.sensor) continue;
      // heat discipline
      if (!AI.mayFire(this, w, t)) continue;
      this.fire(w, t, dist);
    }
  }
  fire(w, t, dist) {
    const p = w.p;
    w.cd = 1 / p.rof;
    if (p.ammo) { w.ammo--; if (w.ammo <= 0 && w.s.dryAt < 0) { w.s.dryAt = this.b.t; this.b.log(this.label() + ' | ' + p.name + ' out of ammo', 'dim'); } }
    this.addHeat(p.ht);
    w.s.shots++; w.s.rangeSum += dist;
    w.tgt = t;
    if (p.spin) w.spin = Math.min(1, w.spin + 0.08);
    this.b.ev({ t: 'fire', u: this, w });
    switch (p.kind) {
      case 'laser':
        if (p.burst > 1) { w.burstLeft = p.burst; w.burstT = 0; } else this.shoot(w, t);
        break;
      case 'missile':
        w.burstLeft = p.burst; w.burstT = 0; break;
      case 'rail':
        w.charging = p.charge; this.b.ev({ t: 'charge', u: this, w }); break;
      case 'beam':
        w.beam = { t: 0, dur: p.beam, hit: chance(this.hitChance(w, t, dist)), comp: this.pickAim(t), tgt: t, mx: rand(-3, 3), mz: rand(-3, 3), dealt: 0 };
        if (w.beam.hit) w.s.hits++;
        break;
      case 'melee':
        w.swingT = 0.28; this.b.ev({ t: 'swing', u: this, w }); break;
      default: {
        const n = p.pellets || 1;
        for (let i = 0; i < n; i++) this.shoot(w, t, i > 0);
      }
    }
  }
  pickAim(t) { return this.ai.target === t ? this.ai.aimComp : 'torso'; }
  hitChance(w, t, dist) {
    const p = w.p;
    let acc = p.acc * (1 + this.accB + ((p.guided || p.indirect) ? this.gaccB : 0));
    if (p.spin) acc += p.spin * w.spin;
    if (dist > p.opt && p.max > p.opt) acc *= lerp(1, 0.35, clamp((dist - p.opt) / (p.max - p.opt), 0, 1));
    const mv = Math.min(1.5, this.speedNow / Math.max(1, this.st.speed));
    acc *= 1 - (1 - this.stab) * 0.4 * mv;
    if (this.jumping) acc *= 0.8;
    if (this.stagger > 0) acc *= 0.6;
    if (this.heatFrac > 0.8) acc *= 0.85;
    // target evasion (lateral speed relative to the line of fire)
    const dx = t.x - this.x, dz = t.z - this.z, dl = Math.max(0.01, Math.hypot(dx, dz));
    const lat = Math.abs((t.vx * dz - t.vz * dx) / dl);
    let ev = clamp(lat * 0.035, 0, 0.45) + (t.st.C.evade || 0) + (t.jumping ? 0.25 : 0) + (t.boostT > 0 ? 0.3 : 0);
    acc *= 1 - ev * (1 - p.track);
    acc *= { light: 0.92, medium: 1, heavy: 1.06, assault: 1.12 }[t.st.wclass.id] || 1;
    if (p.guided) acc *= 1 - Math.min(0.5, t.ecm + t.flare);
    if (this.ai.cover && !p.indirect) acc *= 0.7;
    if (!this.ai.los && p.indirect) acc *= this.b.spotted(this.team, t) ? 0.85 : 0.5;
    acc *= 1 + (this.skill - 0.5) * 0.12;
    return clamp(acc, 0.03, 0.97);
  }
  shoot(w, t, extraPellet) {
    const p = w.p, b = this.b;
    const dist = dist2d(this.x, this.z, t.x, t.z);
    const hit = chance(this.hitChance(w, t, dist));
    const per = p.pellets || (p.kind === 'laser' || p.kind === 'missile' ? p.burst : 1);
    if (hit) w.s.hits += 1 / per;
    const from = this.muzzlePos(w.slot, { x: 0, y: 0, z: 0 });
    const aimComp = p.pellets ? null : this.pickAim(t);
    const pr = {
      owner: this, w, tgt: t, hit, from, comp: aimComp, dmg: p.dmg, dt: p.dt, t: 0, dur: 0, arc: p.arc || 0, splash: p.splash || 0,
      top: p.top ? chance(p.top) : false, vis: p.kind === 'missile' ? 'missile' : p.kind === 'artillery' ? 'shell' : p.kind === 'plasma' ? 'plasma' : 'bullet', big: p.dmg > 25, kind: p.kind,
    };
    // aim/miss point
    const lead = p.spd ? dist / p.spd : 0;
    const px = t.x + t.vx * lead, pz = t.z + t.vz * lead;
    if (!hit) {
      const ang = angTo(this.x, this.z, px, pz);
      const side = (chance(0.5) ? 1 : -1) * rand(t.radius * 0.8, t.radius * 2.4);
      let mx = px + Math.cos(ang) * side, mz = pz - Math.sin(ang) * side;
      if (p.arc) { mx += rand(-3, 3); mz += rand(-3, 3); pr.to = { x: mx, y: 0.2, z: mz }; }
      else {
        const ext = rand(10, 30);
        mx += Math.sin(ang) * ext; mz += Math.cos(ang) * ext;
        let tt = 1;
        for (const o of b.obstacles) { const k = segObstacle(o, from.x, from.z, mx, mz); if (k >= 0 && k < tt && o.h > 1.5) tt = k; }
        const yEnd = tt < 1 ? lerp(from.y, 1.2, tt) : rand(0.2, 2);
        pr.to = { x: lerp(from.x, mx, tt), y: yEnd, z: lerp(from.z, mz, tt) };
      }
    }
    const travel = hit ? dist : dist2d(from.x, from.z, pr.to.x, pr.to.z);
    if (!p.spd) { pr.dur = 0; b.resolveProjectile(pr, true); return; }
    pr.dur = Math.max(0.05, travel / p.spd) * (p.arc ? 1.25 : 1);
    pr.arcH = p.arc ? Math.max(6, travel * 0.18 * p.arc) : 0;
    b.projectiles.push(pr);
  }
  updateBeam(w, dt) {
    const bm = w.beam, t = bm.tgt, p = w.p;
    bm.t += dt;
    if (!t.alive || bm.t >= bm.dur || this.shutdown) { w.beam = null; return; }
    const dist = dist2d(this.x, this.z, t.x, t.z);
    if (dist > p.max * 1.1 || !this.ai.los) { w.beam = null; return; }
    if (bm.hit) {
      const dmg = (p.dmg / bm.dur) * dt;
      bm.acc = (bm.acc || 0) + dmg;
      if (bm.acc >= 4) { // apply in chunks so damage spreads across parts
        const comp = chance(0.5) ? bm.comp : null;
        this.b.applyHit(t, { dmg: bm.acc, dt: p.dt, from: this, w, comp, fx: this.x, fz: this.z, beam: true, melt: p.melt });
        bm.acc = 0;
      }
    }
  }
  meleeStrike(w, t) {
    const p = w.p;
    const dist = dist2d(this.x, this.z, t.x, t.z);
    if (dist > p.max + this.radius * 0.8 + t.radius * 0.8) return;
    const hit = chance(this.hitChance(w, t, 0));
    this.b.ev({ t: 'melee', u: this, w, tgt: t, hit });
    if (!hit) return;
    w.s.hits++;
    this.b.applyHit(t, { dmg: p.dmg, dt: p.dt, from: this, w, comp: this.pickAim(t), fx: this.x, fz: this.z, sever: p.sever, stagger: p.stagger, knock: p.knock });
  }

  // ---------------- damage ----------------
  damageComp(k, amt, attacker, w, internal) {
    const c = this.comps[k];
    if (!c || !c.alive || amt <= 0) return 0;
    if (this.dummy && k === 'torso') amt = Math.min(amt, Math.max(0, c.hp - 1));
    c.hp -= amt;
    this.s.structTaken += amt;
    let over = 0;
    if (c.hp <= 0) { over = -c.hp; c.hp = 0; this.destroyComp(k, attacker, w); }
    if (k === 'torso' && !internal && this.alive && chance(0.3 * (this.ptrait.nerve ? 0.7 : 1))) {
      const ints = INTERNAL.filter((x) => this.alive_(x));
      if (ints.length) {
        const ik = pick(ints);
        this.damageComp(ik, amt * 0.5, attacker, w, true);
        const cp = this.st.cores.find((cc) => cc.slot === ik);
        if (cp && cp.part.cook && this.alive_(ik)) this.cookCheck(cp.part, 0.12, attacker);
      }
    }
    return over;
  }
  cookCheck(part, base, attacker) {
    const ammoW = this.weapons.filter((w) => w.p.ammo);
    if (!ammoW.length) return;
    const frac = ammoW.reduce((a, w) => a + w.ammo / Math.max(1, w.ammoMax), 0) / ammoW.length;
    if (chance(base * part.cook * frac)) {
      this.s.cookoffs++;
      this.b.ev({ t: 'cookoff', u: this });
      this.b.log(this.label() + ' | Ammo cook off!', 'bad');
      for (const w of ammoW) w.ammo = Math.floor(w.ammo * 0.5);
      this.damageComp('torso', 80 + 70 * frac, attacker, null, true);
      const ints = INTERNAL.filter((x) => this.alive_(x));
      if (ints.length) this.damageComp(pick(ints), 55, attacker, null, true);
    }
  }
  destroyComp(k, attacker, w) {
    const c = this.comps[k];
    c.alive = false;
    const b = this.b;
    if (k === 'torso') { b.kill(this, attacker, w); return; }
    const partName = this.compPartName(k);
    this.s.partsLost.push({ k, name: COMP_NAMES[k], part: partName, t: b.t });
    b.ev({ t: 'compDestroyed', u: this, comp: k });
    b.log(this.label() + ' | ' + COMP_NAMES[k] + (partName ? ' (' + partName + ')' : '') + ' destroyed', this.team === 0 ? 'bad' : 'good');
    if (k === 'reactor') {
      if (chance(0.6)) { this.meltdown = 2.5; b.ev({ t: 'meltdown', u: this }); b.log(this.label() + ' | Reactor breach! Meltdown imminent', 'bad'); }
    }
    const cp = this.st.cores.find((cc) => cc.slot === k);
    if (cp && cp.part.cook) this.cookCheck(cp.part, 0.6, attacker);
    if ((k === 'shL' || k === 'shR' || k === 'back') && PARTS[this.design.parts[k]] && PARTS[this.design.parts[k]].ammo) {
      this.cookCheck({ cook: 0.5 }, 0.3, attacker);
    }
    if (k === 'armL' || k === 'armR') { if (this.shields[k]) this.shields[k].hp = 0; }
    this.recalc();
  }
  compPartName(k) {
    if (k === 'legL' || k === 'legR') return '';
    if (k === 'head') return this.st.H.name;
    if (k === 'reactor') return this.st.R.name;
    if (k.startsWith('core')) { const c = this.st.cores.find((cc) => cc.slot === k); return c ? c.part.name : ''; }
    const p = PARTS[this.design.parts[k]];
    return p ? p.name : '';
  }
}

// ---------------------------------------------------------------------
// BATTLE
// ---------------------------------------------------------------------
class Battle {
  constructor(cfg) {
    this.cfg = cfg;
    this.mapId = cfg.map;
    const map = MAPS[cfg.map];
    this.map = map;
    this.hx = map.hx; this.hz = map.hz;
    this.obstacles = map.gen(mulberry32(hashStr('map_' + cfg.map)));
    this.nav = new NavGrid(this.hx, this.hz, this.obstacles);
    this.units = []; this.projectiles = []; this.events = []; this.logs = [];
    this.nextId = 1; this.t = cfg.countdown != null ? -cfg.countdown : -3;
    this.over = false; this.result = null; this.timeLimit = cfg.timeLimit || 240;
    this.orders = cfg.orders || ['aggressive', 'aggressive'];
    this.focus = [null, null];
    this.headless = !!cfg.headless;
    this._spot = {};
    cfg.teams.forEach((team, ti) => {
      const n = team.length;
      team.forEach((uc, i) => {
        const spread = Math.min(12, (this.hx * 1.4) / Math.max(1, n));
        const x = (i - (n - 1) / 2) * spread + (uc.dx || 0);
        const z = (ti === 0 ? -1 : 1) * (this.hz - 12) + (uc.dz || 0);
        const spot = this.freeSpot(x, z);
        const u = new Unit(this, Object.assign({}, uc, { x: spot.x, z: spot.z, heading: ti === 0 ? 0 : Math.PI }), ti, i);
        this.units.push(u);
      });
    });
  }
  freeSpot(x, z) {
    for (let r = 0; r < 30; r += 2) for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (!this.obstacles.some((o) => pointInObstacle(o, px, pz, 4))) return { x: clamp(px, -this.hx + 4, this.hx - 4), z: clamp(pz, -this.hz + 4, this.hz - 4) };
      if (r === 0) break;
    }
    return { x, z };
  }
  ev(e) { if (!this.headless) this.events.push(e); }
  log(text, cls = '') { this.logs.push({ t: this.t, text, cls }); if (this.logs.length > 60) this.logs.shift(); }
  enemiesOf(team) { return this.units.filter((u) => u.team !== team && u.alive); }
  alliesOf(team) { return this.units.filter((u) => u.team === team && u.alive); }

  los(x0, z0, x1, z1, tgt) {
    let lowCover = false;
    for (const o of this.obstacles) {
      const k = segObstacle(o, x0, z0, x1, z1);
      if (k < 0 || k > 0.995) continue;
      if (o.h >= 2.6) return { clear: false, cover: false };
      // low cover counts only when it shelters the target end
      const len = Math.hypot(x1 - x0, z1 - z0);
      if ((1 - k) * len < 9) lowCover = true;
    }
    return { clear: true, cover: lowCover };
  }
  spotted(team, t) {
    const key = team + ':' + t.uid;
    const c = this._spot[key];
    if (c && c.t === this.tick) return c.v;
    let v = false;
    for (const u of this.units) {
      if (!u.alive || u.team !== team) continue;
      const d = dist2d(u.x, u.z, t.x, t.z);
      if (d <= u.sensor && this.los(u.x, u.z, t.x, t.z).clear) { v = true; break; }
    }
    this._spot[key] = { t: this.tick, v };
    return v;
  }

  step(dt) {
    this.tick = (this.tick || 0) + 1;
    this.t += dt;
    for (const u of this.units) u.update(dt);
    // projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.t += dt;
      if (pr.t >= pr.dur) { this.projectiles.splice(i, 1); this.resolveProjectile(pr, false); }
    }
    // heat logging for report
    if (this.t >= 0 && (this.tick % 30 === 0)) for (const u of this.units) if (u.alive && u.team === 0) u.s.heatLog.push(Math.round(u.heatFrac * 100));
    if (!this.over) this.checkEnd();
    else this.afterT += dt;
    if (this.headless) this.events.length = 0;
  }
  // world position of a projectile's end point (for hits it follows the target)
  projEnd(pr, out) {
    if (pr.hit && pr.tgt) { pr.tgt.compPos(pr.comp || 'torso', out); return out; }
    out.x = pr.to.x; out.y = pr.to.y; out.z = pr.to.z;
    return out;
  }
  resolveProjectile(pr, instant) {
    const t = pr.tgt, p = pr.w.p;
    const end = this.projEnd(pr, { x: 0, y: 0, z: 0 });
    this.ev({ t: 'impact', pr, x: end.x, y: end.y, z: end.z, instant, hit: pr.hit && t.alive });
    if (pr.hit && t.alive) {
      this.applyHit(t, { dmg: pr.dmg, dt: pr.dt, from: pr.owner, w: pr.w, comp: pr.comp, fx: pr.from.x, fz: pr.from.z, top: pr.top, pierce: p.pierce, stagger: p.stagger, knock: p.knock, tHeat: p.tHeat, falloff: p.falloff });
    }
    if (pr.splash) {
      const R = pr.splash;
      for (const u of this.units) {
        if (!u.alive || u.team === pr.owner.team) continue;
        if (pr.hit && u === t) continue;
        const d = dist2d(u.x, u.z, end.x, end.z) - u.radius * 0.5;
        if (d < R) this.applyHit(u, { dmg: pr.dmg * 0.4 * (1 - Math.max(0, d) / R), dt: pr.dt, from: pr.owner, w: pr.w, comp: null, fx: end.x, fz: end.z, top: pr.top, splash: true, tHeat: p.tHeat ? p.tHeat * 0.5 : 0 });
      }
      this.ev({ t: 'blast', x: end.x, y: end.y, z: end.z, size: R / 4 });
    }
  }
  facingFrom(t, fx, fz) {
    const rel = angDiff(t.heading, angTo(t.x, t.z, fx, fz));
    const a = Math.abs(rel);
    if (a <= Math.PI / 4) return 'f';
    if (a >= Math.PI * 0.75) return 'b';
    return rel > 0 ? 'l' : 'r';
  }
  applyHit(t, h) {
    if (!t.alive) return;
    const a = h.from;
    let dmg = h.dmg;
    if (a && a.ptrait && a.ptrait.close && dist2d(a.x, a.z, t.x, t.z) < 20) dmg *= 1 + a.ptrait.close;
    if (h.falloff) { const d = dist2d(a.x, a.z, t.x, t.z); dmg *= clamp(1.15 - (d / h.w.p.max) * 0.75, 0.35, 1.15); }
    const facing = h.top ? 't' : this.facingFrom(t, h.fx, h.fz);
    t.lastHitT = this.t; t.lastAttacker = a;
    const raw = dmg;
    // active barrier
    if (t.barrier > 0) {
      const ab = Math.min(t.barrier, dmg);
      t.barrier -= ab; dmg -= ab; t.s.barrierAbs += ab;
      this.ev({ t: 'barrier', u: t });
      if (dmg <= 0) { this.credit(a, h.w, raw); return; }
    }
    if (t.hasReflex && t.reflexCd <= 0) { dmg *= 0.4; t.reflexCd = 3; this.ev({ t: 'reflex', u: t }); }
    // shield block
    for (const k of ['armL', 'armR']) {
      const sh = t.shields[k];
      if (!sh || sh.hp <= 0 || !t.alive_(k)) continue;
      if (!(facing === 'f' || (k === 'armL' && facing === 'l') || (k === 'armR' && facing === 'r'))) continue;
      if (h.splash || h.beam && chance(0.5)) continue;
      if (chance(sh.block)) {
        const sd = dmg * 0.85;
        sh.hp -= sd; sh.absorbed += sd;
        this.ev({ t: 'hit', u: t, comp: k, facing, dmg: sd, shield: true, dt: h.dt, raw });
        if (sh.hp <= 0) { sh.hp = 0; this.ev({ t: 'shieldBroken', u: t, comp: k }); this.log(t.label() + ' | Shield shattered', t.team === 0 ? 'bad' : 'good'); }
        this.credit(a, h.w, sd);
        this.afterHitEffects(t, h, a);
        return;
      }
    }
    // deflect
    if (!h.splash && !h.beam && chance(t.st.deflect[facing] || 0)) { dmg *= 0.25; t.s.deflects++; this.ev({ t: 'deflect', u: t, facing }); }
    // armor type
    let amod = t.st.A.mods[h.dt] || 1;
    if (h.dt === 'exp') amod *= 1 - (t.st.expRes[facing] || 0);
    if (h.melt) amod *= h.melt;
    let toArmor = dmg * amod;
    let direct = 0;
    if (h.pierce) { direct = dmg * h.pierce; toArmor = dmg * (1 - h.pierce) * amod; }
    const bleed = toArmor * 0.1;
    toArmor -= bleed;
    const ar = t.armor[facing];
    const absorbed = Math.min(ar, toArmor);
    t.armor[facing] = ar - absorbed;
    t.s.armorAbsorbed[facing] += absorbed;
    let struct = direct + bleed / amod + (toArmor - absorbed) / amod;
    if (ar > 0 && t.armor[facing] <= 0) {
      t.s.armorBrokeAt[facing] = this.t;
      this.ev({ t: 'armorBroken', u: t, facing });
      this.log(t.label() + ' | ' + FACING_NAMES[facing] + ' armor breached', t.team === 0 ? 'bad' : 'good');
    }
    t.s.dmgTaken[facing] += dmg;
    // component selection
    let comp = this.pickComp(t, facing, h.comp, a, h.splash);
    let sd = struct;
    if (h.sever && (comp.startsWith('arm') || comp.startsWith('leg'))) sd *= h.sever;
    if (comp === 'armL' || comp === 'armR') {
      // unblocked shield arm hits still wear the shield
      const sh = t.shields[comp];
      if (sh && sh.hp > 0) { sh.hp = Math.max(0, sh.hp - sd * 0.5); sd *= 0.5; }
    }
    const over = t.damageComp(comp, sd, a, h.w);
    if (over > 0 && t.alive && comp !== 'torso') t.damageComp('torso', over * 0.5, a, h.w);
    this.ev({ t: 'hit', u: t, comp, facing, dmg, dt: h.dt, raw, armorHit: absorbed > 0, struct: sd, beam: h.beam, splash: h.splash, kind: h.w ? h.w.p.kind : '' });
    this.credit(a, h.w, dmg);
    this.afterHitEffects(t, h, a);
  }
  afterHitEffects(t, h, a) {
    if (!t.alive) return;
    if (h.tHeat) t.addHeat(h.tHeat);
    if (h.stagger) {
      const res = t.st.C.stagRes || 0;
      const light = t.st.wclass.id === 'light';
      if (h.w && h.w.p.id === 'w_ac' && !light) return;
      if (t.stagger < -0.9) t.stagger = h.stagger * (1 - res);
    }
    if (h.knock && a && !(t.st.C.stagRes >= 1)) {
      const ang = angTo(a.x, a.z, t.x, t.z), k = h.knock * (1 - (t.st.C.stagRes || 0));
      t.vx += Math.sin(ang) * k * 3; t.vz += Math.cos(ang) * k * 3;
    }
    if (h.dmg >= 30) { t.ai.bigHit = this.t; this.ev({ t: 'bigHit', u: t, dmg: h.dmg }); }
  }
  credit(a, w, dmg) {
    if (!a) return;
    a.s.dealt += dmg;
    if (w) w.s.dmg += dmg;
  }
  pickComp(t, facing, aim, a, splash) {
    const tbl = HIT_TABLE[facing];
    const entries = [];
    const lowCover = a && a.ai && a.ai.cover && !splash;
    for (const k in tbl) {
      if (!t.alive_(k)) continue;
      let wgt = tbl[k];
      if (lowCover && (k === 'legL' || k === 'legR')) continue;
      if (aim && aim === k && a) wgt *= 1 + 2.5 * a.skill;
      entries.push([k, wgt]);
    }
    return weightedPick(entries) || 'torso';
  }
  kill(u, killer, w) {
    if (!u.alive) return;
    u.alive = false; u.dead = true; u.wreck = true; u.deathT = this.t;
    u.vx = u.vz = 0;
    for (const ww of u.weapons) { ww.beam = null; ww.burstLeft = 0; ww.charging = 0; }
    if (killer && killer !== u) killer.s.kills++;
    const remaining = this.enemiesOf(killer ? killer.team : 1 - u.team).length;
    const final = this.alliesOf(u.team).length === 0;
    this.lastKill = { u, killer, w, t: this.t, final };
    this.ev({ t: 'unitDestroyed', u, killer, w, final });
    this.log(u.label() + ' destroyed' + (killer && killer !== u ? ' by ' + killer.label() : ''), u.team === 0 ? 'bad' : 'good');
  }
  reactorBlast(u) {
    const R = u.st.R, mult = R.blast || 1;
    this.ev({ t: 'reactorBlast', u, size: mult });
    const atk = u.lastAttacker;
    this.kill(u, atk, null);
    for (const o of this.units) {
      if (o === u || !o.alive) continue;
      const d = dist2d(o.x, o.z, u.x, u.z);
      const rad = 12 * mult;
      if (d < rad) this.applyHit(o, { dmg: 130 * mult * (1 - d / rad), dt: 'exp', from: null, w: null, comp: null, fx: u.x, fz: u.z, splash: true });
    }
  }
  checkEnd() {
    const alive0 = this.units.some((u) => u.team === 0 && u.alive && !u.dummy);
    const alive1 = this.units.some((u) => u.team === 1 && u.alive && !u.dummy);
    const team1Real = this.units.some((u) => u.team === 1 && !u.dummy);
    let winner = null;
    if (!alive0) winner = 1;
    else if (team1Real && !alive1) winner = 0;
    else if (this.t >= this.timeLimit) {
      const score = (team) => this.units.filter((u) => u.team === team).reduce((a, u) => a + (u.alive ? u.hpFrac : 0), 0) / Math.max(1, this.units.filter((u) => u.team === team).length);
      winner = this.cfg.practice ? 0 : score(0) >= score(1) ? 0 : 1;
      this.timeout = true;
    }
    if (winner != null) {
      this.over = true; this.afterT = 0;
      this.result = { winner, time: Math.max(0, this.t), timeout: !!this.timeout };
      this.ev({ t: 'over', winner });
    }
  }
  forfeit() {
    if (this.over) return;
    this.over = true; this.afterT = 0;
    this.result = { winner: this.cfg.practice ? 0 : 1, time: Math.max(0, this.t), forfeit: true };
    this.ev({ t: 'over', winner: this.result.winner });
  }
}

// Run a full battle without rendering (balance testing and quick sims)
function simulateBattle(cfg, maxT = 300) {
  const b = new Battle(Object.assign({}, cfg, { headless: true, countdown: 0 }));
  let n = 0;
  while (!b.over && n < maxT * 60) { b.step(SIM_DT); n++; }
  return b;
}
