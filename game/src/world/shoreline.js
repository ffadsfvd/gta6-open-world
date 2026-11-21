// Everything where Solmara meets the water: Seabreeze promenade, Sunwheel Beach with umbrellas
// and lifeguard towers, the turquoise shallows and open sea, Sunwheel Pier and its turning wheel,
// the striped lighthouse, and the Old Port quay with gantry cranes, containers and a cargo ship.
import * as THREE from 'three';
import { CURB_HEIGHT, GRID_X, GRID_Z, PIER, ROAD_HALF, SHORE, WATER_LEVEL } from '../core/config.js';
// (GRID_X gives the coastal boulevard's line; the promenade starts at its east curb.)
import { MeshBuckets } from '../render/meshBuckets.js';
import { beachHeight } from './terrain.js';
import { addFacadeSign } from './buildingFactory.js';

const NORTH = -345;
const SOUTH_LAND = GRID_Z[GRID_Z.length - 1] + ROAD_HALF;
const WHEEL_X = 384;
const WHEEL_Y = 25;
const WHEEL_RADIUS = 20;
const GONDOLAS = 18;
const UMBRELLA_COLORS = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#ff924c', '#f15bb5', '#00bbf9'];

function buildBeach(buckets) {
  const sand = buckets.get('sand');
  const dry = new THREE.Color('#f6e2b4');
  const wet = new THREE.Color('#cfae7c');
  const under = new THREE.Color('#d9c79c');
  const color = new THREE.Color();
  const xs = [];
  for (let x = SHORE.promenadeEnd; x <= 430; x += x < 320 ? 3 : 10) xs.push(x);
  const zs = [];
  for (let z = NORTH; z <= SOUTH_LAND; z += 24) zs.push(z);
  zs.push(SOUTH_LAND);
  for (let zi = 0; zi < zs.length - 1; zi += 1) {
    for (let xi = 0; xi < xs.length - 1; xi += 1) {
      const xa = xs[xi];
      const xb = xs[xi + 1];
      const za = zs[zi];
      const zb = zs[zi + 1];
      const ha = beachHeight(xa);
      const hb = beachHeight(xb);
      const t = (xa - SHORE.promenadeEnd) / (SHORE.shoreline - SHORE.promenadeEnd);
      if (t < 0.75) color.copy(dry).lerp(wet, Math.max(0, t - 0.55) * 4);
      else color.copy(wet).lerp(under, Math.min(1, (t - 0.75) * 3));
      sand.addQuad([xa, ha, zb], [xb - xa, hb - ha, 0], [0, 0, za - zb], color, [xa / 12, -zb / 12, xb / 12, -za / 12]);
    }
  }
  // Promenade sidewalk and its sea wall.
  const promenadeStart = GRID_X[GRID_X.length - 1] + ROAD_HALF;
  buckets.get('sidewalk').addFloor(promenadeStart, NORTH + 14, SHORE.promenadeEnd, SOUTH_LAND, CURB_HEIGHT, '#ffffff', 3);
  buckets.get('plain').addQuad([SHORE.promenadeEnd, -0.1, SOUTH_LAND], [0, 0, NORTH + 14 - SOUTH_LAND], [0, CURB_HEIGHT + 0.1, 0], '#d8cdb8');
}

function buildBeachProps(buckets, rng, collision) {
  const plain = buckets.get('plain');
  const cone = new THREE.ConeGeometry(1.6, 0.6, 10);
  for (let index = 0; index < 46; index += 1) {
    const x = rng.range(262, 290);
    const z = rng.range(-290, 238);
    if (Math.abs(z) < 10) continue;
    const y = beachHeight(x);
    plain.addBox(x, y + 1.15, z, 0.06, 2.3, 0.06, '#f0f0f0');
    plain.addShape(cone, x, y + 2.45, z, rng.pick(UMBRELLA_COLORS));
    plain.addBox(x + 0.9, y + 0.03, z + 0.6, 1.0, 0.04, 1.9, rng.pick(UMBRELLA_COLORS));
  }
  for (const z of [-220, -95, 70, 190]) {
    const x = 282;
    const y = beachHeight(x);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) plain.addBox(x + a * 1.1, y + 1.4, z + b * 1.1, 0.16, 2.8, 0.16, '#f4f4f4');
    plain.addBox(x, y + 3.2, z, 3, 1.8, 3, rng.pick(['#ff6f59', '#43aa8b', '#f9c74f']), { skipBottom: false });
    plain.addBox(x, y + 4.35, z, 3.6, 0.3, 3.6, '#ffffff');
    plain.addBox(x - 2.2, y + 1.2, z, 2.4, 0.1, 0.8, '#f4f4f4', { yaw: 0 });
    collision.addBox(x - 1.4, z - 1.4, x + 1.4, z + 1.4, 3, 'tower');
  }
  // Volleyball nets.
  for (const z of [-150, 120]) {
    const y = beachHeight(274);
    plain.addBox(274, y + 1.2, z - 4, 0.1, 2.4, 0.1, '#ffffff');
    plain.addBox(274, y + 1.2, z + 4, 0.1, 2.4, 0.1, '#ffffff');
    plain.addBox(274, y + 2.1, z, 0.03, 0.8, 8, '#2b2d42');
  }
}

function createSeaMaterial(textures) {
  const normals = textures.waterNormals.clone();
  normals.needsUpdate = true;
  normals.wrapS = THREE.RepeatWrapping;
  normals.wrapT = THREE.RepeatWrapping;
  normals.repeat.set(1, 1);
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.07,
    metalness: 0.05,
    normalMap: normals,
    normalScale: new THREE.Vector2(0.45, 0.45),
    envMapIntensity: 1.1,
  });
}

function buildSea(scene, textures) {
  const material = createSeaMaterial(textures);
  const builder = new MeshBuckets();
  const water = builder.get('sea');
  const shallow = new THREE.Color('#5fd8d2');
  const mid = new THREE.Color('#25a6bf');
  const deep = new THREE.Color('#13708f');
  const color = new THREE.Color();
  const steps = [SHORE.shoreline - 6, 304, 312, 322, 336, 360, 420, 600, 3000];
  for (let index = 0; index < steps.length - 1; index += 1) {
    const xa = steps[index];
    const xb = steps[index + 1];
    const t = index / (steps.length - 2);
    color.copy(shallow).lerp(mid, Math.min(1, t * 2.2));
    if (t > 0.45) color.copy(mid).lerp(deep, (t - 0.45) * 1.8);
    water.addQuad([xa, WATER_LEVEL, 3000], [xb - xa, 0, 0], [0, 0, -6000], color, [xa / 40, -3000 / 40, xb / 40, 3000 / 40]);
  }
  water.addQuad([-3000, WATER_LEVEL, 3000], [SHORE.shoreline - 6 + 3000, 0, 0], [0, 0, SHORE.quayStart - 3000], new THREE.Color('#1c86a6'), [-3000 / 40, -3000 / 40, (SHORE.shoreline - 6) / 40, -SHORE.quayStart / 40]);
  const meshes = builder.flush(scene, { sea: material }, { castShadow: false });
  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(3, SOUTH_LAND - NORTH),
    new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false }),
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(SHORE.shoreline - 0.5, WATER_LEVEL + 0.03, (SOUTH_LAND + NORTH) / 2);
  scene.add(foam);
  return { material, meshes, foam };
}

function buildPier(buckets, atlas, rng, collision) {
  const planks = buckets.get('planks');
  const plain = buckets.get('plain');
  const half = PIER.halfWidth;
  const rampEnd = SHORE.promenadeEnd + 8;
  planks.addQuad([SHORE.promenadeEnd, CURB_HEIGHT + 0.01, half], [rampEnd - SHORE.promenadeEnd, PIER.deck - CURB_HEIGHT, 0], [0, 0, -half * 2], '#ffffff', [0, 0, 2, 3]);
  planks.addFloor(rampEnd, -half, PIER.maxX, half, PIER.deck, '#ffffff', 4);
  plain.addQuad([rampEnd, WATER_LEVEL - 1, half], [PIER.maxX - rampEnd, 0, 0], [0, PIER.deck - WATER_LEVEL + 1, 0], '#6d4c33');
  plain.addQuad([PIER.maxX, WATER_LEVEL - 1, -half], [rampEnd - PIER.maxX, 0, 0], [0, PIER.deck - WATER_LEVEL + 1, 0], '#6d4c33');
  const piling = new THREE.CylinderGeometry(0.35, 0.35, 6, 8);
  for (let x = rampEnd + 2; x < PIER.maxX; x += 8) {
    for (const side of [-1, 1]) plain.addShape(piling, x, PIER.deck - 3, side * (half - 0.4), '#5a3d28');
  }
  for (const side of [-1, 1]) {
    const z = side * (half - 0.15);
    plain.addBox((rampEnd + PIER.maxX) / 2, PIER.deck + 1.05, z, PIER.maxX - rampEnd, 0.12, 0.12, '#f4f1ea');
    for (let x = rampEnd; x <= PIER.maxX; x += 3) plain.addBox(x, PIER.deck + 0.5, z, 0.12, 1.0, 0.12, '#f4f1ea');
    collision.addBox(rampEnd, z - 0.2, PIER.maxX, z + 0.2, 1.2, 'rail');
  }
  collision.addBox(PIER.maxX - 0.3, -half, PIER.maxX + 0.3, half, 1.2, 'rail');
  // Kiosks along the pier.
  for (const [x, color, sign] of [[300, '#ff8fab', 'icecream'], [330, '#ffd166', 'surfShack'], [352, '#90e0ef', 'cafe']]) {
    plain.addBox(x, PIER.deck + 1.4, -3.4, 4, 2.8, 2.6, color);
    plain.addBox(x, PIER.deck + 2.95, -3.4, 4.6, 0.2, 3.4, '#ffffff');
    addFacadeSign(buckets.get('signs'), { x, z: -2.1, ax: 1, az: 0, nx: 0, nz: 1, width: 4 }, atlas.rect(sign), 0, PIER.deck + 2.1, 3.6, 0.9, 0.02);
    collision.addBox(x - 2, -4.7, x + 2, -2.1, 3, 'kiosk');
  }
  // Wheel supports (A-frames either side of the hub).
  for (const side of [-1, 1]) {
    for (const lean of [-1, 1]) {
      const footZ = lean * 9;
      const footX = WHEEL_X + side * 2.2;
      const length = Math.hypot(WHEEL_Y - PIER.deck, footZ);
      const angle = Math.atan2(footZ, WHEEL_Y - PIER.deck);
      const geometry = new THREE.BoxGeometry(0.7, length, 0.7);
      const matrix = new THREE.Matrix4().makeRotationX(angle).setPosition(footX, PIER.deck + (WHEEL_Y - PIER.deck) / 2, footZ / 2);
      buckets.get('shiny').addGeometry(geometry, matrix, '#f4f4f4');
    }
    collision.addBox(WHEEL_X + side * 2.2 - 0.5, -9.5, WHEEL_X + side * 2.2 + 0.5, -8.5, 4, 'wheelLeg');
    collision.addBox(WHEEL_X + side * 2.2 - 0.5, 8.5, WHEEL_X + side * 2.2 + 0.5, 9.5, 4, 'wheelLeg');
  }
  addFacadeSign(buckets.get('signs'), { x: WHEEL_X - 3, z: 0, ax: 0, az: -1, nx: -1, nz: 0, width: 10 }, atlas.rect('wheel'), 0, PIER.deck + 3, 8, 2, 0);
  plain.addBox(WHEEL_X - 2.8, PIER.deck + 2.5, 0, 0.3, 5, 9, '#2a2530');
}

function buildWheel(scene, materials) {
  const group = new THREE.Group();
  group.position.set(WHEEL_X, WHEEL_Y, 0);
  const buckets = new MeshBuckets();
  const frame = buckets.get('shiny');
  const rim = new THREE.TorusGeometry(WHEEL_RADIUS, 0.32, 6, 72);
  const inner = new THREE.TorusGeometry(WHEEL_RADIUS * 0.55, 0.22, 6, 48);
  for (const side of [-1.1, 1.1]) {
    const matrix = new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(side, 0, 0);
    frame.addGeometry(rim, matrix, '#fafafa');
    frame.addGeometry(inner, matrix, '#ff6fb1');
  }
  for (let spoke = 0; spoke < GONDOLAS; spoke += 1) {
    const angle = (spoke / GONDOLAS) * Math.PI * 2;
    const spokeGeometry = new THREE.BoxGeometry(0.12, WHEEL_RADIUS, 0.12);
    for (const side of [-1.1, 1.1]) {
      const matrix = new THREE.Matrix4().makeRotationX(angle).setPosition(side, Math.cos(angle) * WHEEL_RADIUS / 2, Math.sin(angle) * WHEEL_RADIUS / 2);
      frame.addGeometry(spokeGeometry, matrix, '#f0f0f0');
    }
  }
  const hubMatrix = new THREE.Matrix4().makeRotationZ(Math.PI / 2);
  frame.addGeometry(new THREE.CylinderGeometry(1.4, 1.4, 3, 14), hubMatrix, '#c9cdd2');
  const rotor = new THREE.Group();
  buckets.flush(rotor, materials);
  group.add(rotor);
  scene.add(group);
  const gondolaGeometry = new THREE.BoxGeometry(1.8, 1.7, 1.8);
  const gondolas = new THREE.InstancedMesh(gondolaGeometry, new THREE.MeshStandardMaterial({ roughness: 0.4 }), GONDOLAS);
  const palette = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff924c'];
  for (let index = 0; index < GONDOLAS; index += 1) gondolas.setColorAt(index, new THREE.Color(palette[index % palette.length]));
  gondolas.castShadow = true;
  // The gondolas circle a fixed hub, so skip per-frame bounds and never cull them.
  gondolas.frustumCulled = false;
  scene.add(gondolas);
  const matrix = new THREE.Matrix4();
  return {
    rotor,
    gondolas,
    angle: 0,
    update(dt) {
      this.angle += dt * 0.06;
      rotor.rotation.x = this.angle;
      for (let index = 0; index < GONDOLAS; index += 1) {
        const a = this.angle + (index / GONDOLAS) * Math.PI * 2;
        matrix.makeTranslation(WHEEL_X, WHEEL_Y + Math.cos(a) * WHEEL_RADIUS - 1.2, Math.sin(a) * WHEEL_RADIUS);
        gondolas.setMatrixAt(index, matrix);
      }
      gondolas.instanceMatrix.needsUpdate = true;
    },
  };
}

function buildLighthouse(buckets, rng, collision) {
  const plain = buckets.get('plain');
  const rock = new THREE.IcosahedronGeometry(1, 0);
  const matrix = new THREE.Matrix4();
  for (let index = 0; index < 26; index += 1) {
    const x = 300 + rng.range(-16, 16);
    const z = -332 + rng.range(-12, 12);
    const s = rng.range(2, 5.5);
    matrix.makeRotationY(rng.range(0, 6)).scale(new THREE.Vector3(s, s * 0.7, s)).setPosition(x, -0.6 + s * 0.3, z);
    plain.addGeometry(rock, matrix, rng.pick(['#8d8173', '#7a6f63', '#9b8f80']));
  }
  const x = 300;
  const z = -332;
  const base = 1.6;
  const stripes = 7;
  for (let index = 0; index < stripes; index += 1) {
    const r0 = 3.2 - index * 0.15;
    const r1 = 3.2 - (index + 1) * 0.15;
    plain.addShape(new THREE.CylinderGeometry(r1, r0, 3.6, 18), x, base + 1.8 + index * 3.6, z, index % 2 === 0 ? '#f6f4ef' : '#c1121f');
  }
  const top = base + stripes * 3.6;
  plain.addShape(new THREE.CylinderGeometry(3.2, 3.2, 0.4, 18), x, top + 0.2, z, '#2b2d42');
  const lantern = new THREE.CylinderGeometry(1.6, 1.6, 2.4, 12);
  buckets.get('glowLamp').addShape(lantern, x, top + 1.6, z, '#ffffff');
  plain.addShape(new THREE.ConeGeometry(2.1, 2.2, 16), x, top + 3.9, z, '#c1121f');
  plain.addShape(new THREE.CylinderGeometry(3.6, 3.8, 1.6, 18), x, base - 0.4, z, '#e8e1d2');
  collision.addBox(x - 3.6, z - 3.6, x + 3.6, z + 3.6, 30, 'lighthouse');
  return { x, y: top + 1.6, z };
}

function buildQuay(buckets, atlas, rng, collision) {
  const concrete = buckets.get('concrete');
  const plain = buckets.get('plain');
  concrete.addFloor(-345, SHORE.quayStart, SHORE.promenadeEnd, SHORE.quayEdge, CURB_HEIGHT, '#ffffff', 6);
  plain.addQuad([-345, -6, SHORE.quayEdge], [SHORE.promenadeEnd + 345, 0, 0], [0, 6 + CURB_HEIGHT, 0], '#9f998e');
  plain.addQuad([SHORE.promenadeEnd, -6, SHORE.quayEdge], [0, 0, SHORE.quayStart - SHORE.quayEdge], [0, 6 + CURB_HEIGHT, 0], '#9f998e');
  for (let x = -330; x < 250; x += 14) {
    plain.addBox(x, CURB_HEIGHT + 0.35, SHORE.quayEdge - 0.8, 0.5, 0.7, 0.5, '#2b2b2b');
    collision.addBox(x - 0.3, SHORE.quayEdge - 1.1, x + 0.3, SHORE.quayEdge - 0.5, 0.7, 'bollard');
  }
  collision.addBox(-345, SHORE.quayEdge - 0.2, SHORE.promenadeEnd, SHORE.quayEdge + 0.4, 0.5, 'quayLip');
  // Gantry cranes.
  for (const cx of [-260, -95, 70]) {
    const legs = [[-6, 252], [6, 252], [-6, 286], [6, 286]];
    for (const [lx, lz] of legs) {
      plain.addBox(cx + lx, 14, lz, 1.4, 28, 1.4, '#c0392b');
      collision.addBox(cx + lx - 0.8, lz - 0.8, cx + lx + 0.8, lz + 0.8, 28, 'crane');
    }
    plain.addBox(cx - 6, 27, 269, 1.6, 2, 36, '#c0392b');
    plain.addBox(cx + 6, 27, 269, 1.6, 2, 36, '#c0392b');
    plain.addBox(cx, 29.5, 285, 14, 3, 80, '#f1c40f', { skipBottom: false });
    plain.addBox(cx, 26.5, 296, 3, 3, 3, '#2c3e50');
    plain.addBox(cx, 31.5, 247, 10, 4, 8, '#7f8c8d');
  }
  // Pier 9 warehouse: Crane Shipping's.
  const warehouse = { minX: -232, maxX: -168, minZ: 268, maxZ: 288, front: 'n', base: CURB_HEIGHT, height: 12, style: 'warehouse', color: '#c9b8a6', roof: 'clutter', door: true, sign: 'crane' };
  return warehouse;
}

function buildShip(buckets, collision) {
  const plain = buckets.get('plain');
  const x0 = -150;
  const x1 = -20;
  plain.addBox((x0 + x1) / 2, 0.5, 306, x1 - x0, 13, 22, '#1d3557');
  plain.addBox((x0 + x1) / 2, -0.4, 306, x1 - x0 + 0.2, 1.2, 22.2, '#9d0208');
  plain.addBox(x0 + 10, 13, 306, 14, 12, 18, '#f1faee');
  plain.addBox(x0 + 10, 19.5, 306, 15, 1, 20, '#e63946');
  plain.addBox(x0 + 6, 23, 306, 2, 8, 2, '#2b2d42');
  const colors = ['#e76f51', '#2a9d8f', '#e9c46a', '#264653', '#f4a261', '#8ab17d'];
  let k = 0;
  for (let x = x0 + 24; x < x1 - 8; x += 6.6) {
    for (let row = -1; row <= 1; row += 1) {
      const height = 1 + ((k * 7) % 3);
      for (let level = 0; level < height; level += 1) plain.addBox(x, 8.3 + level * 2.6, 306 + row * 5.6, 6.1, 2.55, 2.44, colors[(k + level) % colors.length]);
      k += 1;
    }
  }
  collision.addBox(x0, 295, x1, 317, 14, 'ship');
}

function buildBoats(buckets, rng) {
  const plain = buckets.get('plain');
  const sail = new THREE.BufferGeometry();
  sail.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 5, 0, 9, 0.4], 3));
  sail.computeVertexNormals();
  for (let index = 0; index < 14; index += 1) {
    const x = rng.range(345, 900);
    const z = rng.range(-420, 380);
    if (Math.abs(z) < 30 && x < 420) continue;
    const yaw = rng.range(0, Math.PI * 2);
    if (rng.chance(0.6)) {
      plain.addBox(x, WATER_LEVEL + 0.5, z, 2.2, 1.2, 8, '#ffffff', { yaw });
      plain.addBox(x, WATER_LEVEL + 6, z, 0.15, 10, 0.15, '#dddddd', { yaw });
      const matrix = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, WATER_LEVEL + 1.4, z);
      plain.addGeometry(sail, matrix, '#fdfdfd');
    } else {
      plain.addBox(x, WATER_LEVEL + 0.8, z, 4, 1.8, 14, '#f8f9fa', { yaw });
      plain.addBox(x, WATER_LEVEL + 2.4, z, 3.2, 1.6, 6, '#e9ecef', { yaw });
      plain.addBox(x, WATER_LEVEL + 2.4, z, 3.25, 0.6, 6.05, '#14213d', { yaw });
    }
  }
}

/** Builds the coast and returns its animated parts and extra buildings for the city builder. */
export function buildShoreline(scene, materials, textures, atlas, collision, rng) {
  const buckets = new MeshBuckets();
  buildBeach(buckets);
  buildBeachProps(buckets, rng, collision);
  buildPier(buckets, atlas, rng, collision);
  const lighthouse = buildLighthouse(buckets, rng, collision);
  const warehouse = buildQuay(buckets, atlas, rng, collision);
  buildShip(buckets, collision);
  buildBoats(buckets, rng);
  const group = new THREE.Group();
  scene.add(group);
  const sea = buildSea(scene, textures);
  const wheel = buildWheel(scene, materials);
  return {
    buckets,
    group,
    warehouse,
    lighthouse,
    update(dt, time) {
      wheel.update(dt);
      const map = sea.material.normalMap;
      map.offset.x = time * 0.004;
      map.offset.y = time * 0.0025;
      sea.foam.position.x = SHORE.shoreline - 0.5 + Math.sin(time * 0.6) * 0.9;
      sea.foam.material.opacity = 0.35 + Math.sin(time * 0.6 + 1) * 0.2;
    },
  };
}
