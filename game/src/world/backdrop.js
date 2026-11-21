// The Vista Alta hills that close the city in to the west and north: low-poly slopes with
// scattered villas, plus the grass verge and outer sidewalks along the edge roads.
import * as THREE from 'three';
import { CURB_HEIGHT, GRID_X, GRID_Z, ROAD_HALF, SIDEWALK } from '../core/config.js';
import { MeshBuckets } from '../render/meshBuckets.js';

const EDGE = -345;
const SHORE_SOUTH = 247;

function ridgeNoise(x, z) {
  return Math.sin(x * 0.011) * Math.cos(z * 0.013) * 0.5
    + Math.sin(x * 0.027 + z * 0.019) * 0.3
    + Math.sin(x * 0.061 - z * 0.047) * 0.12;
}

export function hillHeight(x, z) {
  const west = EDGE - x;
  const north = EDGE - z;
  const depth = Math.max(west, north);
  if (depth <= 0) return CURB_HEIGHT;
  const rise = 1 - Math.exp(-depth / 140);
  return CURB_HEIGHT + rise * (70 + ridgeNoise(x, z) * 45) + Math.min(depth, 40) * 0.05;
}

function inHills(x, z) {
  return (x < EDGE && z < 300) || (z < EDGE && x < 262);
}

function buildHills(scene) {
  const step = 36;
  const positions = [];
  const colors = [];
  const low = new THREE.Color('#7ea552');
  const mid = new THREE.Color('#8e9d58');
  const high = new THREE.Color('#bba27a');
  const color = new THREE.Color();
  const pushCorner = (x, z) => {
    const h = hillHeight(x, z);
    positions.push(x, h, z);
    const t = Math.min(1, h / 95);
    if (t < 0.5) color.copy(low).lerp(mid, t * 2);
    else color.copy(mid).lerp(high, (t - 0.5) * 2);
    const shade = 0.92 + ridgeNoise(z * 3.1, x * 2.7) * 0.08;
    colors.push(color.r * shade, color.g * shade, color.b * shade);
  };
  for (let x = -1700; x < 300; x += step) {
    for (let z = -1700; z < 320; z += step) {
      const cx = x + step / 2;
      const cz = z + step / 2;
      if (!inHills(cx, cz) && !inHills(x, z)) continue;
      const x1 = Math.min(x + step, x < EDGE && x + step > EDGE ? EDGE : x + step);
      const z1 = Math.min(z + step, z < EDGE && z + step > EDGE ? EDGE : z + step);
      pushCorner(x, z1); pushCorner(x1, z1); pushCorner(x1, z);
      pushCorner(x, z1); pushCorner(x1, z); pushCorner(x, z);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function buildVillas(buckets, rng) {
  const plain = buckets.get('plain');
  for (let index = 0; index < 60; index += 1) {
    const west = rng.chance(0.55);
    const depth = rng.range(30, 260);
    const x = west ? EDGE - depth : rng.range(-330, 220);
    const z = west ? rng.range(-330, 250) : EDGE - depth;
    const y = hillHeight(x, z);
    const w = rng.range(7, 13);
    const d = rng.range(6, 10);
    const yaw = rng.range(0, Math.PI);
    plain.addBox(x, y + 2.2, z, w, 5.4, d, rng.pick(['#fbf3e4', '#f9e0c7', '#ffffff', '#fde2e4']), { yaw });
    plain.addBox(x, y + 5.2, z, w + 0.8, 0.6, d + 0.8, rng.pick(['#b5533c', '#c46a4a', '#e9e3d6']), { yaw });
  }
  // A radio mast on the highest ridge, Coral FM's.
  const mx = -520;
  const mz = -470;
  const my = hillHeight(mx, mz);
  for (let level = 0; level < 6; level += 1) plain.addBox(mx, my + 6 + level * 12, mz, 1.4 - level * 0.18, 12, 1.4 - level * 0.18, level % 2 === 0 ? '#e63946' : '#f1faee');
}

function buildEdges(buckets) {
  const west = GRID_X[0] - ROAD_HALF;
  const north = GRID_Z[0] - ROAD_HALF;
  const east = GRID_X[GRID_X.length - 1] + ROAD_HALF;
  const south = GRID_Z[GRID_Z.length - 1] + ROAD_HALF;
  const walk = buckets.get('sidewalk');
  walk.addFloor(west - SIDEWALK, north - SIDEWALK, west, south, CURB_HEIGHT, '#ffffff', 3);
  walk.addFloor(west, north - SIDEWALK, east, north, CURB_HEIGHT, '#ffffff', 3);
  const grass = buckets.get('grass');
  grass.addFloor(EDGE, EDGE, west - SIDEWALK, SHORE_SOUTH, CURB_HEIGHT, '#ffffff', 6);
  grass.addFloor(west - SIDEWALK, EDGE, 262, north - SIDEWALK, CURB_HEIGHT, '#ffffff', 6);
  const curb = buckets.get('plain');
  curb.addQuad([west, 0, south], [0, 0, north - south], [0, CURB_HEIGHT, 0], '#c9c3b8');
  curb.addQuad([west, 0, north], [east - west, 0, 0], [0, CURB_HEIGHT, 0], '#c9c3b8');
}

export function buildBackdrop(scene, materials, rng) {
  buildHills(scene);
  const buckets = new MeshBuckets();
  buildVillas(buckets, rng);
  buildEdges(buckets);
  buckets.flush(scene, materials);
}
