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

const ROLE_FOCUS = {
  tech: '技术岗位：重点突出技术栈深度、系统架构、性能优化、代码质量、开源/项目贡献；用技术指标量化。',
  product: '产品岗位：重点突出产品规划、用户研究、数据分析、跨团队协作、0-1 经验与商业结果。',
  ops: '运营岗位：重点突出增长策略、活动策划、用户运营、留存/转化、ROI 与数据驱动。',
  design: '设计岗位：重点突出设计作品、用户体验、设计系统、交互流程与落地效果。',
  marketing: '市场岗位：重点突出品牌建设、渠道增长、内容营销、投放 ROI 与市场洞察。',
  data: '数据岗位：重点突出数据分析、建模、可视化、A/B 实验与业务洞察。',
  general: '通用岗位：根据 JD 要求灵活调整，突出匹配度最高的经历。',
};

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

  const { company, position, jd, resume, model, roleType } = payload;
  if (!jd || !resume) return send(res, 400, { error: 'jd and resume are required' });

  const focus = ROLE_FOCUS[roleType || 'general'] || ROLE_FOCUS.general;
  const useModel = model || MODEL;
  const systemPrompt = '你是一位拥有 10 年经验的互联网行业 HR 总监，擅长根据岗位 JD 优化求职者的简历。\n' +
    '你的任务：基于目标岗位的要求，对用户简历进行深度优化，提升匹配度与通过率。\n\n' +
    '岗位类型关注点：' + focus + '\n\n' +
    '输出要求（请严格按此结构输出，使用 Markdown）：\n\n' +
    '## 一、匹配度诊断\n- 给出 0-100 的匹配度评分，并简要说明理由（3-5 条）。\n\n' +
    '## 二、优化后的简历\n按标准简历结构输出完整优化版本（教育背景、工作/实习经历、项目经历、技能、个人总结等），每条经历用 STAR 法则重写，量化成果，突出与 JD 匹配的关键词。保留真实信息，不编造数据；缺失数据用 [请补充具体数字] 占位。\n\n' +
    '## 三、关键修改说明\n列出最重要的 5-8 处修改，说明"改了什么 + 为什么"。\n\n' +
    '## 四、待补充/风险提示\n指出简历中缺失或需要用户确认的信息。\n\n' +
    '语气专业、直接、有建设性。不要输出与简历无关的内容。';

  const userPrompt = '请帮我优化简历，我的目标岗位是 ' + (company || '') + ' 的 ' + (position || '') + '。\n\n## 岗位要求（JD）\n' + jd + '\n\n## 我的简历\n' + resume;

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
    const r = await fetch(API_BASE + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + API_KEY,
      },
      body,
    });
    const text = await r.text();
    if (!r.ok) return send(res, r.status, { error: text });
    const json = JSON.parse(text);
    const content = json && json.choices && json.choices[0] && json.choices[0].message ? json.choices[0].message.content : '';
    send(res, 200, { content: content, model: useModel, usage: json && json.usage });
  } catch (e) {
    send(res, 500, { error: String(e) });
  }
}

async function handleExtract(req, res) {
  let payload;
  try { payload = JSON.parse(await readBody(req)); }
  catch (e) { return send(res, 400, { error: 'Invalid JSON' }); }

  const { filename, data } = payload;
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
  console.log('Resume optimizer running at http://localhost:' + PORT);
  console.log('Model: ' + MODEL + ' | API: ' + API_BASE);
  console.log('Extractors: pdf=' + !!pdfParse + ' docx=' + !!mammoth + ' ocr=' + !!Tesseract);
});