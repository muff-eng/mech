// =====================================================================
// 01 | DATA | FACTIONS, DAMAGE TYPES, PARTS
// =====================================================================
const FACTIONS = {
  kaa: { name: 'Kessrin Arena Authority', short: 'KAA', color: '#9aa6b2', blurb: 'Runs the Forge Circuit. Sells standard issue parts to anyone with a license.' },
  hal: { name: 'Halvard Foundries', short: 'Halvard', color: '#e08a3a', blurb: 'Old smelting clan. Ballistics, treads and stubborn steel.' },
  lum: { name: 'Lumen Syndicate', short: 'Lumen', color: '#36d0ff', blurb: 'Glass towers and focused light. Energy weapons and hover rigs.' },
  cor: { name: 'Corvane Freehold', short: 'Corvane', color: '#8fbf4a', blurb: 'Patient hunters of the high mesas. Missiles and sensors.' },
  rus: { name: 'Rustwater Combine', short: 'Rustwater', color: '#c9a23a', blurb: 'Scrap barons of the drowned yards. Cheap, loud, and close.' },
};

const DTYPES = {
  kin: { name: 'Kinetic', color: '#ffcf70' },
  ene: { name: 'Energy', color: '#5fe9ff' },
  exp: { name: 'Explosive', color: '#ff8a3d' },
  thm: { name: 'Thermal', color: '#ff5a2a' },
};

const FACINGS = ['f', 'l', 'r', 'b', 't'];
const FACING_NAMES = { f: 'Front', l: 'Left', r: 'Right', b: 'Back', t: 'Top' };

// Weight classes (by total tonnage)
const WCLASSES = [
  { id: 'light', name: 'Light', max: 35 },
  { id: 'medium', name: 'Medium', max: 55 },
  { id: 'heavy', name: 'Heavy', max: 75 },
  { id: 'assault', name: 'Assault', max: 100 },
];
function weightClass(t) {
  for (const c of WCLASSES) if (t <= c.max + 1e-6) return c;
  return { id: 'over', name: 'Overweight', max: 999 };
}

// Build slots in display order
const SLOTS = [
  { id: 'chassis', name: 'Chassis', accept: ['chassis'], req: true },
  { id: 'legs', name: 'Legs', accept: ['legs'], req: true },
  { id: 'torso', name: 'Torso', accept: ['torso'], req: true },
  { id: 'head', name: 'Head | Sensors', accept: ['head'], req: true },
  { id: 'reactor', name: 'Reactor', accept: ['reactor'], req: true },
  { id: 'armL', name: 'Left Arm', accept: ['weapon'], mount: 'A' },
  { id: 'armR', name: 'Right Arm', accept: ['weapon'], mount: 'A' },
  { id: 'shL', name: 'Left Shoulder', accept: ['weapon'], mount: 'S' },
  { id: 'shR', name: 'Right Shoulder', accept: ['weapon'], mount: 'S' },
  { id: 'back', name: 'Back Mount', accept: ['weapon', 'back'], mount: 'B' },
  { id: 'core0', name: 'Core System 1', accept: ['core'], core: 0 },
  { id: 'core1', name: 'Core System 2', accept: ['core'], core: 1 },
  { id: 'core2', name: 'Core System 3', accept: ['core'], core: 2 },
  { id: 'core3', name: 'Core System 4', accept: ['core'], core: 3 },
];
const SLOT_BY_ID = Object.fromEntries(SLOTS.map((s) => [s.id, s]));
const WEAPON_SLOTS = ['armL', 'armR', 'shL', 'shR', 'back'];
const MOUNT_NAMES = { A: 'Arm', S: 'Shoulder', B: 'Back' };

// ---------------------------------------------------------------------
// PARTS
// ---------------------------------------------------------------------
const PARTS = {};
const PART_LIST = [];
function defPart(p) {
  p.hp = p.hp || 0; p.pw = p.pw || 0; p.cost = p.cost || 0; p.tier = p.tier || 1; p.maker = p.maker || 'kaa';
  PARTS[p.id] = p; PART_LIST.push(p);
}

// ---------- CHASSIS ----------
// cap: base weight capacity | armor: built in plating per facing | hpm: structure multiplier | size: model scale
defPart({ id: 'c_wsp', slot: 'chassis', name: 'Wisp Frame', maker: 'kaa', wt: 4, cap: 28, hpm: 0.8, size: 0.86, armor: { f: 50, l: 40, r: 40, b: 25, t: 25 }, cost: 0, tier: 1, trait: 'Light skeleton | Small target profile', evade: 0.06 });
defPart({ id: 'c_skf', slot: 'chassis', name: 'Skiff Frame', maker: 'lum', wt: 3, cap: 26, hpm: 0.72, size: 0.82, armor: { f: 40, l: 30, r: 30, b: 20, t: 20 }, spd: 1.1, cost: 1800, tier: 2, trait: 'Racing spars | +10% speed', evade: 0.08 });
defPart({ id: 'c_rng', slot: 'chassis', name: 'Ranger Frame', maker: 'kaa', wt: 7, cap: 44, hpm: 1.0, size: 1.0, armor: { f: 80, l: 60, r: 60, b: 40, t: 40 }, cost: 3500, tier: 2, trait: 'Balanced medium skeleton' });
defPart({ id: 'c_wdn', slot: 'chassis', name: 'Warden Frame', maker: 'hal', wt: 8, cap: 46, hpm: 1.1, size: 1.04, armor: { f: 100, l: 75, r: 75, b: 45, t: 50 }, turn: 0.9, cost: 5200, tier: 2, trait: 'Thick hull | Turns 10% slower' });
defPart({ id: 'c_bst', slot: 'chassis', name: 'Bastion Frame', maker: 'hal', wt: 10, cap: 60, hpm: 1.25, size: 1.16, armor: { f: 120, l: 90, r: 90, b: 60, t: 60 }, cost: 8000, tier: 3, trait: 'Heavy skeleton | Shrugs off stagger', stagRes: 0.5 });
defPart({ id: 'c_col', slot: 'chassis', name: 'Colossus Frame', maker: 'hal', wt: 14, cap: 80, hpm: 1.5, size: 1.32, armor: { f: 160, l: 120, r: 120, b: 80, t: 80 }, cost: 14000, tier: 4, trait: 'Assault skeleton | Immune to stagger', stagRes: 1 });

// ---------- LEGS ----------
// type: biped | quad | tracked | hover ; cap: capacity bonus ; spd: base speed ; turn: deg/s ; stab: firing stability
defPart({ id: 'l_str', slot: 'legs', name: 'Strider Biped', type: 'biped', maker: 'kaa', wt: 5, cap: 7, spd: 9, turn: 100, stab: 0.6, hp: 120, cost: 0, tier: 1, trait: 'Balanced walker | Can backpedal' });
defPart({ id: 'l_spr', slot: 'legs', name: 'Sprint Biped', type: 'biped', rev: true, maker: 'rus', wt: 4, cap: 4, spd: 12, turn: 140, stab: 0.5, hp: 90, cost: 1500, tier: 1, trait: 'Reverse joints | Fast and nimble' });
defPart({ id: 'l_atl', slot: 'legs', name: 'Atlas Quad', type: 'quad', maker: 'cor', wt: 8, cap: 12, spd: 7.5, turn: 85, stab: 0.92, hp: 150, cost: 2600, tier: 2, trait: 'Strafes freely | Rock steady aim' });
defPart({ id: 'l_crw', slot: 'legs', name: 'Crawler Tracks', type: 'tracked', maker: 'hal', wt: 8, cap: 14, spd: 6.5, turn: 62, stab: 0.85, hp: 170, cost: 2000, tier: 1, trait: 'Hauls heavy loads | Must turn to move' });
defPart({ id: 'l_hov', slot: 'legs', name: 'Glide Hover', type: 'hover', maker: 'lum', wt: 5, cap: 3, spd: 13, turn: 125, stab: 0.55, hp: 85, dis: 1, cost: 2400, tier: 2, trait: 'Strafes and drifts | Fans add cooling' });
defPart({ id: 'l_stk', slot: 'legs', name: 'Stalker Biped', type: 'biped', maker: 'cor', wt: 9, cap: 13, spd: 8, turn: 90, stab: 0.72, hp: 165, cost: 5200, tier: 3, trait: 'Heavy walker | Steady stride' });
defPart({ id: 'l_jug', slot: 'legs', name: 'Juggernaut Treads', type: 'tracked', heavy: true, maker: 'hal', wt: 12, cap: 20, spd: 5.4, turn: 48, stab: 0.96, hp: 240, cost: 9000, tier: 4, trait: 'Siege treads | Massive load capacity' });

// ---------- TORSO ----------
// core: internal system slots ; twist: max torso twist in degrees ; armorMod: per facing bonus
defPart({ id: 't_box', slot: 'torso', name: 'Box Torso', maker: 'kaa', wt: 4, hp: 200, core: 3, twist: 95, cost: 0, tier: 1, trait: 'Roomy hull | 3 core slots' });
defPart({ id: 't_wdg', slot: 'torso', name: 'Wedge Torso', maker: 'hal', wt: 4, hp: 190, core: 2, twist: 75, armorMod: { f: 25, l: -5, r: -5 }, deflect: 0.1, cost: 1200, tier: 1, trait: 'Sloped prow | 10% frontal deflect' });
defPart({ id: 't_spn', slot: 'torso', name: 'Spine Torso', maker: 'lum', wt: 3, hp: 160, core: 2, twist: 140, turn: 1.12, cost: 1000, tier: 1, trait: 'Lean frame | +12% turn rate' });
defPart({ id: 't_brl', slot: 'torso', name: 'Barrel Torso', maker: 'cor', wt: 6, hp: 230, core: 3, twist: 180, armorMod: { b: 15 }, cost: 2600, tier: 2, trait: 'Turret ring | Full 360 rotation' });
defPart({ id: 't_frt', slot: 'torso', name: 'Fortress Torso', maker: 'hal', wt: 8, hp: 290, core: 4, twist: 65, armorMod: { f: 15, l: 15, r: 15, b: 15, t: 15 }, cost: 6000, tier: 3, trait: 'Bunker hull | 4 core slots' });

// ---------- HEAD | SENSORS ----------
defPart({ id: 'h_opt', slot: 'head', name: 'Basic Optics', maker: 'kaa', wt: 1, hp: 60, acc: 0, sensor: 90, cost: 0, tier: 1, trait: 'Standard optics' });
defPart({ id: 'h_crn', slot: 'head', name: 'Armored Crown', maker: 'hal', wt: 2, hp: 130, acc: -0.03, sensor: 80, cost: 1200, tier: 1, trait: 'Thick cowl | Narrow vision slit' });
defPart({ id: 'h_hwk', slot: 'head', name: 'Hawkeye Array', maker: 'lum', wt: 1.5, pw: 2, hp: 50, acc: 0.1, sensor: 130, cost: 2400, tier: 2, trait: '+10% accuracy | Long sight' });
defPart({ id: 'h_wsc', slot: 'head', name: 'Widescan Pod', maker: 'cor', wt: 1.5, pw: 2, hp: 55, acc: 0.02, gacc: 0.15, sensor: 150, cost: 2600, tier: 2, trait: '+15% missile and artillery accuracy' });

// ---------- REACTORS ----------
defPart({ id: 'r_emb', slot: 'reactor', name: 'Ember Cell', maker: 'kaa', wt: 2, out: 10, hp: 55, cost: 0, tier: 1, trait: 'Compact | 10 power' });
defPart({ id: 'r_cld', slot: 'reactor', name: 'Coldrun Cell', maker: 'lum', wt: 3.5, out: 14, hp: 60, dis: 1, cost: 2400, tier: 2, trait: '14 power | Chilled core: +1 dissipation' });
defPart({ id: 'r_frg', slot: 'reactor', name: 'Forge Core', maker: 'hal', wt: 4, out: 18, hp: 75, cost: 2200, tier: 1, trait: '18 power | Rugged' });
defPart({ id: 'r_ovd', slot: 'reactor', name: 'Overdrive Core', maker: 'rus', wt: 4, out: 24, hp: 45, pheat: 1.2, cost: 3800, tier: 2, trait: '24 power | Runs hot and fragile' });
defPart({ id: 'r_sun', slot: 'reactor', name: 'Sunheart Reactor', maker: 'lum', wt: 7, out: 32, hp: 95, blast: 1.6, cost: 7500, tier: 3, trait: '32 power | Huge blast if breached' });

// ---------- WEAPONS ----------
// mounts: A arm | S shoulder | B back
// dt damage type ; dmg per projectile ; rof volleys per second ; burst projectiles per volley ; acc base hit chance
// opt optimal range ; max max range ; min min range ; spd projectile speed (0 = instant) ; ht heat per volley ; ammo volleys
function W(p) { p.slot = 'weapon'; p.burst = p.burst || 1; p.min = p.min || 0; p.ammo = p.ammo || 0; p.track = p.track == null ? 0.6 : p.track; defPart(p); }
W({ id: 'w_lac', name: 'Pellin Light Autocannon', maker: 'hal', mounts: 'AS', kind: 'ballistic', dt: 'kin', dmg: 7, rof: 3.2, acc: 0.78, opt: 35, max: 60, spd: 120, ht: 0.7, pw: 1, ammo: 240, wt: 2.5, hp: 50, cost: 700, tier: 1, track: 0.55, model: 'lac', trait: 'Steady chatter | Low heat per shot' });
W({ id: 'w_ac', name: 'Brakk Autocannon', maker: 'hal', mounts: 'A', kind: 'ballistic', dt: 'kin', dmg: 15, rof: 1.7, acc: 0.74, opt: 42, max: 70, spd: 110, ht: 2, pw: 2, ammo: 130, wt: 5, hp: 70, cost: 1800, tier: 1, track: 0.55, stagger: 0.3, model: 'ac', trait: 'Shell impacts stagger light frames' });
W({ id: 'w_hac', name: 'Tessel Heavy Autocannon', maker: 'hal', mounts: 'A', kind: 'ballistic', dt: 'kin', dmg: 38, rof: 0.85, acc: 0.72, opt: 48, max: 78, spd: 100, ht: 4.5, pw: 3, ammo: 60, wt: 9, hp: 95, cost: 4600, tier: 3, track: 0.5, stagger: 0.5, knock: 1.5, model: 'hac', trait: 'Heavy shells | Knockback and stagger' });
W({ id: 'w_gat', name: 'Whirr Gatling', maker: 'rus', mounts: 'A', kind: 'ballistic', dt: 'kin', dmg: 2.9, rof: 13, acc: 0.5, opt: 22, max: 40, spd: 140, ht: 0.22, pw: 2, ammo: 1100, wt: 4, hp: 55, cost: 1500, tier: 1, track: 0.5, spin: 0.25, model: 'gat', trait: 'Spin up | Accuracy climbs while firing' });
W({ id: 'w_sgc', name: 'Scatter Cannon', maker: 'rus', mounts: 'A', kind: 'ballistic', dt: 'kin', dmg: 4.6, pellets: 8, rof: 0.9, acc: 0.62, opt: 12, max: 28, spd: 90, ht: 3, pw: 1, ammo: 55, wt: 4.5, hp: 70, cost: 1600, tier: 1, track: 0.6, falloff: true, model: 'sgc', trait: 'Point blank shredder | Pellets spread across parts' });
W({ id: 'w_rail', name: 'Rail Lance', maker: 'lum', mounts: 'A', kind: 'rail', dt: 'kin', dmg: 85, rof: 0.27, acc: 0.8, opt: 80, max: 115, spd: 0, ht: 13, pw: 9, ammo: 24, wt: 9, hp: 60, cost: 6800, tier: 3, charge: 0.8, pierce: 0.35, track: 0.75, model: 'rail', trait: 'Charged slug | 35% bypasses armor' });
W({ id: 'w_ndl', name: 'Needle Coilgun', maker: 'lum', mounts: 'AS', kind: 'rail', dt: 'kin', dmg: 26, rof: 0.62, acc: 0.86, opt: 62, max: 90, spd: 0, ht: 5, pw: 4, ammo: 50, wt: 4, hp: 40, cost: 3000, tier: 2, charge: 0.3, pierce: 0.15, track: 0.75, model: 'ndl', trait: 'Compact coil | 15% bypasses armor' });
W({ id: 'w_mlas', name: 'Glint Micro Laser', maker: 'lum', mounts: 'AS', kind: 'laser', dt: 'ene', dmg: 5.5, rof: 2, acc: 0.9, opt: 26, max: 42, spd: 0, ht: 1.6, pw: 2, wt: 1, hp: 30, cost: 500, tier: 1, track: 0.75, model: 'mlas', trait: 'Featherweight | No ammo' });
W({ id: 'w_plas', name: 'Spitfire Pulse Laser', maker: 'lum', mounts: 'AS', kind: 'laser', dt: 'ene', dmg: 6.5, burst: 3, rof: 1.15, acc: 0.86, opt: 32, max: 52, spd: 0, ht: 4.2, pw: 4, wt: 3, hp: 40, cost: 1400, tier: 1, track: 0.75, model: 'plas', trait: 'Three pulse bursts | No ammo' });
W({ id: 'w_beam', name: 'Lumen Beam Laser', maker: 'lum', mounts: 'A', kind: 'beam', dt: 'ene', dmg: 62, beam: 1.2, rof: 1 / 2.7, acc: 0.92, opt: 55, max: 82, spd: 0, ht: 11, pw: 7, wt: 5, hp: 55, cost: 3600, tier: 2, track: 0.85, model: 'beam', trait: 'Sustained beam | Rakes across parts' });
W({ id: 'w_sol', name: 'Solaris Lance', maker: 'lum', mounts: 'A', kind: 'beam', dt: 'ene', dmg: 118, beam: 1.6, rof: 1 / 4.2, acc: 0.92, opt: 70, max: 100, spd: 0, ht: 22, pw: 12, wt: 9, hp: 70, cost: 8200, tier: 4, track: 0.85, melt: 1.2, model: 'sol', trait: 'Searing beam | +20% damage to armor' });
W({ id: 'w_plz', name: 'Cinder Plasma Thrower', maker: 'rus', mounts: 'A', kind: 'plasma', dt: 'thm', dmg: 40, rof: 0.7, acc: 0.66, opt: 22, max: 36, spd: 34, ht: 9, pw: 6, wt: 6, hp: 60, cost: 3800, tier: 2, splash: 3, tHeat: 9, track: 0.45, model: 'plz', trait: 'Heats the target | Splash' });
W({ id: 'w_flm', name: 'Scorch Flamethrower', maker: 'rus', mounts: 'A', kind: 'flame', dt: 'thm', dmg: 3, rof: 10, acc: 0.92, opt: 10, max: 16, spd: 0, ht: 0.45, pw: 2, ammo: 450, wt: 3, hp: 50, cost: 1300, tier: 1, tHeat: 1.5, track: 0.9, model: 'flm', trait: 'Overheats targets | Very short reach' });
W({ id: 'w_srm', name: 'Hornet Missile Rack', maker: 'cor', mounts: 'AS', kind: 'missile', dt: 'exp', dmg: 10, burst: 4, rof: 0.45, acc: 0.72, opt: 32, max: 48, spd: 48, ht: 5, pw: 1, ammo: 18, wt: 3, hp: 45, cost: 1500, tier: 1, guided: true, track: 0.8, model: 'srm', trait: 'Guided volley | Fooled by ECM and flares' });
W({ id: 'w_swm', name: 'Swarm Pod', maker: 'cor', mounts: 'S', kind: 'missile', dt: 'exp', dmg: 5, burst: 8, rof: 0.36, acc: 0.64, opt: 40, max: 60, spd: 44, ht: 6, pw: 1, ammo: 16, wt: 4, hp: 45, cost: 2400, tier: 2, guided: true, track: 0.85, model: 'swm', trait: 'Eight micro missiles | Spread damage' });
W({ id: 'w_lrm', name: 'Longbow LRM', maker: 'cor', mounts: 'SB', kind: 'missile', dt: 'exp', dmg: 10, burst: 6, rof: 0.28, acc: 0.66, min: 20, opt: 75, max: 115, spd: 40, ht: 6, pw: 1, ammo: 18, wt: 6, hp: 55, cost: 3200, tier: 2, guided: true, arc: 1, indirect: true, top: 0.5, track: 0.75, model: 'lrm', trait: 'Indirect fire | Hits top armor' });
W({ id: 'w_art', name: 'Thunderhead Artillery', maker: 'hal', mounts: 'B', kind: 'artillery', dt: 'exp', dmg: 95, rof: 0.16, acc: 0.55, min: 30, opt: 95, max: 145, spd: 45, ht: 10, pw: 2, ammo: 20, wt: 10, hp: 70, cost: 5200, tier: 3, arc: 2, indirect: true, top: 0.85, splash: 6, track: 0.3, model: 'art', trait: 'Huge splash | Plunging top hits' });
W({ id: 'w_mor', name: 'Clatter Mortar', maker: 'rus', mounts: 'S', kind: 'artillery', dt: 'exp', dmg: 32, rof: 0.42, acc: 0.55, min: 15, opt: 45, max: 70, spd: 32, ht: 4, pw: 1, ammo: 40, wt: 4, hp: 45, cost: 1400, tier: 1, arc: 1.6, indirect: true, top: 0.7, splash: 4, track: 0.3, model: 'mor', trait: 'Lobbed shells | Fires over cover' });
W({ id: 'w_bld', name: 'Breaker Blade', maker: 'rus', mounts: 'A', kind: 'melee', dt: 'kin', dmg: 46, rof: 0.8, acc: 0.85, opt: 5.5, max: 5.5, spd: 0, ht: 2, pw: 1, wt: 3.5, hp: 80, cost: 1800, tier: 1, sever: 2, track: 1, model: 'bld', trait: 'Melee | Double damage to limbs' });
W({ id: 'w_fst', name: 'Piston Fist', maker: 'hal', mounts: 'A', kind: 'melee', dt: 'kin', dmg: 62, rof: 0.55, acc: 0.85, opt: 5, max: 5, spd: 0, ht: 3, pw: 2, wt: 5, hp: 110, cost: 2400, tier: 2, stagger: 1.2, knock: 4, track: 1, model: 'fst', trait: 'Melee | Staggers and shoves' });
W({ id: 'w_shd', name: 'Bulwark Shield', maker: 'hal', mounts: 'A', kind: 'shield', dt: 'kin', dmg: 0, rof: 0, acc: 0, opt: 0, max: 0, shield: 260, block: 0.5, wt: 5, hp: 0, cost: 2000, tier: 1, model: 'shd', trait: 'Blocks 50% of hits from the front and its side' });
W({ id: 'w_tsh', name: 'Aegis Tower Shield', maker: 'hal', mounts: 'A', kind: 'shield', dt: 'kin', dmg: 0, rof: 0, acc: 0, opt: 0, max: 0, shield: 430, block: 0.62, wt: 8, hp: 0, cost: 4400, tier: 3, model: 'tsh', trait: 'Blocks 62% of hits from the front and its side' });

// ---------- BACK SYSTEMS ----------
defPart({ id: 'b_jj', slot: 'back', name: 'Kite Jump Jets', maker: 'cor', wt: 2.5, pw: 2, hp: 40, jump: 7, jht: 6, cost: 1500, tier: 1, model: 'jj', trait: 'Leap over cover | Hard to hit airborne' });
defPart({ id: 'b_bst', slot: 'back', name: 'Surge Boosters', maker: 'lum', wt: 2, pw: 2, hp: 35, boost: 5, bht: 5, cost: 1200, tier: 1, model: 'bst', trait: 'Burst dash | Closes gaps and dodges' });
defPart({ id: 'b_drn', slot: 'back', name: 'Mender Drone Bay', maker: 'cor', wt: 3.5, pw: 3, hp: 40, repair: 6, rpool: 380, cost: 4200, tier: 3, model: 'drn', trait: 'Drones repair 6 per second | 608 total' });
defPart({ id: 'b_rad', slot: 'back', name: 'Radiator Spine', maker: 'hal', wt: 2, pw: 0, hp: 45, hcap: 10, dis: 4, cost: 1100, tier: 1, model: 'rad', trait: '+4 dissipation | +10 heat capacity' });

// ---------- CORE SYSTEMS ----------
defPart({ id: 's_hs', slot: 'core', name: 'Coolant Loop', maker: 'kaa', wt: 1, pw: 0.5, hp: 35, hcap: 15, dis: 2, cost: 400, tier: 1, trait: '+2 dissipation | +15 heat capacity' });
defPart({ id: 's_cry', slot: 'core', name: 'Cryo Sink', maker: 'lum', wt: 1.5, pw: 1, hp: 35, hcap: 25, dis: 3.5, cost: 1600, tier: 2, trait: '+3.5 dissipation | +25 heat capacity' });
defPart({ id: 's_amm', slot: 'core', name: 'Ammo Bin', maker: 'kaa', wt: 1, pw: 0, hp: 35, ammoB: 0.5, cook: 1, cost: 500, tier: 1, trait: '+50% ammo | Can cook off when hit' });
defPart({ id: 's_aam', slot: 'core', name: 'Armored Ammo Bin', maker: 'hal', wt: 2, pw: 0, hp: 70, ammoB: 0.4, cook: 0.4, cost: 1400, tier: 2, trait: '+40% ammo | Cook off risk reduced' });
defPart({ id: 's_ecm', slot: 'core', name: 'Shroud ECM', maker: 'cor', wt: 1.5, pw: 3, hp: 35, ecm: 0.25, cost: 2200, tier: 2, trait: 'Enemy guided weapons lose 25% accuracy' });
defPart({ id: 's_aeg', slot: 'core', name: 'Aegis Field', maker: 'lum', wt: 2, pw: 6, hp: 35, barrier: 80, bregen: 16, cost: 3600, tier: 2, trait: 'Active armor | 128 point regenerating barrier' });
defPart({ id: 's_rfx', slot: 'core', name: 'Reflex Plating', maker: 'hal', wt: 2, pw: 3, hp: 40, reflex: 0.6, cost: 2800, tier: 2, trait: 'Active armor | Blunts first hit every 3s by 60%' });
defPart({ id: 's_mnd', slot: 'core', name: 'Mender Drones', maker: 'cor', wt: 2, pw: 3, hp: 30, repair: 4, rpool: 240, cost: 3000, tier: 2, trait: 'Repair drones | 4 per second, 384 total' });
defPart({ id: 's_fcc', slot: 'core', name: 'Fire Control Computer', maker: 'kaa', wt: 1, pw: 2, hp: 30, acc: 0.07, cost: 1800, tier: 1, trait: '+7% accuracy' });
defPart({ id: 's_gyr', slot: 'core', name: 'Gyro Stabilizer', maker: 'kaa', wt: 1.5, pw: 1, hp: 40, stab: 0.2, turnB: 0.15, cost: 1200, tier: 1, trait: 'Steadier aim on the move | +15% turn rate' });
defPart({ id: 's_cap', slot: 'core', name: 'Capacitor Bank', maker: 'lum', wt: 1.5, pw: -5, hp: 30, cost: 1700, tier: 2, trait: '+5 power supply | Sparks when hit' });

// ---------- ARMOR TYPES ----------
// mods: damage multiplier per type ; wmul: weight per armor point multiplier
defPart({ id: 'a_std', slot: 'armor', name: 'Standard Plating', maker: 'kaa', wmul: 1.0, mods: { kin: 1, ene: 1, exp: 1, thm: 1 }, cost: 0, tier: 1, trait: 'No strengths | No weaknesses' });
defPart({ id: 'a_rea', slot: 'armor', name: 'Reactive Plating', maker: 'cor', wmul: 1.1, mods: { kin: 1, ene: 1.15, exp: 0.55, thm: 1.1 }, cost: 2200, tier: 2, trait: 'Strong vs missiles | Weak vs energy' });
defPart({ id: 'a_abl', slot: 'armor', name: 'Ablative Plating', maker: 'lum', wmul: 0.95, mods: { kin: 1.15, ene: 0.55, exp: 1.05, thm: 0.75 }, cost: 2200, tier: 2, trait: 'Strong vs energy and heat | Weak vs kinetic' });
defPart({ id: 'a_rei', slot: 'armor', name: 'Reinforced Plating', maker: 'hal', wmul: 1.35, mods: { kin: 0.72, ene: 0.9, exp: 0.85, thm: 0.9 }, cost: 4200, tier: 3, trait: 'Tough against everything | Very heavy' });
// Battle scale: armor points and structure are scaled up so fights last long enough to read.
const ARMOR_SCALE = 1.7, HP_SCALE = 1.8;
const ARMOR_PER_TON = 50 * ARMOR_SCALE;
for (const p of PART_LIST) {
  if (p.slot === 'chassis') for (const f in p.armor) p.armor[f] = Math.round(p.armor[f] * ARMOR_SCALE);
  if (p.armorMod) for (const f in p.armorMod) p.armorMod[f] = Math.round(p.armorMod[f] * ARMOR_SCALE);
  if (p.hp) p.hp = Math.round(p.hp * HP_SCALE);
  if (p.shield) p.shield = Math.round(p.shield * 1.6);
  if (p.barrier) { p.barrier = Math.round(p.barrier * 1.6); p.bregen *= 1.6; }
  if (p.rpool) p.rpool = Math.round(p.rpool * 1.6);
}

// ---------- ARMOR PLATES (placed on mounting points) ----------
defPart({ id: 'p_lgt', slot: 'plate', name: 'Light Plate', maker: 'kaa', ap: 34, cost: 100, tier: 1, trait: '+34 armor on its facing' });
defPart({ id: 'p_hvy', slot: 'plate', name: 'Heavy Plate', maker: 'hal', ap: 76, cost: 300, tier: 1, trait: '+76 armor on its facing' });
defPart({ id: 'p_slp', slot: 'plate', name: 'Sloped Plate', maker: 'hal', ap: 48, deflect: 0.07, cost: 450, tier: 2, trait: '+48 armor | 7% deflect chance' });
defPart({ id: 'p_spc', slot: 'plate', name: 'Spaced Plate', maker: 'cor', ap: 51, expRes: 0.2, cost: 450, tier: 2, trait: '+51 armor | Explosive damage on facing reduced 20%' });
defPart({ id: 'p_blk', slot: 'plate', name: 'Bulkhead Slab', maker: 'hal', ap: 119, extraWt: 0.4, cost: 700, tier: 3, trait: '+119 armor | Extra frame weight' });

// ---------- SMALL MODULES (placed on mounting points) ----------
defPart({ id: 'm_fin', slot: 'module', name: 'Heat Fin', maker: 'kaa', wt: 0.5, dis: 1, cost: 200, tier: 1, trait: '+1 dissipation' });
defPart({ id: 'm_flr', slot: 'module', name: 'Flare Pod', maker: 'cor', wt: 0.5, flare: 0.1, cost: 300, tier: 1, trait: 'Enemy missiles lose 10% accuracy | Stacks to 30%' });
defPart({ id: 'm_spk', slot: 'module', name: 'Sensor Spike', maker: 'cor', wt: 0.3, acc: 0.03, cost: 300, tier: 1, trait: '+3% accuracy' });
defPart({ id: 'm_pch', slot: 'module', name: 'Ammo Pouch', maker: 'rus', wt: 0.5, ammoB: 0.1, cost: 150, tier: 1, trait: '+10% ammo' });
defPart({ id: 'm_lmp', slot: 'module', name: 'Floodlamp', maker: 'rus', wt: 0.2, cost: 50, tier: 1, trait: 'Purely for show | The crowd loves it' });
defPart({ id: 'm_bat', slot: 'module', name: 'Battery Pack', maker: 'lum', wt: 0.8, pwOut: 1.5, cost: 600, tier: 2, trait: '+1.5 power supply' });

// Mounting points for plates and modules. side: facing protected ; comp: component it hangs on ; mirror: partner
const MOUNTS = [
  { id: 'tf1', name: 'Chest Upper', facing: 'f', comp: 'torso' },
  { id: 'tf2', name: 'Chest Lower', facing: 'f', comp: 'torso' },
  { id: 'tsL', name: 'Torso Left', facing: 'l', comp: 'torso', mirror: 'tsR' },
  { id: 'tsR', name: 'Torso Right', facing: 'r', comp: 'torso', mirror: 'tsL' },
  { id: 'spL', name: 'Shoulder Pad Left', facing: 'l', comp: 'torso', mirror: 'spR' },
  { id: 'spR', name: 'Shoulder Pad Right', facing: 'r', comp: 'torso', mirror: 'spL' },
  { id: 'tb', name: 'Back Plate', facing: 'b', comp: 'torso' },
  { id: 'tt', name: 'Roof Plate', facing: 't', comp: 'torso' },
  { id: 'lfL', name: 'Leg Front Left', facing: 'f', comp: 'legL', mirror: 'lfR' },
  { id: 'lfR', name: 'Leg Front Right', facing: 'f', comp: 'legR', mirror: 'lfL' },
  { id: 'loL', name: 'Leg Outer Left', facing: 'l', comp: 'legL', mirror: 'loR' },
  { id: 'loR', name: 'Leg Outer Right', facing: 'r', comp: 'legR', mirror: 'loL' },
  { id: 'aoL', name: 'Arm Guard Left', facing: 'l', comp: 'armL', mirror: 'aoR' },
  { id: 'aoR', name: 'Arm Guard Right', facing: 'r', comp: 'armR', mirror: 'aoL' },
];
const MOUNT_BY_ID = Object.fromEntries(MOUNTS.map((m) => [m.id, m]));

const STARTER_PARTS = ['c_wsp', 'l_str', 't_box', 'h_opt', 'r_emb', 'r_frg', 'w_lac', 'w_ac', 'w_gat', 'w_mlas', 'w_plas', 'w_srm', 'w_bld', 'w_shd', 's_hs', 's_amm', 'b_jj', 'a_std', 'p_lgt', 'p_hvy', 'm_fin', 'm_spk', 'm_lmp'];

const PART_CATS = [
  { id: 'weapon', name: 'Weapons', slots: ['weapon'] },
  { id: 'frame', name: 'Frames', slots: ['chassis', 'torso', 'legs'] },
  { id: 'sys', name: 'Systems', slots: ['reactor', 'head', 'core', 'back'] },
  { id: 'armor', name: 'Armor', slots: ['armor', 'plate', 'module'] },
];
const SLOT_LABEL = { chassis: 'Chassis', legs: 'Legs', torso: 'Torso', head: 'Head', reactor: 'Reactor', weapon: 'Weapon', core: 'Core System', back: 'Back System', armor: 'Armor Type', plate: 'Armor Plate', module: 'Module' };
