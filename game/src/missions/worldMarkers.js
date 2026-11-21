// Mission markers in the world: glowing light columns over destinations and contacts, ground
// rings, bobbing arrows over targets, and spinning pickups (packages, ledgers, sunshells).
import * as THREE from 'three';

const COLUMN_VERTEX = /* glsl */ `
varying float vHeight;
varying vec3 vTint;
void main() {
  vHeight = position.y;
  vTint = instanceColor;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;

const COLUMN_FRAGMENT = /* glsl */ `
uniform float uTime;
varying float vHeight;
varying vec3 vTint;
void main() {
  float fade = pow(1.0 - clamp(vHeight, 0.0, 1.0), 1.6);
  float bands = 0.75 + 0.25 * sin(vHeight * 18.0 - uTime * 4.0);
  gl_FragColor = vec4(vTint * fade * bands, 1.0);
}`;

const CAPACITY = 48;

export class WorldMarkers {
  constructor(scene) {
    const column = new THREE.CylinderGeometry(1, 1, 1, 28, 1, true).translate(0, 0.5, 0);
    this.columnMaterial = new THREE.ShaderMaterial({
      vertexShader: COLUMN_VERTEX,
      fragmentShader: COLUMN_FRAGMENT,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.columns = this.make(scene, column, this.columnMaterial);
    const ring = new THREE.RingGeometry(0.86, 1, 40).rotateX(-Math.PI / 2);
    this.rings = this.make(scene, ring, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    const arrow = new THREE.ConeGeometry(0.45, 0.9, 4).rotateX(Math.PI);
    this.arrows = this.make(scene, arrow, new THREE.MeshBasicMaterial({ toneMapped: false }));
    const pickup = new THREE.BoxGeometry(0.6, 0.45, 0.45);
    this.pickups = this.make(scene, pickup, new THREE.MeshStandardMaterial({ roughness: 0.4, emissive: new THREE.Color('#553300'), emissiveIntensity: 0.6 }));
    this.matrix = new THREE.Matrix4();
    this.color = new THREE.Color();
    this.quaternion = new THREE.Quaternion();
    this.position = new THREE.Vector3();
    this.scale = new THREE.Vector3();
  }

  make(scene, geometry, material) {
    const mesh = new THREE.InstancedMesh(geometry, material, CAPACITY);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * 3), 3);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.renderOrder = 6;
    scene.add(mesh);
    return mesh;
  }

  push(mesh, x, y, z, sx, sy, sz, color, yaw = 0) {
    const index = mesh.count;
    if (index >= CAPACITY) return;
    this.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    this.matrix.compose(this.position.set(x, y, z), this.quaternion, this.scale.set(sx, sy, sz));
    mesh.setMatrixAt(index, this.matrix);
    mesh.setColorAt(index, this.color.set(color));
    mesh.count = index + 1;
  }

  /** Redraws all markers from a list of { x, y, z, type, color, radius }. */
  draw(markers, time) {
    for (const mesh of [this.columns, this.rings, this.arrows, this.pickups]) mesh.count = 0;
    this.columnMaterial.uniforms.uTime.value = time;
    for (const marker of markers) {
      const y = marker.y ?? 0.2;
      const radius = marker.radius ?? 2;
      const color = marker.color ?? '#ffd23f';
      if (marker.type === 'column') {
        this.push(this.columns, marker.x, y, marker.z, radius, marker.height ?? 7, radius, color);
        this.push(this.rings, marker.x, y + 0.05, marker.z, radius, 1, radius, color);
      } else if (marker.type === 'checkpoint') {
        this.push(this.columns, marker.x, y, marker.z, radius, 14, radius, color);
        this.push(this.rings, marker.x, y + 0.05, marker.z, radius, 1, radius, color);
      } else if (marker.type === 'arrow') {
        const bob = Math.sin(time * 3 + marker.x) * 0.25;
        this.push(this.arrows, marker.x, y + bob, marker.z, 1, 1, 1, color, time * 2);
      } else if (marker.type === 'pickup') {
        const bob = Math.sin(time * 2.5) * 0.15;
        this.push(this.pickups, marker.x, y + 0.6 + bob, marker.z, 1, 1, 1, color, time * 1.8);
        this.push(this.arrows, marker.x, y + 2.2 + bob, marker.z, 0.7, 0.7, 0.7, color, time * 2);
      }
    }
    for (const mesh of [this.columns, this.rings, this.arrows, this.pickups]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    }
  }
}
