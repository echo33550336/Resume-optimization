'use strict';

/**
 * 职优简历 · AI 智能优化系统 — zero-framework HTTP server.
 *
 * Improvements over v1:
 *  - LLM calls have a hard timeout, bounded retries and classified errors.
 *  - Streaming (SSE) output so the UI can render the resume while it is generated.
 *  - Request bodies / uploads / prompt text are size-limited and validated.
 *  - CORS is limited to same-origin plus localhost (never `*`), so a random
 *    web page cannot drive this local server with the user's API key.
 *  - Static file serving uses a `path.relative` containment check.
 *  - Prompts live in prompt.js (one source of truth, shared with the Agent Skill).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const {
  buildMessages,
  ROLE_TYPES,
  LANGS,
  OUTPUT_LANGS,
  normalizeLang,
  normalizeOutputLang,
} = require('./prompt');

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

/** Minimal .env loader (KEY=VALUE, `#` comments, optional quotes). */
function loadDotEnv() {
  const envPath = path.join(__dirname, '.env');
  let raw;
  try {
    raw = fs.readFileSync(envPath, 'utf8');
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    if (process.env[key] !== undefined) continue; // real env wins
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
loadDotEnv();

function intEnv(name, fallback, min, max) {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

const PORT = intEnv('PORT', 3000, 1, 65535);
const HOST = (process.env.HOST || '127.0.0.1').trim();
const LLM_API_KEY = (process.env.LLM_API_KEY || '').trim();
const LLM_API_BASE = (process.env.LLM_API_BASE || 'https://tokenhub.tencentmaas.com/v1')
  .trim()
  .replace(/\/+$/, '');
const LLM_MODEL = (process.env.LLM_MODEL || 'hunyuan-2.0-instruct-20251111').trim();
const LLM_MAX_TOKENS = intEnv('LLM_MAX_TOKENS', 4096, 256, 32768);
const LLM_TIMEOUT_MS = intEnv('LLM_TIMEOUT_MS', 120000, 5000, 600000);
const LLM_RETRIES = intEnv('LLM_RETRIES', 2, 0, 5);
const MAX_BODY_BYTES = intEnv('MAX_BODY_BYTES', 20 * 1024 * 1024, 1024, 100 * 1024 * 1024);
const MAX_EXTRACT_BYTES = intEnv('MAX_EXTRACT_BYTES', 20 * 1024 * 1024, 1024, 100 * 1024 * 1024);
const MAX_TEXT_CHARS = intEnv('MAX_TEXT_CHARS', 60000, 1000, 400000);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

// ---------------------------------------------------------------------------
// Optional document extractors (fail soft: the UI still accepts pasted text)
// ---------------------------------------------------------------------------

const extractors = {
  pdf: null,
  docx: null,
  ocr: null,
};

function loadExtractors() {
  try {
    extractors.pdf = require('pdf-parse');
  } catch {
    console.warn('[warn] pdf-parse not installed — PDF upload disabled');
  }
  try {
    extractors.docx = require('mammoth');
  } catch {
    console.warn('[warn] mammoth not installed — DOCX upload disabled');
  }
  try {
    extractors.ocr = require('tesseract.js');
  } catch {
    console.warn('[warn] tesseract.js not installed — image OCR disabled');
  }
}
loadExtractors();

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

/** Strip the API key out of anything we echo back to the client. */
function sanitize(message) {
  const text = String(message ?? '');
  if (!LLM_API_KEY) return text;
  return text.split(LLM_API_KEY).join('***');
}

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
    /** Whether the LLM call that produced this error may be retried. */
    this.retryable = true;
  }
}

function securityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
}

function isLocalOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  try {
    const url = new URL(origin);
    return (
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' ||
        url.hostname === '127.0.0.1' ||
        url.hostname === '[::1]' ||
        url.hostname === '::1')
    );
  } catch {
    return false;
  }
}

function corsHeaders(req) {
  const origin = req.headers.origin;
  if (!origin) return { Vary: 'Origin' };
  if (!isLocalOrigin(origin)) return { Vary: 'Origin' };
  return {
    Vary: 'Origin',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
  };
}

function sendJson(req, res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  /** @type {Record<string, string | number>} */
  const headers = {
    ...securityHeaders(),
    ...corsHeaders(req),
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
  };
  if (status === 413) headers.Connection = 'close';
  if (res.headersSent || res.destroyed) return;
  res.writeHead(status, headers);
  res.end(body);
}

function sendError(req, res, err) {
  const status = err instanceof HttpError ? err.status : 500;
  const code = err instanceof HttpError ? err.code : 'INTERNAL';
  const message = sanitize(err && err.message ? err.message : 'unknown error');
  if (status >= 500) log('[error]', code, message);
  sendJson(req, res, status, { ok: false, code, error: message });
}

/** Read and parse a JSON body with a hard size cap. */
function readJsonBody(req, limitBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    let settled = false;

    const fail = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    req.on('data', (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > limitBytes) {
        fail(new HttpError(413, 'BODY_TOO_LARGE', `请求体超过 ${limitBytes} 字节上限`));
        // Drain the remaining request so the 413 response can still be delivered.
        req.resume();
        return;
      }
      chunks.push(chunk);
    });
    req.on('error', (err) => fail(new HttpError(400, 'REQUEST_ABORTED', err.message)));
    req.on('end', () => {
      if (settled) return;
      settled = true;
      if (size === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, 'INVALID_JSON', '请求体不是合法 JSON'));
      }
    });
  });
}

function requireString(value, field, { max = MAX_TEXT_CHARS, min = 1 } = {}) {
  if (typeof value !== 'string') {
    throw new HttpError(400, 'INVALID_REQUEST', `缺少字段 ${field}`);
  }
  const text = value.trim();
  if (text.length < min) {
    throw new HttpError(400, 'INVALID_REQUEST', `字段 ${field} 不能为空`);
  }
  if (text.length > max) {
    throw new HttpError(400, 'TEXT_TOO_LONG', `字段 ${field} 超过 ${max} 字符上限`);
  }
  return text;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// LLM client
// ---------------------------------------------------------------------------

function llmUrl(pathname) {
  return `${LLM_API_BASE}${pathname}`;
}

function llmHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${LLM_API_KEY}`,
  };
}

/** Create an AbortController that fires after `ms`, linked to the client connection. */
function linkAbort(ms, clientRes) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('LLM_TIMEOUT')), ms);
  const onClose = () => controller.abort(new Error('CLIENT_CLOSED'));
  if (clientRes && typeof clientRes.on === 'function') clientRes.on('close', onClose);
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timer);
      if (clientRes && typeof clientRes.removeListener === 'function') {
        clientRes.removeListener('close', onClose);
      }
    },
  };
}

function isAbortReason(err, reason) {
  if (!err) return false;
  if (err.name === 'AbortError') return true;
  return typeof err.message === 'string' && err.message.includes(reason);
}

function isRetryable(err, status) {
  if (status === 429 || (status >= 500 && status <= 599)) return true;
  if (status) return false;
  // Network / DNS / timeout before any response.
  return true;
}

async function callLlmOnce({ messages, model, stream, clientRes, onChunk }) {
  const link = linkAbort(LLM_TIMEOUT_MS, clientRes);
  let response;
  try {
    response = await fetch(llmUrl('/chat/completions'), {
      method: 'POST',
      headers: llmHeaders(),
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: LLM_MAX_TOKENS,
        stream: Boolean(stream),
      }),
      signal: link.signal,
    });
  } catch (err) {
    link.dispose();
    if (isAbortReason(err, 'CLIENT_CLOSED')) {
      throw new HttpError(499, 'CLIENT_CLOSED', '客户端已断开连接');
    }
    if (isAbortReason(err, 'LLM_TIMEOUT')) {
      throw new HttpError(504, 'UPSTREAM_TIMEOUT', `模型服务 ${Math.round(LLM_TIMEOUT_MS / 1000)}s 内无响应`);
    }
    throw new HttpError(502, 'UPSTREAM_NETWORK', `无法连接模型服务：${err.message}`);
  }

  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    link.dispose();
    let detail = raw;
    try {
      const parsed = JSON.parse(raw);
      detail = parsed.error?.message || parsed.message || raw;
    } catch {
      /* keep raw */
    }
    const err = new HttpError(
      response.status === 429 ? 429 : 502,
      response.status === 429 ? 'UPSTREAM_RATE_LIMITED' : 'UPSTREAM_ERROR',
      `模型服务返回 ${response.status}：${sanitize(String(detail).slice(0, 500))}`
    );
    err.retryable = isRetryable(null, response.status);
    throw err;
  }

  if (!stream) {
    try {
      const payload = await response.json();
      link.dispose();
      const content = payload?.choices?.[0]?.message?.content;
      if (!content || typeof content !== 'string') {
        throw new HttpError(502, 'UPSTREAM_EMPTY', '模型返回内容为空');
      }
      return { content, usage: payload.usage || null };
    } catch (err) {
      link.dispose();
      if (err instanceof HttpError) throw err;
      throw new HttpError(502, 'UPSTREAM_INVALID', `模型返回格式异常：${err.message}`);
    }
  }

  // ----- streaming -----
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let content = '';
  let usage = null;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index;
      while ((index = buffer.indexOf('\n\n')) >= 0) {
        const event = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        for (const line of event.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (!data || data === '[DONE]') continue;
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            continue;
          }
          if (parsed.usage) usage = parsed.usage;
          const delta = parsed?.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta.length > 0) {
            content += delta;
            if (onChunk) onChunk(delta);
          }
        }
      }
    }
  } catch (err) {
    if (isAbortReason(err, 'CLIENT_CLOSED')) {
      throw new HttpError(499, 'CLIENT_CLOSED', '客户端已断开连接');
    }
    if (isAbortReason(err, 'LLM_TIMEOUT')) {
      throw new HttpError(504, 'UPSTREAM_TIMEOUT', '生成过程中连接超时');
    }
    throw new HttpError(502, 'UPSTREAM_STREAM_ERROR', `流式读取失败：${err.message}`);
  } finally {
    link.dispose();
  }
  return { content, usage };
}

async function callLlm({ messages, model, stream, clientRes, onChunk = null }) {
  let lastError = null;
  let emitted = false;
  const attempts = LLM_RETRIES + 1;
  const wrappedOnChunk = (delta) => {
    emitted = true;
    if (onChunk) onChunk(delta);
  };
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await callLlmOnce({
        messages,
        model,
        stream,
        clientRes,
        onChunk: wrappedOnChunk,
      });
    } catch (err) {
      lastError = err;
      const clientGone = err instanceof HttpError && err.code === 'CLIENT_CLOSED';
      // Never retry once part of the stream reached the client (would duplicate text).
      const retryable = !clientGone && !emitted && err.retryable !== false;
      if (!retryable || attempt === attempts) break;
      const backoff = 300 * 2 ** (attempt - 1) + Math.floor(Math.random() * 200);
      log('[warn] LLM attempt', attempt, 'failed:', sanitize(err.message), `retry in ${backoff}ms`);
      await sleep(backoff);
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleHealth(req, res) {
  sendJson(req, res, 200, {
    ok: true,
    model: LLM_MODEL,
    hasKey: Boolean(LLM_API_KEY),
    streaming: true,
    roleTypes: ROLE_TYPES,
    langs: LANGS,
    outputLangs: OUTPUT_LANGS,
    extractors: {
      pdf: Boolean(extractors.pdf),
      docx: Boolean(extractors.docx),
      ocr: Boolean(extractors.ocr),
    },
    limits: {
      maxBodyBytes: MAX_BODY_BYTES,
      maxExtractBytes: MAX_EXTRACT_BYTES,
      maxTextChars: MAX_TEXT_CHARS,
      llmTimeoutMs: LLM_TIMEOUT_MS,
    },
  });
}

const EXT_BY_MIME = {
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/csv': 'csv',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
};

const TEXT_EXTS = new Set(['txt', 'md', 'markdown', 'csv']);
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'tif']);

async function extractFromFile(filename, buffer, ext) {
  if (TEXT_EXTS.has(ext)) {
    return buffer.toString('utf8');
  }
  if (ext === 'pdf') {
    if (!extractors.pdf) {
      throw new HttpError(503, 'EXTRACTOR_UNAVAILABLE', 'PDF 解析依赖未安装（npm install）');
    }
    const parsed = await extractors.pdf(buffer);
    return parsed.text || '';
  }
  if (ext === 'docx') {
    if (!extractors.docx) {
      throw new HttpError(503, 'EXTRACTOR_UNAVAILABLE', 'DOCX 解析依赖未安装（npm install）');
    }
    const result = await extractors.docx.extractRawText({ buffer });
    return result.value || '';
  }
  if (IMAGE_EXTS.has(ext)) {
    if (!extractors.ocr) {
      throw new HttpError(503, 'EXTRACTOR_UNAVAILABLE', '图片 OCR 依赖未安装（npm install）');
    }
    const result = await extractors.ocr.recognize(buffer, 'chi_sim+eng');
    return result?.data?.text || '';
  }
  throw new HttpError(415, 'UNSUPPORTED_TYPE', `不支持的文件类型：${ext || 'unknown'}`);
}

async function handleExtract(req, res) {
  const body = await readJsonBody(req, MAX_BODY_BYTES);
  const filename = requireString(body.filename, 'filename', { max: 260 });
  const raw = requireString(body.data, 'data', { max: MAX_BODY_BYTES });
  const base64 = raw.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');

  let buffer;
  try {
    buffer = Buffer.from(base64, 'base64');
  } catch {
    throw new HttpError(400, 'INVALID_BASE64', '文件内容不是合法的 base64');
  }
  if (buffer.length === 0) {
    throw new HttpError(400, 'INVALID_BASE64', '文件内容为空');
  }
  if (buffer.length > MAX_EXTRACT_BYTES) {
    throw new HttpError(
      413,
      'FILE_TOO_LARGE',
      `文件超过 ${Math.round(MAX_EXTRACT_BYTES / 1024 / 1024)}MB 上限`
    );
  }

  let ext = path.extname(filename).slice(1).toLowerCase();
  if (!ext) ext = EXT_BY_MIME[String(body.mime || '').toLowerCase()] || '';

  const started = Date.now();
  const text = await extractFromFile(filename, buffer, ext);
  const cleaned = String(text)
    // eslint-disable-next-line no-control-regex -- NUL bytes come from binary-ish uploads
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!cleaned) {
    throw new HttpError(422, 'EXTRACT_EMPTY', '未能从文件中提取到文本（可能是扫描件或空文件）');
  }
  if (cleaned.length > MAX_TEXT_CHARS) {
    throw new HttpError(413, 'TEXT_TOO_LONG', `提取文本超过 ${MAX_TEXT_CHARS} 字符上限`);
  }

  log('[extract]', filename, `${buffer.length}B → ${cleaned.length} chars`, `${Date.now() - started}ms`);
  sendJson(req, res, 200, {
    ok: true,
    text: cleaned,
    meta: { filename, ext, bytes: buffer.length, chars: cleaned.length, elapsedMs: Date.now() - started },
  });
}

function normalizeOptimizeInput(body) {
  const jd = requireString(body.jd, 'jd');
  const resume = requireString(body.resume, 'resume');
  const company = typeof body.company === 'string' ? body.company.trim().slice(0, 120) : '';
  const position = typeof body.position === 'string' ? body.position.trim().slice(0, 120) : '';
  const roleType = ROLE_TYPES.includes(body.roleType) ? body.roleType : 'general';
  // `lang` is the UI language; `outputLang` decides what the model writes (`auto` = follow the UI).
  const uiLang = normalizeLang(typeof body.lang === 'string' ? body.lang.trim().toLowerCase() : '');
  const outputLang = normalizeOutputLang(
    typeof body.outputLang === 'string' ? body.outputLang.trim().toLowerCase() : '',
    uiLang
  );
  const model =
    typeof body.model === 'string' && body.model.trim().length > 0 && body.model.trim().length <= 120
      ? body.model.trim()
      : LLM_MODEL;
  return { company, position, jd, resume, roleType, lang: outputLang, uiLang, model };
}

async function handleOptimize(req, res) {
  const body = await readJsonBody(req, MAX_BODY_BYTES);
  const input = normalizeOptimizeInput(body);

  if (!LLM_API_KEY) {
    throw new HttpError(503, 'NO_API_KEY', '服务端未配置 LLM_API_KEY，请编辑 .env 后重启服务');
  }

  const wantsStream = body.stream === true || String(req.headers.accept || '').includes('text/event-stream');

  const messages = buildMessages(input);
  const started = Date.now();

  if (!wantsStream) {
    const { content, usage } = await callLlm({ messages, model: input.model, stream: false, clientRes: res });
    sendJson(req, res, 200, {
      ok: true,
      content,
      model: input.model,
      lang: input.lang,
      uiLang: input.uiLang,
      usage,
      elapsedMs: Date.now() - started,
    });
    return;
  }

  // ----- Server-Sent Events -----
  res.writeHead(200, {
    ...securityHeaders(),
    ...corsHeaders(req),
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  let closed = false;
  const sendEvent = (event, data) => {
    if (closed || res.writableEnded || res.destroyed) return;
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      closed = true;
    }
  };

  res.on('close', () => {
    closed = true;
  });

  sendEvent('meta', {
    model: input.model,
    roleType: input.roleType,
    lang: input.lang,
    uiLang: input.uiLang,
    startedAt: new Date().toISOString(),
  });

  // Heartbeat keeps proxies / browsers from timing the connection out.
  const heartbeat = setInterval(() => {
    if (closed || res.writableEnded) return;
    try {
      res.write(': ping\n\n');
    } catch {
      closed = true;
    }
  }, 15000);

  try {
    const { content, usage } = await callLlm({
      messages,
      model: input.model,
      stream: true,
      clientRes: res,
      onChunk: (delta) => sendEvent('delta', { content: delta }),
    });
    sendEvent('done', {
      model: input.model,
      usage: usage || null,
      chars: content.length,
      elapsedMs: Date.now() - started,
    });
  } catch (err) {
    sendEvent('error', {
      code: err instanceof HttpError ? err.code : 'INTERNAL',
      error: sanitize(err.message || 'unknown error'),
    });
  } finally {
    clearInterval(heartbeat);
    if (!res.writableEnded) res.end();
  }
}

// ---------------------------------------------------------------------------
// Static files
// ---------------------------------------------------------------------------

function serveStatic(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400, { ...securityHeaders(), 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }
  if (pathname === '/' || pathname === '') pathname = '/index.html';

  const filePath = path.join(PUBLIC_DIR, pathname);
  const relative = path.relative(PUBLIC_DIR, filePath);
  const inside = relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
  const segments = relative.split(path.sep);
  if (!inside || segments.some((segment) => segment.startsWith('.'))) {
    res.writeHead(403, { ...securityHeaders(), 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (statErr, stat) => {
    if (statErr || !stat.isFile()) {
      res.writeHead(404, { ...securityHeaders(), 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const isDocument = ext === '.html';
    res.writeHead(200, {
      ...securityHeaders(),
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': isDocument ? 'no-store' : 'public, max-age=3600',
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      if (!res.writableEnded) res.destroy();
    });
    stream.pipe(res);
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

async function router(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { ...securityHeaders(), ...corsHeaders(req) });
    res.end();
    return;
  }

  if (pathname.startsWith('/api/')) {
    if (pathname === '/api/health') {
      if (req.method !== 'GET') throw new HttpError(405, 'METHOD_NOT_ALLOWED', '仅支持 GET');
      await handleHealth(req, res);
      return;
    }
    if (pathname === '/api/extract') {
      if (req.method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED', '仅支持 POST');
      await handleExtract(req, res);
      return;
    }
    if (pathname === '/api/optimize') {
      if (req.method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED', '仅支持 POST');
      await handleOptimize(req, res);
      return;
    }
    throw new HttpError(404, 'NOT_FOUND', `未知接口：${pathname}`);
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    throw new HttpError(405, 'METHOD_NOT_ALLOWED', '仅支持 GET');
  }
  serveStatic(req, res);
}

const server = http.createServer((req, res) => {
  const started = Date.now();
  res.on('finish', () => {
    if (req.url && !req.url.startsWith('/api/')) return; // keep static logs quiet
    log('[http]', req.method, req.url, res.statusCode, `${Date.now() - started}ms`);
  });
  router(req, res).catch((err) => {
    if (res.headersSent) {
      if (!res.writableEnded) res.end();
      return;
    }
    sendError(req, res, err);
  });
});

server.on('clientError', (err, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.listen(PORT, HOST, () => {
  log(`resume-optimizer listening on http://${HOST}:${PORT}`);
  log(`LLM: ${LLM_MODEL} @ ${LLM_API_BASE}${LLM_API_KEY ? '' : ' (no API key configured)'}`);
  const missing = Object.entries(extractors)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) log(`extractors unavailable: ${missing.join(', ')} (run npm install)`);
});

function shutdown(signal) {
  log(`received ${signal}, shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => log('[fatal] uncaughtException', err));
process.on('unhandledRejection', (err) => log('[fatal] unhandledRejection', err));
