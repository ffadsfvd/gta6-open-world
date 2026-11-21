// Red-light probe (take-screenshots.mjs --script): for cars whose next stop line is red and
// close, reports distance and speed, to see whether traffic waits at signals.
const g = window.__game;
g.newGame();
g.intro.finish();
g.population.reset();
const rows = [];
for (let tick = 0; tick < 60 && rows.length < 24; tick += 1) {
  g.simulate(0.5);
  for (const v of g.population.traffic) {
    if (!v.ai || !v.active) continue;
    const stop = v.ai.waypoints.find((p) => p.stop);
    if (!stop) continue;
    const d = Math.hypot(stop.x - v.x, stop.z - v.z);
    const light = g.city.signals.state(stop.stop.junction, stop.stop.axis);
    if (light === 'red' && d < 14) rows.push(`car ${v.id} d=${d.toFixed(1)} speed=${v.speed.toFixed(1)} panic=${v.ai.panic.toFixed(1)} throttle=${v.controls.throttle.toFixed(2)} brake=${v.controls.brake.toFixed(2)} hb=${v.controls.handbrake}`);
  }
}
return { rows, time: g.city.signals.time.toFixed(1) };
