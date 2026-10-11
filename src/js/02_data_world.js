// =====================================================================
// 02 | DATA | LORE, PAINT, MAPS, RIVALS, CAMPAIGN, CHALLENGES, PILOTS
// =====================================================================
const LORE = {
  title: 'MECH FORGE',
  tagline: 'Build it | Break it | Build it better',
  intro: 'Tessaline, year 212 of the Long Quiet. When the mining charters collapsed, the great excavation walkers were refitted for sport. Now the Forge Circuit decides which foundry clans win water rights, and which pilots get remembered. You are an unknown with a borrowed garage, a light frame held together with rivets, and a few thousand credits of goodwill. Build smart. The machines remember every bad decision.',
};

const PATTERNS = [
  { id: 'solid', name: 'Solid' },
  { id: 'stripes', name: 'Stripes' },
  { id: 'hazard', name: 'Hazard' },
  { id: 'camo', name: 'Camo' },
  { id: 'splinter', name: 'Splinter' },
  { id: 'digital', name: 'Digital' },
  { id: 'twotone', name: 'Two Tone' },
];
const PALETTES = [
  { name: 'Foundry', p: '#7a5a3a', s: '#2b2b2e', a: '#ffb000' },
  { name: 'Glacier', p: '#c9d6df', s: '#3a4a5a', a: '#2fd6e8' },
  { name: 'Olive Drab', p: '#5b6340', s: '#2e3324', a: '#e0c060' },
  { name: 'Crimson', p: '#8e1f24', s: '#1f1f22', a: '#f2f2f2' },
  { name: 'Night', p: '#24282f', s: '#111317', a: '#ff4d3d' },
  { name: 'Desert', p: '#b89a6a', s: '#6b553a', a: '#2fd6e8' },
  { name: 'Lumen', p: '#e8eef2', s: '#2fa7c8', a: '#36d0ff' },
  { name: 'Rust', p: '#8a4b22', s: '#3a2a1a', a: '#c9a23a' },
];
const DEFAULT_PAINT = { p: '#6d7884', s: '#2b3038', a: '#ffb000', pattern: 'stripes', num: '07', plate: 'FORGE' };

// ---------------------------------------------------------------------
// MAPS
// obstacle: { t:'box'|'cyl', x, z, w, d | r, h, style }
// ---------------------------------------------------------------------
const MAPS = {
  field: {
    id: 'field', name: 'Dustplain Proving Ground', short: 'Open Field', hx: 75, hz: 75,
    desc: 'Wide open flats with a few boulders and low ridges. Long sightlines favor snipers and missile boats.',
    ground: '#9a8156', ground2: '#7d6844', sky: ['#7fa6c7', '#e4c9a0'], fog: '#cdb895', fogD: [90, 260], sun: '#fff1d6', amb: 0.55,
    gen(r) {
      const o = [];
      const boulders = [[-30, 5], [28, -8], [0, 30], [-8, -32], [45, 30], [-48, -30], [50, -45], [-52, 40]];
      for (const [x, z] of boulders) o.push({ t: 'cyl', x: x + r() * 6 - 3, z: z + r() * 6 - 3, r: 3 + r() * 2.5, h: 5 + r() * 4, style: 'rock' });
      for (let i = 0; i < 10; i++) {
        const horiz = r() > 0.5;
        o.push({ t: 'box', x: (r() - 0.5) * 120, z: (r() - 0.5) * 90, w: horiz ? 8 + r() * 6 : 1.8, d: horiz ? 1.8 : 8 + r() * 6, h: 1.6 + r() * 0.6, style: 'ridge' });
      }
      return o;
    },
  },
  ruins: {
    id: 'ruins', name: 'Old Kessrin Ward', short: 'City Ruins', hx: 70, hz: 70,
    desc: 'Collapsed city blocks and rubble choked streets. Short sightlines reward brawlers and flankers.',
    ground: '#4a4d52', ground2: '#3a3c40', sky: ['#5d6b7a', '#b9a99a'], fog: '#8b8a88', fogD: [60, 200], sun: '#ffe7c4', amb: 0.5,
    gen(r) {
      const o = [];
      const step = 24;
      for (let gx = -2; gx <= 2; gx++) {
        for (let gz = -2; gz <= 2; gz++) {
          const cx = gx * step, cz = gz * step;
          if (Math.abs(gz) === 2 && Math.abs(gx) <= 1) continue; // spawn plazas
          if (gx === 0 && gz === 0) { o.push({ t: 'cyl', x: 0, z: 0, r: 3, h: 4, style: 'fountain' }); continue; }
          if (r() < 0.15) { // rubble lot
            for (let k = 0; k < 3; k++) o.push({ t: 'box', x: cx + (r() - 0.5) * 10, z: cz + (r() - 0.5) * 10, w: 3 + r() * 3, d: 2 + r() * 3, h: 1.4 + r() * 1.2, style: 'rubble' });
            continue;
          }
          const w = 9 + r() * 6, d = 9 + r() * 6, h = 5 + r() * 12;
          o.push({ t: 'box', x: cx + (r() - 0.5) * 3, z: cz + (r() - 0.5) * 3, w, d, h, style: 'ruin' });
          if (r() < 0.6) o.push({ t: 'box', x: cx + (r() < 0.5 ? -1 : 1) * (w / 2 + 2.5), z: cz + (r() - 0.5) * 6, w: 3 + r() * 2, d: 2 + r() * 3, h: 1.3 + r() * 1.3, style: 'rubble' });
        }
      }
      return o;
    },
  },
  canyon: {
    id: 'canyon', name: 'Redcut Gorge', short: 'Canyon', hx: 46, hz: 88,
    desc: 'A long red rock corridor with mesas in the middle. Artillery owns the lanes, flankers own the shadows.',
    ground: '#9c5a3c', ground2: '#7d4630', sky: ['#c9875a', '#f0c48f'], fog: '#d39a6c', fogD: [80, 240], sun: '#ffd9b0', amb: 0.5, walls: true,
    gen(r) {
      const o = [];
      o.push({ t: 'cyl', x: -14, z: 0, r: 8, h: 14, style: 'mesa' });
      o.push({ t: 'cyl', x: 18, z: 18, r: 6, h: 12, style: 'mesa' });
      o.push({ t: 'cyl', x: 16, z: -26, r: 6.5, h: 13, style: 'mesa' });
      o.push({ t: 'cyl', x: -20, z: 40, r: 5, h: 10, style: 'mesa' });
      o.push({ t: 'cyl', x: -18, z: -44, r: 5, h: 10, style: 'mesa' });
      for (let i = 0; i < 12; i++) {
        o.push({ t: 'box', x: (r() - 0.5) * 70, z: (r() - 0.5) * 140, w: 2 + r() * 5, d: 1.6 + r() * 2.5, h: 1.6 + r() * 0.9, style: 'ridge' });
      }
      for (let i = 0; i < 6; i++) o.push({ t: 'cyl', x: (r() < 0.5 ? -1 : 1) * (34 + r() * 6), z: (r() - 0.5) * 150, r: 3 + r() * 3, h: 6 + r() * 6, style: 'rock' });
      return o;
    },
  },
  yard: {
    id: 'yard', name: 'Halvard Yard 9', short: 'Industrial Yard', hx: 72, hz: 72,
    desc: 'Container stacks, fuel tanks and pipe racks. Mixed cover with lanes for every range.',
    ground: '#6c6a63', ground2: '#56544f', sky: ['#6f8494', '#c7c2b2'], fog: '#a5a296', fogD: [70, 220], sun: '#fff4dc', amb: 0.52,
    gen(r) {
      const o = [];
      const cols = ['#b5462e', '#2e6fa0', '#c79a2a', '#3d7d4a', '#7a7f86'];
      for (let row = -2; row <= 2; row++) {
        for (let k = -2; k <= 2; k++) {
          if (Math.abs(row) === 2 && Math.abs(k) <= 1) continue;
          if (r() < 0.25) continue;
          const x = k * 26 + (r() - 0.5) * 6, z = row * 26 + (r() - 0.5) * 6;
          if (r() < 0.22) { o.push({ t: 'cyl', x, z, r: 4.5 + r() * 1.5, h: 8 + r() * 3, style: 'tank' }); continue; }
          const horiz = r() < 0.5, stack = r() < 0.45 ? 2 : 1;
          const n = 1 + Math.floor(r() * 2);
          for (let j = 0; j < n; j++) {
            const off = (j - (n - 1) / 2) * 3.1;
            o.push({ t: 'box', x: horiz ? x : x + off, z: horiz ? z + off : z, w: horiz ? 7 : 2.8, d: horiz ? 2.8 : 7, h: 2.8 * stack, style: 'container', color: pick2(r, cols) });
          }
        }
      }
      for (let i = 0; i < 6; i++) {
        const horiz = r() < 0.5;
        o.push({ t: 'box', x: (r() - 0.5) * 120, z: (r() - 0.5) * 100, w: horiz ? 10 : 1.4, d: horiz ? 1.4 : 10, h: 2, style: 'pipes' });
      }
      for (let i = 0; i < 8; i++) o.push({ t: 'cyl', x: (r() - 0.5) * 120, z: (r() - 0.5) * 100, r: 1.1, h: 1.8, style: 'drums' });
      return o;
    },
  },
  pad: {
    id: 'pad', name: 'Proving Pad', short: 'Practice', hx: 55, hz: 55,
    desc: 'The garage test range. Painted lines, a few barriers and nobody keeping score.',
    ground: '#5d6066', ground2: '#4b4e54', sky: ['#4f5d6b', '#a8a49a'], fog: '#7f8288', fogD: [70, 200], sun: '#ffffff', amb: 0.6,
    gen(r) {
      return [
        { t: 'box', x: -20, z: 8, w: 8, d: 1.6, h: 1.8, style: 'barrier' },
        { t: 'box', x: 20, z: 8, w: 8, d: 1.6, h: 1.8, style: 'barrier' },
        { t: 'box', x: 0, z: -14, w: 1.6, d: 8, h: 4, style: 'barrier' },
        { t: 'cyl', x: -30, z: -25, r: 3, h: 6, style: 'pillar' },
        { t: 'cyl', x: 30, z: 25, r: 3, h: 6, style: 'pillar' },
      ];
    },
  },
};
function pick2(r, arr) { return arr[Math.floor(r() * arr.length)]; }
const MAP_ORDER = ['field', 'ruins', 'canyon', 'yard'];

// ---------------------------------------------------------------------
// DESIGN HELPER
// ---------------------------------------------------------------------
function mkDesign(name, frame, o = {}) {
  const [chassis, legs, torso, head, reactor] = frame.split(' ');
  const d = {
    id: o.id || uid(), name,
    parts: { chassis, legs, torso, head, reactor, armL: o.armL || null, armR: o.armR || null, shL: o.shL || null, shR: o.shR || null, back: o.back || null, core: (o.core || []).slice(0, 4) },
    armor: o.armor || 'a_std',
    plates: o.plates || {},
    mirror: true,
    paint: Object.assign({}, DEFAULT_PAINT, o.paint || {}),
  };
  while (d.parts.core.length < 4) d.parts.core.push(null);
  return d;
}
function paint(p, s, a, pattern, num, plate) { return { p, s, a, pattern, num, plate }; }

// ---------------------------------------------------------------------
// RIVAL MECH DESIGNS
// ---------------------------------------------------------------------
const ENEMY_DESIGNS = {
  // Tier 1
  rattlecan: mkDesign('Rattlecan', 'c_wsp l_spr t_box h_opt r_emb', { armL: 'w_gat', armR: 'w_lac', core: ['s_amm', 's_hs'], plates: { tf1: 'p_lgt', tf2: 'p_lgt' }, paint: paint('#c9a23a', '#3a2a1a', '#ff4d3d', 'hazard', '13', 'RATTLE') }),
  pike: mkDesign('Pike', 'c_wsp l_str t_wdg h_opt r_emb', { armL: 'w_lac', armR: 'w_ac', shL: 'w_srm', core: ['s_amm', 's_hs'], plates: { tf1: 'p_hvy' }, paint: paint('#5b6340', '#2e3324', '#e0c060', 'camo', '22', 'PIKE') }),
  coil: mkDesign('Coil', 'c_skf l_spr t_spn h_opt r_emb', { armL: 'w_mlas', armR: 'w_mlas', core: ['s_hs'], paint: paint('#2e6fa0', '#1a2430', '#ffffff', 'twotone', '04', 'COIL') }),
  wasp: mkDesign('Wasp', 'c_wsp l_hov t_spn h_opt r_cld', { armL: 'w_plas', armR: 'w_plas', shL: 'w_mlas', core: ['s_hs'], back: 'b_bst', armor: 'a_abl', paint: paint('#e8c020', '#151515', '#151515', 'stripes', '01', 'WASP') }),
  // Tier 2
  ledger: mkDesign('Ledger', 'c_rng l_atl t_box h_wsc r_frg', { armL: 'w_srm', armR: 'w_srm', shL: 'w_lrm', shR: 'w_lrm', core: ['s_amm', 's_ecm', 's_hs'], plates: { tf1: 'p_hvy' }, paint: paint('#3d7d4a', '#22301f', '#e0e0d0', 'splinter', '31', 'LEDGER') }),
  hound: mkDesign('Hound', 'c_wsp l_spr t_box h_opt r_emb', { armL: 'w_lac', armR: 'w_plas', core: ['s_hs'], back: 'b_bst', paint: paint('#7a5a3a', '#2b2b2e', '#ff8a3d', 'digital', '66', 'HOUND') }),
  furnace: mkDesign('Furnace', 'c_rng l_str t_box h_crn r_frg', { armL: 'w_flm', armR: 'w_plz', shL: 'w_mlas', core: ['s_hs', 's_hs', 's_amm'], back: 'b_jj', armor: 'a_abl', plates: { tf1: 'p_hvy', tf2: 'p_hvy' }, paint: paint('#8a2a1a', '#2a1a14', '#ffb000', 'hazard', '09', 'FURNACE') }),
  anvil: mkDesign('Anvil', 'c_wdn l_crw t_wdg h_crn r_frg', { armL: 'w_shd', armR: 'w_ac', shL: 'w_lac', shR: 'w_lac', core: ['s_amm', 's_hs'], plates: { tf1: 'p_hvy', tf2: 'p_hvy' }, paint: paint('#4a4f57', '#1d2026', '#e08a3a', 'stripes', '55', 'ANVIL') }),
  // Tier 3
  glasswing: mkDesign('Glasswing', 'c_rng l_hov t_spn h_hwk r_ovd', { armL: 'w_beam', armR: 'w_plas', shL: 'w_plas', shR: 'w_mlas', core: ['s_cry', 's_cry'], back: 'b_bst', armor: 'a_abl', paint: paint('#e8eef2', '#2fa7c8', '#36d0ff', 'splinter', '88', 'GLASS') }),
  longshot: mkDesign('Longshot', 'c_bst l_atl t_box h_wsc r_frg', { back: 'w_art', shL: 'w_lrm', shR: 'w_lrm', armL: 'w_lac', armR: 'w_lac', core: ['s_amm', 's_amm', 's_hs'], plates: { tf1: 'p_hvy', tf2: 'p_hvy' }, paint: paint('#6b553a', '#3a3024', '#8fbf4a', 'camo', '12', 'ROOK') }),
  kite: mkDesign('Kite', 'c_skf l_hov t_spn h_wsc r_emb', { armL: 'w_mlas', armR: 'w_mlas', core: ['s_ecm', 's_hs'], paint: paint('#8fbf4a', '#22301f', '#ffffff', 'twotone', '3', 'KITE') }),
  choir: mkDesign('Choir', 'c_bst l_str t_box h_opt r_frg', { armL: 'w_ac', armR: 'w_plas', shL: 'w_srm', shR: 'w_srm', core: ['s_amm', 's_hs', 's_fcc'], plates: { tf1: 'p_hvy', tsL: 'p_lgt', tsR: 'p_lgt' }, paint: paint('#5c5f66', '#2a2c31', '#c9d6df', 'digital', '40', 'CHOIR') }),
  sunspot: mkDesign('Sunspot', 'c_bst l_atl t_frt h_hwk r_sun', { armL: 'w_sol', armR: 'w_beam', shL: 'w_plas', shR: 'w_plas', core: ['s_cry', 's_cry', 's_cry'], armor: 'a_abl', paint: paint('#f2efe6', '#c79a2a', '#36d0ff', 'twotone', '00', 'SUNSPOT') }),
  prism: mkDesign('Prism', 'c_rng l_hov t_spn h_opt r_frg', { armL: 'w_plas', armR: 'w_plas', shL: 'w_mlas', shR: 'w_mlas', core: ['s_hs', 's_hs'], armor: 'a_abl', paint: paint('#c9d6df', '#2fa7c8', '#36d0ff', 'stripes', '17', 'PRISM') }),
  // Tier 4
  tidebiter: mkDesign('Tidebiter', 'c_wsp l_spr t_box h_opt r_emb', { armL: 'w_bld', armR: 'w_sgc', core: ['s_hs', 's_amm'], back: 'b_bst', plates: { tf1: 'p_hvy' }, paint: paint('#8a4b22', '#3a2a1a', '#c9a23a', 'hazard', '5', 'TIDE') }),
  tidegun: mkDesign('Tidegun', 'c_wsp l_spr t_box h_opt r_emb', { armL: 'w_gat', armR: 'w_gat', core: ['s_amm', 's_hs'], back: 'b_bst', paint: paint('#8a4b22', '#3a2a1a', '#c9a23a', 'digital', '6', 'TIDE') }),
  corvane: mkDesign('Old Corvane', 'c_col l_jug t_frt h_wsc r_frg', { shL: 'w_lrm', shR: 'w_lrm', back: 'w_lrm', armL: 'w_srm', armR: 'w_srm', core: ['s_amm', 's_amm', 's_ecm'], armor: 'a_rea', plates: { tf1: 'p_hvy', tf2: 'p_hvy', tsL: 'p_hvy', tsR: 'p_hvy' }, paint: paint('#4f5a36', '#262b1c', '#e0c060', 'camo', '71', 'CORVANE') }),
  bulwark: mkDesign('Bulwark', 'c_bst l_crw t_wdg h_crn r_frg', { armL: 'w_shd', armR: 'w_hac', shL: 'w_srm', shR: 'w_srm', core: ['s_amm', 's_hs'], armor: 'a_rei', plates: { tf1: 'p_hvy' }, paint: paint('#3a3f47', '#16181c', '#ffb000', 'stripes', '44', 'BULWARK') }),
  lancer: mkDesign('Lancer', 'c_col l_jug t_frt h_hwk r_sun', { armL: 'w_rail', armR: 'w_rail', shL: 'w_ndl', shR: 'w_plas', core: ['s_cry', 's_amm', 's_fcc'], plates: { tf1: 'p_hvy', tf2: 'p_hvy', tsL: 'p_hvy', tsR: 'p_hvy' }, paint: paint('#e8eef2', '#3a4a5a', '#2fd6e8', 'splinter', '02', 'LANCER') }),
  cinder: mkDesign('Cinder', 'c_bst l_stk t_wdg h_crn r_ovd', { armL: 'w_plz', armR: 'w_plz', shL: 'w_swm', shR: 'w_mlas', core: ['s_cry', 's_hs'], back: 'b_jj', armor: 'a_abl', plates: { tf1: 'p_hvy', tf2: 'p_hvy' }, paint: paint('#3a1a14', '#1a0e0a', '#ff5a2a', 'hazard', '66', 'CINDER') }),
  thunder: mkDesign('Thunder', 'c_bst l_atl t_brl h_wsc r_frg', { back: 'w_art', shL: 'w_lrm', shR: 'w_mor', armL: 'w_ac', armR: 'w_ac', core: ['s_amm', 's_amm', 's_hs'], paint: paint('#6c6a63', '#2a2925', '#ff8a3d', 'digital', '90', 'THUNDER') }),
  saint: mkDesign('Iron Saint', 'c_col l_jug t_frt h_crn r_sun', { armL: 'w_tsh', armR: 'w_rail', shL: 'w_ndl', shR: 'w_ndl', back: 'b_drn', core: ['s_amm', 's_aam', 's_cry', 's_rfx'], armor: 'a_rei', plates: { tf1: 'p_blk', tf2: 'p_blk' }, paint: paint('#1d1f24', '#b8a070', '#ffd27a', 'twotone', 'I', 'SAINT') }),
  goliath: mkDesign('Goliath', 'c_col l_jug t_frt h_crn r_sun', { armL: 'w_hac', armR: 'w_hac', shL: 'w_srm', shR: 'w_srm', back: 'w_art', core: ['s_amm', 's_aam', 's_hs', 's_cry'], plates: { tf1: 'p_hvy', tf2: 'p_hvy' }, paint: paint('#4a3a2a', '#1a1612', '#e08a3a', 'stripes', '88', 'GOLIATH') }),
  tempest: mkDesign('Tempest', 'c_col l_stk t_frt h_hwk r_sun', { armL: 'w_sol', armR: 'w_rail', shL: 'w_plas', shR: 'w_mlas', core: ['s_cry', 's_cry', 's_amm'], armor: 'a_abl', plates: { tf1: 'p_hvy', tf2: 'p_hvy', tsL: 'p_hvy', tsR: 'p_hvy' }, paint: paint('#dfe6ea', '#2a3a4a', '#5fe9ff', 'splinter', '27', 'TEMPEST') }),
  hellfire: mkDesign('Hellfire', 'c_col l_atl t_wdg h_wsc r_frg', { shL: 'w_swm', shR: 'w_swm', back: 'w_lrm', armL: 'w_srm', armR: 'w_srm', core: ['s_amm', 's_amm'], armor: 'a_rea', plates: { tf1: 'p_hvy', tf2: 'p_hvy', tsL: 'p_hvy', tsR: 'p_hvy', tb: 'p_lgt' }, paint: paint('#6a5a2a', '#2a2414', '#ff8a3d', 'camo', '35', 'HELLFIRE') }),
  // Sparring and challenge stock
  spar_l: mkDesign('Sparring Bot', 'c_wsp l_str t_box h_opt r_emb', { armL: 'w_lac', armR: 'w_mlas', core: ['s_hs'], paint: paint('#9aa6b2', '#3a4048', '#ffb000', 'hazard', 'SB', 'SPAR') }),
  spar_m: mkDesign('Sparring Bot', 'c_rng l_str t_box h_opt r_frg', { armL: 'w_ac', armR: 'w_plas', shR: 'w_srm', core: ['s_hs', 's_amm'], paint: paint('#9aa6b2', '#3a4048', '#ffb000', 'hazard', 'SB', 'SPAR') }),
  spar_h: mkDesign('Sparring Bot', 'c_bst l_crw t_box h_opt r_frg', { armL: 'w_hac', armR: 'w_beam', shL: 'w_srm', shR: 'w_srm', core: ['s_hs', 's_amm', 's_hs'], paint: paint('#9aa6b2', '#3a4048', '#ffb000', 'hazard', 'SB', 'SPAR') }),
  dummy: mkDesign('Target Dummy', 'c_rng l_crw t_box h_opt r_emb', { plates: { tf1: 'p_hvy', tf2: 'p_hvy', tsL: 'p_lgt', tsR: 'p_lgt', tb: 'p_lgt', tt: 'p_lgt' }, paint: paint('#d8d2c0', '#c23a2a', '#1a1a1a', 'hazard', 'XX', 'TARGET') }),
};
for (const k in ENEMY_DESIGNS) ENEMY_DESIGNS[k].id = 'enemy_' + k;

const STARTER_DESIGNS = () => [
  mkDesign('Fledgling', 'c_wsp l_str t_box h_opt r_emb', { armL: 'w_lac', armR: 'w_plas', shR: 'w_srm', core: ['s_hs', 's_amm'], back: 'b_jj', plates: { tf1: 'p_lgt' }, paint: paint('#6d7884', '#2b3038', '#ffb000', 'stripes', '07', 'FLEDGLING') }),
  mkDesign('Scrapper', 'c_wsp l_str t_box h_opt r_emb', { armL: 'w_gat', armR: 'w_bld', shL: 'w_lac', core: ['s_hs', 's_amm'], plates: { tf1: 'p_hvy', tf2: 'p_hvy' }, paint: paint('#7a5a3a', '#2b2b2e', '#ffb000', 'hazard', '19', 'SCRAPPER') }),
];

// ---------------------------------------------------------------------
// RIVAL PILOTS
// ---------------------------------------------------------------------
const RIVALS = {
  dex: { name: 'Dex Moreau', call: 'Rattlecan', faction: 'rus', skill: 0.25, trait: 'brawler', level: 1, style: 'Twin gatling sprinter', bio: 'Rustwater scrap kid who thinks volume is a strategy. Usually he is right for about ten seconds.' },
  ivo: { name: 'Ivo Brandt', call: 'Pike', faction: 'hal', skill: 0.35, trait: 'marksman', level: 2, style: 'Wedge hulled gunner', bio: 'Halvard apprentice. Keeps his nose pointed at you and his armor thick.' },
  twins: { name: 'Nessa and Jory Vale', call: 'Twin Coil', faction: 'lum', skill: 0.3, trait: 'drifter', level: 1, style: 'Paired micro laser scouts', bio: 'Siblings who share one garage and one brain cell. They make it count.' },
  mira: { name: 'Mira Kestl', call: 'The Wasp', faction: 'lum', skill: 0.6, trait: 'drifter', level: 4, style: 'Hover laser kiter', bio: 'Scrapyard Circuit champion three seasons running. She never stops moving and never stops stinging.' },
  odalys: { name: 'Odalys Venn', call: 'Ledger', faction: 'cor', skill: 0.5, trait: 'tactician', level: 3, style: 'Missile boat', bio: 'Corvane accountant turned pilot. Counts every missile, wastes none.' },
  pack: { name: 'The Hound Pack', call: 'Hounds', faction: 'rus', skill: 0.4, trait: 'brawler', level: 3, style: 'Swarm of light mechs', bio: 'Three Rustwater runners who hunt together and share the purse.' },
  caul: { name: 'Brother Caul', call: 'Furnace', faction: 'rus', skill: 0.5, trait: 'coolhead', level: 4, style: 'Flame and plasma brawler', bio: 'Preaches that heat is holy. Brings a lot of it.' },
  gregor: { name: 'Gregor Halvard', call: 'Anvil', faction: 'hal', skill: 0.65, trait: 'ironnerve', level: 5, style: 'Shielded tracked brick', bio: 'Heir to the Halvard Foundries. Slow, patient, and almost impossible to dent.' },
  sable: { name: 'Sable Quist', call: 'Glasswing', faction: 'lum', skill: 0.65, trait: 'drifter', level: 6, style: 'Energy kiting hover', bio: 'Lumen test pilot. Fights at the edge of your range and smiles about it.' },
  rook: { name: 'Rook', call: 'Longshot', faction: 'cor', skill: 0.6, trait: 'tactician', level: 6, style: 'Artillery sniper with spotter', bio: 'Never seen outside the cockpit. Shells arrive before the sound does.' },
  choir: { name: 'The Iron Choir', call: 'Choir', faction: 'kaa', skill: 0.6, trait: 'marksman', level: 6, style: 'Disciplined medium trio', bio: 'Arena Authority enforcers. Three mechs, one voice, focus fire on cue.' },
  yara: { name: 'Yara Lumen', call: 'Sunspot', faction: 'lum', skill: 0.75, trait: 'coolhead', level: 7, style: 'Heavy beam lasers', bio: 'Syndicate heiress. Her beams can melt a light frame in one sweep.' },
  tide: { name: 'Rustwater Tide', call: 'Rust Tide', faction: 'rus', skill: 0.55, trait: 'brawler', level: 8, style: 'Five light swarm', bio: 'The whole Combine yard turned out. Blades, scatter guns, and no fear.' },
  corvane: { name: 'Old Corvane', call: 'Patriarch', faction: 'cor', skill: 0.7, trait: 'tactician', level: 9, style: 'Twin missile walls', bio: 'Founder of the Freehold. Buries arenas in missiles from beyond your sight.' },
  mirror: { name: 'Foundry Elite', call: 'Mirror', faction: 'hal', skill: 0.75, trait: 'marksman', level: 9, style: 'Four mixed heavies', bio: 'The best pilots money can rent. Each one built to cover the others.' },
  vell: { name: 'Kaiser Vell', call: 'The Iron Saint', faction: 'hal', skill: 0.9, trait: 'marksman', level: 10, style: 'Assault railgun with tower shield', bio: 'Undefeated Crown holder. Nobody has seen the back of his mech and lived to brag.' },
};

// ---------------------------------------------------------------------
// CAMPAIGN LADDER
// ---------------------------------------------------------------------
const CAMPAIGN = [
  {
    tier: 1, name: 'Scrapyard Circuit', maxT: 35, squad: 1, color: '#c9a23a',
    blurb: 'Light frames only. Dirt arenas, loud crowds, and pilots with something to prove.',
    unlockText: 'Medium class 55t | Squad of 2 | Tier 2 parts',
    matches: [
      { id: 't1m1', rival: 'dex', map: 'field', enemies: ['rattlecan'], credits: 1400, rep: 20 },
      { id: 't1m2', rival: 'ivo', map: 'ruins', enemies: ['pike'], credits: 1700, rep: 25 },
      { id: 't1m3', rival: 'twins', map: 'yard', enemies: ['coil', 'coil'], credits: 2000, rep: 30 },
      { id: 't1m4', rival: 'mira', map: 'canyon', enemies: ['wasp'], credits: 3200, rep: 60, boss: true },
    ],
  },
  {
    tier: 2, name: 'Foundry League', maxT: 55, squad: 2, color: '#e08a3a',
    blurb: 'Medium frames and foundry sponsors. Squads of two, missiles in the air.',
    unlockText: 'Heavy class 75t | Squad of 3 | Tier 3 parts',
    matches: [
      { id: 't2m1', rival: 'odalys', map: 'field', enemies: ['ledger', 'hound'], credits: 3600, rep: 40 },
      { id: 't2m2', rival: 'pack', map: 'ruins', enemies: ['hound', 'hound', 'hound'], credits: 4000, rep: 45 },
      { id: 't2m3', rival: 'caul', map: 'yard', enemies: ['furnace', 'coil'], credits: 4200, rep: 50 },
      { id: 't2m4', rival: 'gregor', map: 'canyon', enemies: ['anvil', 'ledger'], credits: 6500, rep: 90, boss: true },
    ],
  },
  {
    tier: 3, name: 'Lumen Cup', maxT: 75, squad: 3, color: '#36d0ff',
    blurb: 'Heavy class, sponsor money, and the first real artillery duels.',
    unlockText: 'Assault class 100t | Squad of 4 | Tier 4 parts',
    matches: [
      { id: 't3m1', rival: 'sable', map: 'field', enemies: ['glasswing', 'glasswing', 'prism', 'prism'], credits: 7000, rep: 60 },
      { id: 't3m2', rival: 'rook', map: 'canyon', enemies: ['longshot', 'longshot', 'choir', 'kite'], credits: 7600, rep: 65 },
      { id: 't3m3', rival: 'choir', map: 'ruins', enemies: ['choir', 'choir', 'choir', 'choir'], credits: 8200, rep: 70 },
      { id: 't3m4', rival: 'yara', map: 'yard', enemies: ['sunspot', 'glasswing', 'prism', 'prism'], credits: 12000, rep: 130, boss: true },
    ],
  },
  {
    tier: 4, name: 'Crown of Tessaline', maxT: 100, squad: 4, color: '#ff4d3d',
    blurb: 'Assault frames. The water rights of a continent ride on every match.',
    unlockText: 'Champion of the Forge Circuit',
    matches: [
      { id: 't4m1', rival: 'tide', map: 'yard', enemies: ['tidebiter', 'tidebiter', 'tidegun', 'tidegun', 'cinder', 'cinder', 'bulwark', 'thunder'], credits: 13000, rep: 90 },
      { id: 't4m2', rival: 'corvane', map: 'canyon', enemies: ['corvane', 'corvane', 'hellfire', 'tempest'], credits: 14000, rep: 100 },
      { id: 't4m3', rival: 'mirror', map: 'ruins', enemies: ['goliath', 'tempest', 'lancer', 'cinder', 'thunder'], credits: 15000, rep: 110 },
      { id: 't4m4', rival: 'vell', map: 'field', enemies: ['saint', 'tempest', 'lancer', 'corvane', 'goliath'], credits: 25000, rep: 250, boss: true },
    ],
  },
];
const MATCH_BY_ID = {};
for (const t of CAMPAIGN) for (const m of t.matches) { m.tier = t.tier; m.maxT = t.maxT; m.squad = t.squad; MATCH_BY_ID[m.id] = m; }

// ---------------------------------------------------------------------
// CHALLENGES
// ---------------------------------------------------------------------
const CHALLENGES = [
  { id: 'ch_kin', name: 'Kinetic Purist', tier: 1, rule: { noDtype: 'ene' }, desc: 'Win with no energy weapons.', map: 'yard', enemies: ['pike'], maxT: 35, squad: 1, credits: 1500, rep: 20, part: 'w_sgc' },
  { id: 'ch_steel', name: 'Cold Steel', tier: 1, rule: { meleeOnly: true }, desc: 'Melee weapons and shields only.', map: 'ruins', enemies: ['spar_l'], maxT: 35, squad: 1, credits: 1800, rep: 25, part: 'l_spr' },
  { id: 'ch_bare', name: 'Bare Metal', tier: 1, rule: { noPlates: true }, desc: 'No armor plates on any mounting point.', map: 'field', enemies: ['rattlecan'], maxT: 35, squad: 1, credits: 1400, rep: 20, part: 'w_mor' },
  { id: 'ch_cheap', name: 'Shoestring', tier: 1, rule: { maxCost: 9000 }, desc: 'Total build cost under 9,000 credits.', map: 'canyon', enemies: ['pike'], maxT: 35, squad: 1, credits: 2000, rep: 25, part: 't_wdg' },
  { id: 'ch_feather', name: 'Featherweight', tier: 2, rule: { maxT: 40 }, desc: 'Beat a medium with a build under 40 tons.', map: 'ruins', enemies: ['choir'], maxT: 55, squad: 1, credits: 4500, rep: 45, part: 'c_skf' },
  { id: 'ch_nolock', name: 'No Lock', tier: 2, rule: { noKind: ['missile', 'artillery'] }, desc: 'No missiles or artillery.', map: 'field', enemies: ['ledger'], maxT: 55, squad: 1, credits: 4000, rep: 40, part: 's_rfx' },
  { id: 'ch_hover', name: 'Hover Duel', tier: 2, rule: { legsType: 'hover' }, desc: 'Hover legs only, against the Wasp.', map: 'canyon', enemies: ['wasp', 'wasp'], maxT: 55, squad: 1, credits: 4200, rep: 40, part: 'l_hov' },
  { id: 'ch_heat', name: 'Heat Wave', tier: 3, rule: { noCooling: true }, desc: 'No heatsinks, radiators or heat fins.', map: 'yard', enemies: ['furnace'], maxT: 75, squad: 1, credits: 6500, rep: 55, part: 'r_ovd' },
  { id: 'ch_lone', name: 'Lone Wolf', tier: 3, rule: {}, desc: 'Solo against a squad of three.', map: 'ruins', enemies: ['hound', 'hound', 'choir'], maxT: 75, squad: 1, credits: 8000, rep: 70, part: 'b_drn' },
  { id: 'ch_titan', name: 'Titan Slayer', tier: 4, rule: { maxT: 35 }, desc: 'Take down an assault with a light build.', map: 'ruins', enemies: ['corvane'], maxT: 100, squad: 1, credits: 15000, rep: 120, part: 'w_sol' },
];

// ---------------------------------------------------------------------
// PILOTS
// ---------------------------------------------------------------------
const PILOT_TRAITS = {
  marksman: { name: 'Marksman', desc: '+8% accuracy', acc: 0.08 },
  coolhead: { name: 'Cool Head', desc: '+15% heat dissipation | Holds fire smarter', dis: 0.15 },
  brawler: { name: 'Brawler', desc: '+15% damage inside 20m', close: 0.15 },
  tactician: { name: 'Tactician', desc: '+12% guided and indirect accuracy', gacc: 0.12 },
  ironnerve: { name: 'Iron Nerve', desc: 'Never retreats | 30% fewer internal crits', nerve: true },
  drifter: { name: 'Drifter', desc: '+10% speed', spd: 0.1 },
  mechanic: { name: 'Field Mechanic', desc: 'Patches 1.5 structure per second', fix: 1.5 },
};
const PILOT_FIRST = ['Ash', 'Bren', 'Cato', 'Dara', 'Esk', 'Fen', 'Gale', 'Hollis', 'Ines', 'Jun', 'Kael', 'Lio', 'Maro', 'Nyx', 'Oren', 'Pell', 'Quill', 'Rhea', 'Sol', 'Tamsin', 'Uri', 'Vesna', 'Wren', 'Yorik', 'Zeph'];
const PILOT_LAST = ['Arkwright', 'Basalt', 'Corran', 'Dunmore', 'Embry', 'Falk', 'Grist', 'Harrow', 'Ilsted', 'Jarnak', 'Kestrel', 'Lomax', 'Marrow', 'Novak', 'Oakes', 'Pryor', 'Quarry', 'Rusk', 'Stroud', 'Tallis', 'Varga', 'Whitlow'];
const PILOT_CALLS = ['Anchor', 'Bolt', 'Cinder', 'Dusk', 'Ember', 'Flint', 'Grit', 'Hex', 'Iris', 'Jackal', 'Knuckle', 'Lark', 'Moth', 'Nail', 'Onyx', 'Piston', 'Quartz', 'Rivet', 'Slag', 'Torque', 'Vane', 'Wick'];
const RANKS = [
  { rep: 0, name: 'Unknown' },
  { rep: 60, name: 'Scrapper' },
  { rep: 200, name: 'Contender' },
  { rep: 450, name: 'Veteran' },
  { rep: 800, name: 'Headliner' },
  { rep: 1300, name: 'Champion' },
];
function rankFor(rep) { let r = RANKS[0]; for (const k of RANKS) if (rep >= k.rep) r = k; return r; }
