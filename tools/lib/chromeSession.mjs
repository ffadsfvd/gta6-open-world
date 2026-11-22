// Plays the real game in Chrome the way a person does. Starts serve.ts and Chrome with remote
// debugging, then drives the page only through the DevTools Protocol's input domain: trusted
// mouse clicks (so pointer lock is granted), mouse motion, and keys pressed and HELD with the
// browser's own auto-repeat. Page state is only ever READ (Runtime.evaluate) for assertions.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHROME = process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
/** Another checkout to serve instead (for before/after comparisons), e.g. tmp/old. */
const SERVE_ROOT = process.env.GAME_CHECKOUT ? resolve(ROOT, process.env.GAME_CHECKOUT) : ROOT;

export const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function waitForHttp(url, attempts = 100) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      // not up yet
    }
    await sleep(150);
  }
  throw new Error(`Nothing answered at ${url}`);
}

/** A minimal DevTools Protocol client over one target's WebSocket. */
export class Cdp {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = [];
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve: done, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(`${message.error.message} (${message.error.data ?? ''})`));
        else done(message.result);
      } else if (message.method) {
        for (const listener of this.listeners) listener(message);
      }
    });
  }

  open() {
    return new Promise((done, reject) => {
      this.socket.addEventListener('open', done, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((done, reject) => this.pending.set(id, { resolve: done, reject }));
  }

  close() {
    this.socket.close();
  }
}

/** DOM `code` -> what a US keyboard reports for it. */
function keyInfo(code, shift) {
  if (/^Key[A-Z]$/.test(code)) {
    const letter = code[3];
    const text = shift ? letter : letter.toLowerCase();
    return { key: text, vk: letter.charCodeAt(0), text };
  }
  if (/^Digit[0-9]$/.test(code)) return { key: code[5], vk: 48 + Number(code[5]), text: code[5] };
  const table = {
    Space: { key: ' ', vk: 32, text: ' ' },
    Enter: { key: 'Enter', vk: 13, text: '\r' },
    Escape: { key: 'Escape', vk: 27 },
    Tab: { key: 'Tab', vk: 9 },
    Backspace: { key: 'Backspace', vk: 8 },
    ShiftLeft: { key: 'Shift', vk: 16, location: 1 },
    ShiftRight: { key: 'Shift', vk: 16, location: 2 },
    ControlLeft: { key: 'Control', vk: 17, location: 1 },
    AltLeft: { key: 'Alt', vk: 18, location: 1 },
    ArrowUp: { key: 'ArrowUp', vk: 38 },
    ArrowDown: { key: 'ArrowDown', vk: 40 },
    ArrowLeft: { key: 'ArrowLeft', vk: 37 },
    ArrowRight: { key: 'ArrowRight', vk: 39 },
  };
  const info = table[code];
  if (!info) throw new Error(`No key mapping for ${code}`);
  return info;
}

const MODIFIER_BITS = { AltLeft: 1, ControlLeft: 2, ShiftLeft: 8, ShiftRight: 8 };
const BUTTON_BITS = { left: 1, right: 2, middle: 4 };
const REPEAT_DELAY = 500;
const REPEAT_EVERY = 33;

/**
 * One player at the keyboard and mouse of one page. Keys stay down until released, and like a
 * real keyboard the most recently pressed key auto-repeats while it is held.
 */
export class Player {
  constructor(cdp, width, height) {
    this.cdp = cdp;
    this.width = width;
    this.height = height;
    this.held = new Set();
    this.buttons = 0;
    this.mouse = { x: Math.round(width / 2), y: Math.round(height / 2) };
    this.repeatKey = null;
    this.repeatTimer = null;
    this.errors = [];
    this.logs = [];
  }

  get modifiers() {
    let bits = 0;
    for (const code of this.held) bits |= MODIFIER_BITS[code] ?? 0;
    return bits;
  }

  async sendKey(type, code, autoRepeat = false) {
    const shift = (this.modifiers & 8) !== 0;
    const info = keyInfo(code, shift);
    const params = {
      type: type === 'keyUp' ? 'keyUp' : info.text ? 'keyDown' : 'rawKeyDown',
      code,
      key: info.key,
      windowsVirtualKeyCode: info.vk,
      nativeVirtualKeyCode: info.vk,
      modifiers: this.modifiers,
      location: info.location ?? 0,
      autoRepeat,
    };
    if (type !== 'keyUp' && info.text) {
      params.text = info.text;
      params.unmodifiedText = info.text.toLowerCase();
    }
    await this.cdp.send('Input.dispatchKeyEvent', params);
  }

  /** Presses keys and keeps them down (with auto-repeat of the last one). */
  async down(...codes) {
    for (const code of codes) {
      if (this.held.has(code)) continue;
      if (MODIFIER_BITS[code]) this.held.add(code);
      await this.sendKey('keyDown', code);
      this.held.add(code);
      if (!MODIFIER_BITS[code]) this.startRepeat(code);
    }
  }

  async up(...codes) {
    for (const code of codes) {
      if (!this.held.has(code)) continue;
      if (this.repeatKey === code) this.stopRepeat();
      await this.sendKey('keyUp', code);
      this.held.delete(code);
    }
  }

  async releaseAll() {
    await this.up(...[...this.held]);
    for (const button of Object.keys(BUTTON_BITS)) {
      if (this.buttons & BUTTON_BITS[button]) await this.mouseUp(button);
    }
  }

  startRepeat(code) {
    this.stopRepeat();
    this.repeatKey = code;
    const tick = () => {
      if (this.repeatKey !== code || !this.held.has(code)) return;
      this.sendKey('keyDown', code, true).catch(() => {});
      this.repeatTimer = setTimeout(tick, REPEAT_EVERY);
    };
    this.repeatTimer = setTimeout(tick, REPEAT_DELAY);
  }

  stopRepeat() {
    if (this.repeatTimer) clearTimeout(this.repeatTimer);
    this.repeatTimer = null;
    this.repeatKey = null;
  }

  /** A short press, as a finger taps a key. */
  async tap(code, ms = 90) {
    await this.down(code);
    await sleep(ms);
    await this.up(code);
    await sleep(60);
  }

  /** Holds keys for `ms`, then lets go. */
  async hold(codes, ms) {
    const list = Array.isArray(codes) ? codes : [codes];
    await this.down(...list);
    await sleep(ms);
    await this.up(...[...list].reverse());
  }

  async mouseMove(x, y) {
    this.mouse = { x: Math.round(x), y: Math.round(y) };
    await this.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: this.mouse.x, y: this.mouse.y, buttons: this.buttons, modifiers: this.modifiers });
  }

  async mouseDown(button = 'left') {
    this.buttons |= BUTTON_BITS[button];
    await this.cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: this.mouse.x, y: this.mouse.y, button, buttons: this.buttons, clickCount: 1, modifiers: this.modifiers });
  }

  async mouseUp(button = 'left') {
    this.buttons &= ~BUTTON_BITS[button];
    await this.cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: this.mouse.x, y: this.mouse.y, button, buttons: this.buttons, clickCount: 1, modifiers: this.modifiers });
  }

  /** A trusted click at (x, y); defaults to the middle of the window. */
  async click(x = this.width / 2, y = this.height / 2, button = 'left', ms = 70) {
    await this.mouseMove(x, y);
    await this.mouseDown(button);
    await sleep(ms);
    await this.mouseUp(button);
    await sleep(80);
  }

  /** Clicks the centre of the first element matching `selector` (its rectangle is read). */
  async clickElement(selector) {
    const rect = await this.read(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }; })()`);
    if (!rect || rect.w === 0) throw new Error(`Nothing visible to click at ${selector}`);
    await this.click(rect.x, rect.y);
  }

  /** Moves the mouse by (dx, dy) in `steps` small motions (mouse look). */
  async look(dx, dy = 0, steps = 10, ms = 12) {
    for (let step = 0; step < steps; step += 1) {
      const x = this.mouse.x + dx / steps;
      const y = this.mouse.y + dy / steps;
      await this.mouseMove(x, y);
      await sleep(ms);
    }
  }

  /** Reads a value from the page. Never use this to change the game. */
  async read(expression) {
    const result = await this.cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(`read failed: ${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text}`);
    return result.result.value;
  }

  async waitFor(expression, timeoutMs = 15000, everyMs = 100) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (await this.read(expression)) return true;
      await sleep(everyMs);
    }
    return false;
  }

  async screenshot(file, quality = 80) {
    const shot = await this.cdp.send('Page.captureScreenshot', { format: 'jpeg', quality });
    const path = resolve(ROOT, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, Buffer.from(shot.data, 'base64'));
    return path;
  }
}

/**
 * Serves game/, opens Chrome on it and hands back a Player. `headless: false` opens a real
 * window (closest to how people play); the default headless mode still grants pointer lock
 * to trusted clicks when focus is emulated.
 */
export async function openGame({ query = '', headless = true, width = 1280, height = 720, servePort = 8131, debugPort = 9341, profileDir = null } = {}) {
  const server = spawn(process.execPath, [join(SERVE_ROOT, 'serve.ts'), '--port', String(servePort)], { stdio: 'ignore' });
  // A kept profile keeps localStorage, so a later run can Continue a saved game.
  const profile = profileDir ? resolve(ROOT, profileDir) : mkdtempSync(join(tmpdir(), 'game-input-'));
  if (profileDir) mkdirSync(profile, { recursive: true });
  const flags = [
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-features=Translate',
    '--autoplay-policy=no-user-gesture-required',
    '--mute-audio',
    '--ignore-gpu-blocklist',
    '--enable-gpu',
    '--use-angle=d3d11',
  ];
  if (headless) flags.unshift('--headless=new', '--hide-scrollbars');
  const chrome = spawn(CHROME, [...flags, 'about:blank'], { stdio: 'ignore' });
  const close = async () => {
    try {
      if (session.cdp) session.cdp.close();
    } catch {
      // already closed
    }
    chrome.kill();
    server.kill();
    await sleep(600);
    if (profileDir) return;
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      // Chrome may still hold the profile for a moment.
    }
  };
  const session = { close, cdp: null, player: null, debugPort, headless };
  try {
    await waitForHttp(`http://localhost:${servePort}/`);
    await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`);
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    const page = targets.find((target) => target.type === 'page');
    const cdp = new Cdp(page.webSocketDebuggerUrl);
    await cdp.open();
    session.cdp = cdp;
    session.targetId = page.id;
    const player = new Player(cdp, width, height);
    session.player = player;
    cdp.listeners.push((message) => {
      if (message.method === 'Runtime.exceptionThrown') {
        const details = message.params.exceptionDetails;
        player.errors.push(details.exception?.description ?? details.text);
      } else if (message.method === 'Runtime.consoleAPICalled') {
        const text = message.params.args.map((arg) => arg.value ?? arg.description ?? '').join(' ');
        if (message.params.type === 'error') player.errors.push(text);
        player.logs.push(`[${message.params.type}] ${text}`);
      } else if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
        player.errors.push(`${message.params.entry.text} ${message.params.entry.url ?? ''}`);
      }
    });
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Page.enable');
    // A window the player is looking at: without this Chrome refuses pointer lock.
    await cdp.send('Page.bringToFront');
    if (headless) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    } else {
      const size = await player.read('({ w: innerWidth, h: innerHeight })').catch(() => null);
      if (size) {
        player.width = size.w;
        player.height = size.h;
      }
    }
    // Every run starts from a fresh Chrome profile, so there is no save yet.
    session.url = `http://localhost:${servePort}/${query}`;
    await cdp.send('Page.navigate', { url: session.url });
    await sleep(400);
    const ready = await player.waitFor('window.__gameReady === true || window.__shotReady === true', 90000, 250);
    if (!ready) throw new Error('The game never became ready');
    if (!headless) {
      const size = await player.read('({ w: innerWidth, h: innerHeight })');
      player.width = size.w;
      player.height = size.h;
      player.mouse = { x: Math.round(size.w / 2), y: Math.round(size.h / 2) };
    }
    return session;
  } catch (error) {
    await close();
    throw error;
  }
}

/** Reloads the page (same storage) and waits for the game again. */
export async function reloadGame(session) {
  await session.cdp.send('Page.reload', { ignoreCache: true });
  await sleep(500);
  const ready = await session.player.waitFor('window.__gameReady === true', 90000, 250);
  if (!ready) throw new Error('The game never became ready after reload');
}
