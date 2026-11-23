// Procedural radio: a look-ahead step sequencer playing three original stations (Brisa FM's
// dusk synth-pop, Radio Mango's tropical groove, Wavelength's lo-fi beach beats) plus the
// title theme. Drums, bass, chords and lead are all synthesized.

const NOTE = (name) => {
  const names = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  const match = /^([A-G]#?)(\d)$/.exec(name);
  return 440 * Math.pow(2, (names[match[1]] + (Number(match[2]) - 4) * 12 - 9) / 12);
};

export const STATIONS = [
  {
    name: 'BRISA FM 101.7 — Dusk Synth',
    station: 'BRISA FM 101.7',
    track: 'Neon Undertow',
    artist: 'Coral Static',
    bpm: 104,
    chords: [['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['C3', 'E3', 'G3'], ['G3', 'B3', 'D4']],
    bass: ['A1', 'F1', 'C2', 'G1'],
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1],
    bassRhythm: [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0],
    lead: ['E5', 0, 'D5', 0, 'C5', 0, 'A4', 0, 'C5', 0, 'D5', 'E5', 0, 0, 'G5', 0],
    pad: 'sawtooth',
  },
  {
    name: 'RADIO MANGO 94.3 — Ritmo Tropical',
    station: 'RADIO MANGO 94.3',
    track: 'Malecón a Medianoche',
    artist: 'Los Pelícanos',
    bpm: 96,
    chords: [['D4', 'F4', 'A4'], ['A#3', 'D4', 'F4'], ['F3', 'A3', 'C4'], ['C4', 'E4', 'G4']],
    bass: ['D2', 'A#1', 'F1', 'C2'],
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0],
    hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    bassRhythm: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    lead: ['A4', 0, 'D5', 0, 'F5', 'E5', 0, 'D5', 0, 'C5', 0, 'A4', 0, 0, 'C5', 0],
    pad: 'triangle',
    pluck: true,
  },
  {
    name: 'WAVELENGTH 88.1 — Lo-fi Beach',
    station: 'WAVELENGTH 88.1',
    track: 'Low Tide Tapes',
    artist: 'Saltwater Kid',
    bpm: 80,
    chords: [['E3', 'G3', 'B3', 'D4'], ['A3', 'C4', 'E4', 'G4'], ['D3', 'F#3', 'A3', 'C4'], ['G3', 'B3', 'D4', 'F#4']],
    bass: ['E2', 'A1', 'D2', 'G1'],
    kick: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
    bassRhythm: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    lead: [0, 0, 'B4', 0, 0, 0, 'A4', 0, 0, 'G4', 0, 0, 'E4', 0, 0, 0],
    pad: 'sine',
  },
];

const TITLE_THEME = { ...STATIONS[0], name: 'Title', bpm: 92, lead: ['A4', 0, 0, 'C5', 0, 0, 'E5', 0, 'D5', 0, 0, 'C5', 0, 'G4', 0, 0] };

export class MusicPlayer {
  constructor(engine) {
    this.engine = engine;
    this.song = null;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
  }

  play(song) {
    if (this.song === song) return;
    this.song = song;
    this.step = 0;
    this.nextTime = this.engine.ready ? this.engine.now + 0.08 : 0;
    if (!this.timer) this.timer = setInterval(() => this.schedule(), 25);
  }

  playTitle() {
    this.play(TITLE_THEME);
  }

  stop() {
    this.song = null;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  schedule() {
    const e = this.engine;
    if (!this.song || !e.ready) return;
    const song = this.song;
    const sixteenth = 60 / song.bpm / 4;
    // After a long silence (tab hidden, audio just unlocked) restart the clock instead of catching up.
    if (this.nextTime < e.now - 0.25) this.nextTime = e.now + 0.05;
    while (this.nextTime < e.now + 0.12) {
      this.playStep(song, this.step % 16, Math.floor(this.step / 16) % song.chords.length, this.nextTime - e.now, sixteenth);
      this.step += 1;
      this.nextTime += sixteenth;
    }
  }

  playStep(song, step, bar, when, sixteenth) {
    const e = this.engine;
    const bus = e.music;
    if (song.kick[step]) e.tone({ type: 'sine', frequency: 120, endFrequency: 42, duration: 0.24, gain: 0.55, when, bus });
    if (song.snare[step]) {
      e.burst({ duration: 0.14, gain: 0.22, filter: 'highpass', frequency: 1600, when, bus });
      e.tone({ type: 'triangle', frequency: 220, endFrequency: 160, duration: 0.08, gain: 0.12, when, bus });
    }
    if (song.hat[step]) e.burst({ duration: 0.035, gain: step % 4 === 2 ? 0.08 : 0.045, filter: 'highpass', frequency: 7500, when, bus });
    if (song.bassRhythm[step]) e.tone({ type: 'sawtooth', frequency: NOTE(song.bass[bar]), duration: sixteenth * 1.6, gain: 0.13, when, bus });
    if (step === 0 || (song.pluck && step % 4 === 2)) {
      for (const note of song.chords[bar]) {
        e.tone({ type: song.pad, frequency: NOTE(note), duration: song.pluck ? sixteenth * 2.5 : sixteenth * 15, gain: song.pluck ? 0.06 : 0.035, attack: song.pluck ? 0.005 : 0.25, when, bus });
      }
    }
    const lead = song.lead[step];
    if (lead && bar % 2 === 1) e.tone({ type: 'square', frequency: NOTE(lead), duration: sixteenth * 1.8, gain: 0.035, when, bus });
  }
}
