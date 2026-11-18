/*
 * UI localisation for Resume Optimizer.
 *
 * - Chinese lives in the HTML as the source language (so the page works with JS disabled).
 * - English strings live here.
 * - Elements marked with data-i18n / data-i18n-placeholder / data-i18n-title /
 *   data-i18n-aria-label / data-i18n-alt get translated in place; switching back to
 *   Chinese restores the snapshot taken at load time.
 * - Dynamic strings (status line, toasts, error map) go through RI18N.t('key', vars).
 *
 * Adding a language = add an entry to LANGS and a dictionary with the same keys.
 */
(function () {
  'use strict';

  const LANGS = [
    { code: 'zh', label: '中文', htmlLang: 'zh-CN' },
    { code: 'en', label: 'English', htmlLang: 'en' },
  ];

  const STORAGE_KEY = 'resume-optimizer-lang';

  const EN = {
    // shell
    'app.title': 'Resume Optimizer · AI resume tailoring',
    'nav.home': 'Home',
    'nav.optimizer': 'Optimize',
    'health.checking': '● Checking…',
    'aria.settings': 'Appearance settings',
    'aria.logo': 'Resume Optimizer',
    'aria.lang': 'Language',

    // hero
    'hero.title': 'Make your resume <span class="hl">precisely match</span> the role',
    'hero.lead':
      'Paste a job description and your resume. An AI acting as a 10-year HR director returns a match diagnosis, a rewritten resume, key change notes and open questions. Three minutes to a stronger application.',
    'hero.cta.optimize': 'Start optimizing',
    'hero.cta.example': 'See an example',

    // landing sections
    'section.core.title': 'What it does',
    'section.core.body': 'The full path from diagnosis to a ready-to-send resume',
    'feat.jd.title': 'JD-aware targeting',
    'feat.jd.body':
      'Deep analysis of the role: every bullet highlights the experience and keywords the JD is really asking for.',
    'feat.star.title': 'STAR rewrites',
    'feat.star.body':
      'Each role is rebuilt as Situation-Task-Action-Result with quantified outcomes instead of vague claims.',
    'feat.score.title': 'Match score',
    'feat.score.body': 'A 0–100 diagnosis with concrete reasons behind the number.',
    'feat.theme.title': 'Themeable',
    'feat.theme.body': 'Gold, amber or dark; pick a font and a background that suits you.',
    'feat.speed.title': 'Seconds, not minutes',
    'feat.speed.body': 'Streamed from an LLM — the first section shows up while the rest is still generating.',
    'feat.privacy.title': 'Private by design',
    'feat.privacy.body': 'Your resume travels only between this machine and the model you configure. Nothing is stored.',

    'section.tech.title': 'Stack',
    'section.tech.body': 'Zero-framework backend plus pluggable document extraction',
    'tech.node.name': 'Node.js',
    'tech.node.body': 'Native http, no framework',
    'tech.hunyuan.name': 'Hunyuan 2.0',
    'tech.hunyuan.body': 'Tencent Hunyuan LLM',
    'tech.pdf.name': 'pdf-parse',
    'tech.pdf.body': 'PDF text extraction',
    'tech.docx.name': 'mammoth',
    'tech.docx.body': 'DOCX text extraction',
    'tech.ocr.name': 'Tesseract.js',
    'tech.ocr.body': 'Image OCR (Chinese + English)',
    'tech.vanilla.name': 'Vanilla HTML/CSS/JS',
    'tech.vanilla.body': 'No frontend framework, lightweight',
    'tech.md.name': 'Markdown',
    'tech.md.body': 'Structured result rendering',
    'tech.theme.name': 'Theme system',
    'tech.theme.body': 'Gold, font and background switcher',

    'section.hl.title': 'Highlights',
    'section.hl.body': 'Not just wording — a systematic rewrite for the target role',
    'hl.match.title': 'Match diagnosis',
    'hl.match.body': 'A quantified 0–100 score with the exact gaps, so you know what to fix first.',
    'hl.star.title': 'STAR rewrites',
    'hl.star.body': 'Every experience rebuilt as Situation-Task-Action-Result with measurable results.',
    'hl.formats.title': 'Multi-format input',
    'hl.formats.body': 'Paste text or upload PDF / Word / images; the text is extracted automatically.',
    'hl.privacy.title': 'Private by design',
    'hl.privacy.body': 'Sent only between you and the model — never written to a database.',

    'steps.title': 'Three steps to a better resume',
    'step1.title': 'Paste the JD',
    'step1.body': 'Add the role and its requirements',
    'step2.title': 'Paste your resume',
    'step2.body': 'Add your complete resume text',
    'step3.title': 'Optimize',
    'step3.body': 'The AI rewrites it against the JD',
    'step4.title': 'Copy & apply',
    'step4.body': 'Copy the result and send it out',

    // optimizer
    'opt.target.title': 'Target role',
    'label.company': 'Company',
    'label.position': 'Role title',
    'label.jd': 'Job description (JD)',
    'label.resume': 'Resume',
    'label.roleType': 'Job family',
    'label.model': 'Model',
    'label.outputLang': 'Report language',
    'label.action': 'Action',
    'placeholder.company': 'e.g. Acme Corp',
    'placeholder.position': 'e.g. Senior Backend Engineer',
    'placeholder.jd': 'Paste the full job description, or upload a PDF / Word / image…',
    'placeholder.resume': 'Paste your full resume, or upload a PDF / Word / image…',
    'upload.file': '📎 Upload file',
    'drop.jd': 'Drop a PDF / Word / image / TXT here',
    'drop.resume': 'Drop a file here, or paste directly',
    'example.pm': 'AI PM example',
    'example.data': 'Data analyst example',
    'example.tech': 'Backend example',
    'example.ops': 'Ops example',
    'role.general': 'General',
    'role.tech': 'Engineering',
    'role.product': 'Product',
    'role.data': 'Data',
    'role.ops': 'Operations',
    'role.design': 'Design',
    'role.marketing': 'Marketing',
    'model.hunyuan': 'Hunyuan 2.0 Instruct (recommended)',
    'model.thinking': 'Hunyuan 2.0 Thinking',
    'output.auto': 'Follow interface',
    'output.zh': 'Chinese',
    'output.en': 'English',
    'btn.optimize': 'Optimize resume',

    // result
    'result.title': 'Result',
    'action.stop': 'Stop',
    'action.copy': 'Copy text',
    'action.copyMd': 'Copy Markdown',
    'action.download': 'Download .md',
    'action.print': 'Print / PDF',
    'status.idle': 'Waiting for input…',
    'result.empty': 'No result yet.',

    // settings
    'settings.title': 'Appearance',
    'settings.theme': 'Theme',
    'settings.bg': 'Background',
    'settings.font': 'Font',
    'theme.brand': 'Gold',
    'theme.job51': 'Amber',
    'theme.dark': 'Dark',
    'bg.none': 'None',
    'bg.dots': 'Dots',
    'bg.grid': 'Grid',
    'bg.image': 'Image',
    'font.default': 'Default',
    'font.yahei': 'Microsoft YaHei',
    'font.source': 'Source Han Sans',
    'font.serif': 'Serif',
    'btn.save': 'Save',
    'btn.close': 'Close',

    // dynamic
    'status.needInput': 'Please fill in both the JD and the resume',
    'status.generating': 'Generating — output appears live…',
    'status.done': 'Done',
    'status.stopped.keep': 'Stopped (kept the generated part)',
    'status.stopped.empty': 'Stopped',
    'status.failed': 'Failed',
    'toast.saved': 'Settings saved',
    'toast.needInput': 'Please fill in the JD and resume first',
    'toast.completed': 'Optimization complete',
    'toast.stopped': 'Generation stopped',
    'toast.uploadTooBig': 'File exceeds {mb} MB — split it or paste the text instead',
    'toast.extracting': 'Extracting text…',
    'toast.extracted': 'Extracted {chars} characters',
    'toast.extractFailed': 'Extraction failed: {msg}',
    'toast.copyText': 'Copied as plain text',
    'toast.copyMd': 'Copied Markdown',
    'toast.copyFailed': 'Copy failed — select the text manually',
    'toast.downloaded': 'Markdown file downloaded',
    'toast.fileReadFailed': 'Could not read the file',
    'upload.parsing': 'Parsing…',
    'health.ready': '● {model} ready',
    'health.noKey': '● No API key configured',
    'health.down': '● Server offline',
    'file.suffix': 'resume-optimized',
    'file.companyFallback': 'company',
    'file.positionFallback': 'role',
    'err.unknown': 'Unknown error',
    'err.NO_API_KEY': 'The server has no API key (LLM_API_KEY in .env)',
    'err.UPSTREAM_TIMEOUT': 'The model timed out — retry or switch models',
    'err.UPSTREAM_RATE_LIMITED': 'Too many requests — try again shortly',
    'err.UPSTREAM_ERROR': 'The model service returned an error — check the key or quota',
    'err.UPSTREAM_NETWORK': 'Cannot reach the model service — check the network / LLM_API_BASE',
    'err.UPSTREAM_INVALID': 'Unexpected model response — please retry',
    'err.BODY_TOO_LARGE': 'Content is too large — trim it and retry',
    'err.FILE_TOO_LARGE': 'File exceeds the size limit',
    'err.UNSUPPORTED_TYPE': 'Unsupported file type',
    'err.EXTRACTOR_UNAVAILABLE': 'The server is missing an extraction dependency — run npm install',
    'err.EXTRACT_EMPTY': 'No text could be extracted — the file may be empty or a scan',
    'err.TEXT_TOO_LONG': 'Text exceeds the length limit — trim it and retry',
    'err.INVALID_REQUEST': 'Request is missing required fields',
    'err.INVALID_JSON': 'Request body is not valid JSON',
    'err.INVALID_BASE64': 'Uploaded file is not valid base64',
    'err.NOT_FOUND': 'Unknown endpoint',
    'err.METHOD_NOT_ALLOWED': 'Wrong HTTP method',
    'err.CLIENT_CLOSED': 'The client disconnected',
    'err.INTERNAL': 'Internal server error — check the server console',
    'err.UPSTREAM_EMPTY': 'The model returned an empty response — please retry',
    'err.UPSTREAM_STREAM_ERROR': 'The model stream was interrupted — please retry',
    'err.REQUEST_ABORTED': 'Request aborted',
  };

  // Chinese originals for strings produced by JavaScript (static markup keeps its own Chinese).
  const ZH = {
    'app.title': '职优简历 · AI 智能优化系统',
    'status.needInput': '请填写 JD 和简历',
    'status.generating': 'AI 正在生成，输出会实时显示…',
    'status.done': '完成',
    'status.stopped.keep': '已停止（保留已生成部分）',
    'status.stopped.empty': '已停止生成',
    'status.failed': '失败',
    'toast.saved': '设置已保存',
    'toast.needInput': '请先填写 JD 和简历',
    'toast.completed': '优化完成',
    'toast.stopped': '已停止生成',
    'toast.uploadTooBig': '文件超过 {mb}MB，请拆分或改为粘贴',
    'toast.extracting': '正在提取文本…',
    'toast.extracted': '已提取 {chars} 字',
    'toast.extractFailed': '提取失败：{msg}',
    'toast.copyText': '已复制纯文本',
    'toast.copyMd': '已复制 Markdown',
    'toast.copyFailed': '复制失败，请手动选择文本',
    'toast.downloaded': '已下载 Markdown 文件',
    'toast.fileReadFailed': '读取文件失败',
    'upload.parsing': '解析中…',
    'health.ready': '● {model} 已就绪',
    'health.noKey': '● 未配置 API Key',
    'health.down': '● 服务未启动',
    'file.suffix': '简历优化',
    'file.companyFallback': '公司',
    'file.positionFallback': '岗位',
    'err.unknown': '未知错误',
    'err.NO_API_KEY': '服务端未配置 API Key（.env 中的 LLM_API_KEY）',
    'err.UPSTREAM_TIMEOUT': '模型响应超时，请重试或换一个模型',
    'err.UPSTREAM_RATE_LIMITED': '请求过于频繁，请稍后重试',
    'err.UPSTREAM_ERROR': '模型服务出错，请检查 API Key 或余额',
    'err.UPSTREAM_NETWORK': '无法连接模型服务，请检查网络 / LLM_API_BASE',
    'err.UPSTREAM_INVALID': '模型返回格式异常，请重试',
    'err.BODY_TOO_LARGE': '内容过大，请精简后重试',
    'err.FILE_TOO_LARGE': '文件超过大小上限',
    'err.UNSUPPORTED_TYPE': '不支持的文件类型',
    'err.EXTRACTOR_UNAVAILABLE': '服务端缺少对应解析依赖，请先 npm install',
    'err.EXTRACT_EMPTY': '没有从文件中提取到文本，可能是扫描件或空文件',
    'err.TEXT_TOO_LONG': '文本超过长度上限，请精简后重试',
    'err.INVALID_REQUEST': '请求参数不完整',
    'err.INVALID_JSON': '请求体不是合法 JSON',
    'err.INVALID_BASE64': '文件内容不是合法的 base64',
    'err.NOT_FOUND': '未知接口',
    'err.METHOD_NOT_ALLOWED': '请求方法不被允许',
    'err.CLIENT_CLOSED': '客户端已断开连接',
    'err.INTERNAL': '服务端内部错误，请查看服务台日志',
    'err.UPSTREAM_EMPTY': '模型返回了空内容，请重试',
    'err.UPSTREAM_STREAM_ERROR': '模型流式响应中断，请重试',
    'err.REQUEST_ABORTED': '请求已取消',
  };

  const DICTS = { zh: ZH, en: EN };

  const TEXT_ATTR = 'data-i18n';
  const ATTRS = [
    ['data-i18n-placeholder', 'placeholder'],
    ['data-i18n-title', 'title'],
    ['data-i18n-aria-label', 'aria-label'],
    ['data-i18n-alt', 'alt'],
  ];

  let current = 'zh';
  let snapshots = [];
  let ready = false;

  function pickLang() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && LANGS.some((l) => l.code === saved)) return saved;
    } catch (e) { /* ignore */ }
    const nav = (navigator.language || 'zh').toLowerCase();
    return nav.startsWith('en') ? 'en' : 'zh';
  }

  function snapshot() {
    snapshots = [];
    const nodes = document.querySelectorAll(
      '[' + TEXT_ATTR + '],' + ATTRS.map((a) => '[' + a[0] + ']').join(',')
    );
    nodes.forEach((el) => {
      const entry = { el, html: null, attrs: [] };
      if (el.hasAttribute(TEXT_ATTR)) entry.html = el.innerHTML;
      ATTRS.forEach(([dataAttr, attr]) => {
        if (el.hasAttribute(dataAttr)) entry.attrs.push([attr, el.getAttribute(attr)]);
      });
      snapshots.push(entry);
    });
  }

  function valueOf(key, lang) {
    const dict = DICTS[lang] || {};
    const value = dict[key];
    return typeof value === 'string' ? value : null;
  }

  function interpolate(text, vars) {
    if (!vars) return text;
    return text.replace(/\{(\w+)\}/g, (m, name) =>
      Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : m
    );
  }

  function t(key, vars) {
    const en = valueOf(key, 'en');
    const zh = valueOf(key, 'zh');
    const text = current === 'en' ? en || zh : zh || en;
    return interpolate(text == null ? key : text, vars);
  }

  function translateElement(el, lang) {
    if (!el) return;
    const keyHtml = el.getAttribute && el.getAttribute(TEXT_ATTR);
    if (keyHtml) {
      const en = valueOf(keyHtml, 'en');
      if (en != null) el.innerHTML = lang === 'zh' ? restoreHtml(el) : en;
    }
    ATTRS.forEach(([dataAttr, attr]) => {
      if (!el.hasAttribute || !el.hasAttribute(dataAttr)) return;
      const en = valueOf(el.getAttribute(dataAttr), 'en');
      if (en == null) return;
      const original = restoreAttr(el, attr);
      el.setAttribute(attr, lang === 'zh' ? original : en);
    });
  }

  function findSnapshot(el) {
    for (const s of snapshots) if (s.el === el) return s;
    return null;
  }

  function restoreHtml(el) {
    const s = findSnapshot(el);
    return s && s.html != null ? s.html : el.innerHTML;
  }

  function restoreAttr(el, attr) {
    const s = findSnapshot(el);
    if (s) {
      const found = s.attrs.find((a) => a[0] === attr);
      if (found) return found[1];
    }
    return el.getAttribute(attr) || '';
  }

  function apply(lang) {
    if (!ready) return;
    current = LANGS.some((l) => l.code === lang) ? lang : 'zh';
    const meta = LANGS.find((l) => l.code === current);
    document.documentElement.setAttribute('lang', meta.htmlLang);
    snapshots.forEach(({ el }) => {
      const keyHtml = el.getAttribute && el.getAttribute(TEXT_ATTR);
      if (keyHtml) {
        const en = valueOf(keyHtml, 'en');
        if (en != null) el.innerHTML = current === 'zh' ? restoreHtml(el) : en;
      }
      ATTRS.forEach(([dataAttr, attr]) => {
        if (!el.hasAttribute || !el.hasAttribute(dataAttr)) return;
        const en = valueOf(el.getAttribute(dataAttr), 'en');
        if (en == null) return;
        el.setAttribute(attr, current === 'zh' ? restoreAttr(el, attr) : en);
      });
    });
    const titleKey = 'app.title';
    const title = valueOf(titleKey, current);
    if (title) document.title = title;
    const langEl = document.querySelectorAll('.lang-btn');
    langEl.forEach((b) => {
      const on = b.dataset.lang === current;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.dispatchEvent(new CustomEvent('ri18n:change', { detail: { lang: current } }));
  }

  function setLang(lang) {
    if (!LANGS.some((l) => l.code === lang)) return;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* ignore */ }
    apply(lang);
  }

  function init() {
    snapshot();
    ready = true;
    apply(pickLang());
  }

  window.RI18N = {
    LANGS,
    t,
    apply,
    setLang,
    get lang() { return current; },
    translateElement: (el) => translateElement(el, current),
    isReady: () => ready,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
