// Deterministic screenshot scenes behind ?shot=: each one sets up a real moment of the game
// (the systems are the game's own), plays it forward in fixed steps from a fixed seed, then
// renders and sets window.__shotReady. Scenes: cover (police chase), street (plaza shootout),
// map (full-screen city map) and title (start screen).
import { PLACES } from '../world/cityPlan.js';
import { loseCops, eliminate, goTo, race } from '../missions/missionSteps.js';
import { TrafficDriver } from '../ai/trafficDriver.js';
import { RaceDriver } from '../ai/raceDriver.js';
import { PedestrianBrain } from '../ai/pedestrianBrain.js';
import { OUTFITS, randomAppearance } from '../characters/appearance.js';

function career(game, { money = 12850, story = 4 } = {}) {
  game.progress.money = money;
  game.progress.storyIndex = story;
  game.progress.unlocks.pistol = true;
  game.combat.arsenal.give('pistol', 48);
  game.combat.arsenal.select('pistol');
  game.hud.shownMoney = money;
}

function startPlaying(game) {
  game.menus.hideTitle();
  game.state = 'playing';
  game.hud.show(true);
}

/** Kai in the Vexa GT racing west up Pier Street at sunset, four cruisers and the helicopter on him. */
function coverScene(game) {
  career(game);
  startPlaying(game);
  game.timeOfDay.set(18.8);
  game.timeOfDay.frozen = true;
  const hero = game.player.character;
  hero.health = 82;
  hero.armour = 55;
  const network = game.network;
  const car = game.vehicles.spawn('sports', 0, 0, 0, { role: 'player', paint: '#e01e37' });
  const driver = new TrafficDriver(car, network, game.city.signals, game.rng.fork(3));
  driver.place(network.nodeAt(6, 4).id, network.nodeAt(5, 4).id, 0, 0.04);
  driver.cruise = 26;
  driver.startPanic(999);
  driver.speedLimit = 26;
  driver.preferStraight = true;
  game.player.enterVehicle(car);
  car.ai = driver;
  car.vx = -24;
  car.vz = 0;
  game.player.enabled = false;
  game.population.walkerTarget = 80;
  game.population.reset();
  // Keep the chase lanes clear: ambient traffic near the car goes, the cars below are placed.
  for (const vehicle of [...game.population.traffic]) {
    if (Math.hypot(vehicle.x - car.x, vehicle.z - car.z) < 150) game.vehicles.remove(vehicle);
  }
  game.population.traffic = game.population.traffic.filter((vehicle) => vehicle.active);
  game.missions.start({
    id: 'badgeTroubleShot', title: 'Badge Trouble', story: false, reward: 0,
    steps: () => [loseCops("It's a setup! *Lose the cops*, then head home.", 0, PLACES.safehouse)],
  });
  game.hud.hideMissionTitle();
  game.wanted.setLevel(4, true);
  for (const [back, side] of [[13, -3.6], [20, 0.4], [28, -4.8], [37, -1.4]]) {
    const unit = game.police.spawnUnit({ x: car.x + back, z: car.z + side, yaw: -Math.PI / 2 }, true);
    unit.vehicle.vx = -22;
  }
  // Oncoming traffic pulls over on the eastbound side; a car that lost a fight burns at the curb.
  const paints = ['#f1faee', '#2a9d8f', '#ffd166'];
  for (const [ahead, lane] of [[-16, 1], [44, 0], [78, 1]]) {
    const vehicle = game.population.spawnTraffic({ x: car.x, z: car.z }, 0, 1e9);
    if (!vehicle) continue;
    vehicle.paint.set(paints.pop());
    vehicle.ai.place(network.nodeAt(5, 4).id, network.nodeAt(6, 4).id, lane, Math.min(0.92, Math.max(0.05, (car.x + ahead - 91) / 58)));
  }
  // A car that lost a fight with the cruisers burns at the curb, right where the chase passes.
  const wreck = game.vehicles.spawn('sedan', car.x - 30, 6.4, 0.55, { role: 'mission', paint: '#5a5f66' });
  wreck.damage(wreck.health * 0.885);
  for (let index = 0; index < 22; index += 1) game.population.spawnWalker({ x: car.x - 8, z: car.z }, 0, 40);
  game.followCamera.view = 0;
  game.followCamera.lookBack = true;
  // The camera has to be on the scene while it plays: effects only run near the camera.
  settleCamera(game);
  game.simulate(1.5);
  // The helicopter hangs low over the street behind the cruisers, its beam on Kai.
  game.helicopter.placeAt(car.x + 42, car.z - 5, car.x + 1, car.z, 17);
}

/** On foot in Mercado Plaza: pistol drawn on Crane's crew, the crowd scattering. */
function streetScene(game) {
  career(game, { money: 6420, story: 2 });
  startPlaying(game);
  game.timeOfDay.set(17.85);
  game.timeOfDay.frozen = true;
  const hero = game.player.character;
  hero.x = PLACES.plaza.x - 3;
  hero.z = PLACES.plaza.z - 27;
  hero.yaw = 0;
  game.combat.arsenal.select('pistol');
  hero.weapon = 'pistol';
  game.population.reset();
  const rng = game.rng.fork(8);
  const b = { x0: PLACES.plaza.x - 27, x1: PLACES.plaza.x + 27, z0: PLACES.plaza.z - 25, z1: PLACES.plaza.z + 25 };
  for (let index = 0; index < 18; index += 1) {
    const x = rng.range(b.x0, b.x1);
    const z = rng.range(b.z0, b.z1);
    if (Math.hypot(x - PLACES.plaza.x, z - PLACES.plaza.z) < 8) continue;
    const walker = game.characters.spawn('pedestrian', x, z, randomAppearance(rng), { yaw: rng.range(0, 6.28) });
    walker.brain = new PedestrianBrain(walker, rng.fork(index), { bx: 3, bz: 4, corner: 0, plaza: true });
    walker.brain.mode = 'wander';
    walker.brain.timer = 30;
    walker.brain.pickWanderTarget();
    game.population.walkers.push(walker);
  }
  game.missions.start({
    id: 'tacoShot', title: 'Taco Tuesday', story: false, reward: 0,
    steps: (ctx) => [
      {
        objective: '',
        start() {
          const p = PLACES.plaza;
          ctx.vars.crew = ctx.runner.spawnCrew([
            { x: p.x - 13, z: p.z - 6, weapon: 'pistol' },
            { x: p.x + 1, z: p.z - 13, weapon: 'fists' },
            { x: p.x + 10, z: p.z - 7, weapon: 'pistol' },
            { x: p.x - 5, z: p.z + 2, weapon: 'pistol' },
          ]);
        },
        update: () => true,
      },
      eliminate('crew', "Take out *Crane's crew* before they wreck Lou's truck."),
    ],
  });
  game.hud.hideMissionTitle();
  const target = game.missions.current.vars.crew[2];
  game.followCamera.snapBehind(Math.atan2(target.x - hero.x, target.z - hero.z) - 0.18);
  game.followCamera.pitch = 0.3;
  game.simulate(1.2);
  game.dialogue.play([['thug', "Look who it is, Lou's little nephew! Crane says this plaza is his now."]], { auto: false });
  game.dialogue.reveal();
  for (const member of game.missions.current.vars.crew) member.brain.provoke();
  settleCamera(game);
  game.combat.firePlayerShot(game.combat.arsenal.spec);
  game.wanted.setLevel(1);
  game.simulate(0.9);
  settleCamera(game);
  game.combat.firePlayerShot(game.combat.arsenal.spec);
  game.simulate(0.02);
  hero.health = 74;
  hero.armour = 30;
}

/** The full-screen map with the story contact, side activities and the route there. */
function mapScene(game) {
  career(game, { money: 21400, story: 5 });
  startPlaying(game);
  const hero = game.player.character;
  hero.x = 120;
  hero.z = -9;
  game.population.reset();
  game.missions.start({
    id: 'mapShot', title: 'Strand Sprint', story: false, reward: 0,
    steps: () => [goTo({ x: 241.75, z: 200 }, 'Get to the *starting line* on Seabreeze Boulevard.', { radius: 7 })],
  });
  game.wanted.setLevel(2);
  for (const [x, z] of [[160, 40], [40, -80]]) {
    const spot = game.network.laneFromPosition(x, z, 0);
    if (spot) game.police.spawnUnit({ x, z, yaw: 0 }, true);
  }
  game.simulate(1);
  game.wanted.unseen = 4;
  game.openMap();
}

/** A night street race down Seabreeze Boulevard: neon hotels, lamps and the rivals' tail lights. */
function raceScene(game) {
  career(game, { money: 18250, story: 5 });
  startPlaying(game);
  game.timeOfDay.set(21.7);
  game.timeOfDay.frozen = true;
  const route = [{ x: 240, z: -160 }, { x: 240, z: -80 }, { x: 240, z: 0 }, { x: 240, z: 80 }, { x: 240, z: 160 }];
  const car = game.vehicles.spawn('sports', 238.2, -252, 0, { role: 'player', paint: '#3a86ff' });
  game.player.enterVehicle(car);
  game.population.walkerTarget = 70;
  game.population.reset();
  for (const vehicle of [...game.population.traffic]) {
    if (Math.abs(vehicle.x - 240) < 12 && Math.abs(vehicle.z + 200) < 90) game.vehicles.remove(vehicle);
  }
  game.population.traffic = game.population.traffic.filter((vehicle) => vehicle.active);
  game.missions.start({
    id: 'raceShot', title: 'Strand Sprint', story: false, reward: 0,
    steps: () => [race(route, [
      { type: 'muscle', paint: '#ff006e', skill: 0.9, outfit: OUTFITS.dash },
      { type: 'sports', paint: '#ffd166', skill: 0.88, outfit: OUTFITS.gang },
      { type: 'compact', paint: '#06d6a0', skill: 0.9, outfit: OUTFITS.gang },
    ], 'Strand Sprint')],
  });
  game.hud.hideMissionTitle();
  // Mid-race: the pack is ahead and Kai is closing in, everyone flat out.
  const step = game.missions.current.step;
  step.countdown = 0;
  game.missions.freezePlayer(false);
  step.racers.forEach((racer, index) => {
    racer.x = 238.2 - ((index + 1) % 2) * 3.5;
    racer.z = -240 + index * 7;
    racer.yaw = 0;
    racer.vz = 24;
    racer.ai.started = true;
  });
  car.ai = new RaceDriver(car, route, 0.95);
  car.ai.started = true;
  car.vz = 25;
  game.player.enabled = false;
  for (let index = 0; index < 18; index += 1) game.population.spawnWalker({ x: 236, z: -190 }, 0, 45);
  game.followCamera.view = 0;
  game.followCamera.lookBack = false;
  settleCamera(game);
  game.simulate(1.6);
}

/** The title screen over Carmine Strand and the Glasswater skyline. */
function titleScene(game) {
  game.timeOfDay.set(game.options.hour ?? 19.95);
  game.timeOfDay.frozen = true;
  game.showTitle();
  game.simulate(2);
  game.titleCamera.time = 30;
}

export const SHOTS = { cover: coverScene, street: streetScene, race: raceScene, map: mapScene, title: titleScene };

/** Lets the camera ease into its resting distance before the capture. */
function settleCamera(game) {
  for (let index = 0; index < 150; index += 1) game.followCamera.update(1 / 60, game.focus());
}

export function stageShot(game, name) {
  (SHOTS[name] ?? titleScene)(game);
  settleCamera(game);
  let frames = 0;
  const frame = () => {
    game.render(1 / 60);
    frames += 1;
    if (frames < 3) requestAnimationFrame(frame);
    else window.__shotReady = true;
  };
  requestAnimationFrame(frame);
}
