// Boot: builds the game and opens the title screen. ?shot=cover|street|taxi|race|map|title stages
// a deterministic screenshot scene from the real game instead (see shots/shotDirector.js);
// ?seed=N fixes the city and ?hour=H sets the clock (0-24).
import { Game } from './core/game.js';
import { stageShot } from './shots/shotDirector.js';

const params = new URLSearchParams(window.location.search);
const canvas = document.getElementById('game-canvas');
const seed = Number.parseInt(params.get('seed') ?? '', 10);
const hour = Number.parseFloat(params.get('hour') ?? '');
const game = new Game(canvas, {
  seed: Number.isInteger(seed) ? seed : undefined,
  hour: Number.isFinite(hour) ? hour : undefined,
});
game.init();
window.__game = game;

const shot = params.get('shot');
if (shot) {
  stageShot(game, shot);
} else {
  game.showTitle();
  game.start();
  window.__gameReady = true;
  // Browsers only allow sound after a gesture: the first click or key starts it.
  const unlock = () => game.audio.unlock();
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
}
