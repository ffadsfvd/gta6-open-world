// Regression tests that play the game only through real input: trusted clicks, mouse motion
// and held keys sent by the DevTools Protocol, exactly as a person at the keyboard would. Game
// state is only read, to check what the input did. Screenshots of each test go to tmp/tests/.
//   node tools/input-tests.mjs                 every test
//   node tools/input-tests.mjs drive wasted    some of them
//   node tools/input-tests.mjs --headful       in a visible Chrome window
import { openGame, reloadGame, sleep } from './lib/chromeSession.mjs';
import { snapshot, walkTo, driveTo, nearestCar, carById, nearestPerson, punchOut, startNewGame, stealCar } from './lib/playerBot.mjs';
import { driveRoute, walkRoute } from './lib/navigator.mjs';

const headless = !process.argv.includes('--headful');
const wanted = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const moved = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** Walks a fixed distance from the start to the safehouse door and back is too long; this is near. */
const SAFEHOUSE = { x: 231, z: 40 };

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
      if (s.car.ai) break;
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
    while (Date.now() - started < 90000) {
      s = await snapshot(p);
      if (s.fate || !s.alive) break;
      if (!s.inCar) {
        await stealCar(p);
        continue;
      }
      await driveTo(p, wall, { radius: 1, timeoutMs: 3500, cruise: 40 });
      await p.hold('KeyW', 800);
      await p.hold('KeyS', 1700);
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
