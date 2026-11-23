// Takes the entry's screenshots: serves game/ with serve.ts, launches Chrome with remote
// debugging, opens each ?shot= scene from shots.json, waits for window.__shotReady and saves a
// 1280x800 (16:10) JPEG through the DevTools Protocol (Page.captureScreenshot), lowering the
// quality until it is at most about 230 KiB (the gate allows 256 KiB).
//
//   node tools/take-screenshots.mjs                  every shot in shots.json -> screenshots/
//   node tools/take-screenshots.mjs --only 1-cover   one shot of shots.json
//   node tools/take-screenshots.mjs --query "?preview=0,80,200,0,0" --out tmp/preview.jpg
//   GAME_CHECKOUT=tmp/baseline ...                   serve another copy of the game
//
// Console messages and page errors are printed, so the same run doubles as a smoke test.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const serveRoot = process.env.GAME_CHECKOUT ? resolve(root, process.env.GAME_CHECKOUT) : root;
const CHROME = process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SERVE_PORT = 8123;
const DEBUG_PORT = 9333;
const WIDTH = Number(process.env.SHOT_WIDTH) || 1280;
const HEIGHT = Number(process.env.SHOT_HEIGHT) || 800;
const MAX_BYTES = 256 * 1024;
const TARGET_BYTES = 230 * 1024;

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function waitForHttp(url, attempts = 80) {
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

/** A minimal DevTools Protocol client over one page's WebSocket. */
class Cdp {
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
        if (message.error) reject(new Error(message.error.message));
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

/** Width and height from a JPEG's start-of-frame marker. */
function jpegSize(buffer) {
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    offset += 2 + length;
  }
  return null;
}

async function capture(cdp, url, outFile, timeoutMs, evaluate = null) {
  // Clear the flag first so the previous page can never answer for the next one.
  await cdp.send('Runtime.evaluate', { expression: 'window.__shotReady = false' });
  await cdp.send('Page.navigate', { url });
  await sleep(500);
  const started = Date.now();
  let ready = false;
  while (Date.now() - started < timeoutMs) {
    await sleep(300);
    const result = await cdp.send('Runtime.evaluate', { expression: 'window.__shotReady === true || window.__gameReady === true', returnByValue: true });
    if (result.result.value === true) {
      ready = true;
      break;
    }
  }
  if (!ready) throw new Error(`Scene never became ready: ${url}`);
  await sleep(400);
  if (evaluate) {
    const result = await cdp.send('Runtime.evaluate', { expression: evaluate, returnByValue: true });
    console.log(`  eval: ${JSON.stringify(result.result.value ?? result.result.description ?? result.exceptionDetails?.text)}`);
  }
  const script = argument('--script');
  if (script) {
    const body = readFileSync(resolve(root, script), 'utf8');
    const result = await cdp.send('Runtime.evaluate', { expression: `(async () => { ${body}\n })()`, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) console.log(`  script error: ${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text}`);
    else console.log(`  script: ${JSON.stringify(result.result.value, null, 1)}`);
    await sleep(300);
  }
  for (let quality = 92; quality >= 40; quality -= 3) {
    const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality, captureBeyondViewport: false });
    const bytes = Buffer.from(shot.data, 'base64');
    if (bytes.length <= TARGET_BYTES || quality <= 46) {
      mkdirSync(dirname(outFile), { recursive: true });
      writeFileSync(outFile, bytes);
      const size = jpegSize(bytes);
      console.log(`saved ${outFile}: ${size?.width}x${size?.height}, ${(bytes.length / 1024).toFixed(1)} KiB, quality ${quality}, ${((Date.now() - started) / 1000).toFixed(1)} s`);
      return;
    }
  }
}

async function main() {
  const only = argument('--only');
  const query = argument('--query');
  const out = argument('--out');
  const timeoutMs = Number(argument('--timeout') ?? 90000);
  const jobs = [];
  if (query) {
    jobs.push({ name: out ?? 'tmp/preview.jpg', query });
  } else {
    const shots = JSON.parse(readFileSync(join(root, 'shots.json'), 'utf8'));
    for (const shot of shots) {
      if (only && !shot.name.startsWith(only)) continue;
      jobs.push({ name: join('screenshots', shot.name), query: shot.query });
    }
  }

  const server = spawn(process.execPath, [join(serveRoot, 'serve.ts'), '--port', String(SERVE_PORT)], { stdio: 'ignore' });
  const profile = mkdtempSync(join(tmpdir(), 'ondaluz-chrome-'));
  const chrome = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profile}`,
    `--window-size=${WIDTH},${HEIGHT}`,
    '--hide-scrollbars',
    '--mute-audio',
    '--ignore-gpu-blocklist',
    '--enable-gpu',
    '--use-angle=d3d11',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ], { stdio: 'ignore' });

  let cdp = null;
  try {
    await waitForHttp(`http://localhost:${SERVE_PORT}/`);
    await waitForHttp(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
    const targets = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
    const page = targets.find((target) => target.type === 'page');
    cdp = new Cdp(page.webSocketDebuggerUrl);
    await cdp.open();
    cdp.listeners.push((message) => {
      if (message.method === 'Runtime.consoleAPICalled') {
        const text = message.params.args.map((arg) => arg.value ?? arg.description ?? '').join(' ');
        console.log(`  [console.${message.params.type}] ${text}`);
      } else if (message.method === 'Runtime.exceptionThrown') {
        const details = message.params.exceptionDetails;
        console.log(`  [page error] ${details.exception?.description ?? details.text}`);
      } else if (message.method === 'Log.entryAdded' && message.params.entry.level !== 'verbose') {
        console.log(`  [log.${message.params.entry.level}] ${message.params.entry.text} ${message.params.entry.url ?? ''}`);
      }
    });
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
    for (const job of jobs) {
      const url = `http://localhost:${SERVE_PORT}/${job.query}`;
      console.log(`shot ${job.name} <- ${url}`);
      await capture(cdp, url, join(root, job.name), timeoutMs, argument('--eval'));
      const bytes = statSync(join(root, job.name)).size;
      if (bytes > MAX_BYTES) console.log(`  WARNING: ${job.name} is ${bytes} bytes, over 256 KiB`);
    }
  } finally {
    if (cdp) cdp.close();
    chrome.kill();
    server.kill();
    await sleep(500);
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      // Chrome may still hold the profile for a moment.
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
