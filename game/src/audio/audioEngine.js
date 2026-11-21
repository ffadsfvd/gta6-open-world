// The Web Audio graph every sound goes through: master, music and effects buses into a gentle
// compressor, a shared white-noise buffer, and helpers for short enveloped tones and noise.
// The context starts on the first click or key press (browsers require a gesture).

export class AudioEngine {
  constructor() {
    this.context = null;
    this.volumes = { master: 0.8, music: 0.55, sfx: 0.85 };
  }

  /** True once the browser lets the context run (after a real click or key press). */
  get ready() {
    return this.context !== null && this.context.state === 'running';
  }

  /** Creates or resumes the context; call from a user gesture. */
  unlock() {
    if (!this.context) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      this.context = new Context();
      const ctx = this.context;
      this.compressor = ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -16;
      this.compressor.ratio.value = 4;
      this.master = ctx.createGain();
      this.music = ctx.createGain();
      this.sfx = ctx.createGain();
      this.music.connect(this.master);
      this.sfx.connect(this.master);
      this.master.connect(this.compressor);
      this.compressor.connect(ctx.destination);
      this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
      this.applyVolumes();
    }
    if (this.context.state === 'suspended') this.context.resume().catch(() => {});
  }

  setVolumes(volumes) {
    this.volumes = { ...this.volumes, ...volumes };
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.context) return;
    this.master.gain.value = this.volumes.master;
    this.music.gain.value = this.volumes.music;
    this.sfx.gain.value = this.volumes.sfx;
  }

  get now() {
    return this.context ? this.context.currentTime : 0;
  }

  /** A tone with an attack-decay envelope. */
  tone({ type = 'sine', frequency = 440, endFrequency = null, duration = 0.2, gain = 0.2, attack = 0.005, when = 0, bus = null, pan = 0 }) {
    if (!this.ready) return;
    const ctx = this.context;
    const start = this.now + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    if (endFrequency) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    let node = amp;
    if (pan) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      amp.connect(panner);
      node = panner;
    }
    osc.connect(amp);
    node.connect(bus ?? this.sfx);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  /** Filtered noise with an envelope (shots, crashes, splashes, snares). */
  burst({ duration = 0.2, gain = 0.3, filter = 'lowpass', frequency = 1200, endFrequency = null, q = 0.8, when = 0, bus = null, pan = 0 }) {
    if (!this.ready) return;
    const ctx = this.context;
    const start = this.now + when;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const biquad = ctx.createBiquadFilter();
    biquad.type = filter;
    biquad.frequency.setValueAtTime(frequency, start);
    if (endFrequency) biquad.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    biquad.Q.value = q;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(biquad);
    biquad.connect(amp);
    let node = amp;
    if (pan) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      amp.connect(panner);
      node = panner;
    }
    node.connect(bus ?? this.sfx);
    source.start(start, Math.random() * 1.5);
    source.stop(start + duration + 0.05);
  }
}
