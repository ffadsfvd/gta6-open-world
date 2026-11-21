// Frame-time probe run inside the page by take-screenshots.mjs --script: starts a game, drives
// with three stars for a few seconds and reports where the milliseconds go.
const g = window.__game;
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
g.newGame();
g.intro.finish();
const hero = g.player.character;
const car = g.vehicles.spawn('sports', hero.x + 6, hero.z, Math.PI, { role: 'parked' });
g.player.enterVehicle(car);
g.wanted.setLevel(3);
const timing = { update: 0, render: 0, frames: 0 };
const update = g.update.bind(g);
const render = g.render.bind(g);
g.update = (dt) => {
  const t = performance.now();
  update(dt);
  timing.update += performance.now() - t;
};
g.render = (dt) => {
  const t = performance.now();
  render(dt);
  timing.render += performance.now() - t;
  timing.frames += 1;
};
window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
await wait(1500);
timing.update = 0;
timing.render = 0;
timing.frames = 0;
const start = performance.now();
await wait(5000);
const seconds = (performance.now() - start) / 1000;
window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
const info = g.renderer.info;
return {
  fps: +(timing.frames / seconds).toFixed(1),
  updateMs: +(timing.update / timing.frames).toFixed(2),
  renderMs: +(timing.render / timing.frames).toFixed(2),
  drawCalls: info.render.calls,
  triangles: info.render.triangles,
  vehicles: g.vehicles.list.length,
  people: g.characters.list.length,
  gpu: (() => {
    const gl = g.renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
  })(),
};
