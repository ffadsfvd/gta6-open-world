// Body-part geometry for the low-poly people. Each part's origin is its joint (hip, waist,
// shoulder, neck), so the animator only rotates and places parts; colour comes per instance.
import * as THREE from 'three';
import { GeometryBuilder } from '../render/geometryBuilder.js';

function flat(geometry) {
  const result = geometry.index ? geometry.toNonIndexed() : geometry;
  result.computeVertexNormals();
  return result;
}

function legGeometry() {
  const b = new GeometryBuilder();
  b.addBox(0, -0.4, 0, 0.16, 0.8, 0.17, '#ffffff', { skipBottom: false });
  b.addBox(0, -0.86, 0.04, 0.15, 0.1, 0.27, '#2a2a2e', { skipBottom: false });
  return b.build();
}

function torsoGeometry() {
  const b = new GeometryBuilder();
  const shape = flat(new THREE.CylinderGeometry(0.31, 0.25, 0.56, 4, 1));
  const m = new THREE.Matrix4().makeRotationY(Math.PI / 4).premultiply(new THREE.Matrix4().makeScale(1, 1, 0.58)).setPosition(0, 0.28, 0);
  b.addGeometry(shape, m, '#ffffff');
  return b.build();
}

function pelvisGeometry() {
  const b = new GeometryBuilder();
  b.addBox(0, 0, 0, 0.36, 0.2, 0.21, '#ffffff', { skipBottom: false });
  b.addBox(0, 0.1, 0, 0.37, 0.05, 0.22, '#3a2c22', { skipBottom: false });
  return b.build();
}

function headGeometry() {
  const b = new GeometryBuilder();
  const m = new THREE.Matrix4().makeScale(1, 1.12, 1).setPosition(0, 0.14, 0);
  b.addGeometry(flat(new THREE.IcosahedronGeometry(0.12, 1)), m, '#ffffff');
  b.addBox(0, 0.02, 0, 0.09, 0.06, 0.09, '#ffffff');
  b.addBox(0.045, 0.16, 0.112, 0.025, 0.02, 0.01, '#1a1a1a');
  b.addBox(-0.045, 0.16, 0.112, 0.025, 0.02, 0.01, '#1a1a1a');
  b.addBox(0, 0.13, 0.12, 0.03, 0.05, 0.03, '#e0b090');
  return b.build();
}

function hairGeometry() {
  const b = new GeometryBuilder();
  const m = new THREE.Matrix4().makeScale(1.07, 0.95, 1.1).setPosition(0, 0.16, -0.01);
  b.addGeometry(flat(new THREE.SphereGeometry(0.13, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55)), m, '#ffffff');
  b.addBox(0, 0.12, -0.08, 0.24, 0.12, 0.08, '#ffffff');
  return b.build();
}

function hatGeometry() {
  const b = new GeometryBuilder();
  const crown = new THREE.Matrix4().setPosition(0, 0.27, 0);
  b.addGeometry(flat(new THREE.CylinderGeometry(0.125, 0.135, 0.11, 10)), crown, '#ffffff');
  b.addBox(0, 0.225, 0.11, 0.2, 0.025, 0.12, '#ffffff');
  return b.build();
}

function armGeometry() {
  const b = new GeometryBuilder();
  b.addBox(0, -0.29, 0, 0.1, 0.58, 0.11, '#ffffff', { skipBottom: false });
  b.addBox(0, -0.62, 0.01, 0.09, 0.09, 0.1, '#ffffff', { skipBottom: false });
  return b.build();
}

function sleeveGeometry() {
  const b = new GeometryBuilder();
  b.addBox(0, -0.12, 0, 0.135, 0.26, 0.145, '#ffffff', { skipBottom: false });
  return b.build();
}

/** A handgun in the right arm's frame: the barrel runs down the arm (-Y), the grip below it (-Z). */
function gunGeometry() {
  const b = new GeometryBuilder();
  b.addBox(0, -0.71, 0, 0.05, 0.26, 0.07, '#1c1c1f', { skipBottom: false });
  b.addBox(0, -0.62, -0.06, 0.045, 0.08, 0.11, '#26262a', { skipBottom: false });
  return b.build();
}

export function createHumanParts() {
  return {
    leg: legGeometry(),
    torso: torsoGeometry(),
    pelvis: pelvisGeometry(),
    head: headGeometry(),
    hair: hairGeometry(),
    hat: hatGeometry(),
    arm: armGeometry(),
    sleeve: sleeveGeometry(),
    gun: gunGeometry(),
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
