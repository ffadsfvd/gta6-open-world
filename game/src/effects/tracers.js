// Bullet tracers: short bright streaks from the muzzle to the impact that fade within a frame
// or two, drawn as one additive line-segment buffer.
import * as THREE from 'three';

const CAPACITY = 64;
const LIFE = 0.07;

export class Tracers {
  constructor(scene) {
    this.positions = new Float32Array(CAPACITY * 6);
    this.colors = new Float32Array(CAPACITY * 6);
    this.life = new Float32Array(CAPACITY);
    this.geometry = new THREE.BufferGeometry();
    this.positionAttr = new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage);
    this.colorAttr = new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.positionAttr);
    this.geometry.setAttribute('color', this.colorAttr);
    const material = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.lines = new THREE.LineSegments(this.geometry, material);
    this.lines.frustumCulled = false;
    scene.add(this.lines);
    this.cursor = 0;
  }

  add(x0, y0, z0, x1, y1, z1) {
    const index = this.cursor;
    this.cursor = (this.cursor + 1) % CAPACITY;
    this.positions.set([x0, y0, z0, x1, y1, z1], index * 6);
    this.life[index] = LIFE;
  }

  update(dt) {
    for (let index = 0; index < CAPACITY; index += 1) {
      this.life[index] = Math.max(0, this.life[index] - dt);
      const k = this.life[index] / LIFE;
      this.colors.set([1.6 * k, 1.2 * k, 0.5 * k, 0.6 * k, 0.4 * k, 0.15 * k], index * 6);
    }
    this.positionAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
  }
}
