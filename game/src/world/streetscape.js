// Lines every sidewalk with street furniture: lamp posts over the curb, palms or shade trees by
// district, hydrants, bins and benches, plus the traffic-signal masts at each junction.
import * as THREE from 'three';
import { CURB_HEIGHT } from '../core/config.js';
import { blockBounds, districtOfBlock, forEachBlock, specialOfBlock } from './cityPlan.js';
import { GeometryBuilder } from '../render/geometryBuilder.js';
import { SIGNAL_ARM, SIGNAL_HEAD_Y } from './trafficSignals.js';

const LAMP_SPOTS = [10, 33, 56];
const TREE_SPOTS = [21.5, 44.5];

function signalGeometry() {
  const b = new GeometryBuilder();
  const m = new THREE.Matrix4();
  m.makeScale(0.13, 6.3, 0.13).setPosition(0, 3.15, 0);
  b.addGeometry(new THREE.CylinderGeometry(1, 1.2, 1, 8), m, '#3b4048');
  b.addBox(-SIGNAL_ARM / 2, 6.15, 0, SIGNAL_ARM, 0.14, 0.14, '#3b4048');
  b.addBox(-SIGNAL_ARM, SIGNAL_HEAD_Y, 0, 0.48, 1.45, 0.36, '#23262b', { skipBottom: false });
  b.addBox(-SIGNAL_ARM, SIGNAL_HEAD_Y, -0.2, 0.7, 1.7, 0.06, '#2f3339');
  for (const y of [0.42, 0, -0.42]) b.addBox(-SIGNAL_ARM, SIGNAL_HEAD_Y + y, 0.2, 0.26, 0.26, 0.04, '#111316');
  return b.build();
}

/** Positions along one side of a block's curb, with the yaw that faces the street. */
function sideLine(b, side) {
  const inset = 0.6;
  switch (side) {
    case 'n': return { x0: b.outerMinX, z0: b.outerMinZ + inset, dx: 1, dz: 0, yaw: Math.PI, wallX: 0, wallZ: 1 };
    case 's': return { x0: b.outerMinX, z0: b.outerMaxZ - inset, dx: 1, dz: 0, yaw: 0, wallX: 0, wallZ: -1 };
    case 'e': return { x0: b.outerMaxX - inset, z0: b.outerMinZ, dx: 0, dz: 1, yaw: Math.PI / 2, wallX: -1, wallZ: 0 };
    default: return { x0: b.outerMinX + inset, z0: b.outerMinZ, dx: 0, dz: 1, yaw: -Math.PI / 2, wallX: 1, wallZ: 0 };
  }
}

export function buildStreetscape(scene, materials, collision, vegetation, props, signals, rng) {
  forEachBlock((bx, bz) => {
    const b = blockBounds(bx, bz);
    const district = districtOfBlock(bx, bz);
    const special = specialOfBlock(bx, bz);
    for (const side of ['n', 's', 'e', 'w']) {
      const line = sideLine(b, side);
      for (const t of LAMP_SPOTS) props.add('lamp', line.x0 + line.dx * t, line.z0 + line.dz * t, line.yaw, CURB_HEIGHT);
      if (district !== 'port') {
        for (const t of TREE_SPOTS) {
          const kind = district === 'palmetto' ? (rng.chance(0.5) ? 'round' : 'palm') : 'palm';
          vegetation.addTree(kind, line.x0 + line.dx * t, line.z0 + line.dz * t, rng.range(0, Math.PI * 2), rng.range(0.85, 1.2));
        }
      }
      const hydrantT = rng.chance(0.5) ? 27 : 50;
      props.add('hydrant', line.x0 + line.dx * hydrantT, line.z0 + line.dz * hydrantT, line.yaw, CURB_HEIGHT);
      const wall = 3.3;
      if (rng.chance(0.7)) {
        const t = rng.pick([15, 39, 52]);
        props.add('bin', line.x0 + line.dx * t + line.wallX * wall, line.z0 + line.dz * t + line.wallZ * wall, 0, CURB_HEIGHT);
      }
      if (special !== 'hotel' && district !== 'port' && rng.chance(0.45)) {
        const t = rng.pick([18, 46]);
        props.add('bench', line.x0 + line.dx * t + line.wallX * wall, line.z0 + line.dz * t + line.wallZ * wall, line.yaw + Math.PI, CURB_HEIGHT);
      }
    }
  });
  // Seabreeze promenade: palms, lamps facing the boulevard and benches looking at the sea.
  for (let z = -318; z <= 236; z += 14) {
    if (Math.abs(z) < 9) continue;
    vegetation.addTree('palm', 252.5, z, rng.range(0, Math.PI * 2), rng.range(0.95, 1.3));
    if ((z + 318) % 28 === 0) props.add('lamp', 247.6, z + 7, -Math.PI / 2, CURB_HEIGHT);
    else props.add('bench', 254, z + 7, Math.PI / 2, CURB_HEIGHT);
  }
  const mesh = new THREE.InstancedMesh(signalGeometry(), materials.plain, signals.heads.length);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  signals.heads.forEach((head, index) => {
    quaternion.setFromAxisAngle(up, head.yaw);
    matrix.compose(new THREE.Vector3(head.poleX, CURB_HEIGHT, head.poleZ), quaternion, one);
    mesh.setMatrixAt(index, matrix);
    collision.addBox(head.poleX - 0.2, head.poleZ - 0.2, head.poleX + 0.2, head.poleZ + 0.2, 6, 'signal');
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  scene.add(mesh);
}
