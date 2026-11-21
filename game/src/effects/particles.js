// A pooled particle system (CPU simulation, one Points draw per blend mode): exhaust, tyre
// smoke, sand dust, sparks, fire, fireballs, debris, blood, splashes, muzzle flashes and spray.
import * as THREE from 'three';

const KINDS = {
  exhaust: { additive: false, life: [0.5, 0.9], size: [0.25, 0.4], grow: 1.3, color: [0.6, 0.6, 0.6], end: [0.75, 0.75, 0.75], alpha: 0.22, gravity: -0.3, drag: 1.6 },
  smoke: { additive: false, life: [2.0, 3.4], size: [1.0, 1.8], grow: 2.4, color: [0.18, 0.17, 0.17], end: [0.45, 0.44, 0.43], alpha: 0.5, gravity: -0.9, drag: 0.7 },
  tireSmoke: { additive: false, life: [1.0, 1.8], size: [0.8, 1.3], grow: 2.2, color: [0.92, 0.92, 0.92], end: [0.85, 0.85, 0.85], alpha: 0.32, gravity: -0.35, drag: 1.3 },
  dust: { additive: false, life: [0.8, 1.5], size: [0.6, 1.2], grow: 1.8, color: [0.88, 0.74, 0.52], end: [0.92, 0.82, 0.66], alpha: 0.38, gravity: -0.15, drag: 1.5 },
  spark: { additive: true, life: [0.18, 0.45], size: [0.07, 0.13], grow: -0.1, color: [1.7, 1.1, 0.35], end: [1.2, 0.35, 0.05], alpha: 1, gravity: 9, drag: 0.4 },
  fire: { additive: true, life: [0.35, 0.75], size: [0.7, 1.3], grow: -0.7, color: [1.6, 0.65, 0.15], end: [0.7, 0.12, 0.03], alpha: 0.9, gravity: -2.8, drag: 1.1 },
  fireball: { additive: true, life: [0.45, 0.9], size: [2.6, 4.2], grow: 2.2, color: [1.9, 1.0, 0.35], end: [0.8, 0.18, 0.03], alpha: 1, gravity: -1.6, drag: 2.2 },
  debris: { additive: false, life: [1.0, 1.7], size: [0.14, 0.3], grow: 0, color: [0.12, 0.11, 0.1], end: [0.12, 0.11, 0.1], alpha: 1, gravity: 14, drag: 0.15 },
  blood: { additive: false, life: [0.3, 0.6], size: [0.12, 0.22], grow: 0.3, color: [0.55, 0.03, 0.03], end: [0.35, 0.02, 0.02], alpha: 0.9, gravity: 8, drag: 1 },
  splash: { additive: false, life: [0.6, 1.1], size: [0.35, 0.8], grow: 1.1, color: [0.88, 0.96, 1.0], end: [0.95, 0.98, 1.0], alpha: 0.75, gravity: 9, drag: 0.4 },
  spray: { additive: false, life: [0.9, 1.4], size: [0.12, 0.22], grow: 0.4, color: [0.8, 0.92, 1.0], end: [0.9, 0.96, 1.0], alpha: 0.6, gravity: 9.5, drag: 0.1 },
  muzzle: { additive: true, life: [0.04, 0.07], size: [0.45, 0.7], grow: 0, color: [1.9, 1.35, 0.55], end: [1.4, 0.6, 0.1], alpha: 1, gravity: 0, drag: 0 },
  flash: { additive: true, life: [0.12, 0.18], size: [6, 8], grow: 2.5, color: [1.3, 0.8, 0.45], end: [0.5, 0.2, 0.05], alpha: 0.9, gravity: 0, drag: 0 },
  sparkle: { additive: true, life: [0.5, 0.9], size: [0.2, 0.35], grow: -0.2, color: [0.5, 1.6, 0.6], end: [1.4, 1.4, 0.3], alpha: 1, gravity: -1.5, drag: 0.8 },
};

const VERTEX = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
uniform float uScale;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * view;
  gl_PointSize = min(700.0, aSize * uScale / max(0.1, -view.z));
  vAlpha = aAlpha;
  vColor = aColor;
}`;

const FRAGMENT = /* glsl */ `
varying float vAlpha;
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.35, d) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, a);
}`;

class ParticleLayer {
  constructor(scene, capacity, additive) {
    this.capacity = capacity;
    this.count = 0;
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.color = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.kind = new Array(capacity);
    this.baseSize = new Float32Array(capacity);
    this.geometry = new THREE.BufferGeometry();
    this.positionAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.colorAttr = new THREE.BufferAttribute(this.color, 3).setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.alphaAttr = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.positionAttr);
    this.geometry.setAttribute('aColor', this.colorAttr);
    this.geometry.setAttribute('aSize', this.sizeAttr);
    this.geometry.setAttribute('aAlpha', this.alphaAttr);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: { uScale: { value: 600 } },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 4 : 3;
    scene.add(this.points);
  }

  emit(spec, kindName, x, y, z, vx, vy, vz, rng, scale) {
    let index = this.count;
    if (index >= this.capacity) index = Math.floor(rng.next() * this.capacity);
    else this.count += 1;
    this.pos[index * 3] = x;
    this.pos[index * 3 + 1] = y;
    this.pos[index * 3 + 2] = z;
    this.vel[index * 3] = vx;
    this.vel[index * 3 + 1] = vy;
    this.vel[index * 3 + 2] = vz;
    const life = spec.life[0] + (spec.life[1] - spec.life[0]) * rng.next();
    this.life[index] = life;
    this.maxLife[index] = life;
    this.baseSize[index] = (spec.size[0] + (spec.size[1] - spec.size[0]) * rng.next()) * scale;
    this.kind[index] = kindName;
  }

  update(dt) {
    let index = 0;
    while (index < this.count) {
      this.life[index] -= dt;
      if (this.life[index] <= 0) {
        const last = this.count - 1;
        if (index !== last) this.copy(last, index);
        this.count -= 1;
        continue;
      }
      const spec = KINDS[this.kind[index]];
      const t = 1 - this.life[index] / this.maxLife[index];
      const drag = Math.max(0, 1 - spec.drag * dt);
      const i3 = index * 3;
      this.vel[i3] *= drag;
      this.vel[i3 + 1] = this.vel[i3 + 1] * drag - spec.gravity * dt;
      this.vel[i3 + 2] *= drag;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      if (spec.gravity > 0 && this.pos[i3 + 1] < -0.5) this.life[index] = 0;
      this.size[index] = Math.max(0.01, this.baseSize[index] * (1 + spec.grow * t));
      this.alpha[index] = spec.alpha * (t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88);
      this.color[i3] = spec.color[0] + (spec.end[0] - spec.color[0]) * t;
      this.color[i3 + 1] = spec.color[1] + (spec.end[1] - spec.color[1]) * t;
      this.color[i3 + 2] = spec.color[2] + (spec.end[2] - spec.color[2]) * t;
      index += 1;
    }
    this.geometry.setDrawRange(0, this.count);
    this.positionAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
  }

  copy(from, to) {
    for (let k = 0; k < 3; k += 1) {
      this.pos[to * 3 + k] = this.pos[from * 3 + k];
      this.vel[to * 3 + k] = this.vel[from * 3 + k];
      this.color[to * 3 + k] = this.color[from * 3 + k];
    }
    this.size[to] = this.size[from];
    this.alpha[to] = this.alpha[from];
    this.life[to] = this.life[from];
    this.maxLife[to] = this.maxLife[from];
    this.kind[to] = this.kind[from];
    this.baseSize[to] = this.baseSize[from];
  }
}

export class Particles {
  constructor(scene, rng) {
    this.rng = rng;
    this.normal = new ParticleLayer(scene, 2600, false);
    this.additive = new ParticleLayer(scene, 1600, true);
  }

  /** Emits `count` particles of a kind around (x, y, z) with a base velocity and random spread. */
  burst(kindName, count, x, y, z, vx = 0, vy = 0, vz = 0, spread = 1, scale = 1) {
    const spec = KINDS[kindName];
    const layer = spec.additive ? this.additive : this.normal;
    const rng = this.rng;
    for (let index = 0; index < count; index += 1) {
      layer.emit(spec, kindName, x, y, z,
        vx + (rng.next() - 0.5) * 2 * spread,
        vy + (rng.next() - 0.5) * 2 * spread,
        vz + (rng.next() - 0.5) * 2 * spread,
        rng, scale);
    }
  }

  update(dt, camera, viewportHeight) {
    const scale = viewportHeight / (2 * Math.tan((camera.fov * Math.PI) / 360));
    this.normal.material.uniforms.uScale.value = scale;
    this.additive.material.uniforms.uScale.value = scale;
    this.normal.update(dt);
    this.additive.update(dt);
  }
}
