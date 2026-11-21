// Pursuit check (take-screenshots.mjs --script): Kai flees in a car driven like panicked
// traffic with three stars; every few seconds report how close the police are, how damaged,
// and whether the wanted level can be lost by hiding afterwards.
const g = window.__game;
g.newGame();
g.intro.finish();
const { TrafficDriver } = await import('./src/ai/trafficDriver.js');
const hero = g.player.character;
const car = g.vehicles.spawn('sports', 241.75, 120, Math.PI, { role: 'parked' });
g.player.enterVehicle(car);
const spot = g.network.laneFromPosition(car.x, car.z, car.yaw);
car.ai = new TrafficDriver(car, g.network, g.city.signals, g.rng.fork(9));
car.ai.place(spot.from, spot.to, spot.lane, spot.t);
car.ai.cruise = 22;
car.ai.startPanic(999);
g.player.enabled = false;
g.wanted.setLevel(3);
const samples = [];
for (let second = 0; second < 36; second += 1) {
  g.simulate(1);
  if (second % 4 === 3) {
    const cops = g.vehicles.list.filter((v) => v.type === 'police' && v.siren);
    const distances = cops.map((v) => Math.round(Math.hypot(v.x - car.x, v.z - car.z))).sort((a, b) => a - b);
    samples.push({ t: second + 1, stars: g.wanted.level, seen: g.wanted.seen, cops: distances.slice(0, 5), wrecked: g.vehicles.list.filter((v) => v.type === 'police' && v.destroyed).length, playerHealth: Math.round(car.health), roadblocks: g.police.units.filter((u) => u.roadblock).length, officers: g.police.officers.length });
  }
}
// Now stop somewhere hidden and see whether the stars fade.
car.ai = null;
car.x = -300;
car.z = -300;
car.vx = 0;
car.vz = 0;
let lostAfter = null;
for (let second = 0; second < 40; second += 1) {
  g.simulate(1);
  if (g.wanted.level === 0) {
    lostAfter = second + 1;
    break;
  }
}
return { samples: samples.map((s) => `${s.t}s stars ${s.stars} cops ${s.cops.join('/')} car ${s.playerHealth} blocks ${s.roadblocks}`), lostAfter, finalStars: g.wanted.level, arrests: g.progress.stats.arrests, hospital: g.progress.stats.hospital, fate: g.fate.kind };
