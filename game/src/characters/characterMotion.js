// Moves a person: eases toward the wanted velocity, turns to face motion or aim, falls under
// gravity, swims in deep water, slides when knocked down and stays out of walls and each other.
import { approach, dampAngle } from '../core/mathUtils.js';
import { PLAYER_TUNING, WATER_LEVEL, WORLD_BOUNDS } from '../core/config.js';
import { groundHeight, waterDepth } from '../world/terrain.js';

const SWIM_DEPTH = 1.25;

export function stepCharacter(character, dt, collision) {
  if (character.vehicle) return;
  const grounded = character.onGround;
  if (character.state === 'down' || character.state === 'dead') {
    const friction = grounded ? 9 : 0.5;
    character.vx = approach(character.vx, 0, friction * dt * Math.max(1, Math.abs(character.vx)));
    character.vz = approach(character.vz, 0, friction * dt * Math.max(1, Math.abs(character.vz)));
    if (character.state === 'down') {
      character.downTimer -= dt;
      if (character.downTimer <= 0 && grounded) character.state = 'idle';
    }
  } else {
    const speed = character.moveSpeed * (character.swimming ? 0.45 : 1);
    const targetX = character.moveX * speed;
    const targetZ = character.moveZ * speed;
    const accel = grounded || character.swimming ? 22 : 5;
    character.vx = approach(character.vx, targetX, accel * dt);
    character.vz = approach(character.vz, targetZ, accel * dt);
    if (character.aimYaw !== null) character.yaw = dampAngle(character.yaw, character.aimYaw, 20, dt);
    else if (Math.hypot(character.vx, character.vz) > 0.4) character.yaw = dampAngle(character.yaw, Math.atan2(character.vx, character.vz), 11, dt);
  }
  character.x += character.vx * dt;
  character.z += character.vz * dt;
  character.x = Math.min(WORLD_BOUNDS.maxX, Math.max(WORLD_BOUNDS.minX, character.x));
  character.z = Math.min(WORLD_BOUNDS.maxZ, Math.max(WORLD_BOUNDS.minZ, character.z));

  const ground = groundHeight(character.x, character.z);
  const depth = waterDepth(character.x, character.z);
  character.swimming = depth > SWIM_DEPTH && character.state !== 'dead';
  if (character.swimming) {
    character.y = WATER_LEVEL - 1.25;
    character.vy = 0;
    character.onGround = true;
  } else {
    character.vy -= PLAYER_TUNING.gravity * dt;
    character.y += character.vy * dt;
    if (character.y <= ground) {
      character.y = ground;
      character.vy = 0;
      character.onGround = true;
    } else if (character.y > ground + 0.08) {
      character.onGround = false;
    }
    // Step up small ledges (curbs) while walking.
    if (character.onGround && ground > character.y) character.y = ground;
  }
  collision.resolveCircle(character, character.radius, character.y + 0.3);
}

/** Keeps standing people from walking through each other. */
export function separateCharacters(list) {
  for (let i = 0; i < list.length; i += 1) {
    const a = list[i];
    if (!a.active || a.vehicle || a.state === 'dead') continue;
    for (let j = i + 1; j < list.length; j += 1) {
      const b = list[j];
      if (!b.active || b.vehicle || b.state === 'dead') continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const reach = a.radius + b.radius;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq >= reach * reach || distanceSq < 1e-6 || Math.abs(a.y - b.y) > 1.2) continue;
      const distance = Math.sqrt(distanceSq);
      const push = (reach - distance) / 2;
      a.x -= (dx / distance) * push;
      a.z -= (dz / distance) * push;
      b.x += (dx / distance) * push;
      b.z += (dz / distance) * push;
    }
  }
}
