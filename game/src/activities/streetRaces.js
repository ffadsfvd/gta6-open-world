// Side races: the Harbor Loop around Old Port and Mercado, and the Glasswater Circuit through
// downtown. Start one from its flag in any car; win to take the purse.
import { race } from '../missions/missionSteps.js';
import { OUTFITS } from '../characters/appearance.js';

export const STREET_RACES = [
  {
    id: 'harborLoop',
    title: 'Harbor Loop',
    purse: 600,
    start: { x: -280, z: 241.75, yaw: Math.PI / 2 },
    route: [
      { x: -240, z: 240 }, { x: -160, z: 240 }, { x: -80, z: 240 }, { x: 0, z: 240 }, { x: 80, z: 240 }, { x: 160, z: 240 },
      { x: 160, z: 160 }, { x: 160, z: 80 }, { x: 80, z: 80 }, { x: 0, z: 80 }, { x: -80, z: 80 }, { x: -160, z: 80 },
      { x: -240, z: 80 }, { x: -240, z: 160 }, { x: -240, z: 240 },
    ],
    rivals: [
      { type: 'muscle', paint: '#06d6a0', skill: 0.82 },
      { type: 'sedan', paint: '#ef476f', skill: 0.8 },
      { type: 'compact', paint: '#118ab2', skill: 0.84 },
    ],
  },
  {
    id: 'glasswaterCircuit',
    title: 'Glasswater Circuit',
    purse: 900,
    start: { x: -200, z: -158.25, yaw: Math.PI / 2 },
    route: [
      { x: -160, z: -160 }, { x: -80, z: -160 }, { x: 0, z: -160 }, { x: 80, z: -160 },
      { x: 80, z: -240 }, { x: 80, z: -320 }, { x: 0, z: -320 }, { x: -80, z: -320 }, { x: -160, z: -320 },
      { x: -160, z: -240 }, { x: -160, z: -160 }, { x: -80, z: -160 },
    ],
    rivals: [
      { type: 'sports', paint: '#ffd166', skill: 0.86 },
      { type: 'muscle', paint: '#073b4c', skill: 0.84 },
      { type: 'sports', paint: '#f8f9fa', skill: 0.83 },
    ],
  },
];

export function raceMission(spec) {
  return {
    id: spec.id,
    title: spec.title,
    reward: spec.purse,
    steps: () => [race(spec.route, spec.rivals.map((rival) => ({ ...rival, outfit: OUTFITS.gang })), spec.title)],
    onPass(game) {
      game.progress.bump('racesWon');
    },
  };
}
