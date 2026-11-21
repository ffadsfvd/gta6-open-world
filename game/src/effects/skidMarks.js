// Tyre marks left on the road while a car slides, brakes hard or drifts: a ring buffer of thin
// dark quads laid just above the ground, the oldest overwritten first.
import * as THREE from 'three';
import { groundHeight } from '../world/terrain.js';

const SEGMENTS = 1400;
const WIDTH = 0.24;

export class SkidMarks {
  constructor(scene) {
    this.positions = new Float32Array(SEGMENTS * 4 * 3);
    const indices = new Uint16Array(SEGMENTS * 6);
    for (let index = 0; index < SEGMENTS; index += 1) {
      indices.set([index * 4, index * 4 + 1, index * 4 + 2, index * 4, index * 4 + 2, index * 4 + 3], index * 6);
    }
    this.geometry = new THREE.BufferGeometry();
    this.attribute = new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.attribute);
    this.geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    const material = new THREE.MeshBasicMaterial({
      color: '#141414', transparent: true, opacity: 0.55, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    scene.add(this.mesh);
    this.cursor = 0;
    this.used = 0;
    this.last = new Map();
  }

  /** Continues the mark of wheel `key` to (x, z); breaks it when `active` is false. */
  track(key, x, z, active) {
    const previous = this.last.get(key);
    if (!active) {
      if (previous) this.last.delete(key);
      return;
    }
    if (!previous) {
      this.last.set(key, { x, z });
      return;
    }
    const dx = x - previous.x;
    const dz = z - previous.z;
    const length = Math.hypot(dx, dz);
    if (length < 0.35) return;
    if (length > 4) {
      this.last.set(key, { x, z });
      return;
    }
    const nx = (-dz / length) * WIDTH * 0.5;
    const nz = (dx / length) * WIDTH * 0.5;
    const y0 = groundHeight(previous.x, previous.z) + 0.03;
    const y1 = groundHeight(x, z) + 0.03;
    const offset = this.cursor * 12;
    this.positions.set([
      previous.x + nx, y0, previous.z + nz,
      previous.x - nx, y0, previous.z - nz,
      x - nx, y1, z - nz,
      x + nx, y1, z + nz,
    ], offset);
    this.cursor = (this.cursor + 1) % SEGMENTS;
    this.used = Math.min(SEGMENTS, this.used + 1);
    this.attribute.needsUpdate = true;
    this.geometry.setDrawRange(0, this.used * 6);
    previous.x = x;
    previous.z = z;
  }
}
