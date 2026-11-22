// Sunny Cab fares: in any taxi press T. A passenger waits on a sidewalk; pick them up, drive
// them to a named place against the clock, get paid by distance plus a speed tip, repeat.
import { call, goTo, timeLimit, clearTimeLimit } from '../missions/missionSteps.js';
import { randomSidewalkSpot } from '../ai/sidewalkPaths.js';
import { randomAppearance } from '../characters/appearance.js';
import { PLACES } from '../world/cityPlan.js';

const DESTINATIONS = [
  { x: 231, z: -112, label: 'the Suncrest Hotel' },
  { x: -9, z: -160, label: 'Glasswater One' },
  { x: -40, z: 9, label: 'Mercado Plaza' },
  { x: 40, z: -169, label: 'St. Amaro Medical' },
  { x: 248, z: 4, label: 'Sunwheel Pier' },
  { x: -280, z: -169, label: 'Jacaranda Park' },
  { x: -191, z: 89, label: 'Flamingo Fuel' },
  { x: 40, z: 231, label: 'the Ironwharf quay' },
  { x: 120, z: -311, label: 'Vista Norte' },
  { x: 231, z: -280, label: 'Lighthouse Street' },
];

export function taxiFare(game, taxi) {
  const rng = game.rng;
  const player = game.player.character;
  const pickup = randomSidewalkSpot(rng, player, 70, 220) ?? { x: PLACES.plaza.x, z: PLACES.plaza.z - 30 };
  const options = DESTINATIONS.filter((d) => Math.hypot(d.x - pickup.x, d.z - pickup.z) > 140);
  const destination = rng.pick(options.length ? options : DESTINATIONS);
  const distance = Math.hypot(destination.x - pickup.x, destination.z - pickup.z);
  const allowed = Math.round(distance / 8.5 + 20);
  return {
    id: 'taxiFare',
    title: 'Sunny Cab',
    reward: Math.round(45 + distance * 0.55),
    steps: () => [
      call((ctx) => {
        ctx.vars.taxi = taxi;
        ctx.vars.fare = ctx.runner.spawnPerson('pedestrian', pickup.x, pickup.z, randomAppearance(rng));
        ctx.vars.fare.handsUp = true;
      }),
      goTo(pickup, 'Pick up the *fare* waiting on the sidewalk.', { radius: 7, vehicle: 'taxi' }),
      call((ctx) => {
        ctx.game.characters.remove(ctx.vars.fare);
        ctx.mission.started = ctx.game.time;
      }),
      timeLimit(allowed),
      goTo(destination, `Drive the passenger to *${destination.label}*.`, { radius: 8, vehicle: 'taxi' }),
      clearTimeLimit(),
      call((ctx) => {
        const spent = ctx.game.time - ctx.mission.started;
        const tip = Math.max(0, Math.round((allowed - spent) * 2));
        if (tip > 0) {
          ctx.game.progress.addMoney(tip, 'tip');
          ctx.game.notifications.toast(`Speed tip +$${tip}`, 'cash');
        }
      }),
    ],
    onPass(g) {
      g.progress.bump('fares');
      g.activities.queueNextFare = true;
    },
  };
}
