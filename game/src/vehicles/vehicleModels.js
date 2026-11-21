// Builds each vehicle model from its side profile: an extruded, bevelled body (painted per car),
// a tinted glass cabin, and trim (bumpers, grille, lights, mirrors, police bar, taxi sign).
// Also records where its lights, wheels, driver seat and door are, for glow, physics and AI.
import * as THREE from 'three';
import { GeometryBuilder } from '../render/geometryBuilder.js';
import { VEHICLE_TYPES } from './vehicleTypes.js';

const BEVEL = 0.06;
const DARK = '#232428';

function addExtrusion(builder, points, width, color) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const depth = width - BEVEL * 2;
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL * 0.7,
    bevelSegments: 2,
    curveSegments: 1,
  });
  const matrix = new THREE.Matrix4().makeRotationY(-Math.PI / 2).setPosition(depth / 2, 0, 0);
  builder.addGeometry(geometry, matrix, color);
  geometry.dispose();
}

function buildModel(spec) {
  const paint = new GeometryBuilder();
  const trim = new GeometryBuilder();
  const glass = new GeometryBuilder();
  const W = spec.width;
  const L = spec.length;
  const body = spec.body;
  addExtrusion(paint, body, W, '#ffffff');
  let roofY = 0;
  let cabinMidZ = 0;
  if (spec.cabin) {
    addExtrusion(glass, spec.cabin, W - 0.24, '#ffffff');
    const roofFront = spec.cabin[1];
    const roofBack = spec.cabin[2];
    roofY = roofFront[1];
    cabinMidZ = (spec.cabin[0][0] + spec.cabin[3][0]) / 2;
    paint.addBox(0, roofY + 0.03, (roofFront[0] + roofBack[0]) / 2, W - 0.2, 0.07, roofFront[0] - roofBack[0] + 0.08, '#ffffff', { skipBottom: false });
  }
  if (spec.vanWindows) {
    roofY = 2.35;
    cabinMidZ = 1.4;
    const span = W - 0.3;
    glass.addQuad([-span / 2, 1.38, 1.73], [span, 0, 0], [0, 0.82, -0.45], '#ffffff');
    for (const side of [-1, 1]) glass.addBox(side * (W / 2 + 0.01), 1.75, 1.15, 0.04, 0.6, 0.85, '#ffffff');
  }
  const front = body[2];
  const rearTop = body[body.length - 1];
  const headY = front[1] - 0.08;
  const tailY = rearTop[1] - 0.1;
  const bumperY = body[0][1] + 0.12;
  // Bumpers, grille, underbody, mirrors.
  trim.addBox(0, bumperY, L / 2 + 0.03, W - 0.08, 0.24, 0.2, DARK, { skipBottom: false });
  trim.addBox(0, bumperY, -L / 2 - 0.03, W - 0.08, 0.24, 0.2, DARK, { skipBottom: false });
  trim.addBox(0, headY - 0.02, L / 2 + 0.02, W * 0.42, 0.16, 0.05, '#141518');
  trim.addBox(0, body[0][1] + 0.02, 0, W - 0.24, 0.16, L - 0.7, '#1b1c1f', { skipBottom: false });
  const mirrorZ = spec.cabin ? spec.cabin[0][0] - 0.25 : 1.6;
  const mirrorY = spec.cabin ? spec.cabin[0][1] + 0.12 : 1.5;
  for (const side of [-1, 1]) trim.addBox(side * (W / 2 + 0.07), mirrorY, mirrorZ, 0.16, 0.11, 0.14, DARK);
  // Lamps.
  const heads = [];
  const tails = [];
  for (const side of [-1, 1]) {
    const x = side * (W / 2 - 0.34);
    trim.addBox(x, headY, front[0] + 0.02, 0.4, 0.13, 0.06, '#fff8dc');
    trim.addBox(x, tailY, rearTop[0] - 0.02, 0.38, 0.12, 0.06, '#d00000');
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
    for (const side of [-1, 1]) trim.addBox(side * (W / 2 + 0.004), 0.62, -0.1, 0.02, 0.32, 1.9, '#111214');
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
  const seatZ = spec.cabin ? cabinMidZ + 0.25 : 1.3;
  return {
    paint: paint.build(),
    trim: trim.build(),
    glass: glass.isEmpty ? null : glass.build(),
    lights: { heads, tails, bars },
    seat: { x: W * 0.22, y: Math.max(0.42, body[0][1] + 0.18), z: seatZ },
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

/** A unit wheel (radius 1, axle along X): tyre, rim and hub; scaled per model. */
export function createWheelGeometry() {
  const builder = new GeometryBuilder();
  const turn = new THREE.Matrix4().makeRotationZ(Math.PI / 2);
  builder.addGeometry(new THREE.CylinderGeometry(1, 1, 0.26, 16), turn, '#18181a');
  const rim = new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(0.135, 0, 0);
  builder.addGeometry(new THREE.CylinderGeometry(0.62, 0.62, 0.02, 12), rim, '#c9ccd1');
  const rimInner = new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(-0.135, 0, 0);
  builder.addGeometry(new THREE.CylinderGeometry(0.62, 0.62, 0.02, 12), rimInner, '#c9ccd1');
  for (let spoke = 0; spoke < 5; spoke += 1) {
    const angle = (spoke / 5) * Math.PI * 2;
    builder.addBox(0.14, Math.cos(angle) * 0.3, Math.sin(angle) * 0.3, 0.03, 0.12, 0.12, '#3d3f44');
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
