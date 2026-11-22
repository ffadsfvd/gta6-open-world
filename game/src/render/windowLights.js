// Night-time window lights for the facade textures: for each facade style, a glow map with the
// same window grid in which some rooms are lit (warm lamps, the odd blue TV) and the rest are
// dark. Each map spans TILES x TILES facade tiles, so neighbouring windows light up at random
// instead of repeating every tile. Used as the facades' emissive maps, faded in at dusk.
import * as THREE from 'three';
import { createRandom } from '../core/random.js';

const TILES = 4;
const TILE = 64;
const SCALE = TILE / 256;
const WARM = ['#ffd27a', '#ffe1a6', '#ffc35c', '#fff0cf', '#ffb85a', '#ffe7b8'];

/** Window rectangles of one 256 px facade tile, in that tile's pixels: [x, y, w, h]. */
const LAYOUTS = {
  glass: { lit: 0.5, cool: 0.45, windows: grid(8, 2, (col, row) => [col * 32 + 2, row * 128 + 4, 28, 106]) },
  deco: { lit: 0.42, cool: 0.08, windows: grid(2, 2, (col, row) => [col * 128 + 30, row * 128 + 30, 68, 64]) },
  residential: { lit: 0.45, cool: 0.12, windows: grid(2, 2, (col, row) => [col * 128 + 40, row * 128 + 28, 48, 62]) },
  office: { lit: 0.38, cool: 0.35, windows: grid(4, 2, (col, row) => [col * 64 + 8, row * 128 + 22, 48, 82]) },
  storefront: { lit: 0.85, cool: 0.05, windows: [[14, 64, 158, 166], [186, 80, 56, 176]] },
};

function grid(cols, rows, rect) {
  const list = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) list.push(rect(col, row));
  }
  return list;
}

function paintLights(layout, rng) {
  const canvas = document.createElement('canvas');
  canvas.width = TILE * TILES;
  canvas.height = TILE * TILES;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let ty = 0; ty < TILES; ty += 1) {
    for (let tx = 0; tx < TILES; tx += 1) {
      for (const [x, y, w, h] of layout.windows) {
        const px = tx * TILE + x * SCALE;
        const py = ty * TILE + y * SCALE;
        const pw = Math.max(1, w * SCALE);
        const ph = Math.max(1, h * SCALE);
        if (!rng.chance(layout.lit)) {
          ctx.fillStyle = '#07080c';
          ctx.fillRect(px, py, pw, ph);
          continue;
        }
        const cool = rng.chance(layout.cool);
        const gradient = ctx.createLinearGradient(px, py, px, py + ph);
        const color = cool ? rng.pick(['#d8e8ff', '#bcd6ff', '#e6f0ff']) : rng.pick(WARM);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, cool ? '#7f9cc8' : '#c9873e');
        ctx.globalAlpha = rng.range(0.55, 1);
        ctx.fillStyle = gradient;
        ctx.fillRect(px, py, pw, ph);
        ctx.globalAlpha = 1;
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1 / TILES, 1 / TILES);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** One window-light map per facade style that has windows. */
export function createWindowLights(seed = 7) {
  const rng = createRandom(seed ^ 0x11647);
  const maps = {};
  for (const [style, layout] of Object.entries(LAYOUTS)) maps[style] = paintLights(layout, rng);
  return maps;
}
