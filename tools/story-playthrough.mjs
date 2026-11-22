// Plays the whole story by hand: New Game, then every story mission from its contact (E) to
// MISSION PASSED, with real keys and mouse only. One mission is failed on purpose and retried.
// A death or arrest along the way is retried too, as a player would. Screenshots of each new
// objective go to tmp/story/.
//   node tools/story-playthrough.mjs [--headful] [--missions 3] [--fail paperTrail]
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { openGame, sleep } from './lib/chromeSession.mjs';
import { startNewGame, stealCar } from './lib/playerBot.mjs';
import { loadStreetGraph } from './lib/navigator.mjs';
import { missionState, playMission, startNextStory, travel } from './lib/missionBot.mjs';

function argument(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

const headless = !process.argv.includes('--headful');
const limit = Number(argument('--missions', '7'));
const failOnPurpose = argument('--fail', 'paperTrail');
const logFile = argument('--log');
const profileDir = argument('--profile');
const resume = process.argv.includes('--continue');
if (logFile) mkdirSync(dirname(logFile), { recursive: true });
const session = await openGame({ headless, profileDir });
const player = session.player;
const t0 = Date.now();
const print = (line) => {
  console.log(line);
  if (logFile) appendFileSync(logFile, `${line}\n`);
};
const log = (text) => print(`${((Date.now() - t0) / 1000).toFixed(0).padStart(5)}s  ${text}`);
const results = [];
let shot = 0;

try {
  if (resume && !(await player.read("document.querySelector('#start-screen .menu-list button').disabled"))) {
    // Continue the autosave from an earlier run, the way a returning player does.
    await player.clickElement('#start-screen .menu-list button:nth-of-type(1)');
    await sleep(800);
    if (!(await player.read('Boolean(document.pointerLockElement)'))) await player.click();
    log(`continued a saved game at story ${(await missionState(player)).storyIndex}/7`);
  } else {
    await startNewGame(player);
  }
  const graph = await loadStreetGraph(player);
  let lastObjective = '';
  let lastFate = null;
  const watch = setInterval(async () => {
    try {
      const s = await missionState(player);
      if (s.fate && s.fate !== lastFate) {
        // How did it happen: who hit Kai last, and where.
        const cause = await player.read('(() => { const h = __game.player.character; return { by: h.lastAttacker ? h.lastAttacker.kind : null, x: Math.round(h.x), z: Math.round(h.z), swimming: h.swimming, car: h.vehicle ? h.vehicle.name : null }; })()');
        log(`  ${s.fate}: ${JSON.stringify(cause)}`);
        await player.screenshot(`tmp/story/fate-${String(shot).padStart(2, '0')}.jpg`, 70);
      }
      lastFate = s.fate;
      if (s.objective && s.objective !== lastObjective) {
        lastObjective = s.objective;
        shot += 1;
        await player.screenshot(`tmp/story/${String(shot).padStart(2, '0')}-${s.id}.jpg`, 70);
      }
    } catch {
      // the page may be busy reloading
    }
  }, 1500);
  for (let mission = (await missionState(player)).storyIndex; mission < limit; mission += 1) {
    const started = Date.now();
    let attempts = 0;
    let passed = false;
    let id = null;
    let failedOnPurpose = false;
    while (attempts < 4 && !passed) {
      attempts += 1;
      const before = (await missionState(player)).storyIndex;
      const s = await missionState(player);
      if (s.retry) {
        log(`retrying ${s.retry} with E`);
        await player.tap('KeyE');
        await sleep(600);
      }
      if (!(await missionState(player)).active) id = await startNextStory(player, { log, graph });
      else id = (await missionState(player)).id;
      if (!id) {
        log('could not start the next story mission');
        break;
      }
      log(`=== mission ${mission + 1}: ${id} (attempt ${attempts})`);
      if (id === failOnPurpose && !failedOnPurpose) {
        // Let the courier van get away on purpose (drive the other way), then retry.
        failedOnPurpose = true;
        const waitStart = Date.now();
        while (Date.now() - waitStart < 120000) {
          const now = await missionState(player);
          if (!now.active) break;
          if (now.dialogue) {
            await player.tap('KeyE');
            await sleep(400);
            continue;
          }
          if (now.kind === 'getInAnyVehicle' && !now.inCar) {
            // The chase needs wheels first, as for anyone playing it.
            await stealCar(player);
            continue;
          }
          if (now.kind === 'chase' && now.vehicle) {
            const away = { x: now.x - (now.vehicle.x - now.x) * 3, z: now.z - (now.vehicle.z - now.z) * 3 };
            const clamp = (v) => Math.max(-320, Math.min(240, v));
            await travel(player, { x: clamp(away.x), z: clamp(away.z) }, { radius: 20, graph, log, until: async () => !(await missionState(player)).active });
          } else {
            await sleep(400);
          }
        }
        const after = await missionState(player);
        log(`deliberate failure: banner "${after.banner}", retry offered: ${after.retry}`);
        results.push({ check: `${id} can be failed and is offered again`, ok: after.retry === id });
        continue;
      }
      const outcome = await playMission(player, { log, graph });
      const now = await missionState(player);
      passed = now.storyIndex > before;
      log(`outcome: ${outcome.outcome} ${outcome.banner ?? outcome.fate ?? ''} (story ${now.storyIndex}/7)`);
      if (!passed) await sleep(1500);
    }
    results.push({ check: `story mission ${mission + 1} (${id}) passed by hand`, ok: passed, detail: `${attempts} attempt(s), ${((Date.now() - started) / 1000).toFixed(0)} s` });
    if (!passed) break;
    await sleep(2500);
  }
  clearInterval(watch);
} finally {
  await player.releaseAll().catch(() => {});
  print('');
  for (const result of results) print(`${result.ok ? 'PASS' : 'FAIL'}  ${result.check}${result.detail ? `  (${result.detail})` : ''}`);
  if (player.errors.length) print(`FAIL  page errors: ${player.errors.slice(0, 5).join(' | ')}`);
  print(`game frame rate during the run: ${await player.read('Math.round(__game.time / (performance.now() / 1000) * 100) + "% of real time"').catch(() => '?')}`);
  process.exitCode = results.every((r) => r.ok) && !player.errors.length ? 0 : 1;
  await session.close();
}
