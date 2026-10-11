// =====================================================================
// 03 | GAME STATE | SAVE AND LOAD
// =====================================================================
const SAVE_KEY = 'mechforge_save_v1';
let S = null;

function newPilot(isPlayer, rng = Math.random) {
  const traits = Object.keys(PILOT_TRAITS);
  return {
    id: uid(),
    name: isPlayer ? 'You' : PILOT_FIRST[Math.floor(rng() * PILOT_FIRST.length)] + ' ' + PILOT_LAST[Math.floor(rng() * PILOT_LAST.length)],
    call: isPlayer ? 'Rookie' : PILOT_CALLS[Math.floor(rng() * PILOT_CALLS.length)],
    trait: isPlayer ? 'marksman' : traits[Math.floor(rng() * traits.length)],
    level: 1, xp: 0, wins: 0, kills: 0, battles: 0,
    hue: Math.floor(rng() * 360),
  };
}

function newState() {
  const designs = STARTER_DESIGNS();
  const sb = STARTER_DESIGNS();
  return {
    v: 1,
    credits: 6000, rep: 0, tier: 1,
    beaten: {}, challenges: {},
    owned: Object.fromEntries(STARTER_PARTS.map((p) => [p, true])),
    designs, activeId: designs[0].id,
    sbDesigns: sb, sbActiveId: sb[0].id,
    pilots: [newPilot(true)],
    hire: [newPilot(false), newPilot(false), newPilot(false)],
    salvage: [], salvageLog: [],
    stats: { battles: 0, wins: 0, losses: 0, kills: 0, earned: 0 },
    settings: { vol: 0.6, sfx: true, quality: 'high', shake: true, log: true, dmgNums: true },
    mode: 'career',
    champion: false,
    squadPick: {},
    created: Date.now(),
  };
}

function migrate(s) {
  const base = newState();
  for (const k in base) if (s[k] === undefined) s[k] = base[k];
  for (const k in base.settings) if (s.settings[k] === undefined) s.settings[k] = base.settings[k];
  const fix = (d) => {
    if (!d.parts) return false;
    if (!Array.isArray(d.parts.core)) d.parts.core = [];
    while (d.parts.core.length < 4) d.parts.core.push(null);
    if (!d.plates) d.plates = {};
    if (!d.paint) d.paint = Object.assign({}, DEFAULT_PAINT);
    if (!d.armor) d.armor = 'a_std';
    return true;
  };
  s.designs = (s.designs || []).filter(fix);
  s.sbDesigns = (s.sbDesigns || []).filter(fix);
  if (!s.designs.length) s.designs = STARTER_DESIGNS();
  if (!s.sbDesigns.length) s.sbDesigns = STARTER_DESIGNS();
  if (!s.designs.find((d) => d.id === s.activeId)) s.activeId = s.designs[0].id;
  if (!s.sbDesigns.find((d) => d.id === s.sbActiveId)) s.sbActiveId = s.sbDesigns[0].id;
  if (!s.pilots || !s.pilots.length) s.pilots = [newPilot(true)];
  return s;
}

let _saveTimer = 0;
function save(now) {
  if (!S) return;
  const doit = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { console.warn('Save failed', e); } };
  if (now) { clearTimeout(_saveTimer); doit(); return; }
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(doit, 150);
}
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) { console.warn('Load failed', e); }
  return null;
}
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function resetSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  const settings = S ? S.settings : null;
  S = newState();
  if (settings) S.settings = settings;
  save(true);
}

// ---------- helpers ----------
const isSandbox = () => S.mode === 'sandbox';
const designList = () => (isSandbox() ? S.sbDesigns : S.designs);
function activeDesign() {
  const list = designList();
  const id = isSandbox() ? S.sbActiveId : S.activeId;
  return list.find((d) => d.id === id) || list[0];
}
function setActiveDesign(id) { if (isSandbox()) S.sbActiveId = id; else S.activeId = id; save(); }
function findDesign(id) { return designList().find((d) => d.id === id) || S.designs.find((d) => d.id === id); }
const ownsPart = (id) => !id || isSandbox() || !!S.owned[id];
const tierInfo = () => CAMPAIGN[Math.min(S.tier, 4) - 1];
const squadSlots = () => (isSandbox() ? 4 : tierInfo().squad);
const maxTons = () => (isSandbox() ? 100 : tierInfo().maxT);
function addCredits(n) { S.credits = Math.max(0, Math.round(S.credits + n)); if (n > 0) S.stats.earned += n; save(); }
function addRep(n) { S.rep = Math.max(0, Math.round(S.rep + n)); save(); }
function partUnlockedForShop(p) { return p.tier <= S.tier; }
function lockedPartsIn(d) {
  if (isSandbox()) return [];
  const ids = [d.parts.chassis, d.parts.legs, d.parts.torso, d.parts.head, d.parts.reactor, d.parts.armL, d.parts.armR, d.parts.shL, d.parts.shR, d.parts.back, ...d.parts.core, d.armor, ...Object.values(d.plates || {})];
  return [...new Set(ids.filter((id) => id && !S.owned[id]))];
}
function pilotXpNeeded(level) { return 100 + (level - 1) * 80; }
