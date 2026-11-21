// The WebGL renderer and the main camera: ACES tone mapping, soft shadows, a capped pixel ratio
// for a steady frame rate, and resizing with the window.
import * as THREE from 'three';
import { CAMERA_TUNING } from '../core/config.js';

export function createRenderer(canvas, quality = 'high') {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const ratioCap = quality === 'high' ? 1.5 : 1;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ratioCap));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = quality !== 'low';
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // Shader warnings from the GPU compiler are noise in production; errors still stop the program.
  renderer.debug.checkShaderErrors = false;

  const camera = new THREE.PerspectiveCamera(CAMERA_TUNING.fov, window.innerWidth / window.innerHeight, 0.3, 2600);
  camera.position.set(0, 40, 80);

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  return { renderer, camera, resize };
}
