// Story dialogue at the bottom of the screen: portrait, speaker name and a typewriter line.
// Lines advance on E or Enter (or by themselves), and the whole exchange resolves a promise.
import { CAST } from '../missions/cast.js';
import { drawPortrait } from './portraits.js';

const CHARS_PER_SECOND = 48;

export class DialogueBox {
  constructor(events) {
    this.events = events;
    this.box = document.getElementById('dialogue-box');
    this.portrait = document.getElementById('dialogue-portrait');
    this.name = document.getElementById('dialogue-name');
    this.text = document.getElementById('dialogue-text');
    this.hint = document.getElementById('dialogue-hint');
    this.queue = [];
    this.current = null;
    this.shown = 0;
    this.hold = 0;
    this.done = null;
    this.autoAdvance = false;
  }

  get active() {
    return this.current !== null;
  }

  /** Plays lines [[speaker, text], ...]; resolves when the last one is dismissed. */
  play(lines, { auto = false } = {}) {
    this.queue = lines.map(([speaker, text]) => ({ speaker, text }));
    this.autoAdvance = auto;
    this.hint.textContent = auto ? '' : 'E / Enter to continue';
    return new Promise((resolve) => {
      this.done = resolve;
      this.next();
    });
  }

  next() {
    this.current = this.queue.shift() ?? null;
    if (!this.current) {
      this.box.classList.add('hidden');
      const done = this.done;
      this.done = null;
      if (done) done();
      return;
    }
    const person = CAST[this.current.speaker] ?? CAST.kai;
    this.box.classList.remove('hidden');
    this.box.style.animation = 'none';
    void this.box.offsetWidth;
    this.box.style.animation = '';
    this.name.textContent = person.name;
    this.name.style.color = person.color;
    drawPortrait(this.portrait, this.current.speaker);
    this.shown = 0;
    this.hold = 0;
    this.text.textContent = '';
    this.events.emit('dialogueLine', { speaker: this.current.speaker });
  }

  /** Shows the whole current line at once (screenshot scenes). */
  reveal() {
    if (!this.current) return;
    this.shown = this.current.text.length;
    this.text.textContent = this.current.text;
  }

  skip() {
    this.queue = [];
    this.next();
  }

  update(dt, input) {
    if (!this.current) return;
    const length = this.current.text.length;
    if (this.shown < length) {
      this.shown = Math.min(length, this.shown + dt * CHARS_PER_SECOND);
      this.text.textContent = this.current.text.slice(0, Math.floor(this.shown));
    } else {
      this.hold += dt;
    }
    const pressed = input && (input.wasPressed('interact') || input.wasPressed('confirm'));
    if (pressed) {
      input.consume('interact');
      input.consume('confirm');
      if (this.shown < length) this.reveal();
      else this.next();
    } else if (this.hold > (this.autoAdvance ? 1.6 : 6) + length * 0.02) {
      this.next();
    }
  }
}
