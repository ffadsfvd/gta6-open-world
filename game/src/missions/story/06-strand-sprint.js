// Story 6 — Strand Sprint. Dash Ortega, Crane's getaway driver, races Kai around Carmine Strand,
// Lighthouse Street and Glasswater. Win it and Crane's crew loses its swagger.
import { goTo, talk } from '../missionSteps.js';
import { race } from '../raceStep.js';
import { OUTFITS } from '../../characters/appearance.js';

export const STRAND_ROUTE = [
  { x: 240, z: 120 }, { x: 240, z: 40 }, { x: 240, z: -40 }, { x: 240, z: -120 }, { x: 240, z: -200 },
  { x: 240, z: -240 }, { x: 160, z: -240 }, { x: 80, z: -240 }, { x: 0, z: -240 },
  { x: 0, z: -160 }, { x: 0, z: -80 }, { x: 0, z: 0 }, { x: 0, z: 80 },
  { x: 80, z: 80 }, { x: 160, z: 80 }, { x: 240, z: 80 }, { x: 240, z: 120 },
];

export default {
  id: 'strandSprint',
  title: 'Strand Sprint',
  giver: 'juno',
  reward: 3500,
  story: true,
  steps: () => [
    talk([
      ['juno', "Dash Ortega, Crane's getaway driver, keeps telling everyone you drive like a tourist."],
      ['juno', 'He wants a race around the Strand. Win it and half of Crane\'s crew stops believing in him.'],
    ]),
    goTo({ x: 241.75, z: 200 }, 'Get to the *starting line* on Seabreeze Boulevard in a car.', { radius: 7, vehicle: 'any' }),
    race(STRAND_ROUTE, [
      { type: 'muscle', paint: '#ffbe0b', skill: 0.86, outfit: OUTFITS.dash },
      { type: 'sports', paint: '#7209b7', skill: 0.8, outfit: OUTFITS.gang },
    ], 'Strand Sprint'),
    talk([
      ['dash', 'You got lucky, Moreno. Crane will not be.'],
      ['kai', 'Tell him I am coming for the docks.'],
    ]),
  ],
};
