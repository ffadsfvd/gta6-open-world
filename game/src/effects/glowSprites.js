// Camera-facing additive glows, one instanced draw call: headlights, brake lights, police
// flashers, traffic signals, muzzle flashes and marker beacons. Refilled every frame.
import * as THREE from 'three';

const VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vTint;
void main() {
  vUv = uv;
  vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float scale = length(instanceMatrix[0].xyz);
  center.z += min(0.6, scale * 0.5);
  center.xy += position.xy * scale;
  vTint = instanceColor;
  gl_Position = projectionMatrix * center;
}`;

const FRAGMENT = /* glsl */ `
varying vec2 vUv;
varying vec3 vTint;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float halo = pow(max(0.0, 1.0 - d), 2.2);
  float core = smoothstep(0.32, 0.0, d);
  gl_FragColor = vec4(vTint * (halo + core * 1.2), 1.0);
}`;

export class GlowSprites {
  constructor(scene, capacity = 900) {
    this.capacity = capacity;
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), material, capacity);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.matrix = new THREE.Matrix4();
    this.count = 0;
  }

  begin() {
    this.count = 0;
  }

  /** A glow `size` metres across at (x, y, z), tinted (r, g, b) in linear light. */
  add(x, y, z, size, r, g, b) {
    if (this.count >= this.capacity) return;
    this.matrix.makeScale(size, size, size).setPosition(x, y, z);
    this.mesh.setMatrixAt(this.count, this.matrix);
    const colors = this.mesh.instanceColor.array;
    colors[this.count * 3] = r;
    colors[this.count * 3 + 1] = g;
    colors[this.count * 3 + 2] = b;
    this.count += 1;
  }

  end() {
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
}
