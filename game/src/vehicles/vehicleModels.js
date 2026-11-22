// Builds each vehicle model from its side profile: a rounded, extruded body with wheel arches
// cut out of it (painted per car), a painted cabin with dark tinted windows, and trim (bumpers,
// grille, round lamps, plates, mirrors, rocker strips, police bar, taxi sign). The whole shell is
// then shaped like a real car body (rounded in plan at nose and tail, the cabin narrowing toward
// the roof) and smoothly shaded. Also records where its lights, wheels, driver seat and door
// are, for glow, physics and AI.
import * as THREE from 'three';
import { GeometryBuilder } from '../render/geometryBuilder.js';
import { VEHICLE_TYPES } from './vehicleTypes.js';

const BEVEL = 0.11;
const BEVEL_SIZE = BEVEL * 0.75;
const DARK = '#1e1f23';
const CHROME = '#d9dde3';
const WINDOW = '#0b1016';
const ARCH_GAP = 0.07;
const PILLAR = 0.075;

/** Rounds every corner of a closed polygon with an arc of up to `radius`, clamped to its edges. */
function roundProfile(points, radius, segments = 4) {
  const result = [];
  const n = points.length;
  for (let i = 0; i < n; i += 1) {
    const p = points[i];
    const prev = points[(i + n - 1) % n];
    const next = points[(i + 1) % n];
    const inLength = Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    const outLength = Math.hypot(next[0] - p[0], next[1] - p[1]);
    const r = Math.min(radius, inLength * 0.45, outLength * 0.45);
    if (r < 0.01) {
      result.push(p);
      continue;
    }
    const a = [p[0] + ((prev[0] - p[0]) / inLength) * r, p[1] + ((prev[1] - p[1]) / inLength) * r];
    const b = [p[0] + ((next[0] - p[0]) / outLength) * r, p[1] + ((next[1] - p[1]) / outLength) * r];
    for (let s = 0; s <= segments; s += 1) {
      const t = s / segments;
      const u = 1 - t;
      result.push([u * u * a[0] + 2 * u * t * p[0] + t * t * b[0], u * u * a[1] + 2 * u * t * p[1] + t * t * b[1]]);
    }
  }
  return result;
}

/** Cuts a round arch over each wheel into the bottom edge of a rounded body outline. */
function withWheelArches(outline, bottomEdge, spec) {
  const y0 = spec.body[0][1];
  const centerY = spec.wheelRadius;
  const radius = spec.wheelRadius + ARCH_GAP;
  const arches = [];
  for (const wheelZ of [-spec.wheelBase, spec.wheelBase]) {
    const dy = y0 - centerY;
    if (Math.abs(dy) >= radius) continue;
    const beta = Math.asin(dy / radius);
    // Over the top of the wheel, from its rear side to its front side.
    for (let step = 0; step <= 12; step += 1) {
      const angle = Math.PI - beta + ((2 * beta - Math.PI) * step) / 12;
      arches.push([wheelZ + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius]);
    }
  }
  return [...outline.slice(0, bottomEdge + 1), ...arches, ...outline.slice(bottomEdge + 1)];
}

/** Moves every edge of a convex polygon inward by `d`. */
function insetPolygon(points, d) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }
  const sign = area > 0 ? 1 : -1;
  const lines = points.map((p, i) => {
    const q = points[(i + 1) % points.length];
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const length = Math.hypot(dx, dy) || 1;
    return { px: p[0] + (-dy / length) * sign * d, py: p[1] + (dx / length) * sign * d, dx, dy };
  });
  return lines.map((line, i) => {
    const prev = lines[(i + lines.length - 1) % lines.length];
    const det = prev.dx * line.dy - prev.dy * line.dx;
    if (Math.abs(det) < 1e-9) return [line.px, line.py];
    const t = ((line.px - prev.px) * line.dy - (line.py - prev.py) * line.dx) / det;
    return [prev.px + prev.dx * t, prev.py + prev.dy * t];
  });
}

/** Keeps the part of a polygon on one side of the vertical line z = cut. */
function clipZ(points, cut, keepBelow) {
  const inside = (p) => (keepBelow ? p[0] <= cut : p[0] >= cut);
  const out = [];
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (inside(a)) out.push(a);
    if (inside(a) !== inside(b)) out.push([cut, a[1] + ((b[1] - a[1]) * (cut - a[0])) / (b[0] - a[0])]);
  }
  return out;
}

function addExtrusion(builder, points, width, color) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const depth = width - BEVEL * 2;
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL_SIZE,
    bevelSegments: 3,
    curveSegments: 1,
  });
  const matrix = new THREE.Matrix4().makeRotationY(-Math.PI / 2).setPosition(depth / 2, 0, 0);
  builder.addGeometry(geometry, matrix, color);
  geometry.dispose();
}

/** A flat polygon (points as [z, y]) on the car's side at x = side * x, facing outward. */
function addSidePolygon(builder, polygon, x, side, color) {
  if (polygon.length < 3) return;
  const triangles = THREE.ShapeUtils.triangulateShape(polygon.map(([z, y]) => new THREE.Vector2(z, y)), []);
  const c = new THREE.Color(color);
  const base = builder.vertexCount;
  for (const [z, y] of polygon) builder.pushVertex(x * side, y, z, side, 0, 0, 0, 0, c);
  for (const [i0, i1, i2] of triangles) {
    const p0 = polygon[i0];
    const p1 = polygon[i1];
    const p2 = polygon[i2];
    const nx = (p1[1] - p0[1]) * (p2[0] - p0[0]) - (p1[0] - p0[0]) * (p2[1] - p0[1]);
    if (Math.sign(nx) === side) builder.indices.push(base + i0, base + i1, base + i2);
    else builder.indices.push(base + i0, base + i2, base + i1);
  }
}

/** A window pane on a sloped cabin face from `low` to `high` ([z, y]), raised off the paint. */
function addSlopeWindow(builder, low, high, halfWidth, color, facing) {
  const dz = high[0] - low[0];
  const dy = high[1] - low[1];
  const length = Math.hypot(dz, dy);
  const margin = 0.16;
  if (length < margin * 2.5) return;
  const ny = (-dz / length) * facing;
  const nz = (dy / length) * facing;
  const lift = BEVEL_SIZE + 0.014;
  const start = [low[0] + (dz / length) * margin + nz * lift, low[1] + (dy / length) * margin + ny * lift];
  const along = [(dz / length) * (length - margin * 2), (dy / length) * (length - margin * 2)];
  const x = halfWidth - PILLAR;
  if (facing > 0) builder.addQuad([-x, start[1], start[0]], [x * 2, 0, 0], [0, along[1], along[0]], color);
  else builder.addQuad([x, start[1], start[0]], [-x * 2, 0, 0], [0, along[1], along[0]], color);
}

/** Bends a model into a car body: rounded nose and tail in plan, the cabin narrowing upward. */
function shapeBody(geometry, spec, beltY, roofY) {
  const position = geometry.getAttribute('position');
  const halfLength = spec.length / 2;
  const bottom = spec.body[0][1];
  const tumble = spec.vanWindows ? 0.07 : 0.17;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const t = Math.min(1, Math.abs(z) / halfLength);
    const plan = 1 - 0.1 * t ** 4 - (z > 0 ? 0.035 : 0.02) * t * t;
    const up = y <= beltY ? 0 : Math.min(1, (y - beltY) / Math.max(0.05, roofY - beltY));
    const narrow = 1 - tumble * up * (0.6 + 0.4 * up);
    const k = (y - (bottom + beltY) / 2) / Math.max(0.05, (beltY - bottom) / 2);
    const barrel = y <= beltY ? 1 - 0.04 * Math.max(0, k * k - 0.15) : 1;
    position.setX(i, x * plan * narrow * barrel);
  }
  position.needsUpdate = true;
}

/** Smooth shading across faces that meet at less than `maxAngle`; sharper creases stay crisp. */
function smoothNormals(geometry, maxAngle = 0.8) {
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const index = geometry.getIndex();
  const faces = index.count / 3;
  const faceNormals = [];
  const vertexFace = new Int32Array(position.count).fill(-1);
  const groups = new Map();
  const key = (i) => `${Math.round(position.getX(i) * 500)},${Math.round(position.getY(i) * 500)},${Math.round(position.getZ(i) * 500)}`;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let f = 0; f < faces; f += 1) {
    const ids = [index.getX(f * 3), index.getX(f * 3 + 1), index.getX(f * 3 + 2)];
    a.fromBufferAttribute(position, ids[0]);
    b.fromBufferAttribute(position, ids[1]);
    c.fromBufferAttribute(position, ids[2]);
    const n = new THREE.Vector3().subVectors(c, b).cross(a.sub(b));
    faceNormals.push(n);
    for (const id of ids) {
      vertexFace[id] = f;
      const k = key(id);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(f);
    }
  }
  const limit = Math.cos(maxAngle);
  const reference = new THREE.Vector3();
  const other = new THREE.Vector3();
  const sum = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 1) {
    if (vertexFace[i] < 0) continue;
    reference.copy(faceNormals[vertexFace[i]]).normalize();
    sum.set(0, 0, 0);
    for (const f of groups.get(key(i))) {
      other.copy(faceNormals[f]);
      if (other.lengthSq() === 0) continue;
      if (other.clone().normalize().dot(reference) >= limit) sum.add(other);
    }
    if (sum.lengthSq() === 0) sum.copy(reference);
    sum.normalize();
    normal.setXYZ(i, sum.x, sum.y, sum.z);
  }
  normal.needsUpdate = true;
}

/** Dark tinted windows: windscreen, rear window and the side glass split by pillars. */
function addWindows(paint, spec, cabin, cabinWidth) {
  const half = cabinWidth / 2;
  addSlopeWindow(paint, cabin[0], cabin[1], half, WINDOW, 1);
  addSlopeWindow(paint, cabin[3], cabin[2], half, WINDOW, -1);
  const glass = insetPolygon(cabin, PILLAR);
  const length = cabin[1][0] - cabin[2][0];
  let panes = [glass];
  if (length > 1.6) {
    const cuts = length > 2.4 ? [cabin[1][0] - length * 0.38, cabin[1][0] - length * 0.72] : [(cabin[1][0] + cabin[2][0]) / 2 + 0.05];
    panes = [];
    let rest = glass;
    for (const cut of cuts) {
      panes.push(clipZ(rest, cut + 0.045, false));
      rest = clipZ(rest, cut - 0.045, true);
    }
    panes.push(rest);
  }
  for (const side of [-1, 1]) {
    for (const pane of panes) addSidePolygon(paint, pane, half + 0.012, side, WINDOW);
  }
}

function addLamp(trim, x, y, z, width, height, color, facing) {
  const lens = new THREE.CylinderGeometry(1, 1, 0.05, 14);
  const m = new THREE.Matrix4().makeRotationX(Math.PI / 2).premultiply(new THREE.Matrix4().makeScale(width / 2, height / 2, 1)).setPosition(x, y, z + facing * 0.012);
  trim.addGeometry(lens, m, color);
  const bezel = new THREE.Matrix4().makeRotationX(Math.PI / 2).premultiply(new THREE.Matrix4().makeScale(width / 2 + 0.03, height / 2 + 0.025, 1)).setPosition(x, y, z - facing * 0.01);
  trim.addGeometry(lens, bezel, CHROME);
  lens.dispose();
}

function buildModel(spec) {
  const paint = new GeometryBuilder();
  const trim = new GeometryBuilder();
  const W = spec.width;
  const L = spec.length;
  const body = spec.body;
  const y0 = body[0][1];
  // The outline is rounded first; its bottom edge runs between the arcs of corners 0 and 1.
  addExtrusion(paint, withWheelArches(roundProfile(body, 0.16, 4), 4, spec), W, '#ffffff');
  let roofY = Math.max(...body.map(([, y]) => y));
  let beltY = roofY;
  let cabinMidZ = 0;
  if (spec.cabin) {
    const cabin = spec.cabin;
    const cabinWidth = W - 0.24;
    addExtrusion(paint, roundProfile(cabin, 0.12), cabinWidth, '#ffffff');
    addWindows(paint, spec, cabin, cabinWidth);
    roofY = cabin[1][1];
    beltY = Math.min(cabin[0][1], cabin[3][1]);
    cabinMidZ = (cabin[0][0] + cabin[3][0]) / 2;
  }
  if (spec.vanWindows) {
    beltY = 1.3;
    roofY = 2.35;
    cabinMidZ = 1.4;
    addSlopeWindow(paint, body[4], body[5], W / 2, WINDOW, 1);
    for (const side of [-1, 1]) addSidePolygon(paint, [[0.62, 1.42], [1.58, 1.42], [1.2, 2.12], [0.62, 2.12]], W / 2 + 0.012, side, WINDOW);
  }
  if (spec.lightBar) {
    // Cruiser livery: dark doors on the white body.
    for (const side of [-1, 1]) addSidePolygon(paint, [[-1.0, y0 + 0.17], [1.0, y0 + 0.17], [1.0, beltY - 0.09], [-1.0, beltY - 0.09]], W / 2 + 0.01, side, '#15171c');
  }
  const front = body[2];
  const rearTop = body[body.length - 1];
  const headY = front[1] - 0.06;
  const tailY = rearTop[1] - 0.1;
  const bumperY = y0 + 0.1;
  // Bumpers with a dark lip, grille, rocker strips, wheel wells, mirrors, plates, exhaust.
  trim.addBox(0, bumperY, L / 2 + 0.02, W - 0.12, 0.2, 0.16, DARK, { skipBottom: false });
  trim.addBox(0, bumperY, -L / 2 - 0.02, W - 0.12, 0.2, 0.16, DARK, { skipBottom: false });
  trim.addBox(0, headY - 0.03, front[0] + 0.03, W * 0.46, 0.17, 0.06, CHROME);
  trim.addBox(0, headY - 0.03, front[0] + 0.05, W * 0.42, 0.13, 0.05, '#101114');
  trim.addBox(0, bumperY + 0.04, L / 2 + 0.11, 0.34, 0.11, 0.02, '#f2f0e6');
  trim.addBox(0, tailY - 0.14, rearTop[0] - 0.05, 0.34, 0.11, 0.02, '#f2f0e6');
  const between = spec.wheelBase - spec.wheelRadius - ARCH_GAP - 0.05;
  trim.addBox(0, y0 + 0.06, 0, W - 0.75, 0.12, between * 2, '#151619', { skipBottom: false });
  for (const side of [-1, 1]) trim.addBox(side * (W / 2 - 0.02), y0 + 0.07, 0, 0.07, 0.1, between * 2, DARK);
  for (const wheelZ of [-spec.wheelBase, spec.wheelBase]) {
    const r = spec.wheelRadius + ARCH_GAP;
    trim.addBox(0, spec.wheelRadius + r * 0.5, wheelZ, W - 0.75, r * 0.95, r * 1.8, '#0e0f11', { skipBottom: false });
  }
  const exhaust = new THREE.CylinderGeometry(0.05, 0.05, 0.25, 8);
  trim.addGeometry(exhaust, new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(-W * 0.3, y0 + 0.08, -L / 2 - 0.05), CHROME);
  exhaust.dispose();
  const mirrorZ = spec.cabin ? spec.cabin[0][0] - 0.2 : 1.6;
  const mirrorY = spec.cabin ? spec.cabin[0][1] + 0.12 : 1.5;
  for (const side of [-1, 1]) {
    trim.addBox(side * (W / 2 + 0.03), mirrorY - 0.05, mirrorZ + 0.04, 0.1, 0.05, 0.06, DARK);
    trim.addBox(side * (W / 2 + 0.09), mirrorY, mirrorZ, 0.15, 0.12, 0.13, DARK);
  }
  // Lamps: round headlamps in chrome bezels, wide tail lamps.
  const heads = [];
  const tails = [];
  for (const side of [-1, 1]) {
    const x = side * (W / 2 - 0.36);
    addLamp(trim, x, headY, front[0] + 0.02, 0.4, 0.17, '#fff6d6', 1);
    trim.addBox(x, tailY, rearTop[0] - 0.02, 0.46, 0.13, 0.06, '#c4000a');
    trim.addBox(x - side * 0.2, tailY, rearTop[0] - 0.03, 0.12, 0.1, 0.06, '#f4f4f4');
    heads.push([x, headY, front[0] + 0.08]);
    tails.push([x, tailY, rearTop[0] - 0.08]);
  }
  const bars = [];
  if (spec.lightBar) {
    trim.addBox(0.32, roofY + 0.13, cabinMidZ, 0.6, 0.14, 0.3, '#e00000', { skipBottom: false });
    trim.addBox(-0.32, roofY + 0.13, cabinMidZ, 0.6, 0.14, 0.3, '#0047ff', { skipBottom: false });
    trim.addBox(0, roofY + 0.08, cabinMidZ, 1.4, 0.05, 0.34, '#2b2d31');
    bars.push([0.34, roofY + 0.2, cabinMidZ, 'red'], [-0.34, roofY + 0.2, cabinMidZ, 'blue']);
    trim.addBox(0, bumperY + 0.15, L / 2 + 0.2, W * 0.6, 0.4, 0.08, '#18191c');
  }
  if (spec.taxiSign) {
    trim.addBox(0, roofY + 0.15, cabinMidZ, 0.75, 0.22, 0.26, '#fff3b0', { skipBottom: false });
    for (const side of [-1, 1]) {
      for (let index = 0; index < 10; index += 1) {
        trim.addBox(side * (W / 2 + 0.004), 0.86, -1.4 + index * 0.3, 0.02, 0.1, 0.15, index % 2 === 0 ? '#111111' : '#ffffff');
      }
    }
  }
  if (spec.spoiler) {
    paint.addBox(0, rearTop[1] + 0.32, rearTop[0] + 0.22, W - 0.3, 0.05, 0.32, '#ffffff', { skipBottom: false });
    for (const side of [-1, 1]) trim.addBox(side * 0.6, rearTop[1] + 0.16, rearTop[0] + 0.25, 0.06, 0.3, 0.08, DARK);
  }
  if (spec.bed) {
    for (const side of [-1, 1]) paint.addBox(side * (W / 2 - 0.06), 1.1, -1.6, 0.12, 0.26, 2.0, '#ffffff');
    paint.addBox(0, 1.1, -2.56, W - 0.1, 0.26, 0.1, '#ffffff');
    trim.addBox(0, 0.99, -1.6, W - 0.25, 0.03, 1.95, '#2b2b2b');
  }
  const paintGeometry = paint.build();
  const trimGeometry = trim.build();
  shapeBody(paintGeometry, spec, beltY, roofY);
  shapeBody(trimGeometry, spec, beltY, roofY);
  smoothNormals(paintGeometry);
  const seatZ = spec.cabin ? cabinMidZ + 0.25 : 1.3;
  return {
    paint: paintGeometry,
    trim: trimGeometry,
    glass: null,
    lights: { heads, tails, bars },
    seat: { x: W * 0.22, y: Math.max(0.42, y0 + 0.18), z: seatZ },
    door: { x: W / 2 + 0.75, z: seatZ },
    roofY,
    wheels: [
      [W / 2 - 0.2, spec.wheelBase, true],
      [-(W / 2 - 0.2), spec.wheelBase, true],
      [W / 2 - 0.2, -spec.wheelBase, false],
      [-(W / 2 - 0.2), -spec.wheelBase, false],
    ],
  };
}

/** A unit wheel (radius 1, axle along X): a rounded tyre, a five-spoke alloy rim and the hub. */
export function createWheelGeometry() {
  const builder = new GeometryBuilder();
  const turn = new THREE.Matrix4().makeRotationZ(Math.PI / 2);
  const section = [[0.64, -0.13], [0.86, -0.14], [0.96, -0.115], [1, -0.07], [1, 0.07], [0.96, 0.115], [0.86, 0.14], [0.64, 0.13]];
  const tyre = new THREE.LatheGeometry(section.map(([r, y]) => new THREE.Vector2(r, y)), 22);
  builder.addGeometry(tyre, turn, '#1a1a1c');
  tyre.dispose();
  for (const face of [-1, 1]) {
    const ring = new THREE.CylinderGeometry(0.66, 0.66, 0.03, 22, 1, true);
    builder.addGeometry(ring, new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(face * 0.11, 0, 0), CHROME);
    ring.dispose();
    const disc = new THREE.CylinderGeometry(0.6, 0.6, 0.01, 22);
    builder.addGeometry(disc, new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(face * 0.07, 0, 0), '#2b2d31');
    disc.dispose();
    const hub = new THREE.CylinderGeometry(0.14, 0.16, 0.05, 10);
    builder.addGeometry(hub, new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(face * 0.115, 0, 0), CHROME);
    hub.dispose();
    const spoke = new THREE.BoxGeometry(0.04, 0.5, 0.11);
    for (let index = 0; index < 5; index += 1) {
      const angle = (index / 5) * Math.PI * 2;
      const m = new THREE.Matrix4().makeRotationX(angle).setPosition(face * 0.11, Math.cos(angle) * 0.36, Math.sin(angle) * 0.36);
      builder.addGeometry(spoke, m, CHROME);
    }
    spoke.dispose();
  }
  return builder.build();
}

let cache = null;

/** Models for every vehicle type, built once. */
export function getVehicleModels() {
  if (!cache) {
    cache = {};
    for (const [type, spec] of Object.entries(VEHICLE_TYPES)) cache[type] = buildModel(spec);
  }
  return cache;
}
