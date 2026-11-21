// The final image: the scene is drawn into an HDR multisampled target, its brightest parts are
// blurred into a soft bloom (sun, neon, police lights, headlights, fire), then one pass adds the
// bloom, a warm grade and a vignette, and tone-maps to the screen.
import * as THREE from 'three';

const QUAD_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const BRIGHT_FRAGMENT = /* glsl */ `
uniform sampler2D tInput;
uniform float uThreshold;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tInput, vUv).rgb;
  float level = max(max(c.r, c.g), c.b);
  gl_FragColor = vec4(c * smoothstep(uThreshold, uThreshold + 0.8, level), 1.0);
}`;

const BLUR_FRAGMENT = /* glsl */ `
uniform sampler2D tInput;
uniform vec2 uStep;
varying vec2 vUv;
void main() {
  vec3 sum = texture2D(tInput, vUv).rgb * 0.2270;
  sum += texture2D(tInput, vUv + uStep * 1.3846).rgb * 0.3162;
  sum += texture2D(tInput, vUv - uStep * 1.3846).rgb * 0.3162;
  sum += texture2D(tInput, vUv + uStep * 3.2308).rgb * 0.0703;
  sum += texture2D(tInput, vUv - uStep * 3.2308).rgb * 0.0703;
  gl_FragColor = vec4(sum, 1.0);
}`;

const COMPOSITE_FRAGMENT = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloomA;
uniform sampler2D tBloomB;
uniform float uBloom;
uniform float uVignette;
uniform float uSaturation;
varying vec2 vUv;
void main() {
  vec3 color = texture2D(tScene, vUv).rgb;
  color += (texture2D(tBloomA, vUv).rgb * 0.6 + texture2D(tBloomB, vUv).rgb * 0.8) * uBloom;
  float grey = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(grey), color, uSaturation);
  color *= vec3(1.05, 1.0, 0.93);
  float edge = smoothstep(0.42, 0.95, length((vUv - 0.5) * vec2(1.25, 1.0)));
  color *= 1.0 - edge * uVignette;
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function target(width, height, options = {}) {
  return new THREE.WebGLRenderTarget(width, height, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    depthBuffer: false,
    ...options,
  });
}

export class PostProcessing {
  constructor(renderer) {
    this.renderer = renderer;
    this.size = new THREE.Vector2();
    renderer.getDrawingBufferSize(this.size);
    const w = this.size.x;
    const h = this.size.y;
    this.scene = target(w, h, { depthBuffer: true, samples: 4 });
    this.halfA = target(w >> 1, h >> 1);
    this.halfB = target(w >> 1, h >> 1);
    this.quarterA = target(w >> 2, h >> 2);
    this.quarterB = target(w >> 2, h >> 2);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.quadScene = new THREE.Scene();
    this.quadScene.add(this.quad);
    const pass = (fragmentShader, uniforms, toneMapped = false) => new THREE.ShaderMaterial({
      vertexShader: QUAD_VERTEX, fragmentShader, uniforms, depthTest: false, depthWrite: false, toneMapped,
    });
    this.bright = pass(BRIGHT_FRAGMENT, { tInput: { value: null }, uThreshold: { value: 1.05 } });
    this.blur = pass(BLUR_FRAGMENT, { tInput: { value: null }, uStep: { value: new THREE.Vector2() } });
    this.composite = pass(COMPOSITE_FRAGMENT, {
      tScene: { value: null }, tBloomA: { value: null }, tBloomB: { value: null },
      uBloom: { value: 0.55 }, uVignette: { value: 0.32 }, uSaturation: { value: 1.08 },
    }, true);
  }

  resize() {
    this.renderer.getDrawingBufferSize(this.size);
    const w = this.size.x;
    const h = this.size.y;
    this.scene.setSize(w, h);
    this.halfA.setSize(w >> 1, h >> 1);
    this.halfB.setSize(w >> 1, h >> 1);
    this.quarterA.setSize(w >> 2, h >> 2);
    this.quarterB.setSize(w >> 2, h >> 2);
  }

  draw(material, output) {
    this.quad.material = material;
    this.renderer.setRenderTarget(output);
    this.renderer.render(this.quadScene, this.camera);
  }

  blurInto(source, scratch, output) {
    const step = this.blur.uniforms.uStep.value;
    this.blur.uniforms.tInput.value = source.texture;
    step.set(1 / source.width, 0);
    this.draw(this.blur, scratch);
    this.blur.uniforms.tInput.value = scratch.texture;
    step.set(0, 1 / scratch.height);
    this.draw(this.blur, output);
  }

  render(scene, camera) {
    const renderer = this.renderer;
    const current = new THREE.Vector2();
    renderer.getDrawingBufferSize(current);
    if (current.x !== this.size.x || current.y !== this.size.y) this.resize();
    renderer.setRenderTarget(this.scene);
    renderer.render(scene, camera);
    this.bright.uniforms.tInput.value = this.scene.texture;
    this.draw(this.bright, this.halfA);
    this.blurInto(this.halfA, this.halfB, this.halfA);
    this.blurInto(this.halfA, this.quarterB, this.quarterA);
    this.blurInto(this.quarterA, this.quarterB, this.quarterA);
    this.composite.uniforms.tScene.value = this.scene.texture;
    this.composite.uniforms.tBloomA.value = this.halfA.texture;
    this.composite.uniforms.tBloomB.value = this.quarterA.texture;
    this.draw(this.composite, null);
  }
}
