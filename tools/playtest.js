// A scripted play session run inside the page by take-screenshots.mjs --script: real key and
// mouse events go through the game's own input, and each step records what the game did.
// Body of an async function; returns { log, errors }.
const g = window.__game;
const canvas = document.getElementById('game-canvas');
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
const tap = async (code, ms = 90) => {
  key(code, true);
  await wait(ms);
  key(code, false);
  await wait(120);
};
const click = async (button = 0) => {
  canvas.dispatchEvent(new MouseEvent('mousedown', { button, bubbles: true }));
  await wait(70);
  window.dispatchEvent(new MouseEvent('mouseup', { button, bubbles: true }));
  await wait(260);
};
const log = [];
const errors = [];
window.addEventListener('error', (event) => errors.push(String(event.message)));
const note = (step, value) => log.push(`${step}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
const hero = g.player.character;

note('title state', g.state);
await tap('Enter');
await wait(400);
note('after New Game', g.state);
await tap('Enter');
await wait(400);
note('after skipping intro', g.state);
note('hud visible', !document.getElementById('hud').classList.contains('hidden'));

let from = [hero.x, hero.z];
key('KeyW', true);
key('ShiftLeft', true);
await wait(1600);
key('KeyW', false);
key('ShiftLeft', false);
note('sprinted metres', Math.hypot(hero.x - from[0], hero.z - from[1]).toFixed(1));
await tap('Space');
note('jumped (vy or airborne)', hero.vy !== 0 || !hero.onGround);

const car = g.vehicles.nearest(hero.x, hero.z, 400, (v) => !v.destroyed && v.type !== 'police');
hero.x = car.x + Math.cos(car.yaw) * 2.6;
hero.z = car.z - Math.sin(car.yaw) * 2.6;
await wait(200);
await tap('KeyF');
await wait(300);
note('stole a car', hero.vehicle ? `${hero.vehicle.name} (driver jacked: ${car.role})` : 'no');
from = [hero.x, hero.z];
key('KeyW', true);
await wait(2600);
note('speed after 2.6 s (m/s)', hero.vehicle ? hero.vehicle.speed.toFixed(1) : 'not in car');
key('KeyA', true);
key('Space', true);
await wait(700);
key('KeyA', false);
key('Space', false);
key('KeyW', false);
note('drove metres', Math.hypot(hero.x - from[0], hero.z - from[1]).toFixed(1));
note('handbrake slide (slip)', hero.vehicle ? hero.vehicle.slip.toFixed(2) : 'n/a');
await tap('KeyH', 300);
await tap('KeyN');
note('radio', g.audio.stationName());
await wait(1500);
await tap('KeyF');
await wait(500);
note('out of car', !hero.vehicle);

g.combat.arsenal.give('pistol', 48);
await tap('Digit2');
note('weapon', g.combat.arsenal.current);
for (let shot = 0; shot < 8; shot += 1) await click(0);
note('ammo after 8 shots', g.combat.arsenal.ammo.pistol);
note('wanted after shooting', g.wanted.level);
g.wanted.setLevel(2);
await wait(6000);
note('police cars chasing', g.police.units.length);
note('police nearby (m)', Math.round(g.wanted.nearestCop(hero.x, hero.z)));

await tap('KeyP');
note('paused', g.state);
await tap('Escape');
note('resumed', g.state);
await tap('KeyM');
note('map open', g.state);
await tap('KeyM');
note('map closed', g.state);

g.wanted.clear();
await wait(300);
const contact = g.missions.availableContacts()[0];
note('next contact', contact ? `${contact.id} for "${contact.missionTitle}"` : 'none');
hero.x = contact.x + 1;
hero.z = contact.z + 1;
await wait(500);
await tap('KeyE');
await wait(300);
note('mission active', g.missions.active ? g.missions.current.def.title : 'no');
for (let line = 0; line < 8 && g.dialogue.active; line += 1) {
  await tap('KeyE');
  await tap('KeyE');
}
note('objective', g.missions.objectiveText());
const parked = g.vehicles.nearest(hero.x, hero.z, 300, (v) => !v.destroyed && v.type !== 'police');
hero.x = parked.x + Math.cos(parked.yaw) * 2.6;
hero.z = parked.z - Math.sin(parked.yaw) * 2.6;
await wait(200);
await tap('KeyF');
await wait(400);
note('objective after getting a car', g.missions.objectiveText());
hero.vehicle.x = g.missions.routeTarget().x;
hero.vehicle.z = g.missions.routeTarget().z - 2;
hero.vehicle.vx = 0;
hero.vehicle.vz = 0;
await wait(1200);
for (let line = 0; line < 8 && g.dialogue.active; line += 1) {
  await tap('KeyE');
  await tap('KeyE');
}
await wait(600);
note('story index after mission', g.progress.storyIndex);
note('money', g.progress.money);
g.save.save();
note('save exists', g.save.exists());
note('save summary', g.save.summary());
note('fps-ish frames rendered', Math.round(g.time));
return { log, errors };
