// Palm trees, round shade trees and bushes, drawn as instanced meshes (one draw call per part
// for the whole city). Palms get a curved ringed trunk and drooping, folded fronds.
import * as THREE from 'three';
import { GeometryBuilder } from '../render/geometryBuilder.js';

const PALM_HEIGHT = 10;

/** A trunk leaning along +X, built from rings so it bends and shows growth bands. */
function createPalmTrunk() {
  const builder = new GeometryBuilder();
  const segments = 9;
  const ring = new THREE.CylinderGeometry(1, 1, 1, 7, 1, true);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const position = new THREE.Vector3();
  for (let index = 0; index < segments; index += 1) {
    const t0 = index / segments;
    const t1 = (index + 1) / segments;
    const x0 = Math.pow(t0, 2) * 1.6;
    const x1 = Math.pow(t1, 2) * 1.6;
    const y0 = t0 * PALM_HEIGHT;
    const y1 = t1 * PALM_HEIGHT;
    const length = Math.hypot(x1 - x0, y1 - y0);
    const lean = Math.atan2(x1 - x0, y1 - y0);
    const radius = 0.3 - t0 * 0.12;
    quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -lean);
    scale.set(radius, length * 1.02, radius);
    position.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
    matrix.compose(position, quaternion, scale);
    builder.addGeometry(ring, matrix, index % 2 === 0 ? '#8a6a4a' : '#a07f5c');
  }
  return builder.build();
}

/** Nine drooping, V-folded fronds and a coconut cluster around the trunk top. */
function createPalmCrown() {
  const builder = new GeometryBuilder();
  const top = new THREE.Vector3(1.6, PALM_HEIGHT, 0);
  const fronds = 9;
  const steps = 6;
  const dark = new THREE.Color('#2f6b2a');
  const light = new THREE.Color('#8dbf45');
  const color = new THREE.Color();
  for (let frond = 0; frond < fronds; frond += 1) {
    const angle = (frond / fronds) * Math.PI * 2 + (frond % 2) * 0.2;
    const dirX = Math.cos(angle);
    const dirZ = Math.sin(angle);
    const sideX = -dirZ;
    const sideZ = dirX;
    const length = 4.4 + (frond % 3) * 0.5;
    const lift = 0.9 + (frond % 2) * 0.5;
    let previous = null;
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const reach = t * length;
      const drop = lift * Math.sin(t * Math.PI * 0.7) - t * t * 2.6;
      const width = Math.sin(Math.min(1, t * 1.3) * Math.PI) * 0.75 + 0.05;
      const cx = top.x + dirX * reach;
      const cy = top.y + drop;
      const cz = top.z + dirZ * reach;
      const current = {
        left: [cx + sideX * width, cy - width * 0.35, cz + sideZ * width],
        mid: [cx, cy + 0.06, cz],
        right: [cx - sideX * width, cy - width * 0.35, cz - sideZ * width],
      };
      if (previous) {
        color.copy(dark).lerp(light, t);
        const a = previous;
        const b = current;
        quadFromPoints(builder, a.left, b.left, b.mid, a.mid, color);
        quadFromPoints(builder, a.mid, b.mid, b.right, a.right, color);
      }
      previous = current;
    }
  }
  const nut = new THREE.IcosahedronGeometry(0.22, 0);
  const matrix = new THREE.Matrix4();
  for (let index = 0; index < 4; index += 1) {
    const a = (index / 4) * Math.PI * 2;
    matrix.makeTranslation(top.x + Math.cos(a) * 0.35, top.y - 0.35, top.z + Math.sin(a) * 0.35);
    builder.addGeometry(nut, matrix, '#6b4a1f');
  }
  return builder.build();
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/** Two triangles through four points in order (a, b, c, d). */
function quadFromPoints(builder, a, b, c, d, color) {
  const base = builder.vertexCount;
  const u = sub(b, a);
  const v = sub(d, a);
  let nx = u[1] * v[2] - u[2] * v[1];
  let ny = u[2] * v[0] - u[0] * v[2];
  let nz = u[0] * v[1] - u[1] * v[0];
  const length = Math.hypot(nx, ny, nz) || 1;
  nx /= length;
  ny /= length;
  nz /= length;
  if (ny < 0) {
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }
  for (const p of [a, b, c, d]) builder.pushVertex(p[0], p[1], p[2], nx, ny, nz, 0, 0, color);
  builder.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function createRoundTree() {
  const builder = new GeometryBuilder();
  const matrix = new THREE.Matrix4();
  matrix.makeScale(0.28, 3.2, 0.28).setPosition(0, 1.6, 0);
  builder.addGeometry(new THREE.CylinderGeometry(1, 1.2, 1, 6), matrix, '#6d5038');
  const canopy = new THREE.IcosahedronGeometry(1, 1);
  const blobs = [[0, 4.6, 0, 2.6], [1.2, 4.0, 0.6, 1.8], [-1.1, 4.2, -0.5, 1.9], [0.2, 5.6, -0.6, 1.7]];
  for (const [x, y, z, s] of blobs) {
    matrix.makeScale(s, s * 0.85, s).setPosition(x, y, z);
    builder.addGeometry(canopy, matrix, s > 2 ? '#4f8a35' : '#5f9c3e');
  }
  return builder.build();
}

export class Vegetation {
  constructor() {
    this.palms = [];
    this.rounds = [];
  }

  addTree(kind, x, z, yaw, scale = 1) {
    (kind === 'palm' ? this.palms : this.rounds).push({ x, z, yaw, scale });
  }

  /** Creates the instanced meshes and adds a trunk collider per tree. */
  build(scene, materials, collision, groundHeight) {
    const trunkGeometry = createPalmTrunk();
    const crownGeometry = createPalmCrown();
    const roundGeometry = createRoundTree();
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const makeInstanced = (geometry, material, list) => {
      const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, list.length));
      list.forEach((tree, index) => {
        quaternion.setFromAxisAngle(up, tree.yaw);
        position.set(tree.x, groundHeight(tree.x, tree.z) - 0.05, tree.z);
        scale.setScalar(tree.scale);
        matrix.compose(position, quaternion, scale);
        mesh.setMatrixAt(index, matrix);
      });
      mesh.count = list.length;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      scene.add(mesh);
      return mesh;
    };
    makeInstanced(trunkGeometry, materials.plain, this.palms);
    makeInstanced(crownGeometry, materials.foliage, this.palms);
    makeInstanced(roundGeometry, materials.plain, this.rounds);
    for (const tree of [...this.palms, ...this.rounds]) {
      collision.addBox(tree.x - 0.35, tree.z - 0.35, tree.x + 0.35, tree.z + 0.35, 6, 'tree');
    }
  }
}
