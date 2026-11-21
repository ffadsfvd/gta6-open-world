// Static obstacles (buildings, walls, trunks, poles) as axis-aligned boxes in a uniform grid.
// Answers the questions physics, AI, bullets and the camera ask: push this circle out, is this
// line of sight blocked, where does this ray hit.

const OFFSET = 2048;

export class CollisionWorld {
  constructor(cellSize = 16) {
    this.cellSize = cellSize;
    this.boxes = [];
    this.cells = new Map();
    this.marks = [];
    this.stamp = 1;
    this.scratch = [];
  }

  cellKey(cx, cz) {
    return (cx + OFFSET) * 8192 + (cz + OFFSET);
  }

  /** Adds a solid box from the ground up to `top`. Returns the box record. */
  addBox(minX, minZ, maxX, maxZ, top = 60, tag = 'building') {
    const box = { minX, minZ, maxX, maxZ, top, tag, index: this.boxes.length, enabled: true };
    this.boxes.push(box);
    this.marks.push(0);
    const size = this.cellSize;
    for (let cx = Math.floor(minX / size); cx <= Math.floor(maxX / size); cx += 1) {
      for (let cz = Math.floor(minZ / size); cz <= Math.floor(maxZ / size); cz += 1) {
        const key = this.cellKey(cx, cz);
        let list = this.cells.get(key);
        if (!list) {
          list = [];
          this.cells.set(key, list);
        }
        list.push(box.index);
      }
    }
    return box;
  }

  /** Boxes overlapping a rectangle, each once. Reuses one array: copy it to keep it. */
  query(minX, minZ, maxX, maxZ) {
    const out = this.scratch;
    out.length = 0;
    this.stamp += 1;
    const size = this.cellSize;
    const x0 = Math.floor(minX / size);
    const x1 = Math.floor(maxX / size);
    const z0 = Math.floor(minZ / size);
    const z1 = Math.floor(maxZ / size);
    for (let cx = x0; cx <= x1; cx += 1) {
      for (let cz = z0; cz <= z1; cz += 1) {
        const list = this.cells.get(this.cellKey(cx, cz));
        if (!list) continue;
        for (let index = 0; index < list.length; index += 1) {
          const boxIndex = list[index];
          if (this.marks[boxIndex] === this.stamp) continue;
          this.marks[boxIndex] = this.stamp;
          const box = this.boxes[boxIndex];
          if (!box.enabled || box.maxX < minX || box.minX > maxX || box.maxZ < minZ || box.minZ > maxZ) continue;
          out.push(box);
        }
      }
    }
    return out;
  }

  /**
   * Pushes a circle at `position` (x, z) out of every box it overlaps whose top is above `feetY`.
   * Returns the summed push normal (x, z) and the box hit last, or null when nothing was touched.
   */
  resolveCircle(position, radius, feetY = 0) {
    const boxes = this.query(position.x - radius, position.z - radius, position.x + radius, position.z + radius);
    let hit = null;
    for (let index = 0; index < boxes.length; index += 1) {
      const box = boxes[index];
      if (feetY >= box.top - 0.05) continue;
      const px = Math.min(Math.max(position.x, box.minX), box.maxX);
      const pz = Math.min(Math.max(position.z, box.minZ), box.maxZ);
      let dx = position.x - px;
      let dz = position.z - pz;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq >= radius * radius) continue;
      let distance = Math.sqrt(distanceSq);
      if (distance < 1e-5) {
        // Centre inside the box: leave by the nearest face.
        const left = position.x - box.minX;
        const right = box.maxX - position.x;
        const front = position.z - box.minZ;
        const back = box.maxZ - position.z;
        const least = Math.min(left, right, front, back);
        dx = least === left ? -1 : least === right ? 1 : 0;
        dz = least === front ? -1 : least === back ? 1 : 0;
        distance = -least;
      } else {
        dx /= distance;
        dz /= distance;
      }
      const push = radius - distance;
      position.x += dx * push;
      position.z += dz * push;
      if (!hit) hit = { nx: 0, nz: 0, box };
      hit.nx += dx;
      hit.nz += dz;
      hit.box = box;
    }
    return hit;
  }

  /** True when a wall taller than `minTop` stands between two points (2D). */
  segmentBlocked(x0, z0, x1, z1, minTop = 2.5) {
    const boxes = this.query(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1));
    const dx = x1 - x0;
    const dz = z1 - z0;
    for (let index = 0; index < boxes.length; index += 1) {
      const box = boxes[index];
      if (box.top < minTop) continue;
      if (segmentHitsRect(x0, z0, dx, dz, box)) return true;
    }
    return false;
  }

  /**
   * Nearest hit of a 3D ray against the boxes (floor 0 to `top`), within maxDistance.
   * Returns { distance, box, nx, ny, nz } or null.
   */
  raycast(ox, oy, oz, dx, dy, dz, maxDistance) {
    const ex = ox + dx * maxDistance;
    const ez = oz + dz * maxDistance;
    const boxes = this.query(Math.min(ox, ex), Math.min(oz, ez), Math.max(ox, ex), Math.max(oz, ez));
    let best = null;
    let bestDistance = maxDistance;
    for (let index = 0; index < boxes.length; index += 1) {
      const box = boxes[index];
      const result = rayBox(ox, oy, oz, dx, dy, dz, box);
      if (result && result.distance < bestDistance) {
        bestDistance = result.distance;
        best = result;
        best.box = box;
      }
    }
    return best;
  }
}

function segmentHitsRect(x0, z0, dx, dz, box) {
  let t0 = 0;
  let t1 = 1;
  const checks = [
    [-dx, x0 - box.minX],
    [dx, box.maxX - x0],
    [-dz, z0 - box.minZ],
    [dz, box.maxZ - z0],
  ];
  for (let index = 0; index < 4; index += 1) {
    const p = checks[index][0];
    const q = checks[index][1];
    if (Math.abs(p) < 1e-9) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return true;
}

function rayBox(ox, oy, oz, dx, dy, dz, box) {
  let tMin = 0;
  let tMax = Infinity;
  let normalAxis = -1;
  let normalSign = 0;
  const mins = [box.minX, 0, box.minZ];
  const maxs = [box.maxX, box.top, box.maxZ];
  const origin = [ox, oy, oz];
  const direction = [dx, dy, dz];
  for (let axis = 0; axis < 3; axis += 1) {
    const d = direction[axis];
    const o = origin[axis];
    if (Math.abs(d) < 1e-9) {
      if (o < mins[axis] || o > maxs[axis]) return null;
      continue;
    }
    let t0 = (mins[axis] - o) / d;
    let t1 = (maxs[axis] - o) / d;
    let sign = -1;
    if (t0 > t1) {
      const swap = t0;
      t0 = t1;
      t1 = swap;
      sign = 1;
    }
    if (t0 > tMin) {
      tMin = t0;
      normalAxis = axis;
      normalSign = sign;
    }
    if (t1 < tMax) tMax = t1;
    if (tMin > tMax) return null;
  }
  if (normalAxis < 0) return { distance: 0, nx: 0, ny: 1, nz: 0 };
  return {
    distance: tMin,
    nx: normalAxis === 0 ? normalSign : 0,
    ny: normalAxis === 1 ? normalSign : 0,
    nz: normalAxis === 2 ? normalSign : 0,
  };
}
