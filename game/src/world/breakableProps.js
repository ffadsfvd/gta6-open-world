// Street furniture a car can flatten: lamp posts, fire hydrants, bins and benches. Each kind is
// one instanced mesh; a hard hit tips the instance over, frees its collider and tells the world.
import * as THREE from 'three';
import { GeometryBuilder } from '../render/geometryBuilder.js';

function lampGeometry() {
  const b = new GeometryBuilder();
  const m = new THREE.Matrix4();
  m.makeScale(0.11, 7.4, 0.11).setPosition(0, 3.7, 0);
  b.addGeometry(new THREE.CylinderGeometry(1, 1.3, 1, 8), m, '#5d636b');
  b.addBox(0, 7.35, 1.1, 0.14, 0.14, 2.3, '#5d636b');
  b.addBox(0, 7.25, 2.25, 0.5, 0.22, 0.9, '#e9e6dc', { skipBottom: false });
  b.addBox(0, 0.3, 0, 0.36, 0.6, 0.36, '#4a4f56');
  return b.build();
}

function hydrantGeometry() {
  const b = new GeometryBuilder();
  const m = new THREE.Matrix4();
  m.makeScale(0.16, 0.7, 0.16).setPosition(0, 0.35, 0);
  b.addGeometry(new THREE.CylinderGeometry(1, 1.1, 1, 8), m, '#d62828');
  m.makeScale(0.19, 0.12, 0.19).setPosition(0, 0.75, 0);
  b.addGeometry(new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), m, '#d62828');
  b.addBox(0, 0.45, 0, 0.5, 0.1, 0.1, '#b51f1f');
  return b.build();
}

function binGeometry() {
  const b = new GeometryBuilder();
  const m = new THREE.Matrix4();
  m.makeScale(0.32, 0.95, 0.32).setPosition(0, 0.48, 0);
  b.addGeometry(new THREE.CylinderGeometry(1, 0.9, 1, 10), m, '#2a7f62');
  m.makeScale(0.34, 0.08, 0.34).setPosition(0, 0.98, 0);
  b.addGeometry(new THREE.CylinderGeometry(1, 1, 1, 10), m, '#1f5f49');
  return b.build();
}

function benchGeometry() {
  const b = new GeometryBuilder();
  b.addBox(0, 0.45, 0, 1.9, 0.08, 0.5, '#9a6b43');
  b.addBox(0, 0.8, -0.24, 1.9, 0.4, 0.06, '#9a6b43');
  for (const x of [-0.8, 0.8]) b.addBox(x, 0.22, 0, 0.08, 0.44, 0.45, '#3d3d3d');
  return b.build();
}

const KINDS = {
  lamp: { geometry: lampGeometry, radius: 0.22, top: 7, mass: 0.7 },
  hydrant: { geometry: hydrantGeometry, radius: 0.22, top: 0.8, mass: 0.5 },
  bin: { geometry: binGeometry, radius: 0.34, top: 1, mass: 0.2 },
  bench: { geometry: benchGeometry, radius: 0.5, top: 0.9, mass: 0.3 },
};

const tempMatrix = new THREE.Matrix4();
const tempQuaternion = new THREE.Quaternion();
const tiltQuaternion = new THREE.Quaternion();
const tempPosition = new THREE.Vector3();
const UNIT = new THREE.Vector3(1, 1, 1);
const UP = new THREE.Vector3(0, 1, 0);

export class BreakableProps {
  constructor(events) {
    this.events = events;
    this.items = [];
    this.meshes = {};
    this.falling = [];
  }

  add(kind, x, z, yaw, y = 0.15) {
    this.items.push({ kind, x, y, z, yaw, broken: false, tilt: 0, tiltAxisX: 0, tiltAxisZ: 0, index: 0, box: null });
  }

  build(scene, materials, collision) {
    for (const kind of Object.keys(KINDS)) {
      const list = this.items.filter((item) => item.kind === kind);
      if (list.length === 0) continue;
      const mesh = new THREE.InstancedMesh(KINDS[kind].geometry(), kind === 'lamp' ? materials.shiny : materials.plain, list.length);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      list.forEach((item, index) => {
        item.index = index;
        this.writeMatrix(mesh, item);
        const r = KINDS[kind].radius;
        item.box = collision.addBox(item.x - r, item.z - r, item.x + r, item.z + r, KINDS[kind].top, 'prop');
        item.box.prop = item;
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      scene.add(mesh);
      this.meshes[kind] = mesh;
    }
  }

  writeMatrix(mesh, item) {
    tempQuaternion.setFromAxisAngle(UP, item.yaw);
    if (item.tilt > 0) {
      tiltQuaternion.setFromAxisAngle(tempPosition.set(item.tiltAxisX, 0, item.tiltAxisZ), item.tilt);
      tempQuaternion.premultiply(tiltQuaternion);
    }
    tempPosition.set(item.x, item.y, item.z);
    tempMatrix.compose(tempPosition, tempQuaternion, UNIT);
    mesh.setMatrixAt(item.index, tempMatrix);
  }

  /** A vehicle moving at (vx, vz) hit this prop's box. Returns the speed share the car keeps. */
  knock(box, vx, vz) {
    const item = box.prop;
    if (!item || item.broken) return 1;
    const speed = Math.hypot(vx, vz);
    if (speed < 4) return 0;
    item.broken = true;
    box.enabled = false;
    // Tip over around the horizontal axis perpendicular to the impact.
    item.tiltAxisX = vz / speed;
    item.tiltAxisZ = -vx / speed;
    this.falling.push(item);
    this.events.emit('propBroken', { kind: item.kind, x: item.x, z: item.z, speed });
    return 1 - KINDS[item.kind].mass * 0.3;
  }

  update(dt) {
    for (let index = this.falling.length - 1; index >= 0; index -= 1) {
      const item = this.falling[index];
      item.tilt = Math.min(Math.PI / 2 - 0.05, item.tilt + dt * (1.5 + item.tilt * 4));
      this.writeMatrix(this.meshes[item.kind], item);
      this.meshes[item.kind].instanceMatrix.needsUpdate = true;
      if (item.tilt >= Math.PI / 2 - 0.05) this.falling.splice(index, 1);
    }
  }
}
