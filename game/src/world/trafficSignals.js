// Traffic lights at every junction: a staggered green-yellow-red cycle per junction, one signal
// head per approach, and the stop-or-go answer traffic AI asks for each lane.
import { GRID_X, GRID_Z, ROAD_HALF, STOP_OFFSET } from '../core/config.js';

const GREEN = 9;
const YELLOW = 2.2;
const ALL_RED = 1.2;
const HALF_CYCLE = GREEN + YELLOW + ALL_RED;
const CYCLE = HALF_CYCLE * 2;
export const SIGNAL_ARM = 5.2;
export const SIGNAL_HEAD_Y = 5.6;

export class TrafficSignals {
  constructor() {
    this.time = 0;
    this.junctions = [];
    this.heads = [];
    for (let j = 0; j < GRID_Z.length; j += 1) {
      for (let i = 0; i < GRID_X.length; i += 1) {
        this.junctions.push({ i, j, x: GRID_X[i], z: GRID_Z[j], offset: ((i * 5 + j * 3) % 8) * 3 });
      }
    }
    for (const junction of this.junctions) this.addHeads(junction);
  }

  addHeads(junction) {
    const { i, j, x, z } = junction;
    const index = this.junctionIndex(i, j);
    const corner = ROAD_HALF + 0.8;
    const back = STOP_OFFSET + 0.5;
    // Eastbound traffic (from the west) keeps to +z; its pole stands on the near-right corner.
    if (i > 0) this.heads.push({ junction: index, axis: 'x', poleX: x - back, poleZ: z + corner, yaw: -Math.PI / 2 });
    if (i < GRID_X.length - 1) this.heads.push({ junction: index, axis: 'x', poleX: x + back, poleZ: z - corner, yaw: Math.PI / 2 });
    if (j > 0) this.heads.push({ junction: index, axis: 'z', poleX: x - corner, poleZ: z - back, yaw: Math.PI });
    if (j < GRID_Z.length - 1) this.heads.push({ junction: index, axis: 'z', poleX: x + corner, poleZ: z + back, yaw: 0 });
    for (let h = this.heads.length - 1; h >= 0 && this.heads[h].junction === index; h -= 1) {
      const head = this.heads[h];
      // The head hangs at local (-ARM, HEAD_Y, 0.25) and faces local +Z.
      const cos = Math.cos(head.yaw);
      const sin = Math.sin(head.yaw);
      const lx = -SIGNAL_ARM;
      const lz = 0.26;
      head.lampX = head.poleX + lx * cos + lz * sin;
      head.lampZ = head.poleZ - lx * sin + lz * cos;
    }
  }

  junctionIndex(i, j) {
    return j * GRID_X.length + i;
  }

  update(dt) {
    this.time += dt;
  }

  /** 'green', 'yellow' or 'red' for traffic moving along axis 'x' or 'z' through a junction. */
  state(junctionIndex, axis) {
    const t = (this.time + this.junctions[junctionIndex].offset) % CYCLE;
    const local = axis === 'x' ? t : (t + HALF_CYCLE) % CYCLE;
    if (local < GREEN) return 'green';
    if (local < GREEN + YELLOW) return 'yellow';
    return 'red';
  }
}
