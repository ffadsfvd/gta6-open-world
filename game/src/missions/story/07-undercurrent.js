// Story 7 — Undercurrent. Crane's big shipment lands at Lighthouse Point after dark. Kai takes
// out Crane and his crew, outruns half the Ondaluz Bay Police and meets Lou back at the taco truck.
import { PLACES } from '../../world/cityPlan.js';
import { call, eliminate, goTo, loseCops, talk } from '../missionSteps.js';
import { OUTFITS } from '../../characters/appearance.js';

export default {
  id: 'undercurrent',
  title: 'Undercurrent',
  giver: 'lou',
  reward: 10000,
  story: true,
  steps: () => [
    talk([
      ['lou', "Crane's big shipment comes in at Lighthouse Point tonight. Voss sent his own men to guard it."],
      ['lou', 'End this, Kai. For the family. For the whole Strand.'],
      ['kai', 'One last job, Auntie.'],
    ]),
    goTo(PLACES.lighthouse, 'Drive to *Lighthouse Point*.', { radius: 30 }),
    call((ctx) => {
      const p = PLACES.lighthouse;
      ctx.vars.crew = ctx.runner.spawnCrew([
        { x: p.x + 4, z: p.z + 2, weapon: 'smg', health: 260, outfit: OUTFITS.crane, accuracy: 0.5 },
        { x: p.x - 6, z: p.z + 8, weapon: 'pistol' },
        { x: p.x + 9, z: p.z + 12, weapon: 'pistol' },
        { x: p.x - 10, z: p.z - 4, weapon: 'smg', health: 90 },
        { x: p.x + 2, z: p.z + 16, weapon: 'pistol' },
        { x: p.x - 2, z: p.z - 10, weapon: 'fists', health: 100 },
      ]);
      ctx.vars.crew[0].label = 'crane';
      ctx.vars.crane = ctx.vars.crew[0];
    }),
    talk([['crane', 'Moreno! You should have stayed upstate. This coast belongs to me.']], { freeze: false }),
    eliminate('crew', 'Take out *Silas Crane* and his crew.'),
    loseCops('Every cruiser in Ondaluz is coming. *Lose them*!', 4),
    goTo(PLACES.tacoTruck, 'Meet Lou at the *taco truck*.', { radius: 4 }),
    talk([
      ['lou', 'Ay, mijo. Is it over?'],
      ['kai', "Crane's done, and Voss's ledger is on the Gazette's desk by now. The docks are ours again."],
      ['lou', 'Then tomorrow, tacos are on the house. For everyone in Ondaluz.'],
    ]),
  ],
  onPass(game) {
    game.events.emit('storyComplete', {});
  },
};
