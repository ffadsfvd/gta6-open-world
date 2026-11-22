// The sky dome: a gradient that follows the time of day, the sun with its halo, drifting streaky
// clouds, stars and the moon after dark; plus the blurred environment map (PMREM) that gives
// cars, glass and the sea their reflections, re-baked as the light changes.
import * as THREE from 'three';

const SKY_VERTEX = /* glsl */ `
varying vec3 vWorldDir;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldDir = world.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * world;
  gl_Position.z = gl_Position.w;
}`;

const SKY_FRAGMENT = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform vec3 uZenith;
uniform vec3 uMid;
uniform vec3 uHorizon;
uniform vec3 uBelow;
uniform vec3 uSunColor;
uniform float uTime;
uniform float uClouds;
uniform float uNight;
varying vec3 vWorldDir;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float cloudFbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += amplitude * valueNoise(p);
    p = p * 2.07 + vec2(1.7, 9.2);
    amplitude *= 0.5;
  }
  return value;
}
void main() {
  vec3 dir = normalize(vWorldDir);
  float h = dir.y;
  float up = clamp(h, 0.0, 1.0);
  float toSun = max(dot(dir, uSunDir), 0.0);
  float sunUp = smoothstep(-0.06, 0.03, uSunDir.y);
  vec3 sky = mix(uHorizon, uMid, smoothstep(0.0, 0.16, up));
  sky = mix(sky, uZenith, smoothstep(0.12, 0.75, up));
  // A warm band along the horizon, strongest toward the sun.
  sky += uSunColor * pow(1.0 - up, 7.0) * (0.18 + 0.82 * pow(toSun, 2.5)) * 0.55;
  sky = mix(sky, uBelow, smoothstep(0.0, -0.06, h));
  sky += uSunColor * sunUp * (smoothstep(0.99935, 0.99965, toSun) * 14.0 + pow(toSun, 90.0) * 1.4 + pow(toSun, 10.0) * 0.3);
  if (h > 0.0) {
    vec2 uv = dir.xz / (h + 0.1);
    uv *= vec2(0.3, 0.75);
    float density = cloudFbm(uv * 1.5 + vec2(uTime * 0.003, uTime * 0.001));
    float cloud = smoothstep(0.5, 0.8, density) * smoothstep(0.0, 0.2, h) * uClouds;
    vec3 shade = mix(uHorizon * 1.15 + uSunColor * 0.25, mix(uMid, vec3(1.0, 0.93, 0.86), 0.6 - uNight * 0.5), up);
    shade = mix(shade, uSunColor * 1.4, pow(toSun, 5.0) * 0.7 * sunUp);
    shade *= 1.0 - uNight * 0.75;
    sky = mix(sky, shade, cloud * 0.8);
    if (uNight > 0.01) {
      // Stars, a little fewer near the hazy horizon, and the moon with its halo.
      vec3 cell = floor(dir * 640.0);
      float star = step(0.9975, hash31(cell)) * smoothstep(0.04, 0.35, h) * (1.0 - cloud);
      sky += vec3(0.85, 0.9, 1.0) * star * (0.6 + hash31(cell + 7.0)) * smoothstep(0.35, 0.95, uNight) * 1.6;
      float toMoon = max(dot(dir, uMoonDir), 0.0);
      sky += vec3(1.0, 0.96, 0.88) * smoothstep(0.99955, 0.99975, toMoon) * 4.0 * uNight;
      sky += vec3(0.25, 0.3, 0.5) * (pow(toMoon, 40.0) * 0.6 + pow(toMoon, 6.0) * 0.12) * uNight;
    }
  }
  gl_FragColor = vec4(sky, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function createSkyMaterial(sunDirection, clouds) {
  return new THREE.ShaderMaterial({
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uSunDir: { value: sunDirection.clone() },
      uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
      uZenith: { value: new THREE.Color('#1f5fd0') },
      uMid: { value: new THREE.Color('#6fa3e8') },
      uHorizon: { value: new THREE.Color('#ffd7ae') },
      uBelow: { value: new THREE.Color('#f0bd8e') },
      uSunColor: { value: new THREE.Color(1.0, 0.72, 0.42) },
      uTime: { value: 0 },
      uClouds: { value: clouds },
      uNight: { value: 0 },
    },
  });
}

/** Copies the sky colours of a time-of-day state into a sky material. */
function applyState(material, time, cloudShare) {
  const u = material.uniforms;
  const s = time.state;
  u.uSunDir.value.copy(time.sunDirection);
  u.uMoonDir.value.copy(time.moonDirection);
  u.uZenith.value.copy(s.zenith);
  u.uMid.value.copy(s.mid);
  u.uHorizon.value.copy(s.horizon);
  u.uBelow.value.copy(s.below);
  u.uSunColor.value.copy(s.glow);
  u.uClouds.value = s.clouds * cloudShare;
  u.uNight.value = s.night;
}

export class Sky {
  constructor(scene, sunDirection) {
    this.material = createSkyMaterial(sunDirection, 1);
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1800, 48, 24), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
    scene.add(this.mesh);
    this.fog = new THREE.Fog('#f2d2b0', 140, 1100);
    scene.fog = this.fog;
    scene.background = null;
  }

  /** Follows the clock: sky colours, sun and moon, and the fog that blends the city into it. */
  applyTime(time) {
    applyState(this.material, time, 1);
    this.fog.color.copy(time.state.fog);
    this.fog.far = time.state.fogFar;
  }

  update(camera, time) {
    this.mesh.position.copy(camera.position);
    this.material.uniforms.uTime.value = time;
  }
}

/** Renders the sky (and a ground tinted like the city) into a prefiltered environment map. */
export class EnvironmentBaker {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.skyMaterial = createSkyMaterial(new THREE.Vector3(0, 1, 0), 0.6);
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), this.skyMaterial));
    this.groundMaterial = new THREE.MeshBasicMaterial({ color: '#c99a78' });
    const ground = new THREE.Mesh(new THREE.CircleGeometry(90, 32), this.groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -8;
    this.scene.add(ground);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.target = null;
    this.bakedHour = null;
  }

  /** True when the light has moved on enough since the last bake to be worth another. */
  isStale(time) {
    if (this.bakedHour === null) return true;
    const gap = Math.abs(time.hour - this.bakedHour);
    return Math.min(gap, 24 - gap) > 0.6;
  }

  bake(time) {
    applyState(this.skyMaterial, time, 0.6);
    this.groundMaterial.color.copy(time.state.ground).multiplyScalar(0.8);
    const previous = this.target;
    this.target = this.pmrem.fromScene(this.scene, 0.03);
    if (previous) previous.dispose();
    this.bakedHour = time.hour;
    return this.target.texture;
  }
}
