// Continues the saved story profile at the next mission and records every hit Kai takes (who,
// how, how much) while the mission bot plays it. Diagnostic: the page is only observed.
//   node tools/probe-mission-hits.mjs
import { openGame, sleep } from './lib/chromeSession.mjs';
import { loadStreetGraph } from './lib/navigator.mjs';
import { missionState, playMission, startNextStory } from './lib/missionBot.mjs';

const session = await openGame({ headless: true, profileDir: 'tmp/profiles/story' });
const p = session.player;
const t0 = Date.now();
const log = (text) => console.log(`${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s  ${text}`);
try {
  await p.clickElement('#start-screen .menu-list button:nth-of-type(1)');
  await sleep(800);
  if (!(await p.read('Boolean(document.pointerLockElement)'))) await p.click();
  await p.read(`(() => {
    window.__hits = [];
    const g = __game;
    g.events.on('characterHurt', (e) => { if (e.victim.kind === 'player') window.__hits.push({ t: +g.time.toFixed(1), by: e.attacker ? e.attacker.kind : null, how: e.kind, amount: Math.round(e.amount), inCar: Boolean(e.victim.vehicle), hp: Math.round(e.victim.health) }); });
    g.events.on('pedestrianHit', (e) => { if (e.character.kind === 'player') window.__hits.push({ t: +g.time.toFixed(1), by: 'car ' + (e.vehicle.driver ? e.vehicle.driver.kind : 'none'), how: 'runOver', speed: +e.speed.toFixed(1), hp: Math.round(e.character.health) }); });
    g.events.on('vehicleExploded', (e) => window.__hits.push({ t: +g.time.toFixed(1), how: 'explosion of ' + e.vehicle.name, mine: e.vehicle === g.player.character.vehicle || e.vehicle.driver === g.player.character }));
    g.events.on('vehicleExited', (e) => window.__hits.push({ t: +g.time.toFixed(1), how: 'exited', bailed: e.bailed, carHealth: Math.round(e.vehicle.health) }));
    g.events.on('vehicleCrash', (e) => { const mine = g.player.character.vehicle; if (mine && (e.a === mine || e.b === mine) && e.speed > 5) window.__hits.push({ t: +g.time.toFixed(1), how: 'crash', with: (e.a === mine ? e.b : e.a).type, speed: +e.speed.toFixed(1), carHealth: Math.round(mine.health) }); });
    g.events.on('vehicleImpact', (e) => { const mine = g.player.character.vehicle; if (mine && e.vehicle === mine && e.speed > 5) window.__hits.push({ t: +g.time.toFixed(1), how: 'hit ' + e.kind, speed: +e.speed.toFixed(1), carHealth: Math.round(mine.health) }); });
    window.__shots = 0;
    g.events.on('vehicleShot', (e) => { if (e.vehicle === g.player.character.vehicle) window.__shots += 1; });
    setInterval(() => { if (window.__shots) { window.__hits.push({ t: +g.time.toFixed(1), how: 'bullets into my car', count: window.__shots, carHealth: Math.round(g.player.character.vehicle ? g.player.character.vehicle.health : -1) }); window.__shots = 0; } }, 2000);
    return true;
  })()`);
  const graph = await loadStreetGraph(p);
  log(`story ${(await missionState(p)).storyIndex}/7`);
  await startNextStory(p, { log, graph });
  let printed = 0;
  const watch = setInterval(async () => {
    try {
      const hits = await p.read('window.__hits');
      for (; printed < hits.length; printed += 1) log(`  HIT ${JSON.stringify(hits[printed])}`);
    } catch {
      // page busy
    }
  }, 500);
  const outcome = await playMission(p, { log, graph, timeoutMs: 240000 });
  clearInterval(watch);
  const hits = await p.read('window.__hits');
  for (; printed < hits.length; printed += 1) log(`  HIT ${JSON.stringify(hits[printed])}`);
  log(`outcome ${JSON.stringify(outcome)}`);
} finally {
  await session.close();
}
