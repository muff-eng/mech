// =====================================================================
// 16 | UI | TITLE, PARTS SHOP, SALVAGE, PILOT ROSTER, SETTINGS
// =====================================================================
const Title = {
  enter() { this.render(); },
  render() {
    const saved = S.stats.battles > 0 || Object.keys(S.beaten).length > 0;
    $('#scr-title').innerHTML = '<div class="tbox pe"><div class="title-logo">MECH<b>FORGE</b></div><div class="title-tag">' + esc(LORE.tagline) + '</div>' +
      '<div class="title-lore">' + esc(LORE.intro) + '</div><div class="title-btns">' +
      '<button class="btn pri big" data-t="career">' + (isSandbox() ? 'Career Mode' : saved ? 'Continue Career' : 'Start Career') + '</button>' +
      '<button class="btn big" data-t="sandbox">' + (isSandbox() ? 'Continue Sandbox' : 'Sandbox | All parts unlocked') + '</button>' +
      '<button class="btn" data-t="settings">Settings</button></div></div>' +
      '<div class="title-foot">Tier ' + Math.min(4, S.tier) + ' | ' + S.stats.wins + ' wins | ' + esc(rankFor(S.rep).name) + ' | Progress saves automatically</div>';
    $('#scr-title').onclick = (e) => {
      const b = e.target.closest('[data-t]');
      if (!b) return;
      AUDIO.init(); AUDIO.resume();
      const t = b.dataset.t;
      if (t === 'career') { setMode('career'); UI.show('hangar'); if (!S.seenIntro) { S.seenIntro = true; save(); introModal(); } }
      else if (t === 'sandbox') { setMode('sandbox'); UI.show('hangar'); }
      else UI.show('settings');
    };
  },
};
UI.reg('title', Title);

function setMode(m) {
  if (S.mode === m) return;
  S.mode = m; save();
  VIEW.setDesign(activeDesign(), true);
  UI.toast(m === 'sandbox' ? 'Sandbox mode | Every part unlocked, no rewards' : 'Career mode', 'cyan');
}
function introModal() {
  UI.modal({
    title: 'Welcome to the Forge',
    body: '<p>' + esc(LORE.intro) + '</p><ol class="tips"><li><b>Build</b> | Pick parts in the Hangar. Watch weight, power and heat.</li><li><b>Test</b> | Run the design in Practice against a dummy and read the report.</li><li><b>Deploy</b> | Fight the Scrapyard Circuit in the Arena. Battles play out automatically.</li><li><b>Earn</b> | Credits, reputation and salvage from every win.</li><li><b>Upgrade</b> | Buy licenses in the Parts Shop and unlock bigger weight classes by beating each tier boss.</li></ol>',
    buttons: [{ label: 'Open the Hangar', cls: 'pri' }],
  });
}

// ---------------------------------------------------------------------
const Shop = {
  cat: 'weapon', filter: 'all',
  enter() { this.render(); },
  buy(pid) {
    const p = PARTS[pid];
    if (!p || S.owned[pid]) return false;
    if (!partUnlockedForShop(p)) { UI.toast('Unlocks at Tier ' + p.tier, 'red'); AUDIO.play('error'); return false; }
    if (S.credits < p.cost) { UI.toast('Not enough credits', 'red'); AUDIO.play('error'); return false; }
    S.credits -= p.cost; S.owned[pid] = true; save(true);
    AUDIO.play('buy'); UI.toast('License acquired | ' + esc(p.name), 'green');
    UI.renderTop();
    return true;
  },
  installedFor(p) {
    const d = activeDesign();
    switch (p.slot) {
      case 'weapon': { for (const s of ['armR', 'armL', 'shR', 'shL', 'back']) { const x = PARTS[d.parts[s]]; if (x && x.slot === 'weapon' && x.mounts.split('').some((m) => p.mounts.includes(m))) return x; } return null; }
      case 'core': return PARTS[d.parts.core.find((c) => c)] || null;
      case 'armor': return PARTS[d.armor];
      case 'plate': case 'module': return null;
      default: return PARTS[d.parts[p.slot]] || null;
    }
  },
  render() {
    const cat = PART_CATS.find((c) => c.id === this.cat);
    let h = '<div class="page"><div class="panel rivets pe"><h3>Parts Shop<span class="sp"></span><span class="faint" style="text-transform:none;letter-spacing:0">Licenses are permanent and work on every design</span></h3>';
    h += '<div class="tabs">' + PART_CATS.map((c) => '<button data-cat="' + c.id + '" class="' + (c.id === this.cat ? 'on' : '') + '">' + c.name + '</button>').join('') + '</div>';
    h += '<div class="row" style="padding:8px 10px;border-bottom:1px solid var(--line)">' + ['all', 'available', 'owned', 'locked'].map((f) => '<button class="btn sm ' + (this.filter === f ? 'on' : '') + '" data-f="' + f + '">' + f + '</button>').join('') + (isSandbox() ? '<span class="tag cyan" style="margin-left:auto">Sandbox | Everything unlocked</span>' : '') + '</div>';
    h += '<div class="scroll grow" data-k="shop"><div class="cards">';
    const parts = PART_LIST.filter((p) => cat.slots.includes(p.slot)).sort((a, b) => a.tier - b.tier || a.cost - b.cost);
    let n = 0;
    for (const p of parts) {
      const own = ownsPart(p.id), open = partUnlockedForShop(p);
      const state = own ? 'owned' : open ? 'available' : 'locked';
      if (this.filter !== 'all' && this.filter !== state) continue;
      n++;
      const cur = this.installedFor(p);
      const sub = [SLOT_LABEL[p.slot]];
      if (p.slot === 'weapon') sub.push(KIND_NAMES[p.kind], p.mounts.split('').map((m) => MOUNT_NAMES[m]).join(' or '));
      if (p.slot === 'legs') sub.push(p.type);
      sub.push(FACTIONS[p.maker].short);
      h += '<div class="card ' + state + '" data-part="' + p.id + '"' + (cur ? ' data-cmp="' + cur.id + '"' : '') + '><div class="cn">' + esc(p.name) + '</div><div class="cs">' + esc(sub.join(' | ')) + '</div><div class="ct">' + esc(p.trait || '') + '</div><div class="cl">' + esc(Hangar.shortLine(p)) + '<br>Weight ' + fmt1(p.wt || (p.ap ? p.ap / ARMOR_PER_TON : 0)) + 't' + (p.pw > 0 ? ' | Power ' + p.pw : '') + '</div>' +
        '<div class="cf"><span class="price">' + (own ? '<span class="green">Owned</span>' : fmt(p.cost) + ' cr') + '</span>' + (own ? '' : open ? '<button class="btn sm pri" data-buy="' + p.id + '" ' + (S.credits < p.cost ? 'disabled' : '') + '>Buy</button>' : '<span class="tag red">Tier ' + p.tier + '</span>') + '</div></div>';
    }
    if (!n) h += '<div class="empty-note">Nothing here</div>';
    h += '</div></div></div></div>';
    const root = $('#scr-shop');
    const st = $('.scroll', root) ? $('.scroll', root).scrollTop : 0;
    root.innerHTML = h;
    if ($('.scroll', root)) $('.scroll', root).scrollTop = st;
    root.onclick = (e) => {
      const c = e.target.closest('[data-cat]');
      if (c) { this.cat = c.dataset.cat; this.render(); return; }
      const f = e.target.closest('[data-f]');
      if (f) { this.filter = f.dataset.f; this.render(); return; }
      const b = e.target.closest('[data-buy]');
      if (b && !b.disabled) { if (this.buy(b.dataset.buy)) this.render(); }
    };
  },
};
UI.reg('shop', Shop);

// ---------------------------------------------------------------------
const Salvage = {
  enter() { this.render(); },
  claim(crate, pid) {
    const p = PARTS[pid];
    S.salvage = S.salvage.filter((c) => c.id !== crate.id);
    let msg;
    if (S.owned[pid]) { const v = Math.round(p.cost * 0.35); addCredits(v); msg = 'Already licensed | sold ' + p.name + ' for ' + fmt(v) + ' cr'; }
    else { S.owned[pid] = true; msg = 'Recovered ' + p.name + ' | license added'; }
    S.salvageLog.unshift({ t: Date.now(), text: msg, from: crate.from });
    S.salvageLog = S.salvageLog.slice(0, 30);
    save(true); AUDIO.play('buy'); UI.toast(esc(msg), 'green'); UI.renderTop(); this.render();
  },
  scrap(crate) {
    const v = Math.round(crate.parts.reduce((a, id) => a + PARTS[id].cost, 0) * 0.15);
    S.salvage = S.salvage.filter((c) => c.id !== crate.id);
    addCredits(v);
    S.salvageLog.unshift({ t: Date.now(), text: 'Scrapped a crate from ' + crate.from + ' for ' + fmt(v) + ' cr', from: crate.from });
    save(true); AUDIO.play('buy'); UI.renderTop(); this.render();
  },
  render() {
    let h = '<div class="page"><div class="panel rivets pe"><h3>Salvage Yard<span class="sp"></span><span class="faint" style="text-transform:none;letter-spacing:0">Every win drags a wreck back to the yard. Recover one part per crate, even ones above your tier.</span></h3><div class="scroll grow" data-k="salv">';
    if (isSandbox()) h += '<div class="empty-note">Sandbox mode has every part already. Salvage belongs to your career.</div>';
    else if (!S.salvage.length) h += '<div class="empty-note">No crates waiting. Win campaign matches to earn salvage.</div>';
    else for (const c of S.salvage) {
      h += '<div class="crate"><div class="crate-h"><div><b>Wreck of ' + esc(c.from) + '</b> <span class="dim">| pick one part</span></div><button class="btn sm danger" data-scrap="' + c.id + '">Scrap for credits</button></div><div class="cards">';
      for (const pid of c.parts) {
        const p = PARTS[pid], own = !!S.owned[pid];
        h += '<div class="card ' + (own ? 'owned' : '') + '" data-part="' + pid + '"><div class="cn">' + esc(p.name) + '</div><div class="cs">' + esc(SLOT_LABEL[p.slot]) + ' | Tier ' + p.tier + '</div><div class="ct">' + esc(p.trait || '') + '</div><div class="cl">' + esc(Hangar.shortLine(p)) + '</div><div class="cf"><span class="price">' + (own ? 'Owned | sells ' + fmt(Math.round(p.cost * 0.35)) : 'Worth ' + fmt(p.cost)) + '</span><button class="btn sm ' + (own ? '' : 'cy') + '" data-claim="' + c.id + '|' + pid + '">' + (own ? 'Sell' : 'Recover') + '</button></div></div>';
      }
      h += '</div></div>';
    }
    if (S.salvageLog.length && !isSandbox()) h += '<div class="sect"><h4>Yard log</h4>' + S.salvageLog.slice(0, 12).map((l) => '<div class="dim" style="font-size:12px;padding:2px 0">' + esc(l.text) + '</div>').join('') + '</div>';
    h += '</div></div></div>';
    const root = $('#scr-salvage');
    root.innerHTML = h;
    root.onclick = (e) => {
      const cl = e.target.closest('[data-claim]');
      if (cl) { const [cid, pid] = cl.dataset.claim.split('|'); const c = S.salvage.find((x) => x.id === cid); if (c) this.claim(c, pid); return; }
      const sc = e.target.closest('[data-scrap]');
      if (sc) { const c = S.salvage.find((x) => x.id === sc.dataset.scrap); if (c) this.scrap(c); }
    };
  },
};
UI.reg('salvage', Salvage);

// ---------------------------------------------------------------------
const Roster = {
  enter() { this.render(); },
  hireCost() { return 1500 + (S.pilots.length - 1) * 2500; },
  portrait(p) { return '<div class="portrait" style="background:linear-gradient(160deg,hsl(' + p.hue + ',55%,60%),hsl(' + p.hue + ',45%,30%))">' + esc(p.call.slice(0, 2).toUpperCase()) + '</div>'; },
  render() {
    const slots = squadSlots();
    let h = '<div class="page"><div class="panel rivets pe"><h3>Pilot Roster<span class="sp"></span><span class="faint" style="text-transform:none;letter-spacing:0">Squad slots ' + S.pilots.length + ' of ' + slots + ' | More slots unlock with each tier</span></h3><div class="scroll grow" data-k="rost">';
    h += '<div class="sect"><h4>Your Pilots</h4></div><div class="cards">';
    for (const p of S.pilots) {
      const tr = PILOT_TRAITS[p.trait];
      const need = pilotXpNeeded(p.level);
      h += '<div class="card"><div class="pilot">' + this.portrait(p) + '<div><div class="cn">' + esc(p.call) + '</div><div class="cs">' + esc(p.name) + ' | Level ' + p.level + '</div><div class="ct">' + esc(tr.name) + ' | ' + esc(tr.desc) + '</div><div class="xpbar" style="margin-top:6px"><i style="width:' + (p.level >= 10 ? 100 : (p.xp / need) * 100) + '%"></i></div><div class="cl">' + (p.level >= 10 ? 'Max level' : p.xp + ' of ' + need + ' xp') + ' | +' + (p.level - 1) + '% accuracy</div><div class="cl">' + p.battles + ' battles | ' + p.wins + ' wins | ' + p.kills + ' kills</div></div></div>' +
        '<div class="cf"><button class="btn sm" data-ren="' + p.id + '">Rename</button>' + (S.pilots.length > 1 ? '<button class="btn sm danger" data-fire="' + p.id + '">Dismiss</button>' : '') + '</div></div>';
    }
    h += '</div>';
    if (!isSandbox()) {
      h += '<div class="sect"><h4>Hiring Board</h4>' + (S.pilots.length >= slots ? '<div class="faint" style="font-size:12px">Squad is full for your tier. Beat the tier boss to open another slot.</div>' : '<div class="faint" style="font-size:12px">Hire cost ' + fmt(this.hireCost()) + ' cr</div>') + '</div><div class="cards">';
      for (const p of S.hire) {
        const tr = PILOT_TRAITS[p.trait];
        h += '<div class="card"><div class="pilot">' + this.portrait(p) + '<div><div class="cn">' + esc(p.call) + '</div><div class="cs">' + esc(p.name) + '</div><div class="ct">' + esc(tr.name) + ' | ' + esc(tr.desc) + '</div></div></div><div class="cf"><span class="price">' + fmt(this.hireCost()) + ' cr</span><button class="btn sm pri" data-hire="' + p.id + '" ' + (S.pilots.length >= slots || S.credits < this.hireCost() ? 'disabled' : '') + '>Hire</button></div></div>';
      }
      h += '</div><div class="sect"><button class="btn sm" data-refresh>Refresh board | 300 cr</button></div>';
    }
    h += '<div class="sect"><h4>Forge Circuit Rivals</h4></div><div class="cards">';
    for (const t of CAMPAIGN) for (const m of t.matches) {
      const rv = RIVALS[m.rival];
      const beat = S.beaten[m.id];
      const seen = t.tier <= S.tier;
      h += '<div class="card ' + (beat ? 'owned' : '') + '"><div class="row" style="align-items:flex-start;gap:10px">' + emblemHTML(rv) + '<div><div class="cn">' + esc(seen ? rv.call : 'Unknown rival') + (m.boss ? ' <span class="tag red">Boss</span>' : '') + '</div><div class="cs">' + esc(seen ? rv.name : 'Tier ' + t.tier) + ' | ' + esc(FACTIONS[rv.faction].short) + '</div></div></div><div class="cl">' + esc(seen ? rv.bio : 'Reach ' + t.name + ' to scout this pilot.') + '</div><div class="cf"><span class="ct">' + esc(seen ? rv.style : '') + '</span>' + (beat ? '<span class="tag green">Defeated</span>' : '<span class="tag">' + esc(t.name) + '</span>') + '</div></div>';
    }
    h += '</div></div></div></div>';
    const root = $('#scr-roster');
    root.innerHTML = h;
    root.onclick = async (e) => {
      const hb = e.target.closest('[data-hire]');
      if (hb && !hb.disabled) {
        const p = S.hire.find((x) => x.id === hb.dataset.hire);
        const cost = this.hireCost();
        if (!p || S.credits < cost || S.pilots.length >= squadSlots()) return;
        S.credits -= cost; S.pilots.push(p); S.hire = S.hire.filter((x) => x !== p); S.hire.push(newPilot(false));
        save(true); AUDIO.play('buy'); UI.toast(esc(p.call) + ' joined your garage', 'green'); UI.renderTop(); this.render(); return;
      }
      const rn = e.target.closest('[data-ren]');
      if (rn) { const p = S.pilots.find((x) => x.id === rn.dataset.ren); const v = await UI.prompt('Pilot Callsign', p.call, { max: 14 }); if (v && v.trim()) { p.call = v.trim().slice(0, 14); save(); this.render(); } return; }
      const fr = e.target.closest('[data-fire]');
      if (fr) { const p = S.pilots.find((x) => x.id === fr.dataset.fire); if (await UI.confirm('Dismiss Pilot', 'Let ' + esc(p.call) + ' go? Their experience leaves with them.', 'Dismiss', 'danger')) { S.pilots = S.pilots.filter((x) => x !== p); save(); this.render(); } return; }
      if (e.target.closest('[data-refresh]')) { if (S.credits < 300) { AUDIO.play('error'); return; } S.credits -= 300; S.hire = [newPilot(false), newPilot(false), newPilot(false)]; save(); UI.renderTop(); this.render(); }
    };
  },
};
UI.reg('roster', Roster);

// ---------------------------------------------------------------------
const Settings = {
  enter() { this.render(); },
  render() {
    const s = S.settings;
    const seg = (key, opts) => '<div class="seg">' + opts.map(([v, n]) => '<button class="btn sm ' + (s[key] === v ? 'on' : '') + '" data-set="' + key + '" data-v="' + v + '">' + n + '</button>').join('') + '</div>';
    let h = '<div class="page"><div class="panel rivets pe" style="max-width:820px"><h3>Settings</h3><div class="scroll grow">';
    h += '<div class="setrow"><label>Master volume</label><div class="row"><input type="range" min="0" max="1" step="0.05" value="' + s.vol + '" data-vol class="grow"><span class="mono" style="width:40px">' + Math.round(s.vol * 100) + '%</span></div></div>';
    h += '<div class="setrow"><label>Sound effects</label>' + seg('sfx', [[true, 'On'], [false, 'Off']]) + '</div>';
    h += '<div class="setrow"><label>Graphics quality</label>' + seg('quality', [['low', 'Low'], ['med', 'Medium'], ['high', 'High']]) + '</div>';
    h += '<div class="setrow"><label>Screen shake</label>' + seg('shake', [[true, 'On'], [false, 'Off']]) + '</div>';
    h += '<div class="setrow"><label>Damage numbers</label>' + seg('dmgNums', [[true, 'On'], [false, 'Off']]) + '</div>';
    h += '<div class="setrow"><label>Combat log</label>' + seg('log', [[true, 'On'], [false, 'Off']]) + '</div>';
    h += '<div class="setrow"><label>Game mode</label><div class="row"><button class="btn sm ' + (!isSandbox() ? 'on' : '') + '" data-mode="career">Career</button><button class="btn sm ' + (isSandbox() ? 'on' : '') + '" data-mode="sandbox">Sandbox</button><span class="faint" style="font-size:12px">Sandbox has every part unlocked and keeps its own designs</span></div></div>';
    h += '<div class="setrow"><label>Save data</label><div class="row wrap"><button class="btn sm" data-a="exp">Export save</button><button class="btn sm" data-a="imp">Import save</button><span class="faint" style="font-size:12px">Progress saves to this browser automatically</span></div></div>';
    h += '<div class="setrow"><label>Reset</label><div class="row"><button class="btn sm danger" data-a="reset">Reset all progress</button></div></div>';
    h += '<div class="setrow"><label>Controls</label><div class="dim" style="font-size:12px;line-height:1.6">Drag to orbit | Wheel to zoom | Right drag to pan<br>Battle: Space pause | 1 2 3 speed | C camera | Tab next mech | Click a mech to follow</div></div>';
    h += '<div class="setrow"><label>Career</label><div class="dim mono" style="font-size:12px">' + S.stats.battles + ' battles | ' + S.stats.wins + ' wins | ' + S.stats.kills + ' kills | ' + fmt(S.stats.earned) + ' cr earned</div></div>';
    h += '</div></div></div>';
    const root = $('#scr-settings');
    root.innerHTML = h;
    root.onclick = async (e) => {
      const b = e.target.closest('[data-set]');
      if (b) {
        let v = b.dataset.v; if (v === 'true') v = true; else if (v === 'false') v = false;
        S.settings[b.dataset.set] = v; save();
        if (b.dataset.set === 'quality') { applyQuality(); VIEW.setDesign(activeDesign(), true); }
        AUDIO.setVolume(); this.render(); return;
      }
      const m = e.target.closest('[data-mode]');
      if (m) { setMode(m.dataset.mode); UI.renderTop(); this.render(); return; }
      const a = e.target.closest('[data-a]');
      if (!a) return;
      if (a.dataset.a === 'exp') UI.prompt('Export Save', 'MFSAVE:' + encodeText(S), { area: true, readonly: true, rows: 8, text: 'Keep this code somewhere safe to restore your progress later.' });
      else if (a.dataset.a === 'imp') {
        const v = await UI.prompt('Import Save', '', { area: true, rows: 8, ok: 'Import', text: 'Paste a code that starts with MFSAVE: | this replaces your current progress.' });
        if (!v) return;
        try {
          if (!v.trim().startsWith('MFSAVE:')) throw new Error('Not a save code');
          const obj = decodeText(v.trim().slice(7));
          if (!obj || !obj.designs) throw new Error('Damaged save');
          S = migrate(obj); save(true); applyQuality(); AUDIO.setVolume(); VIEW.setDesign(activeDesign(), true); UI.toast('Save imported', 'green'); UI.show('hangar');
        } catch (err) { UI.toast('Import failed | ' + esc(err.message), 'red'); }
      } else if (a.dataset.a === 'reset') {
        if (await UI.confirm('Reset Progress', 'Erase all credits, parts, designs and pilots and start a new career? Settings are kept.', 'Reset everything', 'danger')) {
          resetSave(); VIEW.setDesign(activeDesign(), true); UI.toast('Progress reset', 'amber'); UI.show('title');
        }
      }
    };
    const vol = $('[data-vol]', root);
    vol.oninput = () => { S.settings.vol = +vol.value; AUDIO.setVolume(); vol.nextElementSibling.textContent = Math.round(S.settings.vol * 100) + '%'; };
    vol.onchange = () => { save(); AUDIO.init(); AUDIO.resume(); AUDIO.play('equip'); };
  },
};
UI.reg('settings', Settings);
