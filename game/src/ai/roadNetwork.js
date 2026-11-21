// The drivable graph for AI: junctions on the street grid, two right-hand lanes each way,
// lane lines between stop lines, curved turns through junctions and A* routes for pursuit.
import { GRID_X, GRID_Z, LANE_WIDTH, STOP_OFFSET } from '../core/config.js';

export class RoadNetwork {
  constructor() {
    this.columns = GRID_X.length;
    this.rows = GRID_Z.length;
    this.nodes = [];
    for (let j = 0; j < this.rows; j += 1) {
      for (let i = 0; i < this.columns; i += 1) {
        this.nodes.push({ id: j * this.columns + i, i, j, x: GRID_X[i], z: GRID_Z[j], neighbors: [] });
      }
    }
    for (const node of this.nodes) {
      const { i, j } = node;
      if (i > 0) node.neighbors.push(this.nodeAt(i - 1, j).id);
      if (i < this.columns - 1) node.neighbors.push(this.nodeAt(i + 1, j).id);
      if (j > 0) node.neighbors.push(this.nodeAt(i, j - 1).id);
      if (j < this.rows - 1) node.neighbors.push(this.nodeAt(i, j + 1).id);
    }
  }

  nodeAt(i, j) {
    return this.nodes[j * this.columns + i];
  }

  nearestNode(x, z) {
    let best = this.nodes[0];
    let bestDistance = Infinity;
    for (const node of this.nodes) {
      const d = (node.x - x) ** 2 + (node.z - z) ** 2;
      if (d < bestDistance) {
        bestDistance = d;
        best = node;
      }
    }
    return best;
  }

  /** The lane from junction a toward junction b: right-hand side, lane 0 inner, 1 outer. */
  lane(aId, bId, lane) {
    const a = this.nodes[aId];
    const b = this.nodes[bId];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    const dx = (b.x - a.x) / length;
    const dz = (b.z - a.z) / length;
    const rx = -dz;
    const rz = dx;
    const offset = (lane + 0.5) * LANE_WIDTH;
    return {
      sx: a.x + dx * STOP_OFFSET + rx * offset,
      sz: a.z + dz * STOP_OFFSET + rz * offset,
      ex: b.x - dx * STOP_OFFSET + rx * offset,
      ez: b.z - dz * STOP_OFFSET + rz * offset,
      dx, dz,
      yaw: Math.atan2(dx, dz),
      axis: Math.abs(dx) > 0.5 ? 'x' : 'z',
      length: length - STOP_OFFSET * 2,
    };
  }

  /** Points of a smooth turn from the end of lane (prev->node) to the start of lane (node->next). */
  turnPoints(prevId, nodeId, nextId, laneIn, laneOut) {
    const a = this.lane(prevId, nodeId, laneIn);
    const b = this.lane(nodeId, nextId, laneOut);
    const straight = Math.abs(a.dx * b.dx + a.dz * b.dz) > 0.9;
    const points = [];
    if (straight) {
      points.push({ x: (a.ex + b.sx) / 2, z: (a.ez + b.sz) / 2 });
      return points;
    }
    // Control point: where the two lane lines cross.
    const cross = a.dx * b.dz - a.dz * b.dx;
    const t = ((b.sx - a.ex) * b.dz - (b.sz - a.ez) * b.dx) / cross;
    const cx = a.ex + a.dx * t;
    const cz = a.ez + a.dz * t;
    for (let step = 1; step <= 5; step += 1) {
      const u = step / 6;
      const w0 = (1 - u) * (1 - u);
      const w1 = 2 * u * (1 - u);
      const w2 = u * u;
      points.push({ x: a.ex * w0 + cx * w1 + b.sx * w2, z: a.ez * w0 + cz * w1 + b.sz * w2 });
    }
    return points;
  }

  /** Which way a car turns going prev -> node -> next: 'left', 'right' or 'straight'. */
  turnKind(prevId, nodeId, nextId) {
    const a = this.nodes[prevId];
    const n = this.nodes[nodeId];
    const b = this.nodes[nextId];
    const inX = Math.sign(n.x - a.x);
    const inZ = Math.sign(n.z - a.z);
    const outX = Math.sign(b.x - n.x);
    const outZ = Math.sign(b.z - n.z);
    if (inX === outX && inZ === outZ) return 'straight';
    // Right of travel direction (dx, dz) is (-dz, dx).
    return outX === -inZ && outZ === inX ? 'right' : 'left';
  }

  /** A* over junctions; returns node ids from start to goal (inclusive). */
  findPath(startId, goalId) {
    if (startId === goalId) return [startId];
    const goal = this.nodes[goalId];
    const open = new Set([startId]);
    const came = new Map();
    const g = new Map([[startId, 0]]);
    const f = new Map([[startId, this.heuristic(this.nodes[startId], goal)]]);
    while (open.size > 0) {
      let current = null;
      let bestF = Infinity;
      for (const id of open) {
        const score = f.get(id) ?? Infinity;
        if (score < bestF) {
          bestF = score;
          current = id;
        }
      }
      if (current === goalId) {
        const path = [current];
        while (came.has(current)) {
          current = came.get(current);
          path.unshift(current);
        }
        return path;
      }
      open.delete(current);
      const node = this.nodes[current];
      for (const next of node.neighbors) {
        const other = this.nodes[next];
        const tentative = g.get(current) + Math.hypot(other.x - node.x, other.z - node.z);
        if (tentative < (g.get(next) ?? Infinity)) {
          came.set(next, current);
          g.set(next, tentative);
          f.set(next, tentative + this.heuristic(other, goal));
          open.add(next);
        }
      }
    }
    return [startId];
  }

  heuristic(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
  }

  /** A random spot on a random lane, for spawning traffic. */
  randomLaneSpot(rng, near = null, minDistance = 0, maxDistance = Infinity) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const from = rng.int(0, this.nodes.length - 1);
      const neighbors = this.nodes[from].neighbors;
      const to = neighbors[rng.int(0, neighbors.length - 1)];
      const lane = rng.int(0, 1);
      const line = this.lane(from, to, lane);
      const t = rng.range(0.15, 0.85);
      const x = line.sx + (line.ex - line.sx) * t;
      const z = line.sz + (line.ez - line.sz) * t;
      if (near) {
        const d = Math.hypot(x - near.x, z - near.z);
        if (d < minDistance || d > maxDistance) continue;
      }
      return { from, to, lane, t, x, z, yaw: line.yaw };
    }
    return null;
  }

  /** The lane a point is driving along, given its heading (for cars that start mid-street). */
  laneFromPosition(x, z, yaw) {
    const dx = Math.sin(yaw);
    const dz = Math.cos(yaw);
    let best = null;
    let bestScore = Infinity;
    for (const node of this.nodes) {
      for (const next of node.neighbors) {
        for (let lane = 0; lane < 2; lane += 1) {
          const line = this.lane(node.id, next, lane);
          if (line.dx * dx + line.dz * dz < 0.7) continue;
          const vx = x - line.sx;
          const vz = z - line.sz;
          const along = vx * line.dx + vz * line.dz;
          if (along < -12 || along > line.length + 12) continue;
          const across = Math.abs(vx * -line.dz + vz * line.dx);
          if (across < bestScore) {
            bestScore = across;
            best = { from: node.id, to: next, lane, t: Math.max(0, Math.min(1, along / line.length)) };
          }
        }
      }
    }
    return bestScore < 6 ? best : null;
  }
}
