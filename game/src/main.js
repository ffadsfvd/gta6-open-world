// Boot: builds the game and opens the title screen. ?shot=cover|street|map|title stages a
// deterministic screenshot scene instead (see shots/shotDirector.js); ?seed=N fixes the city.
import { Game } from './core/game.js';
import { stageShot } from './shots/shotDirector.js';

const params = new URLSearchParams(window.location.search);
const canvas = document.getElementById('game-canvas');
const seed = Number.parseInt(params.get('seed') ?? '', 10);
const game = new Game(canvas, { seed: Number.isInteger(seed) ? seed : undefined });
game.init();
window.__game = game;

const shot = params.get('shot');
if (shot) {
  stageShot(game, shot);
} else {
  game.showTitle();
  game.start();
  // Browsers only allow sound after a gesture: the first click or key starts it.
  const unlock = () => game.audio.unlock();
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
}
