// Sunny Cab fares: in any taxi press T. A passenger waits on a sidewalk, waving. Pull up beside
// them (from either lane of the street) and stop: they walk over and get in. Drive them to a named
// place against the meter's clock, stop at the curb to let them out, and get paid by distance
// plus a speed tip. The next fare is offered as soon as one is done.
import { call, timeLimit, clearTimeLimit } from '../missions/missionSteps.js';
import { randomSidewalkSpot, nearestCorner } from '../ai/sidewalkPaths.js';
import { PedestrianBrain } from '../ai/pedestrianBrain.js';
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

/**
 * Sidewalk spots sit 9 m from the road's centre line and the far lane ends 7 m beyond it, so a
 * cab is "at the curb" anywhere within this distance, whichever side of the street it stopped on.
 */
export const CURB_REACH = 16;
/** Slow enough for a passenger to get in or out (m/s). */
const STOP_SPEED = 4;
const YELLOW = '#ffd23f';

function gap(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** Pull up at a sidewalk spot in the cab and stop there. */
function pullUp(place, text, stopText) {
  return {
    kind: 'goTo',
    place,
    radius: CURB_REACH,
    requires: 'taxi',
    objective: text,
    objectiveText(ctx) {
      const cab = ctx.vars.taxi;
      const player = ctx.game.player.character;
      if (player.vehicle !== cab) return 'Get back in your *Sunny Cab*.';
      if (gap(cab, place) < CURB_REACH + 14 && cab.speed >= STOP_SPEED) return stopText;
      return text;
    },
    update(dt, ctx) {
      const cab = ctx.vars.taxi;
      if (!cab || cab.destroyed) return 'fail:The cab was wrecked.';
      return ctx.game.player.character.vehicle === cab && gap(cab, place) < CURB_REACH && cab.speed < STOP_SPEED;
    },
    markers: () => [{ x: place.x, z: place.z, type: 'column', kind: 'target', color: YELLOW, radius: 4 }],
    route: (ctx) => (ctx.game.player.character.vehicle === ctx.vars.taxi ? place : ctx.vars.taxi),
  };
}

/** The waiting passenger walks to the cab's door and gets in, as long as the cab waits. */
function boardPassenger() {
  return {
    kind: 'board',
    objective: 'Your *passenger* is getting in...',
    start() {
      this.walked = 0;
    },
    update(dt, ctx) {
      const { taxi: cab, fare } = ctx.vars;
      if (!cab || cab.destroyed) return 'fail:The cab was wrecked.';
      if (!fare || !fare.alive) return 'fail:Your fare got hurt.';
      fare.handsUp = false;
      const door = cab.localToWorld(-cab.model.door.x, cab.model.door.z);
      const waiting = ctx.game.player.character.vehicle === cab && cab.speed < STOP_SPEED + 2 && gap(cab, fare) < CURB_REACH + 6;
      if (!waiting) {
        fare.setMove(0, 0, 0);
        ctx.runner.hint('Stop and wait for your passenger.');
        return false;
      }
      this.walked += dt;
      const distance = gap(fare, door);
      fare.setMove(door.x - fare.x, door.z - fare.z, distance > 3 ? 3.2 : 1.8);
      // Close to the door, or held up by a parked car for a while: in they get.
      if (distance > 1.1 && this.walked < 6) return false;
      ctx.game.characters.remove(fare);
      ctx.game.events.emit('notice', { text: 'Passenger aboard.' });
      return true;
    },
    markers: (ctx) => {
      const fare = ctx.vars.fare;
      return fare && fare.active ? [{ x: fare.x, z: fare.z, y: fare.y + 2.4, type: 'arrow', kind: 'target', color: YELLOW }] : [];
    },
    route: (ctx) => ctx.vars.fare ?? null,
  };
}

/** Lets the passenger out at the curb as an ordinary walker heading off along the sidewalk. */
function dropPassenger(ctx, look) {
  const game = ctx.game;
  const cab = ctx.vars.taxi;
  const door = cab.localToWorld(-cab.model.door.x, cab.model.door.z);
  const person = game.characters.spawn('pedestrian', door.x, door.z, look, { yaw: cab.yaw });
  const corner = nearestCorner(door.x, door.z);
  person.brain = new PedestrianBrain(person, game.rng.fork(person.id), corner);
  if (game.population) game.population.walkers.push(person);
}

export function taxiFare(game, taxi) {
  const rng = game.rng;
  const player = game.player.character;
  const pickup = randomSidewalkSpot(rng, player, 70, 220) ?? { x: PLACES.plaza.x, z: PLACES.plaza.z - 31 };
  const options = DESTINATIONS.filter((d) => gap(d, pickup) > 140);
  const destination = rng.pick(options.length ? options : DESTINATIONS);
  // The streets run on a grid: the drive is about the sum of the two legs, not the straight line.
  const streets = Math.abs(destination.x - pickup.x) + Math.abs(destination.z - pickup.z);
  const allowed = Math.round(streets / 8 + 25);
  const fare = Math.round(45 + gap(destination, pickup) * 0.55);
  const look = randomAppearance(rng);
  const tipFor = (ctx) => (ctx.mission.started === undefined ? 0 : Math.max(0, Math.round((allowed - (ctx.game.time - ctx.mission.started)) * 2)));
  return {
    id: 'taxiFare',
    title: 'Sunny Cab',
    kindLabel: 'Taxi fare',
    reward: fare,
    status(ctx) {
      return [
        ['Fare', `$${fare}`],
        ['Tip', ctx.mission.started === undefined ? '-' : `$${tipFor(ctx)}`],
        ['To', destination.label],
      ];
    },
    steps: () => [
      call((ctx) => {
        ctx.vars.taxi = taxi;
        ctx.vars.fare = ctx.runner.spawnPerson('pedestrian', pickup.x, pickup.z, look);
        ctx.vars.fare.handsUp = true;
      }),
      pullUp(pickup, 'Pick up the *fare* waving on the sidewalk.', 'Slow down and stop beside the *fare*.'),
      boardPassenger(),
      call((ctx) => {
        ctx.mission.started = ctx.game.time;
      }),
      timeLimit(allowed),
      pullUp(destination, `Drive the passenger to *${destination.label}*.`, `Stop at the curb at *${destination.label}*.`),
      clearTimeLimit(),
      call((ctx) => {
        dropPassenger(ctx, look);
        const tip = tipFor(ctx);
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
