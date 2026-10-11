// =====================================================================
// 14 | UI | HANGAR (mech builder, armor plates, paint, design management)
// =====================================================================
const Hangar = {
  tab: 'parts', slot: 'armL', brush: 'p_hvy', mount: null,
  enter() { this.render(); },
  leave() { VIEW.showMarkers = null; VIEW.clearMarkers(); },
  d() { return activeDesign(); },
  changed(rebuild = true) {
    save();
    if (rebuild) VIEW.setDesign(this.d());
    this.render();
  },
  compatible(slotId) {
    const sl = SLOT_BY_ID[slotId];
    return PART_LIST.filter((p) => {
      if (!sl.accept.includes(p.slot)) return false;
      if (p.slot === 'weapon') return p.mounts.includes(sl.mount);
      return true;
    }).sort((a, b) => a.tier - b.tier || a.cost - b.cost);
  },
  partIn(slotId) {
    const d = this.d();
    if (slotId.startsWith('core')) return d.parts.core[+slotId.slice(4)] || null;
    return d.parts[slotId] || null;
  },
  install(slotId, pid) {
    const d = this.d();
    if (pid && !ownsPart(pid)) { this.offerBuy(pid, () => this.install(slotId, pid)); return; }
    if (slotId.startsWith('core')) d.parts.core[+slotId.slice(4)] = pid;
    else d.parts[slotId] = pid;
    AUDIO.play('equip');
    this.changed();
  },
  offerBuy(pid, then) {
    const p = PARTS[pid];
    if (!partUnlockedForShop(p)) { UI.toast(esc(p.name) + ' unlocks at Tier ' + p.tier + ' | Or recover it through salvage', 'red'); AUDIO.play('error'); return; }
    if (S.credits < p.cost) { UI.toast('Not enough credits for ' + esc(p.name) + ' | ' + fmt(p.cost) + ' cr', 'red'); AUDIO.play('error'); return; }
    UI.confirm('Buy License', 'Buy the <b>' + esc(p.name) + '</b> license for <b class="amber">' + fmt(p.cost) + ' cr</b>? Licensed parts can be used on every design.', 'Buy').then((ok) => {
      if (!ok) return;
      Shop.buy(pid);
      then && then();
    });
  },
  setMount(mid, item) {
    const d = this.d();
    const m = MOUNT_BY_ID[mid];
    if (!m) return;
    if ((m.comp === 'armL' && !d.parts.armL) || (m.comp === 'armR' && !d.parts.armR)) { UI.toast('Install an arm weapon first', 'amber'); return; }
    if (item && !ownsPart(item)) { this.offerBuy(item, () => this.setMount(mid, item)); return; }
    const apply = (id) => { if (item) d.plates[id] = item; else delete d.plates[id]; };
    apply(mid);
    if (d.mirror && m.mirror) {
      const mm = MOUNT_BY_ID[m.mirror];
      if (!((mm.comp === 'armL' && !d.parts.armL) || (mm.comp === 'armR' && !d.parts.armR))) apply(m.mirror);
    }
    this.mount = mid;
    AUDIO.play('equip');
    this.changed();
    VIEW.buildMarkers({ sel: mid });
  },
  onMarkerClick(mid) { if (this.tab !== 'armor') return; this.setMount(mid, this.brush === 'clear' ? null : this.brush); },

  // --------------------------------------------------------------- render
  render() {
    const root = $('#scr-hangar');
    const keep = {};
    for (const el of $$('.scroll', root)) if (el.dataset.k) keep[el.dataset.k] = el.scrollTop;
    const d = this.d();
    const st = computeStats(d);
    const locked = lockedPartsIn(d);
    root.innerHTML = '<div class="hangar">' +
      '<div class="hcol"><div class="panel rivets pe">' + this.leftHTML(d, st, locked) + '</div></div>' +
      '<div class="hcenter">' + this.centerHTML(d, st) + '</div>' +
      '<div class="hcol right"><div class="panel rivets pe">' + this.rightHTML(d, st, locked) + '</div></div></div>';
    for (const el of $$('.scroll', root)) if (el.dataset.k && keep[el.dataset.k] != null) el.scrollTop = keep[el.dataset.k];
    this.bind(root);
    if (this.tab === 'armor') { VIEW.showMarkers = { sel: this.mount }; VIEW.buildMarkers({ sel: this.mount }); }
    else { VIEW.showMarkers = null; VIEW.clearMarkers(); }
  },
  leftHTML(d, st, locked) {
    const list = designList();
    let h = '<h3>Design Bay<span class="sp"></span><span class="tag ' + (st.valid ? 'green' : 'red') + '">' + (st.valid ? 'Valid' : 'Invalid') + '</span></h3>';
    h += '<div class="hdesign"><select data-k="design">' + list.map((x) => '<option value="' + x.id + '"' + (x.id === d.id ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select>' +
      '<div class="row wrap"><button class="btn sm" data-a="new">New</button><button class="btn sm" data-a="dup">Duplicate</button><button class="btn sm" data-a="ren">Rename</button><button class="btn sm danger" data-a="del">Delete</button><span class="grow"></span><button class="btn sm" data-a="exp" data-tip="Copy this design as a text code">Export</button><button class="btn sm" data-a="imp" data-tip="Paste a design code">Import</button></div></div>';
    h += '<div class="tabs">' + ['parts', 'armor', 'paint'].map((t) => '<button data-tab="' + t + '" class="' + (this.tab === t ? 'on' : '') + '">' + t + '</button>').join('') + '</div>';
    h += '<div class="scroll grow" data-k="left' + this.tab + '">';
    if (this.tab === 'parts') h += this.partsHTML(d, st);
    else if (this.tab === 'armor') h += this.armorHTML(d, st);
    else h += this.paintHTML(d);
    h += '</div>';
    return h;
  },
  partsHTML(d, st) {
    const T = st.T;
    let h = '<div class="slotlist">';
    for (const sl of SLOTS) {
      const pid = this.partIn(sl.id);
      const p = pid ? PARTS[pid] : null;
      const coreOff = sl.core != null && sl.core >= T.core;
      const err = p && p.slot === 'weapon' && sl.mount && !p.mounts.includes(sl.mount);
      const lk = p && !ownsPart(p.id);
      h += '<div class="slot ' + (this.slot === sl.id ? 'on ' : '') + (err ? 'err ' : '') + (lk ? 'locked' : '') + '" data-slot="' + sl.id + '"' + (p ? ' data-part="' + p.id + '"' : '') + '>' +
        '<span class="sn">' + esc(sl.name) + '</span><span class="pn ' + (p ? '' : 'empty') + '">' + (coreOff && !p ? 'Unavailable on this torso' : p ? esc(p.name) : sl.req ? 'Required' : 'Empty') + '</span>' +
        '<span class="w">' + (p ? fmt1(p.wt || 0) + 't' : '') + '</span></div>';
    }
    h += '</div>';
    // picker
    const sl = SLOT_BY_ID[this.slot];
    const cur = this.partIn(this.slot);
    const curP = cur ? PARTS[cur] : null;
    const items = this.compatible(this.slot);
    h += '<div class="picker"><div class="ph2"><span>' + esc(sl.name) + ' options</span><span class="faint">Hover to compare</span></div>';
    if (sl.core != null && sl.core >= T.core) h += '<div class="pitem locked"><span class="nm">' + esc(T.name) + ' only has ' + T.core + ' core slots</span></div>';
    if (!sl.req && cur) h += '<div class="pitem" data-inst=""><span class="nm">Remove part</span><span class="rt">Empty slot</span></div>';
    for (const p of items) {
      const own = ownsPart(p.id);
      const avail = own || partUnlockedForShop(p);
      h += '<div class="pitem ' + (p.id === cur ? 'cur ' : '') + (avail ? '' : 'locked') + '" data-inst="' + p.id + '" data-part="' + p.id + '"' + (curP ? ' data-cmp="' + curP.id + '"' : '') + '>' +
        '<span class="nm">' + esc(p.name) + '</span><span class="rt">' + (own ? fmt1(p.wt || 0) + 't' : avail ? '<span class="amber">' + fmt(p.cost) + ' cr</span>' : 'Tier ' + p.tier) + '</span>' +
        '<span class="sub">' + esc(this.shortLine(p)) + '</span></div>';
    }
    h += '</div>';
    return h;
  },
  shortLine(p) {
    switch (p.slot) {
      case 'weapon': return p.kind === 'shield' ? 'Shield ' + p.shield + ' | Block ' + Math.round(p.block * 100) + '%' : 'DPS ' + fmt1(weaponDps(p)) + ' | Range ' + p.opt + '/' + p.max + 'm | Heat ' + p.ht + (p.ammo ? ' | Ammo ' + p.ammo : '');
      case 'chassis': return 'Cap ' + p.cap + 't | Armor ' + FACINGS.reduce((a, f) => a + p.armor[f], 0) + ' | Structure ' + Math.round(p.hpm * 100) + '%';
      case 'legs': return p.type + ' | Cap +' + p.cap + 't | Speed ' + p.spd + ' | Turn ' + p.turn;
      case 'torso': return 'Core ' + p.core + ' | Health ' + p.hp + ' | Twist ' + p.twist;
      case 'head': return 'Acc ' + Math.round(p.acc * 100) + '% | Sensor ' + p.sensor + 'm | Health ' + p.hp;
      case 'reactor': return 'Power ' + p.out + ' | Health ' + p.hp;
      default: return p.trait || '';
    }
  },
  armorHTML(d, st) {
    let h = '<div class="sect"><h4>Armor Type</h4>';
    for (const p of PART_LIST.filter((x) => x.slot === 'armor')) {
      const own = ownsPart(p.id), avail = own || partUnlockedForShop(p);
      h += '<div class="pitem ' + (d.armor === p.id ? 'cur ' : '') + (avail ? '' : 'locked') + '" data-armor="' + p.id + '" data-part="' + p.id + '" data-cmp="' + d.armor + '" style="margin-bottom:3px"><span class="nm">' + esc(p.name) + '</span><span class="rt">' + (own ? '' : avail ? '<span class="amber">' + fmt(p.cost) + ' cr</span>' : 'Tier ' + p.tier) + '</span><span class="sub">' + esc(p.trait) + '</span></div>';
    }
    h += '</div><div class="sect"><h4>Brush | click a mounting point to place</h4><div class="brushes" style="padding:0">';
    h += '<span class="brush ' + (this.brush === 'clear' ? 'on' : '') + '" data-brush="clear">Clear</span>';
    for (const p of PART_LIST.filter((x) => x.slot === 'plate' || x.slot === 'module')) {
      const own = ownsPart(p.id), avail = own || partUnlockedForShop(p);
      h += '<span class="brush ' + (this.brush === p.id ? 'on ' : '') + (avail ? '' : 'locked') + '" data-brush="' + p.id + '" data-part="' + p.id + '">' + esc(p.name) + (own ? '' : ' 🔒') + '</span>';
    }
    h += '</div><div class="row" style="margin-top:8px"><label class="row" style="gap:6px;cursor:pointer"><input type="checkbox" data-mirror ' + (d.mirror ? 'checked' : '') + '> Mirror left and right</label><span class="grow"></span><button class="btn sm" data-a="clearplates">Strip all</button></div></div>';
    h += '<div class="mountgrid">';
    for (const m of MOUNTS) {
      const na = (m.comp === 'armL' && !d.parts.armL) || (m.comp === 'armR' && !d.parts.armR);
      const it = d.plates[m.id] ? PARTS[d.plates[m.id]] : null;
      h += '<div class="mount ' + (na ? 'na ' : '') + '" data-mount="' + m.id + '"' + (it ? ' data-part="' + it.id + '"' : '') + ' style="' + (this.mount === m.id ? 'border-color:var(--amber)' : '') + '"><div class="mn">' + esc(m.name) + ' | ' + FACING_NAMES[m.facing] + '</div><div class="mi ' + (it ? '' : 'empty') + '">' + (it ? esc(it.name) : na ? 'No arm' : 'Empty') + '</div></div>';
    }
    h += '</div><div class="sect faint" style="font-size:11px">Plates add armor to the facing they cover and fall off as that facing is shot away. Modules add small bonuses. Click the glowing points on the mech or the list above.</div>';
    return h;
  },
  paintHTML(d) {
    const p = d.paint;
    let h = '<div class="sect"><h4>Colors</h4><div class="row" style="gap:14px">' +
      ['p', 's', 'a'].map((k) => '<label style="display:flex;flex-direction:column;gap:3px;font-size:11px;color:var(--dim)">' + { p: 'Primary', s: 'Secondary', a: 'Accent' }[k] + '<input type="color" data-color="' + k + '" value="' + p[k] + '"></label>').join('') + '</div></div>';
    h += '<div class="sect"><h4>Palettes</h4><div class="swatches">' + PALETTES.map((pl, i) => '<div class="swatch" data-pal="' + i + '" data-tip="' + esc(pl.name) + '"><span style="background:' + pl.p + '"></span><span style="background:' + pl.s + '"></span><span style="background:' + pl.a + '"></span></div>').join('') + '</div></div>';
    h += '<div class="sect"><h4>Pattern</h4><div class="patterns">' + PATTERNS.map((pt) => '<button class="btn sm ' + (p.pattern === pt.id ? 'on' : '') + '" data-pat="' + pt.id + '">' + pt.name + '</button>').join('') + '</div></div>';
    h += '<div class="sect"><h4>Markings</h4><div class="row"><label class="dim" style="font-size:11px;width:90px">Number</label><input type="text" data-num maxlength="3" value="' + esc(p.num || '') + '" style="width:70px"></div>' +
      '<div class="row" style="margin-top:6px"><label class="dim" style="font-size:11px;width:90px">Name plate</label><input type="text" data-plate maxlength="10" value="' + esc(p.plate || '') + '" class="grow"></div></div>';
    h += '<div class="sect"><button class="btn sm" data-a="randpaint">Randomize paint</button></div>';
    return h;
  },
  centerHTML(d, st) {
    return '<div class="hname"><div class="n">' + esc(d.name) + '</div><div class="c">' + esc(st.wclass.name) + ' | ' + fmt1(st.weight) + 't | ' + esc(st.L.type) + '</div></div>' +
      '<div class="hactions"><button class="btn cy" data-a="test">Test in Practice</button><button class="btn pri" data-a="deploy">Deploy to Arena</button></div>' +
      '<div class="hhint">Drag to rotate | Wheel to zoom | Right drag to pan</div>';
  },
  rightHTML(d, st, locked) {
    const lim = maxTons();
    let h = '<h3>Live Stats</h3><div class="scroll grow stats" data-k="stats">';
    const wf = st.weight / st.cap;
    h += '<div><div class="stat-h">Weight<b>' + fmt1(st.weight) + ' / ' + fmt1(st.cap) + 't</b></div>' + bar(wf, wf > 1 ? 'red' : wf > 0.92 ? 'amber' : '', Math.min(1, lim / st.cap)) +
      '<div class="stat-h" style="margin-top:3px"><span>' + esc(st.wclass.name) + ' class</span><span class="' + (st.weight > lim ? 'red' : 'faint') + '">Arena limit ' + lim + 't</span></div></div>';
    const pf = st.supply ? st.draw / st.supply : 1;
    h += '<div><div class="stat-h">Power<b>' + fmt1(st.draw) + ' / ' + fmt1(st.supply) + '</b></div>' + bar(pf, pf > 1 ? 'red' : pf > 0.9 ? 'amber' : 'green') + '</div>';
    const hf = st.dissip ? st.heatPS / (st.dissip * 2) : 0;
    h += '<div><div class="stat-h">Heat at full fire<b>' + fmt1(st.heatPS) + '/s vs ' + fmt1(st.dissip) + '/s</b></div>' + bar(hf, st.net > 0 ? (st.tOver < 12 ? 'red' : 'amber') : 'green', 0.5) +
      '<div class="kv" style="margin-top:4px"><span>Heat capacity</span><span>' + fmt(st.heatCap) + '</span><span>Overheat at full fire</span><span>' + (isFinite(st.tOver) ? fmt1(st.tOver) + 's' : 'Never') + '</span></div></div>';
    h += '<div><div class="stat-h">Mobility</div><div class="kv"><span>Speed</span><span>' + fmt1(st.speed) + ' m/s</span><span>Turn rate</span><span>' + fmt(st.turn) + ' deg/s</span><span>Legs</span><span>' + esc(st.L.type) + '</span><span>Torso twist</span><span>' + st.T.twist + ' deg</span></div></div>';
    const a = st.armor;
    const ac = (v) => (v < 40 ? 'red' : v < 90 ? 'amber' : '');
    h += '<div><div class="stat-h">Armor by facing<b>' + fmt(st.apts) + ' total</b></div><div class="armor-diag">' +
      '<div style="grid-column:2" class="' + ac(a.f) + '"><small>FRONT</small>' + fmt(a.f) + '</div>' +
      '<div style="grid-column:1;grid-row:2" class="' + ac(a.l) + '"><small>LEFT</small>' + fmt(a.l) + '</div>' +
      '<div class="core ' + ac(a.t) + '"><small>TOP</small>' + fmt(a.t) + '</div>' +
      '<div style="grid-column:3;grid-row:2" class="' + ac(a.r) + '"><small>RIGHT</small>' + fmt(a.r) + '</div>' +
      '<div style="grid-column:2;grid-row:3" class="' + ac(a.b) + '"><small>BACK</small>' + fmt(a.b) + '</div></div>' +
      '<div class="kv" style="margin-top:4px"><span>Armor type</span><span>' + esc(st.A.name) + '</span><span>Structure total</span><span>' + fmt(st.structure) + '</span><span>Torso core</span><span>' + fmt(st.comps.torso) + '</span></div></div>';
    h += '<div><div class="stat-h">Firepower<b>' + fmt1(st.dps) + ' DPS</b></div><div class="kv"><span>Sustained DPS</span><span>' + fmt1(st.sustained) + '</span><span>Alpha strike</span><span>' + fmt(st.alpha) + '</span><span>Preferred range</span><span>' + fmt(st.prefRange) + 'm</span><span>Accuracy bonus</span><span>' + (st.acc >= 0 ? '+' : '') + Math.round(st.acc * 100) + '%</span></div>';
    if (st.weapons.length) h += '<div class="wlist" style="margin-top:6px">' + st.weapons.map((w) => '<div data-part="' + w.part.id + '"><b style="font-weight:600">' + esc(w.part.name) + '</b><span>' + (w.part.kind === 'shield' ? 'Shield' : fmt1(w.dps) + ' dps') + '</span><span>' + (w.ammo ? w.ammo + ' rds' : w.part.kind === 'shield' ? '' : 'No ammo') + '</span></div>').join('') + '</div>';
    h += '</div>';
    h += '<div><div class="stat-h">Cost<b class="amber">' + fmt(st.cost) + ' cr</b></div></div>';
    const msgs = [];
    for (const e of st.errors) msgs.push('<div class="e">' + esc(e) + '</div>');
    if (locked.length) msgs.push('<div class="e">Unlicensed parts | ' + esc(locked.map((x) => PARTS[x].name).join(' | ')) + '</div>');
    if (st.weight > lim && !isSandbox()) msgs.push('<div class="w">Too heavy for your current tier limit of ' + lim + 't</div>');
    for (const w of st.warnings) msgs.push('<div class="w">' + esc(w) + '</div>');
    if (!msgs.length) msgs.push('<div class="ok">Ready for deployment</div>');
    h += '<div><div class="stat-h">Diagnostics</div><div class="msgs">' + msgs.join('') + '</div></div>';
    h += '</div>';
    return h;
  },

  // --------------------------------------------------------------- events
  bind(root) {
    const d = this.d();
    root.onclick = async (e) => {
      const t = e.target;
      const tab = t.closest('[data-tab]');
      if (tab) { this.tab = tab.dataset.tab; this.render(); return; }
      const slot = t.closest('[data-slot]');
      if (slot) { this.slot = slot.dataset.slot; this.render(); return; }
      const inst = t.closest('[data-inst]');
      if (inst) {
        if (inst.classList.contains('locked')) { const p = PARTS[inst.dataset.inst]; if (p) UI.toast(esc(p.name) + ' unlocks at Tier ' + p.tier + ' | Salvage can recover it sooner', 'red'); return; }
        this.install(this.slot, inst.dataset.inst || null); return;
      }
      const ar = t.closest('[data-armor]');
      if (ar) {
        if (ar.classList.contains('locked')) return;
        const id = ar.dataset.armor;
        if (!ownsPart(id)) { this.offerBuy(id, () => { this.d().armor = id; this.changed(); }); return; }
        d.armor = id; AUDIO.play('equip'); this.changed(); return;
      }
      const br = t.closest('[data-brush]');
      if (br) { if (br.classList.contains('locked')) { AUDIO.play('error'); return; } this.brush = br.dataset.brush; this.render(); return; }
      const mt = t.closest('[data-mount]');
      if (mt) { if (mt.classList.contains('na')) return; this.setMount(mt.dataset.mount, this.brush === 'clear' ? null : this.brush); return; }
      const pal = t.closest('[data-pal]');
      if (pal) { const pl = PALETTES[+pal.dataset.pal]; Object.assign(d.paint, { p: pl.p, s: pl.s, a: pl.a }); this.changed(); return; }
      const pat = t.closest('[data-pat]');
      if (pat) { d.paint.pattern = pat.dataset.pat; this.changed(); return; }
      const a = t.closest('[data-a]');
      if (!a) return;
      switch (a.dataset.a) {
        case 'new': {
          const nd = mkDesign('New Design', 'c_wsp l_str t_box h_opt r_emb', { armL: 'w_lac', core: ['s_hs'] });
          designList().push(nd); setActiveDesign(nd.id); this.changed(); UI.toast('New design created', 'green'); break;
        }
        case 'dup': {
          const nd = clone(d); nd.id = uid(); nd.name = (d.name + ' II').slice(0, 24);
          designList().push(nd); setActiveDesign(nd.id); this.changed(); UI.toast('Design duplicated', 'green'); break;
        }
        case 'ren': {
          const v = await UI.prompt('Rename Design', d.name, { max: 24 });
          if (v && v.trim()) { d.name = v.trim().slice(0, 24); this.changed(false); }
          break;
        }
        case 'del': {
          const list = designList();
          if (list.length <= 1) { UI.toast('You need at least one design', 'red'); break; }
          if (!(await UI.confirm('Delete Design', 'Scrap <b>' + esc(d.name) + '</b>? This cannot be undone.', 'Delete', 'danger'))) break;
          list.splice(list.indexOf(d), 1); setActiveDesign(list[0].id); this.changed(); break;
        }
        case 'exp': UI.prompt('Export Design Code', designCode(d), { area: true, readonly: true, rows: 6, text: 'Share this code. Anyone can import it into their hangar.' }); break;
        case 'imp': {
          const v = await UI.prompt('Import Design Code', '', { area: true, rows: 6, ok: 'Import', text: 'Paste a code that starts with MF1:' });
          if (!v) break;
          try {
            const nd = parseDesignCode(v);
            designList().push(nd); setActiveDesign(nd.id); this.changed();
            const lk = lockedPartsIn(nd);
            UI.toast('Imported ' + esc(nd.name) + (lk.length ? ' | ' + lk.length + ' parts need licenses' : ''), lk.length ? 'amber' : 'green');
          } catch (err) { UI.toast('Import failed | ' + esc(err.message), 'red'); AUDIO.play('error'); }
          break;
        }
        case 'clearplates': d.plates = {}; this.changed(); break;
        case 'randpaint': {
          const pl = pick(PALETTES), pt = pick(PATTERNS);
          Object.assign(d.paint, { p: pl.p, s: pl.s, a: pl.a, pattern: pt.id }); this.changed(); break;
        }
        case 'test': UI.show('arena', { tab: 'practice' }); break;
        case 'deploy': UI.show('arena', { tab: 'campaign' }); break;
      }
    };
    const sel = $('select[data-k=design]', root);
    if (sel) sel.onchange = () => { setActiveDesign(sel.value); this.changed(); };
    const mir = $('[data-mirror]', root);
    if (mir) mir.onchange = () => { d.mirror = mir.checked; save(); };
    for (const c of $$('[data-color]', root)) {
      c.oninput = () => { d.paint[c.dataset.color] = c.value; save(); this._paintSoon(); };
      c.onchange = () => { d.paint[c.dataset.color] = c.value; this.changed(); };
    }
    const num = $('[data-num]', root);
    if (num) num.onchange = () => { d.paint.num = num.value.toUpperCase().slice(0, 3); this.changed(); };
    const pl = $('[data-plate]', root);
    if (pl) pl.onchange = () => { d.paint.plate = pl.value.toUpperCase().slice(0, 10); this.changed(); };
  },
  _paintSoon() {
    if (this._pt) return;
    this._pt = setTimeout(() => { this._pt = 0; VIEW.setDesign(this.d()); }, 120);
  },
};
UI.reg('hangar', Hangar);
