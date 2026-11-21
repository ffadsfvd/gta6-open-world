// Deterministic screenshot scenes behind ?shot=: each one sets up a real moment of the game
// (the systems are the game's own), plays it forward in fixed steps from a fixed seed, then
// renders and sets window.__shotReady. Scenes: cover (police chase), street (plaza shootout),
// map (full-screen city map) and title (start screen).
import { PLACES } from '../world/cityPlan.js';
import { loseCops, eliminate, goTo } from '../missions/missionSteps.js';
import { TrafficDriver } from '../ai/trafficDriver.js';
import { PedestrianBrain } from '../ai/pedestrianBrain.js';
import { randomAppearance } from '../characters/appearance.js';

function career(game, { money = 12850, story = 4 } = {}) {
  game.progress.money = money;
  game.progress.storyIndex = story;
  game.progress.unlocks.pistol = true;
  game.combat.arsenal.give('pistol', 48);
  game.combat.arsenal.select('pistol');
  game.hud.shownMoney = money;
}

/** Adds oncoming traffic on the far lanes of the avenue ahead of (x, z). */
function oncomingTraffic(game, x, z, count) {
  const network = game.network;
  for (let index = 0; index < count; index += 1) {
    const vehicle = game.population.spawnTraffic({ x, z }, 0, 1e9);
    if (!vehicle) continue;
    const lane = index % 2;
    const t = 0.2 + index * 0.22;
    vehicle.ai.place(network.nodeAt(7, 4).id, network.nodeAt(7, 3).id, lane, Math.min(0.95, t));
  }
}

function startPlaying(game) {
  game.menus.hideTitle();
  game.state = 'playing';
  game.hud.show(true);
}

/** Kai in the Vexa GT tearing down Seabreeze Boulevard with three cruisers on his tail. */
function coverScene(game) {
  career(game);
  startPlaying(game);
  const hero = game.player.character;
  hero.health = 82;
  hero.armour = 55;
  const network = game.network;
  const car = game.vehicles.spawn('sports', 0, 0, 0, { role: 'player', paint: '#e01e37' });
  const driver = new TrafficDriver(car, network, game.city.signals, game.rng.fork(3));
  driver.place(network.nodeAt(7, 2).id, network.nodeAt(7, 3).id, 1, 0.55);
  driver.cruise = 27;
  driver.startPanic(999);
  driver.speedLimit = 27;
  driver.preferStraight = true;
  game.player.enterVehicle(car);
  car.ai = driver;
  car.vx = 0;
  car.vz = 24;
  game.player.enabled = false;
  game.population.walkerTarget = 70;
  game.population.reset();
  game.missions.start({
    id: 'badgeTroubleShot', title: 'Badge Trouble', story: false, reward: 0,
    steps: () => [loseCops("It's a setup! *Lose the cops*, then head home.", 0, PLACES.safehouse)],
  });
  game.hud.hideMissionTitle();
  game.wanted.setLevel(3, true);
  for (const [back, side] of [[8, 3.5], [15, 7], [21, 0.4]]) {
    const unit = game.police.spawnUnit({ x: car.x + side, z: car.z - back, yaw: 0 }, true);
    unit.vehicle.vz = 24;
  }
  oncomingTraffic(game, car.x, car.z + 80, 3);
  for (let index = 0; index < 14; index += 1) game.population.spawnWalker({ x: car.x - 6, z: car.z + 75 }, 0, 34);
  game.followCamera.view = 0;
  game.followCamera.lookBack = true;
  game.simulate(3.2);
}

/** On foot in Mercado Plaza: pistol drawn on Crane's crew, the crowd scattering. */
function streetScene(game) {
  career(game, { money: 6420, story: 2 });
  startPlaying(game);
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

/** The title screen over Coral Strand and the Glasswater skyline. */
function titleScene(game) {
  game.showTitle();
  game.simulate(2);
  game.titleCamera.time = 30;
}

export const SHOTS = { cover: coverScene, street: streetScene, map: mapScene, title: titleScene };

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
