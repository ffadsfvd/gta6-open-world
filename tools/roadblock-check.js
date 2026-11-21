// Roadblock probe (take-screenshots.mjs --script): drive north on Seabreeze with three stars
// and call the roadblock spawner directly, reporting what it decided.
const g = window.__game;
g.newGame();
g.intro.finish();
const car = g.vehicles.spawn('sports', 241.75, 150, Math.PI, { role: 'parked' });
g.player.enterVehicle(car);
car.vz = -20;
g.wanted.setLevel(3);
g.simulate(0.5);
car.vz = -20;
const before = g.police.units.length;
const heading = Math.atan2(car.vx, car.vz);
const aheadX = car.x + Math.sin(heading) * 110;
const aheadZ = car.z + Math.cos(heading) * 110;
const node = g.network.nearestNode(aheadX, aheadZ);
g.police.spawnRoadblock();
const blocks = g.police.units.filter((u) => u.roadblock).map((u) => [Math.round(u.vehicle.x), Math.round(u.vehicle.z)]);
return { speed: car.speed.toFixed(1), heading: heading.toFixed(2), ahead: [Math.round(aheadX), Math.round(aheadZ)], node: [node.x, node.z], nodeDistance: Math.round(Math.hypot(node.x - car.x, node.z - car.z)), before, after: g.police.units.length, blocks, timer: g.police.roadblockTimer };
