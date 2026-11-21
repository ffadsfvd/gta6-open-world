// Asphalt for every avenue and street, painted markings (double yellow centre lines, dashed
// lane lines, edge lines, stop lines, zebra crossings) and the raised sidewalks with curbs.
import { CURB_HEIGHT, GRID_X, GRID_Z, LANE_WIDTH, ROAD_HALF, STOP_OFFSET } from '../core/config.js';
import { blockBounds, forEachBlock } from './cityPlan.js';

const WHITE = '#f2f2ee';
const YELLOW = '#f2c230';
const MARK_Y = 0.025;

/** A painted strip along an axis: `along` from a to b at offset `across` with width w. */
function paintStrip(marks, axis, line, a, b, across, width, color) {
  if (axis === 'x') marks.addFloor(a, line + across - width / 2, b, line + across + width / 2, MARK_Y, color);
  else marks.addFloor(line + across - width / 2, a, line + across + width / 2, b, MARK_Y, color);
}

function paintSegment(marks, axis, line, start, end) {
  const a = start + ROAD_HALF + 3.6;
  const b = end - ROAD_HALF - 3.6;
  paintStrip(marks, axis, line, a, b, -0.17, 0.12, YELLOW);
  paintStrip(marks, axis, line, a, b, 0.17, 0.12, YELLOW);
  paintStrip(marks, axis, line, start + ROAD_HALF, end - ROAD_HALF, -(ROAD_HALF - 0.35), 0.14, WHITE);
  paintStrip(marks, axis, line, start + ROAD_HALF, end - ROAD_HALF, ROAD_HALF - 0.35, 0.14, WHITE);
  for (let s = a + 1; s < b - 3; s += 9) {
    paintStrip(marks, axis, line, s, s + 3, -LANE_WIDTH, 0.13, WHITE);
    paintStrip(marks, axis, line, s, s + 3, LANE_WIDTH, 0.13, WHITE);
  }
  // Stop lines: traffic heading to `end` drives on the +offset half for x roads and the -offset half for z roads.
  const positiveHalf = axis === 'x' ? 1 : -1;
  paintStrip(marks, axis, line, end - STOP_OFFSET + 0.1, end - STOP_OFFSET + 0.55, positiveHalf * ROAD_HALF / 2, ROAD_HALF, WHITE);
  paintStrip(marks, axis, line, start + STOP_OFFSET - 0.55, start + STOP_OFFSET - 0.1, -positiveHalf * ROAD_HALF / 2, ROAD_HALF, WHITE);
  // Zebra crossings just outside each junction.
  for (const zebraStart of [start + ROAD_HALF + 0.4, end - ROAD_HALF - 3.4]) {
    for (let across = -ROAD_HALF + 0.6; across < ROAD_HALF - 0.4; across += 1.2) {
      paintStrip(marks, axis, line, zebraStart, zebraStart + 3, across + 0.3, 0.6, WHITE);
    }
  }
}

function addSidewalkRing(buckets, b) {
  const walk = buckets.get('sidewalk');
  const curb = buckets.get('plain');
  const y = CURB_HEIGHT;
  walk.addFloor(b.outerMinX, b.outerMinZ, b.outerMaxX, b.lotMinZ, y, '#ffffff', 3);
  walk.addFloor(b.outerMinX, b.lotMaxZ, b.outerMaxX, b.outerMaxZ, y, '#ffffff', 3);
  walk.addFloor(b.outerMinX, b.lotMinZ, b.lotMinX, b.lotMaxZ, y, '#ffffff', 3);
  walk.addFloor(b.lotMaxX, b.lotMinZ, b.outerMaxX, b.lotMaxZ, y, '#ffffff', 3);
  const w = b.outerMaxX - b.outerMinX;
  const d = b.outerMaxZ - b.outerMinZ;
  const color = '#c9c3b8';
  curb.addQuad([b.outerMaxX, 0, b.outerMinZ], [-w, 0, 0], [0, y, 0], color);
  curb.addQuad([b.outerMinX, 0, b.outerMaxZ], [w, 0, 0], [0, y, 0], color);
  curb.addQuad([b.outerMaxX, 0, b.outerMaxZ], [0, 0, -d], [0, y, 0], color);
  curb.addQuad([b.outerMinX, 0, b.outerMinZ], [0, 0, d], [0, y, 0], color);
}

export function buildRoads(buckets) {
  const asphalt = buckets.get('asphalt');
  const marks = buckets.get('markings');
  const zMin = GRID_Z[0] - ROAD_HALF;
  const zMax = GRID_Z[GRID_Z.length - 1] + ROAD_HALF;
  for (const x of GRID_X) asphalt.addFloor(x - ROAD_HALF, zMin, x + ROAD_HALF, zMax, 0, '#ffffff', 10);
  for (const z of GRID_Z) {
    for (let index = 0; index < GRID_X.length - 1; index += 1) {
      asphalt.addFloor(GRID_X[index] + ROAD_HALF, z - ROAD_HALF, GRID_X[index + 1] - ROAD_HALF, z + ROAD_HALF, 0, '#ffffff', 10);
    }
  }
  for (const z of GRID_Z) {
    for (let index = 0; index < GRID_X.length - 1; index += 1) paintSegment(marks, 'x', z, GRID_X[index], GRID_X[index + 1]);
  }
  for (const x of GRID_X) {
    for (let index = 0; index < GRID_Z.length - 1; index += 1) paintSegment(marks, 'z', x, GRID_Z[index], GRID_Z[index + 1]);
  }
  forEachBlock((bx, bz) => addSidewalkRing(buckets, blockBounds(bx, bz)));
}
