// Story 5 — Badge Trouble. Detective Voss offers to clear Lou's debts if Kai fetches a package
// from the Pier 9 warehouse. It is a setup: two stars and every patrol in Ironwharf the moment
// Kai has it.
import { PLACES } from '../../world/places.js';
import { call, collect, goTo, loseCops, talk } from '../missionSteps.js';

export default {
  id: 'badgeTrouble',
  title: 'Badge Trouble',
  giver: 'voss',
  reward: 3000,
  story: true,
  steps: () => [
    talk([
      ['voss', "Kai Moreno. Relax, I'm not here to arrest you. Not today."],
      ['voss', "There's a package at the Pier 9 warehouse in Ironwharf. Bring it to me and your aunt's debts disappear."],
      ['kai', 'And if I say no?'],
      ['voss', 'Then I remember how much paperwork a parole violation needs. Go.'],
    ]),
    goTo(PLACES.warehouse, 'Go to the *Pier 9 warehouse* in Ironwharf.', { radius: 14 }),
    call((ctx) => {
      ctx.vars.package = { x: PLACES.warehouse.x, z: PLACES.warehouse.z + 3, y: 0.15 };
    }),
    collect('package', 'Grab the *package*.'),
    talk([
      ['voss', 'Good boy. Oh, one more thing: I told my colleagues a dangerous man just robbed Pier 9.'],
      ['kai', 'Voss!'],
    ], { freeze: false, via: 'phone' }),
    loseCops("It's a setup! *Lose the cops*, then head home.", 2, PLACES.safehouse),
    goTo(PLACES.safehouse, 'Stash the package at the *Seashell Apartments*.', { radius: 5 }),
    talk([
      ['kai', 'Voss wants me in a cell so Crane can have the docks and Lou\'s route. Fine.'],
      ['kai', 'Then they both go down. Juno will know what to do with this package.'],
    ]),
  ],
  onPass(game) {
    game.progress.unlock('smg');
    game.combat.arsenal.give('smg', 60);
    game.notifications.toast('SMG unlocked: press 4', '', 5);
  },
};
