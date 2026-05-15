class AudioSynthesizer {
  ctx: AudioContext | null;

  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      // @ts-ignore
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  playCardFlip() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  // ─── Rich Bat Crack ────────────────────────────────────────────────────────
  private playBatCrack(power: 'hard' | 'medium' | 'soft') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // Transient click (impact)
    const click = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    click.type = 'square';
    const freq = power === 'hard' ? 900 : power === 'medium' ? 700 : 500;
    click.frequency.setValueAtTime(freq, t);
    click.frequency.exponentialRampToValueAtTime(80, t + 0.06);
    clickGain.gain.setValueAtTime(power === 'hard' ? 1.0 : 0.7, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    click.connect(clickGain);
    clickGain.connect(this.ctx.destination);
    click.start(t);
    click.stop(t + 0.08);

    // Body thud resonance
    const thud = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(160, t);
    thud.frequency.exponentialRampToValueAtTime(60, t + 0.25);
    thudGain.gain.setValueAtTime(0.4, t + 0.02);
    thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    thud.connect(thudGain);
    thudGain.connect(this.ctx.destination);
    thud.start(t + 0.02);
    thud.stop(t + 0.3);
  }

  // ─── Crowd Roar ────────────────────────────────────────────────────────────
  private playCrowdRoar(intensity: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const duration = 1.5 + intensity * 0.5;

    // White noise through band-pass for crowd texture
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.15;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const bpf = this.ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.value = 400 + intensity * 200;
    bpf.Q.value = 0.5;

    const crowdGain = this.ctx.createGain();
    crowdGain.gain.setValueAtTime(0, t);
    crowdGain.gain.linearRampToValueAtTime(intensity * 0.4, t + 0.3);
    crowdGain.gain.linearRampToValueAtTime(intensity * 0.3, t + duration - 0.3);
    crowdGain.gain.linearRampToValueAtTime(0, t + duration);

    noise.connect(bpf);
    bpf.connect(crowdGain);
    crowdGain.connect(this.ctx.destination);
    noise.start(t);
    noise.stop(t + duration);
  }

  // ─── Stumps Rattle ─────────────────────────────────────────────────────────
  private playStumpsRattle() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // 3 wooden clatters
    [0, 0.08, 0.18].forEach((delay, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800 - i * 120, t + delay);
      osc.frequency.exponentialRampToValueAtTime(100, t + delay + 0.15);
      gain.gain.setValueAtTime(0.6, t + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(t + delay);
      osc.stop(t + delay + 0.2);
    });

    // Low thump for ball-pitch contact
    const thump = this.ctx.createOscillator();
    const thumpGain = this.ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(120, t);
    thump.frequency.exponentialRampToValueAtTime(40, t + 0.3);
    thumpGain.gain.setValueAtTime(0.5, t);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    thump.connect(thumpGain);
    thumpGain.connect(this.ctx.destination);
    thump.start(t);
    thump.stop(t + 0.35);
  }

  // ─── Rising celebration ────────────────────────────────────────────────────
  private playRisingCelebration(runs: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = runs === 6
      ? [523, 659, 784, 1047, 1319] // C E G C E
      : [523, 659, 784, 1047];      // C E G C

    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.3, t + i * 0.08 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(t + i * 0.08);
      osc.stop(t + i * 0.08 + 0.25);
    });
  }

  // ─── Miss whoosh ───────────────────────────────────────────────────────────
  private playWhoosh() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const hpf = this.ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 2000;

    const whooshGain = this.ctx.createGain();
    whooshGain.gain.setValueAtTime(0, t);
    whooshGain.gain.linearRampToValueAtTime(0.25, t + 0.1);
    whooshGain.gain.linearRampToValueAtTime(0, t + 0.5);

    noise.connect(hpf);
    hpf.connect(whooshGain);
    whooshGain.connect(this.ctx.destination);
    noise.start(t);
    noise.stop(t + 0.5);
  }

  // ─── Public API ────────────────────────────────────────────────────────────
  playScoreSound(runs: number) {
    this.init();
    if (!this.ctx) return;

    if (runs === 0) {
      this.playWicket();
      return;
    }

    const power = runs === 6 ? 'hard' : runs === 4 ? 'medium' : 'soft';
    this.playBatCrack(power);

    const crowdIntensity = runs === 6 ? 1.0 : runs === 4 ? 0.7 : runs === 2 ? 0.4 : 0.2;
    setTimeout(() => { this.init(); this.playCrowdRoar(crowdIntensity); }, 80);
    setTimeout(() => { this.init(); this.playRisingCelebration(runs); }, 120);
  }

  playWicket() {
    this.init();
    if (!this.ctx) return;
    this.playStumpsRattle();
    this.playWhoosh();
  }

  playMiss() {
    this.init();
    if (!this.ctx) return;
    this.playWhoosh();
    // Gentle crowd "oooh"
    setTimeout(() => { this.init(); this.playCrowdRoar(0.1); }, 100);
  }
}

export const audio = new AudioSynthesizer();
