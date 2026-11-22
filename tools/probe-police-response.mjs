// What the police do after a one-star crime while Kai stands still: a timeline of the wanted
// level, how long he has been unseen, the cruisers and officers and how close they get.
// Real input only (a fist fight on the promenade). Diagnostic.
import { openGame, sleep } from './lib/chromeSession.mjs';
import { nearestPerson, punchOut, snapshot, startNewGame } from './lib/playerBot.mjs';

const session = await openGame({ headless: true });
const p = session.player;
try {
  await startNewGame(p);
  let s = await snapshot(p);
  const started = Date.now();
  while (Date.now() - started < 150000 && s.wanted < 1) {
    const target = await nearestPerson(p, ['pedestrian'], 120);
    if (target) await punchOut(p, target.id, { timeoutMs: 15000 });
    s = await snapshot(p);
  }
  console.log(`star after ${((Date.now() - started) / 1000).toFixed(0)} s at ${s.x.toFixed(0)},${s.z.toFixed(0)}`);
  for (let i = 0; i < 60; i += 1) {
    const info = await p.read(`(() => {
      const g = __game, h = g.player.character, w = g.wanted;
      const units = g.police.units.map((u) => ({ d: Math.round(Math.hypot(u.vehicle.x - h.x, u.vehicle.z - h.z)), at: [Math.round(u.vehicle.x), Math.round(u.vehicle.z)], v: +u.vehicle.speed.toFixed(1), dep: u.deployed, ai: u.vehicle.ai ? u.vehicle.ai.constructor.name : null, next: u.vehicle.ai && u.vehicle.ai.waypoints ? u.vehicle.ai.waypoints.slice(0, 3).map((w) => [Math.round(w.x), Math.round(w.z)]) : null, left: u.vehicle.ai && u.vehicle.ai.waypoints ? u.vehicle.ai.waypoints.length : 0 }));
      const cops = g.characters.list.filter((c) => c.kind === 'police' && !c.vehicle && c.active).map((c) => Math.round(Math.hypot(c.x - h.x, c.z - h.z)));
      return { t: +g.time.toFixed(1), level: w.level, unseen: +w.unseen.toFixed(1), seen: w.seen, bust: +w.bustTimer.toFixed(2), units, cops, fate: g.fate.kind };
    })()`);
    console.log(JSON.stringify(info));
    if (info.fate || info.level === 0) break;
    await sleep(1000);
  }
} finally {
  await session.close();
}
