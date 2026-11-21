// Race AI check (take-screenshots.mjs --script): starts each street race with the player parked
// at the start and lets the rivals drive; reports how far each got and how long it took.
const g = window.__game;
g.newGame();
g.intro.finish();
const hero = g.player.character;
const { STREET_RACES, raceMission } = await import('./src/activities/streetRaces.js');
const { STRAND_ROUTE } = await import('./src/missions/story/06-strand-sprint.js');
const report = [];
const routes = [
  ...STREET_RACES.map((spec) => ({ name: spec.title, start: spec.start, def: raceMission(spec), length: spec.route.length })),
  { name: 'Strand Sprint', start: { x: 241.75, z: 200, yaw: Math.PI }, def: null, length: STRAND_ROUTE.length },
];
for (const route of routes) {
  if (hero.vehicle) g.player.exitVehicle();
  const car = g.vehicles.spawn('sports', route.start.x, route.start.z, route.start.yaw, { role: 'parked' });
  g.player.enterVehicle(car);
  if (route.def) g.missions.start(route.def);
  else {
    const story = (await import('./src/missions/story/06-strand-sprint.js')).default;
    g.missions.start({ ...story, steps: (ctx) => story.steps(ctx).slice(2, 3) });
  }
  const step = g.missions.current.step;
  const drivers = step.racers.map((r) => r.ai);
  let finishedAt = null;
  g.simulate(4);
  // Park the player's car well off the route so the rivals have the road.
  car.x = -330;
  car.z = -338;
  car.vx = 0;
  car.vz = 0;
  for (let second = 0; second < 150; second += 1) {
    g.simulate(1);
    if (drivers.some((d) => d.finished) && finishedAt === null) finishedAt = second;
    if (finishedAt !== null) break;
  }
  report.push({
    race: route.name,
    checkpoints: route.length,
    rivals: drivers.map((d) => ({ reached: d.index, health: Math.round(d.vehicle.health), stuck: d.vehicle.speed < 1 })),
    firstFinishSeconds: finishedAt,
  });
  if (g.missions.current) g.missions.fail('test');
  g.simulate(5);
}
return report;
