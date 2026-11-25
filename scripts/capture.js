#!/usr/bin/env node
/**
 * Capture README screenshots and demo GIF frames from a running app.
 *
 * Usage:
 *   node server.js          # in another terminal (demo mode works without a key)
 *   node scripts/capture.js --base http://127.0.0.1:3000 --out docs/assets
 *
 * Requires a Chrome/Edge binary. Uses the DevTools protocol over the built-in
 * WebSocket client (Node >= 22), so there are no dev dependencies.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = argOf('base', 'http://127.0.0.1:3000');
const OUT = path.resolve(argOf('out', 'docs/assets'));
const FRAMES = path.resolve(argOf('frames', path.join(OUT, 'frames')));
const WIDTH = 1280;
const HEIGHT = 800;
const BROWSERS = [
  process.env.CHROME_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findBrowser() {
  for (const candidate of BROWSERS) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('No Chrome/Edge found. Set CHROME_PATH.');
}

async function cdpTarget(port) {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // browser still starting
    }
    await sleep(250);
  }
  throw new Error('DevTools endpoint never became available');
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  let id = 0;
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  return new Promise((resolve) =>
    ws.addEventListener('open', () => resolve({ send, close: () => ws.close() }))
  );
}

async function main() {
  fs.mkdirSync(FRAMES, { recursive: true });
  const browser = findBrowser();
  const port = 9300 + Math.floor(Math.random() * 400);
  const profile = path.join(require('os').tmpdir(), 'resume-capture-' + Date.now());
  const proc = spawn(
    browser,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      `--window-size=${WIDTH},${HEIGHT}`,
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  let client;
  const shot = async (name, extra = {}) => {
    const { data } = await client.send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      ...extra,
    });
    fs.writeFileSync(path.join(OUT, name), Buffer.from(data, 'base64'));
    return name;
  };
  const evaluate = async (expression) => {
    const res = await client.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails)
      throw new Error(res.exceptionDetails.text + ' ' + (res.exceptionDetails.exception?.description || ''));
    return res.result && res.result.value;
  };

  const frameMeta = [];
  const captureFrame = async (label) => {
    const name = `f${String(frameMeta.length).padStart(3, '0')}.png`;
    await shot(path.join('frames', name));
    frameMeta.push({ file: name, t: Date.now(), label: label || '' });
    return name;
  };

  try {
    client = await connect(await cdpTarget(port));
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: 1,
      mobile: false,
    });

    // 1) landing page
    await client.send('Page.navigate', { url: BASE + '/' });
    await sleep(1200);
    // wait until the app script has executed (page globals become available)
    const tw = Date.now();
    let ready = false;
    while (Date.now() - tw < 15000) {
      ready = await evaluate("typeof showView === 'function' && typeof RI18N !== 'undefined'");
      if (ready) break;
      await sleep(250);
    }
    if (!ready) throw new Error('app globals never became available');
    await sleep(800); // hero demo boot + health fetch settle
    await evaluate(
      "document.getElementById('health') && (document.getElementById('health').textContent = '\\u25cf demo ready')"
    );
    await shot('screenshot-landing.png');
    await captureFrame('landing');
    await sleep(200);
    await captureFrame('landing');

    // 2) optimizer form pre-filled with the built-in example
    await evaluate("showView('optimizer'); fillDemoForm();");
    await sleep(400);
    await shot('screenshot-form.png');
    await captureFrame('form');
    await sleep(150);
    await captureFrame('form');

    // 3) demo run: capture frames while the canned report streams in.
    // Do not await runOptimize(): it resolves only when the stream ends.
    await evaluate('(runOptimize(true), 0)');
    await sleep(250);
    await evaluate("document.querySelector('.result').scrollIntoView({ block: 'start' })");
    const t0 = Date.now();
    let started = false;
    while (Date.now() - t0 < 20000) {
      const streaming = await evaluate("!document.getElementById('stopBtn').disabled");
      if (streaming) started = true;
      if (started) await captureFrame('stream');
      if (started && !streaming) break;
      await sleep(60);
    }
    // 4) settle a moment, then the final result screenshots
    await sleep(300);
    await evaluate("document.querySelector('.result').scrollIntoView({ block: 'start' })");
    await shot('screenshot-result.png');
    await captureFrame('done');

    // 5) Chinese result screenshot for README.zh-CN.md
    await evaluate("RI18N.setLang('zh'); showView('optimizer');");
    await sleep(400);
    await evaluate('(runOptimize(true), 0)');
    await sleep(6500);
    await evaluate("document.querySelector('.result').scrollIntoView({ block: 'start' })");
    await sleep(400);
    await shot('screenshot-result-zh.png');
    fs.writeFileSync(path.join(FRAMES, 'frames.json'), JSON.stringify(frameMeta, null, 2));
    console.log(`captured ${frameMeta.length} frames -> ${FRAMES}`);
  } finally {
    if (client) client.close();
    proc.kill();
    await sleep(300);
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('capture failed:', err.message);
  process.exit(1);
});
