// =====================================================================
// 09 | AUDIO | Web Audio synthesis (no external files)
// =====================================================================
const AUDIO = {
  ctx: null, master: null, noise: null, last: {}, enabled: true,
  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.comp = this.ctx.createDynamicsCompressor();
      this.master.connect(this.comp); this.comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 1.5;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.setVolume();
    } catch (e) { this.ctx = null; }
  },
  setVolume() { if (this.master && S) this.master.gain.value = S.settings.sfx ? S.settings.vol * 0.7 : 0; },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  ok(key, gap) {
    if (!this.ctx || !S || !S.settings.sfx || S.settings.vol <= 0) return false;
    const t = this.ctx.currentTime;
    if (this.last[key] && t - this.last[key] < gap) return false;
    this.last[key] = t;
    return true;
  },
  env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); },
  noiseHit(vol, dur, freq, q = 1, type = 'lowpass', sweep) {
    const c = this.ctx, t = c.currentTime;
    const src = c.createBufferSource(); src.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    const g = c.createGain(); this.env(g, t, 0.004, vol, dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  },
  tone(type, f0, f1, vol, dur, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  },
  play(kind, vol = 1) {
    if (!this.ctx) return;
    vol = clamp(vol, 0, 1.2);
    if (vol < 0.03) return;
    switch (kind) {
      case 'click': if (this.ok('click', 0.03)) this.tone('square', 900, 600, 0.05, 0.05); break;
      case 'hover': if (this.ok('hover', 0.05)) this.tone('sine', 1400, 1200, 0.015, 0.03); break;
      case 'equip': if (this.ok('equip', 0.05)) { this.noiseHit(0.25, 0.12, 1800, 2, 'bandpass'); this.tone('square', 180, 90, 0.08, 0.12); } break;
      case 'buy': if (this.ok('buy', 0.1)) { this.tone('triangle', 660, 0, 0.12, 0.1); this.tone('triangle', 990, 0, 0.12, 0.15, 0.08); } break;
      case 'error': if (this.ok('error', 0.15)) this.tone('sawtooth', 160, 120, 0.1, 0.2); break;
      case 'mg': if (this.ok('mg', 0.04)) this.noiseHit(0.22 * vol, 0.06, 2400, 1, 'bandpass'); break;
      case 'ac': if (this.ok('ac', 0.05)) { this.noiseHit(0.45 * vol, 0.16, 1400, 0.8); this.tone('square', 140, 50, 0.12 * vol, 0.12); } break;
      case 'hac': if (this.ok('hac', 0.06)) { this.noiseHit(0.7 * vol, 0.35, 900, 0.7); this.tone('sine', 90, 35, 0.4 * vol, 0.3); } break;
      case 'shotgun': if (this.ok('sg', 0.08)) { this.noiseHit(0.6 * vol, 0.25, 1600, 0.6); this.tone('square', 110, 40, 0.2 * vol, 0.15); } break;
      case 'laser': if (this.ok('laser', 0.04)) this.tone('sawtooth', 1800, 300, 0.07 * vol, 0.12); break;
      case 'pulse': if (this.ok('pulse', 0.05)) this.tone('square', 1300, 500, 0.06 * vol, 0.08); break;
      case 'beam': if (this.ok('beam', 0.2)) { this.tone('sawtooth', 220, 180, 0.1 * vol, 1.0); this.tone('sine', 880, 820, 0.06 * vol, 1.0); } break;
      case 'rail': if (this.ok('rail', 0.1)) { this.tone('sawtooth', 2400, 80, 0.25 * vol, 0.35); this.noiseHit(0.5 * vol, 0.3, 3000, 0.6, 'highpass', 400); } break;
      case 'charge': if (this.ok('charge', 0.2)) this.tone('sine', 300, 2000, 0.06 * vol, 0.7); break;
      case 'missile': if (this.ok('missile', 0.07)) this.noiseHit(0.3 * vol, 0.5, 600, 1, 'bandpass', 2400); break;
      case 'arty': if (this.ok('arty', 0.2)) { this.noiseHit(0.8 * vol, 0.6, 500, 0.6); this.tone('sine', 70, 30, 0.5 * vol, 0.5); } break;
      case 'plasma': if (this.ok('plasma', 0.1)) this.tone('sawtooth', 120, 600, 0.15 * vol, 0.25); break;
      case 'flame': if (this.ok('flame', 0.12)) this.noiseHit(0.18 * vol, 0.2, 700, 0.5); break;
      case 'melee': if (this.ok('melee', 0.1)) { this.noiseHit(0.6 * vol, 0.15, 2600, 1.5, 'bandpass'); this.tone('square', 220, 60, 0.25 * vol, 0.15); } break;
      case 'hit': if (this.ok('hit', 0.03)) this.noiseHit(0.25 * vol, 0.08, 3200, 2, 'bandpass'); break;
      case 'ping': if (this.ok('ping', 0.06)) this.tone('triangle', 2200, 1800, 0.06 * vol, 0.1); break;
      case 'boom': if (this.ok('boom', 0.05)) { this.noiseHit(0.9 * vol, 0.9, 700, 0.6, 'lowpass', 120); this.tone('sine', 80, 25, 0.6 * vol, 0.7); } break;
      case 'bigboom': if (this.ok('bigboom', 0.2)) { this.noiseHit(1.1 * vol, 1.8, 900, 0.5, 'lowpass', 60); this.tone('sine', 60, 20, 0.9 * vol, 1.4); } break;
      case 'step': if (this.ok('step', 0.12)) this.tone('sine', 70, 40, 0.18 * vol, 0.12); break;
      case 'jet': if (this.ok('jet', 0.3)) this.noiseHit(0.4 * vol, 0.9, 400, 0.5, 'bandpass', 1200); break;
      case 'alarm': if (this.ok('alarm', 0.6)) { this.tone('square', 880, 0, 0.06, 0.12); this.tone('square', 660, 0, 0.06, 0.12, 0.15); } break;
      case 'shutdown': if (this.ok('shutdown', 0.5)) this.tone('sawtooth', 400, 40, 0.2, 1.0); break;
      case 'countdown': this.tone('square', 660, 0, 0.1, 0.15); break;
      case 'go': this.tone('square', 990, 0, 0.12, 0.35); this.tone('square', 1320, 0, 0.08, 0.35, 0.05); break;
      case 'victory': [523, 659, 784, 1046].forEach((f, i) => this.tone('triangle', f, 0, 0.16, 0.5, i * 0.13)); break;
      case 'defeat': [392, 330, 262, 196].forEach((f, i) => this.tone('sawtooth', f, f * 0.98, 0.1, 0.55, i * 0.18)); break;
    }
  },
};
