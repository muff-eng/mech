// =====================================================================
// 15 | UI | ARENA SELECT, PRE BATTLE, BATTLE HUD, REPORT, REWARDS
// =====================================================================
const Arena = {
  tab: 'campaign', sel: null, practice: { opp: 'dummy', map: 'pad' }, exhibit: { map: 'field', a: [], b: ['rattlecan'], order: 'aggressive' }, order: 'aggressive',
  enter(arg) {
    if (isSandbox() && (this.tab === 'campaign' || this.tab === 'challenges')) this.tab = 'exhibition';
    if (arg && arg.tab) this.tab = isSandbox() && (arg.tab === 'campaign') ? 'exhibition' : arg.tab;
    if (this.tab === 'campaign' && !this.sel) this.sel = this.nextMatch();
    this.render();
  },
  nextMatch() {
    for (const t of CAMPAIGN) { if (t.tier > S.tier) break; for (const m of t.matches) if (!S.beaten[m.id]) return m.id; }
    return 't1m1';
  },
  matchOpen(m) { return m.tier <= S.tier; },
  tabs() { return isSandbox() ? ['practice', 'exhibition'] : ['campaign', 'challenges', 'practice', 'exhibition']; },
  render() {
    const root = $('#scr-arena');
    const keep = {};
    for (const el of $$('.scroll', root)) if (el.dataset.k) keep[el.dataset.k] = el.scrollTop;
    let left = '<h3>Arena Select<span class="sp"></span><span class="faint" style="letter-spacing:1px;text-transform:none">Forge Circuit | Tessaline</span></h3>';
    left += '<div class="tabs">' + this.tabs().map((t) => '<button data-tab="' + t + '" class="' + (this.tab === t ? 'on' : '') + '">' + t + '</button>').join('') + '</div>';
    left += '<div class="scroll grow" data-k="al' + this.tab + '">';
    if (this.tab === 'campaign') left += this.campaignHTML();
    else if (this.tab === 'challenges') left += this.challengesHTML();
    else if (this.tab === 'practice') left += this.practiceListHTML();
    else left += this.exhibitListHTML();
    left += '</div>';
    root.innerHTML = '<div class="arena"><div class="panel rivets pe">' + left + '</div><div class="panel rivets pe" style="display:flex;flex-direction:column;min-height:0">' + this.briefHTML() + '</div></div>';
    for (const el of $$('.scroll', root)) if (el.dataset.k && keep[el.dataset.k] != null) el.scrollTop = keep[el.dataset.k];
    this.bind(root);
  },
  campaignHTML() {
    let h = '<div class="tiers">';
    for (const t of CAMPAIGN) {
      const open = t.tier <= S.tier;
      const done = t.matches.filter((m) => S.beaten[m.id]).length;
      h += '<div class="tier ' + (open ? '' : 'locked') + '"><div class="tier-h"><div class="num" style="background:' + t.color + '">' + t.tier + '</div><div class="grow"><div class="tn">' + esc(t.name) + '</div><div class="faint mono" style="font-size:11px">Limit ' + t.maxT + 't | Squad of ' + t.squad + ' | ' + done + ' of ' + t.matches.length + ' won</div></div>' + (open ? '' : '<span class="tag red">Locked</span>') + '</div>';
      h += '<div class="tier-b">' + esc(t.blurb) + ' <span class="cyan">Clearing the boss unlocks | ' + esc(t.unlockText) + '</span></div><div class="matches">';
      for (const m of t.matches) {
        const rv = RIVALS[m.rival];
        h += '<div class="match ' + (this.sel === m.id ? 'on ' : '') + (open ? '' : 'locked ') + (S.beaten[m.id] ? 'done ' : '') + (m.boss ? 'boss' : '') + '" data-match="' + m.id + '">' + emblemHTML(rv) +
          '<div class="mi2"><div class="call">' + esc(rv.call) + (m.boss ? ' <span class="tag red">Boss</span>' : '') + '</div><div class="meta">' + esc(MAPS[m.map].short) + ' | ' + m.enemies.length + ' mech' + (m.enemies.length > 1 ? 's' : '') + '</div><div class="meta amber">' + fmt(m.credits) + ' cr | ' + m.rep + ' rep</div></div></div>';
      }
      h += '</div></div>';
    }
    if (S.champion) h += '<div class="tier" style="border-color:var(--amber)"><div class="tier-h"><div class="tn amber">Champion of the Forge Circuit</div></div><div class="tier-b">The Crown is yours. Replay any match, chase challenges, or build wild things in Sandbox.</div></div>';
    return h + '</div>';
  },
  challengesHTML() {
    let h = '<div class="chal">';
    for (const c of CHALLENGES) {
      const open = c.tier <= S.tier;
      h += '<div class="match ' + (this.sel === c.id ? 'on ' : '') + (open ? '' : 'locked ') + (S.challenges[c.id] ? 'done' : '') + '" data-chal="' + c.id + '"><div class="call">' + esc(c.name) + '</div><div class="meta">' + esc(c.desc) + '</div><div class="meta cyan">' + esc(ruleText(c.rule) || 'No restriction') + '</div>' +
        '<div class="meta amber">' + fmt(c.credits) + ' cr | ' + c.rep + ' rep | License: ' + esc(PARTS[c.part].name) + '</div>' + (open ? '' : '<div class="meta red">Requires Tier ' + c.tier + '</div>') + '</div>';
    }
    return h + '</div>';
  },
  practiceListHTML() {
    const opps = [['dummy', 'Target Dummy', 'A stationary armored target. Read your DPS, accuracy and heat over 30 seconds.'], ['spar_l', 'Sparring Bot | Light', 'A basic light frame that fights back.'], ['spar_m', 'Sparring Bot | Medium', 'A medium brawler. Unlocks at Tier 2.'], ['spar_h', 'Sparring Bot | Heavy', 'A heavy gunner. Unlocks at Tier 3.']];
    let h = '<div class="chal">';
    opps.forEach(([id, n, d], i) => {
      const open = isSandbox() || i <= Math.max(1, S.tier);
      h += '<div class="match ' + (this.practice.opp === id ? 'on ' : '') + (open ? '' : 'locked') + '" data-opp="' + id + '"><div class="call">' + n + '</div><div class="meta">' + d + '</div><div class="meta cyan">No rewards | No risk</div></div>';
    });
    return h + '</div>';
  },
  exhibitListHTML() {
    const pool = this.exhibitPool();
    let h = '<div class="sect"><h4>Map</h4><div class="row wrap">' + MAP_ORDER.concat('pad').map((m) => '<button class="btn sm ' + (this.exhibit.map === m ? 'on' : '') + '" data-xmap="' + m + '">' + esc(MAPS[m].short) + '</button>').join('') + '</div><div class="faint" style="font-size:12px;margin-top:6px">' + esc(MAPS[this.exhibit.map].desc) + '</div></div>';
    h += '<div class="sect"><h4>Opposing team | click to add (up to 5)</h4><div class="row wrap">' + this.exhibit.b.map((k, i) => '<button class="btn sm danger" data-xrem="' + i + '">' + esc(this.designFor(k).name) + ' ✕</button>').join('') + (this.exhibit.b.length ? '' : '<span class="faint">Empty</span>') + '</div></div>';
    h += '<div class="cards">';
    for (const k of pool) {
      const d = this.designFor(k), st = computeStats(d);
      h += '<div class="card" data-xadd="' + k + '"><div class="cn">' + esc(d.name) + '</div><div class="cs">' + esc(st.wclass.name) + ' | ' + fmt1(st.weight) + 't | ' + esc(st.L.type) + '</div><div class="cl">' + st.weapons.map((w) => esc(w.part.name)).join('<br>') + '</div></div>';
    }
    return h + '</div>';
  },
  exhibitPool() {
    const out = [];
    const seen = new Set();
    for (const t of CAMPAIGN) {
      if (!isSandbox() && t.tier > S.tier) continue;
      for (const m of t.matches) for (const e of m.enemies) if (!seen.has(e)) { seen.add(e); out.push(e); }
    }
    for (const k of ['spar_l', 'spar_m', 'spar_h']) out.push(k);
    for (const d of designList()) out.push('my:' + d.id);
    return out;
  },
  designFor(k) {
    if (k.startsWith('my:')) return findDesign(k.slice(3)) || activeDesign();
    return ENEMY_DESIGNS[k];
  },

  // ----------------------------------------------------------------- brief
  context() {
    if (this.tab === 'campaign') {
      const m = MATCH_BY_ID[this.sel] || MATCH_BY_ID[this.nextMatch()];
      return { type: 'campaign', id: m.id, map: m.map, squad: m.squad, maxT: m.maxT, enemies: m.enemies, rival: m.rival, rule: null, open: this.matchOpen(m), m };
    }
    if (this.tab === 'challenges') {
      const c = CHALLENGES.find((x) => x.id === this.sel) || CHALLENGES[0];
      return { type: 'challenge', id: c.id, map: c.map, squad: c.squad, maxT: c.maxT, enemies: c.enemies, rival: null, rule: c.rule, open: c.tier <= S.tier, c };
    }
    if (this.tab === 'practice') return { type: 'practice', id: 'practice', map: this.practice.map, squad: 1, maxT: 100, enemies: [this.practice.opp], open: true };
    return { type: 'exhibition', id: 'exhibition', map: this.exhibit.map, squad: 4, maxT: 100, enemies: this.exhibit.b.slice(), open: true };
  },
  squadFor(ctx) {
    const key = ctx.type + ':' + ctx.id;
    const n = Math.min(ctx.squad, isSandbox() ? 4 : squadSlots());
    let sq = S.squadPick[key];
    if (!sq) {
      sq = [];
      for (let i = 0; i < n; i++) sq.push({ d: i === 0 ? activeDesign().id : '', p: S.pilots[i] ? S.pilots[i].id : '' });
      S.squadPick[key] = sq;
    }
    while (sq.length < n) sq.push({ d: '', p: '' });
    sq.length = n;
    if (sq[0] && !sq[0].d) sq[0].d = activeDesign().id;
    return sq;
  },
  validate(ctx, sq) {
    const issues = [];
    const used = new Set();
    const members = [];
    sq.forEach((s, i) => {
      if (!s.d) return;
      const d = findDesign(s.d);
      if (!d) return;
      const pilot = S.pilots.find((p) => p.id === s.p) || (isSandbox() || ctx.type === 'exhibition' || ctx.type === 'practice' ? null : undefined);
      const st = computeStats(d, pilot || null);
      const iss = [];
      if (!st.valid) iss.push(...st.errors);
      if (st.weight > ctx.maxT + 1e-6) iss.push('Over the ' + ctx.maxT + 't limit');
      if (ctx.type !== 'practice' && ctx.type !== 'exhibition') { const lk = lockedPartsIn(d); if (lk.length) iss.push('Unlicensed parts'); }
      if (ctx.rule) iss.push(...checkRule(ctx.rule, d, st));
      if (pilot === undefined && ctx.type !== 'practice') iss.push('Needs a pilot');
      if (pilot && used.has(pilot.id)) iss.push('Pilot already assigned');
      if (pilot) used.add(pilot.id);
      members.push({ i, d, pilot: pilot || null, st, iss });
      issues.push(...iss.map((x) => 'Slot ' + (i + 1) + ' | ' + x));
    });
    if (!members.length) issues.push('Pick at least one design');
    if (ctx.type === 'exhibition' && !ctx.enemies.length) issues.push('Add at least one opponent');
    if (!ctx.open) issues.push('Locked');
    return { issues, members };
  },
  briefHTML() {
    const ctx = this.context();
    const sq = this.squadFor(ctx);
    const v = this.validate(ctx, sq);
    let h = '<h3>Briefing</h3><div class="scroll grow" data-k="brief"><div class="brief">';
    if (ctx.type === 'campaign') {
      const rv = RIVALS[ctx.rival], m = ctx.m;
      h += '<div class="row" style="gap:12px">' + emblemHTML(rv, true) + '<div><h2>' + esc(rv.call) + '</h2><div class="cyan" style="font-size:12px">' + esc(rv.name) + ' | ' + esc(FACTIONS[rv.faction].name) + '</div><div class="faint" style="font-size:11px">Pilot level ' + (rv.level || 1) + ' | ' + esc(PILOT_TRAITS[rv.trait] ? PILOT_TRAITS[rv.trait].name : 'Rookie') + ' | Style: ' + esc(rv.style) + '</div></div></div>';
      h += '<div class="bio">' + esc(rv.bio) + '</div>';
      h += '<div class="kv"><span>Reward</span><span class="amber">' + fmt(S.beaten[m.id] ? Math.round(m.credits * 0.4) : m.credits) + ' cr | ' + (S.beaten[m.id] ? Math.round(m.rep * 0.25) : m.rep) + ' rep</span><span>Weight limit</span><span>' + m.maxT + 't</span><span>Squad size</span><span>' + Math.min(m.squad, squadSlots()) + (squadSlots() < m.squad ? ' (hire pilots for ' + m.squad + ')' : '') + '</span></div>';
    } else if (ctx.type === 'challenge') {
      const c = ctx.c;
      h += '<h2>' + esc(c.name) + '</h2><div class="bio">' + esc(c.desc) + '</div><div class="kv"><span>Restriction</span><span class="cyan">' + esc(ruleText(c.rule) || 'None') + '</span><span>Reward</span><span class="amber">' + fmt(c.credits) + ' cr | ' + c.rep + ' rep</span><span>License</span><span>' + esc(PARTS[c.part].name) + '</span><span>Status</span><span>' + (S.challenges[c.id] ? '<span class="green">Completed</span>' : 'Open') + '</span></div>';
    } else if (ctx.type === 'practice') {
      h += '<h2>Practice Range</h2><div class="bio">Test a design with no risk. You get a full damage report afterward.</div>';
      h += '<div><div class="stat-h">Map</div><div class="row wrap">' + ['pad'].concat(MAP_ORDER).map((m) => '<button class="btn sm ' + (this.practice.map === m ? 'on' : '') + '" data-pmap="' + m + '">' + esc(MAPS[m].short) + '</button>').join('') + '</div></div>';
    } else {
      h += '<h2>Exhibition</h2><div class="bio">Custom battles with any map and any opponents. No rewards, just science.</div>';
    }
    h += '<div><div class="stat-h">Arena<b>' + esc(MAPS[ctx.map].name) + '</b></div><div class="bio">' + esc(MAPS[ctx.map].desc) + '</div></div>';
    if (ctx.type !== 'exhibition') {
      h += '<div><div class="stat-h">Opposition</div><div class="enemy-list">' + ctx.enemies.map((k) => { const d = ENEMY_DESIGNS[k], st = computeStats(d); return '<div><b>' + esc(d.name) + '</b><span>' + esc(st.wclass.name) + ' | ' + fmt1(st.weight) + 't | ' + esc(st.L.type) + '</span></div>'; }).join('') + '</div></div>';
    }
    // squad
    const designs = designList();
    h += '<div><div class="stat-h">Your ' + (sq.length > 1 ? 'Squad' : 'Mech') + '</div>';
    sq.forEach((s, i) => {
      h += '<div class="squad-row" style="margin-bottom:4px"><span class="ix">' + (i + 1) + '</span><select data-sqd="' + i + '"><option value="">' + (i === 0 ? 'Pick a design' : 'Empty slot') + '</option>' + designs.map((d) => '<option value="' + d.id + '"' + (s.d === d.id ? ' selected' : '') + '>' + esc(d.name) + '</option>').join('') + '</select>' +
        '<select data-sqp="' + i + '"><option value="">' + (ctx.type === 'practice' || ctx.type === 'exhibition' || isSandbox() ? 'Test pilot' : 'No pilot') + '</option>' + S.pilots.map((p) => '<option value="' + p.id + '"' + (s.p === p.id ? ' selected' : '') + '>' + esc(p.call) + ' | Lv ' + p.level + '</option>').join('') + '</select></div>';
      const m = v.members.find((x) => x.i === i);
      if (m) h += '<div class="squad-chk ' + (m.iss.length ? 'red' : 'green') + '">' + (m.iss.length ? esc(m.iss.join(' | ')) : esc(m.st.wclass.name) + ' | ' + fmt1(m.st.weight) + 't | ' + fmt1(m.st.dps) + ' DPS | Ready') + '</div>';
    });
    h += '</div>';
    if (sq.length > 1 || (ctx.type === 'exhibition')) {
      h += '<div><div class="stat-h">Squad Orders</div><div class="seg">' + ['aggressive', 'defensive', 'focus'].map((o) => '<button class="btn sm ' + (this.order === o ? 'on' : '') + '" data-order="' + o + '">' + { aggressive: 'Aggressive', defensive: 'Defensive', focus: 'Focus Fire' }[o] + '</button>').join('') + '</div></div>';
    }
    if (v.issues.length) h += '<div class="msgs">' + v.issues.slice(0, 6).map((x) => '<div class="e">' + esc(x) + '</div>').join('') + '</div>';
    h += '</div></div><div class="mfoot" style="padding:10px 14px;border-top:1px solid var(--line);display:flex;gap:8px"><button class="btn" data-go="hangar">Back to Hangar</button><span class="grow"></span><button class="btn pri big" data-launch ' + (v.issues.length ? 'disabled' : '') + '>Launch</button></div>';
    return h;
  },
  bind(root) {
    root.onclick = (e) => {
      const t = e.target;
      const tab = t.closest('[data-tab]');
      if (tab) { this.tab = tab.dataset.tab; this.sel = this.tab === 'campaign' ? this.nextMatch() : this.tab === 'challenges' ? (CHALLENGES.find((c) => c.tier <= S.tier && !S.challenges[c.id]) || CHALLENGES[0]).id : null; this.render(); return; }
      const m = t.closest('[data-match]');
      if (m) { if (m.classList.contains('locked')) { AUDIO.play('error'); return; } this.sel = m.dataset.match; AUDIO.play('click'); this.render(); return; }
      const c = t.closest('[data-chal]');
      if (c) { if (c.classList.contains('locked')) { AUDIO.play('error'); return; } this.sel = c.dataset.chal; AUDIO.play('click'); this.render(); return; }
      const o = t.closest('[data-opp]');
      if (o) { if (o.classList.contains('locked')) { AUDIO.play('error'); return; } this.practice.opp = o.dataset.opp; AUDIO.play('click'); this.render(); return; }
      const pm = t.closest('[data-pmap]');
      if (pm) { this.practice.map = pm.dataset.pmap; this.render(); return; }
      const xm = t.closest('[data-xmap]');
      if (xm) { this.exhibit.map = xm.dataset.xmap; this.render(); return; }
      const xa = t.closest('[data-xadd]');
      if (xa) { if (this.exhibit.b.length < 5) { this.exhibit.b.push(xa.dataset.xadd); AUDIO.play('equip'); } else AUDIO.play('error'); this.render(); return; }
      const xr = t.closest('[data-xrem]');
      if (xr) { this.exhibit.b.splice(+xr.dataset.xrem, 1); this.render(); return; }
      const ord = t.closest('[data-order]');
      if (ord) { this.order = ord.dataset.order; this.render(); return; }
      const go = t.closest('[data-go]');
      if (go) { UI.show(go.dataset.go); return; }
      if (t.closest('[data-launch]') && !t.closest('[data-launch]').disabled) this.launch();
    };
    for (const s of $$('[data-sqd]', root)) s.onchange = () => { const ctx = this.context(); const sq = this.squadFor(ctx); sq[+s.dataset.sqd].d = s.value; save(); this.render(); };
    for (const s of $$('[data-sqp]', root)) s.onchange = () => { const ctx = this.context(); const sq = this.squadFor(ctx); sq[+s.dataset.sqp].p = s.value; save(); this.render(); };
  },
  launch() {
    const ctx = this.context();
    const sq = this.squadFor(ctx);
    const v = this.validate(ctx, sq);
    if (v.issues.length) { AUDIO.play('error'); return; }
    ctx.order = this.order;
    ctx.squadDesc = v.members.map((m) => ({ d: clone(m.d), pilot: m.pilot }));
    startBattle(ctx);
  },
};
UI.reg('arena', Arena);

// ---------------------------------------------------------------------
// BATTLE FLOW
// ---------------------------------------------------------------------
let CURRENT = null; // { ctx, battle, view, phase }

function startBattle(ctx) {
  AUDIO.init(); AUDIO.resume();
  const A = ctx.squadDesc.map((m) => ({ design: m.d, pilot: m.pilot, skill: m.pilot ? 0.55 + m.pilot.level * 0.03 : 0.6, name: m.d.name, call: m.pilot ? m.pilot.call : 'Test', player: true }));
  let B;
  const rv = ctx.rival ? RIVALS[ctx.rival] : null;
  if (ctx.type === 'practice' && ctx.enemies[0] === 'dummy') B = [{ design: ENEMY_DESIGNS.dummy, dummy: true, skill: 0, name: 'Target Dummy', call: '' }];
  else B = ctx.enemies.map((k, i) => {
    const d = Arena.designFor(k);
    const r = rv || null;
    return { design: clone(d), skill: r ? r.skill : ctx.type === 'practice' ? 0.4 : 0.6, pilot: r && r.trait ? { trait: r.trait, level: r.level || 1, call: r.call } : null, name: d.name, call: r ? (i === 0 ? r.call : 'Wing ' + i) : '' };
  });
  const battle = new Battle({ map: ctx.map, teams: [A, B], orders: [ctx.order || 'aggressive', 'aggressive'], practice: ctx.type === 'practice', timeLimit: ctx.type === 'practice' && ctx.enemies[0] === 'dummy' ? 30 : 240 });
  if (VIEW.battleView) { VIEW.battleView.dispose(); VIEW.battleView = null; }
  const view = new BattleView(battle);
  VIEW.battleView = view;
  CURRENT = { ctx, battle, view, phase: 'fight', endT: 0, lastCount: null };
  UI.show('battle');
}

const BattleHud = {
  enter() {
    UI.battleHud = this;
    const root = $('#scr-battle');
    root.innerHTML = '<div id="dmgnums"></div><div class="hud-top"><div class="teambar"><div class="lbl cyan">YOUR TEAM</div><div class="bar"><i id="tbA" style="width:100%"></i></div></div><div class="hud-time" id="htime">0:00</div><div class="teambar b"><div class="lbl red">OPPOSITION</div><div class="bar"><i id="tbB" style="width:100%"></i></div></div></div>' +
      '<div class="ucards a" id="ucA"></div><div class="ucards b" id="ucB"></div><div class="hud-log" id="hlog"></div><div id="hcount" class="countdown hidden"></div><div id="hbanner" class="banner hidden"></div>' +
      '<div class="hud-bot" id="hbot"></div>';
    this.lastLog = 0;
    this.buildCards();
    this.renderBot();
    this.t = 0;
  },
  leave() { UI.battleHud = null; },
  buildCards() {
    const b = CURRENT.battle;
    for (const team of [0, 1]) {
      const host = $(team === 0 ? '#ucA' : '#ucB');
      host.innerHTML = b.units.filter((u) => u.team === team).map((u) => '<div class="ucard" data-u="' + u.uid + '"><div class="un"><span>' + esc(u.name) + '</span><i>' + esc(u.call || '') + '</i></div><div class="doll" data-doll></div><div class="bars"><span>CORE</span><div class="bar"><i data-hp></i></div><span>ARMOR</span><div class="afc" data-af><b></b><b></b><b></b><b></b><b></b></div><span>HEAT</span><div class="bar"><i class="amber" data-ht></i></div></div><div class="st2" data-st></div></div>').join('');
      host.onclick = (e) => {
        const c = e.target.closest('[data-u]');
        if (!c) return;
        const u = b.units.find((x) => x.uid === +c.dataset.u);
        if (!u) return;
        CURRENT.view.follow = u;
        if (CURRENT.view.camMode !== 'follow') CURRENT.view.setCam('follow');
        if (u.team === 1 && b.orders[0] === 'focus') { b.focus[0] = u; UI.toast('Squad focusing ' + esc(u.name), 'amber', 1500); }
        AUDIO.play('click');
      };
    }
  },
  renderBot() {
    const v = CURRENT.view, b = CURRENT.battle;
    const squad = b.units.filter((u) => u.team === 0).length > 1;
    let h = '<button class="btn sm" data-sp="pause" data-tip="Space">' + (v.paused ? '▶ Resume' : '❚❚ Pause') + '</button>' + [1, 2, 4].map((s) => '<button class="btn sm ' + (!v.paused && v.speed === s ? 'on' : '') + '" data-sp="' + s + '">' + s + 'x</button>').join('');
    h += '<div class="hud-sep"></div>' + [['orbit', 'Orbit'], ['follow', 'Follow'], ['cinematic', 'Cinematic']].map(([k, n]) => '<button class="btn sm ' + (v.camMode === k ? 'on' : '') + '" data-cam="' + k + '" data-tip="Camera | C cycles">' + n + '</button>').join('');
    if (squad) h += '<div class="hud-sep"></div>' + [['aggressive', 'Aggressive'], ['defensive', 'Defensive'], ['focus', 'Focus Fire']].map(([k, n]) => '<button class="btn sm ' + (b.orders[0] === k ? 'on' : '') + '" data-ord="' + k + '">' + n + '</button>').join('');
    h += '<div class="hud-sep"></div><button class="btn sm danger" data-quit>' + (b.over ? 'Leave' : CURRENT.ctx.type === 'practice' ? 'End Test' : 'Forfeit') + '</button>';
    const bot = $('#hbot');
    bot.innerHTML = h;
    bot.onclick = async (e) => {
      const t = e.target;
      const sp = t.closest('[data-sp]');
      if (sp) { if (sp.dataset.sp === 'pause') v.paused = !v.paused; else { v.speed = +sp.dataset.sp; v.paused = false; } this.renderBot(); return; }
      const cm = t.closest('[data-cam]');
      if (cm) { v.setCam(cm.dataset.cam); return; }
      const od = t.closest('[data-ord]');
      if (od) { b.orders[0] = od.dataset.ord; if (od.dataset.ord === 'focus') { const tgt = v.follow && v.follow.team === 1 && v.follow.alive ? v.follow : b.enemiesOf(0).sort((x, y) => x.hpFrac - y.hpFrac)[0]; b.focus[0] = tgt || null; if (tgt) UI.toast('Focus fire on ' + esc(tgt.name) + ' | Click an enemy card to change', 'amber', 2200); } this.renderBot(); return; }
      if (t.closest('[data-quit]')) {
        if (b.over) { endBattleFlow(true); return; }
        const was = v.paused; v.paused = true;
        const prac = CURRENT.ctx.type === 'practice';
        const ok = await UI.confirm(prac ? 'End Test' : 'Forfeit Match', prac ? 'End the test and see the report?' : 'Forfeit counts as a loss. Leave the arena?', prac ? 'End Test' : 'Forfeit', prac ? 'pri' : 'danger');
        v.paused = was;
        if (ok) { b.forfeit(); CURRENT.phase = 'ending'; CURRENT.endT = 0.2; }
      }
    };
  },
  syncButtons() { if (CURRENT) this.renderBot(); },
  onSelect() {},
  onKey(e) {
    if (!CURRENT) return;
    const v = CURRENT.view;
    if (e.code === 'Space') { v.paused = !v.paused; this.renderBot(); e.preventDefault(); }
    else if (e.key === '1') { v.speed = 1; v.paused = false; this.renderBot(); }
    else if (e.key === '2') { v.speed = 2; v.paused = false; this.renderBot(); }
    else if (e.key === '3' || e.key === '4') { v.speed = 4; v.paused = false; this.renderBot(); }
    else if (e.key === 'c' || e.key === 'C') { const m = ['orbit', 'follow', 'cinematic']; v.setCam(m[(m.indexOf(v.camMode) + 1) % 3]); }
    else if (e.key === 'Tab') {
      e.preventDefault();
      const us = CURRENT.battle.units.filter((u) => u.alive);
      const i = us.indexOf(v.follow);
      v.follow = us[(i + 1) % us.length];
      if (v.camMode === 'orbit') v.setCam('follow');
    }
  },
  update(dt) {
    if (!CURRENT) return;
    const b = CURRENT.battle, v = CURRENT.view;
    this.t += dt;
    // countdown
    const cd = $('#hcount');
    if (b.t < 0) {
      const n = Math.ceil(-b.t);
      if (CURRENT.lastCount !== n) { CURRENT.lastCount = n; cd.textContent = n; cd.classList.remove('hidden'); AUDIO.play('countdown'); }
    } else if (CURRENT.lastCount !== 0 && CURRENT.lastCount !== -1) {
      CURRENT.lastCount = 0; cd.textContent = 'ENGAGE'; AUDIO.play('go'); CURRENT.engageT = 0.9;
    } else if (CURRENT.engageT > 0) { CURRENT.engageT -= dt; if (CURRENT.engageT <= 0) { cd.classList.add('hidden'); CURRENT.lastCount = -1; } }
    if (this.t < 0.1) return;
    this.t = 0;
    const tt = Math.max(0, b.t);
    $('#htime').textContent = Math.floor(tt / 60) + ':' + String(Math.floor(tt % 60)).padStart(2, '0');
    const sum = (team) => { const us = b.units.filter((u) => u.team === team); return us.reduce((a, u) => a + (u.alive ? u.hpFrac : 0), 0) / Math.max(1, us.length); };
    $('#tbA').style.width = (sum(0) * 100).toFixed(1) + '%';
    $('#tbB').style.width = (sum(1) * 100).toFixed(1) + '%';
    for (const u of b.units) {
      const c = document.querySelector('.ucard[data-u="' + u.uid + '"]');
      if (!c) continue;
      c.classList.toggle('dead', !u.alive);
      c.classList.toggle('sel', v.follow === u);
      c.classList.toggle('focus', b.orders[0] === 'focus' && b.focus[0] === u);
      const hp = c.querySelector('[data-hp]');
      const sf = u.alive ? u.structFrac : 0;
      hp.style.width = (sf * 100).toFixed(0) + '%'; hp.className = sf < 0.3 ? 'red' : sf < 0.6 ? 'amber' : 'green';
      const af = c.querySelectorAll('[data-af] b');
      FACINGS.forEach((f, i) => { const r = u.armorMax[f] ? u.armor[f] / u.armorMax[f] : 0; af[i].style.opacity = 0.15 + r * 0.85; af[i].style.background = r <= 0 ? 'var(--red)' : r < 0.4 ? 'var(--amber)' : 'var(--cyan)'; af[i].title = FACING_NAMES[f]; });
      const ht = c.querySelector('[data-ht]');
      ht.style.width = clamp(u.heatFrac * 100, 0, 100).toFixed(0) + '%'; ht.className = u.heatFrac > 0.85 ? 'red' : 'amber';
      const tags = [];
      if (!u.alive) tags.push('<span class="tag red">Destroyed</span>');
      else {
        if (u.shutdown) tags.push('<span class="tag red">Shutdown</span>');
        if (u.meltdown > 0) tags.push('<span class="tag red">Meltdown</span>');
        if (u.nLegs < 2) tags.push('<span class="tag amber">Leg lost</span>');
        if (u.jumping) tags.push('<span class="tag cyan">Airborne</span>');
        if (u.ai.state === 'retreat') tags.push('<span class="tag amber">Retreating</span>');
        else if (u.ai.state === 'cool') tags.push('<span class="tag amber">Cooling</span>');
        if (u.barrier > 0) tags.push('<span class="tag cyan">Barrier</span>');
        if (u.pwEff < 1) tags.push('<span class="tag amber">Low power</span>');
      }
      c.querySelector('[data-st]').innerHTML = tags.join('');
      // damage doll: head / armL torso armR / legL legR
      const col = (k) => { const cc = u.comps[k]; if (!cc) return 'transparent'; if (!cc.alive) return '#3a1512'; const f = cc.hp / cc.max; return f > 0.6 ? 'var(--green)' : f > 0.3 ? 'var(--amber)' : 'var(--red)'; };
      c.querySelector('[data-doll]').innerHTML = '<i style="grid-column:3;background:' + col('head') + '"></i><i style="grid-column:1;grid-row:2;background:' + col('armR') + '"></i><i style="grid-column:2/5;grid-row:2;background:' + col('torso') + '"></i><i style="grid-column:5;grid-row:2;background:' + col('armL') + '"></i><i style="grid-column:2;grid-row:3;background:' + col('legR') + '"></i><i style="grid-column:4;grid-row:3;background:' + col('legL') + '"></i>';
    }
    // log
    if (S.settings.log) {
      const logs = b.logs.slice(-6);
      $('#hlog').innerHTML = logs.map((l) => '<div class="' + l.cls + '">' + Math.floor(Math.max(0, l.t) / 60) + ':' + String(Math.floor(Math.max(0, l.t) % 60)).padStart(2, '0') + ' | ' + esc(l.text) + '</div>').join('');
    } else $('#hlog').innerHTML = '';
  },
  banner(win, sub) {
    const el = $('#hbanner');
    el.innerHTML = '<div class="big ' + (win ? 'win' : 'lose') + '">' + (win ? 'VICTORY' : 'DEFEAT') + '</div><div class="sub">' + esc(sub) + '</div><div class="strip"></div>';
    el.classList.remove('hidden');
  },
};
UI.reg('battle', BattleHud);

// called every frame from the main loop
function battleFlowTick(dt) {
  if (!CURRENT || UI.cur !== 'battle') return;
  const b = CURRENT.battle, v = CURRENT.view;
  BattleHud.update(dt);
  if (CURRENT.phase === 'fight' && b.over) { CURRENT.phase = 'ending'; CURRENT.endT = 2.4; BattleHud.renderBot(); }
  if (CURRENT.phase === 'ending') {
    if (v.slowT > 0) return;
    CURRENT.endT -= dt;
    if (CURRENT.endT <= 0) {
      CURRENT.phase = 'banner'; CURRENT.endT = 2.6;
      const win = b.result.winner === 0 && !b.result.forfeit;
      const prac = CURRENT.ctx.type === 'practice';
      BattleHud.banner(prac || win, prac ? 'Test complete' : b.result.forfeit ? 'Forfeit' : b.result.timeout ? 'Decision on points' : win ? 'Arena secured' : 'Your mech is scrap');
      AUDIO.play(prac || win ? 'victory' : 'defeat');
      CURRENT.rewards = applyRewards(CURRENT.ctx, b);
    }
  } else if (CURRENT.phase === 'banner') {
    CURRENT.endT -= dt;
    if (CURRENT.endT <= 0) { CURRENT.phase = 'report'; showReport(); }
  }
}

function endBattleFlow(toArena = true, dest) {
  if (!CURRENT) return;
  if (CURRENT.phase !== 'report' && CURRENT.phase !== 'banner' && !CURRENT.rewards) CURRENT.rewards = applyRewards(CURRENT.ctx, CURRENT.battle);
  const v = VIEW.battleView;
  if (v) v.dispose();
  VIEW.battleView = null;
  CURRENT = null;
  UI.show(dest || (toArena ? 'arena' : 'hangar'));
}

// ---------------------------------------------------------------------
// REWARDS
// ---------------------------------------------------------------------
function makeCrate(enemyKeys, from) {
  const pool = new Map();
  for (const k of enemyKeys) {
    const d = ENEMY_DESIGNS[k];
    if (!d) continue;
    const ids = [d.parts.chassis, d.parts.legs, d.parts.torso, d.parts.head, d.parts.reactor, d.parts.armL, d.parts.armR, d.parts.shL, d.parts.shR, d.parts.back, ...d.parts.core, d.armor, ...Object.values(d.plates || {})];
    for (const id of ids) if (id && PARTS[id] && PARTS[id].cost > 0) pool.set(id, (pool.get(id) || 0) + (S.owned[id] ? 1 : 4));
  }
  const entries = [...pool.entries()];
  const parts = [];
  while (parts.length < 3 && entries.length) {
    const id = weightedPick(entries);
    parts.push(id);
    entries.splice(entries.findIndex((e) => e[0] === id), 1);
  }
  return parts.length ? { id: uid(), from, parts, t: Date.now() } : null;
}

function applyRewards(ctx, b) {
  if (CURRENT && CURRENT.rewards) return CURRENT.rewards;
  const res = b.result || { winner: 1 };
  const win = res.winner === 0 && !res.forfeit;
  const r = { win, credits: 0, rep: 0, lines: [], crate: null, unlock: null, xp: [], firstWin: false };
  const sandbox = isSandbox();
  if (!sandbox && ctx.type === 'campaign') {
    const m = MATCH_BY_ID[ctx.id];
    const first = !S.beaten[m.id];
    if (win) {
      r.firstWin = first;
      r.credits = Math.round(m.credits * (first ? 1 : 0.4));
      r.rep = first ? m.rep : Math.round(m.rep * 0.25);
      S.beaten[m.id] = true;
      r.crate = makeCrate(m.enemies, RIVALS[m.rival].call);
      if (r.crate) S.salvage.push(r.crate);
      if (m.boss && first) {
        if (m.tier < 4) { S.tier = Math.max(S.tier, m.tier + 1); r.unlock = 'Tier ' + (m.tier + 1) + ' unlocked | ' + CAMPAIGN[m.tier].name + ' | ' + CAMPAIGN[m.tier - 1].unlockText; S.hire = [newPilot(false), newPilot(false), newPilot(false)]; }
        else { S.champion = true; r.unlock = 'You are the Champion of the Forge Circuit'; }
      }
    } else r.credits = Math.round(m.credits * 0.15);
  } else if (!sandbox && ctx.type === 'challenge') {
    const c = CHALLENGES.find((x) => x.id === ctx.id);
    const first = !S.challenges[c.id];
    if (win) {
      r.firstWin = first;
      r.credits = Math.round(c.credits * (first ? 1 : 0.25));
      r.rep = first ? c.rep : 0;
      S.challenges[c.id] = true;
      if (first) { if (!S.owned[c.part]) { S.owned[c.part] = true; r.unlock = 'License earned | ' + PARTS[c.part].name; } else r.credits += Math.round(PARTS[c.part].cost * 0.5); }
    }
  }
  if (!sandbox && (ctx.type === 'campaign' || ctx.type === 'challenge')) {
    addCredits(r.credits); addRep(r.rep);
    S.stats.battles++; if (win) S.stats.wins++; else S.stats.losses++;
    for (const u of b.units) {
      if (u.team !== 0) continue;
      S.stats.kills += u.s.kills;
      const p = u.pilot && S.pilots.find((x) => x.id === u.pilot.id);
      if (!p) continue;
      const gain = (win ? 60 : 25) + u.s.kills * 25 + Math.round(u.s.dealt / 60);
      p.xp += gain; p.battles++; p.kills += u.s.kills; if (win) p.wins++;
      let lv = 0;
      while (p.level < 10 && p.xp >= pilotXpNeeded(p.level)) { p.xp -= pilotXpNeeded(p.level); p.level++; lv++; }
      r.xp.push({ name: p.call, gain, level: p.level, up: lv });
    }
    save(true);
  }
  return r;
}

// ---------------------------------------------------------------------
// REPORT
// ---------------------------------------------------------------------
function mvpFor(u) {
  const c = [];
  for (const w of u.weapons) if (w.s.dmg > 0) c.push([w.p.name, w.s.dmg, fmt(w.s.dmg) + ' damage dealt']);
  for (const k in u.shields) if (u.shields[k].absorbed > 0) c.push([PARTS[u.design.parts[k]].name, u.shields[k].absorbed * 0.9, fmt(u.shields[k].absorbed) + ' damage blocked']);
  if (u.s.barrierAbs > 0) c.push(['Aegis Field', u.s.barrierAbs * 0.9, fmt(u.s.barrierAbs) + ' damage absorbed']);
  if (u.s.repaired > 0) c.push(['Repair drones', u.s.repaired, fmt(u.s.repaired) + ' structure repaired']);
  let bf = 'f';
  for (const f of FACINGS) if (u.s.armorAbsorbed[f] > u.s.armorAbsorbed[bf]) bf = f;
  if (u.s.armorAbsorbed[bf] > 0) c.push([FACING_NAMES[bf] + ' armor', u.s.armorAbsorbed[bf] * 0.75, fmt(u.s.armorAbsorbed[bf]) + ' damage soaked']);
  c.sort((a, b) => b[1] - a[1]);
  return c[0] || null;
}
function tipsFor(u, b) {
  const tips = [];
  const st = u.st;
  // weakest facing
  let wf = null, wt = 0;
  for (const f of FACINGS) if (u.s.armorBrokeAt[f] != null) { const tk = u.s.dmgTaken[f]; if (tk > wt) { wt = tk; wf = f; } }
  if (wf) tips.push('Your ' + FACING_NAMES[wf].toLowerCase() + ' armor was your weak point | it broke at ' + fmt1(u.s.armorBrokeAt[wf]) + 's. Add plates to the ' + FACING_NAMES[wf].toLowerCase() + ' mounts.');
  if (u.s.shutdowns) tips.push('You overheated ' + u.s.shutdowns + (u.s.shutdowns > 1 ? ' times' : ' time') + ' | add heatsinks or swap a hot weapon.');
  else if (b.t > 10 && u.s.hotTime > b.t * 0.3) tips.push('You ran above 85% heat for ' + Math.round((u.s.hotTime / b.t) * 100) + '% of the fight | that costs speed and accuracy.');
  for (const w of u.weapons) {
    if (w.s.dryAt >= 0) tips.push(w.p.name + ' ran dry at ' + fmt1(w.s.dryAt) + 's | an Ammo Bin or pouch would keep it firing.');
    if (w.p.kind === 'shield') continue;
    if (w.s.shots === 0 && !w.off && b.t > 15) tips.push(w.p.name + ' never fired | the fight stayed outside its ' + w.p.max + 'm reach or arc.');
    else if (w.s.shots >= 8 && w.s.hits / w.s.shots < 0.35) {
      const avg = w.s.rangeSum / w.s.shots;
      tips.push(w.p.name + ' hit only ' + Math.round((w.s.hits / w.s.shots) * 100) + '%' + (avg > w.p.opt * 1.1 ? ' | it fired at ' + Math.round(avg) + 'm, beyond its ' + w.p.opt + 'm optimal range.' : ' | fast targets dodge slow projectiles.'));
    }
  }
  if (u.s.lowPower > 3) tips.push('Power shortage slowed your weapons for ' + Math.round(u.s.lowPower) + 's | a bigger reactor or fewer power hungry parts.');
  for (const pl of u.s.partsLost) {
    if (pl.k === 'legL' || pl.k === 'legR') { tips.push('Losing the ' + pl.name.toLowerCase() + ' crippled your speed | leg plates help.'); break; }
  }
  const arm = u.s.partsLost.find((pl) => pl.k === 'armL' || pl.k === 'armR');
  if (arm && arm.part) tips.push('Your ' + arm.part + ' was shot off with the ' + arm.name.toLowerCase() + ' | arm guards add side armor.');
  if (u.s.cookoffs) tips.push('Ammo cooked off inside your torso | armored bins are safer.');
  const enemies = b.units.filter((x) => x.team !== u.team);
  const eArm = enemies.map((e) => e.st.A.id);
  if (eArm.includes('a_rea') && u.weapons.some((w) => w.p.dt === 'exp')) tips.push('Reactive armor on the enemy blunted your explosives | kinetic or energy weapons cut through it.');
  if (eArm.includes('a_abl') && u.weapons.some((w) => w.p.dt === 'ene')) tips.push('Ablative armor on the enemy soaked your energy weapons | try ballistics.');
  if (!tips.length) tips.push(b.result && b.result.winner === u.team ? 'Clean performance | try a tougher challenge.' : 'No single weak point | raw firepower or armor made the difference.');
  return tips.slice(0, 5);
}
function sparkline(canvas, data) {
  const g = canvas.getContext('2d');
  const w = (canvas.width = canvas.clientWidth * 2 || 400), h = (canvas.height = 92);
  g.fillStyle = '#0d1013'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,77,61,.5)'; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(0, h * 0.15); g.lineTo(w, h * 0.15); g.stroke(); g.setLineDash([]);
  if (data.length < 2) return;
  g.beginPath();
  data.forEach((v, i) => { const x = (i / (data.length - 1)) * w, y = h - (Math.min(115, v) / 115) * h; i ? g.lineTo(x, y) : g.moveTo(x, y); });
  g.strokeStyle = '#ffb000'; g.lineWidth = 3; g.stroke();
  g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fillStyle = 'rgba(255,176,0,.12)'; g.fill();
}
function showReport() {
  const c = CURRENT, b = c.battle, r = c.rewards || applyRewards(c.ctx, b);
  const prac = c.ctx.type === 'practice';
  const win = r.win;
  let h = '<div class="rep-h"><div class="res ' + (prac ? 'cyan' : win ? 'amber' : 'red') + '">' + (prac ? 'TEST REPORT' : win ? 'VICTORY' : 'DEFEAT') + '</div><div class="dim">' + esc(MAPS[b.mapId].name) + ' | ' + fmt1(b.result.time) + 's' + (b.result.timeout ? ' | Time limit' : '') + '</div></div>';
  if (!prac && !isSandbox() && (c.ctx.type === 'campaign' || c.ctx.type === 'challenge')) {
    h += '<div class="rewards"><div class="reward"><div class="v">+' + fmt(r.credits) + '</div><div class="l">Credits</div></div><div class="reward"><div class="v cyan">+' + fmt(r.rep) + '</div><div class="l">Reputation</div></div>' +
      (r.crate ? '<div class="reward"><div class="v green">1 crate</div><div class="l">Salvage | ' + r.crate.parts.length + ' parts to pick from</div></div>' : '') +
      r.xp.map((x) => '<div class="reward"><div class="v" style="color:#fff">+' + x.gain + ' xp</div><div class="l">' + esc(x.name) + ' | Lv ' + x.level + (x.up ? ' | Level up!' : '') + '</div></div>').join('') + '</div>';
    if (r.unlock) h += '<div class="mvp" style="margin-top:8px"><b>Unlocked</b> | ' + esc(r.unlock) + '</div>';
  } else if (c.ctx.type === 'exhibition' || isSandbox()) h += '<div class="faint">Exhibition | No rewards</div>';
  const mine = b.units.filter((u) => u.team === 0);
  mine.forEach((u, idx) => {
    const mvp = mvpFor(u);
    h += '<div class="rep-unit"><h4><span>' + esc(u.name) + ' <span class="dim" style="font-weight:400">' + esc(u.call || '') + '</span></span><span class="tag ' + (u.alive ? 'green' : 'red') + '">' + (u.alive ? 'Survived ' + Math.round(u.hpFrac * 100) + '%' : 'Destroyed') + '</span></h4><div class="rep-grid"><div>';
    h += '<table class="wt"><tr><th>Weapon</th><th>Shots</th><th>Acc</th><th>Damage</th><th>Avg range</th></tr>' + u.weapons.filter((w) => w.p.kind !== 'shield').map((w) => '<tr><td>' + esc(w.p.name) + (w.off ? ' <span class="red">(lost)</span>' : '') + '</td><td>' + w.s.shots + '</td><td>' + (w.s.shots ? Math.round((w.s.hits / w.s.shots) * 100) + '%' : '0%') + '</td><td>' + fmt(w.s.dmg) + '</td><td>' + (w.s.shots ? Math.round(w.s.rangeSum / w.s.shots) + 'm' : '0') + '</td></tr>').join('') + '</table>';
    const dur = Math.max(1, b.result.time);
    h += '<div class="kv" style="margin-top:8px"><span>Total damage dealt</span><span class="amber">' + fmt(u.s.dealt) + ' | ' + fmt1(u.s.dealt / dur) + ' DPS</span><span>Kills</span><span>' + u.s.kills + '</span><span>Shutdowns</span><span>' + u.s.shutdowns + '</span><span>Parts lost</span><span>' + (u.s.partsLost.length ? esc(u.s.partsLost.map((p) => p.part || p.name).join(' | ')) : 'None') + '</span></div>';
    if (mvp) h += '<div class="mvp" style="margin-top:8px"><b>MVP Part</b> | ' + esc(mvp[0]) + ' | ' + esc(mvp[2]) + '</div>';
    h += '<div class="stat-h" style="margin-top:10px">Tips</div><ul class="tips">' + tipsFor(u, b).map((t) => '<li>' + esc(t) + '</li>').join('') + '</ul></div><div>';
    const maxT = Math.max(1, ...FACINGS.map((f) => u.s.dmgTaken[f]));
    h += '<div class="stat-h">Damage taken by facing</div><div class="facing-bars">' + FACINGS.map((f) => '<div><span>' + FACING_NAMES[f] + '</span>' + bar(u.s.dmgTaken[f] / maxT, u.s.armorBrokeAt[f] != null ? 'red' : 'amber') + '<em>' + fmt(u.s.dmgTaken[f]) + '</em></div>').join('') + '</div><div class="faint" style="font-size:10px;margin-top:3px">Red bars mark facings where the armor was breached</div>';
    h += '<div class="stat-h" style="margin-top:10px">Heat over time<b>' + (u.s.heatLog.length ? Math.max(...u.s.heatLog) + '% peak' : '') + '</b></div><canvas class="spark" data-heat="' + idx + '"></canvas>';
    h += '</div></div></div>';
  });
  const foes = b.units.filter((u) => u.team === 1);
  h += '<div class="rep-unit"><h4><span>Opposition</span></h4><div style="padding:8px 10px"><table class="wt"><tr><th>Mech</th><th>Damage dealt</th><th>Kills</th><th>Status</th></tr>' + foes.map((u) => '<tr><td>' + esc(u.name) + ' <span class="dim">' + esc(u.call || '') + '</span></td><td>' + fmt(u.s.dealt) + '</td><td>' + u.s.kills + '</td><td>' + (u.alive ? Math.round(u.hpFrac * 100) + '%' : '<span class="red">Destroyed</span>') + '</td></tr>').join('') + '</table></div></div>';
  const btns = [{ label: 'Rebuild in Hangar', action: () => endBattleFlow(false, 'hangar') }];
  if (r.crate) btns.push({ label: 'Open Salvage', cls: 'cy', action: () => endBattleFlow(false, 'salvage') });
  btns.push({ label: 'Rematch', action: () => { const ctx = c.ctx; endBattleFlow(true); startBattle(ctx); } });
  btns.push({ label: 'Continue', cls: 'pri', action: () => endBattleFlow(true) });
  UI.modal({ title: 'Battle Report', body: h, buttons: btns, wide: true, esc: false });
  setTimeout(() => mine.forEach((u, i) => { const cv = document.querySelector('canvas[data-heat="' + i + '"]'); if (cv) sparkline(cv, u.s.heatLog); }), 30);
}
