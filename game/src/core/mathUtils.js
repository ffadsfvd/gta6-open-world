// Small math helpers shared by physics, AI and the camera. Headings are yaw angles around +Y:
// yaw 0 faces +Z (south on the map), and a larger yaw turns the body to its left.

export const TAU = Math.PI * 2;

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Frame-rate independent smoothing toward a target: rate is "how fast", in 1/s. */
export function damp(current, target, rate, dt) {
  return target + (current - target) * Math.exp(-rate * dt);
}

export function approach(current, target, step) {
  if (current < target) return Math.min(current + step, target);
  return Math.max(current - step, target);
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function wrapAngle(angle) {
  let a = angle % TAU;
  if (a > Math.PI) a -= TAU;
  else if (a < -Math.PI) a += TAU;
  return a;
}

/** Signed smallest turn from angle a to angle b. */
export function angleDelta(a, b) {
  return wrapAngle(b - a);
}

export function dampAngle(current, target, rate, dt) {
  return current + angleDelta(current, target) * (1 - Math.exp(-rate * dt));
}

export function distance2D(ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  return Math.sqrt(dx * dx + dz * dz);
}

export function distanceSq2D(ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  return dx * dx + dz * dz;
}

/** Yaw that faces from (ax, az) toward (bx, bz). */
export function yawTo(ax, az, bx, bz) {
  return Math.atan2(bx - ax, bz - az);
}

export function forwardX(yaw) {
  return Math.sin(yaw);
}

export function forwardZ(yaw) {
  return Math.cos(yaw);
}

/** The right-hand side of a body facing `yaw`. */
export function rightX(yaw) {
  return -Math.cos(yaw);
}

export function rightZ(yaw) {
  return Math.sin(yaw);
}

export function formatMoney(value) {
  return '$' + Math.round(value).toLocaleString('en-US');
}
