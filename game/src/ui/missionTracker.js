// The mission tracker panel (top left): which mission or job is running (story number or kind),
// its name and giver, stage X of Y with a progress bar and the time limit, the objective, the
// next step, and the live readouts of the step (crew standing, distance, fare, race position).
import { describeMission } from '../missions/missionProgress.js';

const markup = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\*([^*]+)\*/g, '<em>$1</em>');

export class MissionTracker {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      <header class="panel-head"><span class="panel-kicker" data-part="heading"></span><span class="panel-title" data-part="title"></span></header>
      <div class="stage-row"><span class="stage-label" data-part="stage"></span><i class="meter"><b data-part="bar"></b></i><span class="stage-timer hidden" data-part="timer"></span></div>
      <p class="tracker-objective" data-part="objective"></p>
      <p class="tracker-next"><span>NEXT</span><span data-part="next"></span></p>
      <dl class="tracker-status" data-part="status"></dl>`;
    this.parts = Object.fromEntries([...root.querySelectorAll('[data-part]')].map((node) => [node.dataset.part, node]));
    this.last = {};
  }

  /** Writes a part only when its text changed (the HUD refreshes twenty times a second). */
  set(part, html) {
    if (this.last[part] === html) return;
    this.last[part] = html;
    this.parts[part].innerHTML = html;
  }

  update(game) {
    const info = describeMission(game.missions);
    this.root.classList.toggle('hidden', !info);
    if (!info) return;
    this.root.classList.toggle('story', info.story);
    this.set('heading', markup(info.heading.toUpperCase()));
    this.set('title', markup(info.title));
    this.set('stage', `STAGE ${info.stage}/${info.stages}`);
    this.parts.bar.style.width = `${Math.round(Math.max(0.04, info.share) * 100)}%`;
    this.set('objective', markup(info.objective));
    this.set('next', markup(info.next));
    this.set('status', info.status.map(([label, value]) => `<div><dt>${markup(label)}</dt><dd>${markup(value)}</dd></div>`).join(''));
    const timer = this.parts.timer;
    timer.classList.toggle('hidden', info.timeLeft === null);
    if (info.timeLeft !== null) {
      const seconds = Math.max(0, Math.ceil(info.timeLeft));
      this.set('timer', `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`);
      timer.classList.toggle('urgent', seconds <= 10);
    }
  }
}
