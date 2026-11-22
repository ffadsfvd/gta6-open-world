// The Sunwheel boardwalk: a wooden promenade that winds along the sand between the lighthouse
// and the Ironwharf quay, swinging out toward the surf and back, broken only by the pier. Lamp
// posts follow its curve (they light up after dark like the street lamps).
import { PIER } from '../core/config.js';
import { beachHeight } from './terrain.js';

const WIDTH = 4.2;
const STEP = 3;
const NORTH = -300;
const SOUTH = 232;

/** The boardwalk's centre line: x for a given z. */
export function boardwalkX(z) {
  return 275 + Math.sin(z / 52) * 9 + Math.sin(z / 21 + 1.3) * 3.5;
}

function addStrip(builder, z0, z1) {
  const color = { r: 1, g: 1, b: 1 };
  let along = 0;
  let previous = null;
  for (let z = z0; z <= z1 + 0.01; z += STEP) {
    const x = boardwalkX(z);
    // Direction of travel and the sideways normal, from the neighbouring points.
    const dx = boardwalkX(z + 0.5) - boardwalkX(z - 0.5);
    const length = Math.hypot(dx, 1);
    const nx = 1 / length;
    const nz = -dx / length;
    if (previous) along += Math.hypot(x - previous.x, z - previous.z);
    const base = builder.vertexCount;
    for (const side of [-1, 1]) {
      const px = x + nx * side * (WIDTH / 2);
      const pz = z + nz * side * (WIDTH / 2);
      builder.pushVertex(px, beachHeight(px) + 0.32, pz, 0, 1, 0, side > 0 ? 1 : 0, along / 2, color);
    }
    if (previous) builder.indices.push(previous.base, base, previous.base + 1, previous.base + 1, base, base + 1);
    previous = { x, z, base };
  }
}

function addEdges(builder, z0, z1) {
  // A low timber kerb along both edges, so the deck reads as raised boards.
  for (let z = z0; z < z1; z += STEP) {
    const x = boardwalkX(z + STEP / 2);
    const yaw = Math.atan2(boardwalkX(z + STEP) - boardwalkX(z), STEP);
    for (const side of [-1, 1]) {
      const ex = x + Math.cos(yaw) * side * (WIDTH / 2);
      const ez = z + STEP / 2 - Math.sin(yaw) * side * (WIDTH / 2);
      builder.addBox(ex, beachHeight(ex) + 0.2, ez, 0.16, 0.36, STEP + 0.05, '#7a5234', { yaw, skipBottom: false });
    }
  }
}

/** Builds the boardwalk into the shore's buckets and lines it with lamp posts. */
export function buildBoardwalk(buckets, props) {
  const planks = buckets.get('planks');
  const plain = buckets.get('plain');
  const gap = PIER.halfWidth + 2;
  for (const [z0, z1] of [[NORTH, -gap], [gap, SOUTH]]) {
    addStrip(planks, z0, z1);
    addEdges(plain, z0, z1);
  }
  for (let z = NORTH + 10; z < SOUTH; z += 26) {
    if (Math.abs(z) < gap + 6) continue;
    const x = boardwalkX(z);
    const dx = boardwalkX(z + 0.5) - boardwalkX(z - 0.5);
    // On the inland edge, the lamp arm reaching out over the boards.
    const nx = 1 / Math.hypot(dx, 1);
    const nz = -dx / Math.hypot(dx, 1);
    const lx = x - nx * (WIDTH / 2 + 0.4);
    const lz = z - nz * (WIDTH / 2 + 0.4);
    props.add('lamp', lx, lz, Math.atan2(nx, nz), beachHeight(lx) + 0.1);
  }
}
