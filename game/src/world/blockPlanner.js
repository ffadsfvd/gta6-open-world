// Decides what stands on each city block: lots and buildings by district style (deco hotels,
// glass towers, market shops, houses, warehouses, mid-rise offices) and the hand-made special
// blocks (plaza, park, police, hospital, the tower, safehouse, garage, depot, gas station, hotel).
import { CURB_HEIGHT } from '../core/config.js';
import { blockBounds, districtOfBlock, specialOfBlock } from './cityPlan.js';
import { DECO_SIGNS, DOCK_SIGNS, SHOP_SIGNS, BILLBOARDS } from './signCatalog.js';

const BASE = CURB_HEIGHT;
const PASTELS = ['#f7b6c2', '#a8e6cf', '#ffd3a5', '#c9b6f2', '#a9d8f5', '#fff1a8', '#f9c6a0', '#b5ead7', '#ffdac1', '#f6a6b2', '#9fe2e8'];
const MERCADO = ['#e07a5f', '#f2cc8f', '#81b29a', '#4fb3b4', '#f4a261', '#e9c46a', '#d77fa1', '#7fa7d9', '#f6bd60', '#90be6d'];
const GLASS = ['#d6ecff', '#c2ebe4', '#efdcbc', '#d6dcec', '#b4d2ee', '#e4e9ef'];
const OFFICE = ['#efe6d8', '#ddd5c7', '#ece7de', '#d4dbe0', '#f3e4c9', '#e6d3c3'];
const HOUSES = ['#fbf3e4', '#f9e0c7', '#e6f2f3', '#fde2e4', '#e0eee9', '#fff1c1', '#f1e4f7'];
const ROOFS = ['#b5533c', '#c46a4a', '#a8472f', '#9c5b3b', '#c27a55'];
const WAREHOUSE = ['#dcd6cc', '#c9d3d6', '#d6c7b4', '#b9c4c9', '#e0cfc0', '#cfd8c4'];
const AWNINGS = ['#e63946', '#2a9d8f', '#f4a261', '#264653', '#e76f51', '#8338ec', '#06d6a0', '#ffbe0b'];

function splitSpan(start, end, minWidth, maxWidth, rng) {
  const parts = [];
  let cursor = start;
  while (end - cursor > maxWidth + minWidth * 0.5) {
    const width = rng.range(minWidth, maxWidth);
    parts.push([cursor, cursor + width]);
    cursor += width;
  }
  parts.push([cursor, end]);
  return parts;
}

/** Lots around the block edge, each facing its street, leaving a courtyard inside. */
function perimeterLots(b, rng, minWidth, maxWidth, minDepth, maxDepth) {
  const lots = [];
  const north = rng.range(minDepth, maxDepth);
  const south = rng.range(minDepth, maxDepth);
  const west = rng.range(minDepth, maxDepth);
  const east = rng.range(minDepth, maxDepth);
  for (const [a, c] of splitSpan(b.lotMinX, b.lotMaxX, minWidth, maxWidth, rng)) {
    lots.push({ minX: a, maxX: c, minZ: b.lotMinZ, maxZ: b.lotMinZ + north * rng.range(0.75, 1), front: 'n' });
    lots.push({ minX: a, maxX: c, minZ: b.lotMaxZ - south * rng.range(0.75, 1), maxZ: b.lotMaxZ, front: 's' });
  }
  const zStart = b.lotMinZ + north;
  const zEnd = b.lotMaxZ - south;
  for (const [a, c] of splitSpan(zStart, zEnd, minWidth, maxWidth, rng)) {
    lots.push({ minX: b.lotMinX, maxX: b.lotMinX + west * rng.range(0.75, 1), minZ: a, maxZ: c, front: 'w' });
    lots.push({ minX: b.lotMaxX - east * rng.range(0.75, 1), maxX: b.lotMaxX, minZ: a, maxZ: c, front: 'e' });
  }
  return { lots, court: { minX: b.lotMinX + west, maxX: b.lotMaxX - east, minZ: zStart, maxZ: zEnd } };
}

function quadLots(b, gap) {
  const midX = (b.lotMinX + b.lotMaxX) / 2;
  const midZ = (b.lotMinZ + b.lotMaxZ) / 2;
  return [
    { minX: b.lotMinX, maxX: midX - gap / 2, minZ: b.lotMinZ, maxZ: midZ - gap / 2, front: 'n' },
    { minX: midX + gap / 2, maxX: b.lotMaxX, minZ: b.lotMinZ, maxZ: midZ - gap / 2, front: 'e' },
    { minX: b.lotMinX, maxX: midX - gap / 2, minZ: midZ + gap / 2, maxZ: b.lotMaxZ, front: 'w' },
    { minX: midX + gap / 2, maxX: b.lotMaxX, minZ: midZ + gap / 2, maxZ: b.lotMaxZ, front: 's' },
  ];
}

function shrinkLot(lot, rng, minFill, maxFill) {
  const w = lot.maxX - lot.minX;
  const d = lot.maxZ - lot.minZ;
  const fw = w * rng.range(minFill, maxFill);
  const fd = d * rng.range(minFill, maxFill);
  const cx = (lot.minX + lot.maxX) / 2;
  const cz = (lot.minZ + lot.maxZ) / 2;
  return { ...lot, minX: cx - fw / 2, maxX: cx + fw / 2, minZ: cz - fd / 2, maxZ: cz + fd / 2 };
}

function building(lot, style, height, color, extra = {}) {
  return { minX: lot.minX, maxX: lot.maxX, minZ: lot.minZ, maxZ: lot.maxZ, front: lot.front, base: BASE, height: BASE + height, style, color, roof: 'flat', ...extra };
}

function planDeco(b, rng, plan) {
  const { lots, court } = perimeterLots(b, rng, 13, 21, 15, 20);
  for (const lot of lots) {
    const floors = rng.int(3, 7);
    const spec = building(lot, 'deco', 4.5 + floors * 3.4, rng.pick(PASTELS), {
      storefront: true,
      trim: '#ffffff',
      fin: rng.chance(0.45),
      awning: rng.chance(0.6) ? rng.pick(AWNINGS) : null,
      sign: rng.chance(0.5) ? rng.pick(SHOP_SIGNS) : null,
      roofSign: rng.chance(0.35) ? rng.pick(DECO_SIGNS) : null,
      // Streamline hotels: rounded corners on about half of them.
      rounded: rng.chance(0.45) ? 0.2 : 0,
    });
    plan.buildings.push(spec);
  }
  plan.features.push({ type: 'pool', ...court });
}

function planShops(b, rng, plan) {
  const { lots, court } = perimeterLots(b, rng, 9, 15, 12, 17);
  for (const lot of lots) {
    const floors = rng.int(1, 3);
    plan.buildings.push(building(lot, rng.chance(0.5) ? 'residential' : 'deco', 4.5 + floors * 3.4, rng.pick(MERCADO), {
      storefront: true,
      trim: '#fff4e0',
      awning: rng.chance(0.85) ? rng.pick(AWNINGS) : null,
      sign: rng.chance(0.75) ? rng.pick(SHOP_SIGNS) : null,
    }));
  }
  plan.features.push({ type: 'parking', ...court });
}

function planTowers(b, rng, plan) {
  const lots = quadLots(b, 4);
  lots.forEach((lot, index) => {
    if (rng.chance(0.12) && index > 0) {
      plan.features.push({ type: 'miniPlaza', ...lot });
      return;
    }
    const tower = shrinkLot(lot, rng, 0.72, 0.92);
    const tall = rng.chance(0.65);
    const height = tall ? rng.range(48, 104) : rng.range(26, 44);
    const shape = rng.next();
    plan.buildings.push(building(tower, tall ? 'glass' : 'office', height, tall ? rng.pick(GLASS) : rng.pick(OFFICE), {
      storefront: true,
      trim: '#e9edf0',
      roof: tall ? rng.pick(['tiers', 'spire', 'helipad', 'crown']) : 'clutter',
      sign: rng.chance(0.3) ? rng.pick(['bank', 'gazette', 'motors', 'cafe']) : null,
      billboard: !tall && rng.chance(0.5) ? rng.pick(BILLBOARDS) : null,
      // Round glass towers, stepped towers and plain slabs.
      rounded: tall && shape < 0.3 ? 0.42 : 0,
      setback: shape >= 0.3 && shape < 0.7,
    }));
  });
}

function planMidrise(b, rng, plan) {
  quadLots(b, 3).forEach((lot) => {
    const spec = shrinkLot(lot, rng, 0.8, 0.98);
    const residential = rng.chance(0.5);
    plan.buildings.push(building(spec, residential ? 'residential' : 'office', rng.range(16, 40), residential ? rng.pick(HOUSES) : rng.pick(OFFICE), {
      storefront: rng.chance(0.7),
      trim: '#f4f1ea',
      roof: 'clutter',
      awning: rng.chance(0.4) ? rng.pick(AWNINGS) : null,
      sign: rng.chance(0.4) ? rng.pick(SHOP_SIGNS) : null,
      billboard: rng.chance(0.3) ? rng.pick(BILLBOARDS) : null,
      setback: rng.chance(0.3),
      rounded: residential && rng.chance(0.25) ? 0.18 : 0,
    }));
  });
}

function planHouses(b, rng, plan) {
  const size = (b.lotMaxX - b.lotMinX) / 3;
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const lot = {
        minX: b.lotMinX + col * size, maxX: b.lotMinX + (col + 1) * size,
        minZ: b.lotMinZ + row * size, maxZ: b.lotMinZ + (row + 1) * size,
        front: row === 0 ? 'n' : row === 2 ? 's' : col === 0 ? 'w' : 'e',
      };
      const cx = (lot.minX + lot.maxX) / 2;
      const cz = (lot.minZ + lot.maxZ) / 2;
      if (row === 1 && col === 1) {
        plan.features.push({ type: 'pool', minX: lot.minX + 3, maxX: lot.maxX - 3, minZ: lot.minZ + 3, maxZ: lot.maxZ - 3 });
        continue;
      }
      if (rng.chance(0.2)) {
        const flats = shrinkLot(lot, rng, 0.8, 0.9);
        plan.buildings.push(building(flats, 'residential', 4.5 + rng.int(2, 3) * 3.4, rng.pick(HOUSES), { trim: '#ffffff', roof: 'clutter' }));
      } else {
        const house = shrinkLot(lot, rng, 0.48, 0.62);
        const floors = rng.chance(0.4) ? 2 : 1;
        plan.buildings.push(building(house, 'house', floors * 3.3, rng.pick(HOUSES), { roof: 'pitched', roofColor: rng.pick(ROOFS), trim: '#ffffff' }));
      }
      plan.trees.push({ x: cx + (rng.chance(0.5) ? -1 : 1) * size * 0.36, z: cz + (rng.chance(0.5) ? -1 : 1) * size * 0.36, kind: rng.chance(0.6) ? 'palm' : 'round' });
    }
  }
  plan.ground = 'grass';
}

function planWarehouses(b, rng, plan) {
  const midZ = (b.lotMinZ + b.lotMaxZ) / 2;
  const halves = [
    { minX: b.lotMinX, maxX: b.lotMaxX, minZ: b.lotMinZ, maxZ: midZ - 3, front: 'n' },
    { minX: b.lotMinX, maxX: b.lotMaxX, minZ: midZ + 3, maxZ: b.lotMaxZ, front: 's' },
  ];
  halves.forEach((half, index) => {
    if (index === 1 && rng.chance(0.4)) {
      plan.features.push({ type: 'containers', ...half });
      return;
    }
    const spec = shrinkLot(half, rng, 0.85, 0.97);
    plan.buildings.push(building(spec, 'warehouse', rng.range(8, 13), rng.pick(WAREHOUSE), {
      trim: '#8d8a84',
      roof: 'clutter',
      door: true,
      sign: rng.chance(0.5) ? rng.pick(DOCK_SIGNS) : null,
    }));
  });
  plan.ground = 'concrete';
}

function setSignOnFront(plan, front, sign, roofSign) {
  let best = null;
  for (const spec of plan.buildings) {
    if (spec.front !== front) continue;
    if (!best || spec.maxX - spec.minX + (spec.maxZ - spec.minZ) > best.maxX - best.minX + (best.maxZ - best.minZ)) best = spec;
  }
  if (!best) return null;
  if (sign) best.sign = sign;
  if (roofSign) best.roofSign = roofSign;
  return best;
}

function planSpecial(kind, b, rng, plan) {
  const cx = b.cx;
  const cz = b.cz;
  switch (kind) {
    case 'plaza':
      plan.ground = 'plaza';
      plan.features.push({ type: 'fountain', x: cx, z: cz });
      plan.features.push({ type: 'tacoTruck', x: -60, z: 26, yaw: Math.PI / 2 });
      plan.features.push({ type: 'stalls', x: cx, z: cz });
      for (let index = 0; index < 8; index += 1) {
        const angle = (index / 8) * Math.PI * 2 + 0.2;
        plan.trees.push({ x: cx + Math.cos(angle) * 17, z: cz + Math.sin(angle) * 17, kind: 'palm' });
      }
      plan.features.push({ type: 'arch', x: cx, z: b.lotMaxZ + 2, sign: 'mercado' });
      return;
    case 'park':
      plan.ground = 'grass';
      plan.features.push({ type: 'pond', x: cx + 4, z: cz - 2, rx: 14, rz: 9 });
      for (let index = 0; index < 22; index += 1) {
        const x = rng.range(b.lotMinX + 3, b.lotMaxX - 3);
        const z = rng.range(b.lotMinZ + 3, b.lotMaxZ - 3);
        if (Math.hypot((x - cx - 4) / 17, (z - cz + 2) / 12) < 1) continue;
        plan.trees.push({ x, z, kind: rng.chance(0.5) ? 'round' : 'palm' });
      }
      plan.features.push({ type: 'bandstand', x: cx - 16, z: cz + 16 });
      return;
    case 'police': {
      const hq = building({ minX: b.lotMinX + 18, maxX: b.lotMaxX, minZ: b.lotMinZ + 8, maxZ: b.lotMaxZ - 8, front: 'e' }, 'office', 4.5 + 4 * 3.4, '#cfd8e3', {
        storefront: true, trim: '#1d3557', roof: 'helipad', sign: 'police', awning: '#1d3557',
      });
      plan.buildings.push(hq);
      plan.features.push({ type: 'parking', minX: b.lotMinX, maxX: b.lotMinX + 16, minZ: b.lotMinZ, maxZ: b.lotMaxZ });
      plan.features.push({ type: 'flag', x: b.lotMaxX + 1.5, z: cz - 12 });
      return;
    }
    case 'hospital': {
      plan.buildings.push(building({ minX: b.lotMinX + 4, maxX: b.lotMaxX - 4, minZ: b.lotMinZ + 4, maxZ: b.lotMaxZ - 14, front: 's' }, 'office', 4.5 + 6 * 3.4, '#f4f6f8', {
        storefront: true, trim: '#d00000', roof: 'helipad', sign: 'medical', awning: '#d00000',
      }));
      plan.features.push({ type: 'parking', minX: b.lotMinX, maxX: b.lotMaxX, minZ: b.lotMaxZ - 12, maxZ: b.lotMaxZ });
      return;
    }
    case 'tower': {
      plan.ground = 'plaza';
      plan.buildings.push(building({ minX: cx - 13, maxX: cx + 13, minZ: cz - 13, maxZ: cz + 13, front: 's' }, 'glass', 132, '#cfe6ff', {
        storefront: true, trim: '#e9edf0', roof: 'spire', roofSign: 'glasswater', landmark: true,
      }));
      for (let index = 0; index < 4; index += 1) {
        const corner = [[-1, -1], [1, -1], [-1, 1], [1, 1]][index];
        plan.trees.push({ x: cx + corner[0] * 21, z: cz + corner[1] * 21, kind: 'palm' });
      }
      return;
    }
    case 'hotel': {
      plan.ground = 'plaza';
      plan.buildings.push(building({ minX: b.lotMinX + 4, maxX: b.lotMaxX - 20, minZ: b.lotMinZ + 2, maxZ: b.lotMaxZ - 2, front: 'e' }, 'deco', 4.5 + 9 * 3.4, '#f7a8c4', {
        storefront: true, trim: '#ffffff', fin: true, roofSign: 'suncrest', awning: '#ffffff', landmark: true,
      }));
      plan.features.push({ type: 'driveway', minX: b.lotMaxX - 18, maxX: b.lotMaxX, minZ: b.lotMinZ + 6, maxZ: b.lotMaxZ - 6 });
      for (let index = 0; index < 4; index += 1) plan.trees.push({ x: b.lotMaxX - 3, z: b.lotMinZ + 8 + index * 14, kind: 'palm' });
      return;
    }
    case 'gas': {
      plan.features.push({ type: 'gasStation', x: b.lotMaxX - 14, z: b.lotMinZ + 14 });
      const { lots } = perimeterLots(b, rng, 10, 15, 12, 15);
      for (const lot of lots) {
        if (lot.maxX > b.lotMaxX - 30 && lot.minZ < b.lotMinZ + 30) continue;
        plan.buildings.push(building(lot, 'residential', 4.5 + rng.int(1, 2) * 3.4, rng.pick(MERCADO), {
          storefront: true, trim: '#fff4e0', awning: rng.pick(AWNINGS), sign: rng.pick(SHOP_SIGNS),
        }));
      }
      return;
    }
    case 'safehouse':
      planDeco(b, rng, plan);
      setSignOnFront(plan, 'e', null, 'seashell');
      return;
    case 'gunshop':
      planShops(b, rng, plan);
      setSignOnFront(plan, 'n', 'arms', null);
      return;
    case 'garage': {
      planWarehouses(b, rng, plan);
      const spec = setSignOnFront(plan, 'n', 'garage', null);
      if (spec) spec.color = '#4a5568';
      return;
    }
    case 'depot':
      planWarehouses(b, rng, plan);
      setSignOnFront(plan, 'n', 'express', null);
      plan.features.push({ type: 'parking', minX: b.lotMinX, maxX: b.lotMaxX, minZ: (b.lotMinZ + b.lotMaxZ) / 2 - 2, maxZ: (b.lotMinZ + b.lotMaxZ) / 2 + 2 });
      return;
    default:
      planMidrise(b, rng, plan);
  }
}

/** The full plan of block (bx, bz): buildings, trees, features and its ground finish. */
export function planBlock(bx, bz, rng) {
  const bounds = blockBounds(bx, bz);
  const district = districtOfBlock(bx, bz);
  const plan = { bx, bz, bounds, district, special: specialOfBlock(bx, bz), buildings: [], trees: [], features: [], ground: 'paving' };
  if (plan.special) planSpecial(plan.special, bounds, rng, plan);
  else if (district === 'strand') planDeco(bounds, rng, plan);
  else if (district === 'mercado') planShops(bounds, rng, plan);
  else if (district === 'glass') planTowers(bounds, rng, plan);
  else if (district === 'jacaranda') planHouses(bounds, rng, plan);
  else if (district === 'docks') planWarehouses(bounds, rng, plan);
  else planMidrise(bounds, rng, plan);
  return plan;
}
