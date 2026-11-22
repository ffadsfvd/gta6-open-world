// The story of Ondaluz Undercurrent in order: seven missions from Kai's homecoming to the
// showdown at Lighthouse Point. Each is offered by its contact once the one before it is passed.
import backInTheSun from './story/01-back-in-the-sun.js';
import paintJob from './story/02-paint-job.js';
import tacoTuesday from './story/03-taco-tuesday.js';
import paperTrail from './story/04-paper-trail.js';
import badgeTrouble from './story/05-badge-trouble.js';
import strandSprint from './story/06-strand-sprint.js';
import undercurrent from './story/07-undercurrent.js';

export const STORYLINE = [backInTheSun, paintJob, tacoTuesday, paperTrail, badgeTrouble, strandSprint, undercurrent];

export function missionById(id) {
  return STORYLINE.find((mission) => mission.id === id) ?? null;
}
