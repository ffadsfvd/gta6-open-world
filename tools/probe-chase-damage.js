// Diagnostics, run inside the page by take-screenshots.mjs --script: a car flees three stars
// for 40 seconds under a lane-following driver, and every hit it takes is tallied by its cause
// (the function that dealt it), to see what wrecks getaway cars.
const g = window.__game;
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const { TrafficDriver } = await import('/src/ai/trafficDriver.js');
g.newGame();
g.intro.finish();
const hero = g.player.character;
const network = g.network;
const car = g.vehicles.spawn('sedan', 0, 0, 0, { role: 'player' });
const driver = new TrafficDriver(car, network, g.city.signals, g.rng.fork(5));
driver.place(network.nodeAt(4, 3).id, network.nodeAt(4, 4).id, 0, 0.3);
driver.cruise = 22;
driver.speedLimit = 22;
driver.startPanic(999);
g.player.enterVehicle(car);
car.ai = driver;
g.player.enabled = false;
g.wanted.setLevel(3, true);
const tally = {};
const original = car.damage.bind(car);
car.damage = (amount, source) => {
  const caller = (new Error().stack.split('\n')[2] ?? '').trim().replace(/\(.*\/src\//, '(').replace(/\)$/, '');
  const key = `${caller} <- ${source ? source.kind : 'none'}`;
  tally[key] = (tally[key] ?? 0) + amount * car.fragility;
  return original(amount, source);
};
const samples = [];
for (let second = 0; second < 40; second += 5) {
  await wait(5000);
  samples.push(`${second + 5}s: health ${Math.round(car.health)}, speed ${car.speed.toFixed(1)}, cops ${g.police.units.length}, officers ${g.police.officers.length}, wanted ${g.wanted.level}`);
}
return { samples, tally: Object.fromEntries(Object.entries(tally).map(([k, v]) => [k, Math.round(v)])) };
