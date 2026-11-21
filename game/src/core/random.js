// Seeded pseudo-random numbers (mulberry32). The city, the traffic and every screenshot scene
// draw from these, so one seed always rebuilds the same streets and the same frame.

export function createRandom(seed) {
  let state = seed >>> 0;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    range(min, max) {
      return min + (max - min) * next();
    },
    int(min, max) {
      return Math.floor(min + (max - min + 1) * next());
    },
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    chance(probability) {
      return next() < probability;
    },
    /** A new independent stream, so one system's draws never shift another's. */
    fork(salt) {
      return createRandom((Math.floor(next() * 4294967296) ^ Math.imul(salt, 0x9e3779b1)) >>> 0);
    },
  };
}
