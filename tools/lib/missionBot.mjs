// Plays missions the way a person does: reads the objective and the markers the HUD shows
// (read only), then walks, drives, talks, aims with the mouse, shoots, rams and flees using
// nothing but keys and mouse events.
import { sleep } from './chromeSession.mjs';
import { snapshot, walkTo, stealCar, punchOut, carById, personById } from './playerBot.mjs';
import { driveRoute, walkRoute, loadStreetGraph } from './navigator.mjs';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** What the current mission wants, as the HUD and markers show it. */
export function missionState(player) {
  return player.read(`(() => {
    const g = __game, m = g.missions, cur = m.current, h = g.player.character;
    const step = cur ? cur.step : null;
    const vars = cur ? cur.vars : {};
    const route = m.routeTarget();
    const pick = (v) => (v && v.halfLength !== undefined ? { id: v.id, x: v.x, z: v.z, speed: v.speed, health: v.healthShare, destroyed: v.destroyed, driver: v.driver ? v.driver.kind : null } : null);
    const named = step && step.name ? vars[step.name] : null;
    const crew = Array.isArray(named) ? named.filter((c) => c.active && c.alive).map((c) => ({ id: c.id, x: c.x, y: c.y, z: c.z, weapon: c.weapon })) : null;
    const next = m.nextStory();
    const contact = next && !cur ? m.availableContacts()[0] : null;
    return {
      active: Boolean(cur), id: cur ? cur.def.id : null, kind: step ? step.kind ?? 'call' : null,
      objective: m.objectiveText(), dialogue: g.dialogue.active, route: route ? { x: route.x, z: route.z } : null,
      place: step && step.place ? { x: step.place.x, z: step.place.z } : null, radius: step ? step.radius ?? null : null,
      requires: step ? step.requires ?? null : null, vehicle: pick(named), crew,
      pickup: step && step.kind === 'collect' && named ? { x: named.x, z: named.z } : null,
      countdown: step && step.kind === 'race' ? step.countdown : null,
      checkpoint: step && step.kind === 'race' ? step.index : null,
      storyIndex: g.progress.storyIndex, retry: m.retry && m.retryTimer > 0 ? m.retry.id : null,
      contact: contact ? { x: contact.x, z: contact.z, title: contact.missionTitle } : null,
      fate: g.fate.kind, wanted: g.wanted.level, state: g.state,
      inCar: Boolean(h.vehicle), carId: h.vehicle ? h.vehicle.id : null, x: h.x, z: h.z, health: h.health,
      weapon: g.combat.arsenal.current, owned: { ...g.combat.arsenal.owned }, ammo: JSON.parse(JSON.stringify(g.combat.arsenal.ammo)),
      banner: document.getElementById('big-message').classList.contains('hidden') ? '' : document.getElementById('big-message-title').textContent,
    };
  })()`);
}

/**
 * Turns the camera with the mouse until its view ray points at `point` ({ x, y, z }),
 * correcting from what the camera actually shows each time. Returns true when on target.
 */
export async function aimAt(player, point, { tolerance = 0.012, tries = 7 } = {}) {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    const view = await player.read(`(() => { const g = __game; g.camera.updateMatrixWorld(); const e = g.camera.matrixWorld.elements; const p = g.camera.position; return { x: p.x, y: p.y, z: p.z, fx: -e[8], fy: -e[9], fz: -e[10], sens: g.player.sensitivity, invert: g.player.invertY }; })()`);
    const dx = point.x - view.x;
    const dy = point.y - view.y;
    const dz = point.z - view.z;
    const yawError = wrap(Math.atan2(dx, dz) - Math.atan2(view.fx, view.fz));
    const pitchError = Math.atan2(dy, Math.hypot(dx, dz)) - Math.atan2(view.fy, Math.hypot(view.fx, view.fz));
    if (Math.abs(yawError) < tolerance && Math.abs(pitchError) < tolerance) return true;
    await player.look(-yawError / view.sens, (-pitchError / view.sens) * (view.invert ? -1 : 1), 3, 8);
    await sleep(40);
  }
  return false;
}

async function talkThrough(player) {
  for (let index = 0; index < 30; index += 1) {
    const s = await missionState(player);
    if (!s.dialogue) return;
    await player.tap('KeyE');
    await sleep(500);
  }
}

async function ensureOnFoot(player) {
  let s = await snapshot(player);
  if (!s.inCar) return;
  await player.hold('KeyS', Math.min(2000, 200 + Math.abs(s.car.forward) * 120));
  await player.tap('KeyF');
  await sleep(500);
  s = await snapshot(player);
  if (s.inCar) {
    await player.hold('Space', 800);
    await player.tap('KeyF');
    await sleep(500);
  }
}

async function ensureCar(player, log) {
  const s = await snapshot(player);
  if (s.inCar && !(await player.read('Boolean(__game.player.character.vehicle?.onFire)'))) return true;
  if (s.inCar) {
    // A burning car: get out and clear the blast before looking for another one.
    const wreck = await player.read('(() => { const v = __game.player.character.vehicle; return { x: v.x, z: v.z }; })()');
    await ensureOnFoot(player);
    const me = await snapshot(player);
    const away = Math.atan2(me.x - wreck.x, me.z - wreck.z);
    await walkRoute(player, { x: me.x + Math.sin(away) * 22, z: me.z + Math.cos(away) * 22 }, { timeoutMs: 4500 });
  }
  const car = await stealCar(player, "v.type !== 'police' && v.type !== 'van' && v.health > 450 && !v.onFire && !__game.vehicles.list.some((w) => w.onFire && Math.hypot(w.x - v.x, w.z - v.z) < 14)");
  if (log) log(car ? `took a ${car.name}` : 'found no car');
  return Boolean(car);
}

/** Gets somewhere: drives when it is far (taking a car if needed), walks the last bit when asked. */
export async function travel(player, goal, { radius = 6, onFoot = false, graph, log, until = null } = {}) {
  const me = await snapshot(player);
  const target = typeof goal === 'function' ? await goal() : goal;
  const far = Math.hypot(target.x - me.x, target.z - me.z) > 60;
  if (far || (me.inCar && !onFoot)) {
    if (await ensureCar(player, log)) {
      const result = await driveRoute(player, goal, { radius: onFoot ? 14 : Math.max(4, radius * 0.7), graph, timeoutMs: 150000, cruise: 22, until });
      if (log) log(`drove: ${result.reason}`);
      if (result.reason === 'not in a car') log(`  left the car: ${JSON.stringify(await player.read('(() => { const g = __game, h = g.player.character; return { fate: g.fate.kind, hp: Math.round(h.health), state: h.state, wanted: g.wanted.level, x: Math.round(h.x), z: Math.round(h.z) }; })()'))}`);
    }
  }
  if (onFoot) await ensureOnFoot(player);
  const now = await snapshot(player);
  if (!now.inCar) {
    const walked = await walkRoute(player, goal, { radius: Math.max(1, radius * 0.6), graph, timeoutMs: 90000 });
    if (!walked.arrived) await walkTo(player, typeof goal === 'function' ? goal : target, { radius: Math.max(1, radius * 0.6), sprint: true, timeoutMs: 15000 });
  }
}

/** Shoots (or punches) every member of the crew still standing. */
async function fight(player, log) {
  await ensureOnFoot(player);
  let s = await missionState(player);
  const gun = s.owned.smg && (s.ammo.smg.mag + s.ammo.smg.reserve) > 0 ? 'Digit4' : s.owned.pistol && (s.ammo.pistol.mag + s.ammo.pistol.reserve) > 0 ? 'Digit2' : 'Digit1';
  await player.tap(gun);
  const started = Date.now();
  let lastReport = 0;
  while (Date.now() - started < 120000) {
    s = await missionState(player);
    if (s.kind !== 'eliminate' || !s.crew || s.crew.length === 0 || s.fate) break;
    const target = s.crew.reduce((best, c) => (!best || Math.hypot(c.x - s.x, c.z - s.z) < Math.hypot(best.x - s.x, best.z - s.z) ? c : best), null);
    const distance = Math.hypot(target.x - s.x, target.z - s.z);
    if (log && Date.now() - lastReport > 1500) {
      lastReport = Date.now();
      log(`  fight: ${s.crew.length} left, nearest ${distance.toFixed(0)} m, hp ${Math.round(s.health)}, ${s.weapon} ${JSON.stringify(s.ammo[s.weapon] ?? '')}`);
    }
    if (gun === 'Digit1' || (distance < 2.2 && target.weapon === 'fists')) {
      // A brawler in Kai's face: answer with fists, it is quicker than lining up a shot.
      if (gun !== 'Digit1') await player.tap('Digit1');
      await punchOut(player, target.id, { timeoutMs: 6000 });
      if (gun !== 'Digit1') await player.tap(gun);
      continue;
    }
    if (distance > 28) {
      await walkTo(player, async () => personById(player, target.id), { radius: 22, sprint: true, timeoutMs: 6000 });
      continue;
    }
    await player.mouseDown('right');
    await sleep(120);
    const live = await personById(player, target.id);
    if (live && live.state !== 'dead') {
      await aimAt(player, { x: live.x, y: (await player.read(`__game.characters.list.find((c) => c.id === ${target.id})?.y ?? 0`)) + 1.25, z: live.z });
      if (gun === 'Digit4') {
        await player.mouseDown('left');
        await sleep(260);
        await player.mouseUp('left');
      } else {
        await player.click(player.mouse.x, player.mouse.y, 'left', 40);
      }
    }
    const ammo = (await missionState(player)).ammo;
    const current = gun === 'Digit4' ? ammo.smg : ammo.pistol;
    if (current && current.mag === 0 && current.reserve === 0) {
      await player.mouseUp('right');
      if (log) log('out of ammo: fists');
      await player.tap('Digit1');
      return fight(player, log);
    }
  }
  await player.mouseUp('right');
}

/** Rams the target car until it is wrecked or stops broken. */
async function ram(player, log) {
  const s0 = await snapshot(player);
  if (!s0.inCar) {
    // Something quick and heavy for ramming.
    const car = await stealCar(player, "['sports', 'muscle', 'suv', 'sedan', 'pickup'].includes(v.type) && v.health > 600", 2);
    if (car && log) log(`took a ${car.name} for the chase`);
  }
  if (!(await ensureCar(player, log))) return;
  const started = Date.now();
  while (Date.now() - started < 90000) {
    const s = await missionState(player);
    if (s.kind !== 'chase' || !s.vehicle || s.fate) return;
    const target = s.vehicle;
    const car = await snapshot(player);
    if (!car.inCar || (await player.read('Boolean(__game.player.character.vehicle?.onFire)'))) {
      await ensureCar(player, log);
      continue;
    }
    const distance = Math.hypot(target.x - car.x, target.z - car.z);
    if (distance > 45) {
      await driveRoute(player, async () => carById(player, target.id), { radius: 40, stopAtGoal: false, timeoutMs: 8000, cruise: 30 });
      continue;
    }
    // Close: aim at a point a little ahead of it and floor it.
    const goal = await player.read(`(() => { const v = __game.vehicles.list.find((c) => c.id === ${target.id}); return v ? { x: v.x + v.vx * 0.4, z: v.z + v.vz * 0.4 } : null; })()`);
    if (!goal) return;
    const error = wrap(Math.atan2(goal.x - car.x, goal.z - car.z) - car.car.yaw);
    const keys = ['KeyW'];
    if (error > 0.06) keys.push('KeyA');
    else if (error < -0.06) keys.push('KeyD');
    for (const code of ['KeyA', 'KeyD', 'KeyS']) if (!keys.includes(code)) await player.up(code);
    await player.down(...keys);
    await sleep(60);
    if (car.car.speed < 1 && distance < 8) {
      await player.up('KeyW', 'KeyA', 'KeyD');
      await player.hold('KeyS', 900);
    }
  }
  await player.releaseAll();
}

/** Drives away from the police and keeps going until the stars are gone. */
export async function escape(player, graph, log, { anyStep = false } = {}) {
  const started = Date.now();
  while (Date.now() - started < 180000) {
    const s = await missionState(player);
    if (s.wanted === 0 || s.fate || (!anyStep && s.kind !== 'loseCops')) break;
    if (!(await ensureCar(player, log))) {
      // No car to be had: run for it down the nearest street.
      await walkRoute(player, { x: s.x + (Math.random() - 0.5) * 160, z: s.z + (Math.random() - 0.5) * 160 }, { graph, timeoutMs: 8000 });
      continue;
    }
    // Head for whichever far junction lies away from the cruisers.
    const goal = await player.read(`(() => {
      const g = __game, h = g.player.character;
      const cops = g.vehicles.list.filter((v) => v.type === 'police' && v.siren && v.active);
      let cx = h.x, cz = h.z;
      if (cops.length) { cx = cops.reduce((a, v) => a + v.x, 0) / cops.length; cz = cops.reduce((a, v) => a + v.z, 0) / cops.length; }
      let best = null, bestScore = -Infinity;
      for (const n of g.network.nodes) {
        const d = Math.hypot(n.x - h.x, n.z - h.z);
        if (d < 120 || d > 330) continue;
        const score = Math.hypot(n.x - cx, n.z - cz) - d * 0.3;
        if (score > bestScore) { bestScore = score; best = { x: n.x, z: n.z }; }
      }
      return best;
    })()`);
    if (!goal) break;
    const result = await driveRoute(player, goal, { radius: 12, stopAtGoal: false, timeoutMs: 25000, cruise: 24, graph, until: async () => (await missionState(player)).wanted === 0 });
    if (log) log(`fleeing: ${result.reason}, wanted ${(await missionState(player)).wanted}`);
  }
  await player.releaseAll();
}

/** Drives the checkpoints of a race in order. */
async function race(player, graph, log) {
  const started = Date.now();
  while (Date.now() - started < 240000) {
    const s = await missionState(player);
    if (s.kind !== 'race' || s.fate) return;
    if (s.countdown > 0) {
      await sleep(200);
      continue;
    }
    const index = s.checkpoint;
    if (!s.inCar) {
      // Lost the car mid-race (wrecked or stuck): grab the nearest one and carry on.
      if (!(await ensureCar(player, log))) await sleep(500);
      continue;
    }
    const result = await driveRoute(player, async () => {
      const now = await missionState(player);
      return now.kind === 'race' && now.checkpoint === index ? now.route : null;
    }, { radius: 7, stopAtGoal: false, timeoutMs: 40000, cruise: 34, graph });
    if (log) log(`checkpoint ${index + 1}: ${result.reason}`);
  }
}

/**
 * Plays one mission from where it stands to MISSION PASSED (or failure). `deliberateFail`
 * lets a chase target get away once, to check failing and retrying.
 */
export async function playMission(player, { log = () => {}, graph = null, timeoutMs = 600000 } = {}) {
  const streets = graph ?? (await loadStreetGraph(player));
  const started = Date.now();
  let lastObjective = null;
  let lastWanted = 0;
  while (Date.now() - started < timeoutMs) {
    const s = await missionState(player);
    if (s.wanted !== lastWanted) {
      log(`wanted level ${lastWanted} -> ${s.wanted}`);
      lastWanted = s.wanted;
    }
    if (s.objective !== lastObjective) {
      lastObjective = s.objective;
      if (s.objective) log(`objective: ${s.objective.replace(/\*/g, '')}`);
    }
    if (s.fate) {
      log(`fate: ${s.fate}`);
      await player.releaseAll();
      await player.waitFor('!__game.fate.kind', 20000, 250);
      await sleep(1200);
      return { outcome: 'fate', fate: s.fate };
    }
    if (!s.active) return { outcome: s.banner === 'MISSION PASSED' || s.banner === 'JOB DONE' ? 'passed' : 'ended', banner: s.banner };
    if (s.dialogue) {
      await talkThrough(player);
      continue;
    }
    switch (s.kind) {
      case 'talk':
        await sleep(300);
        break;
      case 'getInAnyVehicle':
        await ensureCar(player, log);
        break;
      case 'goTo': {
        const onFoot = s.requires === 'foot';
        await travel(player, s.place, { radius: s.radius ?? 5, onFoot, graph: streets, log });
        if (s.requires === 'any' || typeof s.requires === 'string') {
          const now = await snapshot(player);
          if (!now.inCar) await ensureCar(player, log);
        }
        await sleep(400);
        break;
      }
      case 'enterVehicle':
        if (s.vehicle) {
          const now = await snapshot(player);
          if (now.inCar && now.car.id !== s.vehicle.id) await ensureOnFoot(player);
          if (Math.hypot(s.vehicle.x - now.x, s.vehicle.z - now.z) > 40) await travel(player, s.vehicle, { radius: 30, graph: streets, log });
          await ensureOnFoot(player);
          await walkTo(player, async () => (await carById(player, s.vehicle.id))?.door, { radius: 1.4, sprint: true, timeoutMs: 20000 });
          await player.tap('KeyF');
          await sleep(500);
        }
        break;
      case 'deliver': {
        const now = await snapshot(player);
        if (!now.inCar || (s.vehicle && now.car.id !== s.vehicle.id)) {
          await ensureOnFoot(player);
          if (s.vehicle) {
            await walkTo(player, async () => (await carById(player, s.vehicle.id))?.door, { radius: 1.4, sprint: true, timeoutMs: 30000 });
            await player.tap('KeyF');
            await sleep(500);
          }
        } else {
          await driveRoute(player, s.place, { radius: Math.max(3, (s.radius ?? 6) * 0.6), graph: streets, timeoutMs: 150000, cruise: 20 });
          await player.hold('KeyS', 600);
        }
        break;
      }
      case 'eliminate':
        await fight(player, log);
        break;
      case 'chase':
        await ram(player, log);
        break;
      case 'collect':
        if (s.pickup) await travel(player, s.pickup, { radius: 1.6, onFoot: Math.hypot(s.pickup.x - s.x, s.pickup.z - s.z) < 40, graph: streets, log });
        else await sleep(200);
        break;
      case 'loseCops':
        if (s.wanted > 0) await escape(player, streets, log);
        else if (s.route) await travel(player, s.route, { radius: 3, graph: streets, log });
        else await sleep(300);
        break;
      case 'race':
        await race(player, streets, log);
        break;
      default:
        await sleep(250);
    }
  }
  return { outcome: 'timeout' };
}

/** Goes to the next story contact and starts the mission with E. Returns its id or null. */
export async function startNextStory(player, { log = () => {}, graph = null } = {}) {
  const streets = graph ?? (await loadStreetGraph(player));
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const s = await missionState(player);
    if (s.active) return s.id;
    if (!s.contact) return null;
    // Police first: no contact talks with stars on Kai's head.
    if (s.wanted > 0) await escape(player, streets, log, { anyStep: true });
    log(`heading to the contact for "${s.contact.title}"`);
    await travel(player, s.contact, { radius: 2.2, onFoot: true, graph: streets, log });
    await walkTo(player, s.contact, { radius: 1.6, timeoutMs: 8000 });
    await sleep(400);
    for (let tries = 0; tries < 4; tries += 1) {
      await player.tap('KeyE');
      await sleep(500);
      const now = await missionState(player);
      if (now.active) return now.id;
      const wait = await missionState(player);
      if (wait.wanted > 0) {
        log('the police are after me: losing them before the contact talks');
        await escape(player, streets, log, { anyStep: true });
        break;
      }
    }
  }
  return null;
}
