// The golden-hour sky: a gradient dome with a low sun, its halo and drifting streaky clouds,
// plus the blurred environment map (PMREM) that gives cars, glass and the sea their reflections.
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
uniform vec3 uZenith;
uniform vec3 uMid;
uniform vec3 uHorizon;
uniform vec3 uBelow;
uniform vec3 uSunColor;
uniform float uTime;
uniform float uClouds;
varying vec3 vWorldDir;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
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
  vec3 sky = mix(uHorizon, uMid, smoothstep(0.0, 0.16, up));
  sky = mix(sky, uZenith, smoothstep(0.12, 0.75, up));
  sky += uSunColor * pow(1.0 - up, 7.0) * (0.18 + 0.82 * pow(toSun, 2.5)) * 0.55;
  sky = mix(sky, uBelow, smoothstep(0.0, -0.06, h));
  sky += uSunColor * (smoothstep(0.99935, 0.99965, toSun) * 14.0 + pow(toSun, 90.0) * 1.4 + pow(toSun, 10.0) * 0.3);
  if (h > 0.0) {
    vec2 uv = dir.xz / (h + 0.1);
    uv *= vec2(0.3, 0.75);
    float density = cloudFbm(uv * 1.5 + vec2(uTime * 0.003, uTime * 0.001));
    float cloud = smoothstep(0.5, 0.8, density) * smoothstep(0.0, 0.2, h) * uClouds;
    vec3 shade = mix(vec3(0.95, 0.62, 0.5), vec3(1.0, 0.93, 0.86), up);
    shade = mix(shade, uSunColor * 1.4, pow(toSun, 5.0) * 0.7);
    sky = mix(sky, shade, cloud * 0.8);
  }
  gl_FragColor = vec4(sky, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const SKY_COLORS = {
  zenith: '#1f5fd0',
  mid: '#6fa3e8',
  horizon: '#ffd7ae',
  below: '#f0bd8e',
  fog: '#f2d2b0',
};

function createSkyMaterial(sunDirection, clouds) {
  return new THREE.ShaderMaterial({
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uSunDir: { value: sunDirection.clone() },
      uZenith: { value: new THREE.Color(SKY_COLORS.zenith) },
      uMid: { value: new THREE.Color(SKY_COLORS.mid) },
      uHorizon: { value: new THREE.Color(SKY_COLORS.horizon) },
      uBelow: { value: new THREE.Color(SKY_COLORS.below) },
      uSunColor: { value: new THREE.Color(1.0, 0.72, 0.42) },
      uTime: { value: 0 },
      uClouds: { value: clouds },
    },
  });
}

export class Sky {
  constructor(scene, sunDirection) {
    this.material = createSkyMaterial(sunDirection, 1);
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1800, 48, 24), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
    scene.add(this.mesh);
    scene.fog = new THREE.Fog(SKY_COLORS.fog, 140, 1100);
    scene.background = null;
  }

  update(camera, time) {
    this.mesh.position.copy(camera.position);
    this.material.uniforms.uTime.value = time;
  }
}

/** Renders the sky (and a warm ground) once into a prefiltered environment map. */
export function createEnvironmentMap(renderer, sunDirection) {
  const envScene = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), createSkyMaterial(sunDirection, 0.6));
  envScene.add(sky);
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(90, 32),
    new THREE.MeshBasicMaterial({ color: '#c99a78' }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -8;
  envScene.add(ground);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(envScene, 0.03);
  pmrem.dispose();
  return target.texture;
}
