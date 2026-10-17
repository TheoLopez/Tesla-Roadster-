// Everything here is synthesized live with the Web Audio API: electric motor whine, tyre and wind
// noise, cold-gas thrusters, impacts, and a procedural synthwave soundtrack.

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

const TRACKS = {
  menu: { bpm: 84, chords: [[57, 'min9'], [53, 'maj7'], [48, 'maj7'], [55, 'add9']], drums: false, arp: 'slow', bass: 'whole', lead: false },
  day: { bpm: 112, chords: [[53, 'maj7'], [55, 'maj'], [52, 'min7'], [57, 'min']], drums: 'four', arp: 'up', bass: 'eighths', lead: true },
  sunset: { bpm: 98, chords: [[50, 'min'], [46, 'maj7'], [53, 'maj'], [48, 'add9']], drums: 'half', arp: 'updown', bass: 'eighths', lead: true },
  night: { bpm: 122, chords: [[48, 'min'], [44, 'maj7'], [51, 'maj'], [46, 'maj']], drums: 'four', arp: 'drive', bass: 'octave', lead: true },
  finale: { bpm: 128, chords: [[52, 'min'], [48, 'maj'], [55, 'maj'], [50, 'maj']], drums: 'four', arp: 'drive', bass: 'octave', lead: true },
};
const QUAL = { min: [0, 3, 7, 12], maj: [0, 4, 7, 12], min7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], min9: [0, 3, 7, 14], add9: [0, 4, 7, 14] };
const ARPS = {
  up: [0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3, 4, 5, 6, 7],
  updown: [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1],
  drive: [0, 2, 1, 3, 2, 4, 3, 5, 0, 2, 1, 3, 2, 4, 3, 6],
  slow: [0, -1, 2, -1, 1, -1, 3, -1, 0, -1, 2, -1, 4, -1, 3, -1],
};
const PENTA = [0, 3, 5, 7, 10, 12, 15, 17];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.musicVol = 0.55;
    this.sfxVol = 0.85;
    this.muted = false;
    this.track = null;
    this.step = 0;
  }

  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.attack.value = 0.005;
    comp.release.value = 0.2;
    this.master.connect(comp).connect(ctx.destination);
    this.music = ctx.createGain();
    this.music.gain.value = this.musicVol;
    this.music.connect(this.master);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = this.sfxVol;
    this.sfx.connect(this.master);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.8, 2.5);
    const revGain = ctx.createGain();
    revGain.gain.value = 0.5;
    this.reverb.connect(revGain).connect(this.music);
    this.sfxReverb = ctx.createConvolver();
    this.sfxReverb.buffer = this.impulse(1.4, 3);
    const sr = ctx.createGain();
    sr.gain.value = 0.25;
    this.sfxReverb.connect(sr).connect(this.sfx);

    this.white = this.noiseBuffer('white');
    this.brown = this.noiseBuffer('brown');
    this.pink = this.noiseBuffer('pink');
    this.buildEngine();
    this.buildMusicBus();
  }

  impulse(seconds, decay) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  noiseBuffer(type) {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (type === 'white') d[i] = w;
      else if (type === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else { b0 = 0.997 * b0 + w * 0.029591; b1 = 0.985 * b1 + w * 0.032534; b2 = 0.95 * b2 + w * 0.048056; d[i] = (b0 + b1 + b2 + w * 0.05) * 2; }
    }
    return buf;
  }

  loop(buffer) {
    const s = this.ctx.createBufferSource();
    s.buffer = buffer;
    s.loop = true;
    s.loopStart = Math.random();
    s.start(0, Math.random() * 1.5);
    return s;
  }

  gainNode(v = 0, dest = this.sfx) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    g.connect(dest);
    return g;
  }

  // ------------------------------------------------------------ continuous car sounds
  buildEngine() {
    const ctx = this.ctx;
    const E = (this.engine = {});
    // motor hum + whine (permanent magnet motor / inverter)
    E.bus = this.gainNode(0);
    E.lp = ctx.createBiquadFilter();
    E.lp.type = 'lowpass';
    E.lp.frequency.value = 1200;
    E.lp.connect(E.bus);
    const osc = (type, f, g) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const gn = ctx.createGain();
      gn.gain.value = g;
      o.connect(gn).connect(E.lp);
      o.start();
      return { o, g: gn };
    };
    E.hum = osc('sawtooth', 40, 0.18);
    E.whine = osc('sine', 300, 0.5);
    E.whine2 = osc('triangle', 450, 0.18);
    E.inverter = ctx.createOscillator();
    E.inverter.type = 'sine';
    E.inverter.frequency.value = 3000;
    E.invGain = this.gainNode(0);
    E.inverter.connect(E.invGain);
    E.inverter.start();
    // tyres on asphalt
    E.road = this.loop(this.brown);
    E.roadF = ctx.createBiquadFilter();
    E.roadF.type = 'lowpass';
    E.roadF.frequency.value = 600;
    E.roadG = this.gainNode(0);
    E.road.connect(E.roadF).connect(E.roadG);
    // wind
    E.wind = this.loop(this.pink);
    E.windF = ctx.createBiquadFilter();
    E.windF.type = 'bandpass';
    E.windF.frequency.value = 900;
    E.windF.Q.value = 0.6;
    E.windG = this.gainNode(0);
    E.wind.connect(E.windF).connect(E.windG);
    // cold gas thrusters: loud hiss + low rumble
    E.thr = this.loop(this.white);
    E.thrF = ctx.createBiquadFilter();
    E.thrF.type = 'highpass';
    E.thrF.frequency.value = 1400;
    E.thrPeak = ctx.createBiquadFilter();
    E.thrPeak.type = 'peaking';
    E.thrPeak.frequency.value = 3200;
    E.thrPeak.gain.value = 6;
    E.thrG = this.gainNode(0);
    E.thr.connect(E.thrF).connect(E.thrPeak).connect(E.thrG);
    E.rum = this.loop(this.brown);
    E.rumF = ctx.createBiquadFilter();
    E.rumF.type = 'lowpass';
    E.rumF.frequency.value = 160;
    E.rumG = this.gainNode(0);
    E.rum.connect(E.rumF).connect(E.rumG);
    // curb scrape
    E.scr = this.loop(this.white);
    E.scrF = ctx.createBiquadFilter();
    E.scrF.type = 'bandpass';
    E.scrF.frequency.value = 2600;
    E.scrF.Q.value = 3;
    E.scrG = this.gainNode(0);
    E.scr.connect(E.scrF).connect(E.scrG);
    // tyre squeal when the tyres hit their grip limit
    E.sq = this.loop(this.pink);
    E.sqF = ctx.createBiquadFilter();
    E.sqF.type = 'bandpass';
    E.sqF.frequency.value = 1150;
    E.sqF.Q.value = 9;
    E.sqG = this.gainNode(0);
    E.sq.connect(E.sqF).connect(E.sqG);
  }

  updateCar({ speed, throttle, boost, lift, grounded, scrape, skid = 0, active }) {
    if (!this.ctx) return;
    const E = this.engine, t = this.ctx.currentTime, k = 0.06;
    const s = Math.abs(speed);
    const on = active ? 1 : 0;
    E.hum.o.frequency.setTargetAtTime(28 + s * 2.2, t, k);
    E.whine.o.frequency.setTargetAtTime(160 + s * 22, t, k);
    E.whine2.o.frequency.setTargetAtTime(240 + s * 33.5, t, k);
    E.inverter.frequency.setTargetAtTime(2200 + s * 45, t, k);
    E.lp.frequency.setTargetAtTime(500 + s * 40 + (throttle ? 900 : 0), t, k);
    const load = throttle ? 1 : 0.35;
    E.bus.gain.setTargetAtTime(on * (0.025 + Math.min(1, s / 50) * 0.11) * load * (grounded ? 1 : 0.6), t, 0.08);
    E.invGain.gain.setTargetAtTime(on * (throttle ? 0.004 + s * 0.00012 : 0.0015), t, 0.1);
    E.roadG.gain.setTargetAtTime(on * (grounded ? Math.min(0.32, s / 55 * 0.32) : 0), t, 0.05);
    E.roadF.frequency.setTargetAtTime(350 + s * 14, t, 0.1);
    E.windG.gain.setTargetAtTime(on * Math.min(0.35, (s / 70) ** 2 * 0.35), t, 0.1);
    E.windF.frequency.setTargetAtTime(600 + s * 16, t, 0.1);
    const thr = Math.max(lift, boost * 0.8);
    E.thrG.gain.setTargetAtTime(on * thr * 0.32, t, 0.03);
    E.rumG.gain.setTargetAtTime(on * thr * 0.7, t, 0.04);
    E.scrG.gain.setTargetAtTime(on * (scrape ? 0.18 : 0), t, 0.04);
    E.sqG.gain.setTargetAtTime(on * (grounded ? skid * 0.5 : 0), t, 0.05);
    E.sqF.frequency.setTargetAtTime(950 + skid * 500 + Math.sin(t * 13) * 60, t, 0.05);
  }

  // ------------------------------------------------------------ one-shots
  env(g, t, a, peak, d) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  noiseHit({ type = 'white', filter = 'lowpass', freq = 1000, q = 1, peak = 0.5, a = 0.005, d = 0.3, sweepTo = null, reverb = false, when = 0 }) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this[type];
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + a + d);
    f.Q.value = q;
    const g = ctx.createGain();
    src.connect(f).connect(g).connect(this.sfx);
    if (reverb) g.connect(this.sfxReverb);
    this.env(g, t, a, peak, d);
    src.start(t, Math.random());
    src.stop(t + a + d + 0.05);
  }

  tone({ type = 'sine', freq = 440, to = null, peak = 0.3, a = 0.005, d = 0.3, when = 0, dest = null, reverb = false, detune = 0 }) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.detune.value = detune;
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + a + d);
    const g = ctx.createGain();
    o.connect(g).connect(dest || this.sfx);
    if (reverb) g.connect(this.sfxReverb);
    this.env(g, t, a, peak, d);
    o.start(t);
    o.stop(t + a + d + 0.05);
  }

  jump() {
    // cold gas burst: sharp pressurised hiss with a thump
    this.noiseHit({ filter: 'highpass', freq: 900, peak: 0.55, a: 0.004, d: 0.55, sweepTo: 2500, reverb: true });
    this.noiseHit({ type: 'brown', filter: 'lowpass', freq: 200, peak: 0.8, a: 0.004, d: 0.3 });
    this.tone({ type: 'sine', freq: 90, to: 45, peak: 0.4, d: 0.25 });
  }

  land(intensity) {
    const v = Math.min(1, intensity / 18);
    this.tone({ type: 'sine', freq: 70, to: 38, peak: 0.25 + v * 0.5, d: 0.25 });
    this.noiseHit({ type: 'brown', filter: 'lowpass', freq: 400, peak: 0.2 + v * 0.5, d: 0.25 });
    if (v > 0.5) this.noiseHit({ filter: 'bandpass', freq: 3000, q: 2, peak: 0.12, d: 0.15, when: 0.02 });
  }

  crash(kind) {
    this.noiseHit({ type: 'white', filter: 'lowpass', freq: 3500, sweepTo: 300, peak: 0.9, d: 0.9, reverb: true });
    this.noiseHit({ type: 'brown', filter: 'lowpass', freq: 250, peak: 1, d: 0.6 });
    this.tone({ type: 'sine', freq: 60, to: 30, peak: 0.7, d: 0.5 });
    // metal clangs
    for (const [f, w] of [[420, 0], [610, 0.03], [890, 0.07], [1290, 0.1]]) this.tone({ type: 'square', freq: f, to: f * 0.92, peak: 0.07, d: 0.5, when: w, reverb: true });
    // glass
    for (let i = 0; i < 9; i++) this.noiseHit({ filter: 'bandpass', freq: 5000 + Math.random() * 4000, q: 8, peak: 0.12, d: 0.08 + Math.random() * 0.1, when: 0.05 + Math.random() * 0.4 });
    if (kind === 'person') this.honk();
  }

  splash() {
    this.noiseHit({ type: 'white', filter: 'lowpass', freq: 2500, sweepTo: 500, peak: 0.8, d: 1.2, reverb: true });
    this.noiseHit({ type: 'brown', filter: 'lowpass', freq: 300, peak: 0.9, d: 0.7 });
    for (let i = 0; i < 12; i++) this.tone({ type: 'sine', freq: 600 + Math.random() * 1200, to: 300, peak: 0.05, d: 0.06, when: 0.1 + Math.random() * 0.8 });
  }

  fallPit() {
    this.noiseHit({ type: 'brown', filter: 'lowpass', freq: 600, sweepTo: 120, peak: 0.9, d: 0.8, reverb: true });
    this.tone({ type: 'sine', freq: 80, to: 35, peak: 0.6, d: 0.6, when: 0.2 });
  }

  collect() {
    const base = 1046.5;
    this.tone({ type: 'sine', freq: base, peak: 0.22, d: 0.18, reverb: true });
    this.tone({ type: 'sine', freq: base * 1.5, peak: 0.2, d: 0.25, when: 0.06, reverb: true });
    this.tone({ type: 'triangle', freq: base * 2, peak: 0.08, d: 0.3, when: 0.1, reverb: true });
  }

  bonus() {
    [0, 4, 7, 12].forEach((n, i) => this.tone({ type: 'triangle', freq: midi(72 + n), peak: 0.15, d: 0.2, when: i * 0.05, reverb: true }));
  }

  checkpoint() {
    [0, 7, 12, 16].forEach((n, i) => this.tone({ type: 'sine', freq: midi(76 + n), peak: 0.18, d: 0.5, when: i * 0.07, reverb: true }));
  }

  countdown(final) {
    this.tone({ type: 'sine', freq: final ? 880 : 440, peak: 0.35, d: final ? 0.6 : 0.25, reverb: true });
    this.tone({ type: 'sine', freq: final ? 1760 : 880, peak: 0.08, d: final ? 0.6 : 0.2 });
  }

  honk() {
    for (const f of [392, 494]) this.tone({ type: 'square', freq: f, peak: 0.07, a: 0.01, d: 0.45 });
    this.noiseHit({ type: 'pink', filter: 'bandpass', freq: 800, q: 0.7, peak: 0.25, a: 0.05, d: 0.4 });
  }

  whoosh() {
    this.noiseHit({ type: 'pink', filter: 'bandpass', freq: 400, sweepTo: 2000, q: 1, peak: 0.3, a: 0.12, d: 0.35 });
  }

  cone() {
    this.tone({ type: 'triangle', freq: 300, to: 160, peak: 0.2, d: 0.15 });
    this.noiseHit({ type: 'white', filter: 'bandpass', freq: 1500, q: 1.5, peak: 0.2, d: 0.1 });
  }

  ui() { this.tone({ type: 'sine', freq: 1400, peak: 0.08, d: 0.06 }); }

  complete() {
    [0, 4, 7, 11, 14, 19].forEach((n, i) => this.tone({ type: 'triangle', freq: midi(64 + n), peak: 0.16, d: 1.2, when: i * 0.09, reverb: true }));
  }

  fail() {
    [7, 3, 0, -5].forEach((n, i) => this.tone({ type: 'sawtooth', freq: midi(60 + n), peak: 0.07, d: 0.4, when: i * 0.18, reverb: true }));
  }

  // ------------------------------------------------------------ music
  buildMusicBus() {
    const ctx = this.ctx;
    this.padBus = ctx.createGain();
    this.padBus.gain.value = 0.5;
    this.padBus.connect(this.music);
    this.padBus.connect(this.reverb);
    this.delay = ctx.createDelay(1);
    this.delayFb = ctx.createGain();
    this.delayFb.gain.value = 0.35;
    this.delay.connect(this.delayFb).connect(this.delay);
    const dOut = ctx.createGain();
    dOut.gain.value = 0.35;
    this.delay.connect(dOut).connect(this.music);
    this.arpBus = ctx.createGain();
    this.arpBus.gain.value = 0.5;
    this.arpBus.connect(this.music);
    this.arpBus.connect(this.delay);
    this.arpBus.connect(this.reverb);
  }

  playTrack(name) {
    if (!this.ctx || this.track === name) return;
    const tr = TRACKS[name];
    if (!tr) return;
    this.track = name;
    this.tr = tr;
    this.step = 0;
    this.bar = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.delay.delayTime.value = (60 / tr.bpm) * 0.75;
    this.music.gain.cancelScheduledValues(this.ctx.currentTime);
    this.music.gain.setTargetAtTime(this.musicVol * (this.muted ? 0 : 1), this.ctx.currentTime, 0.4);
    this.melodySeed = Math.random() * 1000;
    if (!this.timer) this.timer = setInterval(() => this.schedule(), 25);
  }

  stopMusic() {
    this.track = null;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  setIntensity(v) { this.intensity = v; }

  schedule() {
    if (!this.ctx || !this.tr) return;
    const tr = this.tr;
    const sixteenth = 60 / tr.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.15) {
      this.playStep(this.step, this.nextTime, sixteenth);
      this.nextTime += sixteenth;
      this.step++;
    }
  }

  playStep(step, t, dur) {
    const tr = this.tr;
    const s = step % 16;
    const bar = Math.floor(step / 16);
    const [root, q] = tr.chords[bar % tr.chords.length];
    const chord = QUAL[q];
    const ctx = this.ctx;
    const section = Math.floor(bar / 8) % 4; // 0 intro-ish, then build
    // pad at bar start
    if (s === 0) this.pad(root, chord, t, dur * 16);
    // drums
    if (tr.drums) {
      const four = tr.drums === 'four';
      if (four ? s % 4 === 0 : s === 0 || s === 10) this.kick(t);
      if (s === 4 || s === 12) this.snare(t);
      if (section > 0 || four) {
        if (s % 2 === 0) this.hat(t, s % 4 === 2 ? 0.09 : 0.05, s % 4 === 2 ? 0.12 : 0.03);
        else if (four && section > 1) this.hat(t, 0.025, 0.02);
      }
      if (s === 14 && bar % 4 === 3) this.snare(t, 0.5);
    }
    // bass
    const bassNote = root - 12;
    if (tr.bass === 'eighths' && s % 2 === 0) this.bass(bassNote + (s === 14 ? 7 : 0), t, dur * 1.7);
    else if (tr.bass === 'octave' && s % 2 === 0) this.bass(bassNote + (s % 4 === 2 ? 12 : 0), t, dur * 1.6);
    else if (tr.bass === 'whole' && s === 0) this.bass(bassNote, t, dur * 15, 0.12);
    // arp
    const pat = ARPS[tr.arp];
    const idx = pat[s];
    if (idx >= 0 && (section > 0 || tr.arp === 'slow' || s % 2 === 0)) {
      const oct = Math.floor(idx / chord.length);
      const n = root + 12 + chord[idx % chord.length] + oct * 12;
      this.arp(n, t, dur * 0.9);
    }
    // lead melody (generative, pentatonic)
    if (tr.lead && section >= 2 && s % 4 === 0) {
      const h = Math.sin((bar * 16 + s) * 12.9898 + this.melodySeed) * 43758.5453;
      const r = h - Math.floor(h);
      if (r > 0.35) {
        const n = root + 24 + PENTA[Math.floor(r * PENTA.length)] - (q.startsWith('min') ? 0 : 0);
        this.lead(n, t, dur * (r > 0.8 ? 8 : 4));
      }
    }
    void ctx;
  }

  pad(root, chord, t, len) {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(600, t);
    f.frequency.linearRampToValueAtTime(1600, t + len * 0.5);
    f.frequency.linearRampToValueAtTime(700, t + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.5);
    g.gain.setValueAtTime(0.05, t + len - 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t + len + 0.4);
    f.connect(g).connect(this.padBus);
    for (const iv of chord) {
      for (const det of [-9, 9]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = midi(root + iv);
        o.detune.value = det;
        o.connect(f);
        o.start(t);
        o.stop(t + len + 0.5);
      }
    }
  }

  kick(t) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    o.connect(g).connect(this.music);
    o.start(t);
    o.stop(t + 0.45);
    // sidechain duck on pads
    this.padBus.gain.cancelScheduledValues(t);
    this.padBus.gain.setValueAtTime(0.15, t);
    this.padBus.gain.linearRampToValueAtTime(0.5, t + 0.25);
  }

  snare(t, v = 1) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.white;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 1300;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.35 * v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    src.connect(f).connect(g).connect(this.music);
    g.connect(this.reverb);
    src.start(t, Math.random());
    src.stop(t + 0.25);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(200, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.1);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.25 * v, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(og).connect(this.music);
    o.start(t);
    o.stop(t + 0.15);
  }

  hat(t, v, len) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.white;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 8000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(f).connect(g).connect(this.music);
    src.start(t, Math.random());
    src.stop(t + len + 0.02);
  }

  bass(n, t, len, v = 0.16) {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 6;
    f.frequency.setValueAtTime(180, t);
    f.frequency.exponentialRampToValueAtTime(900, t + 0.02);
    f.frequency.exponentialRampToValueAtTime(220, t + Math.min(len, 0.25));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    f.connect(g).connect(this.music);
    for (const [type, mul, det] of [['sawtooth', 1, -6], ['square', 0.5, 0]]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = midi(n) * mul;
      o.detune.value = det;
      o.connect(f);
      o.start(t);
      o.stop(t + len + 0.05);
    }
  }

  arp(n, t, len) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = midi(n);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(3200, t);
    f.frequency.exponentialRampToValueAtTime(900, t + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.045, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    o.connect(f).connect(g).connect(this.arpBus);
    o.start(t);
    o.stop(t + len + 0.02);
  }

  lead(n, t, len) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = midi(n);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.5;
    const lg = ctx.createGain();
    lg.gain.value = 6;
    lfo.connect(lg).connect(o.detune);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.04, t + 0.03);
    g.gain.setValueAtTime(0.04, t + len * 0.7);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    o.connect(f).connect(g).connect(this.music);
    g.connect(this.delay);
    g.connect(this.reverb);
    o.start(t); lfo.start(t);
    o.stop(t + len + 0.05); lfo.stop(t + len + 0.05);
  }

  setVolumes(music, sfx) {
    this.musicVol = music;
    this.sfxVol = sfx;
    if (!this.ctx) return;
    this.music.gain.setTargetAtTime(music, this.ctx.currentTime, 0.1);
    this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.1);
  }

  setMuted(m) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  duck(on) {
    if (!this.ctx) return;
    this.music.gain.setTargetAtTime(this.musicVol * (on ? 0.35 : 1), this.ctx.currentTime, 0.3);
  }
}
