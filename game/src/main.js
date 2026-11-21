// Boot: reads the URL options and starts the game. ?test=drive puts the player in a car driven
// by the traffic AI and marks the page ready after a few seconds, for automated checks.
import { Game } from './core/game.js';
import { TrafficDriver } from './ai/trafficDriver.js';

const params = new URLSearchParams(window.location.search);
const canvas = document.getElementById('game-canvas');
const game = new Game(canvas, { seed: Number(params.get('seed')) || undefined });
game.init();
game.input.wantsLock = true;
window.__game = game;

const car = game.vehicles.spawn('sports', 236, 52, Math.PI, { role: 'parked', paint: '#d00000' });
game.population.populateNow();
if (params.get('test') === 'drive' || params.get('test') === 'chase') {
  game.player.enterVehicle(car);
  const spot = game.network.laneFromPosition(car.x, car.z, car.yaw);
  car.ai = new TrafficDriver(car, game.network, game.city.signals, game.rng.fork(5));
  car.ai.cruise = 18;
  if (spot) car.ai.place(spot.from, spot.to, spot.lane, spot.t);
  game.player.enabled = false;
  if (params.get('test') === 'chase') {
    car.ai.startPanic(999);
    game.wanted.setLevel(3, true);
  }
  game.followCamera.view = Number(params.get('view') ?? 0);
  game.simulate(Number(params.get('seconds') ?? 6));
}
game.start();
setTimeout(() => {
  window.__shotReady = true;
}, 1200);
