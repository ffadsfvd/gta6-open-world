// Traces the rivals of one street race every half second (take-screenshots.mjs --script).
const g = window.__game;
g.newGame();
g.intro.finish();
const hero = g.player.character;
const { STREET_RACES, raceMission } = await import('./src/activities/streetRaces.js');
const spec = STREET_RACES[0];
const car = g.vehicles.spawn('sports', spec.start.x, spec.start.z, spec.start.yaw, { role: 'parked' });
g.player.enterVehicle(car);
g.missions.start(raceMission(spec));
const drivers = g.missions.current.step.racers.map((r) => r.ai);
g.simulate(4);
car.x = -330;
car.z = -338;
const trace = [];
const crashes = [];
g.events.on('vehicleImpact', (e) => {
  if (drivers.some((d) => d.vehicle === e.vehicle)) crashes.push(`t=${g.time.toFixed(1)} wall ${e.kind} speed ${e.speed.toFixed(1)} at (${e.x.toFixed(0)},${e.z.toFixed(0)}) car ${e.vehicle.id}`);
});
g.events.on('vehicleCrash', (e) => {
  if (drivers.some((d) => d.vehicle === e.a || d.vehicle === e.b)) crashes.push(`t=${g.time.toFixed(1)} cars ${e.a.id}/${e.b.id} (${e.a.role}/${e.b.role}) speed ${e.speed.toFixed(1)}`);
});
for (let tick = 0; tick < 50; tick += 1) {
  g.simulate(0.5);
  trace.push(drivers.map((d) => `${d.vehicle.id}:#${d.index} (${d.vehicle.x.toFixed(0)},${d.vehicle.z.toFixed(0)}) v${d.vehicle.speed.toFixed(0)} h${Math.round(d.vehicle.health)} s${d.vehicle.controls.steer.toFixed(1)} t${d.vehicle.controls.throttle.toFixed(1)} b${d.vehicle.controls.brake.toFixed(1)}`).join(' | '));
}
return { trace: trace.filter((_, i) => i % 2 === 0), crashes: crashes.slice(0, 25) };
