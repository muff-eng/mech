// =====================================================================
// 11 | SYSTEMS | MECH AI (targeting, range keeping, flanking, retreat, heat)
// =====================================================================
const AI = {
  think(u) {
    const b = u.b, ai = u.ai, dt = 0.2;
    ai.stateT += dt;
    const enemies = b.enemiesOf(u.team);
    if (!enemies.length) { ai.target = null; ai.mx = ai.mz = 0; ai.face = null; return; }
    const t = (ai.target = this.pickTarget(u, enemies));
    const dist = Math.max(0.01, dist2d(u.x, u.z, t.x, t.z));
    ai.dist = dist;
    const l = b.los(u.x, u.z, t.x, t.z);
    ai.los = l.clear; ai.cover = l.cover;
    ai.losT = l.clear ? 0 : ai.losT + dt;
    ai.aimT -= dt;
    if (ai.aimT <= 0 || !t.alive_(ai.aimComp)) { ai.aimT = 2; ai.aimComp = this.pickAimComp(u, t); }

    const order = b.orders[u.team] || 'aggressive';
    const live = u.weapons.filter((w) => !w.off && w.p.kind !== 'shield' && (!w.p.ammo || w.ammo > 0));
    const ranged = live.filter((w) => w.p.kind !== 'melee');
    const melee = live.length > 0 && ranged.length === 0;
    const allIndirect = ranged.length > 0 && ranged.every((w) => w.p.indirect);
    let pref;
    if (melee) pref = 2 + (u.radius + t.radius) * 0.6;
    else {
      let s = 0, wsum = 0;
      for (const w of ranged) { const k = Math.max(0.5, weaponDps(w.p)); s += w.p.opt * k; wsum += k; }
      pref = wsum ? s / wsum : 30;
      pref *= order === 'defensive' ? 1.15 : order === 'aggressive' ? 0.88 : 1;
      const minR = Math.max(...ranged.map((w) => w.p.min || 0), 0);
      pref = clamp(pref, Math.max(9, minR + 6), 100);
    }
    if (!live.length) pref = 60; // unarmed: stay away
    ai.pref = pref;

    // ---------- state selection ----------
    const retreatThr = u.ptrait.nerve ? -1 : order === 'defensive' ? 0.45 : order === 'aggressive' ? 0.2 : 0.3;
    let state = 'engage';
    if (ai.state === 'retreat' && ai.stateT < 6) state = 'retreat';
    else if (ai.state === 'retreat') ai.retreated = true;
    if (state !== 'retreat' && !melee && ranged.length && !ai.retreated && u.structFrac < retreatThr && u.skill > 0.25 && (u.repairPool > 20 || order === 'defensive' || u.skill > 0.6)) state = 'retreat';
    const hf = u.heatFrac, coolThr = u.ptrait.dis ? 0.78 : 0.88;
    if (state === 'engage' && !melee && u.skill > 0.35 && (hf > coolThr || (ai.state === 'cool' && hf > 0.45))) state = 'cool';
    if (state === 'engage' && !l.clear && !allIndirect && ai.losT > 0.3) state = 'pursue';
    if (state !== ai.state) { ai.state = state; ai.stateT = 0; }

    // ---------- movement desires ----------
    const tx = (t.x - u.x) / dist, tz = (t.z - u.z) / dist;
    let mx = 0, mz = 0;
    let face = angTo(u.x, u.z, t.x, t.z);
    ai.spdMul = 1;
    if (state === 'engage') {
      const band = melee ? 0.5 : Math.max(4, pref * 0.16);
      ai.strafeT -= dt;
      if (ai.strafeT <= 0) { ai.strafeT = rand(2.5, 5.5); if (chance(0.65)) ai.strafeDir *= -1; }
      if (melee) {
        [mx, mz] = this.seek(u, t.x, t.z);
      } else if (dist > pref + band) {
        [mx, mz] = this.seek(u, t.x, t.z);
        const sw = 0.35;
        mx += tz * ai.strafeDir * sw; mz += -tx * ai.strafeDir * sw;
      } else if (dist < pref - band) {
        mx = -tx; mz = -tz;
        mx += tz * ai.strafeDir * 0.6; mz += -tx * ai.strafeDir * 0.6;
      } else {
        // hold range: strafe, or flank toward the target's weakest side
        const flank = u.skill >= 0.45 && u.st.speed >= t.st.speed * 0.9 && (b.enemiesOf(u.team).length === 1 || t.ai.target !== u || u.skill > 0.7);
        if (flank) {
          const wk = this.weakFacing(t);
          const offs = { l: Math.PI / 2, r: -Math.PI / 2, b: Math.PI, f: 0 }[wk];
          const bear = t.heading + offs;
          const fx = t.x + Math.sin(bear) * pref, fz = t.z + Math.cos(bear) * pref;
          const dd = dist2d(u.x, u.z, fx, fz);
          if (dd > 6) {
            // move around the target (tangentially) toward the flank point
            const cur = angTo(t.x, t.z, u.x, u.z);
            const dir = angDiff(cur, bear) > 0 ? 1 : -1;
            const ox = Math.cos(cur), oz = -Math.sin(cur);
            mx = ox * dir; mz = oz * dir;
            mx += tx * (dist - pref) * 0.05; mz += tz * (dist - pref) * 0.05;
          } else { mx = tz * ai.strafeDir * 0.7; mz = -tx * ai.strafeDir * 0.7; }
        } else {
          mx = tz * ai.strafeDir; mz = -tx * ai.strafeDir;
          ai.spdMul = u.st.legType === 'tracked' ? 0.6 : 0.95;
        }
      }
    } else if (state === 'pursue') {
      // flankers try to come round the side when they lose sight
      [mx, mz] = this.seek(u, t.x, t.z);
    } else if (state === 'retreat' || state === 'cool') {
      ai.coverT = (ai.coverT || 0) - dt;
      if (ai.coverT <= 0 || !ai.coverPt) { ai.coverT = 1.2; ai.coverPt = this.findCover(u, t); }
      if (ai.coverPt) [mx, mz] = this.seek(u, ai.coverPt.x, ai.coverPt.z, true);
      else { mx = -tx; mz = -tz; }
      if (state === 'cool' && dist > pref * 1.4 && !ai.coverPt) { mx *= 0.3; mz *= 0.3; }
    }
    // ---------- steering: obstacles, allies, walls ----------
    const m = Math.hypot(mx, mz);
    if (m > 0.01) {
      mx /= m; mz /= m;
      const [ax, az] = this.avoid(u, mx, mz);
      mx += ax; mz += az;
    }
    for (const o of b.units) {
      if (o === u || !o.alive || o.team !== u.team) continue;
      const dx = u.x - o.x, dz = u.z - o.z, d = Math.hypot(dx, dz), rr = (u.radius + o.radius) * 1.6;
      if (d < rr && d > 0.01) { mx += (dx / d) * (1 - d / rr) * 1.2; mz += (dz / d) * (1 - d / rr) * 1.2; }
    }
    const wall = 9;
    if (u.x > b.hx - wall) mx -= (u.x - (b.hx - wall)) / wall * 1.5;
    if (u.x < -b.hx + wall) mx += (-b.hx + wall - u.x) / wall * 1.5;
    if (u.z > b.hz - wall) mz -= (u.z - (b.hz - wall)) / wall * 1.5;
    if (u.z < -b.hz + wall) mz += (-b.hz + wall - u.z) / wall * 1.5;
    // stuck detection
    ai.stuckT = (ai.stuckT || 0) + dt;
    if (ai.stuckT > 1.2) {
      const moved = ai.lastPos ? dist2d(ai.lastPos.x, ai.lastPos.z, u.x, u.z) : 9;
      if (moved < 1 && Math.hypot(mx, mz) > 0.3) { ai.strafeDir *= -1; ai.pathT = 0; ai.unstick = 0.8; ai.unAng = Math.atan2(mx, mz) + (chance(0.5) ? 1.6 : -1.6); }
      ai.lastPos = { x: u.x, z: u.z }; ai.stuckT = 0;
    }
    if (ai.unstick > 0) { ai.unstick -= dt; mx = Math.sin(ai.unAng); mz = Math.cos(ai.unAng); }
    const mm = Math.hypot(mx, mz);
    if (mm > 1) { mx /= mm; mz /= mm; }
    // armor management: strafing chassis (quad, hover) turn a fresher facing toward the threat
    if ((u.st.legType === 'quad' || u.st.legType === 'hover') && u.skill >= 0.45 && state !== 'retreat') {
      const r = (f) => (u.armorMax[f] ? u.armor[f] / u.armorMax[f] : 0);
      const cur = ai.present || 'f';
      let best = cur, bv = r(cur) + 0.12;
      for (const f of ['f', 'l', 'r']) if (r(f) > bv) { bv = r(f); best = f; }
      ai.present = best;
      const offs = Math.min(Math.PI / 2, u.twist - 0.25);
      if (best === 'l') face -= offs; else if (best === 'r') face += offs;
    }
    ai.mx = mx; ai.mz = mz; ai.face = face;

    // ---------- abilities ----------
    if (u.hasJump && u.jumpCd <= 0 && !u.jumping) {
      if (state === 'pursue' && ai.losT > 1.4) { const a = angTo(u.x, u.z, t.x, t.z) + rand(-0.6, 0.6); u.jump(u.x + Math.sin(a) * 22, u.z + Math.cos(a) * 22); }
      else if (melee && dist > 12 && dist < 30 && l.clear) u.jump(t.x - tx * 4, t.z - tz * 4);
      else if (state === 'retreat' && dist < 22) u.jump(u.x - tx * 20, u.z - tz * 20);
      else if (u.skill > 0.5 && b.t - ai.bigHit < 0.4) { const a = face + (chance(0.5) ? 1.5 : -1.5); u.jump(u.x + Math.sin(a) * 16, u.z + Math.cos(a) * 16); }
      else if (u.skill > 0.6 && t.weapons.some((w) => w.charging > 0 && w.tgt === u)) { const a = face + (chance(0.5) ? 1.5 : -1.5); u.jump(u.x + Math.sin(a) * 14, u.z + Math.cos(a) * 14); }
    }
    if (u.hasBoost && u.boostCd <= 0 && u.boostT <= 0) {
      if (melee && dist > 9 && dist < 34 && l.clear) u.boost(face);
      else if (!melee && dist < pref * 0.5 && u.skill > 0.4) u.boost(face + Math.PI + ai.strafeDir * 0.7);
      else if (u.skill > 0.5 && b.t - ai.bigHit < 0.3) u.boost(face + ai.strafeDir * Math.PI / 2);
      else if (state === 'retreat' && dist < 20) u.boost(face + Math.PI);
    }
  },

  seek(u, x, z, noLos) {
    const ai = u.ai, b = u.b;
    if (b.nav.lineFree(u.x, u.z, x, z)) { const d = Math.max(0.01, dist2d(u.x, u.z, x, z)); ai.path = null; return [(x - u.x) / d, (z - u.z) / d]; }
    ai.pathT -= 0.2;
    const moved = ai.pathGoal ? dist2d(ai.pathGoal.x, ai.pathGoal.z, x, z) : 99;
    if (!ai.path || ai.pathT <= 0 || moved > 8) {
      ai.path = b.nav.path(u.x, u.z, x, z); ai.pathI = 0; ai.pathT = 1.6; ai.pathGoal = { x, z };
    }
    const p = ai.path;
    if (p && p.length) {
      while (ai.pathI < p.length - 1 && dist2d(u.x, u.z, p[ai.pathI].x, p[ai.pathI].z) < 3.5) ai.pathI++;
      // skip ahead if a later waypoint is directly reachable
      for (let k = p.length - 1; k > ai.pathI; k--) if (b.nav.lineFree(u.x, u.z, p[k].x, p[k].z)) { ai.pathI = k; break; }
      const wp = p[ai.pathI];
      const d = Math.max(0.01, dist2d(u.x, u.z, wp.x, wp.z));
      return [(wp.x - u.x) / d, (wp.z - u.z) / d];
    }
    const d = Math.max(0.01, dist2d(u.x, u.z, x, z));
    return [(x - u.x) / d, (z - u.z) / d];
  },

  avoid(u, mx, mz) {
    let ax = 0, az = 0;
    const look = 5 + u.radius;
    const px = u.x + mx * look, pz = u.z + mz * look;
    for (const o of u.b.obstacles) {
      if (u.jumping && o.h < 7) continue;
      let cx, cz, rr;
      if (o.t === 'cyl') { cx = o.x; cz = o.z; rr = o.r; }
      else { cx = clamp(px, o.x - o.w / 2, o.x + o.w / 2); cz = clamp(pz, o.z - o.d / 2, o.z + o.d / 2); rr = 0; }
      const dx = px - cx, dz = pz - cz, d = Math.hypot(dx, dz) - rr;
      const lim = u.radius + 2.5;
      if (d < lim) {
        const k = (lim - Math.max(0, d)) / lim;
        const n = Math.max(0.01, Math.hypot(dx, dz));
        // push sideways along the obstacle rather than straight back
        const nx = dx / n, nz = dz / n;
        const side = mx * nz - mz * nx > 0 ? 1 : -1;
        ax += (nx * 0.6 + nz * side * 0.8) * k; az += (nz * 0.6 - nx * side * 0.8) * k;
      }
    }
    return [ax, az];
  },

  findCover(u, t) {
    const b = u.b;
    let best = null, bs = -1e9;
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * TAU, r = 12 + (k % 3) * 6;
      const x = u.x + Math.sin(a) * r, z = u.z + Math.cos(a) * r;
      if (Math.abs(x) > b.hx - 6 || Math.abs(z) > b.hz - 6) continue;
      if (b.obstacles.some((o) => pointInObstacle(o, x, z, u.radius + 0.5))) continue;
      const hidden = !b.los(t.x, t.z, x, z).clear;
      const s = (hidden ? 40 : 0) + dist2d(t.x, t.z, x, z) * 0.6 - r * 0.8;
      if (s > bs) { bs = s; best = { x, z }; }
    }
    return best;
  },

  weakFacing(t) {
    let best = 'b', bv = 9;
    for (const f of ['l', 'r', 'b']) {
      const v = t.armorMax[f] ? t.armor[f] / t.armorMax[f] : 0;
      const adj = f === 'b' ? v - 0.1 : v;
      if (adj < bv) { bv = adj; best = f; }
    }
    return best;
  },

  pickTarget(u, enemies) {
    const b = u.b, order = b.orders[u.team], focus = b.focus[u.team];
    if (order === 'focus') {
      if (focus && focus.alive) return focus;
      return enemies.reduce((a, e) => (e.hpFrac < a.hpFrac ? e : a));
    }
    let best = null, bs = 1e9;
    for (const e of enemies) {
      const d = dist2d(u.x, u.z, e.x, e.z);
      let s = d;
      if (u.skill > 0.4) s += e.hpFrac * 30 * u.skill;
      if (e === u.ai.target) s -= 14;
      if (e.ai.target === u) s -= 6;
      if (e.dummy) s += 0;
      if (s < bs) { bs = s; best = e; }
    }
    return best;
  },

  pickAimComp(u, t) {
    const alive = (k) => t.alive_(k);
    if (u.skill < 0.35) return pick(['torso', 'torso', 'armL', 'armR', 'legL', 'legR'].filter(alive)) || 'torso';
    if (t.structFrac < 0.5) return 'torso';
    if (t.st.speed > u.st.speed * 1.25 && u.skill > 0.6) {
      const legs = ['legL', 'legR'].filter(alive);
      if (legs.length) return legs.reduce((a, k) => (t.comps[k].hp < t.comps[a].hp ? k : a));
    }
    let best = null, bv = 0;
    for (const w of t.weapons) {
      if (w.off || w.p.kind === 'shield') continue;
      const c = t.comps[w.slot];
      const v = weaponDps(w.p) * (1.6 - c.hp / c.max) * (w.slot.startsWith('arm') ? 1 : 0.7);
      if (v > bv) { bv = v; best = w.slot; }
    }
    return best && bv > 14 ? best : 'torso';
  },

  mayFire(u, w, t) {
    const p = w.p;
    if (!p.ht || p.ht <= 0.5) return true;
    let thr = u.skill < 0.3 ? 1.1 : u.ptrait.dis ? 0.86 : 0.93;
    if (u.ai.state === 'cool') thr = 0.62;
    if (t.structFrac < 0.15) thr = Math.max(thr, 1.0);
    return u.heat + p.ht <= u.heatCap * thr;
  },
};
