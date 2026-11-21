// One-shot sounds made from tones and noise: gunshots, punches, crashes, explosions, splashes,
// horns, cash, checkpoints, menu clicks and the mission jingles.

export class SoundEffects {
  constructor(engine) {
    this.engine = engine;
  }

  gunshot(weapon, volume = 1, pan = 0) {
    const e = this.engine;
    const smg = weapon === 'smg';
    e.burst({ duration: smg ? 0.09 : 0.16, gain: 0.55 * volume, filter: 'highpass', frequency: 500, pan });
    e.burst({ duration: smg ? 0.12 : 0.22, gain: 0.35 * volume, filter: 'lowpass', frequency: 2400, endFrequency: 300, pan });
    e.tone({ type: 'sine', frequency: smg ? 160 : 130, endFrequency: 45, duration: 0.12, gain: 0.45 * volume, pan });
  }

  punch(volume = 1) {
    this.engine.tone({ type: 'sine', frequency: 110, endFrequency: 50, duration: 0.11, gain: 0.5 * volume });
    this.engine.burst({ duration: 0.06, gain: 0.25 * volume, filter: 'lowpass', frequency: 900 });
  }

  crash(speed, pan = 0) {
    const volume = Math.min(1, speed / 18);
    this.engine.burst({ duration: 0.35, gain: 0.6 * volume, filter: 'lowpass', frequency: 1400, endFrequency: 200, pan });
    this.engine.tone({ type: 'square', frequency: 190, endFrequency: 70, duration: 0.25, gain: 0.12 * volume, pan });
    this.engine.burst({ duration: 0.18, gain: 0.25 * volume, filter: 'highpass', frequency: 3500, when: 0.02, pan });
  }

  explosion(volume = 1, pan = 0) {
    this.engine.burst({ duration: 1.6, gain: 0.9 * volume, filter: 'lowpass', frequency: 1800, endFrequency: 90, pan });
    this.engine.tone({ type: 'sine', frequency: 70, endFrequency: 28, duration: 1.2, gain: 0.8 * volume, pan });
    this.engine.burst({ duration: 0.5, gain: 0.3 * volume, filter: 'highpass', frequency: 2500, when: 0.05, pan });
  }

  splash() {
    this.engine.burst({ duration: 0.9, gain: 0.5, filter: 'bandpass', frequency: 600, endFrequency: 250, q: 0.7 });
  }

  breakProp(kind) {
    if (kind === 'lamp') this.engine.tone({ type: 'triangle', frequency: 420, endFrequency: 180, duration: 0.5, gain: 0.18 });
    this.engine.burst({ duration: 0.25, gain: 0.3, filter: 'highpass', frequency: 2600 });
  }

  horn(duration = 0.45, volume = 1, pan = 0) {
    for (const frequency of [392, 494]) this.engine.tone({ type: 'square', frequency, duration, gain: 0.06 * volume, attack: 0.02, pan });
  }

  cash() {
    this.engine.tone({ type: 'sine', frequency: 1318, duration: 0.12, gain: 0.18 });
    this.engine.tone({ type: 'sine', frequency: 1760, duration: 0.25, gain: 0.18, when: 0.08 });
  }

  checkpoint() {
    this.engine.tone({ type: 'triangle', frequency: 988, duration: 0.15, gain: 0.25 });
    this.engine.tone({ type: 'triangle', frequency: 1480, duration: 0.2, gain: 0.2, when: 0.07 });
  }

  click() {
    this.engine.tone({ type: 'sine', frequency: 880, duration: 0.05, gain: 0.12 });
  }

  select() {
    this.engine.tone({ type: 'triangle', frequency: 660, endFrequency: 990, duration: 0.12, gain: 0.16 });
  }

  wantedUp() {
    this.engine.tone({ type: 'square', frequency: 740, duration: 0.09, gain: 0.07 });
    this.engine.tone({ type: 'square', frequency: 988, duration: 0.12, gain: 0.07, when: 0.1 });
  }

  passed() {
    const notes = [523, 659, 784, 1046, 1318];
    notes.forEach((frequency, index) => this.engine.tone({ type: 'triangle', frequency, duration: 0.5, gain: 0.2, when: index * 0.11 }));
    this.engine.tone({ type: 'sawtooth', frequency: 261, duration: 1.2, gain: 0.05, when: 0.44 });
  }

  failed() {
    [392, 330, 262].forEach((frequency, index) => this.engine.tone({ type: 'triangle', frequency, duration: 0.45, gain: 0.2, when: index * 0.22 }));
  }

  wasted() {
    this.engine.tone({ type: 'sawtooth', frequency: 220, endFrequency: 55, duration: 2.2, gain: 0.12 });
    this.engine.burst({ duration: 2, gain: 0.15, filter: 'lowpass', frequency: 500, endFrequency: 60 });
  }
}
