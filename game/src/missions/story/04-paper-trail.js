// Story 4 — Paper Trail. Crane keeps his books on paper. Kai chases the courier van carrying the
// ledger, wrecks it, grabs the ledger and learns who Crane has on his payroll.
import { PLACES } from '../../world/cityPlan.js';
import { call, chase, collect, getInAnyVehicle, goTo, talk } from '../missionSteps.js';
import { TrafficDriver } from '../../ai/trafficDriver.js';
import { OUTFITS } from '../../characters/appearance.js';
import { PedestrianBrain } from '../../ai/pedestrianBrain.js';
import { nearestCorner } from '../../ai/sidewalkPaths.js';

export default {
  id: 'paperTrail',
  title: 'Paper Trail',
  giver: 'juno',
  reward: 2500,
  story: true,
  steps: () => [
    talk([
      ['juno', 'Crane is old-school: he keeps his books on paper. A courier moves the ledger every afternoon.'],
      ['juno', "White van, heading out of Mercado right now. Run it off the road and bring me that ledger."],
    ]),
    getInAnyVehicle('Get a *car* for the chase. A heavy one rams harder.'),
    call((ctx) => {
      const game = ctx.game;
      const network = game.network;
      const player = game.player.character;
      const van = ctx.runner.spawnVehicle('van', 0, 0, 0, { paint: '#f8f9fa' });
      const driver = ctx.runner.spawnPerson('npc', 0, 0, OUTFITS.gang);
      driver.vehicle = van;
      van.driver = driver;
      van.engineOn = true;
      const ai = new TrafficDriver(van, network, game.city.signals, game.rng.fork(404));
      // The van pulls out a block or two from wherever Kai is when he has wheels (a retry from
      // the hospital included), so the chase always starts within reach.
      const spot = network.randomLaneSpot(game.rng, player, 60, 120) ?? { from: network.nodeAt(2, 5).id, to: network.nodeAt(3, 5).id, lane: 1, t: 0.35 };
      ai.place(spot.from, spot.to, spot.lane, spot.t);
      ai.cruise = 15;
      ai.speedLimit = 18;
      ai.startPanic(9999);
      van.ai = ai;
      // An old courier van: a few good rams finish it.
      van.fragility = 2.6;
      ctx.vars.van = van;
      game.notifications.toast('The courier van is on the move: follow the red arrow!', '', 4);
    }),
    chase('van', 'Wreck the *courier van*.', { escape: 320 }),
    call((ctx) => {
      const van = ctx.vars.van;
      const game = ctx.game;
      const player = game.player.character;
      if (van.driver === player) {
        // Kai took the van itself: the ledger is already in his hands.
        ctx.vars.ledger = null;
        game.notifications.toast('The ledger is on the passenger seat!', '', 4);
        return;
      }
      const drop = van.localToWorld(van.halfWidth + 1.6, 0);
      ctx.vars.ledger = { x: drop.x, z: drop.z, y: van.y };
      const driver = van.driver;
      if (driver) {
        van.driver = null;
        van.ai = null;
        driver.vehicle = null;
        driver.x = drop.x;
        driver.z = drop.z + 1;
        const corner = nearestCorner(driver.x, driver.z);
        driver.brain = new PedestrianBrain(driver, game.rng.fork(driver.id), corner);
        driver.brain.scare(game.player.character.x, game.player.character.z, 20);
      }
      game.notifications.toast('The courier dropped the ledger!', '', 4);
    }),
    collect('ledger', 'Grab the *ledger*.'),
    goTo(PLACES.garage, "Bring the ledger to *Juno's Garage*.", { radius: 6, clean: true }),
    talk([
      ['juno', 'Shell companies, bribes, boat schedules... and a name. Detective Harlan Voss.'],
      ['kai', 'A cop?'],
      ['juno', "A cop on Crane's payroll. If he comes looking for you, you never saw this book."],
    ]),
  ],
};
