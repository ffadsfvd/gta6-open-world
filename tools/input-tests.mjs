// Regression tests that play the game only through real input: trusted clicks, mouse motion
// and held keys sent by the DevTools Protocol, exactly as a person at the keyboard would. Game
// state is only read, to check what the input did. Screenshots of each test go to tmp/tests/.
//   node tools/input-tests.mjs                 every test
//   node tools/input-tests.mjs drive wasted    some of them
//   node tools/input-tests.mjs --headful       in a visible Chrome window
import { openGame, reloadGame, sleep } from './lib/chromeSession.mjs';
import { snapshot, walkTo, driveTo, nearestCar, carById, nearestPerson, punchOut, startNewGame, stealCar } from './lib/playerBot.mjs';
import { driveRoute, walkRoute } from './lib/navigator.mjs';
import { missionState, playMission, escape, aimAt, travel, startNextStory } from './lib/missionBot.mjs';

const headless = !process.argv.includes('--headful');
const wanted = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const moved = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** Walks a fixed distance from the start to the safehouse door and back is too long; this is near. */
const SAFEHOUSE = { x: 231, z: 40 };
const ROAD_LINES = [-320, -240, -160, -80, 0, 80, 160, 240];

/** The middle of the far half of the street beside a sidewalk spot (where a driver would stop). */
function farLaneBeside(spot) {
  const nearestLine = (value) => ROAD_LINES.reduce((best, line) => (Math.abs(value - line) < Math.abs(value - best) ? line : best), ROAD_LINES[0]);
  const lx = nearestLine(spot.x);
  const lz = nearestLine(spot.z);
  const clamp = (v) => Math.max(-323.5, Math.min(243.5, v));
  if (Math.abs(spot.x - lx) <= Math.abs(spot.z - lz)) return { x: clamp(lx - Math.sign(spot.x - lx || 1) * 3.5), z: clamp(spot.z) };
  return { x: clamp(spot.x), z: clamp(lz - Math.sign(spot.z - lz || 1) * 3.5) };
}

/** Drives along the streets to the far lane beside `spot` and stops there with the handbrake. */
async function pullUpAcross(p, spot) {
  const lane = farLaneBeside(spot);
  const drove = await driveRoute(p, lane, { radius: 4, timeoutMs: 150000, cruise: 18 });
  await p.hold('Space', 900);
  const car = await p.read('(() => { const v = __game.player.character.vehicle; return v ? { x: v.x, z: v.z } : null; })()');
  return { ...drove, gap: car ? Math.hypot(car.x - spot.x, car.z - spot.z).toFixed(1) : null };
}

/**
 * Reads the HUD's layout: every visible panel and text line as boxes, then reports panels that
 * overlap, anything outside the window, and single-line texts that wrapped onto a second line.
 */
const LAYOUT_PROBE = `(() => {
  const shown = (el) => { if (!el || !el.isConnected) return false; const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.05) return false; for (let p = el.parentElement; p; p = p.parentElement) { const ps = getComputedStyle(p); if (ps.display === 'none' || Number(ps.opacity) < 0.05) return false; } const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const panels = ['mission-tracker', 'police-response', 'status-panel', 'rank-progress', 'weapon-bar', 'weapon-panel', 'zone-label', 'minimap-canvas', 'minimap-frame', 'health-bar', 'armour-bar', 'radio-now-playing', 'vehicle-panel', 'objective-text', 'help-box', 'dialogue-box', 'mission-timer'];
  const boxes = [];
  for (const id of panels) { const el = document.getElementById(id); if (shown(el)) boxes.push({ id, el, r: el.getBoundingClientRect() }); }
  for (const el of document.querySelectorAll('#toast-stack .toast')) if (shown(el)) boxes.push({ id: 'toast', el, r: el.getBoundingClientRect() });
  const problems = [];
  for (let i = 0; i < boxes.length; i += 1) {
    const a = boxes[i];
    if (a.r.left < -1 || a.r.top < -1 || a.r.right > innerWidth + 1 || a.r.bottom > innerHeight + 1) problems.push(a.id + ' leaves the window');
    for (let j = i + 1; j < boxes.length; j += 1) {
      const b = boxes[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (w > 2 && h > 2) problems.push(a.id + ' overlaps ' + b.id + ' (' + Math.round(w) + 'x' + Math.round(h) + ')');
    }
  }
  const singles = '#zone-label b, #zone-label small, #vehicle-name, #radio-station, .panel-title, .panel-kicker, .unit-list li, .tracker-next, .police-status, .radio-track, .radio-station, .slot-name, .slot-ammo, .rank-respect, .stat-bar b, #money-counter, #clock, .tracker-status div, .condition-row, .stage-row';
  for (const el of document.querySelectorAll(singles)) {
    if (!shown(el) || !el.textContent.trim()) continue;
    // A line that wrapped: one run of text laid out on two rows (mixed font sizes on one row are fine).
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rows = [...range.getClientRects()].filter((r) => r.width > 0.5).map((r) => r.top);
      if (rows.length > 1 && Math.max(...rows) - Math.min(...rows) > 3) {
        problems.push((el.id || el.className) + ' wraps: ' + el.textContent.trim().slice(0, 40));
        break;
      }
    }
  }
  return { problems, panels: boxes.map((b) => b.id) };
})()`;

const HUD_SIZES = [[1280, 720], [1366, 768], [1600, 900], [1920, 1080], [2560, 1440]];

/** Checks the HUD at every window size from 1280x720 to 2560x1440 in the state the game is in. */
async function checkLayout(t, label) {
  const p = t.player;
  const cdp = t.session.cdp;
  for (const [width, height] of HUD_SIZES) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await sleep(350);
    const report = await p.read(LAYOUT_PROBE);
    t.check(`${label} at ${width}x${height}: no HUD text overlaps or wraps`, report.problems.length === 0, report.problems.length ? report.problems.slice(0, 4) : report.panels.join(' '));
    if (width === 1280 && height === 720) await p.screenshot(`tmp/tests/layout-${label.replace(/\W+/g, '-')}.jpg`);
  }
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: p.width, height: p.height, deviceScaleFactor: 1, mobile: false });
  await sleep(300);
}

/** Opens a screenshot scene (a staged moment of the real game) in the same browser. */
async function openScene(t, query) {
  await t.session.cdp.send('Page.navigate', { url: `${t.session.url.split('?')[0]}${query}` });
  await sleep(500);
  return t.player.waitFor('window.__shotReady === true', 90000, 250);
}

/** A saved game just after Paint Job: Juno's pistol in hand, Taco Tuesday next, early afternoon. */
const PISTOL_SAVE = {
  version: 1, savedAt: 1795000000000, hour: 13,
  progress: { money: 900, completed: ['backInTheSun', 'paintJob'], storyIndex: 2, unlocks: { pistol: true, armour: false, smg: false }, shells: [], stats: {} },
  arsenal: { current: 'pistol', owned: { fists: true, pistol: true }, ammo: { pistol: { mag: 12, reserve: 48 } } },
  hero: { health: 100, armour: 0, x: 231, z: 40 },
};

/** Loads a save through the title screen's Continue button, then captures the mouse. */
async function continueFrom(t, save) {
  const p = t.player;
  await p.read(`localStorage.setItem('ondaluz.save.v1', ${JSON.stringify(JSON.stringify(save))})`);
  await reloadGame(t.session);
  await sleep(500);
  await p.clickElement('#start-screen .menu-list button:nth-of-type(1)');
  await sleep(700);
  if (!(await p.read('Boolean(document.pointerLockElement)'))) await p.click();
  await sleep(300);
}

/**
 * Aims the crosshair at a person's head with the mouse (leading a walker a little) and fires
 * one shot with the left button while the right one aims. Returns what the HUD showed.
 */
async function shootHead(p, id) {
  const head = () => p.read(`(() => { const c = __game.characters.list.find((c) => c.id === ${Number(id)}); if (!c || !c.active) return null; const h = c.appearance.build ? c.appearance.build.height : 1; return { x: c.x + c.vx * 0.12, y: c.y + 1.66 * h, z: c.z + c.vz * 0.12, state: c.state }; })()`);
  for (let pass = 0; pass < 3; pass += 1) {
    const point = await head();
    if (!point || point.state === 'dead') return { fired: false };
    await aimAt(p, point, { tolerance: 0.003, tries: 5 });
  }
  const before = await p.read('__game.combat.arsenal.ammo.pistol.mag');
  await p.click(p.mouse.x, p.mouse.y, 'left', 40);
  await sleep(50);
  const after = await p.read(`({ headshot: document.getElementById('hit-label') ? !document.getElementById('hit-label').classList.contains('hidden') : false, hit: document.getElementById('crosshair').classList.contains('hit'), dead: __game.characters.list.find((c) => c.id === ${Number(id)})?.state === 'dead', mag: __game.combat.arsenal.ammo.pistol.mag })`);
  return { fired: true, ...after, shots: before - after.mag };
}

const TESTS = {
  async title(t) {
    const p = t.player;
    let s = await snapshot(p);
    t.check('title screen is up', s.titleOpen && s.state === 'title', s.state);
    t.check('Continue is disabled without a save', await p.read("document.querySelector('#start-screen .menu-list button').disabled"));
    await p.screenshot('tmp/tests/title-1.jpg');
    // Keyboard: down to Controls, open it, back with Esc.
    await p.tap('KeyS');
    await p.tap('Enter');
    await sleep(300);
    t.check('Controls panel opens from the keyboard', await p.read("document.querySelector('#start-screen h2')?.textContent === 'Controls'"));
    await p.screenshot('tmp/tests/title-2-controls.jpg');
    await p.tap('Escape');
    await sleep(300);
    t.check('Esc goes back to the title menu', await p.read("document.querySelectorAll('#start-screen .menu-list button').length === 4"));
    // Mouse: Settings, change a value, Back.
    await p.clickElement('#start-screen .menu-list button:nth-of-type(4)');
    await sleep(300);
    t.check('Settings opens with the mouse', await p.read("document.querySelector('#start-screen h2')?.textContent === 'Settings'"));
    const before = await p.read("document.querySelector('#start-screen .menu-list button').textContent");
    await p.clickElement('#start-screen .menu-list button:nth-of-type(1)');
    await sleep(200);
    const after = await p.read("document.querySelector('#start-screen .menu-list button').textContent");
    t.check('a click changes a setting once', before !== after, `${before} -> ${after}`);
    await p.screenshot('tmp/tests/title-3-settings.jpg');
    await p.clickElement('#start-screen .menu-list button:last-child');
    await sleep(300);
    t.check('Back returns to the title menu', await p.read("document.querySelectorAll('#start-screen .menu-list button').length === 4"));
    // New Game with Enter (focus sits on it), then skip the intro with Space.
    await p.tap('Enter');
    await sleep(300);
    s = await snapshot(p);
    t.check('Enter starts a new game (intro)', s.state === 'intro', s.state);
    await sleep(800);
    await p.tap('Space');
    await sleep(400);
    s = await snapshot(p);
    t.check('Space skips the intro into play', s.state === 'playing' && s.hud, s.state);
    t.check('no page focus left on a hidden button', s.focus === 'BODY', s.focus);
  },

  async onFoot(t) {
    const p = t.player;
    await startNewGame(p);
    let s = await snapshot(p);
    t.check('mouse is captured after a click', s.locked);
    let from = s;
    await p.hold('KeyW', 2000);
    s = await snapshot(p);
    const ran = moved(s, from);
    t.check('W runs forward', ran > 7, ran.toFixed(1));
    const heading = Math.atan2(s.x - from.x, s.z - from.z);
    t.check('W runs where the camera looks', Math.abs(wrap(heading - from.camYaw)) < 0.25, wrap(heading - from.camYaw).toFixed(2));
    // Turn to look up Seabreeze Boulevard (open road) before sprinting.
    from = await snapshot(p);
    await p.look(683, 0, 20, 10);
    s = await snapshot(p);
    t.check('mouse turns the camera', Math.abs(wrap(s.camYaw - from.camYaw)) > 1.2, wrap(s.camYaw - from.camYaw).toFixed(2));
    from = s;
    await p.hold(['ShiftLeft', 'KeyW'], 2000);
    s = await snapshot(p);
    t.check('Shift sprints faster', moved(s, from) > ran * 1.25, `${moved(s, from).toFixed(1)} vs ${ran.toFixed(1)}`);
    from = s;
    await p.hold('KeyA', 1000);
    s = await snapshot(p);
    const side = Math.atan2(s.x - from.x, s.z - from.z);
    t.check('A steps left of the camera', moved(s, from) > 2.5 && Math.abs(wrap(side - (from.camYaw + Math.PI / 2))) < 0.4, `${moved(s, from).toFixed(1)} m, ${wrap(side - from.camYaw).toFixed(2)}`);
    from = s;
    await p.hold('KeyS', 1000);
    s = await snapshot(p);
    t.check('S steps back', moved(s, from) > 2.5, moved(s, from).toFixed(1));
    from = await snapshot(p);
    await p.down('Space');
    await sleep(180);
    s = await snapshot(p);
    await p.up('Space');
    t.check('Space jumps', s.y > from.y + 0.2, `${from.y.toFixed(2)} -> ${s.y.toFixed(2)}`);
    await sleep(800);
    from = await snapshot(p);
    await p.look(0, 120, 8, 12);
    s = await snapshot(p);
    t.check('mouse tilts the camera', Math.abs(s.camPitch - from.camPitch) > 0.1, `${from.camPitch.toFixed(2)} -> ${s.camPitch.toFixed(2)}`);
    // Walk into the apartment block west of the boulevard: the camera must stay outside it.
    await walkTo(p, { x: 226, z: 40 }, { radius: 0.5, timeoutMs: 8000 });
    await p.look(-900, 0, 20, 10);
    await sleep(500);
    const inside = await p.read(`(() => { const c = __game.camera.position; return __game.collision.query(c.x - 0.05, c.z - 0.05, c.x + 0.05, c.z + 0.05).filter((b) => b.top > c.y && b.maxX - b.minX > 1.6).length; })()`);
    t.check('the camera does not go inside walls', inside === 0, inside);
    await p.screenshot('tmp/tests/onfoot-wall.jpg');
  },

  async shop(t) {
    const p = t.player;
    await startNewGame(p);
    t.check('got a car to drive to Bayside Arms', Boolean(await stealCar(p)));
    const shop = { x: 40, z: 89 };
    const drove = await driveRoute(p, shop, { radius: 10, timeoutMs: 90000, cruise: 18 });
    t.check('drove to the gun shop', drove.arrived, drove.reason);
    await p.tap('KeyF');
    await sleep(900);
    await walkTo(p, shop, { radius: 1.2, timeoutMs: 15000 });
    await sleep(300);
    let s = await snapshot(p);
    t.check('the shop offers itself', /shop/i.test(s.help), s.help);
    await p.tap('KeyE');
    await sleep(500);
    const items = await p.read("document.querySelectorAll('#shop-panel .menu-button').length");
    t.check('E opens Bayside Arms with every gun, ammo, armour and first aid', items === 10, items);
    t.check('the shotgun and rifle are on sale', await p.read("/Shotgun/.test(document.getElementById('shop-panel').textContent) && /Marksman Rifle/.test(document.getElementById('shop-panel').textContent)"));
    await p.tap('KeyE');
    await sleep(400);
    t.check('E leaves the shop', await p.read("document.getElementById('shop-panel').classList.contains('hidden')"));
    if (!(await p.read('Boolean(document.pointerLockElement)'))) await p.click();
    const from = await snapshot(p);
    await p.hold('KeyS', 1500);
    s = await snapshot(p);
    t.check('and Kai walks away', moved(s, from) > 3, moved(s, from).toFixed(1));
  },

  async dodgeAndFists(t) {
    const p = t.player;
    await startNewGame(p);
    await p.hold('KeyW', 600);
    let from = await snapshot(p);
    // X while running: a dive roll that carries Kai forward fast and makes him untouchable.
    await p.down('KeyW');
    await p.tap('KeyX');
    await sleep(150);
    const rolling = await p.read('__game.player.character.dodging');
    await sleep(500);
    await p.up('KeyW');
    let s = await snapshot(p);
    t.check('X dives into a roll', rolling > 0, rolling);
    t.check('the roll carries Kai forward', moved(s, from) > 3, moved(s, from).toFixed(1));
    await sleep(600);
    from = await snapshot(p);
    await p.hold('KeyD', 800);
    s = await snapshot(p);
    t.check('he walks normally after the roll', moved(s, from) > 2.5 && s.heroState !== 'down', `${moved(s, from).toFixed(1)} ${s.heroState}`);
    // Standing still, X rolls to the side.
    await sleep(400);
    from = await snapshot(p);
    await p.tap('KeyX');
    await sleep(700);
    s = await snapshot(p);
    t.check('a roll from standing goes sideways', moved(s, from) > 2.5, moved(s, from).toFixed(1));
    t.check('number keys keep fists when no gun is owned', (await p.read('__game.combat.arsenal.current')) === 'fists');
    await p.tap('Digit3');
    t.check('an unowned shotgun cannot be drawn', (await p.read('__game.combat.arsenal.current')) === 'fists');
  },

  async drive(t) {
    const p = t.player;
    await startNewGame(p);
    const car = await stealCar(p);
    t.check('F steals a traffic car', Boolean(car), car && car.name);
    if (!car) return;
    let s = await snapshot(p);
    const victim = await p.read(`(() => { const v = __game.vehicles.list.find((c) => c.id === ${car.id}); return { driver: v.driver.kind, people: __game.characters.list.filter((c) => c.kind === 'pedestrian' && !c.vehicle && Math.hypot(c.x - v.x, c.z - v.z) < 6).length }; })()`);
    if (car.wasDriver) t.check('the old driver is pulled out onto the street', victim.driver === 'player' && victim.people > 0, victim);
    t.check('the car has no AI while Kai drives', s.car.ai === null, s.car.ai);
    await p.screenshot('tmp/tests/drive-1-in.jpg');
    let from = s;
    await p.hold('KeyW', 3000);
    s = await snapshot(p);
    t.check('W accelerates', s.car.speed > 12, s.car.speed.toFixed(1));
    t.check('the camera follows behind the car', Math.abs(wrap(s.camYaw - s.car.yaw)) < 0.35, wrap(s.camYaw - s.car.yaw).toFixed(2));
    await p.screenshot('tmp/tests/drive-2-speed.jpg');
    from = s;
    await p.hold('Space', 900);
    s = await snapshot(p);
    t.check('Space (handbrake) slows the car', s.car.speed < from.car.speed - 3, `${from.car.speed.toFixed(1)} -> ${s.car.speed.toFixed(1)}`);
    await p.hold('KeyW', 2500);
    // A short tap while cruising straight: a lane change, not a swerve.
    await p.down('KeyW');
    await sleep(300);
    from = await snapshot(p);
    await p.tap('KeyA', 160);
    await sleep(350);
    s = await snapshot(p);
    await p.up('KeyW');
    t.check('a short tap at speed is a lane change, not a swerve', Math.abs(wrap(s.car.yaw - from.car.yaw)) < 0.3 && Math.abs(wrap(s.car.yaw - from.car.yaw)) > 0.02, `${wrap(s.car.yaw - from.car.yaw).toFixed(2)} at ${from.car.speed.toFixed(1)} m/s`);
    from = s;
    await p.hold(['KeyW', 'KeyA'], 900);
    s = await snapshot(p);
    const left = wrap(s.car.yaw - from.car.yaw);
    t.check('A steers left, and not into a spin', left > 0.15 && left < 1.6, left.toFixed(2));
    await sleep(400);
    from = await snapshot(p);
    await p.hold(['KeyW', 'KeyD'], 900);
    s = await snapshot(p);
    const right = wrap(s.car.yaw - from.car.yaw);
    t.check('D steers right, and not into a spin', right < -0.15 && right > -1.6, right.toFixed(2));
    await p.hold('KeyS', 3500);
    s = await snapshot(p);
    t.check('S brakes, then reverses', s.car.forward < -1, s.car.forward.toFixed(1));
    await p.down('KeyH');
    await sleep(250);
    const horn = await p.read('__game.player.character.vehicle.horn');
    await p.up('KeyH');
    t.check('H sounds the horn', horn === true);
    const station = await p.read('__game.audio.station');
    await p.tap('KeyN');
    t.check('N changes the radio station', (await p.read('__game.audio.station')) !== station);
    const view = s.camView;
    await p.tap('KeyV');
    await sleep(100);
    t.check('V changes the camera view', (await snapshot(p)).camView !== view);
    await p.tap('KeyV');
    await p.tap('KeyV');
    await p.hold('KeyW', 600);
    await p.hold('KeyS', 1500);
    await p.tap('KeyF');
    await sleep(400);
    s = await snapshot(p);
    t.check('F gets out of the car', !s.inCar && s.canAct, s.heroState);
    const back = await carById(p, car.id);
    await walkTo(p, async () => (await carById(p, car.id))?.door, { radius: 1.3, timeoutMs: 8000 });
    await p.tap('KeyF');
    await sleep(400);
    s = await snapshot(p);
    t.check('F gets back into the same car', s.inCar && s.car.id === car.id, s.car && s.car.id);
    from = s;
    await p.hold('KeyW', 1500);
    s = await snapshot(p);
    t.check('and it drives again', moved(s, from) > 4, moved(s, from).toFixed(1));
    t.check('car was where Kai left it', back && moved(back, from) < 6);
  },

  async wallsAndCrashes(t) {
    const p = t.player;
    await startNewGame(p);
    const car = await stealCar(p);
    t.check('got a car', Boolean(car));
    if (!car) return;
    // Head west into the apartment blocks of Carmine Strand and keep the foot down.
    let s = await snapshot(p);
    await driveTo(p, { x: s.x - 60, z: s.z }, { radius: 3, timeoutMs: 6000, cruise: 30 });
    await p.hold('KeyW', 1500);
    s = await snapshot(p);
    const health = s.car.health;
    await p.screenshot('tmp/tests/crash-1.jpg');
    // Back out and drive away: the car must not stay stuck in the wall.
    await p.hold('KeyS', 2000);
    const reversed = await snapshot(p);
    t.check('S backs out of a wall', moved(reversed, s) > 2, moved(reversed, s).toFixed(1));
    await p.hold(['KeyW', 'KeyD'], 1500);
    await p.hold('KeyW', 1500);
    const away = await snapshot(p);
    t.check('the car drives away after a crash', moved(away, reversed) > 6, moved(away, reversed).toFixed(1));
    t.check('crashing damages the car', health < 1000 || away.car.health < 1000, `${health} / ${away.car.health}`);
  },

  async policeCar(t) {
    const p = t.player;
    await startNewGame(p);
    const found = await p.waitFor("__game.vehicles.list.some((v) => v.type === 'police' && v.driver)", 20000, 500);
    t.check('a police patrol is around', found);
    if (!found) return;
    // Take any car, drive up to the patrol, then jack the cruiser.
    t.check('got a car to reach the patrol', Boolean(await stealCar(p)));
    const patrol = await nearestCar(p, "v.type === 'police' && v.driver");
    const reached = await driveRoute(p, async () => carById(p, patrol.id), { radius: 18, timeoutMs: 60000, cruise: 18 });
    t.check('drove up to the patrol', reached.arrived, reached.reason);
    await p.hold('KeyS', 800);
    await p.tap('KeyF');
    await sleep(600);
    const car = await stealCar(p, "v.type === 'police'", 3);
    t.check('F steals the police cruiser', Boolean(car));
    if (!car) return;
    let s = await snapshot(p);
    t.check('stealing a cruiser brings stars', s.wanted >= 2, s.wanted);
    const from = s;
    await p.down('KeyW');
    for (let i = 0; i < 8; i += 1) {
      await sleep(750);
      s = await snapshot(p);
      // Enough to prove it drives; any further and a cruiser on the seafront ends up in the sea.
      if (!s.car || s.car.ai || moved(s, from) > 30) break;
    }
    if (!s.car) {
      t.check('still at the wheel of the cruiser', false, `${s.fate} ${s.heroState} wanted ${s.wanted}`);
      return;
    }
    t.check('no police AI takes over the stolen cruiser', s.car.ai === null, s.car.ai);
    t.check('the cruiser answers W', s.car.controls.throttle === 1 && moved(s, from) > 20, moved(s, from).toFixed(1));
    await p.up('KeyW');
    await p.hold('KeyS', 1200);
    await p.down('KeyW');
    await sleep(1200);
    s = await snapshot(p);
    await p.down('KeyA');
    await sleep(700);
    const turned = await snapshot(p);
    await p.up('KeyA', 'KeyW');
    if (!s.car || !turned.car) {
      await p.screenshot('tmp/tests/policecar-lost.jpg');
      t.check('still at the wheel while turning', false, `${turned.fate} ${turned.heroState} wanted ${turned.wanted} at ${turned.x.toFixed(0)},${turned.z.toFixed(0)}`);
      return;
    }
    t.check('and steers', Math.abs(wrap(turned.car.yaw - s.car.yaw)) > 0.15, `${wrap(turned.car.yaw - s.car.yaw).toFixed(2)} at ${s.car.speed.toFixed(1)} m/s, ${s.x.toFixed(0)},${s.z.toFixed(0)}`);
    await p.screenshot('tmp/tests/policecar.jpg');
  },

  async wasted(t) {
    const p = t.player;
    await startNewGame(p);
    const car = await stealCar(p);
    t.check('got a car to wreck', Boolean(car));
    if (!car) return;
    // Ram the apartment blocks west of the boulevard until the car blows up with Kai inside.
    let s = await snapshot(p);
    const wall = { x: s.x - 40, z: s.z };
    const started = Date.now();
    while (Date.now() - started < 150000) {
      s = await snapshot(p);
      if (s.fate || !s.alive) break;
      if (!s.inCar) {
        await stealCar(p);
        continue;
      }
      // Hard hits from a long run-up; never sit still against the wall long enough to be cuffed.
      await driveTo(p, wall, { radius: 1, timeoutMs: 3500, cruise: 40 });
      await p.hold('KeyW', 400);
      await p.hold('KeyS', 2600);
    }
    await p.releaseAll();
    s = await snapshot(p);
    t.check('Kai is flatlined', s.fate === 'wasted' || !s.alive, `${s.fate} ${s.heroState}`);
    await p.screenshot('tmp/tests/wasted-1.jpg');
    // Hold W through the whole death and keep holding it after: control must come back.
    await p.down('KeyW');
    await p.waitFor('!__game.fate.kind', 15000, 200);
    await sleep(1500);
    s = await snapshot(p);
    await p.up('KeyW');
    t.check('respawned at the hospital', s.state === 'playing' && Math.hypot(s.x - 40, s.z + 169) < 12, `${s.x.toFixed(1)}, ${s.z.toFixed(1)}`);
    t.check('on his feet with full health', s.heroState === 'idle' && s.health === 100, `${s.heroState} ${s.health}`);
    t.check('the wanted level is cleared', s.wanted === 0, s.wanted);
    t.check('the screen is back to normal', await p.read("document.getElementById('screen-fade').style.opacity === '0' && !document.getElementById('game-canvas').style.filter"));
    await p.screenshot('tmp/tests/wasted-2-respawn.jpg');
    let from = await snapshot(p);
    await p.hold('KeyW', 2000);
    s = await snapshot(p);
    t.check('W walks away from the hospital', moved(s, from) > 7, moved(s, from).toFixed(1));
    from = s;
    await p.hold('KeyD', 1000);
    s = await snapshot(p);
    t.check('and D strafes', moved(s, from) > 2.5, moved(s, from).toFixed(1));
    await p.click();
    const again = await stealCar(p);
    t.check('can steal a car again', Boolean(again));
    if (again) {
      from = await snapshot(p);
      await p.hold('KeyW', 2500);
      s = await snapshot(p);
      t.check('and drive it', moved(s, from) > 10, moved(s, from).toFixed(1));
    }
  },

  async busted(t) {
    const p = t.player;
    await startNewGame(p);
    let s = await snapshot(p);
    const started = Date.now();
    // Brawl on the promenade until the police are interested.
    while (Date.now() - started < 150000 && s.wanted < 1) {
      const target = await nearestPerson(p, ['pedestrian'], 120);
      if (!target) {
        await p.hold('KeyW', 800);
      } else {
        await punchOut(p, target.id, { timeoutMs: 15000 });
      }
      s = await snapshot(p);
    }
    t.check('a killing gets a star', s.wanted >= 1, s.wanted);
    // Stand still with hands empty and let them come.
    const waitStart = Date.now();
    while (Date.now() - waitStart < 90000) {
      s = await snapshot(p);
      if (s.fate || s.wanted === 0) break;
      await sleep(400);
    }
    t.check('the police come and cuff a suspect who waits', s.fate === 'busted', `${s.fate} wanted ${s.wanted}`);
    await p.screenshot('tmp/tests/busted-1.jpg');
    if (s.fate !== 'busted') return;
    await p.waitFor('!__game.fate.kind', 15000, 200);
    await sleep(1200);
    s = await snapshot(p);
    t.check('released outside police HQ', Math.hypot(s.x + 169, s.z + 120) < 12, `${s.x.toFixed(1)}, ${s.z.toFixed(1)}`);
    t.check('hands down, stars gone', s.heroState === 'idle' && s.wanted === 0, `${s.heroState} ${s.wanted}`);
    const from = s;
    await p.hold('KeyW', 2000);
    s = await snapshot(p);
    t.check('W walks after the arrest', moved(s, from) > 7, moved(s, from).toFixed(1));
    await p.screenshot('tmp/tests/busted-2.jpg');
  },

  async pauseAndFocus(t) {
    const p = t.player;
    const session = t.session;
    await startNewGame(p);
    // Esc: the browser lets go of the mouse and the game pauses.
    await p.tap('Escape');
    await sleep(500);
    let s = await snapshot(p);
    t.check('Esc pauses and frees the mouse', s.state === 'paused' && !s.locked && s.pauseOpen, `${s.state} ${s.locked}`);
    await p.screenshot('tmp/tests/pause-1.jpg');
    await p.hold('KeyW', 600);
    await p.clickElement('#pause-menu .menu-list button:nth-of-type(1)');
    await sleep(600);
    s = await snapshot(p);
    t.check('Resume (click) plays again with the mouse captured', s.state === 'playing' && s.locked, `${s.state} ${s.locked}`);
    let from = s;
    await sleep(800);
    s = await snapshot(p);
    t.check('a key used in the menu does not keep Kai walking', moved(s, from) < 0.2, moved(s, from).toFixed(2));
    // A key held while the pause menu opens.
    await p.down('KeyW');
    await sleep(500);
    await p.tap('KeyP');
    await sleep(300);
    await p.up('KeyW');
    s = await snapshot(p);
    t.check('P pauses', s.state === 'paused', s.state);
    await p.tap('KeyP');
    await sleep(400);
    from = await snapshot(p);
    if (!from.locked) await p.click();
    await sleep(700);
    s = await snapshot(p);
    t.check('P resumes and Kai stands still', s.state === 'playing' && moved(s, from) < 0.2, `${s.state} ${moved(s, from).toFixed(2)}`);
    // Alt+Tab: another window takes the focus while W is held, and W is let go there (its
    // repeats and its key-up go to the other window, as the OS does).
    await p.click();
    await sleep(300);
    await p.down('KeyW');
    await sleep(400);
    await session.cdp.send('Emulation.setFocusEmulationEnabled', { enabled: false });
    p.stopRepeat();
    p.held.delete('KeyW');
    if (session.headless) {
      // No desktop to switch to: minimise the window instead (the page is hidden, as behind Alt+Tab).
      const { windowId } = await session.cdp.send('Browser.getWindowForTarget', { targetId: session.targetId });
      await session.cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'minimized' } });
      await sleep(900);
      await session.cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } });
    } else {
      const other = await session.cdp.send('Target.createTarget', { url: 'about:blank', newWindow: true, background: false });
      await sleep(900);
      await session.cdp.send('Target.closeTarget', { targetId: other.targetId });
    }
    await session.cdp.send('Page.bringToFront');
    if (session.headless) await session.cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await sleep(500);
    s = await snapshot(p);
    t.check('switching windows pauses the game', s.state === 'paused', s.state);
    from = s;
    await p.clickElement('#pause-menu .menu-list button:nth-of-type(1)');
    await sleep(500);
    from = await snapshot(p);
    await sleep(800);
    s = await snapshot(p);
    t.check('after coming back no key is stuck down', s.keys.length === 0 && moved(s, from) < 0.2, `${JSON.stringify(s.keys)} ${moved(s, from).toFixed(2)}`);
    // The map.
    await p.tap('KeyM');
    await sleep(400);
    s = await snapshot(p);
    t.check('M opens the city map', s.state === 'map' && s.mapOpen, s.state);
    await p.screenshot('tmp/tests/map.jpg');
    await p.tap('KeyM');
    await sleep(400);
    s = await snapshot(p);
    t.check('M closes it again', s.state === 'playing' && !s.mapOpen, s.state);
    if (!s.locked) await p.click();
    from = await snapshot(p);
    await p.hold('KeyW', 1200);
    s = await snapshot(p);
    t.check('Kai walks after the map', moved(s, from) > 4, moved(s, from).toFixed(1));
    // The pause menu's own City Map entry, then back to play with Esc.
    await p.tap('KeyP');
    await sleep(300);
    await p.clickElement('#pause-menu .menu-list button:nth-of-type(2)');
    await sleep(300);
    s = await snapshot(p);
    t.check('City Map from the pause menu opens the map', s.state === 'map' && s.mapOpen && !s.pauseOpen, `${s.state} ${s.pauseOpen}`);
    await p.tap('Escape');
    await sleep(400);
    s = await snapshot(p);
    t.check('Esc closes the map into play', s.state === 'playing', s.state);
    await sleep(300);
    s = await snapshot(p);
    t.check('and asks for a click to capture the mouse', s.state === 'playing' && (s.locked || (await p.read("!document.getElementById('lock-hint').classList.contains('hidden')"))), `${s.state} locked ${s.locked}`);
    await p.click();
    await sleep(300);
    t.check('a click captures it again', (await snapshot(p)).locked);
    // Resize the window.
    await session.cdp.send('Emulation.setDeviceMetricsOverride', { width: 1000, height: 620, deviceScaleFactor: 1, mobile: false });
    await sleep(500);
    const size = await p.read('({ w: __game.renderer.domElement.width, h: __game.renderer.domElement.height, aspect: __game.camera.aspect })');
    t.check('the view follows a window resize', Math.abs(size.aspect - 1000 / 620) < 0.01, size);
    await session.cdp.send('Emulation.setDeviceMetricsOverride', { width: p.width, height: p.height, deviceScaleFactor: 1, mobile: false });
  },

  async taxiFare(t) {
    const p = t.player;
    await startNewGame(p);
    let cab = null;
    for (let attempt = 0; attempt < 4 && !cab; attempt += 1) {
      const car = await stealCar(p, "v.type === 'taxi'", 3);
      let s = await snapshot(p);
      if (car && s.inCar && s.car.type !== 'taxi') {
        // F took the car in the next lane: get out, step right up to the cab's door, try again.
        await p.tap('KeyF');
        await sleep(800);
        await walkTo(p, async () => (await carById(p, car.id))?.door, { radius: 0.6, timeoutMs: 6000 });
        await p.tap('KeyF');
        await sleep(500);
        s = await snapshot(p);
      }
      if (car && s.inCar && s.car.type === 'taxi') cab = car;
      else if (s.inCar) {
        await p.tap('KeyF');
        await sleep(800);
      }
    }
    t.check('took a Sunny Cab', Boolean(cab), cab && cab.name);
    if (!cab) return;
    if ((await snapshot(p)).wanted > 0) {
      // Taking a cab from its driver earns a star: shake the police off first.
      t.check('the cab says to lose the police before fares', /lose the police/i.test((await snapshot(p)).help), (await snapshot(p)).help);
      await escape(p, null, (line) => console.log(`    ${line}`), { anyStep: true });
      let s = await snapshot(p);
      if (s.inCar && s.car.type !== 'taxi') return t.check('still in the cab after losing the police', false, s.car.type);
      if (!s.inCar) return t.check('still in the cab after losing the police', false, s.fate);
      await p.hold('KeyS', 1200);
    }
    const before = await p.read('({ money: __game.progress.money, fares: __game.progress.stats.fares })');
    await p.tap('KeyT');
    await sleep(400);
    let m = await missionState(p);
    t.check('T starts a fare', m.id === 'taxiFare', `${m.id} wanted ${m.wanted} car ${await p.read('__game.player.character.vehicle?.type')}`);
    if (m.id !== 'taxiFare') return;
    // Pull up in the road beside the waiting fare, in the lane on the far side of the street, and
    // stop there, as a driver does: no mounting the sidewalk.
    const pickup = m.place;
    const pulled = await pullUpAcross(p, pickup);
    t.check('drove to the waiting fare', pulled.arrived, pulled.reason);
    const boarded = await p.waitFor("/Drive the passenger/.test(__game.missions.objectiveText())", 12000, 200);
    m = await missionState(p);
    t.check('stopping across the street picks the fare up', boarded, `${m.objective} at ${pulled.gap} m`);
    if (!boarded) return;
    await p.screenshot('tmp/tests/taxi-aboard.jpg');
    const dropOff = m.place;
    const arrived = await pullUpAcross(p, dropOff);
    t.check('drove the passenger across town', arrived.arrived, arrived.reason);
    const paid = await p.waitFor("__game.progress.stats.fares > 0", 10000, 200);
    const after = await p.read('({ money: __game.progress.money, fares: __game.progress.stats.fares })');
    t.check('stopping at the far curb ends the fare', paid && after.fares === before.fares + 1, `fares ${before.fares} -> ${after.fares} at ${arrived.gap} m`);
    t.check('and the fare is paid', after.money > before.money, `$${before.money} -> $${after.money}`);
    const walker = await p.read("__game.characters.list.some((c) => c.kind === 'pedestrian' && c.brain && Math.hypot(c.x - __game.player.character.x, c.z - __game.player.character.z) < 6)");
    t.check('the passenger gets out and walks off', walker);
    await sleep(1500);
    t.check('the next fare is offered at once', (await missionState(p)).id === 'taxiFare');
    await p.screenshot('tmp/tests/taxi-done.jpg');
  },

  async loseCopsInCruiser(t) {
    const p = t.player;
    await startNewGame(p);
    const found = await p.waitFor("__game.vehicles.list.some((v) => v.type === 'police' && v.driver)", 20000, 500);
    t.check('a police patrol is around', found);
    if (!found) return;
    t.check('got a car to reach the patrol', Boolean(await stealCar(p)));
    const patrol = await nearestCar(p, "v.type === 'police' && v.driver");
    const reached = await driveRoute(p, async () => carById(p, patrol.id), { radius: 18, timeoutMs: 60000, cruise: 18 });
    t.check('drove up to the patrol', reached.arrived, reached.reason);
    await p.hold('KeyS', 800);
    await p.tap('KeyF');
    await sleep(600);
    const car = await stealCar(p, "v.type === 'police'", 3);
    let s = await snapshot(p);
    t.check('F steals the police cruiser', Boolean(car) && s.inCar && s.car.type === 'police', s.car && s.car.type);
    if (!s.inCar || s.car.type !== 'police') return;
    t.check('stealing a cruiser brings stars', s.wanted >= 2, s.wanted);
    // Drive away from every unit, break the line of sight and keep going: the stars must go,
    // as they would in any other car.
    const started = Date.now();
    await escape(p, null, (line) => console.log(`    ${line}`), { anyStep: true });
    s = await snapshot(p);
    t.check('the police are lost in a stolen cruiser', s.wanted === 0 && !s.fate, `wanted ${s.wanted} ${s.fate ?? ''} after ${((Date.now() - started) / 1000).toFixed(0)} s, ${s.inCar ? s.car.type : 'on foot'}`);
    await p.screenshot('tmp/tests/cruiser-escaped.jpg');
  },

  async headshots(t) {
    const p = t.player;
    const log = (line) => console.log(`    ${line}`);
    await continueFrom(t, PISTOL_SAVE);
    let s = await snapshot(p);
    t.check('Continue loads the save with the pistol', s.state === 'playing' && s.weapon === 'pistol', `${s.state} ${s.weapon}`);
    // Taco Tuesday: Crane's crew in Mercado Plaza, the foes the aim assist used to pull onto the chest.
    const story = await startNextStory(p, { log });
    t.check('Lou starts Taco Tuesday', story === 'tacoTuesday', story);
    if (story !== 'tacoTuesday') return;
    const begun = Date.now();
    let m = await missionState(p);
    while (Date.now() - begun < 120000 && m.active && m.kind !== 'eliminate') {
      if (m.dialogue) await p.tap('KeyE');
      else if (m.kind === 'goTo') await travel(p, m.place, { radius: m.radius ?? 5, onFoot: true, log });
      await sleep(400);
      m = await missionState(p);
    }
    t.check('the crew shows up in the plaza', m.kind === 'eliminate' && m.crew && m.crew.length > 0, m.kind);
    if (m.kind !== 'eliminate') return;
    await p.tap('Digit2');
    let gang = null;
    for (let attempt = 0; attempt < 14 && !(gang && gang.headshot); attempt += 1) {
      m = await missionState(p);
      if (m.kind !== 'eliminate' || m.fate || !m.crew || !m.crew.length) break;
      // The steadiest one in reach: a brawler throwing punches, or a gunman reeling from a hit.
      const speeds = await p.read(`Object.fromEntries(__game.characters.list.filter((c) => c.kind === 'gang').map((c) => [c.id, Math.hypot(c.vx, c.vz)]))`);
      const inReach = m.crew.filter((c) => Math.hypot(c.x - m.x, c.z - m.z) < 26);
      if (!inReach.length) {
        await walkTo(p, m.crew[0], { radius: 18, sprint: true, timeoutMs: 4000 });
        continue;
      }
      const target = inReach.reduce((best, c) => (!best || (speeds[c.id] ?? 9) < (speeds[best.id] ?? 9) ? c : best), null);
      await p.mouseDown('right');
      await sleep(200);
      let shot = await shootHead(p, target.id);
      // A body hit makes a gunman flinch and stand still for a moment: the follow-up goes high.
      if (shot.fired && shot.hit && !shot.headshot && !shot.dead) shot = await shootHead(p, target.id);
      await p.mouseUp('right');
      if (shot.fired) log(`crew ${target.id} (${target.weapon}, ${(speeds[target.id] ?? 0).toFixed(1)} m/s): ${JSON.stringify(shot)}`);
      if (shot.fired && shot.headshot) gang = shot;
      await sleep(400);
    }
    // Landing a head hit on a crew member that dodges and strafes is up to the aim; when one
    // lands, that single round must drop him.
    if (gang) t.check('one pistol round in the head kills a gang member', gang.dead && gang.shots === 1, gang);
    else log('no head hit landed on the moving crew this run');
    await p.screenshot('tmp/tests/headshot-gang.jpg');
    // A passer-by 14-26 m away (beyond the reach where a pointed gun scares people), in plain view.
    const pickWalker = () => p.read(`(() => { const g = __game, h = g.player.character; let best = null, bestScore = Infinity; for (const c of g.characters.list) { if (c.kind !== 'pedestrian' || !c.active || !c.canAct || !c.brain) continue; const d = Math.hypot(c.x - h.x, c.z - h.z); if (d < 14 || d > 26 || g.collision.segmentBlocked(h.x, h.z, c.x, c.z, 1.8)) continue; const score = Math.hypot(c.vx, c.vz) * 10 + d; if (score < bestScore) { bestScore = score; best = { id: c.id, d, health: c.health }; } } return best; })()`);
    let civilian = null;
    for (let attempt = 0; attempt < 8 && !(civilian && civilian.headshot); attempt += 1) {
      const target = await pickWalker();
      if (!target) {
        await p.hold('KeyW', 1500);
        continue;
      }
      await p.mouseDown('right');
      await sleep(250);
      const shot = await shootHead(p, target.id);
      await p.mouseUp('right');
      if (shot.fired) log(`civilian ${target.id} at ${target.d.toFixed(0)} m: ${JSON.stringify(shot)}`);
      if (shot.fired && shot.headshot) civilian = shot;
      await sleep(900);
    }
    t.check('a pistol shot on the crosshair hits a head and says HEADSHOT', Boolean(civilian), civilian);
    if (civilian) t.check('one pistol round in the head kills a civilian', civilian.dead && civilian.shots === 1, civilian);
    await p.screenshot('tmp/tests/headshot-civilian.jpg');
  },

  async crowdFlow(t) {
    const p = t.player;
    await startNewGame(p);
    // Stroll up the promenade and along Pier Street while watching every walker in town: anyone
    // who wants to walk but stays put for more than three seconds is stuck.
    const watch = `(() => { const g = __game; return g.population.walkers.filter((c) => c.active && c.brain && c.canAct).map((c) => ({ id: c.id, x: c.x, z: c.z, mode: c.brain.mode, wants: c.moveSpeed > 0.3 })); })()`;
    const tracks = new Map();
    let worst = { seconds: 0 };
    const started = Date.now();
    const route = [['KeyW', 6000], ['KeyA', 1500], ['KeyW', 6000]];
    let leg = 0;
    let legEnds = Date.now() + route[0][1];
    await p.down(route[0][0]);
    while (Date.now() - started < 50000) {
      if (leg < route.length && Date.now() > legEnds) {
        await p.up(route[leg][0]);
        leg += 1;
        if (leg < route.length) {
          await p.down(route[leg][0]);
          legEnds = Date.now() + route[leg][1];
        }
      }
      const now = Date.now();
      for (const walker of await p.read(watch)) {
        const track = tracks.get(walker.id);
        const walking = walker.wants && ['walk', 'cross', 'wander'].includes(walker.mode);
        if (!track || !walking || Math.hypot(walker.x - track.x, walker.z - track.z) > 0.5) {
          tracks.set(walker.id, { x: walker.x, z: walker.z, since: now });
          continue;
        }
        const seconds = (now - track.since) / 1000;
        if (seconds > worst.seconds) worst = { seconds, id: walker.id, x: walker.x.toFixed(1), z: walker.z.toFixed(1), mode: walker.mode };
      }
      await sleep(250);
    }
    await p.releaseAll();
    t.check('walkers kept moving while the town was watched', tracks.size > 20, tracks.size);
    t.check('no walker stays stuck for more than three seconds', worst.seconds <= 3, worst);
    await p.screenshot('tmp/tests/crowd.jpg');
  },

  async hudLayout(t) {
    const p = t.player;
    await startNewGame(p);
    await p.hold('KeyW', 1200);
    await checkLayout(t, 'on foot');
    const car = await stealCar(p);
    t.check('took a car for the driving HUD', Boolean(car));
    if (car) {
      await p.hold('KeyW', 1500);
      await checkLayout(t, 'in a car');
    }
    // Staged moments of the real game with every panel filled: a chase with the police on Kai,
    // a fight on foot with dialogue, and a street race.
    for (const [label, query] of [['police chase', '?shot=cover&seed=20261124'], ['plaza fight', '?shot=street&seed=20261124'], ['street race', '?shot=race&seed=20261124']]) {
      const ready = await openScene(t, query);
      t.check(`${label} scene is up`, ready);
      if (ready) await checkLayout(t, label);
    }
  },

  async mapWaypoint(t) {
    const p = t.player;
    await startNewGame(p);
    await p.tap('KeyM');
    await sleep(400);
    t.check('M opens the city map', (await snapshot(p)).state === 'map');
    const view = () => p.read('({ zoom: __game.fullMap.zoom, mx: __game.fullMap.center.mx, my: __game.fullMap.center.my })');
    const box = await p.read("(() => { const r = document.getElementById('full-map-canvas').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; })()");
    const v0 = await view();
    await p.wheel(-120, box.x + 80, box.y + 50);
    await p.wheel(-120, box.x + 80, box.y + 50);
    const v1 = await view();
    t.check('the mouse wheel zooms in', v1.zoom > v0.zoom * 1.4, `${v0.zoom} -> ${v1.zoom}`);
    await p.tap('Minus');
    await sleep(150);
    const v2 = await view();
    t.check('- zooms out', v2.zoom < v1.zoom, `${v1.zoom} -> ${v2.zoom}`);
    await p.tap('Equal');
    await sleep(150);
    const v3 = await view();
    t.check('+ zooms in', v3.zoom > v2.zoom, `${v2.zoom} -> ${v3.zoom}`);
    await p.drag(box.x, box.y, box.x - 160, box.y - 90);
    const v4 = await view();
    t.check('dragging pans the map', Math.hypot(v4.mx - v3.mx, v4.my - v3.my) > 40, `${Math.round(v4.mx - v3.mx)}, ${Math.round(v4.my - v3.my)}`);
    t.check('a drag sets no waypoint', !(await p.read('__game.waypoint.active')));
    // Click a spot a few blocks from Kai: the waypoint goes there.
    const spot = await p.read('(() => { const h = __game.player.character; return __game.fullMap.pagePoint(h.x - 120, h.z - 90); })()');
    await p.click(spot.x, spot.y);
    await sleep(200);
    const set = await p.read('(() => { const w = __game.waypoint.point, h = __game.player.character; return w ? { x: w.x, z: w.z, dx: w.x - h.x, dz: w.z - h.z } : null; })()');
    t.check('a click on the map sets a waypoint there', set && Math.abs(set.dx + 120) < 6 && Math.abs(set.dz + 90) < 6, set);
    if (!set) return;
    const pinColour = (r, g, b) => r > 180 && g < 140 && b > 200;
    const onMap = await p.read(`(() => { const m = __game.fullMap; m.draw(); const [cx, cy] = m.toScreen(${set.x}, ${set.z}); return [...m.ctx.getImageData(Math.round(cx), Math.round(cy), 1, 1).data]; })()`);
    t.check('the waypoint shows on the full map', pinColour(...onMap), onMap);
    await p.screenshot('tmp/tests/map-waypoint.jpg');
    await p.tap('KeyM');
    await sleep(1300);
    const routed = await p.read(`(() => { const r = __game.hud.route; if (!r) return null; const end = r[r.length - 1]; return Math.hypot(end.x - ${set.x}, end.z - ${set.z}); })()`);
    t.check('back in play the GPS route leads to the waypoint', routed !== null && routed < 1, routed);
    const onMinimap = await p.read("(() => { const c = document.getElementById('minimap-canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 180 && d[i + 1] < 140 && d[i + 2] > 200) n += 1; return n; })()");
    t.check('the minimap shows the waypoint', onMinimap > 20, onMinimap);
    await p.screenshot('tmp/tests/minimap-waypoint.jpg');
    // On the map again, a click on the waypoint clears it; a new one goes with Backspace.
    await p.tap('KeyM');
    await sleep(400);
    const pin = await p.read(`__game.fullMap.pagePoint(${set.x}, ${set.z})`);
    await p.click(pin.x, pin.y);
    await sleep(200);
    t.check('a click on the waypoint clears it', !(await p.read('__game.waypoint.active')));
    await p.click(box.x + 40, box.y + 40);
    await sleep(150);
    const again = await p.read('__game.waypoint.active');
    await p.tap('Backspace');
    await sleep(150);
    t.check('Backspace clears a waypoint', again && !(await p.read('__game.waypoint.active')));
    await p.tap('KeyM');
    await sleep(400);
    t.check('M closes the map into play', (await snapshot(p)).state === 'playing');
  },

  async saveAndContinue(t) {
    const p = t.player;
    await startNewGame(p);
    await walkTo(p, SAFEHOUSE, { radius: 1.2, timeoutMs: 15000 });
    await sleep(300);
    let s = await snapshot(p);
    t.check('the safehouse offers a save', /save/i.test(s.help), s.help);
    await p.tap('KeyE');
    await sleep(400);
    t.check('E saves the game', await p.read("Boolean(localStorage.getItem('ondaluz.save.v1'))"));
    await reloadGame(t.session);
    await sleep(500);
    s = await snapshot(p);
    t.check('Continue is offered after a reload', s.titleOpen && !(await p.read("document.querySelector('#start-screen .menu-list button').disabled")));
    await p.clickElement('#start-screen .menu-list button:nth-of-type(1)');
    await sleep(600);
    if (!(await p.read('Boolean(document.pointerLockElement)'))) await p.click();
    await sleep(300);
    s = await snapshot(p);
    t.check('Continue puts Kai at the safehouse', s.state === 'playing' && Math.hypot(s.x - SAFEHOUSE.x, s.z - SAFEHOUSE.z) < 8, `${s.state} ${s.x.toFixed(1)}, ${s.z.toFixed(1)}`);
    const from = s;
    await p.hold('KeyW', 2000);
    s = await snapshot(p);
    t.check('and he can walk away', moved(s, from) > 7, moved(s, from).toFixed(1));
    await p.screenshot('tmp/tests/continue.jpg');
  },
};

async function run() {
  const names = wanted.length ? wanted : Object.keys(TESTS);
  let failures = 0;
  for (const name of names) {
    const test = TESTS[name];
    if (!test) {
      console.log(`unknown test ${name}`);
      failures += 1;
      continue;
    }
    console.log(`\n=== ${name}`);
    const session = await openGame({ headless });
    const results = [];
    const t = {
      session,
      player: session.player,
      check(label, ok, detail = '') {
        results.push(Boolean(ok));
        console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail !== '' && detail !== undefined ? `  (${typeof detail === 'string' ? detail : JSON.stringify(detail)})` : ''}`);
      },
    };
    const started = Date.now();
    try {
      await test(t);
    } catch (error) {
      results.push(false);
      console.log(`  FAIL  crashed: ${error.stack ?? error}`);
    } finally {
      await session.player.releaseAll().catch(() => {});
      if (session.player.errors.length) {
        results.push(false);
        console.log(`  FAIL  page errors: ${session.player.errors.slice(0, 5).join(' | ')}`);
      }
      await session.close();
    }
    const failed = results.filter((ok) => !ok).length;
    failures += failed;
    console.log(`  ${failed ? `${failed} failed` : 'all passed'} in ${((Date.now() - started) / 1000).toFixed(0)} s`);
  }
  console.log(failures ? `\n${failures} check(s) failed` : '\nAll input tests passed');
  process.exitCode = failures ? 1 : 0;
}

run();
