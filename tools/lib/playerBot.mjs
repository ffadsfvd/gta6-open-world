// A stand-in for the person at the keyboard: reads where Kai and his car are, then walks with
// W A S D relative to the camera or drives with W S A D toward a point, exactly as a player
// would. It never moves anything itself: every motion comes from held keys.
import { sleep } from './chromeSession.mjs';

/** One read of everything the tests check. */
export const SNAPSHOT = `(() => {
  const g = window.__game;
  const h = g.player.character;
  const v = h.vehicle;
  const active = document.activeElement;
  return {
    state: g.state, x: h.x, y: h.y, z: h.z, yaw: h.yaw, heroState: h.state, health: h.health, armour: h.armour,
    alive: h.alive, canAct: h.canAct, brain: h.brain ? h.brain.constructor.name : null, swimming: h.swimming,
    inCar: Boolean(v),
    car: v ? { id: v.id, name: v.name, type: v.type, role: v.role, speed: v.speed, forward: v.forwardSpeed, yaw: v.yaw, x: v.x, z: v.z,
      ai: v.ai ? v.ai.constructor.name : null, health: v.health, destroyed: v.destroyed, controls: { ...v.controls } } : null,
    camYaw: g.followCamera.yaw, camPitch: g.followCamera.pitch, camView: g.followCamera.viewName,
    locked: document.pointerLockElement === g.canvas, enabled: g.player.enabled, keys: [...g.input.down],
    fate: g.fate.kind, wanted: g.wanted.level, mission: g.missions.current ? g.missions.current.def.id : null,
    dialogue: g.dialogue.active, time: g.time, timeScale: g.timeScale, money: g.progress.money,
    weapon: g.combat.arsenal.current, focus: active ? active.tagName + (active.id ? '#' + active.id : '') : null,
    hud: !document.getElementById('hud').classList.contains('hidden'),
    pauseOpen: !document.getElementById('pause-menu').classList.contains('hidden'),
    mapOpen: !document.getElementById('full-map').classList.contains('hidden'),
    shopOpen: !document.getElementById('shop-panel').classList.contains('hidden'),
    titleOpen: !document.getElementById('start-screen').classList.contains('hidden'),
    banner: document.getElementById('big-message').classList.contains('hidden') ? '' : document.getElementById('big-message-title').textContent,
    objective: document.getElementById('objective-text').textContent,
    help: document.getElementById('help-box').classList.contains('hidden') ? '' : document.getElementById('help-box').textContent,
  };
})()`;

export function snapshot(player) {
  return player.read(SNAPSHOT);
}

function wrap(angle) {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Camera-relative key sets for the eight directions, counter-clockwise from straight ahead.
const OCTANTS = [['KeyW'], ['KeyW', 'KeyA'], ['KeyA'], ['KeyS', 'KeyA'], ['KeyS'], ['KeyS', 'KeyD'], ['KeyD'], ['KeyW', 'KeyD']];

async function setKeys(player, wanted) {
  const keep = new Set(wanted);
  for (const code of [...player.held]) {
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space'].includes(code) && !keep.has(code)) await player.up(code);
  }
  for (const code of wanted) await player.down(code);
}

/**
 * Walks (or sprints) to a point with W A S D relative to the camera. `target` is a point or an
 * async function returning one (to follow something that moves). Returns the final snapshot.
 */
export async function walkTo(player, target, { radius = 1.4, sprint = false, timeoutMs = 25000, settle = null } = {}) {
  const started = Date.now();
  let last = null;
  let stuckSince = Date.now();
  let lastPosition = null;
  while (Date.now() - started < timeoutMs) {
    const goal = typeof target === 'function' ? await target() : target;
    if (!goal) break;
    const s = await player.read(`(() => { const g = __game, h = g.player.character; return { x: h.x, z: h.z, cam: g.followCamera.yaw, inCar: Boolean(h.vehicle) }; })()`);
    last = s;
    const dx = goal.x - s.x;
    const dz = goal.z - s.z;
    if (Math.hypot(dx, dz) < radius) {
      // Arrived; with `settle`, wait here until it says the moment has come.
      if (!settle || (await settle())) break;
      await setKeys(player, []);
      await sleep(100);
      stuckSince = Date.now();
      continue;
    }
    const relative = wrap(Math.atan2(dx, dz) - s.cam);
    const octant = ((Math.round(relative / (Math.PI / 4)) % 8) + 8) % 8;
    const keys = [...OCTANTS[octant]];
    if (sprint && Math.hypot(dx, dz) > 4) keys.push('ShiftLeft');
    await setKeys(player, keys);
    if (!lastPosition || Math.hypot(s.x - lastPosition.x, s.z - lastPosition.z) > 0.5) {
      lastPosition = { x: s.x, z: s.z };
      stuckSince = Date.now();
    } else if (Date.now() - stuckSince > 2500) {
      break;
    }
    await sleep(40);
  }
  await setKeys(player, []);
  await sleep(250);
  return last;
}

/** Drives toward a point: holds W, steers with A / D on the heading error, brakes near it. */
export async function driveTo(player, target, { radius = 8, timeoutMs = 30000, cruise = 18 } = {}) {
  const started = Date.now();
  let s = null;
  while (Date.now() - started < timeoutMs) {
    s = await player.read(`(() => { const v = __game.player.character.vehicle; return v ? { x: v.x, z: v.z, yaw: v.yaw, speed: v.forwardSpeed } : null; })()`);
    if (!s) break;
    const dx = target.x - s.x;
    const dz = target.z - s.z;
    const distance = Math.hypot(dx, dz);
    if (distance < radius) break;
    const error = wrap(Math.atan2(dx, dz) - s.yaw);
    const keys = [];
    if (error > 0.07) keys.push('KeyA');
    else if (error < -0.07) keys.push('KeyD');
    const wanted = Math.min(cruise, 4 + distance * 0.5) * (Math.abs(error) > 1 ? 0.5 : 1);
    if (s.speed < wanted) keys.push('KeyW');
    else if (s.speed > wanted + 3) keys.push('KeyS');
    await setKeys(player, keys);
    await sleep(40);
  }
  await setKeys(player, []);
  return s;
}

/** The nearest car Kai could get into (read only). */
export function nearestCar(player, filter = 'true') {
  return player.read(`(() => {
    const g = __game, h = g.player.character;
    let best = null, bestD = Infinity;
    for (const v of g.vehicles.list) {
      if (!v.active || v.destroyed || v === h.vehicle) continue;
      if (!(${filter})) continue;
      const d = Math.hypot(v.x - h.x, v.z - h.z);
      if (d < bestD) { bestD = d; best = v; }
    }
    if (!best) return null;
    const door = best.doorPosition();
    return { id: best.id, name: best.name, type: best.type, role: best.role, x: best.x, z: best.z, yaw: best.yaw, speed: best.speed, door, distance: bestD, driver: best.driver ? best.driver.kind : null };
  })()`);
}

export async function carById(player, id) {
  return player.read(`(() => { const v = __game.vehicles.list.find((c) => c.id === ${Number(id)}); if (!v) return null; return { id: v.id, x: v.x, z: v.z, yaw: v.yaw, speed: v.speed, door: v.doorPosition(), driver: v.driver ? v.driver.kind : null, active: v.active }; })()`);
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** From the title screen: New Game with the mouse, skip the intro with Enter, capture the mouse. */
export async function startNewGame(player) {
  await player.clickElement('#start-screen .menu-list button:nth-of-type(2)');
  await player.waitFor("__game.state === 'intro'", 5000);
  await sleep(800);
  await player.tap('Enter');
  await player.waitFor("__game.state === 'playing'", 5000);
  await sleep(300);
  if (!(await player.read('Boolean(document.pointerLockElement)'))) await player.click();
  await player.waitFor('Boolean(document.pointerLockElement)', 3000);
  await sleep(200);
}

/** Walks up to the nearest car matching `filter` and presses F; tries a few cars. */
export async function stealCar(player, filter = "v.type !== 'police'", attempts = 4) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const car = await nearestCar(player, filter);
    if (!car) return null;
    if (car.distance > 35) {
      // Far away: follow the sidewalks there first.
      const { walkRoute } = await import('./navigator.mjs');
      await walkRoute(player, async () => carById(player, car.id), { radius: 25, timeoutMs: 40000 });
    }
    // A moving car is cut off: step into the road ahead of it (traffic stops for people), then
    // go round to the door once it has stopped.
    const goal = async () => {
      const now = await carById(player, car.id);
      if (!now) return null;
      if (now.speed < 2.5) return now.door;
      const me = await player.read('({ x: __game.player.character.x, z: __game.player.character.z })');
      const lead = Math.min(30, Math.hypot(now.x - me.x, now.z - me.z) * 0.8);
      return { x: now.x + Math.sin(now.yaw) * lead, z: now.z + Math.cos(now.yaw) * lead };
    };
    await walkTo(player, goal, { radius: 1.5, sprint: true, timeoutMs: 30000, settle: async () => {
      const now = await carById(player, car.id);
      return now && now.speed < 2.5;
    } });
    await walkTo(player, async () => (await carById(player, car.id))?.door, { radius: 1.5, sprint: true, timeoutMs: 8000 });
    await player.tap('KeyF');
    await sleep(450);
    const s = await snapshot(player);
    if (s.inCar) return { ...car, wasDriver: car.driver };
    if (process.env.BOT_DEBUG) {
      const now = await carById(player, car.id);
      console.log(`    stealCar attempt ${attempt}: car ${car.id} ${car.name} at ${now ? `${now.x.toFixed(1)},${now.z.toFixed(1)} speed ${now.speed.toFixed(1)}` : 'gone'}; Kai at ${s.x.toFixed(1)},${s.z.toFixed(1)} (${now ? Math.hypot(now.door.x - s.x, now.door.z - s.z).toFixed(1) : '?'} m from the door)`);
    }
  }
  return null;
}

/** The nearest person of `kinds` standing (read only). */
export function nearestPerson(player, kinds = ['pedestrian'], maxDistance = 120) {
  return player.read(`(() => {
    const g = __game, h = g.player.character;
    const kinds = ${JSON.stringify(kinds)};
    let best = null, bestD = ${Number(maxDistance)};
    for (const c of g.characters.list) {
      if (!c.active || c === h || !kinds.includes(c.kind) || c.state === 'dead' || c.vehicle) continue;
      const d = Math.hypot(c.x - h.x, c.z - h.z);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best ? { id: best.id, x: best.x, z: best.z, kind: best.kind, state: best.state, health: best.health, distance: bestD } : null;
  })()`);
}

export function personById(player, id) {
  return player.read(`(() => { const c = __game.characters.list.find((p) => p.id === ${Number(id)}); return c && c.active ? { id: c.id, x: c.x, z: c.z, state: c.state, health: c.health, kind: c.kind } : null; })()`);
}

/**
 * Chases a person on foot and punches (left click) whenever within reach, until they are down
 * for good or the time runs out. Returns true when they died.
 */
export async function punchOut(player, id, { timeoutMs = 20000 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const target = await personById(player, id);
    if (!target || target.state === 'dead') {
      await setKeys(player, []);
      return Boolean(target);
    }
    const me = await player.read('(() => { const g = __game, h = g.player.character; return { x: h.x, z: h.z, cam: g.followCamera.yaw, alive: h.alive, fate: g.fate.kind }; })()');
    if (!me.alive || me.fate) break;
    const dx = target.x - me.x;
    const dz = target.z - me.z;
    const gap = Math.hypot(dx, dz);
    const relative = wrap(Math.atan2(dx, dz) - me.cam);
    const octant = ((Math.round(relative / (Math.PI / 4)) % 8) + 8) % 8;
    if (gap > 1.1) {
      // Sprint: a frightened pedestrian runs nearly as fast as Kai jogs.
      await setKeys(player, [...OCTANTS[octant], 'ShiftLeft']);
      await sleep(40);
    } else {
      // Step into them for a moment so Kai turns to face them, then swing.
      await setKeys(player, OCTANTS[octant]);
      await sleep(60);
      await setKeys(player, []);
      await player.click(player.mouse.x, player.mouse.y, 'left', 50);
    }
  }
  await setKeys(player, []);
  return false;
}
