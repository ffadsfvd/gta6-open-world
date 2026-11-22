// Checks whether a trusted CDP click gets pointer lock in this Chrome (headless and headful),
// and why not when it fails. Diagnostic only.
//   node tools/probe-pointer-lock.mjs [--headful]
import { openGame, sleep } from './lib/chromeSession.mjs';

const headless = !process.argv.includes('--headful');
const session = await openGame({ headless });
const player = session.player;
try {
  await player.read(`(() => {
    window.__lockLog = [];
    document.addEventListener('pointerlockerror', () => window.__lockLog.push('pointerlockerror'));
    document.addEventListener('pointerlockchange', () => window.__lockLog.push('change:' + Boolean(document.pointerLockElement)));
    return true;
  })()`);
  await session.cdp.send('Page.bringToFront');
  console.log('focus before', await player.read('({ hasFocus: document.hasFocus(), visibility: document.visibilityState })'));
  await player.clickElement('#start-screen .menu-list button:nth-of-type(2)');
  await sleep(900);
  await player.tap('Enter');
  await sleep(500);
  await player.click();
  await sleep(600);
  console.log('after click', await player.read('({ locked: Boolean(document.pointerLockElement), log: window.__lockLog, hasFocus: document.hasFocus(), state: __game.state })'));
  // Same check with an explicit call from inside a click handler, to separate the game from Chrome.
  await player.read(`(() => { document.getElementById('game-canvas').addEventListener('click', () => {
    const p = document.getElementById('game-canvas').requestPointerLock();
    if (p && p.catch) p.catch((e) => window.__lockLog.push('rejected:' + e.name + ':' + e.message));
  }, { once: true }); return true; })()`);
  await player.click();
  await sleep(600);
  console.log('after second click', await player.read('({ locked: Boolean(document.pointerLockElement), log: window.__lockLog, state: __game.state })'));
} finally {
  await session.close();
}
