// Sun (or moon) and sky light, following the time of day. The shadow camera follows the player,
// snapped to whole shadow-map texels in light space so shadow edges do not shimmer as the
// camera moves.
import * as THREE from 'three';

export class Lighting {
  constructor(scene, sunDirection, quality = 'high') {
    this.direction = sunDirection.clone().normalize();
    this.hemisphere = new THREE.HemisphereLight('#cfe0f5', '#e8b48a', 1.05);
    scene.add(this.hemisphere);
    this.sun = new THREE.DirectionalLight('#ffd2a0', 3.1);
    this.sun.castShadow = quality !== 'low';
    const size = quality === 'high' ? 2048 : 1024;
    this.extent = quality === 'high' ? 95 : 70;
    this.sun.shadow.mapSize.set(size, size);
    const camera = this.sun.shadow.camera;
    camera.left = -this.extent;
    camera.right = this.extent;
    camera.top = this.extent;
    camera.bottom = -this.extent;
    camera.near = 10;
    camera.far = 700;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.05;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.texel = (this.extent * 2) / size;
    this.axisRight = new THREE.Vector3();
    this.axisUp = new THREE.Vector3();
    this.setDirection(this.direction);
    this.focus = new THREE.Vector3();
  }

  setDirection(direction) {
    this.direction.copy(direction).normalize();
    this.axisRight.crossVectors(new THREE.Vector3(0, 1, 0), this.direction).normalize();
    this.axisUp.crossVectors(this.direction, this.axisRight).normalize();
  }

  /** Sun or moon position, light colours and strengths for the current hour. */
  applyTime(time) {
    const s = time.state;
    this.setDirection(time.lightDirection);
    this.sun.color.copy(s.sun);
    this.sun.intensity = s.sunI;
    this.hemisphere.color.copy(s.sky);
    this.hemisphere.groundColor.copy(s.ground);
    this.hemisphere.intensity = s.ambI;
  }

  /** Centre the shadowed area on (x, z), a little ahead of where the camera looks. */
  follow(x, z) {
    this.focus.set(x, 0, z);
    const a = Math.round(this.focus.dot(this.axisRight) / this.texel) * this.texel;
    const b = Math.round(this.focus.dot(this.axisUp) / this.texel) * this.texel;
    const c = this.focus.dot(this.direction);
    const snapped = new THREE.Vector3()
      .addScaledVector(this.axisRight, a)
      .addScaledVector(this.axisUp, b)
      .addScaledVector(this.direction, c);
    this.sun.target.position.copy(snapped);
    this.sun.position.copy(snapped).addScaledVector(this.direction, 350);
    this.sun.target.updateMatrixWorld();
  }
}
