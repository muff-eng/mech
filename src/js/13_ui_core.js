// =====================================================================
// 13 | UI | CORE (screens, navigation, tooltips, toasts, modals, hangar 3D)
// =====================================================================
const NAV = [
  { id: 'hangar', name: 'Hangar' },
  { id: 'arena', name: 'Arena' },
  { id: 'shop', name: 'Parts Shop' },
  { id: 'salvage', name: 'Salvage' },
  { id: 'roster', name: 'Pilot Roster' },
  { id: 'settings', name: 'Settings' },
];

const UI = {
  cur: null, screens: {}, battleHud: null,
  reg(id, obj) { this.screens[id] = obj; },
  init() {
    const top = $('#topbar');
    top.innerHTML = '<div class="logo" data-act="title"><div class="gear"></div><span>MECH <b>FORGE</b></span></div><nav id="nav"></nav><div class="wallet" id="wallet"></div>';
    top.addEventListener('click', (e) => {
      const b = e.target.closest('[data-nav]');
      if (b) { AUDIO.play('click'); this.show(b.dataset.nav); }
      if (e.target.closest('[data-act=title]')) { AUDIO.play('click'); this.show('title'); }
    });
    // tooltips
    document.addEventListener('mouseover', (e) => {
      const el = e.target.closest && e.target.closest('[data-part],[data-tip]');
      if (!el) { this.hideTip(); return; }
      let html = '';
      if (el.dataset.part) {
        const p = PARTS[el.dataset.part];
        const cmp = el.dataset.cmp ? PARTS[el.dataset.cmp] : null;
        if (p) html = partTooltipHTML(p, cmp);
      } else html = '<div>' + el.dataset.tip + '</div>';
      this.showTip(html, e);
    });
    document.addEventListener('mousemove', (e) => { if (this._tipOn) this.placeTip(e); });
    document.addEventListener('mousedown', () => this.hideTip());
    document.addEventListener('click', (e) => { if (e.target.closest('.btn, .tabs button, .brush')) AUDIO.play('click'); }, true);
    window.addEventListener('keydown', (e) => this.onKey(e));
  },
  onKey(e) {
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
    if (this.cur === 'battle' && this.battleHud) this.battleHud.onKey(e);
    if (e.key === 'Escape' && $('#modal').classList.contains('on') && this._modalEsc) this._modalEsc();
  },
  showTip(html, e) { const t = $('#tooltip'); t.innerHTML = html; t.style.display = 'block'; this._tipOn = true; this.placeTip(e); },
  placeTip(e) {
    const t = $('#tooltip');
    const w = t.offsetWidth, h = t.offsetHeight;
    let x = e.clientX + 16, y = e.clientY + 14;
    if (x + w > window.innerWidth - 8) x = e.clientX - w - 16;
    if (y + h > window.innerHeight - 8) y = Math.max(8, window.innerHeight - h - 8);
    t.style.left = x + 'px'; t.style.top = y + 'px';
  },
  hideTip() { if (this._tipOn) { $('#tooltip').style.display = 'none'; this._tipOn = false; } },
  renderTop() {
    const inBattle = this.cur === 'battle';
    $('#topbar').style.display = inBattle ? 'none' : 'flex';
    const pend = S.salvage.length;
    $('#nav').innerHTML = NAV.map((n) => '<button data-nav="' + n.id + '" class="' + (this.cur === n.id ? 'on' : '') + '">' + n.name + (n.id === 'salvage' && pend ? '<span class="badge">' + pend + '</span>' : '') + '</button>').join('');
    const rank = rankFor(S.rep);
    $('#wallet').innerHTML = (isSandbox() ? '<span class="mode">SANDBOX</span>' : '') +
      '<span class="cr" data-tip="Credits">CR ' + fmt(S.credits) + '</span><span class="rep" data-tip="Reputation | Rank ' + esc(rank.name) + '">REP ' + fmt(S.rep) + ' | ' + esc(rank.name) + '</span><span class="dim">Tier ' + Math.min(4, S.tier) + '</span>';
  },
  show(id, arg) {
    this.hideTip();
    const prev = this.cur;
    if (prev && this.screens[prev] && this.screens[prev].leave) this.screens[prev].leave(id);
    this.cur = id;
    for (const s of $$('.screen')) s.classList.toggle('on', s.id === 'scr-' + id);
    this.renderTop();
    const scr = this.screens[id];
    if (scr && scr.enter) scr.enter(arg);
    VIEW.onScreen(id);
  },
  refresh() { const s = this.screens[this.cur]; if (s && s.render) s.render(); this.renderTop(); },
  toast(msg, cls = '', ms = 3200) {
    const el = document.createElement('div');
    el.className = 'toast ' + cls; el.innerHTML = msg;
    $('#toasts').appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .4s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 450); }, ms);
  },
  modal({ title, body, buttons = [], wide = false, onClose = null, esc = true }) {
    const m = $('#modal');
    m.innerHTML = '<div class="panel mbox rivets ' + (wide ? 'wide' : '') + '"><h3>' + title + '</h3><div class="mbody">' + body + '</div><div class="mfoot"></div></div>';
    const foot = m.querySelector('.mfoot');
    const close = () => { m.classList.remove('on'); m.innerHTML = ''; this._modalEsc = null; if (onClose) onClose(); };
    for (const b of buttons) {
      const el = document.createElement('button');
      el.className = 'btn ' + (b.cls || ''); el.textContent = b.label;
      el.onclick = () => { const r = b.action ? b.action(m) : undefined; if (r !== false) close(); };
      foot.appendChild(el);
    }
    if (!buttons.length) foot.remove();
    m.classList.add('on');
    this._modalEsc = esc ? close : null;
    return { el: m, close };
  },
  confirm(title, text, ok = 'Confirm', cls = 'pri') {
    return new Promise((res) => this.modal({ title, body: '<p>' + text + '</p>', buttons: [{ label: 'Cancel', action: () => res(false) }, { label: ok, cls, action: () => res(true) }], onClose: () => res(false) }));
  },
  prompt(title, value = '', opts = {}) {
    return new Promise((res) => {
      let done = false;
      const fin = (v) => { if (!done) { done = true; res(v); } };
      const area = opts.area;
      const body = (opts.text ? '<p class="dim">' + opts.text + '</p>' : '') + (area ? '<textarea id="pv" rows="' + (opts.rows || 5) + '"' + (opts.readonly ? ' readonly' : '') + '></textarea>' : '<input id="pv" type="text" maxlength="' + (opts.max || 24) + '" style="width:100%">');
      const btns = opts.readonly ? [{ label: 'Copy', cls: 'cy', action: () => { const t = $('#pv'); t.select(); try { navigator.clipboard.writeText(t.value); } catch (e) { document.execCommand('copy'); } UI.toast('Copied to clipboard', 'green'); return false; } }, { label: 'Close', action: () => fin(null) }]
        : [{ label: 'Cancel', action: () => fin(null) }, { label: opts.ok || 'OK', cls: 'pri', action: () => fin($('#pv').value) }];
      this.modal({ title, body, buttons: btns, onClose: () => fin(null) });
      const inp = $('#pv'); inp.value = value;
      setTimeout(() => { inp.focus(); if (!area) inp.select(); }, 30);
      if (!area) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { fin(inp.value); $('#modal').classList.remove('on'); } });
    });
  },
  onResize() { if (this.screens[this.cur] && this.screens[this.cur].onResize) this.screens[this.cur].onResize(); },
};

function emblemHTML(rv, lg) {
  const f = FACTIONS[rv.faction] || FACTIONS.kaa;
  const init = (rv.call || rv.name).replace(/^The /, '').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return '<div class="emblem' + (lg ? ' lg' : '') + '" style="background:linear-gradient(160deg,' + f.color + ',' + shade(f.color, -0.45) + ')">' + esc(init) + '</div>';
}
function bar(frac, cls = '', mark) {
  return '<div class="bar"><i class="' + cls + '" style="width:' + clamp(frac * 100, 0, 100).toFixed(1) + '%"></i>' + (mark != null ? '<b style="left:' + clamp(mark * 100, 0, 100) + '%"></b>' : '') + '</div>';
}

// ---------------------------------------------------------------------
// VIEW: which 3D scene renders behind the UI
// ---------------------------------------------------------------------
const VIEW = {
  mode: 'hangar', hangar: null, rig: null, rigKey: '', markers: [], battleView: null, shift: 0,
  initHangar() {
    if (!GFX.ready) return;
    this.hangar = buildHangarScene();
    this.setDesign(activeDesign());
  },
  designKey(d) { return JSON.stringify([d.parts, d.plates, d.armor, d.paint, d.id]); },
  setDesign(d, force) {
    if (!this.hangar || !d) return;
    const key = this.designKey(d);
    if (!force && key === this.rigKey) return;
    this.rigKey = key;
    if (this.rig) disposeMech(this.rig);
    this.rig = buildMech(d);
    this.rig.root.position.y = 0.3;
    this.hangar.turntable.add(this.rig.root);
    this.clearMarkers();
    if (this.showMarkers) this.buildMarkers(this.showMarkers);
    const h = this.rig.dims.height;
    const o = GFX.orbit;
    if (this.mode === 'hangar') { o.tTarget.set(0, h * 0.5 + 0.3, 0); o.minDist = 5; o.maxDist = 40; }
  },
  clearMarkers() { for (const m of this.markers) if (m.parent) m.parent.remove(m); this.markers = []; },
  buildMarkers(opts) {
    this.clearMarkers();
    if (!this.rig) return;
    for (const [id, a] of Object.entries(this.rig.mounts)) {
      const mm = MOUNT_BY_ID[id];
      if (!mm) continue;
      const d = activeDesign();
      if ((mm.comp === 'armL' && !d.parts.armL) || (mm.comp === 'armR' && !d.parts.armR)) continue;
      const sel = opts.sel === id;
      const m = new THREE.Mesh(GEO.sph(0.16, 10, 8), sel ? MAT.markerOn : MAT.marker);
      m.renderOrder = 20; m.userData.mount = id;
      m.position.set(0, 0, 0.35);
      a.add(m);
      const ring = new THREE.Mesh(GEO.torus(0.26, 0.03, 18), sel ? MAT.markerOn : MAT.marker);
      ring.renderOrder = 20; ring.position.z = 0.35; a.add(ring);
      this.markers.push(m, ring);
    }
  },
  pickMarker(e) {
    if (!this.markers.length) return null;
    const r = GFX.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(v, GFX.camera);
    const hits = ray.intersectObjects(this.markers.filter((m) => m.userData.mount), false);
    return hits.length ? hits[0].object.userData.mount : null;
  },
  onScreen(id) {
    if (!GFX.ready) return;
    if (id === 'battle') { this.mode = 'battle'; return; }
    if (this.mode === 'battle') { this.mode = 'hangar'; }
    const o = GFX.orbit;
    o.onClick = (e) => { if (UI.cur === 'hangar' && UI.screens.hangar.onMarkerClick) { const m = this.pickMarker(e); if (m) UI.screens.hangar.onMarkerClick(m); } };
    o.onUserInput = null; o.bounds = null;
    o.minDist = 5; o.maxDist = 40; o.minPitch = 0.02; o.maxPitch = 1.35;
    const h = this.rig ? this.rig.dims.height : 6;
    o.tTarget.set(0, h * 0.5 + 0.3, 0);
    if (id === 'title') { o.tDist = h * 2.2 + 6; o.tPitch = 0.18; o.autoRotate = 0.25; this.shift = 0.2; }
    else if (id === 'hangar') { o.tDist = h * 1.9 + 6; o.tPitch = 0.28; o.autoRotate = 0; this.shift = 0.01; }
    else { o.tDist = h * 2.0 + 7; o.tPitch = 0.22; o.autoRotate = 0.12; this.shift = 0; }
    if (!this.hangar) this.initHangar();
    this.setDesign(activeDesign());
  },
  render(dt) {
    if (!GFX.ready) return;
    const cam = GFX.camera;
    if (this.mode === 'battle' && this.battleView) {
      cam.clearViewOffset();
      this.battleView.update(dt);
      GFX.renderer.render(this.battleView.scene, cam);
      return;
    }
    if (!this.hangar) return;
    GFX.orbit.update(dt);
    if (this.rig) {
      const t = performance.now() / 1000;
      animateRig(this.rig, { spd: 0, stride: 0, torsoYaw: Math.sin(t * 0.4) * 0.12, pitch: 0, heat: 0, t, firing: {} }, dt);
    }
    const sh = (UI.cur === 'title' || UI.cur === 'hangar' || UI.cur === 'arena') && GFX.w > 820 ? this.shift : 0;
    if (sh) cam.setViewOffset(GFX.w, GFX.h, -sh * GFX.w, 0, GFX.w, GFX.h); else cam.clearViewOffset();
    GFX.renderer.render(this.hangar.scene, cam);
  },
};
