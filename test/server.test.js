'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const SERVER = path.join(ROOT, 'server.js');

/** Start an HTTP server on an ephemeral port and resolve with the port. */
function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function closeServer(server) {
  return new Promise((resolve) => server.close(() => resolve(undefined)));
}

/**
 * Minimal chat-completions mock (OpenAI wire format): it echoes back the report language it detected
 * from the system prompt, so the test can assert that `outputLang` reached the model.
 */
function startMockLlm() {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      /** @type {any} */
      let payload;
      try {
        payload = JSON.parse(body || '{}');
      } catch {
        payload = {};
      }
      const messages = Array.isArray(payload.messages) ? payload.messages : [];
      const system = messages.find((message) => message && message.role === 'system');
      const reportLang = /[\u4e00-\u9fff]/.test(String((system && system.content) || '')) ? 'zh' : 'en';
      const answer = `REPORT LANG ${reportLang}`;

      if (payload.stream) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
        for (const chunk of ['REPORT ', 'LANG ', reportLang]) {
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`);
        }
        res.write(
          `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }], usage: { total_tokens: 42 } })}\n\n`
        );
        res.end('data: [DONE]\n\n');
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          choices: [{ message: { role: 'assistant', content: answer } }],
          usage: { total_tokens: 42 },
        })
      );
    });
  });
  return listen(server).then((port) => ({ port, server }));
}

function request(port, method, urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const payload =
      options.body === undefined
        ? undefined
        : typeof options.body === 'string'
          ? options.body
          : JSON.stringify(options.body);
    const headers = { ...(options.headers || {}) };
    if (payload !== undefined) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request({ host: '127.0.0.1', port, method, path: urlPath, headers }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(port, attempts = 60) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await request(port, 'GET', '/api/health');
      if (res.status === 200) return true;
    } catch {
      // not listening yet
    }
    await sleep(100);
  }
  return false;
}

/** Spawn the app on the first free port in a small range; return its handle. */
async function startApp(environment) {
  for (let port = 3400; port < 3460; port++) {
    const child = spawn(process.execPath, [SERVER], {
      cwd: ROOT,
      env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), ...environment },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    if (await waitForHealth(port, 40)) return { child, port, output: () => output };
    child.kill();
  }
  throw new Error('could not start the app on ports 3400-3459');
}

test('server integration', async (t) => {
  const mock = await startMockLlm();
  const app = await startApp({
    LLM_API_KEY: 'test-key',
    LLM_API_BASE: `http://127.0.0.1:${mock.port}`,
    LLM_MODEL: 'mock-model',
    LLM_TIMEOUT_MS: '10000',
    LLM_RETRIES: '0',
  });

  t.after(async () => {
    app.child.kill();
    await closeServer(mock.server);
  });

  await t.test('health exposes languages, limits and extractors', async () => {
    const res = await request(app.port, 'GET', '/api/health');
    assert.equal(res.status, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.ok, true);
    assert.deepEqual(json.langs, ['zh', 'en']);
    assert.deepEqual(json.outputLangs, ['auto', 'zh', 'en']);
    assert.equal(json.streaming, true);
    assert.equal(json.hasKey, true);
    assert.ok(json.limits && json.limits.maxBodyBytes > 0);
    assert.ok(json.extractors, 'health should report available extractors');
    for (const extractor of ['pdf', 'docx', 'ocr']) {
      assert.equal(typeof json.extractors[extractor], 'boolean', `extractors.${extractor} should be boolean`);
    }
  });

  await t.test('unknown API route returns 404 NOT_FOUND', async () => {
    const res = await request(app.port, 'GET', '/api/does-not-exist');
    assert.equal(res.status, 404);
    assert.equal(JSON.parse(res.body).code, 'NOT_FOUND');
  });

  await t.test('wrong method returns 405 METHOD_NOT_ALLOWED', async () => {
    const res = await request(app.port, 'GET', '/api/optimize');
    assert.equal(res.status, 405);
    assert.equal(JSON.parse(res.body).code, 'METHOD_NOT_ALLOWED');
  });

  await t.test('non-streaming optimize honours outputLang', async () => {
    const res = await request(app.port, 'POST', '/api/optimize', {
      body: {
        company: 'Acme',
        position: 'Backend Engineer',
        jd: 'Build services',
        resume: 'I build services',
        roleType: 'tech',
        lang: 'en',
        outputLang: 'zh',
      },
    });
    assert.equal(res.status, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.ok, true);
    assert.equal(json.lang, 'zh', 'report language should follow outputLang');
    assert.equal(json.uiLang, 'en');
    assert.match(json.content, /REPORT LANG zh/);
    assert.equal(json.model, 'mock-model');
  });

  await t.test('streaming optimize emits meta, deltas and done', async () => {
    const res = await request(app.port, 'POST', '/api/optimize', {
      headers: { Accept: 'text/event-stream' },
      body: {
        company: 'Acme',
        position: 'Engineer',
        jd: 'jd',
        resume: 'resume',
        lang: 'en',
        outputLang: 'auto',
        stream: true,
      },
    });
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/event-stream/);
    assert.match(res.body, /event: meta/);
    assert.match(res.body, /"lang":"en"/);
    assert.match(res.body, /"uiLang":"en"/);
    assert.match(res.body, /event: delta/);
    assert.match(res.body, /event: done/);
    const deltas = [...res.body.matchAll(/event: delta\ndata: (\{.*?\})\n/g)]
      .map((match) => JSON.parse(match[1]).content)
      .join('');
    assert.equal(deltas, 'REPORT LANG en');
  });

  await t.test('demo mode replays a canned report without an API key', async () => {
    const res = await request(app.port, 'POST', '/api/optimize', {
      body: {
        company: 'Acme',
        position: 'Engineer',
        jd: 'jd',
        resume: 'resume',
        demo: true,
        lang: 'en',
        outputLang: 'en',
      },
    });
    assert.equal(res.status, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.ok, true);
    assert.equal(json.demo, true);
    assert.equal(json.model, 'demo');
    assert.match(json.content, /Match Diagnosis/);
    assert.ok(!/[\u4e00-\u9fff]/.test(json.content), 'English demo report must not contain CJK');
  });

  await t.test('extract decodes a plain text upload', async () => {
    const text = 'hello from a txt file';
    const res = await request(app.port, 'POST', '/api/extract', {
      body: { filename: 'resume.txt', data: Buffer.from(text, 'utf8').toString('base64') },
    });
    assert.equal(res.status, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.ok, true);
    assert.equal(json.text, text);
    assert.equal(json.meta.ext, 'txt');
  });

  await t.test('path traversal is rejected', async () => {
    const res = await request(app.port, 'GET', '/..%2fpackage.json');
    assert.equal(res.status, 403);
  });
});

test('offline mode works without an API key', async (t) => {
  const app = await startApp({
    LLM_API_KEY: '',
    LLM_API_BASE: 'http://127.0.0.1:9',
    LLM_RETRIES: '0',
    LLM_TIMEOUT_MS: '1500',
  });

  t.after(() => {
    app.child.kill();
  });

  const body = {
    company: 'Acme',
    position: '数据产品经理',
    jd: '负责数据产品规划，熟悉 SQL、Python，有用户增长经验',
    resume: '张三\n工作经历\n负责数据看板建设',
    roleType: 'data',
    lang: 'zh',
  };

  await t.test('health reports offline mode', async () => {
    const res = await request(app.port, 'GET', '/api/health');
    const json = JSON.parse(res.body);
    assert.equal(json.hasKey, false);
    assert.equal(json.mode, 'offline');
    assert.equal(json.offline, true);
  });

  await t.test('non-streaming optimize returns the local report', async () => {
    const res = await request(app.port, 'POST', '/api/optimize', { body });
    assert.equal(res.status, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.ok, true);
    assert.equal(json.offline, true);
    assert.equal(json.model, 'offline');
    assert.match(json.content, /## 一、匹配度诊断/);
    assert.ok(json.signals && typeof json.signals.score === 'number', 'signals should be exposed');
    assert.ok(Array.isArray(json.signals.missing));
  });

  await t.test('streaming optimize streams the offline report', async () => {
    const res = await request(app.port, 'POST', '/api/optimize', {
      headers: { Accept: 'text/event-stream' },
      body: { ...body, stream: true },
    });
    assert.equal(res.status, 200);
    assert.match(res.body, /event: meta/);
    assert.match(res.body, /"offline":true/);
    assert.match(res.body, /event: delta/);
    assert.match(res.body, /event: done/);
    assert.ok(!res.body.includes('event: error'), 'offline stream must not error');
    const text = [...res.body.matchAll(/event: delta\ndata: (\{.*?\})\n/g)]
      .map((match) => JSON.parse(match[1]).content)
      .join('');
    assert.match(text, /匹配度诊断/);
  });
});

test('upstream failure falls back to the offline report', async (t) => {
  const app = await startApp({
    LLM_API_KEY: 'test-key',
    LLM_API_BASE: 'http://127.0.0.1:9',
    LLM_RETRIES: '0',
    LLM_TIMEOUT_MS: '1500',
  });

  t.after(() => {
    app.child.kill();
  });

  const body = {
    company: 'Acme',
    position: 'Backend Engineer',
    jd: 'Build Python services',
    resume: '张三\n项目\n负责服务重构',
    lang: 'zh',
  };

  await t.test('non-streaming returns 200 with a fallback flag', async () => {
    const res = await request(app.port, 'POST', '/api/optimize', { body });
    assert.equal(res.status, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.ok, true);
    assert.equal(json.fallback, true);
    assert.equal(json.offline, true);
    assert.ok(json.warning && json.warning.code, 'the upstream error code should be reported');
    assert.match(json.content, /## 一、匹配度诊断/);
  });

  await t.test('streaming emits a fallback event before the local report', async () => {
    const res = await request(app.port, 'POST', '/api/optimize', {
      headers: { Accept: 'text/event-stream' },
      body: { ...body, stream: true },
    });
    assert.equal(res.status, 200);
    assert.match(res.body, /event: fallback/);
    assert.match(res.body, /event: delta/);
    assert.match(res.body, /"offline":true/);
    assert.ok(!res.body.includes('event: error'), 'a recoverable upstream failure must not stream an error');
  });

  await t.test('offline:true forces the local report even with a key', async () => {
    const res = await request(app.port, 'POST', '/api/optimize', {
      body: { ...body, offline: true },
    });
    const json = JSON.parse(res.body);
    assert.equal(json.offline, true);
    assert.equal(json.fallback, undefined, 'forced offline is not a fallback');
    assert.equal(json.model, 'offline');
  });
});
