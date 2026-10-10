// Tiny chiptune sound effects synthesised with WebAudio — no asset files needed.

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  muted = false;

  unlock() {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.45;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, len);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.45;
    return this.muted;
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.1, to?: number, delay = 0) {
    const c = this.ctx;
    if (!c || !this.master) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, freq = 1500, delay = 0) {
    const c = this.ctx;
    if (!c || !this.master || !this.noiseBuf) return;
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  shoot() { this.tone(980, 0.07, 'square', 0.05, 420); }
  hit() { this.noise(0.06, 0.18, 2500); this.tone(220, 0.05, 'square', 0.05, 110); }
  die() { this.noise(0.25, 0.2, 900); this.tone(440, 0.25, 'square', 0.08, 55); }
  hurt() { this.tone(180, 0.3, 'sawtooth', 0.14, 45); this.noise(0.2, 0.15, 600); }
  dash() { this.noise(0.12, 0.1, 4000); }
  swing() { this.noise(0.08, 0.08, 3000); }
  fireball() { this.tone(260, 0.35, 'sawtooth', 0.06, 90); }
  summon() { [196, 233, 277, 330].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.08, f * 0.5, i * 0.12)); }
  spawn() { this.tone(120, 0.3, 'triangle', 0.07, 400); }
  pickup() { [660, 880, 1320].forEach((f, i) => this.tone(f, 0.08, 'square', 0.06, undefined, i * 0.06)); }
  wave() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.15, 'square', 0.07, undefined, i * 0.1)); }
  gameOver() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.12, undefined, i * 0.25)); }
  click() { this.tone(1200, 0.04, 'square', 0.05); }
  buzz() { this.tone(110, 0.25, 'sawtooth', 0.12, 100); }
  slash() { this.noise(0.1, 0.12, 5000); this.tone(700, 0.08, 'square', 0.04, 300); }
  parry() { this.tone(1500, 0.08, 'square', 0.05, 2400); }
  equip() { this.tone(600, 0.05, 'square', 0.04, 900); }
  nova() {
    this.noise(0.7, 0.3, 700);
    this.tone(90, 0.7, 'sawtooth', 0.14, 30);
    [523, 784, 1046, 1568].forEach((f, i) => this.tone(f, 0.14, 'square', 0.05, undefined, i * 0.04));
  }
  novaReady() { [784, 1175, 1568].forEach((f, i) => this.tone(f, 0.1, 'triangle', 0.08, undefined, i * 0.08)); }
  boing() { this.tone(300, 0.15, 'square', 0.06, 900); }
  stab() { this.tone(1400, 0.05, 'square', 0.04, 700); this.noise(0.05, 0.06, 6000); }
  slam() { this.noise(0.5, 0.35, 400); this.tone(70, 0.45, 'sine', 0.2, 30); }
  blink() { this.tone(300, 0.2, 'triangle', 0.07, 1800); }
  inhale() { this.noise(0.4, 0.06, 1200); this.tone(200, 0.4, 'triangle', 0.04, 500); }
  charge() { this.tone(180, 1.1, 'sawtooth', 0.05, 900); }
  lock() { this.tone(1600, 0.06, 'square', 0.06); this.tone(1600, 0.06, 'square', 0.06, undefined, 0.1); }
  laser() {
    this.tone(90, 0.6, 'sawtooth', 0.12, 70);
    this.noise(0.6, 0.15, 3000);
    this.tone(1800, 0.6, 'square', 0.03, 1500);
  }
  tears() { this.tone(700, 0.25, 'triangle', 0.07, 200); this.noise(0.2, 0.08, 2500); }
  siren() { [0, 1, 2].forEach((i) => this.tone(440, 0.3, 'square', 0.07, 880, i * 0.35)); }
  bossDie() { this.noise(1.2, 0.4, 600); this.tone(300, 1.2, 'sawtooth', 0.15, 30); }
  coin() { this.tone(1320, 0.05, 'square', 0.04); this.tone(1760, 0.08, 'square', 0.04, undefined, 0.05); }
  steal() { [600, 500, 700, 450].forEach((f, i) => this.tone(f, 0.07, 'square', 0.05, undefined, i * 0.07)); }
  toss() { this.tone(400, 0.12, 'triangle', 0.06, 200); }
  boom() { this.noise(0.4, 0.3, 800); this.tone(90, 0.3, 'square', 0.1, 40); }
  bite() { this.noise(0.05, 0.1, 3500); this.tone(900, 0.04, 'square', 0.04, 500); }
  buy() { [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.07, 'square', 0.05, undefined, i * 0.05)); }
  gem() { [1568, 2093, 2637].forEach((f, i) => this.tone(f, 0.08, 'triangle', 0.06, undefined, i * 0.05)); }
  immune() { this.tone(2400, 0.06, 'square', 0.04); this.tone(1800, 0.1, 'triangle', 0.05, undefined, 0.04); }
  rebirth() { [392, 523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.09, undefined, i * 0.08)); this.noise(0.6, 0.15, 2000); }
  screech() { this.tone(2400, 0.4, 'sawtooth', 0.06, 1200); this.tone(2600, 0.4, 'square', 0.03, 1500); }
  roar() { this.noise(0.6, 0.25, 500); this.tone(110, 0.6, 'sawtooth', 0.12, 60); }
  howl() { this.tone(500, 0.3, 'triangle', 0.05, 800); }
  glitch() { [880, 220, 1760, 440].forEach((f, i) => this.tone(f, 0.04, 'square', 0.05, undefined, i * 0.04)); this.noise(0.15, 0.08, 6000); }
  growl() { this.tone(90, 0.35, 'sawtooth', 0.07, 70); this.noise(0.3, 0.06, 500); }
  scream() { this.tone(900, 0.5, 'sawtooth', 0.06, 1500); this.tone(950, 0.5, 'square', 0.03, 1400); }
  cackle() { [1100, 1500, 1050, 1600].forEach((f, i) => this.tone(f, 0.05, 'triangle', 0.05, undefined, i * 0.07)); }
  crackle() { this.noise(0.5, 0.06, 7000); this.tone(2000, 0.5, 'square', 0.02, 3000); }
  zap() { this.noise(0.25, 0.22, 5000); this.tone(1800, 0.2, 'sawtooth', 0.07, 150); }
  breath() { this.noise(0.8, 0.14, 1800); this.tone(140, 0.8, 'sawtooth', 0.04, 90); }

  /** The deliberately obnoxious ad jingle. */
  adJingle() {
    this.tone(110, 0.45, 'sawtooth', 0.12, 55);
    [880, 1175, 1397, 1760, 1397, 1760, 2093].forEach((f, i) => this.tone(f, 0.07, 'square', 0.05, undefined, 0.05 + i * 0.07));
  }
}

export const sfx = new Sfx();
