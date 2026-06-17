// Synthesized sound effects using Web Audio API. No asset downloads.
// iOS Safari requires a user gesture to unlock the audio context;
// call `unlock()` from a tap handler before playing anything.

class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.unlocked = false;
    this.enabled = true;
  }

  _ensureCtx() {
    if (this.ctx) return;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) {
      this.enabled = false;
      return;
    }
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.ctx.destination);
  }

  // Call from a user-gesture handler (tap, click, keydown) to satisfy
  // browser autoplay policies — especially on iOS.
  unlock() {
    this._ensureCtx();
    if (!this.ctx || this.unlocked) return;
    // Silent dummy buffer kicks the context awake on iOS.
    const buf = this.ctx.createBuffer(1, 1, 22050);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    src.start(0);
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.unlocked = true;
  }

  // One-shot oscillator note with envelope.
  // freq: starting Hz. dur: seconds. type: oscillator type.
  // vol: 0..1. slide: end-Hz multiplier (1 = no slide).
  _tone(freq, dur, type = 'sine', vol = 0.2, slide = 1) {
    if (!this.enabled || !this.ctx || !this.unlocked) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide !== 1) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, freq * slide),
        t + dur
      );
    }
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  // Filtered noise burst — used for crunchy bites and stomps.
  _noise(dur = 0.15, vol = 0.2, filterFreq = 800, filterType = 'lowpass') {
    if (!this.enabled || !this.ctx || !this.unlocked) return;
    const t = this.ctx.currentTime;
    const bufSize = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  // ---------- Public effects ----------
  chompPlant() {
    this._noise(0.08, 0.25, 1200, 'lowpass');
    this._tone(380, 0.07, 'sawtooth', 0.1, 0.5);
  }

  chompCritter() {
    this._noise(0.12, 0.3, 800);
    this._tone(220, 0.12, 'square', 0.15, 0.4);
  }

  chompBig() {
    this._noise(0.2, 0.35, 500);
    this._tone(100, 0.25, 'sawtooth', 0.3, 0.5);
    setTimeout(() => this._tone(70, 0.2, 'sawtooth', 0.25, 0.4), 60);
  }

  roar() {
    this._tone(90, 0.55, 'sawtooth', 0.35, 2.2);
    this._noise(0.5, 0.18, 400);
  }

  stageUp() {
    // Ascending arpeggio C5 -> E5 -> G5
    this._tone(523, 0.13, 'triangle', 0.22);
    setTimeout(() => this._tone(659, 0.13, 'triangle', 0.22), 110);
    setTimeout(() => this._tone(784, 0.2, 'triangle', 0.28), 220);
    setTimeout(() => this.roar(), 400);
  }

  win() {
    // Triumphant fanfare
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((f, i) => {
      setTimeout(() => this._tone(f, 0.22, 'triangle', 0.3), i * 140);
    });
    setTimeout(() => this._tone(1568, 0.6, 'triangle', 0.35), 700);
    setTimeout(() => this.roar(), 850);
  }

  powerup() {
    // Sparkly ascending
    this._tone(700, 0.08, 'sine', 0.2, 1.3);
    setTimeout(() => this._tone(950, 0.1, 'sine', 0.2, 1.3), 60);
    setTimeout(() => this._tone(1300, 0.14, 'sine', 0.22, 1.3), 130);
  }

  powerupExpire() {
    this._tone(800, 0.15, 'sine', 0.15, 0.5);
  }

  gameOver() {
    this._tone(220, 0.3, 'sawtooth', 0.25, 0.5);
    setTimeout(() => this._tone(150, 0.45, 'sawtooth', 0.25, 0.4), 220);
  }

  step() {
    // Subtle thump for giant-stage footsteps
    this._noise(0.08, 0.18, 200);
  }

  eggCrack() {
    // Sharp short tick + tiny noise burst
    this._noise(0.06, 0.22, 3000, 'highpass');
    this._tone(800, 0.05, 'square', 0.12, 0.6);
  }

  eggHatch() {
    // Triumphant little flourish: pop + ascending chirp
    this._noise(0.1, 0.25, 1500);
    setTimeout(() => this._tone(700, 0.1, 'triangle', 0.2, 1.8), 60);
    setTimeout(() => this._tone(1100, 0.15, 'triangle', 0.22, 1.5), 160);
    setTimeout(() => this._tone(1500, 0.2, 'triangle', 0.24, 1.4), 280);
  }

  babyChirp() {
    // High-pitched short blip
    const base = 1200 + Math.random() * 400;
    this._tone(base, 0.07, 'triangle', 0.13, 1.6);
    setTimeout(() => this._tone(base * 1.4, 0.05, 'triangle', 0.1), 70);
  }

  carHonk() {
    // Two-tone panicked honk
    this._tone(420, 0.12, 'square', 0.15);
    setTimeout(() => this._tone(360, 0.16, 'square', 0.15), 130);
  }

  crunchMetal() {
    // Harsh metallic crunch: bright noise + a low crumple tone
    this._noise(0.22, 0.35, 4000, 'highpass');
    this._noise(0.18, 0.3, 700);
    this._tone(90, 0.25, 'sawtooth', 0.28, 0.4);
  }

  crumble() {
    // Deep rumble + gritty noise of a building coming down
    this._tone(60, 0.6, 'sawtooth', 0.3, 0.6);
    this._noise(0.5, 0.3, 500);
    setTimeout(() => this._noise(0.35, 0.22, 900), 200);
  }

  plasmaBreath() {
    this._tone(180, 0.3, 'sawtooth', 0.18, 4.0);
    setTimeout(() => {
      this._noise(0.5, 0.32, 2200, 'bandpass');
      this._tone(320, 0.5, 'sawtooth', 0.3, 0.4);
      this._tone(140, 0.55, 'square', 0.22, 0.5);
    }, 280);
  }

  abilityRoar() {
    // Massive falling roar
    this._tone(220, 0.7, 'sawtooth', 0.35, 0.35);
    this._noise(0.6, 0.25, 500);
    setTimeout(() => this._tone(120, 0.5, 'sawtooth', 0.28, 0.5), 200);
  }

  abilityCharge() {
    // Thundering hoofbeats — repeated low thumps
    for (let i = 0; i < 5; i++) {
      setTimeout(() => this._noise(0.08, 0.3, 180), i * 90);
    }
    this._tone(70, 0.6, 'sawtooth', 0.25, 0.7);
  }

  abilitySweep() {
    // Whooshing tail swipe
    this._noise(0.35, 0.3, 1200, 'bandpass');
    this._tone(180, 0.25, 'sine', 0.18, 0.4);
  }

  abilityPounce() {
    // Quick upward "whip" + landing thud
    this._tone(450, 0.15, 'sine', 0.2, 2.0);
    setTimeout(() => this._noise(0.12, 0.35, 300), 200);
  }

  abilityStomp() {
    // Earth-shaking thud
    this._tone(50, 0.4, 'sawtooth', 0.4, 0.5);
    this._noise(0.4, 0.35, 150);
  }

  abilityFrenzy() {
    // Frantic rising chime
    this._tone(440, 0.1, 'sawtooth', 0.18, 1.8);
    setTimeout(() => this._tone(660, 0.12, 'sawtooth', 0.2, 1.8), 80);
    setTimeout(() => this._tone(880, 0.18, 'sawtooth', 0.22, 1.5), 170);
  }
}

export const audio = new AudioManager();
