// Story 2 — Paint Job. Juno's collector wants a Vexa GT: steal the red one from the Suncrest
// Hotel valet, shake the police the valet calls, and deliver it to the garage in one piece.
import { PLACES } from '../../world/places.js';
import { call, deliver, enterVehicle, guardVehicle, loseCops, talk } from '../missionSteps.js';
import { OUTFITS } from '../../characters/appearance.js';

export default {
  id: 'paintJob',
  title: 'Paint Job',
  giver: 'juno',
  reward: 1500,
  story: true,
  steps: () => [
    talk([
      ['juno', 'A collector in Glasswater wants a Vexa GT. There is a red one sitting at the Suncrest Hotel valet.'],
      ['juno', "Bring it here without a scratch. And Kai? Don't lead the cops to my door."],
    ]),
    call((ctx) => {
      const car = ctx.runner.spawnVehicle('sports', 220, -110, Math.PI / 2, { paint: '#d00000' });
      car.mission = 'vexa';
      ctx.vars.vexa = car;
      const valet = ctx.runner.spawnPerson('npc', 223, -114, { ...OUTFITS.fare, shirt: '#ffffff', pants: '#14213d' });
      valet.yaw = Math.PI;
    }),
    enterVehicle('vexa', 'Steal the *Vexa GT* at the Suncrest Hotel.'),
    call((ctx) => {
      ctx.game.wanted.setLevel(1);
      ctx.game.notifications.toast('The valet called the police!', '', 4);
    }),
    guardVehicle('vexa', loseCops('Lose the *cops* before you go to the garage.')),
    deliver('vexa', PLACES.garage, "Deliver the *Vexa GT* to Juno's Garage."),
    talk([
      ['juno', 'Not bad, Moreno. Not bad at all. Here is your cut.'],
      ['juno', 'And take this. Bayside Arms will sell you rounds for it. Ondaluz is getting rough.'],
    ]),
  ],
  onPass(game) {
    game.progress.unlock('pistol');
    game.combat.arsenal.give('pistol', 36);
    game.notifications.toast('Pistol unlocked: press 2', '', 5);
  },
};
