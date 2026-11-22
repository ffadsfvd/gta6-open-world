// Gets the test player across town the way a person would: plans a route over the street grid
// (junctions read once from the page), then drives it in the right-hand lane or walks it along
// the sidewalk, using nothing but W A S D and Shift. Pure pursuit on the planned line, slowing
// before corners, backing out when stuck.
import { sleep } from './chromeSession.mjs';

const LANE_OFFSET = 3.5;
const SIDEWALK_OFFSET = 9.3;

function wrap(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export async function loadStreetGraph(player) {
  const nodes = await player.read('__game.network.nodes.map((n) => ({ id: n.id, x: n.x, z: n.z, neighbors: [...n.neighbors] }))');
  return { nodes };
}

function nearestNode(graph, x, z) {
  let best = graph.nodes[0];
  let bestD = Infinity;
  for (const node of graph.nodes) {
    const d = (node.x - x) ** 2 + (node.z - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = node;
    }
  }
  return best;
}

/** A* over junctions; node ids from start to goal. */
function findPath(graph, startId, goalId) {
  const nodes = graph.nodes;
  const h = (id) => Math.abs(nodes[id].x - nodes[goalId].x) + Math.abs(nodes[id].z - nodes[goalId].z);
  const open = new Set([startId]);
  const came = new Map();
  const g = new Map([[startId, 0]]);
  while (open.size) {
    let current = null;
    let best = Infinity;
    for (const id of open) {
      const f = g.get(id) + h(id);
      if (f < best) {
        best = f;
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
    for (const next of nodes[current].neighbors) {
      const cost = g.get(current) + Math.hypot(nodes[next].x - nodes[current].x, nodes[next].z - nodes[current].z);
      if (cost < (g.get(next) ?? Infinity)) {
        g.set(next, cost);
        came.set(next, current);
        open.add(next);
      }
    }
  }
  return [startId];
}

/** The closest point on any street centre line to (x, z), with the two junctions around it. */
function streetPointNear(graph, x, z) {
  let best = null;
  for (const a of graph.nodes) {
    for (const id of a.neighbors) {
      if (id < a.id) continue;
      const b = graph.nodes[id];
      const segX = b.x - a.x;
      const segZ = b.z - a.z;
      const t = Math.max(0, Math.min(1, ((x - a.x) * segX + (z - a.z) * segZ) / (segX * segX + segZ * segZ)));
      const px = a.x + segX * t;
      const pz = a.z + segZ * t;
      const d = Math.hypot(px - x, pz - z);
      if (!best || d < best.d) best = { d, x: px, z: pz, a, b };
    }
  }
  return best;
}

function pathLength(nodes) {
  let total = 0;
  for (let index = 1; index < nodes.length; index += 1) total += Math.hypot(nodes[index].x - nodes[index - 1].x, nodes[index].z - nodes[index - 1].z);
  return total;
}

/**
 * Junctions to pass on the way from (x, z) to the goal, then the street point nearest the goal.
 * A junction already behind the start is skipped.
 */
function junctionsBetween(graph, from, goal) {
  const start = nearestNode(graph, from.x, from.z);
  const entry = streetPointNear(graph, goal.x, goal.z);
  const options = [entry.a, entry.b].map((end) => {
    const ids = findPath(graph, start.id, end.id);
    const nodes = ids.map((id) => graph.nodes[id]);
    return { nodes, cost: pathLength(nodes) + Math.hypot(end.x - entry.x, end.z - entry.z) };
  });
  let nodes = options[0].cost <= options[1].cost ? options[0].nodes : options[1].nodes;
  if (nodes.length > 1) {
    const a = nodes[0];
    const b = nodes[1];
    const across = Math.abs((from.x - a.x) * (b.z - a.z) - (from.z - a.z) * (b.x - a.x)) / Math.hypot(b.x - a.x, b.z - a.z);
    const beyond = (from.x - a.x) * (b.x - a.x) + (from.z - a.z) * (b.z - a.z) > 0;
    if (across < 9 && beyond) nodes = nodes.slice(1);
  }
  return { nodes, entry };
}

/**
 * A polyline that keeps `offset` metres to the right of the street centre lines through the
 * planned junctions, then along the last street to the point nearest the goal, then the goal.
 */
function offsetLine({ nodes: junctions, entry }, from, goal, offset) {
  const points = [];
  for (let index = 0; index < junctions.length; index += 1) {
    const node = junctions[index];
    const prev = index > 0 ? junctions[index - 1] : null;
    const next = index + 1 < junctions.length ? junctions[index + 1] : entry;
    const inDir = prev ? norm(node.x - prev.x, node.z - prev.z) : norm(node.x - from.x, node.z - from.z);
    let outDir = norm(next.x - node.x, next.z - node.z);
    if (Math.hypot(next.x - node.x, next.z - node.z) < 1) outDir = inDir;
    // Right of travel direction (dx, dz) is (-dz, dx).
    const inRight = { x: -inDir.z, z: inDir.x };
    const outRight = { x: -outDir.z, z: outDir.x };
    const dot = inDir.x * outDir.x + inDir.z * outDir.z;
    if (dot > 0.9) {
      points.push({ x: node.x + inRight.x * offset - inDir.x * offset, z: node.z + inRight.z * offset - inDir.z * offset });
      points.push({ x: node.x + outRight.x * offset + outDir.x * offset, z: node.z + outRight.z * offset + outDir.z * offset });
    } else if (dot < -0.9) {
      // Turning back: go round through the junction.
      points.push({ x: node.x + inRight.x * offset, z: node.z + inRight.z * offset, turn: true });
      points.push({ x: node.x - inRight.x * offset, z: node.z - inRight.z * offset, turn: true });
    } else {
      // A turn: the corner where the two offset lines meet.
      points.push({ x: node.x + (inRight.x + outRight.x) * offset, z: node.z + (inRight.z + outRight.z) * offset, turn: true });
    }
  }
  const last = junctions[junctions.length - 1] ?? from;
  const along = norm(entry.x - last.x, entry.z - last.z);
  points.push({ x: entry.x - along.z * offset, z: entry.z + along.x * offset });
  points.push({ x: goal.x, z: goal.z, goal: true });
  return points;
}

function norm(x, z) {
  const length = Math.hypot(x, z) || 1;
  return { x: x / length, z: z / length };
}

/** The point `look` metres ahead along the polyline from the closest point to (x, z). */
function pursue(points, state, x, z, look) {
  // Advance past points that are behind or reached.
  while (state.index < points.length - 1) {
    const point = points[state.index];
    const next = points[state.index + 1];
    const segX = next.x - point.x;
    const segZ = next.z - point.z;
    const t = ((x - point.x) * segX + (z - point.z) * segZ) / (segX * segX + segZ * segZ || 1);
    if (t > 1 || Math.hypot(point.x - x, point.z - z) < 2.5) state.index += 1;
    else break;
  }
  let ax = x;
  let az = z;
  let remaining = look;
  for (let index = state.index; index < points.length; index += 1) {
    const point = points[index];
    const leg = Math.hypot(point.x - ax, point.z - az);
    if (leg >= remaining) return { x: ax + ((point.x - ax) / leg) * remaining, z: az + ((point.z - az) / leg) * remaining };
    remaining -= leg;
    ax = point.x;
    az = point.z;
  }
  return { x: ax, z: az };
}

async function keys(player, wanted) {
  const keep = new Set(wanted);
  for (const code of [...player.held]) {
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space'].includes(code) && !keep.has(code)) await player.up(code);
  }
  for (const code of wanted) await player.down(code);
}

/**
 * Drives the car Kai sits in to `goal` along the streets. `goal` may be a function returning a
 * point (re-planned when it moves). Resolves with { arrived, reason }.
 */
export async function driveRoute(player, goal, { radius = 8, timeoutMs = 120000, cruise = 20, stopAtGoal = true, graph = null, until = null } = {}) {
  const streets = graph ?? (await loadStreetGraph(player));
  const started = Date.now();
  let plannedFor = null;
  let points = [];
  const state = { index: 0 };
  let stuckFor = 0;
  let last = Date.now();
  let result = { arrived: false, reason: 'timeout' };
  while (Date.now() - started < timeoutMs) {
    const car = await player.read('(() => { const v = __game.player.character.vehicle; return v ? { x: v.x, z: v.z, yaw: v.yaw, speed: v.forwardSpeed } : null; })()');
    if (!car) {
      result = { arrived: false, reason: 'not in a car' };
      break;
    }
    if (until && (await until())) {
      result = { arrived: true, reason: 'condition' };
      break;
    }
    const target = typeof goal === 'function' ? await goal() : goal;
    if (!target) {
      result = { arrived: false, reason: 'no goal' };
      break;
    }
    const toGoal = Math.hypot(target.x - car.x, target.z - car.z);
    if (toGoal < radius && (!stopAtGoal || Math.abs(car.speed) < 3)) {
      result = { arrived: true, reason: 'arrived' };
      break;
    }
    if (!plannedFor || Math.hypot(target.x - plannedFor.x, target.z - plannedFor.z) > 20) {
      plannedFor = { x: target.x, z: target.z };
      points = offsetLine(junctionsBetween(streets, car, target), car, target, LANE_OFFSET);
      state.index = 0;
    }
    const now = Date.now();
    const dt = (now - last) / 1000;
    last = now;
    const look = 7 + Math.max(0, car.speed) * 0.55;
    const aim = pursue(points, state, car.x, car.z, look);
    const error = wrap(Math.atan2(aim.x - car.x, aim.z - car.z) - car.yaw);
    // Slow for the next corner and for the goal.
    let distanceToTurn = Infinity;
    let walked = 0;
    let px = car.x;
    let pz = car.z;
    for (let index = state.index; index < points.length; index += 1) {
      walked += Math.hypot(points[index].x - px, points[index].z - pz);
      px = points[index].x;
      pz = points[index].z;
      if (points[index].turn) {
        distanceToTurn = walked;
        break;
      }
    }
    let wantedSpeed = Math.min(cruise, Math.sqrt(8 * 8 + 2 * 6 * Math.max(0, distanceToTurn - 6)));
    if (stopAtGoal) wantedSpeed = Math.min(wantedSpeed, Math.sqrt(2 * 5 * Math.max(0, toGoal - radius * 0.5)) + 1);
    if (Math.abs(error) > 0.6) wantedSpeed = Math.min(wantedSpeed, 7);
    const pressed = [];
    if (stuckFor > 1.4) {
      // Back out with the wheel the other way, then try again.
      await keys(player, ['KeyS', error > 0 ? 'KeyD' : 'KeyA']);
      await sleep(1100);
      stuckFor = 0;
      continue;
    }
    if (error > 0.05) pressed.push('KeyA');
    else if (error < -0.05) pressed.push('KeyD');
    if (car.speed < wantedSpeed - 0.5) pressed.push('KeyW');
    else if (car.speed > wantedSpeed + 2.5) pressed.push('KeyS');
    await keys(player, pressed);
    if (pressed.includes('KeyW') && Math.abs(car.speed) < 0.8) stuckFor += dt;
    else stuckFor = 0;
    await sleep(35);
  }
  await keys(player, []);
  return result;
}

/** Walks (sprinting) to `goal` along the sidewalks. Resolves with { arrived, reason }. */
export async function walkRoute(player, goal, { radius = 1.5, timeoutMs = 120000, sprint = true, graph = null } = {}) {
  const streets = graph ?? (await loadStreetGraph(player));
  const started = Date.now();
  const me = await player.read('({ x: __game.player.character.x, z: __game.player.character.z })');
  const target = typeof goal === 'function' ? await goal() : goal;
  const direct = Math.hypot(target.x - me.x, target.z - me.z) < 30;
  const points = direct ? [{ x: target.x, z: target.z, goal: true }] : offsetLine(junctionsBetween(streets, me, target), me, target, SIDEWALK_OFFSET);
  const state = { index: 0 };
  let lastMove = { x: me.x, z: me.z, at: Date.now() };
  let detour = 0;
  while (Date.now() - started < timeoutMs) {
    const s = await player.read('(() => { const g = __game, h = g.player.character; return { x: h.x, z: h.z, cam: g.followCamera.yaw, vehicle: Boolean(h.vehicle) }; })()');
    const live = typeof goal === 'function' ? await goal() : goal;
    if (live) points[points.length - 1] = { x: live.x, z: live.z, goal: true };
    const end = points[points.length - 1];
    if (Math.hypot(end.x - s.x, end.z - s.z) < radius) {
      await keys(player, []);
      return { arrived: true, reason: 'arrived' };
    }
    const aim = pursue(points, state, s.x, s.z, 3);
    let heading = Math.atan2(aim.x - s.x, aim.z - s.z);
    if (Date.now() < detour) heading += Math.PI / 2;
    const relative = wrap(heading - s.cam);
    const octant = ((Math.round(relative / (Math.PI / 4)) % 8) + 8) % 8;
    const OCTANTS = [['KeyW'], ['KeyW', 'KeyA'], ['KeyA'], ['KeyS', 'KeyA'], ['KeyS'], ['KeyS', 'KeyD'], ['KeyD'], ['KeyW', 'KeyD']];
    await keys(player, sprint ? [...OCTANTS[octant], 'ShiftLeft'] : OCTANTS[octant]);
    if (Math.hypot(s.x - lastMove.x, s.z - lastMove.z) > 0.6) lastMove = { x: s.x, z: s.z, at: Date.now() };
    else if (Date.now() - lastMove.at > 900) {
      // Blocked by a lamp post or a bench: side-step for a moment.
      detour = Date.now() + 500;
      lastMove = { x: s.x, z: s.z, at: Date.now() };
    }
    await sleep(40);
  }
  await keys(player, []);
  return { arrived: false, reason: 'timeout' };
}
