// Second scripted session (take-screenshots.mjs --script): arrest and death with respawn, the
// gun shop, a taxi fare, a street-race start, a delivery job and Continue from a save.
const g = window.__game;
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
const tap = async (code, ms = 90) => {
  key(code, true);
  await wait(ms);
  key(code, false);
  await wait(140);
};
const log = [];
const errors = [];
window.addEventListener('error', (event) => errors.push(String(event.message)));
const note = (step, value) => log.push(`${step}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
const hero = g.player.character;
const placeNear = (x, z) => {
  hero.x = x;
  hero.z = z;
  hero.vx = 0;
  hero.vz = 0;
};

await tap('Enter');
await tap('Enter');
await wait(300);
note('playing', g.state);

// Arrest: two stars, stand still beside an officer.
g.wanted.setLevel(1);
const officer = g.police.makeOfficer(hero.x + 1.2, hero.z);
officer.brain = null;
g.police.officers.push(officer);
await wait(2400);
note('busted banner', document.getElementById('big-message-title').textContent);
await wait(5200);
note('after arrest: wanted', g.wanted.level);
note('after arrest: at police HQ (m)', Math.round(Math.hypot(hero.x + 169, hero.z + 120)));
note('stats arrests', g.progress.stats.arrests);

// Death: take fatal damage.
g.combat.hurt(hero, 500, null, 'gun');
await wait(1500);
note('wasted banner', document.getElementById('big-message-title').textContent);
await wait(12000);
note('after death: health', hero.health);
note('after death: at hospital (m)', Math.round(Math.hypot(hero.x - 40, hero.z + 169)));

// Shop: walk to Bayside Arms and buy armour after unlocking it.
g.progress.addMoney(5000);
g.progress.unlock('armour');
g.progress.unlock('pistol');
placeNear(40, 89);
await wait(600);
await tap('KeyE');
note('shop open', g.shop.isOpen);
await tap('Digit5');
await tap('Digit1');
note('armour after purchase', hero.armour);
note('owns pistol', g.combat.arsenal.owned.pistol);
await tap('Escape');
note('shop closed', !g.shop.isOpen);

// Taxi: sit in a taxi and press T.
const taxi = g.vehicles.spawn('taxi', hero.x + 4, hero.z, 0, { role: 'parked' });
g.player.enterVehicle(taxi);
await wait(300);
await tap('KeyT');
await wait(300);
note('taxi job', g.missions.active ? g.missions.objectiveText() : 'none');
const fare = g.missions.routeTarget();
taxi.x = fare.x;
taxi.z = fare.z;
taxi.vx = 0;
taxi.vz = 0;
await wait(800);
note('after pickup', g.missions.objectiveText());
const drop = g.missions.routeTarget();
taxi.x = drop.x;
taxi.z = drop.z;
await wait(900);
note('fares done', g.progress.stats.fares);
note('next fare queued', g.missions.active ? g.missions.objectiveText() : 'none');
g.missions.fail('test over');
await wait(4500);

// Street race: drive onto the Harbor Loop flag and press E.
taxi.x = -280;
taxi.z = 241.75;
taxi.yaw = Math.PI / 2;
await wait(500);
await tap('KeyE');
await wait(500);
note('race started', g.missions.active ? g.missions.current.def.title : 'no');
await wait(4500);
note('race objective', g.missions.objectiveText());
note('rivals moving', g.missions.current ? g.missions.current.step.racers.map((r) => +r.speed.toFixed(1)) : []);
g.missions.fail('test over');
await wait(4500);

// Delivery: Pelican Express depot on foot.
g.player.exitVehicle();
placeNear(40, 169);
await wait(500);
await tap('KeyE');
await wait(400);
note('delivery', g.missions.active ? g.missions.objectiveText() : 'none');
note('time limit after getting in', (() => {
  const van = g.missions.current.vars.van;
  g.player.enterVehicle(van);
  return 'entered van';
})());
await wait(500);
note('delivery objective', g.missions.objectiveText());
note('timer', g.missions.timeLeft() !== null ? Math.round(g.missions.timeLeft()) : null);
g.missions.fail('test over');
await wait(300);
g.save.save();
note('saved', g.save.summary());
return { log, errors };
