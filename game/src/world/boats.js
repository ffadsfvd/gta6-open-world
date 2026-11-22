// Boats on the water: sailing yachts, motor cruisers and fishing boats moored along Sunwheel
// Pier and at the marina pontoons off the Ironwharf quay, and a few more out in the bay. Each
// kind is one instanced mesh with rounded, tapered hulls; every boat bobs and rolls on the swell.
import * as THREE from 'three';
import { GeometryBuilder } from '../render/geometryBuilder.js';
import { PIER, WATER_LEVEL } from '../core/config.js';

/** A hull: pointed bow toward +z, deck at y = freeboard, narrowing toward the keel. */
function addHull(builder, length, width, depth, freeboard, color) {
  const half = width / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-half, -length / 2);
  shape.lineTo(half, -length / 2);
  shape.lineTo(half, length * 0.12);
  shape.quadraticCurveTo(half * 0.95, length * 0.4, 0, length / 2);
  shape.quadraticCurveTo(-half * 0.95, length * 0.4, -half, length * 0.12);
  shape.lineTo(-half, -length / 2);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 2, curveSegments: 8 });
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, freeboard, 0);
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i += 1) {
    const y = position.getY(i);
    const t = Math.min(1, Math.max(0, (y - (freeboard - depth)) / depth));
    position.setX(i, position.getX(i) * (0.4 + 0.6 * Math.sqrt(t)));
  }
  geometry.computeVertexNormals();
  builder.addGeometry(geometry, new THREE.Matrix4(), color);
  geometry.dispose();
}

function addCylinder(builder, x, y, z, radius, height, color, rotateZ = 0) {
  const geometry = new THREE.CylinderGeometry(radius, radius, height, 8);
  const m = new THREE.Matrix4().makeRotationZ(rotateZ).setPosition(x, y, z);
  builder.addGeometry(geometry, m, color);
  geometry.dispose();
}

function sailboat() {
  const b = new GeometryBuilder();
  addHull(b, 9, 2.9, 1.5, 0.75, '#f7f7f4');
  b.addBox(0, 0.55, 0, 2.95, 0.1, 6.6, '#1d4e89', { skipBottom: false });
  b.addBox(0, 0.8, -0.6, 2.5, 0.06, 6.4, '#b88a5a');
  b.addBox(0, 1.25, -0.4, 1.7, 0.7, 2.6, '#f4f4f0', { skipBottom: false });
  b.addBox(0, 1.3, 0.92, 1.5, 0.35, 0.05, '#1c2733');
  addCylinder(b, 0, 6.6, 0.9, 0.07, 11.6, '#d9dce1');
  b.addBox(0, 2.15, -0.9, 0.22, 0.22, 3.4, '#1d4e89', { skipBottom: false });
  return b.build();
}

function motorYacht() {
  const b = new GeometryBuilder();
  addHull(b, 14, 4.2, 1.9, 1.0, '#fbfbf8');
  b.addBox(0, 0.62, 0, 4.25, 0.12, 9.6, '#14213d', { skipBottom: false });
  b.addBox(0, 1.05, -1.2, 3.8, 0.06, 10.5, '#c49a6c');
  b.addBox(0, 1.8, -1.0, 3.3, 1.5, 6.2, '#f4f4f1', { skipBottom: false });
  b.addBox(0, 1.95, -1.0, 3.35, 0.55, 6.25, '#16222e', { skipBottom: false });
  b.addBox(0, 2.9, -1.6, 2.7, 0.8, 3.6, '#f4f4f1', { skipBottom: false });
  b.addBox(0, 3.0, -1.6, 2.75, 0.3, 3.65, '#16222e', { skipBottom: false });
  b.addBox(0, 4.1, -2.2, 0.12, 1.4, 0.12, '#d9dce1');
  b.addBox(0, 4.8, -2.2, 1.6, 0.12, 0.3, '#d9dce1');
  return b.build();
}

function fishingBoat(paint) {
  const b = new GeometryBuilder();
  addHull(b, 8, 3, 1.4, 0.8, paint);
  b.addBox(0, 0.95, 0, 3.0, 0.12, 6.0, '#f1ede4', { skipBottom: false });
  b.addBox(0, 1.75, 0.6, 1.8, 1.6, 1.8, '#f1ede4', { skipBottom: false });
  b.addBox(0, 2.05, 1.52, 1.5, 0.5, 0.05, '#1c2733');
  b.addBox(0, 2.6, 0.6, 2.0, 0.12, 2.0, paint, { skipBottom: false });
  addCylinder(b, 0, 3.6, -0.8, 0.07, 4.4, '#c8c2b8');
  for (const side of [-1, 1]) addCylinder(b, side * 1.6, 3.3, -0.8, 0.05, 4.2, '#c8c2b8', side * 0.7);
  return b.build();
}

function pontoon(builder, x0, x1, z, fingers) {
  builder.addBox((x0 + x1) / 2, WATER_LEVEL + 0.35, z, x1 - x0, 0.3, 2.4, '#b9905f', { skipBottom: false });
  for (const x of fingers) builder.addBox(x, WATER_LEVEL + 0.33, z + 6, 1.4, 0.26, 10, '#b9905f', { skipBottom: false });
}

export class Boats {
  constructor(scene, rng) {
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.1 });
    this.kinds = {
      sail: sailboat(),
      yacht: motorYacht(),
      fishingRed: fishingBoat('#c1272d'),
      fishingBlue: fishingBoat('#1f6f8b'),
    };
    this.moorings = [];
    const moor = (kind, x, z, yaw) => this.moorings.push({ kind, x, z, yaw, phase: rng.range(0, Math.PI * 2), sway: rng.range(0.7, 1.2) });
    // Along Sunwheel Pier, nose out to sea.
    let side = 1;
    for (let x = 290; x < PIER.maxX - 6; x += 12.5) {
      moor(rng.pick(['sail', 'sail', 'yacht', 'fishingRed', 'fishingBlue']), x, side * (PIER.halfWidth + 3.4), Math.PI / 2 + rng.range(-0.05, 0.05));
      side = -side;
    }
    // The marina off the Ironwharf quay: two rows on the pontoon fingers.
    const docks = new GeometryBuilder();
    const fingers = [];
    for (let x = 18; x <= 222; x += 12) fingers.push(x);
    pontoon(docks, 10, 230, 306, fingers);
    for (const x of fingers) {
      for (const offset of [-4.2, 4.2]) {
        if (rng.chance(0.2)) continue;
        moor(rng.pick(['sail', 'sail', 'yacht', 'fishingRed', 'fishingBlue']), x + offset, 313.5, rng.range(-0.04, 0.04));
      }
    }
    // Out in the bay.
    for (let index = 0; index < 12; index += 1) {
      const x = rng.range(360, 820);
      const z = rng.range(-420, 360);
      if (Math.abs(z) < 40 && x < 430) continue;
      moor(rng.chance(0.6) ? 'sail' : 'yacht', x, z, rng.range(0, Math.PI * 2));
    }
    const docksMesh = new THREE.Mesh(docks.build(), material);
    docksMesh.receiveShadow = true;
    scene.add(docksMesh);
    this.meshes = {};
    for (const [kind, geometry] of Object.entries(this.kinds)) {
      const list = this.moorings.filter((boat) => boat.kind === kind);
      const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, list.length));
      mesh.count = list.length;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.meshes[kind] = { mesh, list };
    }
    this.matrix = new THREE.Matrix4();
    this.quaternion = new THREE.Quaternion();
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.position = new THREE.Vector3();
    this.scale = new THREE.Vector3(1, 1, 1);
    this.update(0);
  }

  /** The swell: each boat rises, pitches and rolls on its own rhythm. */
  update(time) {
    for (const { mesh, list } of Object.values(this.meshes)) {
      list.forEach((boat, index) => {
        const t = time * boat.sway + boat.phase;
        this.euler.set(Math.sin(t * 0.55) * 0.02, boat.yaw, Math.sin(t * 0.7) * 0.045, 'YXZ');
        this.quaternion.setFromEuler(this.euler);
        this.position.set(boat.x, WATER_LEVEL - 0.25 + Math.sin(t * 0.9) * 0.1, boat.z);
        this.matrix.compose(this.position, this.quaternion, this.scale);
        mesh.setMatrixAt(index, this.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
