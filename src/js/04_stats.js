// =====================================================================
// 04 | SYSTEMS | BUILD STATS, VALIDATION, RULES, TOOLTIPS
// =====================================================================
const BASE_HEATCAP = 40, BASE_DISSIP = 3.5;
const KIND_NAMES = { ballistic: 'Ballistic', rail: 'Railgun', laser: 'Laser', beam: 'Beam Laser', plasma: 'Plasma', flame: 'Flamer', missile: 'Missile', artillery: 'Artillery', melee: 'Melee', shield: 'Shield' };

function weaponDps(p) {
  if (!p || p.slot !== 'weapon' || p.kind === 'shield') return 0;
  const n = p.pellets || p.burst || 1;
  return p.dmg * n * p.rof * p.acc;
}
function weaponAlpha(p) { return p && p.slot === 'weapon' ? p.dmg * (p.pellets || p.burst || 1) : 0; }

function computeStats(d, pilot) {
  const s = { errors: [], warnings: [] };
  const g = (id) => (id ? PARTS[id] : null);
  const ch = g(d.parts.chassis), lg = g(d.parts.legs), ts = g(d.parts.torso), hd = g(d.parts.head), rc = g(d.parts.reactor);
  const at = g(d.armor) || PARTS.a_std;
  for (const sl of ['chassis', 'legs', 'torso', 'head', 'reactor']) if (!g(d.parts[sl])) s.errors.push('Missing ' + SLOT_BY_ID[sl].name);
  const C = ch || PARTS.c_wsp, L = lg || PARTS.l_str, T = ts || PARTS.t_box, H = hd || PARTS.h_opt, R = rc || PARTS.r_emb;
  s.C = C; s.L = L; s.T = T; s.H = H; s.R = R; s.A = at;
  let wt = 0, cost = 0, draw = 0, supply = 0, hcap = BASE_HEATCAP, dis = BASE_DISSIP, acc = 0, gacc = 0, ammoB = 0, flare = 0, ecm = 0, stab = L.stab, turnB = 0;
  const add = (p) => {
    if (!p) return;
    wt += p.wt || 0; cost += p.cost || 0;
    if (p.pw > 0) draw += p.pw; else if (p.pw < 0) supply += -p.pw;
    hcap += p.hcap || 0; dis += p.dis || 0; if (p.slot !== 'weapon') acc += p.acc || 0; gacc += p.gacc || 0; ammoB += p.ammoB || 0;
    flare += p.flare || 0; ecm += p.ecm || 0; stab += p.stab || 0; turnB += p.turnB || 0; supply += p.pwOut || 0;
  };
  add(ch); add(lg); add(ts); add(hd);
  if (rc) { wt += rc.wt; cost += rc.cost; supply += rc.out; dis += rc.dis || 0; }

  const weapons = [];
  s.sys = {};
  for (const sl of WEAPON_SLOTS) {
    const p = g(d.parts[sl]);
    if (!p) continue;
    const slot = SLOT_BY_ID[sl];
    if (p.slot === 'weapon' && !p.mounts.includes(slot.mount)) s.errors.push(p.name + ' cannot mount on ' + slot.name);
    if (p.slot === 'back' && sl !== 'back') s.errors.push(p.name + ' needs the Back Mount');
    if (p.slot !== 'weapon' && p.slot !== 'back') { s.errors.push(p.name + ' does not fit ' + slot.name); continue; }
    add(p);
    if (p.slot === 'weapon') weapons.push({ slot: sl, part: p });
    else s.sys.back = p;
  }
  const ncore = T.core;
  const cores = [];
  (d.parts.core || []).forEach((id, i) => {
    const p = g(id);
    if (!p) return;
    if (i >= ncore) { s.warnings.push(p.name + ' is offline | ' + T.name + ' has ' + ncore + ' core slots'); return; }
    add(p); cores.push({ slot: 'core' + i, part: p });
  });

  // armor
  const armor = {};
  for (const f of FACINGS) armor[f] = (C.armor[f] || 0) + ((T.armorMod || {})[f] || 0);
  const deflect = { f: T.deflect || 0, l: 0, r: 0, b: 0, t: 0 };
  const expRes = { f: 0, l: 0, r: 0, b: 0, t: 0 };
  let plateWt = 0, plateCount = 0;
  const modules = [];
  for (const [mid, pid] of Object.entries(d.plates || {})) {
    const m = MOUNT_BY_ID[mid], p = g(pid);
    if (!m || !p) continue;
    if ((m.comp === 'armL' && !d.parts.armL) || (m.comp === 'armR' && !d.parts.armR)) continue;
    if (p.slot === 'plate') {
      armor[m.facing] += p.ap; plateWt += p.extraWt || 0; plateCount++;
      deflect[m.facing] += p.deflect || 0; expRes[m.facing] += p.expRes || 0; cost += p.cost;
    } else if (p.slot === 'module') { add(p); modules.push({ mount: mid, part: p }); }
  }
  for (const f of FACINGS) { deflect[f] = Math.min(0.3, deflect[f]); expRes[f] = Math.min(0.5, expRes[f]); armor[f] = Math.max(0, armor[f]); }
  flare = Math.min(0.3, flare);
  const apts = FACINGS.reduce((a, f) => a + armor[f], 0);
  const armorWt = (apts / ARMOR_PER_TON) * at.wmul + plateWt;
  wt += armorWt; cost += at.cost;

  const cap = C.cap + L.cap;
  const load = wt / cap;
  const pt = pilot ? PILOT_TRAITS[pilot.trait] || {} : {};
  let speed = L.spd * (C.spd || 1) * clamp(1.12 - 0.32 * load, 0.6, 1.1) * (1 + (pt.spd || 0));
  const turn = L.turn * (T.turn || 1) * (C.turn || 1) * (1 + turnB) * clamp(1.1 - 0.3 * load, 0.6, 1.05);

  // weapon summary
  let dps = 0, alpha = 0, heatPS = 0, ammoWarn = [];
  const wsum = [];
  for (const w of weapons) {
    const p = w.part;
    const ammo = p.ammo ? Math.round(p.ammo * (1 + ammoB)) : 0;
    const wd = weaponDps(p);
    dps += wd; alpha += weaponAlpha(p);
    heatPS += (p.ht || 0) * (p.rof || 0);
    if (p.ammo && p.rof && ammo / p.rof < 28) ammoWarn.push(p.name);
    wsum.push({ slot: w.slot, part: p, ammo, dps: wd, heatPS: (p.ht || 0) * (p.rof || 0) });
  }
  hcap = Math.max(10, hcap);
  if (R.pheat) heatPS += R.pheat;
  const net = heatPS - dis;
  const tOver = net > 0 ? hcap / net : Infinity;
  const pwEff = draw > 0 ? Math.min(1, supply / draw) : 1;
  const sustained = dps * Math.min(1, heatPS > 0 ? dis / heatPS : 1) * pwEff;

  // components
  const hpm = C.hpm;
  const comps = { torso: T.hp * hpm, head: H.hp * hpm, legL: L.hp * hpm, legR: L.hp * hpm, reactor: R.hp * hpm };
  for (const sl of WEAPON_SLOTS) {
    const p = g(d.parts[sl]);
    if (!p || (p.slot !== 'weapon' && p.slot !== 'back')) continue;
    if (sl === 'armL' || sl === 'armR') comps[sl] = 80 * hpm + (p.kind === 'shield' ? 50 : p.hp);
    else comps[sl] = (p.hp || 70) + 18 * hpm;
  }
  cores.forEach((c) => { comps[c.slot] = c.part.hp; });
  const structure = Object.values(comps).reduce((a, b) => a + b, 0);

  // range profile
  let optSum = 0, optW = 0, maxR = 0, minOpt = 999;
  for (const w of wsum) {
    if (w.part.kind === 'shield') continue;
    const wgt = Math.max(0.5, w.dps);
    optSum += w.part.opt * wgt; optW += wgt;
    maxR = Math.max(maxR, w.part.max); minOpt = Math.min(minOpt, w.part.opt);
  }
  const prefRange = optW ? optSum / optW : 20;

  const wc = weightClass(wt);
  if (wt > cap + 1e-6) s.errors.push('Overweight | ' + fmt1(wt) + 't of ' + fmt1(cap) + 't capacity');
  if (draw > supply + 1e-6) s.errors.push('Power overload | Draw ' + fmt1(draw) + ' of ' + fmt1(supply));
  if (wt > 100 + 1e-6) s.errors.push('Over 100t | No weight class allows this');
  if (!wsum.filter((w) => w.part.kind !== 'shield').length) s.warnings.push('No weapons installed');
  if (tOver < 12) s.warnings.push('Runs hot | Overheats in ' + fmt1(tOver) + 's at full fire');
  if (ammoWarn.length) s.warnings.push('Low ammo | ' + ammoWarn.join(' | '));
  if (armor.b < 40) s.warnings.push('Thin rear armor | ' + Math.round(armor.b) + ' points');
  if (wsum.filter((w) => w.part.kind === 'shield').length > 1) s.warnings.push('Two shields | Very little firepower');
  if (cores.some((c) => c.part.cook) && wsum.some((w) => w.part.ammo)) s.info = 'Ammo bins can cook off';

  Object.assign(s, {
    weight: wt, cap, load, wclass: wc, speed, turn, armor, apts, armorWt, deflect, expRes,
    heatCap: hcap, dissip: dis, heatPS, net, tOver,
    supply, draw, pwEff, acc, gacc, ammoB, flare, ecm, stab: Math.min(1, stab),
    weapons: wsum, dps, sustained, alpha, cost, comps, structure, prefRange, maxRange: maxR, minOpt,
    cores, modules, plateCount, sensor: H.sensor, legType: L.type,
    valid: s.errors.length === 0,
  });
  return s;
}

// --- design restrictions ---------------------------------------------
function checkRule(rule, d, st) {
  const v = [];
  if (!rule) return v;
  const wps = st.weapons.map((w) => w.part);
  if (rule.noDtype && wps.some((p) => p.dt === rule.noDtype && p.kind !== 'shield')) v.push('No ' + DTYPES[rule.noDtype].name.toLowerCase() + ' weapons allowed');
  if (rule.meleeOnly && (wps.some((p) => p.kind !== 'melee' && p.kind !== 'shield') || !wps.some((p) => p.kind === 'melee'))) v.push('Melee weapons and shields only');
  if (rule.noPlates && st.plateCount > 0) v.push('Remove all armor plates');
  if (rule.maxCost && st.cost > rule.maxCost) v.push('Build cost must be under ' + fmt(rule.maxCost));
  if (rule.maxT && st.weight > rule.maxT + 1e-6) v.push('Build must be under ' + rule.maxT + 't');
  if (rule.noKind && wps.some((p) => rule.noKind.includes(p.kind))) v.push('No ' + rule.noKind.map((k) => KIND_NAMES[k].toLowerCase()).join(' or ') + ' weapons');
  if (rule.legsType && st.legType !== rule.legsType) v.push('Legs must be ' + rule.legsType);
  if (rule.noCooling) {
    const hasCool = st.cores.some((c) => c.part.dis) || (st.sys.back && st.sys.back.dis) || st.modules.some((m) => m.part.dis);
    if (hasCool) v.push('No heatsinks, radiators or fins');
  }
  return v;
}
function ruleText(rule) {
  const parts = [];
  if (!rule) return '';
  if (rule.noDtype) parts.push('No ' + DTYPES[rule.noDtype].name + ' weapons');
  if (rule.meleeOnly) parts.push('Melee only');
  if (rule.noPlates) parts.push('No plates');
  if (rule.maxCost) parts.push('Cost under ' + fmt(rule.maxCost));
  if (rule.maxT) parts.push('Under ' + rule.maxT + 't');
  if (rule.noKind) parts.push('No ' + rule.noKind.map((k) => KIND_NAMES[k]).join(' or '));
  if (rule.legsType) parts.push('Hover legs');
  if (rule.noCooling) parts.push('No cooling parts');
  return parts.join(' | ');
}

// --- tooltip stat rows -------------------------------------------------
// each row: [label, value, higherIsBetter (true/false/null), unit]
function partRows(p) {
  if (!p) return [];
  const r = [];
  const add = (l, v, hb = null, u = '') => r.push([l, v, hb, u]);
  switch (p.slot) {
    case 'weapon':
      if (p.kind === 'shield') { add('Shield', p.shield, true); add('Block chance', Math.round(p.block * 100), true, '%'); break; }
      add('Damage', +(p.dmg * (p.pellets || p.burst || 1)).toFixed(1), true);
      if (p.pellets) add('Pellets', p.pellets, null); else if (p.burst > 1) add('Volley', p.burst + ' x ' + p.dmg, null);
      add('Est DPS', +weaponDps(p).toFixed(1), true);
      add('Fire rate', +p.rof.toFixed(2), true, '/s');
      add('Accuracy', Math.round(p.acc * 100), true, '%');
      add('Optimal range', p.opt, true, 'm');
      add('Max range', p.max, true, 'm');
      if (p.min) add('Min range', p.min, false, 'm');
      add('Heat', p.ht, false, '/shot');
      add('Ammo', p.ammo ? p.ammo : 'None', true);
      break;
    case 'chassis':
      add('Capacity', p.cap, true, 't');
      add('Armor F|L|R|B|T', FACINGS.map((f) => p.armor[f]).join(' | '));
      add('Armor total', FACINGS.reduce((a, f) => a + p.armor[f], 0), true);
      add('Structure', Math.round(p.hpm * 100), true, '%');
      break;
    case 'legs':
      add('Type', p.type[0].toUpperCase() + p.type.slice(1));
      add('Capacity', '+' + p.cap, null, 't'); r[r.length - 1][1] = p.cap; r[r.length - 1][2] = true;
      add('Speed', p.spd, true);
      add('Turn rate', p.turn, true, 'deg/s');
      add('Stability', Math.round(p.stab * 100), true, '%');
      add('Leg health', p.hp, true);
      break;
    case 'torso':
      add('Core slots', p.core, true);
      add('Health', p.hp, true);
      add('Twist', p.twist, true, 'deg');
      if (p.armorMod) add('Armor bonus', Object.entries(p.armorMod).map(([f, v]) => FACING_NAMES[f] + ' ' + (v > 0 ? '+' : '') + v).join(' | '));
      break;
    case 'head':
      add('Accuracy', Math.round(p.acc * 100), true, '%');
      if (p.gacc) add('Guided accuracy', Math.round(p.gacc * 100), true, '%');
      add('Sensor range', p.sensor, true, 'm');
      add('Health', p.hp, true);
      break;
    case 'reactor':
      add('Power output', p.out, true);
      add('Health', p.hp, true);
      if (p.dis) add('Dissipation', p.dis, true);
      if (p.pheat) add('Waste heat', p.pheat, false, '/s');
      break;
    case 'core': case 'back':
      if (p.dis) add('Dissipation', p.dis, true, '/s');
      if (p.hcap) add('Heat capacity', p.hcap, true);
      if (p.ammoB) add('Ammo bonus', Math.round(p.ammoB * 100), true, '%');
      if (p.ecm) add('ECM', Math.round(p.ecm * 100), true, '%');
      if (p.barrier) add('Barrier', p.barrier, true);
      if (p.repair) add('Repair', p.repair, true, '/s');
      if (p.rpool) add('Repair pool', p.rpool, true);
      if (p.acc) add('Accuracy', Math.round(p.acc * 100), true, '%');
      if (p.jump) add('Jump cooldown', p.jump, false, 's');
      if (p.boost) add('Boost cooldown', p.boost, false, 's');
      if (p.pw < 0) add('Power supply', -p.pw, true);
      add('Health', p.hp, true);
      break;
    case 'armor':
      for (const k of Object.keys(DTYPES)) add('Vs ' + DTYPES[k].name, Math.round(p.mods[k] * 100), false, '%');
      add('Weight factor', Math.round(p.wmul * 100), false, '%');
      break;
    case 'plate':
      add('Armor', p.ap, true);
      add('Weight', +((p.ap / ARMOR_PER_TON) + (p.extraWt || 0)).toFixed(2), false, 't');
      break;
    case 'module':
      if (p.dis) add('Dissipation', p.dis, true);
      if (p.acc) add('Accuracy', Math.round(p.acc * 100), true, '%');
      if (p.flare) add('Missile evasion', Math.round(p.flare * 100), true, '%');
      if (p.ammoB) add('Ammo bonus', Math.round(p.ammoB * 100), true, '%');
      if (p.pwOut) add('Power supply', p.pwOut, true);
      break;
  }
  if (p.slot !== 'armor' && p.slot !== 'plate') add('Weight', p.wt || 0, false, 't');
  if (p.pw > 0) add('Power draw', p.pw, false);
  if (p.hp && p.slot !== 'head' && p.slot !== 'torso' && p.slot !== 'reactor' && p.slot !== 'core' && p.slot !== 'back') add('Part health', p.hp, true);
  add('Cost', p.cost, false, 'cr');
  return r;
}

function partTooltipHTML(p, cur) {
  const rows = partRows(p);
  const crow = cur && cur.id !== p.id ? Object.fromEntries(partRows(cur).map((x) => [x[0], x])) : {};
  const sub = [SLOT_LABEL[p.slot]];
  if (p.slot === 'weapon') { sub.push(KIND_NAMES[p.kind]); if (p.kind !== 'shield') sub.push(DTYPES[p.dt].name); sub.push(p.mounts.split('').map((m) => MOUNT_NAMES[m]).join(' or ')); }
  sub.push(FACTIONS[p.maker].short, 'Tier ' + p.tier);
  let h = '<div class="tt-title">' + esc(p.name) + '</div><div class="tt-sub">' + esc(sub.join(' | ')) + '</div>';
  h += '<div class="tt-trait">' + esc(p.trait || '') + '</div><table class="tt-table">';
  for (const [l, v, hb, u] of rows) {
    let delta = '';
    const c = crow[l];
    if (c && typeof v === 'number' && typeof c[1] === 'number' && v !== c[1] && hb !== null) {
      const dv = v - c[1];
      const good = hb ? dv > 0 : dv < 0;
      delta = '<span class="' + (good ? 'up' : 'down') + '">' + (dv > 0 ? '▲' : '▼') + fmt1(Math.abs(dv)) + '</span>';
    }
    h += '<tr><td>' + esc(l) + '</td><td>' + esc(typeof v === 'number' ? fmt1(v) : v) + (u ? ' <i>' + esc(u) + '</i>' : '') + ' ' + delta + '</td></tr>';
  }
  h += '</table>';
  if (cur && cur.id !== p.id) h += '<div class="tt-cmp">Compared to installed | ' + esc(cur.name) + '</div>';
  else if (cur && cur.id === p.id) h += '<div class="tt-cmp">Currently installed</div>';
  return h;
}

function designCode(d) {
  const o = { n: d.name, p: d.parts, a: d.armor, m: d.plates, c: d.paint };
  return 'MF1:' + encodeText(o);
}
function parseDesignCode(code) {
  code = code.trim();
  if (!code.startsWith('MF1:')) throw new Error('Not a Mech Forge code');
  const o = decodeText(code.slice(4));
  if (!o || !o.p || !o.p.chassis) throw new Error('Code is damaged');
  const d = { id: uid(), name: String(o.n || 'Imported').slice(0, 24), parts: o.p, armor: o.a || 'a_std', plates: o.m || {}, mirror: true, paint: Object.assign({}, DEFAULT_PAINT, o.c || {}) };
  if (!Array.isArray(d.parts.core)) d.parts.core = [];
  while (d.parts.core.length < 4) d.parts.core.push(null);
  const okSlot = (id, slots) => !id || (PARTS[id] && slots.includes(PARTS[id].slot));
  const pp = d.parts;
  const ok = okSlot(pp.chassis, ['chassis']) && okSlot(pp.legs, ['legs']) && okSlot(pp.torso, ['torso']) && okSlot(pp.head, ['head']) && okSlot(pp.reactor, ['reactor']) &&
    ['armL', 'armR', 'shL', 'shR'].every((k) => okSlot(pp[k], ['weapon'])) && okSlot(pp.back, ['weapon', 'back']) && pp.core.every((c) => okSlot(c, ['core'])) && okSlot(d.armor, ['armor']);
  if (!ok) throw new Error('Code has unknown parts');
  for (const [m, p] of Object.entries(d.plates)) if (!MOUNT_BY_ID[m] || !PARTS[p] || !['plate', 'module'].includes(PARTS[p].slot)) delete d.plates[m];
  return d;
}
