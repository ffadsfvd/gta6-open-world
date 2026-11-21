// Collisions for cars as oriented boxes (separating axis test in 2D): against buildings and
// street furniture, against each other, and against people on foot. Impacts turn into damage,
// spin, sparks and events the AI and the police listen to.

const RESTITUTION_WORLD = 0.18;
const RESTITUTION_CARS = 0.3;
const DAMAGE_PER_MS = 26;
const IMPACT_THRESHOLD = 4;

function axesOf(vehicle) {
  const fx = Math.sin(vehicle.yaw);
  const fz = Math.cos(vehicle.yaw);
  return { fx, fz, rx: -fz, rz: fx };
}

function projectBox(axes, hl, hw, ax, az) {
  return hl * Math.abs(axes.fx * ax + axes.fz * az) + hw * Math.abs(axes.rx * ax + axes.rz * az);
}

/** Pushes `vehicle` out of the box with the least overlap; returns the contact or null. */
function obbVersusBox(vehicle, box) {
  const axes = axesOf(vehicle);
  const hl = vehicle.halfLength;
  const hw = vehicle.halfWidth;
  const ex = (box.maxX - box.minX) / 2;
  const ez = (box.maxZ - box.minZ) / 2;
  const dx = vehicle.x - (box.minX + ex);
  const dz = vehicle.z - (box.minZ + ez);
  const candidates = [[1, 0], [0, 1], [axes.fx, axes.fz], [axes.rx, axes.rz]];
  let best = Infinity;
  let nx = 0;
  let nz = 0;
  for (const [ax, az] of candidates) {
    const distance = dx * ax + dz * az;
    const overlap = projectBox(axes, hl, hw, ax, az) + ex * Math.abs(ax) + ez * Math.abs(az) - Math.abs(distance);
    if (overlap <= 0) return null;
    if (overlap < best) {
      best = overlap;
      const sign = distance >= 0 ? 1 : -1;
      nx = ax * sign;
      nz = az * sign;
    }
  }
  return { depth: best, nx, nz };
}

function supportPoint(vehicle, axes, dirX, dirZ) {
  const sf = Math.sign(axes.fx * dirX + axes.fz * dirZ) || 1;
  const sr = Math.sign(axes.rx * dirX + axes.rz * dirZ) || 1;
  return {
    x: axes.fx * vehicle.halfLength * sf + axes.rx * vehicle.halfWidth * sr,
    z: axes.fz * vehicle.halfLength * sf + axes.rz * vehicle.halfWidth * sr,
  };
}

/** Resolves a car against the static world. Calls onImpact(vehicle, speed, x, z, box). */
export function collideVehicleWithWorld(vehicle, collision, props, onImpact) {
  const reach = vehicle.halfLength + 0.5;
  const boxes = collision.query(vehicle.x - reach, vehicle.z - reach, vehicle.x + reach, vehicle.z + reach).slice();
  for (const box of boxes) {
    if (box.top < vehicle.y + 0.3) continue;
    const contact = obbVersusBox(vehicle, box);
    if (!contact) continue;
    if (box.tag === 'prop' && props) {
      const keep = props.knock(box, vehicle.vx, vehicle.vz);
      if (keep > 0) {
        vehicle.vx *= keep;
        vehicle.vz *= keep;
        onImpact(vehicle, Math.hypot(vehicle.vx, vehicle.vz) * 0.3, box.minX, box.minZ, box);
        continue;
      }
    }
    vehicle.x += contact.nx * contact.depth;
    vehicle.z += contact.nz * contact.depth;
    const normalSpeed = vehicle.vx * contact.nx + vehicle.vz * contact.nz;
    if (normalSpeed >= 0) continue;
    const impulse = -(1 + RESTITUTION_WORLD) * normalSpeed;
    vehicle.vx += contact.nx * impulse;
    vehicle.vz += contact.nz * impulse;
    vehicle.vx *= 0.94;
    vehicle.vz *= 0.94;
    const axes = axesOf(vehicle);
    const point = supportPoint(vehicle, axes, -contact.nx, -contact.nz);
    const jx = contact.nx * impulse * vehicle.mass;
    const jz = contact.nz * impulse * vehicle.mass;
    vehicle.yawRate += ((point.z * jx - point.x * jz) / vehicle.inertia) * 0.6;
    const hit = -normalSpeed;
    if (hit > IMPACT_THRESHOLD) {
      vehicle.damage((hit - IMPACT_THRESHOLD) * DAMAGE_PER_MS);
      onImpact(vehicle, hit, vehicle.x + point.x, vehicle.z + point.z, box);
    }
  }
}

function obbVersusObb(a, b) {
  const A = axesOf(a);
  const B = axesOf(b);
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  const candidates = [[A.fx, A.fz], [A.rx, A.rz], [B.fx, B.fz], [B.rx, B.rz]];
  let best = Infinity;
  let nx = 0;
  let nz = 0;
  for (const [ax, az] of candidates) {
    const distance = dx * ax + dz * az;
    const overlap = projectBox(A, a.halfLength, a.halfWidth, ax, az) + projectBox(B, b.halfLength, b.halfWidth, ax, az) - Math.abs(distance);
    if (overlap <= 0) return null;
    if (overlap < best) {
      best = overlap;
      const sign = distance >= 0 ? 1 : -1;
      nx = ax * sign;
      nz = az * sign;
    }
  }
  return { depth: best, nx, nz, A, B };
}

/** Resolves every overlapping pair of cars. Calls onCrash(a, b, speed, x, z). */
export function collideVehicles(vehicles, onCrash) {
  for (let i = 0; i < vehicles.length; i += 1) {
    const a = vehicles[i];
    if (!a.active) continue;
    for (let j = i + 1; j < vehicles.length; j += 1) {
      const b = vehicles[j];
      if (!b.active) continue;
      const reach = a.halfLength + b.halfLength;
      const dx = a.x - b.x;
      const dz = a.z - b.z;
      if (dx * dx + dz * dz > reach * reach || Math.abs(a.y - b.y) > 2) continue;
      const contact = obbVersusObb(a, b);
      if (!contact) continue;
      const total = a.mass + b.mass;
      a.x += contact.nx * contact.depth * (b.mass / total);
      a.z += contact.nz * contact.depth * (b.mass / total);
      b.x -= contact.nx * contact.depth * (a.mass / total);
      b.z -= contact.nz * contact.depth * (a.mass / total);
      const relative = (a.vx - b.vx) * contact.nx + (a.vz - b.vz) * contact.nz;
      if (relative >= 0) continue;
      const impulse = (-(1 + RESTITUTION_CARS) * relative) / (1 / a.mass + 1 / b.mass);
      a.vx += (contact.nx * impulse) / a.mass;
      a.vz += (contact.nz * impulse) / a.mass;
      b.vx -= (contact.nx * impulse) / b.mass;
      b.vz -= (contact.nz * impulse) / b.mass;
      const pa = supportPoint(a, contact.A, -contact.nx, -contact.nz);
      const pb = supportPoint(b, contact.B, contact.nx, contact.nz);
      const jx = contact.nx * impulse;
      const jz = contact.nz * impulse;
      a.yawRate += ((pa.z * jx - pa.x * jz) / a.inertia) * 0.5;
      b.yawRate -= ((pb.z * jx - pb.x * jz) / b.inertia) * 0.5;
      const hit = -relative;
      if (hit > IMPACT_THRESHOLD * 0.75) {
        const damage = (hit - IMPACT_THRESHOLD * 0.75) * DAMAGE_PER_MS * 0.55;
        a.damage(damage * (b.mass / total) * 1.4, b.driver);
        b.damage(damage * (a.mass / total) * 1.4, a.driver);
      }
      if (hit > 1.5) onCrash(a, b, hit, a.x + pa.x, a.z + pa.z);
    }
  }
}

/**
 * People against a car: pushed aside when it creeps, knocked flying when it is fast.
 * Calls onRunOver(vehicle, character, speed) for a knock-down.
 */
export function collideVehicleWithCharacters(vehicle, characters, onRunOver) {
  const reach = vehicle.halfLength + 1;
  for (const character of characters) {
    if (!character.active || character.vehicle || character.state === 'dead') continue;
    const dx = character.x - vehicle.x;
    const dz = character.z - vehicle.z;
    if (dx * dx + dz * dz > reach * reach || Math.abs(character.y - vehicle.y) > 1.6) continue;
    const local = vehicle.worldToLocal(character.x, character.z);
    const cx = Math.max(-vehicle.halfWidth, Math.min(vehicle.halfWidth, local.x));
    const cz = Math.max(-vehicle.halfLength, Math.min(vehicle.halfLength, local.z));
    let ox = local.x - cx;
    let oz = local.z - cz;
    let distance = Math.hypot(ox, oz);
    const radius = character.radius;
    if (distance >= radius) continue;
    if (distance < 1e-4) {
      // Inside the body: leave through the nearer side.
      ox = Math.sign(local.x) || 1;
      oz = 0;
      distance = 0;
    } else {
      ox /= distance;
      oz /= distance;
    }
    const cos = Math.cos(vehicle.yaw);
    const sin = Math.sin(vehicle.yaw);
    const nx = ox * cos + oz * sin;
    const nz = -ox * sin + oz * cos;
    const push = radius - distance + 0.02;
    character.x += nx * push;
    character.z += nz * push;
    const closing = (vehicle.vx - character.vx) * nx + (vehicle.vz - character.vz) * nz;
    if (closing > 4.5 && character.state !== 'down') onRunOver(vehicle, character, closing, nx, nz);
    else if (closing > 0) {
      character.vx += nx * closing;
      character.vz += nz * closing;
    }
  }
}
