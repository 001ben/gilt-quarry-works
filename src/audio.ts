export class GameAudio {
  context: AudioContext | null = null;
  muted = false;
  private engine: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private lastCoin = 0;
  start() {
    if (!this.context) {
      this.context = new AudioContext();
      this.engine = this.context.createOscillator();
      this.engine.type = "triangle";
      this.gain = this.context.createGain();
      this.gain.gain.value = 0;
      this.engine.connect(this.gain);
      this.gain.connect(this.context.destination);
      this.engine.start();
    }
    void this.context.resume();
  }
  update(speed: number, paused: boolean) {
    if (!this.context || !this.engine || !this.gain) return;
    this.engine.frequency.setTargetAtTime(
      36 + speed * 13,
      this.context.currentTime,
      0.1,
    );
    this.gain.gain.setTargetAtTime(
      this.muted || paused ? 0 : 0.012 + speed * 0.004,
      this.context.currentTime,
      0.08,
    );
  }
  tone(frequency: number, duration: number, delay = 0) {
    if (!this.context || this.muted) return;
    const t = this.context.currentTime + delay,
      o = this.context.createOscillator(),
      g = this.context.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(frequency, t);
    o.frequency.exponentialRampToValueAtTime(frequency * 1.3, t + duration);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.045, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g);
    g.connect(this.context.destination);
    o.start(t);
    o.stop(t + duration + 0.02);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  coin() {
    if (performance.now() - this.lastCoin < 75) return;
    this.lastCoin = performance.now();
    this.tone(650 + Math.random() * 150, 0.13);
  }
  payment(ratio: number) {
    this.tone(280 + ratio * 400, 0.09);
    this.tone(420 + ratio * 500, 0.08, 0.055);
  }
  upgrade() {
    [440, 554, 659, 880].forEach((f, i) => this.tone(f, 0.22, i * 0.075));
  }
}
