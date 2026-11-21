// Story run-through (take-screenshots.mjs --script): starts each of the seven story missions at
// its contact and completes every step quickly (teleports stand in for driving), checking the
// scripts, rewards and unlocks end to end.
const g = window.__game;
const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
const frame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
const pressE = async () => {
  key('KeyE', true);
  await frame();
  key('KeyE', false);
  await frame();
};
g.newGame();
g.intro.finish();
const hero = g.player.character;
const results = [];
const moveTo = (x, z) => {
  const body = hero.vehicle ?? hero;
  body.x = x;
  body.z = z;
  body.vx = 0;
  body.vz = 0;
  if (hero.vehicle) hero.vehicle.speed = 0;
};
for (let mission = 0; mission < 7; mission += 1) {
  g.wanted.clear();
  if (hero.vehicle) g.player.exitVehicle();
  hero.health = hero.maxHealth;
  hero.armour = 100;
  const contact = g.missions.availableContacts()[0];
  moveTo(contact.x + 0.8, contact.z + 0.8);
  g.simulate(0.3);
  await pressE();
  g.simulate(0.2);
  const title = g.missions.current ? g.missions.current.def.title : `could not start (${contact.id})`;
  const trace = [];
  for (let guard = 0; guard < 80 && g.missions.current; guard += 1) {
    if (g.dialogue.active) g.dialogue.skip();
    const run = g.missions.current;
    if (!run) break;
    const step = run.step;
    const vars = run.vars;
    trace.push(step.kind ?? 'call');
    switch (step.kind) {
      case 'getInAnyVehicle': {
        const car = g.vehicles.spawn('sedan', hero.x + 3, hero.z, 0, { role: 'parked' });
        g.player.enterVehicle(car);
        break;
      }
      case 'enterVehicle':
        moveTo(vars[step.name].x + 3, vars[step.name].z);
        g.player.enterVehicle(vars[step.name]);
        break;
      case 'goTo':
      case 'collect':
      case 'deliver': {
        if (step.kind === 'goTo' && !hero.vehicle && /in a car/.test(step.objective)) {
          const car = g.vehicles.spawn('sports', hero.x + 3, hero.z, Math.PI, { role: 'parked' });
          g.player.enterVehicle(car);
        }
        const target = g.missions.routeTarget();
        if (target) moveTo(target.x, target.z);
        break;
      }
      case 'eliminate':
        for (const enemy of vars[step.name]) if (enemy.alive) g.combat.hurt(enemy, 9999, hero, 'gun');
        break;
      case 'chase':
        vars[step.name].damage(5000, hero);
        break;
      case 'loseCops':
        g.simulate(0.2);
        g.wanted.floor = 0;
        g.wanted.clear();
        break;
      case 'race':
        g.simulate(4);
        step.index = step.checkpoints.length - 1;
        moveTo(step.checkpoints[step.checkpoints.length - 1].x, step.checkpoints[step.checkpoints.length - 1].z);
        break;
      default:
        break;
    }
    g.simulate(0.25);
    await frame();
  }
  results.push({ mission: mission + 1, title, passed: g.progress.storyIndex === mission + 1, money: g.progress.money, steps: trace.join(' > ') });
  g.simulate(4);
}
return { results, unlocks: g.progress.unlocks, owned: g.combat.arsenal.owned, completed: g.progress.completed };
