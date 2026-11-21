// The smaller set pieces inside blocks: hotel pools, parking lots, the Mercado fountain and
// market stalls, Lou's taco truck, the park pond and bandstand, the gas station, container stacks.
import * as THREE from 'three';
import { CURB_HEIGHT } from '../core/config.js';
import { addFacadeSign } from './buildingFactory.js';

const BASE = CURB_HEIGHT;
const CONE = new THREE.ConeGeometry(1.7, 0.7, 10);
const POLE = new THREE.CylinderGeometry(0.06, 0.06, 1, 6);
const BASIN = new THREE.CylinderGeometry(6, 6.3, 0.8, 28);
const DISC = new THREE.CylinderGeometry(5.5, 5.5, 0.1, 28);
const COLUMN = new THREE.CylinderGeometry(0.55, 0.75, 1, 12);
const BOWL = new THREE.CylinderGeometry(2.2, 0.6, 0.6, 16);
const WHEEL = new THREE.CylinderGeometry(0.45, 0.45, 0.3, 12);
const OCTAGON = new THREE.CylinderGeometry(5, 5.2, 0.7, 8);
const ROOF_CONE = new THREE.ConeGeometry(6, 2.4, 8);
const ELLIPSE = new THREE.CircleGeometry(1, 36);
const tempMatrix = new THREE.Matrix4();
const UMBRELLAS = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff924c'];
const CONTAINERS = ['#c0392b', '#2471a3', '#229954', '#d68910', '#7d3c98', '#138d75', '#ba4a00', '#5d6d7e'];

function addUmbrella(buckets, x, z, color) {
  tempMatrix.makeScale(1, 2.6, 1).setPosition(x, BASE + 1.3, z);
  buckets.get('plain').addGeometry(POLE, tempMatrix, '#e8e8e8');
  buckets.get('plain').addShape(CONE, x, BASE + 2.7, z, color);
}

function addPool(buckets, f, rng) {
  const w = Math.min(f.maxX - f.minX - 6, 18);
  const d = Math.min(f.maxZ - f.minZ - 6, 10);
  if (w < 6 || d < 4) return;
  const cx = (f.minX + f.maxX) / 2;
  const cz = (f.minZ + f.maxZ) / 2;
  buckets.get('paving').addFloor(f.minX, f.minZ, f.maxX, f.maxZ, BASE + 0.01, '#efe7da', 4);
  buckets.get('pool').addFloor(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, BASE + 0.12, '#ffffff', 6);
  const plain = buckets.get('plain');
  plain.addBox(cx, BASE + 0.1, cz - d / 2 - 0.3, w + 1.2, 0.2, 0.6, '#ffffff');
  plain.addBox(cx, BASE + 0.1, cz + d / 2 + 0.3, w + 1.2, 0.2, 0.6, '#ffffff');
  plain.addBox(cx - w / 2 - 0.3, BASE + 0.1, cz, 0.6, 0.2, d, '#ffffff');
  plain.addBox(cx + w / 2 + 0.3, BASE + 0.1, cz, 0.6, 0.2, d, '#ffffff');
  for (let index = 0; index < 4; index += 1) {
    const lx = cx - w / 2 + 2 + index * (w - 4) / 3;
    plain.addBox(lx, BASE + 0.35, cz - d / 2 - 2, 0.8, 0.25, 2, '#f5f5f5');
    if (index % 2 === 0) addUmbrella(buckets, lx + 1.1, cz - d / 2 - 2.4, rng.pick(UMBRELLAS));
  }
}

function addParking(buckets, f, extras) {
  buckets.get('asphalt').addFloor(f.minX, f.minZ, f.maxX, f.maxZ, BASE + 0.012, '#ffffff', 10);
  const marks = buckets.get('markings');
  const alongX = f.maxX - f.minX >= f.maxZ - f.minZ;
  const length = alongX ? f.maxX - f.minX : f.maxZ - f.minZ;
  const stalls = Math.floor((length - 2) / 3);
  for (let index = 0; index <= stalls; index += 1) {
    const t = 1 + index * 3;
    if (alongX) marks.addFloor(f.minX + t - 0.06, f.minZ + 0.5, f.minX + t + 0.06, f.minZ + 5.5, BASE + 0.03, '#f4f4f4');
    else marks.addFloor(f.minX + 0.5, f.minZ + t - 0.06, f.minX + 5.5, f.minZ + t + 0.06, BASE + 0.03, '#f4f4f4');
    if (index < stalls && index % 2 === 0) {
      const spot = alongX
        ? { x: f.minX + t + 1.5, z: f.minZ + 3, yaw: 0 }
        : { x: f.minX + 3, z: f.minZ + t + 1.5, yaw: Math.PI / 2 };
      extras.parkingSpots.push(spot);
    }
  }
}

function addFountain(buckets, f, collision, extras) {
  buckets.get('plain').addShape(BASIN, f.x, BASE + 0.4, f.z, '#e9dcc5');
  buckets.get('pool').addShape(DISC, f.x, BASE + 0.78, f.z, '#ffffff');
  tempMatrix.makeScale(1, 2.6, 1).setPosition(f.x, BASE + 2.1, f.z);
  buckets.get('plain').addGeometry(COLUMN, tempMatrix, '#e9dcc5');
  buckets.get('plain').addShape(BOWL, f.x, BASE + 3.5, f.z, '#e9dcc5');
  tempMatrix.makeScale(0.5, 1.4, 0.5).setPosition(f.x, BASE + 4.4, f.z);
  buckets.get('plain').addGeometry(COLUMN, tempMatrix, '#f2e6d0');
  collision.addBox(f.x - 6, f.z - 6, f.x + 6, f.z + 6, 0.9, 'fountain');
  extras.fountains.push({ x: f.x, z: f.z });
}

function addTacoTruck(buckets, atlas, f, collision) {
  const plain = buckets.get('plain');
  const alongX = Math.abs(Math.sin(f.yaw)) > 0.5;
  const length = 6.6;
  const width = 2.5;
  const sx = alongX ? length : width;
  const sz = alongX ? width : length;
  plain.addBox(f.x, BASE + 2.0, f.z, sx, 2.6, sz, '#ffcf3f');
  plain.addBox(f.x + (alongX ? length / 2 + 0.9 : 0), BASE + 1.5, f.z + (alongX ? 0 : length / 2 + 0.9), alongX ? 1.8 : width, 1.9, alongX ? width : 1.8, '#ffffff');
  plain.addBox(f.x, BASE + 0.6, f.z, sx - 0.4, 0.4, sz - 0.4, '#3a3a3a');
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const wx = f.x + (alongX ? a * 2.4 : b * (width / 2));
    const wz = f.z + (alongX ? b * (width / 2) : a * 2.4);
    buckets.get('plain').addShape(WHEEL, wx, BASE + 0.45, wz, '#1f1f1f', 0, 1);
  }
  const frame = alongX
    ? { x: f.x, z: f.z + width / 2, ax: 1, az: 0, nx: 0, nz: 1, width: length }
    : { x: f.x + width / 2, z: f.z, ax: 0, az: -1, nx: 1, nz: 0, width: length };
  addFacadeSign(buckets.get('signs'), frame, atlas.rect('taco'), 0, BASE + 2.45, 5.2, 1.3, 0.04);
  plain.addBox(frame.x + frame.nx * 0.9, BASE + 3.35, frame.z + frame.nz * 0.9, frame.nx === 0 ? length : 1.8, 0.12, frame.nx === 0 ? 1.8 : length, '#c2185b');
  plain.addBox(frame.x + frame.nx * 0.05, BASE + 1.75, frame.z + frame.nz * 0.05, frame.nx === 0 ? 3.4 : 0.1, 0.9, frame.nx === 0 ? 0.1 : 3.4, '#2c2c2c');
  collision.addBox(f.x - sx / 2 - (alongX ? 0 : 0), f.z - sz / 2, f.x + sx / 2 + (alongX ? 1.8 : 0), f.z + sz / 2 + (alongX ? 0 : 1.8), 3.2, 'truck');
}

function addStalls(buckets, f, rng, collision) {
  const plain = buckets.get('plain');
  for (let index = 0; index < 7; index += 1) {
    const angle = (index / 7) * Math.PI * 2 + 0.6;
    const x = f.x + Math.cos(angle) * 25;
    const z = f.z + Math.sin(angle) * 25;
    if (x < f.x - 26 && z < f.z - 6) continue;
    const yaw = -angle + Math.PI / 2;
    const color = rng.pick(UMBRELLAS);
    plain.addBox(x, BASE + 0.55, z, 3, 1.1, 1.2, '#8d6e4c', { yaw });
    plain.addBox(x, BASE + 2.55, z, 3.6, 0.15, 2.4, color, { yaw });
    for (const [a, b] of [[-1.6, -1], [1.6, -1], [-1.6, 1], [1.6, 1]]) {
      const px = x + a * Math.cos(yaw) + b * Math.sin(yaw);
      const pz = z - a * Math.sin(yaw) + b * Math.cos(yaw);
      plain.addBox(px, BASE + 1.25, pz, 0.08, 2.5, 0.08, '#d8d8d8');
    }
    for (let item = 0; item < 4; item += 1) {
      const t = -1.1 + item * 0.75;
      plain.addBox(x + t * Math.cos(yaw), BASE + 1.2, z - t * Math.sin(yaw), 0.5, 0.25, 0.5, rng.pick(['#ff6b35', '#f7c548', '#7bc950', '#e63946']), { yaw });
    }
    collision.addBox(x - 1.4, z - 1.4, x + 1.4, z + 1.4, 1.1, 'stall');
  }
}

function addArch(buckets, atlas, f, collision) {
  const plain = buckets.get('plain');
  for (const side of [-1, 1]) {
    plain.addBox(f.x + side * 7, BASE + 3.2, f.z, 1.2, 6.4, 1.2, '#e76f51');
    collision.addBox(f.x + side * 7 - 0.6, f.z - 0.6, f.x + side * 7 + 0.6, f.z + 0.6, 6.4, 'arch');
  }
  plain.addBox(f.x, BASE + 6.8, f.z, 15.6, 1, 1, '#e76f51');
  const rect = atlas.rect('mercado');
  addFacadeSign(buckets.get('signs'), { x: f.x, z: f.z + 0.55, ax: 1, az: 0, nx: 0, nz: 1, width: 14 }, rect, 0, BASE + 7.35, 9, 2.25, 0.02);
  addFacadeSign(buckets.get('signs'), { x: f.x, z: f.z - 0.55, ax: -1, az: 0, nx: 0, nz: -1, width: 14 }, rect, 0, BASE + 7.35, 9, 2.25, 0.02);
}

function addPond(buckets, f) {
  tempMatrix.makeRotationX(-Math.PI / 2);
  tempMatrix.premultiply(new THREE.Matrix4().makeScale(f.rx + 1, 1, f.rz + 1));
  tempMatrix.setPosition(f.x, BASE + 0.03, f.z);
  buckets.get('plain').addGeometry(ELLIPSE, tempMatrix, '#cbbf9f');
  tempMatrix.makeRotationX(-Math.PI / 2);
  tempMatrix.premultiply(new THREE.Matrix4().makeScale(f.rx, 1, f.rz));
  tempMatrix.setPosition(f.x, BASE + 0.06, f.z);
  buckets.get('pool').addGeometry(ELLIPSE, tempMatrix, '#9ad7c8');
}

function addBandstand(buckets, f, collision) {
  const plain = buckets.get('plain');
  plain.addShape(OCTAGON, f.x, BASE + 0.35, f.z, '#f4efe6');
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2;
    plain.addBox(f.x + Math.cos(angle) * 4.4, BASE + 2.2, f.z + Math.sin(angle) * 4.4, 0.25, 3.4, 0.25, '#ffffff');
  }
  plain.addShape(ROOF_CONE, f.x, BASE + 5.1, f.z, '#2a9d8f');
  collision.addBox(f.x - 5, f.z - 5, f.x + 5, f.z + 5, 0.7, 'bandstand');
}

function addFlag(buckets, f) {
  tempMatrix.makeScale(2, 12, 2).setPosition(f.x, BASE + 6, f.z);
  buckets.get('shiny').addGeometry(POLE, tempMatrix, '#dfe3e6');
  buckets.get('plain').addBox(f.x + 1.6, BASE + 10.8, f.z, 3, 1.8, 0.06, '#1d3557');
}

function addGasStation(buckets, atlas, f, collision, extras) {
  const plain = buckets.get('plain');
  buckets.get('asphalt').addFloor(f.x - 12, f.z - 12, f.x + 11, f.z + 12, BASE + 0.012, '#ffffff', 10);
  plain.addBox(f.x, BASE + 5.6, f.z, 16, 0.8, 10, '#ffffff', { skipBottom: false });
  plain.addBox(f.x, BASE + 5.1, f.z, 16.2, 0.25, 10.2, '#ff70a6');
  for (const [a, b] of [[-6, -3.5], [6, -3.5], [-6, 3.5], [6, 3.5]]) {
    plain.addBox(f.x + a, BASE + 2.6, f.z + b, 0.5, 5.2, 0.5, '#f1f1f1');
    collision.addBox(f.x + a - 0.3, f.z + b - 0.3, f.x + a + 0.3, f.z + b + 0.3, 5, 'pillar');
  }
  for (const a of [-3, 3]) {
    plain.addBox(f.x + a, BASE + 0.8, f.z, 0.8, 1.6, 0.6, '#ff70a6');
    collision.addBox(f.x + a - 0.5, f.z - 0.4, f.x + a + 0.5, f.z + 0.4, 1.6, 'pump');
  }
  const rect = atlas.rect('fuel');
  addFacadeSign(buckets.get('signs'), { x: f.x, z: f.z - 5.15, ax: -1, az: 0, nx: 0, nz: -1, width: 16 }, rect, 0, BASE + 5.15, 3.4, 0.85, 0.02);
  addFacadeSign(buckets.get('signs'), { x: f.x + 8.15, z: f.z, ax: 0, az: -1, nx: 1, nz: 0, width: 10 }, rect, 0, BASE + 5.15, 3.4, 0.85, 0.02);
  extras.parkingSpots.push({ x: f.x - 1.5, z: f.z + 1.8, yaw: Math.PI / 2 });
}

function addContainers(buckets, f, rng, collision) {
  const plain = buckets.get('plain');
  const rows = Math.floor((f.maxZ - f.minZ - 2) / 3);
  const cols = Math.floor((f.maxX - f.minX - 2) / 7);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (rng.chance(0.25)) continue;
      const x = f.minX + 1 + col * 7 + 3.05;
      const z = f.minZ + 1 + row * 3 + 1.25;
      const stack = rng.int(1, 3);
      for (let level = 0; level < stack; level += 1) {
        plain.addBox(x, BASE + 1.3 + level * 2.6, z, 6.1, 2.55, 2.44, rng.pick(CONTAINERS));
      }
      collision.addBox(x - 3.05, z - 1.22, x + 3.05, z + 1.22, stack * 2.6, 'container');
    }
  }
}

function addBench(buckets, x, z, yaw) {
  buckets.get('plain').addBox(x, BASE + 0.45, z, 1.8, 0.1, 0.5, '#8d6e4c', { yaw });
  buckets.get('plain').addBox(x, BASE + 0.22, z, 1.6, 0.44, 0.1, '#4a4a4a', { yaw });
}

export function addFeature(buckets, atlas, feature, rng, collision, extras) {
  switch (feature.type) {
    case 'pool': return addPool(buckets, feature, rng);
    case 'parking': return addParking(buckets, feature, extras);
    case 'fountain': return addFountain(buckets, feature, collision, extras);
    case 'tacoTruck': return addTacoTruck(buckets, atlas, feature, collision);
    case 'stalls': return addStalls(buckets, feature, rng, collision);
    case 'arch': return addArch(buckets, atlas, feature, collision);
    case 'pond': return addPond(buckets, feature);
    case 'bandstand': return addBandstand(buckets, feature, collision);
    case 'flag': return addFlag(buckets, feature);
    case 'gasStation': return addGasStation(buckets, atlas, feature, collision, extras);
    case 'containers': return addContainers(buckets, feature, rng, collision);
    case 'driveway':
      buckets.get('plaza').addFloor(feature.minX, feature.minZ, feature.maxX, feature.maxZ, BASE + 0.01, '#ffffff', 4);
      return undefined;
    case 'miniPlaza': {
      buckets.get('plaza').addFloor(feature.minX, feature.minZ, feature.maxX, feature.maxZ, BASE + 0.01, '#ffffff', 4);
      const cx = (feature.minX + feature.maxX) / 2;
      const cz = (feature.minZ + feature.maxZ) / 2;
      addBench(buckets, cx - 4, cz, 0);
      addBench(buckets, cx + 4, cz, 0);
      extras.trees.push({ x: cx - 7, z: cz - 6, kind: 'palm' }, { x: cx + 7, z: cz + 6, kind: 'palm' });
      return undefined;
    }
    default:
      return undefined;
  }
}

export { addBench };
