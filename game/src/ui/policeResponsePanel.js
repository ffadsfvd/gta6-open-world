// The police response panel (left, from two stars): the units after Kai by call sign (cruisers,
// officers on foot, the Skyhawk helicopter) with distance and what each one's AI is doing, the
// size of the response, a status line and how far along losing them is.
import { pursuitReport } from '../police/pursuitReport.js';

const SHOW_FROM_STARS = 2;
const KIND_ICON = { car: '<i class="unit-icon car"></i>', foot: '<i class="unit-icon foot"></i>', air: '<i class="unit-icon air"></i>' };
/** Behaviours that mean trouble right now get the warning colour. */
const HOT = new Set(['Ramming', 'Boxing in', 'Firing', 'Spotlight on you', 'Roadblock', 'Making an arrest', 'Stopping to arrest']);

export class PoliceResponsePanel {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      <header class="panel-head"><span class="panel-kicker">POLICE RESPONSE</span><span class="panel-title" data-part="summary"></span></header>
      <ol class="unit-list" data-part="units"></ol>
      <p class="police-status" data-part="status"></p>
      <div class="escape-row"><span>OUT OF SIGHT</span><i class="meter"><b data-part="escape"></b></i></div>`;
    this.parts = Object.fromEntries([...root.querySelectorAll('[data-part]')].map((node) => [node.dataset.part, node]));
    this.lastUnits = '';
  }

  update(game) {
    const level = game.wanted.level;
    const shown = level >= SHOW_FROM_STARS;
    this.root.classList.toggle('hidden', !shown);
    if (!shown) return;
    const report = pursuitReport(game);
    const counts = [`${report.cruisers} car${report.cruisers === 1 ? '' : 's'}`];
    if (report.onFoot) counts.push(`${report.onFoot} on foot`);
    if (report.air) counts.push('air');
    this.parts.summary.textContent = counts.join(' · ');
    const rows = report.units.map((unit) => `<li class="${HOT.has(unit.behaviour) ? 'hot' : ''}">${KIND_ICON[unit.kind]}<b>${unit.callSign}</b><span class="unit-distance">${Math.round(unit.distance)} m</span><span class="unit-behaviour">${unit.behaviour}</span></li>`).join('');
    if (rows !== this.lastUnits) {
      this.lastUnits = rows;
      this.parts.units.innerHTML = rows;
    }
    this.parts.status.textContent = report.status;
    this.parts.escape.style.width = `${Math.round(report.escape * 100)}%`;
  }
}
