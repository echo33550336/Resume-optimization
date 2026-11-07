const http = require('http');
const fs = require('fs');
const path = require('path');

// Optional extractors
let pdfParse = null, mammoth = null, Tesseract = null;
try { pdfParse = require('pdf-parse'); } catch (e) { console.warn('pdf-parse not available'); }
try { mammoth = require('mammoth'); } catch (e) { console.warn('mammoth not available'); }
try { Tesseract = require('tesseract.js'); } catch (e) { console.warn('tesseract.js not available'); }

// Load .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
}

const PORT = parseInt(process.env.PORT || '3000', 10);
const API_KEY = process.env.LLM_API_KEY;
const API_BASE = (process.env.LLM_API_BASE || '').replace(/\/$/, '');
const MODEL = process.env.LLM_MODEL || 'hunyuan-2.0-instruct-20251111';
const MAX_TOKENS = parseInt(process.env.LLM_MAX_TOKENS || '4096', 10);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function serveStatic(req, res) {
  let url = req.url.split('?')[0];
  if (url === '/') url = '/index.html';
  const filePath = path.join(__dirname, 'public', url);
  if (!filePath.startsWith(path.join(__dirname, 'public'))) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not Found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 50 * 1024 * 1024) reject(new Error('too large')); });
    req.on('end', () => resolve(data.replace(/^\uFEFF/, '')));
    req.on('error', reject);
  });
}

async function handleOptimize(req, res) {
  let payload;
  try { payload = JSON.parse(await readBody(req)); }
  catch (e) { return send(res, 400, { error: 'Invalid JSON' }); }

  const { company, position, jd, resume, model } = payload;
  if (!jd || !resume) return send(res, 400, { error: 'jd and resume are required' });

  const useModel = model || MODEL;
  const systemPrompt = `ä½ æ˜¯ä¸€ä½æ‹¥æœ‰ 10 å¹´ç»éªŒçš„äº’è”ç½‘è¡Œä¸š HR æ€»ç›‘ï¼Œæ“…é•¿æ ¹æ®å²—ä½ JD ä¼˜åŒ–æ±‚èŒè€…çš„ç®€åŽ†ã€‚
ä½ çš„ä»»åŠ¡ï¼šåŸºäºŽç›®æ ‡å²—ä½çš„è¦æ±‚ï¼Œå¯¹ç”¨æˆ·ç®€åŽ†è¿›è¡Œæ·±åº¦ä¼˜åŒ–ï¼Œæå‡åŒ¹é…åº¦ä¸Žé€šè¿‡çŽ‡ã€‚

è¾“å‡ºè¦æ±‚ï¼ˆè¯·ä¸¥æ ¼æŒ‰æ­¤ç»“æž„è¾“å‡ºï¼Œä½¿ç”¨ Markdownï¼‰ï¼š

## ä¸€ã€åŒ¹é…åº¦è¯Šæ–­
- ç»™å‡º 0-100 çš„åŒ¹é…åº¦è¯„åˆ†ï¼Œå¹¶ç®€è¦è¯´æ˜Žç†ç”±ï¼ˆ3-5 æ¡ï¼‰ã€‚

## äºŒã€ä¼˜åŒ–åŽçš„ç®€åŽ†
æŒ‰æ ‡å‡†ç®€åŽ†ç»“æž„è¾“å‡ºå®Œæ•´ä¼˜åŒ–ç‰ˆæœ¬ï¼ˆæ•™è‚²èƒŒæ™¯ã€å·¥ä½œ/å®žä¹ ç»åŽ†ã€é¡¹ç›®ç»åŽ†ã€æŠ€èƒ½ã€ä¸ªäººæ€»ç»“ç­‰ï¼‰ï¼Œæ¯æ¡ç»åŽ†ç”¨ STAR æ³•åˆ™é‡å†™ï¼Œé‡åŒ–æˆæžœï¼Œçªå‡ºä¸Ž JD åŒ¹é…çš„å…³é”®è¯ã€‚ä¿ç•™çœŸå®žä¿¡æ¯ï¼Œä¸ç¼–é€ æ•°æ®ï¼›ç¼ºå¤±æ•°æ®ç”¨ [è¯·è¡¥å……å…·ä½“æ•°å­—] å ä½ã€‚

## ä¸‰ã€å…³é”®ä¿®æ”¹è¯´æ˜Ž
åˆ—å‡ºæœ€é‡è¦çš„ 5-8 å¤„ä¿®æ”¹ï¼Œè¯´æ˜Ž"æ”¹äº†ä»€ä¹ˆ + ä¸ºä»€ä¹ˆ"ã€‚

## å››ã€å¾…è¡¥å……/é£Žé™©æç¤º
æŒ‡å‡ºç®€åŽ†ä¸­ç¼ºå¤±æˆ–éœ€è¦ç”¨æˆ·ç¡®è®¤çš„ä¿¡æ¯ã€‚

è¯­æ°”ä¸“ä¸šã€ç›´æŽ¥ã€æœ‰å»ºè®¾æ€§ã€‚ä¸è¦è¾“å‡ºä¸Žç®€åŽ†æ— å…³çš„å†…å®¹ã€‚`;

  const userPrompt = `è¯·å¸®æˆ‘ä¼˜åŒ–ç®€åŽ†ï¼Œæˆ‘çš„ç›®æ ‡å²—ä½æ˜¯ ${company || ''} çš„ ${position || ''}ã€‚

## å²—ä½è¦æ±‚ï¼ˆJDï¼‰
${jd}

## æˆ‘çš„ç®€åŽ†
${resume}`;

  const body = JSON.stringify({
    model: useModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: MAX_TOKENS,
    temperature: 0.7,
    stream: false,
  });

  try {
    const r = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body,
    });
    const text = await r.text();
    if (!r.ok) return send(res, r.status, { error: text });
    const json = JSON.parse(text);
    const content = json?.choices?.[0]?.message?.content || '';
    send(res, 200, { content, model: useModel, usage: json?.usage });
  } catch (e) {
    send(res, 500, { error: String(e) });
  }
}

async function handleExtract(req, res) {
  let payload;
  try { payload = JSON.parse(await readBody(req)); }
  catch (e) { return send(res, 400, { error: 'Invalid JSON' }); }

  const { filename, data } = payload; // data: base64
  if (!data) return send(res, 400, { error: 'No file data' });

  const ext = (filename || '').toLowerCase().split('.').pop();
  const buf = Buffer.from(data, 'base64');

  try {
    if (ext === 'txt' || ext === 'md' || ext === 'csv') {
      return send(res, 200, { text: buf.toString('utf8') });
    }
    if (ext === 'pdf') {
      if (!pdfParse) return send(res, 500, { error: 'pdf-parse not installed' });
      const r = await pdfParse(buf);
      return send(res, 200, { text: r.text || '' });
    }
    if (ext === 'docx') {
      if (!mammoth) return send(res, 500, { error: 'mammoth not installed' });
      const r = await mammoth.extractRawText({ buffer: buf });
      return send(res, 200, { text: r.value || '' });
    }
    if (['png','jpg','jpeg','webp','bmp','tiff'].includes(ext)) {
      if (!Tesseract) return send(res, 500, { error: 'tesseract.js not installed' });
      const { data: { text } } = await Tesseract.recognize(buf, 'chi_sim+eng');
      return send(res, 200, { text: text || '' });
    }
    return send(res, 400, { error: 'Unsupported file type: ' + ext });
  } catch (e) {
    send(res, 500, { error: String(e) });
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.url.startsWith('/api/optimize') && req.method === 'POST') {
    return handleOptimize(req, res);
  }
  if (req.url.startsWith('/api/extract') && req.method === 'POST') {
    return handleExtract(req, res);
  }
  if (req.url === '/api/health') {
    return send(res, 200, { ok: true, model: MODEL, hasKey: !!API_KEY, extractors: { pdf: !!pdfParse, docx: !!mammoth, ocr: !!Tesseract } });
  }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Resume optimizer running at http://localhost:${PORT}`);
  console.log(`Model: ${MODEL} | API: ${API_BASE}`);
  console.log(`Extractors: pdf=${!!pdfParse} docx=${!!mammoth} ocr=${!!Tesseract}`);
});
