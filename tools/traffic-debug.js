// Per-car traffic diagnostics (take-screenshots.mjs --script): where each AI car is relative to
// the road grid, its speed, steering and next waypoint, after the city has run for a while.
const g = window.__game;
g.newGame();
g.intro.finish();
const hero = g.player.character;
hero.x = 92;
hero.z = 12;
g.population.reset();
const lines = [-320, -240, -160, -80, 0, 80, 160, 240];
const offRoad = (v) => Math.min(...lines.map((x) => Math.abs(v.x - x))) > 7.5 && Math.min(...lines.map((z) => Math.abs(v.z - z))) > 7.5;
const report = [];
const track = new Map();
for (let second = 0; second < 30; second += 1) {
  g.simulate(1);
  for (const v of g.population.traffic) {
    if (!v.active || !v.ai) continue;
    if (offRoad(v) && !track.has(v.id)) {
      const w = v.ai.waypoints[0];
      track.set(v.id, `t=${second}s ${v.type} at (${v.x.toFixed(1)}, ${v.z.toFixed(1)}) yaw ${v.yaw.toFixed(2)} speed ${v.speed.toFixed(1)} steer ${v.controls.steer.toFixed(2)} next (${w.x.toFixed(1)}, ${w.z.toFixed(1)}) wps ${v.ai.waypoints.length} health ${Math.round(v.health)} panic ${v.ai.panic.toFixed(1)}`);
    }
  }
}
for (const line of track.values()) report.push(line);
return { offRoadCars: track.size, total: g.population.traffic.length, report: report.slice(0, 14) };
