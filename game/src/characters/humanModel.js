// Body-part geometry for the people of the city, smooth-shaded and rounded: tapered limbs with
// knees, hands and shoes, an oval chest with shoulders, a head with jaw, nose, ears, eyes and
// brows, two hair styles, a cap, sleeves, shorts and a skirt. Each part's origin is its joint
// (hip, waist, shoulder, neck), so the animator only rotates and places parts; the colour comes
// per instance (skin, shirt, trousers, hair), darker vertex colours mark shoes, belt and eyes.
import * as THREE from 'three';
import { GeometryBuilder } from '../render/geometryBuilder.js';

const SHOE = '#2a2a2e';
const DARK = '#1c1714';

/** A tapered tube from y = top down to y = bottom (radii r1 at the top, r2 at the bottom). */
function addTube(b, top, bottom, r1, r2, color, x = 0, z = 0, sides = 10, scaleZ = 1) {
  const height = top - bottom;
  const geometry = new THREE.CylinderGeometry(r1, r2, height, sides, 1, false);
  const m = new THREE.Matrix4().makeScale(1, 1, scaleZ).setPosition(x, (top + bottom) / 2, z);
  b.addGeometry(geometry, m, color);
  geometry.dispose();
}

function addBall(b, x, y, z, sx, sy, sz, color, detail = 10) {
  const geometry = new THREE.SphereGeometry(1, detail, Math.max(6, Math.round(detail * 0.7)));
  b.addGeometry(geometry, new THREE.Matrix4().makeScale(sx, sy, sz).setPosition(x, y, z), color);
  geometry.dispose();
}

function addShoe(b) {
  addBall(b, 0, -0.875, 0.035, 0.062, 0.05, 0.125, SHOE);
  b.addBox(0, -0.905, 0.035, 0.11, 0.03, 0.24, '#151518', { skipBottom: false });
}

/** Trousers to the ankle with the shoe. */
function legGeometry() {
  const b = new GeometryBuilder();
  addTube(b, 0.02, -0.47, 0.098, 0.074, '#ffffff');
  addBall(b, 0, -0.47, 0.008, 0.074, 0.06, 0.078, '#ffffff', 8);
  addTube(b, -0.47, -0.85, 0.072, 0.056, '#ffffff');
  addShoe(b);
  return b.build();
}

/** A bare leg (worn under shorts or a skirt): thigh, knee, calf, ankle and shoe. */
function bareLegGeometry() {
  const b = new GeometryBuilder();
  addTube(b, 0.0, -0.46, 0.088, 0.062, '#ffffff');
  addBall(b, 0, -0.46, 0.01, 0.062, 0.055, 0.066, '#ffffff', 8);
  addTube(b, -0.46, -0.66, 0.062, 0.058, '#ffffff', 0, -0.006);
  addTube(b, -0.66, -0.85, 0.058, 0.04, '#ffffff');
  addShoe(b);
  return b.build();
}

function shortsGeometry() {
  const b = new GeometryBuilder();
  addTube(b, 0.03, -0.3, 0.106, 0.096, '#ffffff', 0, 0, 10);
  return b.build();
}

/** A skirt hung from the pelvis joint, flaring to the knee. */
function skirtGeometry() {
  const b = new GeometryBuilder();
  addTube(b, 0.08, -0.42, 0.2, 0.27, '#ffffff', 0, 0, 14, 0.72);
  return b.build();
}

function torsoGeometry() {
  const b = new GeometryBuilder();
  const profile = [[0.0, 0], [0.152, 0.0], [0.162, 0.1], [0.182, 0.26], [0.19, 0.36], [0.183, 0.44], [0.15, 0.51], [0.08, 0.555], [0.0, 0.565]];
  const lathe = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 14);
  b.addGeometry(lathe, new THREE.Matrix4().makeScale(1.22, 1, 0.7), '#ffffff');
  lathe.dispose();
  for (const side of [-1, 1]) addBall(b, side * 0.192, 0.465, 0, 0.066, 0.06, 0.068, '#ffffff', 8);
  addTube(b, 0.585, 0.54, 0.062, 0.07, '#ffffff', 0, 0.004, 10);
  return b.build();
}

function pelvisGeometry() {
  const b = new GeometryBuilder();
  addBall(b, 0, -0.03, 0, 0.19, 0.13, 0.125, '#ffffff', 12);
  b.addBox(0, 0.06, 0, 0.36, 0.045, 0.23, '#3a2c22', { skipBottom: false });
  b.addBox(0, 0.06, 0.115, 0.06, 0.04, 0.012, '#c9b27c');
  return b.build();
}

function headGeometry() {
  const b = new GeometryBuilder();
  addTube(b, 0.09, -0.01, 0.048, 0.054, '#ffffff', 0, 0, 10);
  addBall(b, 0, 0.165, -0.006, 0.108, 0.122, 0.116, '#ffffff', 16);
  addBall(b, 0, 0.1, 0.03, 0.082, 0.07, 0.085, '#ffffff', 12);
  addBall(b, 0, 0.152, 0.112, 0.018, 0.026, 0.024, '#ffffff', 6);
  for (const side of [-1, 1]) {
    addBall(b, side * 0.106, 0.158, -0.005, 0.018, 0.03, 0.014, '#ffffff', 6);
    addBall(b, side * 0.04, 0.178, 0.1, 0.017, 0.013, 0.01, DARK, 6);
    b.addBox(side * 0.042, 0.205, 0.103, 0.045, 0.011, 0.012, DARK);
  }
  b.addBox(0, 0.098, 0.106, 0.045, 0.008, 0.01, '#5a2a24');
  return b.build();
}

function hairGeometry() {
  const b = new GeometryBuilder();
  const cap = new THREE.SphereGeometry(0.128, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.56);
  b.addGeometry(cap, new THREE.Matrix4().makeScale(1.0, 0.98, 1.06).setPosition(0, 0.172, -0.012), '#ffffff');
  cap.dispose();
  addBall(b, 0, 0.14, -0.06, 0.112, 0.085, 0.07, '#ffffff', 10);
  return b.build();
}

function longHairGeometry() {
  const b = new GeometryBuilder();
  const cap = new THREE.SphereGeometry(0.132, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.6);
  b.addGeometry(cap, new THREE.Matrix4().makeScale(1.03, 1.0, 1.07).setPosition(0, 0.17, -0.012), '#ffffff');
  cap.dispose();
  addBall(b, 0, 0.05, -0.075, 0.12, 0.16, 0.06, '#ffffff', 10);
  for (const side of [-1, 1]) addBall(b, side * 0.1, 0.08, -0.02, 0.035, 0.11, 0.06, '#ffffff', 8);
  return b.build();
}

function hatGeometry() {
  const b = new GeometryBuilder();
  const crown = new THREE.SphereGeometry(0.132, 14, 7, 0, Math.PI * 2, 0, Math.PI * 0.5);
  b.addGeometry(crown, new THREE.Matrix4().makeScale(1, 0.85, 1.05).setPosition(0, 0.2, -0.005), '#ffffff');
  crown.dispose();
  const brim = new THREE.CylinderGeometry(0.11, 0.11, 0.018, 12, 1, false, -Math.PI / 2, Math.PI);
  b.addGeometry(brim, new THREE.Matrix4().makeScale(1, 1, 1.25).setPosition(0, 0.205, 0.085), '#ffffff');
  brim.dispose();
  return b.build();
}

/** Skin of the arm from shoulder to fingertips: upper arm, elbow, forearm and hand with thumb. */
function armGeometry() {
  const b = new GeometryBuilder();
  addTube(b, 0.02, -0.3, 0.056, 0.047, '#ffffff', 0, 0, 9);
  addBall(b, 0, -0.3, 0, 0.047, 0.045, 0.047, '#ffffff', 7);
  addTube(b, -0.3, -0.56, 0.046, 0.036, '#ffffff', 0, 0, 9);
  addBall(b, 0, -0.615, 0.008, 0.038, 0.062, 0.05, '#ffffff', 8);
  addBall(b, 0.018, -0.59, 0.045, 0.016, 0.03, 0.016, '#ffffff', 6);
  return b.build();
}

function sleeveGeometry() {
  const b = new GeometryBuilder();
  addTube(b, 0.04, -0.2, 0.07, 0.064, '#ffffff', 0, 0, 10);
  return b.build();
}

function longSleeveGeometry() {
  const b = new GeometryBuilder();
  addTube(b, 0.04, -0.3, 0.068, 0.058, '#ffffff', 0, 0, 10);
  addTube(b, -0.3, -0.55, 0.057, 0.047, '#ffffff', 0, 0, 10);
  return b.build();
}

/** A handgun in the right arm's frame: the barrel runs down the arm (-Y), the grip below it (-Z). */
function gunGeometry() {
  const b = new GeometryBuilder();
  b.addBox(0, -0.71, 0, 0.05, 0.26, 0.07, '#1c1c1f', { skipBottom: false });
  b.addBox(0, -0.62, -0.06, 0.045, 0.08, 0.11, '#26262a', { skipBottom: false });
  b.addBox(0, -0.83, 0.012, 0.03, 0.03, 0.03, '#3a3a40', { skipBottom: false });
  return b.build();
}

/** A long gun (shotgun or rifle) held at the shoulder: barrel, body, stock and grip. */
function longGunGeometry() {
  const b = new GeometryBuilder();
  b.addBox(0, -0.95, 0.03, 0.035, 0.6, 0.035, '#1f2024', { skipBottom: false });
  b.addBox(0, -0.66, 0.0, 0.06, 0.32, 0.09, '#2a2b30', { skipBottom: false });
  b.addBox(0, -0.43, -0.03, 0.05, 0.22, 0.11, '#5b3a22', { skipBottom: false });
  b.addBox(0, -0.62, -0.08, 0.04, 0.07, 0.1, '#232428', { skipBottom: false });
  return b.build();
}

export function createHumanParts() {
  return {
    leg: legGeometry(),
    bareLeg: bareLegGeometry(),
    shorts: shortsGeometry(),
    skirt: skirtGeometry(),
    torso: torsoGeometry(),
    pelvis: pelvisGeometry(),
    head: headGeometry(),
    hair: hairGeometry(),
    longHair: longHairGeometry(),
    hat: hatGeometry(),
    arm: armGeometry(),
    sleeve: sleeveGeometry(),
    longSleeve: longSleeveGeometry(),
    gun: gunGeometry(),
    longGun: longGunGeometry(),
  };
}

/** Joint positions in the body frame (feet at y = 0, facing +Z, +X to the left). */
export const JOINTS = {
  hipY: 0.92,
  hipX: 0.1,
  pelvisY: 0.95,
  waistY: 1.0,
  neckY: 0.56,
  shoulderX: 0.255,
  shoulderY: 0.5,
};
