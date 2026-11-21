// Procedural textures painted on canvases at start-up: building facades, asphalt, sidewalk
// tiles, sand, grass, plaza tiles, pier planks and the ripple normal map of the sea. No image files.
import * as THREE from 'three';
import { createRandom } from '../core/random.js';

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return [canvas, canvas.getContext('2d')];
}

export function canvasTexture(canvas, { repeat = true, srgb = true, anisotropy = 8 } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
  }
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.anisotropy = anisotropy;
  return texture;
}

function speckle(ctx, width, height, rng, count, palette, maxSize) {
  for (let index = 0; index < count; index += 1) {
    ctx.fillStyle = palette[Math.floor(rng.next() * palette.length)];
    const size = 1 + rng.next() * maxSize;
    ctx.fillRect(rng.next() * width, rng.next() * height, size, size);
  }
}

function softBlotches(ctx, width, height, rng, count, color, radius) {
  for (let index = 0; index < count; index += 1) {
    const x = rng.next() * width;
    const y = rng.next() * height;
    const r = radius * (0.4 + rng.next());
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    for (let dx = -width; dx <= width; dx += width) {
      for (let dy = -height; dy <= height; dy += height) ctx.fillRect(x - r + dx, y - r + dy, r * 2, r * 2);
    }
  }
}

function glassGradient(ctx, x, y, w, h, top, bottom) {
  const gradient = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, w, h);
}

/** Curtain-wall glass for towers: 2 bays by 2 floors per repeat. */
function paintGlassFacade(rng) {
  const [canvas, ctx] = makeCanvas(256, 256);
  glassGradient(ctx, 0, 0, 256, 256, '#a9c4d6', '#4d6f8a');
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const shade = rng.next();
      ctx.fillStyle = shade > 0.8 ? 'rgba(255,240,210,0.28)' : shade < 0.25 ? 'rgba(10,30,50,0.25)' : 'rgba(255,255,255,0.05)';
      ctx.fillRect(col * 32, row * 128, 32, 112);
    }
  }
  const sheen = ctx.createLinearGradient(0, 0, 256, 256);
  sheen.addColorStop(0.3, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.45, 'rgba(255,255,255,0.22)');
  sheen.addColorStop(0.6, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#dfe4e8';
  for (let row = 0; row < 2; row += 1) ctx.fillRect(0, row * 128 + 112, 256, 16);
  ctx.fillStyle = '#c9d2d9';
  for (let col = 0; col <= 8; col += 1) ctx.fillRect(col * 32 - 2, 0, 4, 256);
  return canvasTexture(canvas);
}

/** Art-deco hotel wall: pale wall (tinted by vertex colour), framed windows, eyebrow ledges. */
function paintDecoFacade(rng) {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#f6f2ea';
  ctx.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 2; col += 1) {
      const x = col * 128;
      const y = row * 128;
      ctx.fillStyle = '#e2dccf';
      ctx.fillRect(x + 18, y + 14, 92, 7);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 24, y + 24, 80, 76);
      glassGradient(ctx, x + 30, y + 30, 68, 64, '#33506b', '#7fa6bf');
      if (rng.next() > 0.6) {
        ctx.fillStyle = 'rgba(255,236,200,0.55)';
        ctx.fillRect(x + 30, y + 30, 68, 30);
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 62, y + 30, 4, 64);
      ctx.fillRect(x + 30, y + 52, 68, 3);
      ctx.fillStyle = '#d5cdbf';
      ctx.fillRect(x + 20, y + 100, 88, 6);
    }
    ctx.fillStyle = '#e8e1d4';
    ctx.fillRect(0, row * 128 + 122, 256, 6);
  }
  return canvasTexture(canvas);
}

/** Apartment wall: smaller windows with shutters and balcony rails. */
function paintResidentialFacade(rng) {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#f3efe6';
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, rng, 500, ['rgba(0,0,0,0.04)', 'rgba(255,255,255,0.1)'], 3);
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 2; col += 1) {
      const x = col * 128;
      const y = row * 128;
      glassGradient(ctx, x + 40, y + 28, 48, 62, '#2c3e50', '#6d8ea3');
      ctx.fillStyle = '#9aa0a6';
      ctx.fillRect(x + 26, y + 28, 12, 62);
      ctx.fillRect(x + 90, y + 28, 12, 62);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 62, y + 28, 3, 62);
      ctx.fillStyle = '#b9b9b9';
      ctx.fillRect(x + 20, y + 94, 88, 4);
      for (let bar = 0; bar < 9; bar += 1) ctx.fillRect(x + 22 + bar * 10, y + 98, 2, 18);
      ctx.fillRect(x + 20, y + 114, 88, 3);
    }
    ctx.fillStyle = '#e4ddd0';
    ctx.fillRect(0, row * 128 + 122, 256, 6);
  }
  return canvasTexture(canvas);
}

/** Office mid-rise: a regular window grid with light frames. */
function paintOfficeFacade(rng) {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#efece6';
  ctx.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const x = col * 64;
      const y = row * 128;
      glassGradient(ctx, x + 8, y + 22, 48, 82, '#3c5871', '#8fb0c4');
      if (rng.next() > 0.7) {
        ctx.fillStyle = 'rgba(255,248,225,0.45)';
        ctx.fillRect(x + 8, y + 22, 48, 82);
      }
      ctx.fillStyle = '#f7f7f5';
      ctx.fillRect(x + 30, y + 22, 3, 82);
    }
    ctx.fillStyle = '#d7d2c9';
    ctx.fillRect(0, row * 128 + 110, 256, 18);
  }
  return canvasTexture(canvas);
}

/** Ground-floor shops: a sign band, a lit display window and a glass door. One bay per repeat. */
function paintStorefront(rng) {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#f2ece2';
  ctx.fillRect(0, 0, 256, 256);
  const interior = ctx.createLinearGradient(0, 60, 0, 230);
  interior.addColorStop(0, '#fff1cf');
  interior.addColorStop(1, '#c48a52');
  ctx.fillStyle = interior;
  ctx.fillRect(14, 64, 158, 166);
  for (let shelf = 0; shelf < 3; shelf += 1) {
    ctx.fillStyle = 'rgba(90,50,30,0.45)';
    ctx.fillRect(22, 110 + shelf * 38, 142, 8);
    for (let item = 0; item < 9; item += 1) {
      ctx.fillStyle = `hsla(${Math.floor(rng.next() * 360)},60%,55%,0.8)`;
      ctx.fillRect(26 + item * 15, 92 + shelf * 38, 10, 18);
    }
  }
  const sheen = ctx.createLinearGradient(14, 64, 172, 230);
  sheen.addColorStop(0.2, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(14, 64, 158, 166);
  glassGradient(ctx, 186, 80, 56, 176, '#2b3a46', '#5f7d8f');
  ctx.fillStyle = '#d9d2c5';
  ctx.fillRect(210, 160, 8, 4);
  ctx.fillStyle = '#cfc6b8';
  ctx.fillRect(0, 230, 180, 26);
  ctx.fillStyle = '#e5ddd0';
  ctx.fillRect(0, 50, 256, 10);
  return canvasTexture(canvas);
}

/** Corrugated warehouse cladding. */
function paintWarehouse(rng) {
  const [canvas, ctx] = makeCanvas(256, 256);
  for (let x = 0; x < 256; x += 8) {
    ctx.fillStyle = (x / 8) % 2 === 0 ? '#e3dfd7' : '#c4beb3';
    ctx.fillRect(x, 0, 8, 256);
  }
  for (let streak = 0; streak < 6; streak += 1) {
    const x = rng.next() * 256;
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, 'rgba(140,80,40,0.35)');
    gradient.addColorStop(1, 'rgba(140,80,40,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, 0, 4 + rng.next() * 6, 120 + rng.next() * 120);
  }
  ctx.fillStyle = '#9d978d';
  ctx.fillRect(0, 248, 256, 8);
  return canvasTexture(canvas);
}

function paintAsphalt(rng) {
  const [canvas, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = '#6b6a6c';
  ctx.fillRect(0, 0, 512, 512);
  softBlotches(ctx, 512, 512, rng, 18, 'rgba(30,30,34,0.16)', 90);
  softBlotches(ctx, 512, 512, rng, 12, 'rgba(130,120,110,0.12)', 70);
  speckle(ctx, 512, 512, rng, 9000, ['#5f5e61', '#77757a', '#817d79', '#545357'], 2);
  ctx.strokeStyle = 'rgba(25,25,28,0.55)';
  ctx.lineWidth = 1.2;
  for (let crack = 0; crack < 5; crack += 1) {
    let x = rng.next() * 512;
    let y = rng.next() * 512;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let step = 0; step < 8; step += 1) {
      x += (rng.next() - 0.5) * 40;
      y += (rng.next() - 0.5) * 40;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return canvasTexture(canvas, { anisotropy: 16 });
}

function paintSidewalk(rng) {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#d9d4ca';
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, rng, 2600, ['#cfc9bd', '#e3ded4', '#c7c1b5'], 2);
  ctx.fillStyle = '#b3ada1';
  for (let line = 0; line < 2; line += 1) {
    ctx.fillRect(line * 128, 0, 2, 256);
    ctx.fillRect(0, line * 128, 256, 2);
  }
  return canvasTexture(canvas, { anisotropy: 16 });
}

function paintSand(rng) {
  const [canvas, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = '#ecd6a8';
  ctx.fillRect(0, 0, 512, 512);
  softBlotches(ctx, 512, 512, rng, 20, 'rgba(210,180,130,0.25)', 80);
  ctx.strokeStyle = 'rgba(255,245,220,0.35)';
  ctx.lineWidth = 2;
  for (let ripple = 0; ripple < 22; ripple += 1) {
    const y0 = ripple * 24 + rng.next() * 8;
    ctx.beginPath();
    for (let x = 0; x <= 512; x += 16) ctx.lineTo(x, y0 + Math.sin(x * 0.03 + ripple) * 5);
    ctx.stroke();
  }
  speckle(ctx, 512, 512, rng, 7000, ['#d9c08e', '#f5e4c0', '#c9ab78', '#fff3d6'], 2);
  return canvasTexture(canvas, { anisotropy: 16 });
}

function paintGrass(rng) {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#7da452';
  ctx.fillRect(0, 0, 256, 256);
  softBlotches(ctx, 256, 256, rng, 14, 'rgba(60,100,40,0.3)', 50);
  speckle(ctx, 256, 256, rng, 5000, ['#6d9446', '#8fb862', '#5f8a3e', '#a0c070'], 2);
  return canvasTexture(canvas);
}

function paintPlazaTiles(rng) {
  const [canvas, ctx] = makeCanvas(256, 256);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#d9a07c' : '#eee0c8';
      ctx.fillRect(col * 64, row * 64, 64, 64);
    }
  }
  speckle(ctx, 256, 256, rng, 1600, ['rgba(0,0,0,0.06)', 'rgba(255,255,255,0.08)'], 2);
  ctx.fillStyle = '#b9a98f';
  for (let line = 0; line <= 4; line += 1) {
    ctx.fillRect(line * 64 - 1, 0, 2, 256);
    ctx.fillRect(0, line * 64 - 1, 256, 2);
  }
  return canvasTexture(canvas);
}

function paintPlanks(rng) {
  const [canvas, ctx] = makeCanvas(256, 256);
  for (let plank = 0; plank < 8; plank += 1) {
    const tone = 120 + Math.floor(rng.next() * 30);
    ctx.fillStyle = `rgb(${tone + 40},${tone},${tone - 40})`;
    ctx.fillRect(0, plank * 32, 256, 30);
    ctx.fillStyle = 'rgba(60,35,20,0.6)';
    ctx.fillRect(0, plank * 32 + 30, 256, 2);
    ctx.fillRect(Math.floor(rng.next() * 256), plank * 32, 2, 30);
  }
  speckle(ctx, 256, 256, rng, 1500, ['rgba(70,40,20,0.2)', 'rgba(255,230,190,0.1)'], 2);
  return canvasTexture(canvas);
}

function paintConcrete(rng) {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#bdb8ae';
  ctx.fillRect(0, 0, 256, 256);
  softBlotches(ctx, 256, 256, rng, 10, 'rgba(90,85,80,0.15)', 60);
  speckle(ctx, 256, 256, rng, 3000, ['#b1aca2', '#c8c3b9', '#a8a39a'], 2);
  ctx.fillStyle = '#9c978e';
  ctx.fillRect(0, 0, 256, 2);
  ctx.fillRect(0, 0, 2, 256);
  return canvasTexture(canvas, { anisotropy: 16 });
}

/** A tiling ripple normal map for the sea, from waves with whole-number wave counts. */
function paintWaterNormals() {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size, size);
  const image = ctx.createImageData(size, size);
  const waves = [
    [3, 1, 0.5, 0.0], [1, 4, 0.36, 1.3], [5, -2, 0.24, 2.1], [-2, 7, 0.18, 0.7],
    [8, 3, 0.11, 4.0], [-6, 9, 0.08, 2.6], [11, -7, 0.05, 5.2],
  ];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;
      let dx = 0;
      let dy = 0;
      for (let index = 0; index < waves.length; index += 1) {
        const [kx, ky, amplitude, phase] = waves[index];
        const c = Math.cos(Math.PI * 2 * (kx * u + ky * v) + phase) * amplitude;
        dx += c * kx;
        dy += c * ky;
      }
      const nx = -dx * 0.09;
      const ny = -dy * 0.09;
      const length = Math.hypot(nx, ny, 1);
      const offset = (y * size + x) * 4;
      image.data[offset] = Math.round((nx / length * 0.5 + 0.5) * 255);
      image.data[offset + 1] = Math.round((ny / length * 0.5 + 0.5) * 255);
      image.data[offset + 2] = Math.round((1 / length * 0.5 + 0.5) * 255);
      image.data[offset + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvasTexture(canvas, { srgb: false });
}

/** Paints every shared texture once. */
export function createTextures(seed = 7) {
  const rng = createRandom(seed);
  return {
    glass: paintGlassFacade(rng),
    deco: paintDecoFacade(rng),
    residential: paintResidentialFacade(rng),
    office: paintOfficeFacade(rng),
    storefront: paintStorefront(rng),
    warehouse: paintWarehouse(rng),
    asphalt: paintAsphalt(rng),
    sidewalk: paintSidewalk(rng),
    sand: paintSand(rng),
    grass: paintGrass(rng),
    plaza: paintPlazaTiles(rng),
    planks: paintPlanks(rng),
    concrete: paintConcrete(rng),
    waterNormals: paintWaterNormals(),
  };
}
