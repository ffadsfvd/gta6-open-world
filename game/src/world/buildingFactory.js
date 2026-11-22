// Turns one building spec into geometry: storefront ground floor, textured body (square,
// round-cornered or stepped back), cornice, art deco fins, striped awnings, shop and rooftop
// neon signs, billboards and roof details.
import * as THREE from 'three';
import { addRoundedPrism } from './roundedPrism.js';

const FACADES = {
  glass: { material: 'glass', tile: [7, 7.6] },
  deco: { material: 'deco', tile: [7.2, 6.8] },
  residential: { material: 'residential', tile: [6.4, 6.6] },
  office: { material: 'office', tile: [6.4, 7.2] },
  warehouse: { material: 'warehouse', tile: [8, 8] },
  house: { material: 'residential', tile: [6, 6.6] },
};
const SHOP_HEIGHT = 4.5;
const roofMatrix = new THREE.Matrix4();
const roofQuaternion = new THREE.Quaternion();
const roofPosition = new THREE.Vector3();
const roofScale = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

function createUnitRoof() {
  const p = [
    0.5, 0, -0.5, -0.5, 0, -0.5, -0.5, 1, 0, 0.5, 0, -0.5, -0.5, 1, 0, 0.5, 1, 0,
    -0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 1, 0, -0.5, 0, 0.5, 0.5, 1, 0, -0.5, 1, 0,
    -0.5, 0, -0.5, -0.5, 0, 0.5, -0.5, 1, 0,
    0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 1, 0,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((p.length / 3) * 2).fill(0.01), 2));
  geometry.computeVertexNormals();
  return geometry;
}

const UNIT_ROOF = createUnitRoof();
const TANK = new THREE.CylinderGeometry(1.1, 1.1, 2.2, 10);
const SPIRE = new THREE.CylinderGeometry(0.15, 0.9, 1, 8);

/** Corner, along-axis and outward normal of a facade side, for placing things on it. */
export function facadeFrame(spec, side) {
  const cx = (spec.minX + spec.maxX) / 2;
  const cz = (spec.minZ + spec.maxZ) / 2;
  switch (side) {
    case 'n': return { x: cx, z: spec.minZ, ax: -1, az: 0, nx: 0, nz: -1, width: spec.maxX - spec.minX };
    case 's': return { x: cx, z: spec.maxZ, ax: 1, az: 0, nx: 0, nz: 1, width: spec.maxX - spec.minX };
    case 'e': return { x: spec.maxX, z: cz, ax: 0, az: -1, nx: 1, nz: 0, width: spec.maxZ - spec.minZ };
    default: return { x: spec.minX, z: cz, ax: 0, az: 1, nx: -1, nz: 0, width: spec.maxZ - spec.minZ };
  }
}

/** A sign quad on a facade, `out` metres in front of it, centred `along` metres from the middle. */
export function addFacadeSign(builder, frame, rect, along, y, width, height, out) {
  const ox = frame.x + frame.nx * out + frame.ax * (along - width / 2);
  const oz = frame.z + frame.nz * out + frame.az * (along - width / 2);
  builder.addQuad([ox, y, oz], [frame.ax * width, 0, frame.az * width], [0, height, 0], '#ffffff', [rect.u0, rect.v0, rect.u1, rect.v1]);
}

function addParapet(builder, spec, top, color) {
  const w = spec.maxX - spec.minX;
  const d = spec.maxZ - spec.minZ;
  const cx = (spec.minX + spec.maxX) / 2;
  const cz = (spec.minZ + spec.maxZ) / 2;
  const t = 0.35;
  builder.addBox(cx, top + 0.45, spec.minZ + t / 2, w, 0.9, t, color);
  builder.addBox(cx, top + 0.45, spec.maxZ - t / 2, w, 0.9, t, color);
  builder.addBox(spec.minX + t / 2, top + 0.45, cz, t, 0.9, d - t * 2, color);
  builder.addBox(spec.maxX - t / 2, top + 0.45, cz, t, 0.9, d - t * 2, color);
}

function addAwning(builder, frame, spec, color, striped) {
  const width = Math.min(frame.width - 1, 16);
  const y = spec.base + 3.3;
  const depth = 1.8;
  const cx = frame.x + frame.nx * (depth / 2);
  const cz = frame.z + frame.nz * (depth / 2);
  const alongX = frame.nx === 0;
  const stripes = striped ? Math.max(3, Math.round(width / 1.1)) : 1;
  const stripeWidth = width / stripes;
  for (let index = 0; index < stripes; index += 1) {
    const offset = -width / 2 + stripeWidth * (index + 0.5);
    const tint = striped && index % 2 === 1 ? '#fbf6ee' : color;
    const sx = cx + (alongX ? offset : 0);
    const sz = cz + (alongX ? 0 : offset);
    builder.addBox(sx, y, sz, alongX ? stripeWidth : depth, 0.14, alongX ? depth : stripeWidth, tint, { skipBottom: false });
    const vx = sx + frame.nx * (depth / 2);
    const vz = sz + frame.nz * (depth / 2);
    builder.addBox(vx, y - 0.25, vz, alongX ? stripeWidth : 0.08, 0.5, alongX ? 0.08 : stripeWidth, tint);
  }
}

function addRoofDetails(buckets, spec, rng, top) {
  const plain = buckets.get('plain');
  const shiny = buckets.get('shiny');
  const cx = (spec.minX + spec.maxX) / 2;
  const cz = (spec.minZ + spec.maxZ) / 2;
  const w = spec.maxX - spec.minX;
  const d = spec.maxZ - spec.minZ;
  switch (spec.roof) {
    case 'pitched': {
      const alongX = w >= d;
      roofQuaternion.setFromAxisAngle(UP, alongX ? 0 : Math.PI / 2);
      roofScale.set((alongX ? w : d) + 0.8, Math.min(w, d) * 0.32, (alongX ? d : w) + 0.8);
      roofPosition.set(cx, top, cz);
      roofMatrix.compose(roofPosition, roofQuaternion, roofScale);
      plain.addGeometry(UNIT_ROOF, roofMatrix, spec.roofColor ?? '#b5533c');
      return;
    }
    case 'tiers': {
      const facade = FACADES[spec.style];
      let tierTop = top;
      let shrink = 0.72;
      for (let tier = 0; tier < 2; tier += 1) {
        const tierHeight = rng.range(6, 14);
        buckets.get(facade.material).addBox(cx, tierTop + tierHeight / 2, cz, w * shrink, tierHeight, d * shrink, spec.color, { tile: facade.tile, topColor: '#cfd3d6' });
        tierTop += tierHeight;
        shrink *= 0.7;
      }
      shiny.addShape(SPIRE, cx, tierTop + 4, cz, '#d9dde2', 0, 1);
      return;
    }
    case 'spire': {
      const facade = FACADES[spec.style];
      buckets.get(facade.material).addBox(cx, top + 5, cz, w * 0.7, 10, d * 0.7, spec.color, { tile: facade.tile, topColor: '#cfd3d6' });
      roofMatrix.makeScale(1.3, 34, 1.3);
      roofMatrix.setPosition(cx, top + 10 + 17, cz);
      shiny.addGeometry(SPIRE, roofMatrix, '#e6e9ec');
      return;
    }
    case 'helipad': {
      plain.addBox(cx, top + 0.2, cz, Math.min(w, d) * 0.7, 0.3, Math.min(w, d) * 0.7, '#3b3f45', { topColor: '#3b3f45' });
      plain.addBox(cx - 1.6, top + 0.4, cz, 0.6, 0.05, 4.4, '#ffd23f');
      plain.addBox(cx + 1.6, top + 0.4, cz, 0.6, 0.05, 4.4, '#ffd23f');
      plain.addBox(cx, top + 0.4, cz, 3.2, 0.05, 0.6, '#ffd23f');
      addParapet(plain, spec, top, spec.trim ?? '#dddddd');
      return;
    }
    case 'crown': {
      const inset = 1.2;
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        shiny.addBox(cx + sx * (w / 2 - inset), top + 4, cz + sz * (d / 2 - inset), 1.2, 8, 1.2, '#e8ecef');
      }
      shiny.addBox(cx, top + 8.2, spec.minZ + inset, w - inset, 0.6, 0.6, '#e8ecef');
      shiny.addBox(cx, top + 8.2, spec.maxZ - inset, w - inset, 0.6, 0.6, '#e8ecef');
      addParapet(plain, spec, top, '#e8ecef');
      return;
    }
    default: {
      addParapet(plain, spec, top, spec.trim ?? '#e6e1d8');
      if (spec.roof === 'clutter' || rng.chance(0.5)) {
        const units = rng.int(1, 3);
        for (let index = 0; index < units; index += 1) {
          const ux = cx + rng.range(-w * 0.3, w * 0.3);
          const uz = cz + rng.range(-d * 0.3, d * 0.3);
          plain.addBox(ux, top + 0.7, uz, 2.2, 1.4, 1.6, '#b8bcc0');
        }
        if (rng.chance(0.35)) {
          const tx = cx + rng.range(-w * 0.25, w * 0.25);
          const tz = cz + rng.range(-d * 0.25, d * 0.25);
          plain.addShape(TANK, tx, top + 2.6, tz, '#8d6e58');
          for (const [lx, lz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) plain.addBox(tx + lx, top + 0.75, tz + lz, 0.15, 1.5, 0.15, '#5b4636');
        }
      }
    }
  }
}

function addRoofSign(buckets, atlas, spec, top) {
  const frame = facadeFrame(spec, spec.front);
  const rect = atlas.rect(spec.roofSign);
  const width = Math.min(frame.width * 0.85, spec.landmark ? 16 : 11);
  const height = width / rect.aspect;
  const y = top + 1.2;
  addFacadeSign(buckets.get('signs'), frame, rect, 0, y, width, height, -0.6);
  const bx = frame.x - frame.nx * 0.85;
  const bz = frame.z - frame.nz * 0.85;
  const alongX = frame.nx === 0;
  buckets.get('plain').addBox(bx, y + height / 2, bz, alongX ? width : 0.3, height, alongX ? 0.3 : width, '#2a2530');
  buckets.get('plain').addBox(bx, top + 0.6, bz, alongX ? width * 0.8 : 0.4, 1.2, alongX ? 0.4 : width * 0.8, '#55505c');
}

function addBillboard(buckets, atlas, spec, top) {
  const frame = facadeFrame(spec, spec.front);
  const rect = atlas.rect(spec.billboard);
  const width = Math.min(13, frame.width * 0.9);
  const height = width / rect.aspect;
  const y = top + 3;
  addFacadeSign(buckets.get('signs'), frame, rect, 0, y, width, height, -2);
  const alongX = frame.nx === 0;
  const bx = frame.x - frame.nx * 2.25;
  const bz = frame.z - frame.nz * 2.25;
  buckets.get('plain').addBox(bx, y + height / 2, bz, alongX ? width + 0.4 : 0.4, height + 0.4, alongX ? 0.4 : width + 0.4, '#3a3a40');
  for (const offset of [-width * 0.3, width * 0.3]) {
    buckets.get('plain').addBox(bx + frame.ax * offset, top + 1.5, bz + frame.az * offset, 0.5, 3, 0.5, '#4a4a50');
  }
}

/** Adds the building to the block's buckets and its footprint to the collision world. */
export function addBuilding(buckets, atlas, spec, rng, collision) {
  const w = spec.maxX - spec.minX;
  const d = spec.maxZ - spec.minZ;
  const cx = (spec.minX + spec.maxX) / 2;
  const cz = (spec.minZ + spec.maxZ) / 2;
  const facade = FACADES[spec.style];
  const color = new THREE.Color(spec.color);
  const roofColor = spec.style === 'glass' ? '#aeb6bd' : '#bdb5a8';
  let bodyStart = spec.base;
  const footprint = spec;
  const round = spec.rounded ? Math.min(w, d) * spec.rounded : 0;
  if (spec.storefront) {
    if (round) addRoundedPrism(buckets.get('storefront'), footprint, spec.base, SHOP_HEIGHT, color, { tile: [6, SHOP_HEIGHT], radius: round });
    else buckets.get('storefront').addBox(cx, spec.base + SHOP_HEIGHT / 2, cz, w, SHOP_HEIGHT, d, color, { tile: [6, SHOP_HEIGHT] });
    bodyStart = spec.base + SHOP_HEIGHT;
    if (round) addRoundedPrism(buckets.get('plain'), footprint, bodyStart, 0.24, spec.trim ?? '#ffffff', { radius: round, grow: 0.25 });
    else buckets.get('plain').addBox(cx, bodyStart + 0.12, cz, w + 0.5, 0.24, d + 0.5, spec.trim ?? '#ffffff');
  }
  const bodyHeight = spec.height - bodyStart;
  const facadeBucket = buckets.get(facade.material);
  if (round) {
    addRoundedPrism(facadeBucket, footprint, bodyStart, bodyHeight, color, { tile: facade.tile, topColor: roofColor, radius: round });
  } else if (spec.setback && bodyHeight > 22) {
    // A stepped tower: the top floors stand back from the street behind a terrace.
    const lower = Math.round((bodyHeight * 0.62) / facade.tile[1]) * facade.tile[1];
    const inset = Math.min(w, d) * 0.14;
    facadeBucket.addBox(cx, bodyStart + lower / 2, cz, w, lower, d, color, { tile: facade.tile, topColor: roofColor });
    buckets.get('plain').addBox(cx, bodyStart + lower + 0.25, cz, w + 0.3, 0.5, d + 0.3, spec.trim ?? '#ffffff');
    facadeBucket.addBox(cx, bodyStart + lower + (bodyHeight - lower) / 2, cz, w - inset * 2, bodyHeight - lower, d - inset * 2, color, { tile: facade.tile, topColor: roofColor, vStart: lower / facade.tile[1] });
  } else {
    facadeBucket.addBox(cx, bodyStart + bodyHeight / 2, cz, w, bodyHeight, d, color, { tile: facade.tile, topColor: roofColor });
  }
  if (spec.style === 'deco') {
    const trim = spec.trim ?? '#ffffff';
    if (round) addRoundedPrism(buckets.get('plain'), footprint, spec.height, 0.6, trim, { radius: round, grow: 0.3 });
    else buckets.get('plain').addBox(cx, spec.height + 0.3, cz, w + 0.6, 0.6, d + 0.6, trim);
    const bands = Math.floor((spec.height - bodyStart) / 6.8);
    for (let band = 1; band <= bands; band += 2) {
      if (round) addRoundedPrism(buckets.get('plain'), footprint, bodyStart + band * 6.8 - 0.21, 0.22, trim, { radius: round, grow: 0.08 });
      else buckets.get('plain').addBox(cx, bodyStart + band * 6.8 - 0.1, cz, w + 0.16, 0.22, d + 0.16, trim);
    }
  }
  if (spec.fin) {
    const frame = facadeFrame(spec, spec.front);
    const finHeight = spec.height - bodyStart + 5;
    const fx = frame.x + frame.nx * 0.5;
    const fz = frame.z + frame.nz * 0.5;
    buckets.get('plain').addBox(fx, bodyStart + finHeight / 2, fz, frame.nx === 0 ? 1.4 : 1.0, finHeight, frame.nx === 0 ? 1.0 : 1.4, spec.trim ?? '#ffffff');
  }
  if (spec.door) {
    const frame = facadeFrame(spec, spec.front);
    const alongX = frame.nx === 0;
    buckets.get('plain').addBox(frame.x + frame.nx * 0.1, spec.base + 2.6, frame.z + frame.nz * 0.1, alongX ? 6.5 : 0.3, 5.2, alongX ? 0.3 : 6.5, '#7d8590');
  }
  if (spec.awning) {
    addAwning(buckets.get('plain'), facadeFrame(spec, spec.front), spec, spec.awning, rng.chance(0.55));
  }
  if (spec.sign) {
    const frame = facadeFrame(spec, spec.front);
    const rect = atlas.rect(spec.sign);
    const width = Math.min(frame.width - 1.2, 5.2);
    addFacadeSign(buckets.get('signs'), frame, rect, frame.width > 12 ? -frame.width * 0.18 : 0, spec.base + 3.55, width, width / rect.aspect, 0.08);
  }
  addRoofDetails(buckets, spec, rng, spec.height);
  if (spec.roofSign) addRoofSign(buckets, atlas, spec, spec.height + (spec.style === 'deco' ? 0.6 : 0));
  if (spec.billboard) addBillboard(buckets, atlas, spec, spec.height + 0.9);
  if (collision) collision.addBox(spec.minX, spec.minZ, spec.maxX, spec.maxZ, spec.height, 'building');
}
