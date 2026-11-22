// Pools of light on the ground, one instanced draw call: street lamps after dark, headlight
// beams on the road, the red and blue wash of police flashers and the helicopter searchlight.
// Each pool is a soft additive ellipse lying flat, refilled every frame like the glow sprites.
import * as THREE from 'three';

const VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vTint;
void main() {
  vUv = uv;
  vTint = instanceColor;
  vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vec4 view = viewMatrix * world;
  // Fade out with distance instead of drawing a hard edge where the list stops.
  vTint *= 1.0 - smoothstep(110.0, 150.0, -view.z);
  gl_Position = projectionMatrix * view;
}`;

const FRAGMENT = /* glsl */ `
varying vec2 vUv;
varying vec3 vTint;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float falloff = max(0.0, 1.0 - d * d);
  gl_FragColor = vec4(vTint * falloff * falloff, 1.0);
}`;

export class LightPools {
  constructor(scene, capacity = 420) {
    this.capacity = capacity;
    const geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -8,
      fog: false,
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.matrix = new THREE.Matrix4();
    this.rotation = new THREE.Matrix4();
    this.count = 0;
  }

  begin() {
    this.count = 0;
  }

  /**
   * A pool centred on (x, y, z), `width` across and `length` long along heading `yaw`, tinted
   * (r, g, b) in linear light.
   */
  add(x, y, z, width, length, yaw, r, g, b) {
    if (this.count >= this.capacity) return;
    this.rotation.makeRotationY(yaw);
    this.matrix.makeScale(width, 1, length).premultiply(this.rotation).setPosition(x, y, z);
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
