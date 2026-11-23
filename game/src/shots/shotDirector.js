// Deterministic screenshot scenes behind ?shot=: each one stages a real moment of the game with
// the game's own systems (a career part-way through the story, the real story mission or side job
// started by the mission runner and played forward to the right step, the wanted level raised by
// a crime, police units sent by the dispatcher, guns from the arsenal), plays it forward in fixed
// steps from a fixed seed, then renders and sets window.__shotReady. Every HUD panel reads the
// live objects of that frame. Scenes: cover (Badge Trouble chase), street (Taco Tuesday fight),
// taxi (a Sunny Cab fare on the beachfront), race, map (full-screen map) and title.
import { STORYLINE } from '../missions/storyline.js';
import { PLACES } from '../world/places.js';
import { race } from '../missions/raceStep.js';
import { taxiFare } from '../activities/taxiJobs.js';
import { respectForCareer } from '../progression/respectRank.js';
import { goTo } from '../missions/missionSteps.js';
import { TrafficDriver } from '../ai/trafficDriver.js';
import { RaceDriver } from '../ai/raceDriver.js';
import { PedestrianBrain } from '../ai/pedestrianBrain.js';
import { nearestCorner } from '../ai/sidewalkPaths.js';
import { OUTFITS, randomAppearance } from '../characters/appearance.js';

/**
 * A career as a save part-way through the story holds it: the missions done with their unlocks,
 * money, a record of side jobs and the respect that record earned, and the guns bought or won.
 */
function career(game, { story, money, stats = {}, guns = { pistol: 48 }, hand = 'pistol' }) {
  const progress = game.progress;
  progress.money = money;
  progress.storyIndex = story;
  progress.completed = STORYLINE.slice(0, story).map((def) => def.id);
  progress.unlocks.pistol = story >= 2;
  progress.unlocks.armour = story >= 3;
  progress.unlocks.smg = story >= 5;
  Object.assign(progress.stats, stats, { missionsPassed: story });
  progress.respect = respectForCareer(story, progress.stats);
  for (const [gun, rounds] of Object.entries(guns)) game.combat.arsenal.give(gun, rounds);
  game.combat.arsenal.select(hand);
  game.player.character.weapon = hand;
  game.hud.shownMoney = money;
}

function startPlaying(game) {
  game.menus.hideTitle();
  game.state = 'playing';
  game.hud.show(true);
}

/** Starts a story mission and plays its steps forward, as finishing each would, to the first of `kind`. */
function playStoryTo(game, index, kind) {
  const runner = game.missions;
  runner.start(STORYLINE[index]);
  for (let guard = 0; guard < 40 && runner.current && runner.current.step.kind !== kind; guard += 1) runner.advance();
  game.hud.hideMissionTitle();
  return runner.current;
}

/** Hands the player's car to an autopilot that holds its lane (the camera needs a steady driver). */
function autopilot(game, car, from, to, lane, t, speed) {
  const driver = new TrafficDriver(car, game.network, game.city.signals, game.rng.fork(3));
  driver.place(from, to, lane, t);
  driver.cruise = speed;
  driver.speedLimit = speed;
  driver.preferStraight = true;
  driver.startPanic(999);
  car.ai = driver;
  game.player.enabled = false;
  return driver;
}

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Aims over Kai's shoulder (right button held) and turns the camera, as the mouse would, until
 * the crosshair's ray passes through `point`.
 */
function aimCameraAt(game, point) {
  const hero = game.player.character;
  const view = game.followCamera;
  game.player.aiming = true;
  view.trauma = 0;
  for (let pass = 0; pass < 12; pass += 1) {
    hero.aimYaw = view.yaw;
    settleCamera(game);
    const camera = game.camera;
    camera.updateMatrixWorld();
    const e = camera.matrixWorld.elements;
    const dx = point.x - camera.position.x;
    const dy = point.y - camera.position.y;
    const dz = point.z - camera.position.z;
    view.yaw += wrapAngle(Math.atan2(dx, dz) - Math.atan2(-e[8], -e[10]));
    view.pitch -= Math.atan2(dy, Math.hypot(dx, dz)) - Math.atan2(-e[9], Math.hypot(e[8], e[10]));
  }
  hero.aimYaw = view.yaw;
  settleCamera(game);
}

/** Where a person's head or chest is, for their build. */
function bodyPoint(person, part) {
  const h = person.appearance.build ? person.appearance.build.height : 1;
  return { x: person.x, y: person.y + (part === 'head' ? 1.65 : 1.15) * h, z: person.z };
}

/** Walkers on the sidewalk lines `zs` between x0 and x1, each on the sidewalk loop of its block. */
function sidewalkCrowd(game, rng, x0, x1, zs, count) {
  for (let index = 0; index < count; index += 1) {
    const x = rng.range(x0, x1);
    const z = rng.pick(zs) + rng.range(-1.2, 1.2);
    const walker = game.characters.spawn('pedestrian', x, z, randomAppearance(rng), { yaw: rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2 });
    walker.brain = new PedestrianBrain(walker, rng.fork(500 + index), nearestCorner(x, z));
    game.population.walkers.push(walker);
  }
}

/**
 * Story mission 5, Badge Trouble, at golden hour: Voss has just set Kai up on the phone, Kai has
 * shot his way out of Pier 9 and four stars are on him. He races west up Pier Street in Juno's
 * Vexa GT with cruisers on his bumper, Skyhawk's searchlight on the car and a wreck exploding.
 */
function coverScene(game) {
  career(game, {
    story: 4, money: 9850, guns: { pistol: 60, shotgun: 18 },
    stats: { fares: 7, racesWon: 1, deliveries: 3, copsEscaped: 4, carsStolen: 26, shells: 2, sideJobs: 9 },
  });
  startPlaying(game);
  game.timeOfDay.set(17.45);
  game.timeOfDay.frozen = true;
  const hero = game.player.character;
  hero.health = 78;
  hero.armour = 46;
  const network = game.network;
  const car = game.vehicles.spawn('sports', 0, 0, 0, { role: 'player', paint: '#e01e37' });
  game.player.enterVehicle(car);
  autopilot(game, car, network.nodeAt(6, 4).id, network.nodeAt(5, 4).id, 0, 0.06, 26);
  car.vx = -24;
  car.vz = 0;
  car.damage(260);
  game.population.walkerTarget = 80;
  game.population.reset();
  // Keep the chase lanes clear: ambient traffic near the car goes, the cars below are placed.
  for (const vehicle of [...game.population.traffic]) {
    if (Math.hypot(vehicle.x - car.x, vehicle.z - car.z) < 150) game.vehicles.remove(vehicle);
  }
  game.population.traffic = game.population.traffic.filter((vehicle) => vehicle.active);
  // The real mission, played forward to "lose the cops": Voss's call and two stars come with it.
  playStoryTo(game, 4, 'loseCops');
  game.player.enabled = false;
  // Kai shot back at the units outside the warehouse: that is four stars and the helicopter.
  game.wanted.report('shotPolice', 8, 0);
  for (const [back, side] of [[7, 3.4], [12, -3.3], [18, 5.6], [25, 0.3], [33, -3.8]]) {
    const unit = game.police.spawnUnit({ x: car.x + back, z: car.z + side, yaw: -Math.PI / 2 }, true);
    unit.vehicle.vx = -27;
  }
  // Oncoming traffic pulls over on the eastbound side.
  const paints = ['#f1faee', '#2a9d8f', '#ffd166'];
  for (const [ahead, lane] of [[-16, 1], [44, 0], [78, 1]]) {
    const vehicle = game.population.spawnTraffic({ x: car.x, z: car.z }, 0, 1e9);
    if (!vehicle) continue;
    vehicle.paint.set(paints.pop());
    vehicle.ai.place(network.nodeAt(5, 4).id, network.nodeAt(6, 4).id, lane, Math.min(0.92, Math.max(0.05, (car.x + ahead - 91) / 58)));
  }
  // A car that lost a fight with the cruisers burns at the curb; another goes up as Kai passes.
  const wreck = game.vehicles.spawn('sedan', car.x - 30, 6.4, 0.55, { role: 'mission', paint: '#5a5f66' });
  wreck.damage(wreck.health * 0.885);
  const blast = game.vehicles.spawn('compact', car.x - 4, -6.9, -0.3, { role: 'mission', paint: '#2a9d8f' });
  blast.damage(blast.health * 0.9);
  // Shoppers on both sidewalks of Pier Street where the chase is about to pass.
  sidewalkCrowd(game, game.rng.fork(21), car.x - 45, car.x + 10, [-9, 9], 30);
  game.followCamera.view = 0;
  game.followCamera.lookBack = true;
  // The camera has to be on the scene while it plays: effects only run near the camera.
  settleCamera(game);
  game.simulate(1.25);
  blast.damage(blast.health);
  game.simulate(0.3);
  game.dialogue.reveal();
  // Skyhawk hangs low over the street behind the cruisers, its beam on Kai.
  game.helicopter.placeAt(car.x + 27, car.z + 3, car.x + 1, car.z, 12.5);
  game.helicopter.update(1 / 60);
}

/**
 * Story mission 3, Taco Tuesday, mid-afternoon in Mercado Plaza: Crane's crew has come for Lou's
 * truck, the thug's taunt is on screen and Kai is firing from cover while the crowd scatters.
 */
function streetScene(game) {
  career(game, { story: 2, money: 3420, stats: { fares: 3, carsStolen: 9, copsEscaped: 1 }, guns: { pistol: 60 } });
  startPlaying(game);
  game.timeOfDay.set(16.1);
  game.timeOfDay.frozen = true;
  const hero = game.player.character;
  hero.x = PLACES.plaza.x - 4;
  hero.z = PLACES.plaza.z - 27;
  hero.yaw = 0;
  game.population.reset();
  const rng = game.rng.fork(8);
  const b = { x0: PLACES.plaza.x - 27, x1: PLACES.plaza.x + 27, z0: PLACES.plaza.z - 25, z1: PLACES.plaza.z + 25 };
  for (let index = 0; index < 22; index += 1) {
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
  // The real mission, played forward to the fight: the crew is spawned and the taunt plays.
  const mission = playStoryTo(game, 2, 'eliminate');
  const crew = mission.vars.crew;
  for (const member of crew) {
    // They came looking for this fight: no hesitation, guns already up.
    member.brain.reaction = 0;
    member.brain.cooldown = 0.2;
  }
  const target = crew[0];
  game.followCamera.snapBehind(Math.atan2(target.x - hero.x, target.z - hero.z) - 0.16);
  game.followCamera.pitch = 0.26;
  // People between Kai and the fountain, about to run when the shooting starts.
  for (let index = 0; index < 10; index += 1) {
    const x = hero.x + rng.range(-12, 12);
    const z = hero.z + rng.range(7, 22);
    const walker = game.characters.spawn('pedestrian', x, z, randomAppearance(rng), { yaw: rng.range(0, 6.28) });
    walker.brain = new PedestrianBrain(walker, rng.fork(100 + index), { bx: 3, bz: 4, corner: 0, plaza: true });
    walker.brain.mode = 'wander';
    walker.brain.timer = 30;
    walker.brain.pickWanderTarget();
    game.population.walkers.push(walker);
  }
  game.simulate(1.1);
  game.dialogue.reveal();
  // A witness called it in: one star.
  game.wanted.setLevel(1);
  // Kai's first round goes in the nearest gunman's head; the second hits the next one.
  aimCameraAt(game, bodyPoint(target, 'head'));
  game.combat.firePlayerShot(game.combat.arsenal.spec);
  game.simulate(0.4);
  const second = crew.find((member) => member !== target && member.alive && member.weapon !== 'fists') ?? crew[1];
  aimCameraAt(game, bodyPoint(second, 'chest'));
  game.combat.firePlayerShot(game.combat.arsenal.spec);
  game.simulate(0.02);
  // Right button let go after the double tap: the camera eases back while the gun is still up.
  game.player.aiming = false;
  hero.aimYaw = game.followCamera.yaw;
  game.followCamera.pitch = 0.2;
  settleCamera(game);
}

/**
 * A Sunny Cab fare at midday on Seabreeze Boulevard: Kai's cab rolls north along Sunwheel Beach
 * toward a passenger waving on the promenade, the fare and the destination on the tracker.
 */
function taxiScene(game) {
  career(game, {
    story: 5, money: 14320, guns: { pistol: 48, smg: 90 },
    stats: { fares: 11, racesWon: 2, deliveries: 6, copsEscaped: 6, carsStolen: 31, shells: 4, sideJobs: 16 },
  });
  startPlaying(game);
  game.timeOfDay.set(12.6);
  game.timeOfDay.frozen = true;
  const network = game.network;
  const cab = game.vehicles.spawn('taxi', 0, 0, 0, { role: 'player' });
  game.player.enterVehicle(cab);
  autopilot(game, cab, network.nodeAt(7, 5).id, network.nodeAt(7, 4).id, 1, 0.12, 13);
  cab.vz = -12;
  game.population.walkerTarget = 85;
  game.population.reset();
  for (const vehicle of [...game.population.traffic]) {
    if (Math.abs(vehicle.x - cab.x) < 8 && Math.abs(vehicle.z - cab.z) < 40) game.vehicles.remove(vehicle);
  }
  game.population.traffic = game.population.traffic.filter((vehicle) => vehicle.active);
  // Boulevard traffic: cars heading south past the cab and a couple ahead of it going north.
  const paints = ['#2a9d8f', '#f1faee', '#e63946', '#ffd166'];
  for (const [from, to, lane, t] of [[[7, 4], [7, 5], 0, 0.22], [[7, 4], [7, 5], 1, 0.5], [[7, 5], [7, 4], 0, 0.66], [[7, 3], [7, 4], 0, 0.55]]) {
    const vehicle = game.population.spawnTraffic({ x: cab.x, z: cab.z }, 0, 1e9);
    if (!vehicle) continue;
    vehicle.paint.set(paints.pop());
    vehicle.ai.place(network.nodeAt(...from).id, network.nodeAt(...to).id, lane, t);
  }
  for (let index = 0; index < 26; index += 1) game.population.spawnWalker({ x: 248, z: cab.z - 30 }, 0, 45);
  // The next fare of the shift waves from the promenade by the beach.
  game.missions.start(taxiFare(game, cab, { at: { x: 250.5, z: cab.z - 40 } }));
  game.hud.hideMissionTitle();
  game.followCamera.view = 0;
  game.followCamera.lookBack = false;
  settleCamera(game);
  game.simulate(1.6);
}

/** The full-screen map with the story contact, side activities and the route there. */
function mapScene(game) {
  career(game, { story: 5, money: 21400 });
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

/** Story mission 6, Strand Sprint, mid-race down Seabreeze Boulevard against Dash Ortega's pack. */
function raceScene(game) {
  career(game, { story: 5, money: 18250, stats: { fares: 9, racesWon: 2, carsStolen: 28, copsEscaped: 5 } });
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
    id: 'raceShot', title: 'Strand Sprint', kindLabel: 'Street race', story: false, reward: 3500,
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

/** The title screen at golden hour over Sunwheel Beach, Carmine Strand and the Glasswater towers. */
function titleScene(game) {
  game.timeOfDay.set(game.options.hour ?? 17.75);
  game.timeOfDay.frozen = true;
  game.showTitle();
  game.simulate(2);
  game.titleCamera.time = 30;
}

export const SHOTS = { cover: coverScene, street: streetScene, taxi: taxiScene, race: raceScene, map: mapScene, title: titleScene };

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
