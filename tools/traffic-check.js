// Traffic and crowd health check (take-screenshots.mjs --script): runs the city for a while
// around a junction, then reports how traffic and walkers are doing and frames the junction.
const g = window.__game;
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
g.newGame();
g.intro.finish();
const hero = g.player.character;
hero.x = 92;
hero.z = 12;
g.population.reset();
const samples = { moving: 0, stopped: 0, waitingAtRed: 0, onSidewalk: 0 };
for (let second = 0; second < 40; second += 1) {
  g.simulate(1);
  for (const v of g.population.traffic) {
    if (!v.active || !v.ai) continue;
    if (v.speed > 2) samples.moving += 1;
    else samples.stopped += 1;
    const onRoad = Math.min(...[-320, -240, -160, -80, 0, 80, 160, 240].map((x) => Math.abs(v.x - x))) < 7.5
      || Math.min(...[-320, -240, -160, -80, 0, 80, 160, 240].map((z) => Math.abs(v.z - z))) < 7.5;
    if (!onRoad) samples.onSidewalk += 1;
  }
}
const wrecked = g.vehicles.list.filter((v) => v.destroyed).length;
const damaged = g.population.traffic.filter((v) => v.healthShare < 0.9).length;
const walkers = g.population.walkers.filter((w) => w.active);
const crossing = walkers.filter((w) => w.brain && (w.brain.mode === 'cross' || w.brain.mode === 'wait')).length;
const down = walkers.filter((w) => w.state === 'down' || w.state === 'dead').length;
g.followCamera.override = { position: hero.y !== undefined ? new (g.camera.position.constructor)(118, 46, 44) : null, target: new (g.camera.position.constructor)(80, 0, 0), fov: 55 };
g.state = 'title';
document.getElementById('start-screen').classList.add('hidden');
g.titleCamera.update = () => g.followCamera.override;
await wait(600);
return { samples, wrecked, damaged, traffic: g.population.traffic.length, walkers: walkers.length, crossing, down };
