// Story 3 — Taco Tuesday. Crane's crew is scaring the lunch crowd away from Lou's taco truck
// in Mercado Plaza. Kai runs them off for good.
import { PLACES } from '../../world/places.js';
import { call, eliminate, goTo, talk } from '../missionSteps.js';

export default {
  id: 'tacoTuesday',
  title: 'Taco Tuesday',
  giver: 'lou',
  reward: 2000,
  story: true,
  steps: () => [
    talk([
      ['lou', "Crane's boys came back to my truck. They knocked over the salsa and told my customers to eat somewhere else."],
      ['lou', "I'm too old to chase them, Kai. You're not."],
    ]),
    goTo({ x: PLACES.plaza.x - 8, z: PLACES.plaza.z - 6 }, 'Go to *Mercado Plaza*.', { radius: 16 }),
    call((ctx) => {
      const p = PLACES.plaza;
      ctx.vars.crew = ctx.runner.spawnCrew([
        { x: p.x - 4, z: p.z - 14, weapon: 'pistol' },
        { x: p.x + 6, z: p.z - 10, weapon: 'fists', health: 90 },
        { x: p.x - 12, z: p.z + 2, weapon: 'pistol' },
        { x: p.x + 10, z: p.z + 4, weapon: 'fists', health: 90 },
      ]);
      for (const member of ctx.vars.crew) member.brain.provoke();
    }),
    talk([['thug', "Look who it is, Lou's little nephew! Crane says hi."]], { freeze: false }),
    eliminate('crew', "Take out *Crane's crew*."),
    talk([
      ['lou', "That's my boy! Here, cash and a plate of al pastor."],
      ['lou', 'I called my friend at Bayside Arms. He will sell you body armour now.'],
    ]),
  ],
  onPass(game) {
    game.progress.unlock('armour');
    game.player.character.armour = Math.max(game.player.character.armour, 50);
    game.notifications.toast('Body armour unlocked at Bayside Arms', '', 5);
  },
};
