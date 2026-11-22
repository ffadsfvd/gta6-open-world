// Drives from the start to Juno's Garage with the street navigator (real keys) and logs what
// happens every second, to see why a drive ends early. Diagnostic.
//   node tools/probe-drive-route.mjs [x z]
import { openGame, sleep } from './lib/chromeSession.mjs';
import { snapshot, startNewGame, stealCar } from './lib/playerBot.mjs';
import { driveRoute } from './lib/navigator.mjs';

const goal = process.argv[2] ? { x: Number(process.argv[2]), z: Number(process.argv[3]) } : { x: -120, z: 166 };
const session = await openGame({ headless: true });
const p = session.player;
const t0 = Date.now();
try {
  await startNewGame(p);
  const car = await stealCar(p);
  console.log('car', car && car.name);
  let done = false;
  const watcher = (async () => {
    let last = null;
    while (!done) {
      const s = await snapshot(p);
      const extra = await p.read(`(() => { const h = __game.player.character; const v = h.vehicle; return { fate: __game.fate.kind, hp: Math.round(h.health), hs: h.state, sinking: v ? v.sinking : null, carHp: v ? Math.round(v.health) : null, onGround: v ? v.onGround : null, y: +(v ? v.y : h.y).toFixed(2) }; })()`);
      const line = `${((Date.now() - t0) / 1000).toFixed(1)}s ${s.inCar ? 'car' : 'FOOT'} at ${s.x.toFixed(0)},${s.z.toFixed(0)} v ${s.car ? s.car.forward.toFixed(1) : '-'} keys ${s.keys.join('+')} ${JSON.stringify(extra)}`;
      if (!s.inCar && last && last.inCar) console.log('!! left the car:', line);
      console.log(line);
      last = s;
      await sleep(1000);
    }
  })();
  const result = await driveRoute(p, goal, { radius: 8, timeoutMs: 120000, cruise: 22 });
  done = true;
  await watcher;
  console.log('result', result);
  await p.screenshot('tmp/probe-route-end.jpg');
} finally {
  await session.close();
}
