// =====================================================================
// 00 | UTILITIES
// =====================================================================
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU; return d; };
const angTo = (x1, z1, x2, z2) => Math.atan2(x2 - x1, z2 - z1);
const dist2d = (x1, z1, x2, z2) => Math.hypot(x2 - x1, z2 - z1);
const damp = (cur, target, rate, dt) => lerp(cur, target, 1 - Math.exp(-rate * dt));
const dampAng = (cur, target, rate, dt) => cur + angDiff(cur, target) * (1 - Math.exp(-rate * dt));
const uid = () => Math.random().toString(36).slice(2, 10);
const clone = (o) => JSON.parse(JSON.stringify(o));
const fmt = (n, d = 0) => {
  if (!isFinite(n)) return '0';
  const v = d ? Number(n).toFixed(d) : Math.round(n).toString();
  const [i, f] = v.split('.');
  const neg = i[0] === '-';
  const body = (neg ? i.slice(1) : i).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + body + (f ? '.' + f : '');
};
const fmt1 = (n) => (Math.abs(n) >= 100 ? fmt(n) : fmt(n, 1).replace(/\.0$/, ''));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function weightedPick(entries) {
  // entries: [[key, weight], ...]
  let tot = 0;
  for (const e of entries) tot += e[1];
  if (tot <= 0) return entries.length ? entries[0][0] : null;
  let r = Math.random() * tot;
  for (const e of entries) { r -= e[1]; if (r <= 0) return e[0]; }
  return entries[entries.length - 1][0];
}
function hexToRgb(h) {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}
function shade(hex, f) {
  const [r, g, b] = hexToRgb(hex);
  return f >= 0 ? rgbToHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f) : rgbToHex(r * (1 + f), g * (1 + f), b * (1 + f));
}
function encodeText(obj) {
  const json = JSON.stringify(obj);
  return btoa(unescape(encodeURIComponent(json)));
}
function decodeText(str) {
  return JSON.parse(decodeURIComponent(escape(atob(str.trim()))));
}
