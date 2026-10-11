// =====================================================================
// 12 | RENDERING | BATTLE VIEW (syncs simulation to 3D, FX, cameras)
// =====================================================================
const KIND_COLOR = { laser: 0x5fe9ff, beam: 0x5fe9ff, rail: 0xbfe8ff, flame: 0xff7a1a, plasma: 0xff40d0 };
const tmpV = new V3(), tmpV2 = new V3(), tmpV3 = new V3();

class BattleView {
  constructor(battle) {
    this.b = battle;
    this.arena = buildArena(battle.mapId);
    this.scene = this.arena.scene;
    this.fx = new FX(this.scene, this.arena);
    this.rigs = new Map();
    for (const u of battle.units) {
      const rig = buildMech(u.design);
      rig.root.position.set(u.x, 0, u.z);
      rig.root.rotation.y = u.heading;
      this.scene.add(rig.root);
      rig.firing = {}; rig.detached = { f: 0, l: 0, r: 0, b: 0, t: 0 }; rig.emit = 0; rig.lastPhase = 0;
      const bub = mk(GEO.sph(1, 16, 12), new THREE.MeshBasicMaterial({ color: 0x5fe9ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), 0, u.dims.height * 0.55, 0, rig.root, { shadow: false });
      bub.scale.set(u.radius * 1.3, u.dims.height * 0.62, u.radius * 1.3); bub.visible = false;
      rig.bubble = bub;
      if (u.dummy) rig.root.rotation.y = u.heading;
      this.rigs.set(u, rig);
    }
    this.speed = 1; this.paused = false; this.slowmo = 1; this.slowT = 0;
    this.acc = 0;
    this.camMode = 'cinematic';
    this.follow = battle.units.find((u) => u.team === 0) || battle.units[0];
    this.dir = { t: 0, shot: null, next: 0 };
    this.killcam = null;
    this.camPos = new V3(0, 40, -90); this.camLook = new V3();
    this.dmgNums = []; this.dmgAgg = new Map();
    this.stepT = 0;
    this.fx.setScale(GFX.h);
    const o = GFX.orbit;
    o.bounds = Math.max(battle.hx, battle.hz);
    o.minDist = 8; o.maxDist = 220; o.tTarget.set(0, 2, 0); o.tDist = Math.max(battle.hx, battle.hz) * 1.25; o.tPitch = 0.75; o.tYaw = 0.4; o.snap();
    o.autoRotate = 0;
    o.onUserInput = () => { if (this.camMode === 'cinematic' && !this.killcam) this.setCam('orbit'); };
    o.onClick = (e) => this.pick(e);
    this.ray = new THREE.Raycaster();
  }
  setCam(m) {
    this.camMode = m;
    const o = GFX.orbit;
    if (m === 'orbit') { o.tTarget.copy(this.camLook); o.target.copy(this.camLook); const d = GFX.camera.position.clone().sub(this.camLook); o.tDist = o.dist = clamp(d.length(), 10, 200); o.tYaw = o.yaw = Math.atan2(d.x, d.z); o.tPitch = o.pitch = clamp(Math.asin(d.y / Math.max(0.01, d.length())), 0.05, 1.4); }
    if (UI.battleHud) UI.battleHud.syncButtons();
  }
  pick(e) {
    const r = GFX.renderer.domElement.getBoundingClientRect();
    const m = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(m, GFX.camera);
    let best = null, bd = 1e9;
    for (const [u, rig] of this.rigs) {
      tmpV.set(u.x, u.y + u.dims.height * 0.5, u.z);
      const d = this.ray.ray.distanceToPoint(tmpV);
      if (d < u.radius * 1.4 && d < bd) { bd = d; best = u; }
    }
    if (best) { this.follow = best; if (this.camMode === 'orbit') this.setCam('follow'); if (UI.battleHud) UI.battleHud.onSelect(best); }
  }
  muzzleWorld(u, slot, out) {
    const rig = this.rigs.get(u);
    const m = rig && rig.muzzles[slot];
    if (m && m.parent) return m.getWorldPosition(out);
    const p = u.muzzlePos(slot, {});
    return out.set(p.x, p.y, p.z);
  }
  compWorld(u, k, out) {
    const rig = this.rigs.get(u);
    const part = rig && rig.parts[k];
    if (part && part.parent && !k.startsWith('core') && k !== 'reactor') {
      part.getWorldPosition(out);
      if (k === 'legL' || k === 'legR') out.y = Math.max(0.6, out.y - u.dims.hip * 0.45);
      return out;
    }
    const p = u.compPos(k, {});
    return out.set(p.x, p.y, p.z);
  }
  camDist(p) { return GFX.camera.position.distanceTo(p); }
  vol(p, base = 1) { return base * clamp(1.4 - this.camDist(p) / 120, 0.05, 1); }

  update(realDt) {
    const b = this.b;
    if (this.slowT > 0) { this.slowT -= realDt; if (this.slowT <= 0) this.slowmo = 1; }
    const scale = this.paused ? 0 : this.speed * this.slowmo;
    const simDt = realDt * scale;
    this.acc += simDt;
    let steps = 0;
    while (this.acc >= SIM_DT && steps < 20) { b.step(SIM_DT); this.acc -= SIM_DT; steps++; }
    if (steps >= 20) this.acc = 0;
    for (const e of b.events) this.handle(e);
    b.events.length = 0;
    const vdt = Math.min(0.1, simDt);
    this.syncUnits(vdt, realDt);
    this.syncProjectiles(vdt);
    this.syncBeams();
    this.fx.update(vdt);
    this.updateDmgNums(realDt);
    this.updateCamera(realDt);
  }

  // ------------------------------------------------------------ units
  syncUnits(dt, realDt) {
    const b = this.b;
    for (const [u, rig] of this.rigs) {
      rig.root.position.set(u.x, u.y, u.z);
      rig.root.rotation.y = u.heading;
      const st = u.st;
      const fwd = u.fwdSpeed || 0;
      const strideLen = (st.legType === 'quad' ? 2.4 : 2.8) * u.dims.s;
      let stride = (fwd / strideLen) * Math.PI;
      if (Math.abs(fwd) < 0.4 && u.alive && Math.abs(angDiff(rig.lastHeading || u.heading, u.heading)) > 0.002) stride = 3;
      rig.lastHeading = u.heading;
      for (const k in rig.firing) rig.firing[k] = Math.max(0, rig.firing[k] - dt);
      if (u.alive) {
        animateRig(rig, { spd: fwd / Math.max(1, st.speed), stride: u.jumping ? 0 : stride, turn: 0, torsoYaw: u.torsoYaw, pitch: u.pitch, heat: u.heatFrac, jumping: u.jumping, boosting: u.boostT > 0, firing: rig.firing, t: b.t, vel: fwd, strafe: u.strafe }, dt);
        // footsteps
        if (st.legType === 'biped' || st.legType === 'quad') {
          const ph = Math.floor(rig.anim.phase / Math.PI);
          if (ph !== rig.lastPhase && !u.jumping) {
            rig.lastPhase = ph;
            const d = this.camDist(rig.root.position);
            if (d < 45) AUDIO.play('step', this.vol(rig.root.position, 0.4 + st.weight / 150));
            if (st.weight > 60 && d < 30 && S.settings.shake) this.fx.shake = Math.min(0.25, this.fx.shake + 0.04);
            if (Math.random() < 0.5) this.fx.dust(tmpV.set(u.x, 0, u.z), 1, 0.9 * u.dims.s);
          }
        }
        if (st.legType === 'hover' && Math.random() < dt * 12) this.fx.dust(tmpV.set(u.x + rand(-1, 1), 0, u.z + rand(-1, 1)), 1, 1.0, [0.6, 0.6, 0.6]);
        // limp from lost legs, shutdown slump
        const lean = (u.alive_('legL') ? 0 : 0.14) - (u.alive_('legR') ? 0 : 0.14);
        rig.tilt.rotation.z = damp(rig.tilt.rotation.z, lean, 4, dt);
        rig.tilt.rotation.x = damp(rig.tilt.rotation.x, u.shutdown ? 0.12 : 0, 3, dt);
        rig.mats.glow.emissiveIntensity = u.shutdown ? (Math.sin(b.t * 12) > 0 ? 0.6 : 0.05) : 2.4;
        // damage smoke, fire and sparks
        rig.emit += dt;
        if (rig.emit > 0.08) {
          rig.emit = 0;
          for (const [k, c] of Object.entries(u.comps)) {
            const f = c.hp / c.max;
            if (c.alive && f > 0.5) continue;
            if (k.startsWith('core') || k === 'reactor') { if (!c.alive || f < 0.4) { this.compWorld(u, 'torso', tmpV); if (Math.random() < 0.3) this.fx.smokePuff(tmpV, 1, 0.9, 0.12, 1.8); } continue; }
            this.compWorld(u, k, tmpV);
            if (!c.alive) { if (Math.random() < 0.35) this.fx.sparks(tmpV, 3, 6, [1, 0.8, 0.4], 0.18); if (Math.random() < 0.15) this.fx.smokePuff(tmpV, 1, 0.7, 0.18, 1.4); continue; }
            if (f < 0.5 && Math.random() < 0.35) this.fx.smokePuff(tmpV, 1, 0.8, 0.3 - f * 0.2, 1.8);
            if (f < 0.25 && Math.random() < 0.5) this.fx.fire(tmpV, 1, 0.6);
            if (f < 0.35 && Math.random() < 0.12) this.fx.sparks(tmpV, 3, 5, [1, 0.85, 0.5], 0.15);
          }
          if (u.heatFrac > 0.75 && Math.random() < 0.4) { this.compWorld(u, 'torso', tmpV); tmpV.y += u.dims.s; this.fx.smokePuff(tmpV, 1, 0.6, 0.55, 1.0, 3); }
          if (u.meltdown > 0) { this.compWorld(u, 'torso', tmpV); this.fx.sparks(tmpV, 6, 10, [1, 0.9, 0.5]); this.fx.flash(tmpV, 2.5, [1, 0.6, 0.2], 0.1); }
          if (u.jumping) { tmpV.set(u.x, u.y + u.dims.y.back - 1, u.z); this.fx.fire(tmpV, 2, 0.7); this.fx.smokePuff(tmpV, 1, 0.8, 0.4, 0.8, -1); }
        }
        // panels fall as facing armor drops
        for (const f of FACINGS) {
          const list = rig.panels[f];
          if (!list.length) continue;
          const ratio = u.armorMax[f] ? u.armor[f] / u.armorMax[f] : 0;
          const want = ratio <= 0 ? list.length : Math.floor((1 - ratio) * (list.length + 1) * 0.95);
          while (rig.detached[f] < Math.min(want, list.length)) { this.dropPanel(u, rig, list[rig.detached[f]]); rig.detached[f]++; }
        }
        // barrier bubble
        if (rig.bubble.visible) { rig.bubbleT -= realDt; rig.bubble.material.opacity = Math.max(0, rig.bubbleT) * 0.9; if (rig.bubbleT <= 0) rig.bubble.visible = false; }
      } else if (rig.dying) {
        const d = rig.dying;
        d.t += dt;
        const k = Math.min(1, d.t / 1.4);
        rig.tilt.rotation.x = d.rx * k * k; rig.tilt.rotation.z = d.rz * k * k;
        rig.tilt.position.y = -k * u.dims.hip * 0.25 / u.dims.s;
        if (d.t < 8 && Math.random() < dt * 14) { this.compWorld(u, 'torso', tmpV); this.fx.fire(tmpV, 2, 1.0); }
        if (Math.random() < dt * 6) { tmpV.set(u.x + rand(-1, 1), u.dims.y.torso * 0.6, u.z + rand(-1, 1)); this.fx.smokePuff(tmpV, 1, 1.8, 0.1, 3.5, 2.5); }
      }
    }
  }
  dropPanel(u, rig, mesh) {
    if (!mesh || !mesh.parent) return;
    mesh.getWorldPosition(tmpV);
    const a = rand(0, TAU);
    this.fx.addDebris(mesh, new V3(Math.cos(a) * 3, 4 + Math.random() * 3, Math.sin(a) * 3), new V3(rand(-6, 6), rand(-6, 6), rand(-6, 6)), false, 0);
    this.fx.sparks(tmpV, 8, 9);
  }
  detachPart(u, k, power = 1) {
    const rig = this.rigs.get(u);
    let obj = null;
    if (k === 'legL' || k === 'legR') obj = rig.legs[k] && rig.legs[k].lower;
    else obj = rig.parts[k];
    if (!obj || !obj.parent) return;
    if (k === 'legL' || k === 'legR') rig.legs[k].lost = true;
    obj.getWorldPosition(tmpV);
    const side = k.endsWith('L') ? 1 : -1;
    const yaw = u.torsoWorld;
    const vx = Math.cos(yaw) * side * 6 * power, vz = -Math.sin(yaw) * side * 6 * power;
    this.fx.addDebris(obj, new V3(vx + rand(-2, 2), 6 + Math.random() * 4, vz + rand(-2, 2)), new V3(rand(-5, 5), rand(-5, 5), rand(-5, 5)), true, 6);
    this.fx.explosion(tmpV, 0.6, { decal: false, shakeMul: this.shakeFor(tmpV) });
  }
  shakeFor(p) { if (!S.settings.shake) return 0; return clamp(1.5 - this.camDist(p) / 60, 0, 1); }

  // ------------------------------------------------------------ events
  handle(e) {
    const b = this.b;
    switch (e.t) {
      case 'fire': {
        const u = e.u, w = e.w, p = w.p, rig = this.rigs.get(u);
        rig.firing[w.slot] = 0.25;
        if (w.slot === 'armL' || w.slot === 'armR') rig.anim.recoil[w.slot] = p.kind === 'ballistic' ? Math.min(1, p.dmg / 20) : 0.3;
        this.muzzleWorld(u, w.slot, tmpV);
        const v = this.vol(tmpV);
        if (p.kind === 'ballistic') {
          this.fx.flash(tmpV, p.pellets ? 2.4 : 0.8 + p.dmg / 25, [1, 0.8, 0.45], 0.06);
          if (p.dmg > 12 || p.pellets) this.fx.smokePuff(tmpV, 1, 0.8, 0.4, 0.8);
          AUDIO.play(p.id === 'w_gat' || p.id === 'w_lac' ? 'mg' : p.pellets ? 'shotgun' : p.id === 'w_hac' ? 'hac' : 'ac', v);
        } else if (p.kind === 'laser') AUDIO.play(p.burst > 1 ? 'pulse' : 'laser', v);
        else if (p.kind === 'beam') AUDIO.play('beam', v);
        else if (p.kind === 'missile') { this.fx.flash(tmpV, 1.2, [1, 0.7, 0.3], 0.08); AUDIO.play('missile', v); }
        else if (p.kind === 'artillery') { this.fx.flash(tmpV, 3, [1, 0.7, 0.3], 0.12); this.fx.smokePuff(tmpV, 4, 1.4, 0.35, 1.5); AUDIO.play('arty', v); if (S.settings.shake) this.fx.shake += 0.1 * this.shakeFor(tmpV); }
        else if (p.kind === 'plasma') { this.fx.flash(tmpV, 1.6, [1, 0.3, 0.9], 0.1); AUDIO.play('plasma', v); }
        else if (p.kind === 'flame') AUDIO.play('flame', v);
        break;
      }
      case 'charge': {
        const u = e.u, w = e.w;
        AUDIO.play('charge', this.vol(this.muzzleWorld(u, w.slot, tmpV)));
        this.rigs.get(u).charging = { w, t: w.p.charge };
        break;
      }
      case 'swing': {
        const rig = this.rigs.get(e.u);
        if (e.w.slot === 'armL' || e.w.slot === 'armR') rig.anim.swing[e.w.slot] = 1;
        break;
      }
      case 'melee': {
        if (!e.hit) break;
        this.compWorld(e.tgt, 'torso', tmpV);
        this.fx.sparks(tmpV, 24, 14, [1, 0.9, 0.6], 0.3);
        this.fx.flash(tmpV, 2, [1, 0.9, 0.7], 0.08);
        AUDIO.play('melee', this.vol(tmpV));
        if (S.settings.shake) this.fx.shake += 0.25 * this.shakeFor(tmpV);
        break;
      }
      case 'impact': this.onImpact(e); break;
      case 'hit': {
        const u = e.u;
        this.compWorld(u, e.comp, tmpV);
        tmpV.x += rand(-0.4, 0.4); tmpV.y += rand(-0.3, 0.3); tmpV.z += rand(-0.4, 0.4);
        if (e.shield) this.fx.sparks(tmpV, 6, 8, [0.5, 0.85, 1], 0.2);
        else if (e.armorHit) this.fx.sparks(tmpV, 4 + Math.min(10, e.dmg / 4), 9, [1, 0.8, 0.4], 0.2);
        else this.fx.sparks(tmpV, 6 + Math.min(12, e.dmg / 3), 11, [1, 0.55, 0.2], 0.24);
        if (!e.beam || Math.random() < 0.3) AUDIO.play('hit', this.vol(tmpV, 0.5));
        if (S.settings.dmgNums) {
          const agg = (this.dmgAgg.get(u) || { dmg: 0, t: 0, kind: 'ar' });
          agg.dmg += e.dmg; agg.kind = e.shield ? 'sh' : e.armorHit ? 'ar' : 'st';
          if (!agg.t) agg.t = 0.3;
          this.dmgAgg.set(u, agg);
        }
        if (e.dmg >= 25 && S.settings.shake) this.fx.shake += Math.min(0.35, e.dmg / 200) * this.shakeFor(tmpV);
        break;
      }
      case 'deflect': this.compWorld(e.u, 'torso', tmpV); this.fx.sparks(tmpV, 10, 16, [1, 1, 0.8], 0.15); AUDIO.play('ping', this.vol(tmpV)); break;
      case 'barrier': { const rig = this.rigs.get(e.u); rig.bubble.visible = true; rig.bubbleT = 0.3; break; }
      case 'reflex': this.compWorld(e.u, 'torso', tmpV); this.fx.flash(tmpV, 2.5, [0.6, 0.8, 1], 0.1); break;
      case 'armorBroken': {
        this.compWorld(e.u, 'torso', tmpV);
        this.fx.sparks(tmpV, 16, 12);
        break;
      }
      case 'shieldBroken': {
        const rig = this.rigs.get(e.u), arm = rig.arms[e.comp];
        if (arm && arm.shield && arm.shield.parent) {
          arm.shield.getWorldPosition(tmpV);
          this.fx.addDebris(arm.shield, new V3(rand(-3, 3), 5, rand(-3, 3)), new V3(rand(-4, 4), rand(-4, 4), rand(-4, 4)), true, 3);
          this.fx.explosion(tmpV, 0.5, { decal: false, shakeMul: this.shakeFor(tmpV) });
        }
        break;
      }
      case 'compDestroyed': {
        const k = e.comp;
        if (['armL', 'armR', 'shL', 'shR', 'back', 'head', 'legL', 'legR'].includes(k)) this.detachPart(e.u, k);
        else { this.compWorld(e.u, 'torso', tmpV); this.fx.explosion(tmpV, 0.45, { decal: false, shakeMul: this.shakeFor(tmpV) }); }
        AUDIO.play('boom', this.vol(tmpV, 0.7));
        if (this.camMode === 'cinematic' && !this.killcam && Math.random() < 0.6) this.cutTo(e.u, 'track');
        break;
      }
      case 'cookoff': this.compWorld(e.u, 'torso', tmpV); this.fx.explosion(tmpV, 1.1, { shakeMul: this.shakeFor(tmpV) }); AUDIO.play('boom', this.vol(tmpV)); break;
      case 'meltdown': AUDIO.play('alarm', 1); break;
      case 'shutdown': this.compWorld(e.u, 'torso', tmpV); this.fx.smokePuff(tmpV, 8, 1.2, 0.7, 2, 3); AUDIO.play('shutdown', this.vol(tmpV)); break;
      case 'jump': tmpV.set(e.u.x, 0.2, e.u.z); this.fx.dust(tmpV, 10, 1.6); AUDIO.play('jet', this.vol(tmpV)); break;
      case 'land': tmpV.set(e.u.x, 0.2, e.u.z); this.fx.dust(tmpV, 12, 1.8); AUDIO.play('step', this.vol(tmpV, 1)); if (S.settings.shake) this.fx.shake += 0.15 * this.shakeFor(tmpV); break;
      case 'boost': tmpV.set(e.u.x, 0.3, e.u.z); this.fx.dust(tmpV, 6, 1.2); AUDIO.play('jet', this.vol(tmpV, 0.7)); break;
      case 'blast': tmpV.set(e.x, e.y, e.z); this.fx.explosion(tmpV, e.size, { shakeMul: this.shakeFor(tmpV) }); AUDIO.play('boom', this.vol(tmpV)); break;
      case 'reactorBlast': this.compWorld(e.u, 'torso', tmpV); this.fx.explosion(tmpV, 3 * e.size, { shakeMul: this.shakeFor(tmpV) * 1.5 }); AUDIO.play('bigboom', 1); break;
      case 'unitDestroyed': this.onDeath(e); break;
      case 'over': break;
    }
  }
  onImpact(e) {
    const pr = e.pr, p = pr.w.p, u = pr.owner;
    tmpV2.set(e.x, e.y, e.z);
    if (e.instant) {
      this.muzzleWorld(u, pr.w.slot, tmpV);
      if (pr.hit && pr.tgt.alive) { this.compWorld(pr.tgt, pr.comp || 'torso', tmpV2); tmpV2.x += rand(-0.5, 0.5); tmpV2.y += rand(-0.4, 0.4); }
      if (p.kind === 'laser') this.fx.tracer(tmpV, tmpV2, 0x7ff0ff, p.burst > 1 ? 0.14 : 0.1, 0.09);
      else if (p.kind === 'rail') {
        this.fx.tracer(tmpV, tmpV2, 0xd8f4ff, p.dmg > 50 ? 0.32 : 0.18, 0.45);
        this.fx.flash(tmpV, 2.5, [0.7, 0.9, 1], 0.12);
        AUDIO.play('rail', this.vol(tmpV));
        for (let i = 0; i < 6; i++) { tmpV3.copy(tmpV).lerp(tmpV2, Math.random()); this.fx.sparks(tmpV3, 2, 3, [0.6, 0.85, 1], 0.15); }
        if (S.settings.shake) this.fx.shake += 0.12 * this.shakeFor(tmpV2);
      } else if (p.kind === 'flame') {
        const n = 5;
        const dx = tmpV2.x - tmpV.x, dy = tmpV2.y - tmpV.y, dz = tmpV2.z - tmpV.z;
        for (let i = 0; i < n; i++) {
          const s = 0.9 + Math.random() * 0.4;
          this.fx.add.emit(tmpV.x, tmpV.y, tmpV.z, dx * 1.6 * s + rand(-1.5, 1.5), dy * 1.6 * s + rand(-0.5, 1.5), dz * 1.6 * s + rand(-1.5, 1.5), 0.55, 0.6 + Math.random() * 0.4, 1, 0.45 + Math.random() * 0.3, 0.1, 0.9, 2.2, -1.5, 1.2);
        }
        if (Math.random() < 0.3) this.fx.smokePuff(tmpV2, 1, 1, 0.15, 1.5);
      }
      if (!pr.hit && p.kind !== 'flame') { this.fx.sparks(tmpV2, 3, 5, [1, 0.8, 0.5], 0.15); this.fx.dust(tmpV2, 1, 0.6); }
      return;
    }
    this.fx.dropProj(pr);
    if (p.kind === 'missile') { this.fx.explosion(tmpV2, 0.35, { decal: e.y < 1.5, shakeMul: this.shakeFor(tmpV2) * 0.4 }); AUDIO.play('boom', this.vol(tmpV2, 0.4)); }
    else if (p.kind === 'artillery') { /* blast event follows */ }
    else if (p.kind === 'plasma') { this.fx.flash(tmpV2, 3, [1, 0.3, 0.9], 0.15); this.fx.sparks(tmpV2, 14, 10, [1, 0.4, 0.95], 0.3); }
    else {
      if (!pr.hit) { this.fx.dust(tmpV2, 2, 0.7); this.fx.sparks(tmpV2, 3, 6, [1, 0.8, 0.5], 0.14); }
      if (p.dmg > 25) this.fx.flash(tmpV2, 1.5, [1, 0.8, 0.5], 0.08);
    }
  }
  onDeath(e) {
    const u = e.u, rig = this.rigs.get(u);
    this.compWorld(u, 'torso', tmpV);
    this.fx.explosion(tmpV, 2.2 * u.dims.s, { shakeMul: this.shakeFor(tmpV) * 1.5 });
    for (let i = 0; i < 3; i++) { tmpV3.copy(tmpV).add(new V3(rand(-2, 2), rand(-1, 2), rand(-2, 2))); this.fx.explosion(tmpV3, 0.8, { decal: false, shakeMul: 0 }); }
    AUDIO.play('bigboom', this.vol(tmpV, 1.2));
    charMech(rig);
    for (const k of ['head', 'shL', 'shR', 'back']) if (Math.random() < 0.6) this.detachPart(u, k, 1.5);
    rig.dying = { t: 0, rx: rand(-0.9, 0.9) || 0.6, rz: rand(-0.6, 0.6) };
    for (const f of rig.jets) f.visible = false;
    if (e.final) {
      this.slowmo = 0.22; this.slowT = 2.6;
      this.killcam = { u, t: 0, yaw: Math.atan2(GFX.camera.position.x - u.x, GFX.camera.position.z - u.z) };
    }
  }

  // ------------------------------------------------------------ projectiles and beams
  syncProjectiles(dt) {
    const seen = new Set();
    for (const pr of this.b.projectiles) {
      seen.add(pr);
      const m = this.fx.projMesh(pr);
      if (!pr.vfrom) { pr.vfrom = this.muzzleWorld(pr.owner, pr.w.slot, new V3()); }
      const end = this.b.projEnd(pr, {});
      if (pr.hit && pr.tgt) { this.compWorld(pr.tgt, pr.comp || 'torso', tmpV3); end.x = tmpV3.x; end.y = tmpV3.y; end.z = tmpV3.z; }
      const k = clamp(pr.t / pr.dur, 0, 1);
      const pos = tmpV.set(lerp(pr.vfrom.x, end.x, k), lerp(pr.vfrom.y, end.y, k), lerp(pr.vfrom.z, end.z, k));
      if (pr.arcH) pos.y += pr.arcH * 4 * k * (1 - k);
      const k2 = Math.min(1, k + 0.02);
      const nxt = tmpV2.set(lerp(pr.vfrom.x, end.x, k2), lerp(pr.vfrom.y, end.y, k2) + (pr.arcH ? pr.arcH * 4 * k2 * (1 - k2) : 0), lerp(pr.vfrom.z, end.z, k2));
      m.position.copy(pos);
      if (nxt.distanceToSquared(pos) > 1e-6) m.lookAt(nxt);
      if (pr.vis === 'bullet') { const w = pr.big ? 0.2 : 0.1; m.scale.set(w, w, pr.big ? 3 : 2.2); }
      else if (pr.vis === 'missile') { this.fx.smokePuff(pos, 1, 0.5, 0.75, 1.0, 0.3); this.fx.add.emit(pos.x, pos.y, pos.z, 0, 0, 0, 0.06, 0.6, 1, 0.7, 0.3, 1, 0, 0, 0); }
      else if (pr.vis === 'shell') { if (Math.random() < 0.5) this.fx.smokePuff(pos, 1, 0.5, 0.5, 0.8, 0.2); }
      else if (pr.vis === 'plasma') { this.fx.add.emit(pos.x, pos.y, pos.z, rand(-1, 1), rand(-1, 1), rand(-1, 1), 0.25, 0.9, 1, 0.3, 0.9, 0.8, -1, 0, 1); }
    }
    for (const [pr] of this.fx.projMeshes) if (!seen.has(pr)) this.fx.dropProj(pr);
  }
  syncBeams() {
    for (const u of this.b.units) {
      if (!u.alive) continue;
      const rig = this.rigs.get(u);
      for (const w of u.weapons) {
        if (!w.beam) continue;
        const bm = w.beam, t = bm.tgt;
        const from = this.muzzleWorld(u, w.slot, new V3());
        const to = new V3();
        if (bm.hit) { this.compWorld(t, bm.comp || 'torso', to); to.x += Math.sin(this.b.t * 7) * 0.4; to.y += Math.cos(this.b.t * 5) * 0.3; }
        else to.set(t.x + bm.mx + Math.sin(this.b.t * 3) * 2, 0.2, t.z + bm.mz);
        const big = w.p.dmg > 80;
        this.fx.beam(w, from, to, 0x4fe0ff, big ? 0.32 : 0.2);
        if (Math.random() < 0.6) this.fx.sparks(to, 2, 6, [0.6, 0.95, 1], 0.18);
        this.fx.flash(from, big ? 1.4 : 0.9, [0.5, 0.9, 1], 0.05);
        if (!bm.hit && Math.random() < 0.2) this.fx.decal(to.x, to.z, 0.6);
      }
      if (rig.charging) {
        const c = rig.charging;
        c.t -= SIM_DT * this.speed;
        if (c.t <= 0 || !u.alive) rig.charging = null;
        else { this.muzzleWorld(u, c.w.slot, tmpV); this.fx.add.emit(tmpV.x + rand(-0.6, 0.6), tmpV.y + rand(-0.6, 0.6), tmpV.z + rand(-0.6, 0.6), 0, 0, 0, 0.12, 0.4, 0.6, 0.9, 1, 1, -2, 0, 0); }
      }
    }
    this.fx.endFrameBeams();
  }

  // ------------------------------------------------------------ damage numbers
  dmgNum(p, dmg, kind) {
    const host = $('#dmgnums');
    if (!host) return;
    let d = this.dmgNums.find((x) => x.life <= 0);
    if (!d) { if (this.dmgNums.length > 40) return; const el = document.createElement('div'); el.className = 'dnum'; host.appendChild(el); d = { el, life: 0 }; this.dmgNums.push(d); }
    d.p = p.clone(); d.life = 0.9; d.el.textContent = Math.round(dmg); d.el.className = 'dnum ' + kind + (dmg >= 30 ? ' big' : '');
    d.el.style.display = 'block';
  }
  updateDmgNums(dt) {
    for (const [u, a] of this.dmgAgg) {
      a.t -= dt;
      if (a.t <= 0) { this.compWorld(u, 'torso', tmpV); tmpV.y += u.dims.height * 0.45; tmpV.x += rand(-0.8, 0.8); this.dmgNum(tmpV, a.dmg, a.kind); this.dmgAgg.delete(u); }
    }
    for (const d of this.dmgNums) {
      if (d.life <= 0) continue;
      d.life -= dt; d.p.y += dt * 2.5;
      if (d.life <= 0) { d.el.style.display = 'none'; continue; }
      tmpV.copy(d.p).project(GFX.camera);
      if (tmpV.z > 1) { d.el.style.display = 'none'; continue; }
      d.el.style.display = 'block';
      d.el.style.transform = 'translate(' + ((tmpV.x * 0.5 + 0.5) * GFX.w).toFixed(0) + 'px,' + ((-tmpV.y * 0.5 + 0.5) * GFX.h).toFixed(0) + 'px)';
      d.el.style.opacity = Math.min(1, d.life * 2.5);
    }
  }
  clearDmgNums() { for (const d of this.dmgNums) d.el.remove(); this.dmgNums = []; }

  // ------------------------------------------------------------ cameras
  cutTo(u, shot) { this.dir.shot = shot; this.dir.u = u; this.dir.t = 0; this.dir.next = rand(3.5, 6); this.dir.cut = true; this.dir.side = chance(0.5) ? 1 : -1; }
  updateCamera(dt) {
    const cam = GFX.camera, b = this.b;
    const alive = b.units.filter((u) => u.alive);
    let pos = null, look = null, snap = false;
    if (this.killcam) {
      const kc = this.killcam, u = kc.u;
      kc.t += dt; kc.yaw += dt * 0.5;
      const d = 9 + u.dims.height * 1.2;
      pos = new V3(u.x + Math.sin(kc.yaw) * d, u.dims.height * 0.6 + 2, u.z + Math.cos(kc.yaw) * d);
      look = new V3(u.x, u.dims.height * 0.4, u.z);
      if (kc.t < 0.05) snap = true;
      if (kc.t > 4.5) { this.killcam = null; }
    } else if (this.camMode === 'orbit') {
      const o = GFX.orbit;
      o.update(dt);
      this.camLook.copy(o.target);
      this.applyShake(cam);
      return;
    } else if (this.camMode === 'follow') {
      const u = this.follow && (this.follow.alive || this.follow.wreck) ? this.follow : alive[0];
      if (u) {
        const yaw = u.torsoWorld;
        const d = 10 + u.dims.height * 1.6;
        pos = new V3(u.x - Math.sin(yaw) * d, u.y + u.dims.height + 4, u.z - Math.cos(yaw) * d);
        const t = u.ai.target;
        look = t && t.alive ? new V3(lerp(u.x, t.x, 0.35), u.dims.height * 0.7, lerp(u.z, t.z, 0.35)) : new V3(u.x + Math.sin(yaw) * 8, u.dims.height * 0.7, u.z + Math.cos(yaw) * 8);
      }
    } else {
      // cinematic director
      const dir = this.dir;
      dir.t += dt;
      if (!dir.shot || dir.t > dir.next || !dir.u || !dir.u.alive) {
        const pool = alive.filter((u) => u.ai.target);
        const u = pool.length ? pick(pool) : alive[0];
        this.cutTo(u, pick(['track', 'shoulder', 'wide', 'low', 'track', 'shoulder']));
      }
      const u = dir.u;
      if (u) {
        const t = u.ai.target && u.ai.target.alive ? u.ai.target : null;
        const mid = t ? new V3((u.x + t.x) / 2, 2, (u.z + t.z) / 2) : new V3(u.x, 2, u.z);
        const h = u.dims.height;
        const ang = t ? angTo(u.x, u.z, t.x, t.z) : u.heading;
        switch (dir.shot) {
          case 'track': {
            const s = dir.side, d = 15 + h * 1.4;
            pos = new V3(u.x + Math.cos(ang) * s * d - Math.sin(ang) * 4, h * 0.55, u.z - Math.sin(ang) * s * d - Math.cos(ang) * 4);
            look = new V3(lerp(u.x, mid.x, 0.4), h * 0.55, lerp(u.z, mid.z, 0.4));
            break;
          }
          case 'shoulder': {
            const d = 11 + h * 1.2, s = dir.side * (4 + h * 0.4);
            pos = new V3(u.x - Math.sin(ang) * d + Math.cos(ang) * s, h * 1.15 + 2, u.z - Math.cos(ang) * d - Math.sin(ang) * s);
            look = t ? new V3(t.x, t.dims.height * 0.5, t.z) : new V3(u.x + Math.sin(ang) * 20, h * 0.5, u.z + Math.cos(ang) * 20);
            break;
          }
          case 'low': {
            const d = 9 + h * 0.9, a = ang + dir.side * 0.6 + dir.t * 0.15 * dir.side;
            pos = new V3(u.x + Math.sin(a) * d, 0.9, u.z + Math.cos(a) * d);
            look = new V3(u.x, h * 0.75, u.z);
            break;
          }
          default: {
            const cx = alive.reduce((a, x) => a + x.x, 0) / Math.max(1, alive.length), cz = alive.reduce((a, x) => a + x.z, 0) / Math.max(1, alive.length);
            const spread = alive.reduce((a, x) => Math.max(a, dist2d(cx, cz, x.x, x.z)), 10);
            const a = dir.side * 0.6 + dir.t * 0.08;
            const d = 30 + spread * 1.1;
            pos = new V3(cx + Math.sin(a) * d, 18 + spread * 0.4, cz + Math.cos(a) * d);
            look = new V3(cx, 2, cz);
          }
        }
        if (dir.cut) { snap = true; dir.cut = false; }
      }
    }
    if (pos && !this.killcam && this.camMode === 'cinematic' && this.camBlocked(pos, look) >= 0) {
      // try another angle rather than staring at a rock
      if (!this.dir.cut && this.dir.t > 0.3) { this.dir.next = 0; }
      else { const t = this.camBlocked(pos, look); pos.lerp(look, Math.min(0.9, t + 0.12)); pos.y += 2; }
    }
    if (pos && this.camMode === 'follow' && !this.killcam) {
      const t = this.camBlocked(pos, look);
      if (t >= 0) { pos.lerp(look, Math.min(0.85, t + 0.1)); pos.y += 3; }
    }
    if (pos) {
      pos.y = Math.max(0.8, pos.y);
      // keep inside the arena so walls do not block the view
      if (snap) { this.camPos.copy(pos); this.camLook.copy(look); }
      else { this.camPos.lerp(pos, 1 - Math.exp(-4 * dt)); this.camLook.lerp(look, 1 - Math.exp(-6 * dt)); }
    }
    cam.position.copy(this.camPos);
    cam.lookAt(this.camLook);
    this.applyShake(cam);
  }
  camBlocked(pos, look) {
    let best = -1;
    for (const o of this.b.obstacles) {
      const t = segObstacle(o, look.x, look.z, pos.x, pos.z, 0.6);
      if (t < 0 || t > 1) continue;
      const y = lerp(look.y, pos.y, t);
      if (y < o.h + 0.5 && (best < 0 || t < best)) best = t;
    }
    return best;
  }
  applyShake(cam) {
    const s = S.settings.shake ? this.fx.shake : 0;
    if (s > 0.01) {
      const k = s * s * 0.7;
      cam.position.x += rand(-k, k); cam.position.y += rand(-k, k); cam.position.z += rand(-k, k);
    }
  }
  dispose() {
    this.fx.dispose();
    this.clearDmgNums();
    for (const [u, rig] of this.rigs) disposeMech(rig);
    const keepGeo = new Set(GEO._c.values());
    const keepMat = new Set(Object.values(MAT));
    this.scene.traverse((o) => {
      if (o.geometry && !keepGeo.has(o.geometry)) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) if (!keepMat.has(m)) m.dispose();
    });
    const o = GFX.orbit; o.onClick = null; o.onUserInput = null; o.bounds = null;
  }
}
