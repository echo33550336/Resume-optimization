'use strict';

/**
 * Deterministic offline report builder.
 *
 * Why this exists: the app needs an LLM, so without an API key (or when the model
 * is unreachable before a single character has been streamed) the UI used to just
 * fail. This module produces the *same four-section report* from the pasted JD and
 * resume using lexical analysis only — no network, no model, no new dependency.
 *
 * Rules:
 *  - Never invent facts: every missing metric becomes a "[请补充具体数字]" placeholder.
 *  - Deterministic for the same input (the test suite depends on it).
 *  - Honest about itself: the first line says the report was generated locally.
 *
 * The report reuses the canonical section headings from prompt.js, so a caller can
 * swap "offline" and "model" reports without changing the renderer or the exporter.
 */

const { ROLE_LABELS, ROLE_FOCUS, normalizeLang } = require('./prompt');

// ---------------------------------------------------------------------------
// Text analysis primitives
// ---------------------------------------------------------------------------

const LATIN_WORD = /[a-z][a-z0-9+#./-]{0,23}/g;
const LATIN_STOP = new Set([
  'the',
  'and',
  'for',
  'with',
  'you',
  'your',
  'our',
  'are',
  'is',
  'to',
  'of',
  'in',
  'on',
  'at',
  'as',
  'be',
  'we',
  'that',
  'this',
  'will',
  'can',
  'plus',
  'team',
  'work',
  'working',
  'experience',
  'strong',
  'good',
  'ability',
  'requirements',
  'responsibilities',
  'role',
  'job',
  'company',
  'or',
  'an',
  'from',
  'using',
  'used',
  'use',
  'have',
  'has',
  'who',
  'what',
  'how',
  'not',
  'but',
  'all',
  'any',
  'more',
  'most',
  'also',
  'into',
  'about',
  'other',
  'their',
  'they',
  'them',
  'than',
  'then',
  'when',
  'where',
  'which',
  'while',
  'such',
  'must',
  'should',
  'would',
  'could',
  'make',
  'made',
  'need',
  'needs',
  'year',
  'years',
  'month',
  'months',
  'week',
  'weeks',
  'day',
  'days',
  'etc',
  'via',
  'per',
  'new',
  'required',
  'require',
  'requires',
  'preferred',
  'plus',
  'including',
  'include',
  'knowledge',
  'familiar',
  'proficient',
  'understanding',
  'degree',
  'bachelor',
  'bachelors',
  'master',
  'masters',
  'phd',
  'equivalent',
  'related',
  'relevant',
  'field',
  'position',
  'candidate',
  'candidates',
  'opportunity',
  'join',
  'looking',
  'seeking',
  'well',
  'keep',
  'ensure',
  'own',
  'owning',
  'help',
]);

const ZH_STOP_CHARS = new Set(
  '的了和与及或在是为对等中上下我们你们他们它这那就也很更最都还只把被给让从向于其之以并但而且所以如果因为'.split(
    ''
  )
);
const ZH_STOP_TERMS = new Set([
  '经验',
  '要求',
  '职责',
  '任职',
  '优先',
  '以上',
  '相关',
  '能力',
  '熟悉',
  '掌握',
  '具备',
  '良好',
  '优秀',
  '能够',
  '可以',
  '需要',
  '进行',
  '完成',
  '参与',
  '负责',
  '支持',
  '提供',
  '包括',
  '方向',
  '行业',
  '专业',
  '学历',
  '本科',
  '硕士',
  '博士',
  '全日制',
  '应届',
  '毕业',
  '年龄',
  '薪资',
  '福利',
  '地点',
  '时间',
  '每周',
  '每月',
  '我们',
  '你们',
  '他们',
  '公司',
  '团队',
  '岗位',
  '职位',
  '工作',
  '简历',
  '平台',
  '系统',
  '使用',
  '担任',
  '执行',
  '从事',
  '优先考虑',
  '加分项',
  '工作时间',
]);

/** ICU word segmentation ships with Node; fall back to bigrams on older runtimes. */
const SEGMENTER =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('zh', { granularity: 'word' })
    : null;

const CJK_ONLY = /^[\u4e00-\u9fff]+$/;

/** Normalise whitespace so two runs over the same text produce the same report. */
function clean(text) {
  return String(text == null ? '' : text)
    .replace(/\r\n/g, '\n')
    .trim();
}

/** Count latin words and Chinese bigrams; returns a Map<term, weight>. */
function tokenize(text) {
  const lower = clean(text).toLowerCase();
  const counts = new Map();
  const add = (term, weight) => {
    if (!term) return;
    counts.set(term, (counts.get(term) || 0) + weight);
  };

  for (const match of lower.matchAll(LATIN_WORD)) {
    const word = match[0].replace(/[./-]+$/, '');
    if (word.length < 2 || LATIN_STOP.has(word)) continue;
    // "RAG/Agent" is two keywords; "A/B" is one, so only split when both parts are words.
    const parts = word.split('/');
    if (parts.length > 1 && parts.every((part) => part.length >= 2)) {
      for (const part of parts) {
        if (!LATIN_STOP.has(part)) add(part, 1);
      }
      continue;
    }
    add(word, 1);
  }

  const cjkRuns = lower.match(/[\u4e00-\u9fff]+/g) || [];
  if (SEGMENTER) {
    let pending = '';
    for (const part of SEGMENTER.segment(lower)) {
      if (!part.isWordLike) {
        pending = '';
        continue;
      }
      const segment = part.segment;
      if (CJK_ONLY.test(segment)) {
        if (segment.length === 1) {
          // ICU splits some compounds ("埋点" → 埋|点); glue adjacent single chars back.
          pending += segment;
          if (pending.length === 2) {
            if (
              !ZH_STOP_TERMS.has(pending) &&
              !ZH_STOP_CHARS.has(pending[0]) &&
              !ZH_STOP_CHARS.has(pending[1])
            ) {
              add(pending, 1);
            }
            pending = '';
          }
          continue;
        }
        pending = '';
        if (!ZH_STOP_TERMS.has(segment)) add(segment, 1);
        continue;
      }
      pending = '';
    }
    return counts;
  }

  // Fallback for runtimes without Intl.Segmenter: adjacent-character bigrams.
  for (const run of cjkRuns) {
    for (let i = 0; i + 2 <= run.length; i += 1) {
      const bigram = run.slice(i, i + 2);
      if (ZH_STOP_TERMS.has(bigram)) continue;
      if (ZH_STOP_CHARS.has(bigram[0]) || ZH_STOP_CHARS.has(bigram[1])) continue;
      add(bigram, 1);
    }
  }
  return counts;
}

function mergeCounts(target, source, factor = 1) {
  for (const [term, count] of source) {
    target.set(term, (target.get(term) || 0) + count * factor);
  }
  return target;
}

/** Lines that state hard requirements — terms appearing there matter more. */
const REQUIREMENT_LINE =
  /(要求|职责|任职|熟悉|掌握|具备|优先|加分|proficient|experience|required|requirements|responsibilit|familiar|knowledge)/i;

/**
 * Pick the JD keywords worth checking, weighted by frequency and "requirement" lines.
 * @returns {{term:string, weight:number}[]} top terms, highest first, stable order
 */
function jdKeywords(jd) {
  const all = tokenize(jd);
  const requirementText = clean(jd)
    .split(/\n+/)
    .filter((line) => REQUIREMENT_LINE.test(line))
    .join('\n');
  mergeCounts(all, tokenize(requirementText), 1);

  const scored = [...all.entries()].map(([term, count]) => {
    const isLatin = /^[a-z]/.test(term);
    const weight = count * (isLatin ? 1.4 : 1) * (term.length >= 4 ? 1.25 : 1) * (term.length <= 2 ? 0.6 : 1);
    return { term, weight };
  });
  scored.sort((a, b) => b.weight - a.weight || a.term.localeCompare(b.term));

  const picked = [];
  for (const item of scored) {
    if (picked.length >= 20) break;
    // Skip a term that is already covered by a longer picked term ("LangChain" vs "chain").
    if (picked.some((other) => other.term.includes(item.term) || item.term.includes(other.term))) continue;
    picked.push(item);
  }
  return picked;
}

function mentions(text, term) {
  const haystack = clean(text).toLowerCase();
  if (/^[a-z]/.test(term)) {
    return new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(
      haystack
    );
  }
  return haystack.includes(term);
}

function pickTerms(keywords, matcher) {
  return keywords.filter((item) => matcher(item.term)).map((item) => item.term);
}

// ---------------------------------------------------------------------------
// Resume structure
// ---------------------------------------------------------------------------

const SECTION_RULES = [
  { kind: 'education', re: /^(教育背景|教育经历|教育|学习经历|education|academic)\s*[：:]?\s*$/i },
  {
    kind: 'experience',
    re: /^(工作经历|工作经验|实习经历|实习经验|职业经历|工作履历|experience|work experience|employment)\s*[：:]?\s*$/i,
  },
  { kind: 'projects', re: /^(项目经历|项目经验|项目|projects?|project experience)\s*[：:]?\s*$/i },
  {
    kind: 'skills',
    re: /^(技能|专业技能|技能清单|技术栈|技能特长|skills?|technical skills|tools)\s*[：:]?\s*$/i,
  },
  { kind: 'awards', re: /^(荣誉|奖项|获奖|荣誉证书|证书|awards?|honors?|certificates?)\s*[：:]?\s*$/i },
  { kind: 'summary', re: /^(自我评价|个人总结|个人简介|概述|关于我|summary|profile|about)\s*[：:]?\s*$/i },
];

const SECTION_TITLES = {
  zh: {
    content: '原文内容',
    education: '教育背景',
    experience: '工作 / 实习经历',
    projects: '项目经历',
    skills: '技能',
    awards: '荣誉与证书',
    summary: '个人概述',
  },
  en: {
    content: 'Original content',
    education: 'Education',
    experience: 'Experience',
    projects: 'Projects',
    skills: 'Skills',
    awards: 'Honours & certificates',
    summary: 'Summary',
  },
};

function detectSection(line) {
  for (const rule of SECTION_RULES) {
    if (rule.re.test(line)) return rule.kind;
  }
  return null;
}

/** Split a resume into titled sections, tolerating "教育背景：XX大学" one-liners. */
function parseResume(resume) {
  const blocks = [];
  let current = { kind: 'content', lines: [] };
  const flush = () => {
    if (current.lines.some((line) => line.trim())) blocks.push(current);
    current = { kind: 'content', lines: [] };
  };

  for (const rawLine of clean(resume).split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      current.lines.push('');
      continue;
    }
    const inline = line.match(/^([^：:]{2,10})[：:]\s*(.+)$/);
    if (inline && detectSection(inline[1].trim())) {
      flush();
      const kind = detectSection(inline[1].trim());
      current = { kind, lines: [inline[2].trim()] };
      continue;
    }
    const kind = detectSection(line);
    if (kind) {
      flush();
      current = { kind, lines: [] };
      continue;
    }
    current.lines.push(line);
  }
  flush();
  return blocks;
}

const BULLET_PREFIX = /^\s*(?:[-*•·–—]|\d+[.、)）]|[（(]\d+[)）])\s*/;

function stripBullet(line) {
  return line.replace(BULLET_PREFIX, '').trim();
}

/** True when the line already carries a metric (years alone do not count). */
function hasMetric(line) {
  const text = String(line)
    .replace(/(19|20)\d{2}\s*(年|\.\d|[-–~至])?/g, ' ')
    .replace(/\d{4}\s*[-–~]\s*\d{4}/g, ' ');
  if (/[0-9]/.test(text)) return true;
  if (/[%％]/.test(text)) return true;
  return /[一二两三四五六七八九十百千]+\s*(年|个|次|项|人|家|条|篇|版|倍|轮)/.test(text);
}

const VERB_UPGRADES = [
  [/负责/g, '主导'],
  [/参与/g, '参与并交付'],
  [/协助/g, '协助并推进'],
  [/帮助/g, '推动'],
  [/做了/g, '完成'],
  [/做过/g, '完成'],
  [/尽量/g, '主动'],
];

/** English verb upgrades, applied case-insensitively and keeping sentence case. */
const EN_VERB_UPGRADES = [
  [/\bresponsible for\b/gi, 'Owned'],
  [/\bhelped (with|to)\b/gi, 'Drove'],
  [/\bassisted (with|in)\b/gi, 'Drove'],
  [/\bparticipated in\b/gi, 'Delivered'],
  [/\bworked on\b/gi, 'Delivered'],
  [/\binvolved in\b/gi, 'Led'],
  [/\bwas part of\b/gi, 'Contributed to'],
];

const CONTACT_LINE =
  /(@|https?:\/\/|github\.com|\d{3,4}[- ]?\d{7,8}|微信|wechat|电话|邮箱|phone|email|address)/i;
const NAME_LIKE = /^[\u4e00-\u9fff]{2,4}$|^[A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*){0,2}$/;
/** Header fields ("求职意向：…", "Email: …") carry facts, never an achievement to quantify. */
const HEADER_FIELD =
  /^(求职意向|求职目标|应聘(?:岗位|职位)?|目标岗位|期望(?:岗位|职位|城市|薪资|行业)|姓名|性别|年龄|学历|专业|电话|手机|邮箱|联系方式|现居|地址|籍贯|工作年限|求职状态|objective|target\s+role|expected\s+\w+|name|phone|e-?mail|address|location)\s*[：:]/i;

/** Lines that must stay verbatim (name, phone, email, links, header fields). */
function isIdentityLine(line, isFirstLine) {
  if (CONTACT_LINE.test(line) || HEADER_FIELD.test(line.trim())) return true;
  // The very first line of a resume is always a heading (name, or name + one-line summary).
  if (isFirstLine) return !/[。！？!?]\s*$/.test(line.trim());
  return NAME_LIKE.test(line.trim());
}

/** Turn any resume line into an "action → method → result" bullet with an honest gap. */
function rewriteBullet(line, lang) {
  let text = stripBullet(line)
    .replace(/^[、,，;；:：]+/, '')
    .trim();
  if (!text) return '';
  if (lang === 'zh') {
    for (const [re, replacement] of VERB_UPGRADES) text = text.replace(re, replacement);
    if (!hasMetric(text)) {
      text = `${text.replace(/[。；;]+$/, '')}，[请补充具体数字：改造前后对比或覆盖规模]`;
    }
    return `- ${text}`;
  }
  for (const [re, replacement] of EN_VERB_UPGRADES) text = text.replace(re, replacement);
  if (!hasMetric(text)) {
    text = `${text.replace(/[.;]+$/, '')} — [add the exact number: before → after, or scale]`;
  }
  return `- ${text}`;
}

/** Split paragraph-ish lines into sentences so each one can be rewritten as a bullet. */
function expandLines(lines) {
  const out = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (BULLET_PREFIX.test(trimmed)) {
      out.push(trimmed);
      continue;
    }
    const sentences = trimmed.split(/(?<=[。；;])\s*/).filter((part) => part.trim().length >= 6);
    if (sentences.length > 1) out.push(...sentences);
    else out.push(trimmed);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

const DEGREE_TERMS = ['本科', '硕士', '博士', 'bachelor', 'master', 'phd', 'degree', '学历'];
const EXPERIENCE_TERMS = ['年经验', '年以上', 'years of experience', 'year experience', '应届', '实习'];
const EXPERIENCE_YEARS = /(\d+)\s*年(?:以上)?(?:相关)?(?:经验|工作经历)|(\d+)\+?\s*years?/i;

/**
 * Signals are also returned over HTTP, so keep this shape documented for `tsc` (checkJs).
 * @typedef {object} OfflineSignals
 * @property {string} lang
 * @property {string} roleKey
 * @property {string} roleLabel
 * @property {string} roleFocus
 * @property {string[]} keywords
 * @property {string[]} matched
 * @property {string[]} missing
 * @property {number} keywordScore
 * @property {number} quantifiedCount
 * @property {number} bulletCount
 * @property {number} quantifiedRatio
 * @property {number} quantScore
 * @property {number} levelScore
 * @property {number} score
 * @property {{kind:string, lines:string[]}[]} blocks
 * @property {string[]} sections
 * @property {boolean} degreeMatch
 * @property {number} yearsRequired
 * @property {boolean} yearsStated
 */

/**
 * @param {{jd?:string, resume?:string, company?:string, position?:string, roleType?:string, lang?:string}} input
 * @returns {OfflineSignals}
 */
function analyse(input) {
  const lang = normalizeLang(input && input.lang);
  const roleType = input && input.roleType ? String(input.roleType) : 'general';
  const roleKey = ROLE_LABELS[lang][roleType] ? roleType : 'general';
  const jd = clean(input && input.jd);
  const resume = clean(input && input.resume);

  const keywords = jdKeywords(jd);
  const totalWeight = keywords.reduce((sum, item) => sum + item.weight, 0) || 1;
  const matched = pickTerms(keywords, (term) => mentions(resume, term));
  const missing = pickTerms(keywords, (term) => !mentions(resume, term));
  const matchedWeight = keywords
    .filter((item) => matched.includes(item.term))
    .reduce((sum, item) => sum + item.weight, 0);
  const keywordCoverage = Math.round((matchedWeight / totalWeight) * 100);

  const blocks = parseResume(resume);
  const allBullets = expandLines(
    blocks.flatMap((block) => block.lines).filter((line) => !detectSection(line))
  );
  const quantified = allBullets.filter((line) => hasMetric(line));
  const quantifiedRatio = allBullets.length ? Math.round((quantified.length / allBullets.length) * 100) : 0;

  const kinds = new Set(blocks.map((block) => block.kind));
  const degreeMatch =
    DEGREE_TERMS.some((term) => mentions(jd, term)) && DEGREE_TERMS.some((term) => mentions(resume, term));
  const yearsRequired = EXPERIENCE_YEARS.exec(jd);
  const yearsStated =
    EXPERIENCE_YEARS.test(resume) || EXPERIENCE_TERMS.some((term) => mentions(resume, term));

  let levelScore = 70;
  if (degreeMatch) levelScore += 10;
  if (kinds.has('projects') || kinds.has('experience')) levelScore += 8;
  if (yearsRequired && !yearsStated) levelScore -= 12;
  if (yearsRequired && yearsStated) levelScore += 4;
  levelScore = Math.max(40, Math.min(95, levelScore));

  const keywordScore = Math.max(5, Math.min(100, keywordCoverage));
  const quantScore = allBullets.length === 0 ? 20 : Math.max(10, Math.min(100, quantifiedRatio));
  const score = Math.max(
    20,
    Math.min(95, Math.round(keywordScore * 0.45 + quantScore * 0.3 + levelScore * 0.25))
  );

  return {
    lang,
    roleKey,
    roleLabel: ROLE_LABELS[lang][roleKey],
    roleFocus: ROLE_FOCUS[lang][roleKey],
    keywords: keywords.map((item) => item.term),
    matched,
    missing,
    keywordScore,
    quantifiedCount: quantified.length,
    bulletCount: allBullets.length,
    quantifiedRatio,
    quantScore,
    levelScore,
    score,
    blocks,
    sections: [...kinds],
    degreeMatch,
    yearsRequired: yearsRequired ? Number(yearsRequired[1] || yearsRequired[2] || 0) : 0,
    yearsStated,
  };
}

// ---------------------------------------------------------------------------
// Report rendering
// ---------------------------------------------------------------------------

const HEADINGS = {
  zh: {
    diagnosis: '## 一、匹配度诊断',
    resume: '## 二、优化后的简历',
    changes: '## 三、关键修改说明',
    gaps: '## 四、待补充/风险提示',
    placeholder: '[请补充具体数字]',
  },
  en: {
    diagnosis: '## 1. Match Diagnosis',
    resume: '## 2. Optimised Resume',
    changes: '## 3. Key Changes',
    gaps: '## 4. Gaps & Risks',
    placeholder: '[add the exact number]',
  },
};

function renderDiagnosisZh(signals) {
  const missing = signals.missing.slice(0, 6);
  const lines = [
    HEADINGS.zh.diagnosis,
    '',
    `**综合匹配度：${signals.score} / 100 —— 本地规则评分（未调用大模型）。**`,
    '',
    `- **JD 关键词覆盖：${signals.keywordScore}/100** —— 命中了 ${signals.matched.length} 个高权重关键词${missing.length ? `，没命中的是「${missing.join('、')}」` : '，覆盖面不错'}。${
      missing.length ? '这些词要么写进技能，要么在经历里给证据，否则 HR 的 ATS 初筛会直接漏掉你。' : ''
    }`,
    `- **成果量化：${signals.quantScore}/100** —— ${signals.bulletCount} 条可读经历里只有 ${signals.quantifiedCount} 条带数字（${signals.quantifiedRatio}%）。${
      signals.quantifiedRatio < 50
        ? '动词有了、结果没有，这是最容易被判定为"做过但不重要"的原因。'
        : '继续保持，数字比形容词有用。'
    }`,
    `- **岗位层级与背景匹配：${signals.levelScore}/100** —— ${
      signals.degreeMatch ? '学历要求与你的背景能对上' : 'JD 里的学历要求在你的简历里找不到对应表述'
    }${signals.yearsRequired ? `；岗位写了「${signals.yearsRequired} 年」，` : '；'}${signals.yearsStated ? '你有相应经验/实习经历可以顶上' : '你没有直接证据，需要用项目深度来补'}。`,
    '- **岗位族侧重** —— ' + signals.roleFocus + '。',
    '',
  ];
  return lines.join('\n');
}

/** Sections whose lines are facts (school, dates, skill list): show them, never add placeholders. */
const LITERAL_KINDS = new Set(['education', 'awards', 'skills', 'summary']);

function renderBlocks(blocks, lang) {
  const out = [];
  for (const block of blocks) {
    const literal = LITERAL_KINDS.has(block.kind);
    out.push(`**${SECTION_TITLES[lang][block.kind] || (lang === 'zh' ? '经历' : 'Experience')}**`);
    const lines = expandLines(block.lines);
    if (!lines.length) {
      out.push(
        lang === 'zh' ? '- [这一块还空着，请补充真实内容]' : '- [this section is empty — add real content]'
      );
      out.push('');
      continue;
    }
    if (block.kind === 'skills' || block.kind === 'awards') {
      const separator = lang === 'zh' ? '；' : '; ';
      const joined = lines
        .map((line) => stripBullet(line))
        .filter(Boolean)
        .join(separator);
      if (joined) out.push(`- ${joined.replace(/[；;]+$/, '')}`);
      out.push('');
      continue;
    }
    lines.forEach((line, index) => {
      const text = stripBullet(line).trim();
      if (!text) return;
      const identity = isIdentityLine(line, block.kind === 'content' && index === 0);
      if (identity && block.kind === 'content' && index === 0) {
        out.push(`**${text}**`);
      } else if (identity || literal) {
        out.push(`- ${text}`);
      } else {
        const bullet = rewriteBullet(line, lang);
        if (bullet) out.push(bullet);
      }
    });
    out.push('');
  }
  return out;
}

function renderResumeZh(signals, input) {
  const position = clean(input.position);
  const out = [HEADINGS.zh.resume, ''];
  // Only resume content goes in this section: no target-company line, no role
  // label asides, no closing notes. Names, schools and dates stay verbatim.
  out.push(`**求职意向**：${position || '目标岗位'}`);
  out.push('');

  const blocks = signals.blocks.length ? signals.blocks : [{ kind: 'content', lines: [] }];
  out.push(...renderBlocks(blocks, 'zh'));
  out.push('');
  return out.join('\n');
}

function renderChangesZh(signals) {
  const items = [];
  items.push(
    '**保真边界** —— 公司、学校、机构、项目、产品、技术栈、奖项等名称一律照抄原文，没有缩写或换说法；只改描述、不加页眉页脚或「优化版」这类边角文字。'
  );
  items.push(
    `**关键词覆盖 ${signals.keywordScore}%** —— 命中了 ${signals.matched.slice(0, 6).join('、') || '（几乎没有命中）'}。${
      signals.missing.length
        ? `优先把「${signals.missing.slice(0, 5).join('、')}」补进技能或经历，这是 JD 里权重最高的缺口。`
        : '关键词已经齐了，重点转到量化。'
    }`
  );
  items.push(
    `**量化占位 ${signals.bulletCount - signals.quantifiedCount} 处** —— 每条没有数字的经历都改成了「动作 + 方法 + ${HEADINGS.zh.placeholder}」；占位符不是凑数，是你要去查的指标（转化率、耗时、覆盖数、缺陷数都行）。`
  );
  items.push(
    '**动词升级** —— 「负责 / 参与 / 协助 / 帮助」全部换成「主导 / 参与并交付 / 协助并推进 / 推动」：HR 用动词判断你到底是执行者还是推动者。'
  );
  const missingSections = ['education', 'experience', 'projects', 'skills'].filter(
    (kind) => !signals.sections.includes(kind)
  );
  items.push(
    missingSections.length
      ? `**补结构** —— 简历里没看到「${missingSections.map((kind) => SECTION_TITLES.zh[kind]).join('、')}」模块，建议补齐并保持「教育 → 经历 → 项目 → 技能」的顺序。`
      : '**结构完整** —— 教育 / 经历 / 项目 / 技能四块都在，顺序建议保持「教育 → 经历 → 项目 → 技能」，让 8 秒扫读先看到最相关的部分。'
  );
  items.push(
    `**对齐岗位族（${signals.roleLabel}）** —— ${signals.roleFocus}；优化稿已经把每段经历往这个方向收，投别的岗位时换这一句就行。`
  );
  items.push(
    '**格式** —— 每行控制在 1-2 行内，用「从 A 到 B」「覆盖 N 个场景」这类可核对写法，避免「大幅」「显著」这种形容词。'
  );
  return [HEADINGS.zh.changes, '', ...items.map((item, index) => `${index + 1}. ${item}`), ''].join('\n');
}

function renderGapsZh(signals) {
  const out = [HEADINGS.zh.gaps, ''];
  if (signals.missing.length) {
    out.push(
      `- **缺关键词（面试会追问）** —— ${signals.missing
        .slice(0, 4)
        .map((term) => `「你在 ${term} 方面具体做过什么？」`)
        .join(' ')}如果没有真实经历，就老实说"了解过但没落地"，别硬编。`
    );
  }
  out.push(
    `- **数字缺口** —— 还有 ${signals.bulletCount - signals.quantifiedCount} 处占位符。挑 3 条最重要的经历先去查数，其余可以留白但不能全留白。`
  );
  if (signals.yearsRequired) {
    out.push(
      `- **年限** —— JD 写了「${signals.yearsRequired} 年」，${
        signals.yearsStated
          ? '你有对应的实习/项目时长，写清楚起止时间'
          : '你目前没有直接证据，用项目复杂度和产出说服对方，别虚报年限'
      }。`
    );
  }
  out.push(`- **岗位族风险** —— ${signals.roleFocus}；面试官会围绕这几点追问，准备好 2 分钟版本。`);
  out.push(
    '- **离线报告说明** —— 这份报告由本地规则生成，只做词面与结构分析，不会像大模型那样逐句改写语义；配好 LLM_API_KEY 后再点「开始优化」即可得到完整版本。'
  );
  out.push('');
  return out.join('\n');
}

function renderDiagnosisEn(signals) {
  const missing = signals.missing.slice(0, 6);
  return [
    HEADINGS.en.diagnosis,
    '',
    `**Overall match: ${signals.score} / 100 — scored by local rules (no model was called).**`,
    '',
    `- **JD keyword coverage: ${signals.keywordScore}/100** — ${signals.matched.length} high-weight keywords matched${missing.length ? `; missing: ${missing.join(', ')}` : ''}.${missing.length ? ' Put them in the skills line or back them with evidence, or an ATS screen will drop you.' : ''}`,
    `- **Quantified impact: ${signals.quantScore}/100** — ${signals.quantifiedCount} of ${signals.bulletCount} readable bullets carry a number (${signals.quantifiedRatio}%).${
      signals.quantifiedRatio < 50
        ? ' Verbs without outcomes read as "busy, not important".'
        : ' Keep it that way — numbers beat adjectives.'
    }`,
    `- **Seniority / background fit: ${signals.levelScore}/100** — ${
      signals.degreeMatch
        ? 'the degree requirement lines up with your background'
        : 'the degree requirement has no counterpart in your resume'
    }${signals.yearsRequired ? `; the posting asks for ${signals.yearsRequired} years and ` : '; '}${signals.yearsStated ? 'you have internship/project time to point at' : 'you have no direct evidence, so lean on project depth'}.`,
    `- **Job-family focus** — ${signals.roleFocus}.`,
    '',
  ].join('\n');
}

function renderResumeEn(signals, input) {
  const position = clean(input.position);
  const out = [HEADINGS.en.resume, ''];
  // Resume content only: no target-company line, no role label aside, no
  // closing note. Names, schools and dates stay exactly as written.
  out.push(`**Target** ${position || 'the role'}`);
  out.push('');
  const blocks = signals.blocks.length ? signals.blocks : [{ kind: 'content', lines: [] }];
  out.push(...renderBlocks(blocks, 'en'));
  out.push('');
  return out.join('\n');
}

function renderChangesEn(signals) {
  const items = [
    '**Fidelity boundary** — company, school, institution, project, product, technology and award names are copied exactly as written (no abbreviation, no rephrasing); only descriptions change, and no headers, footers or "optimised version" edge text is added.',
    `**Keyword coverage ${signals.keywordScore}%** — matched: ${signals.matched.slice(0, 6).join(', ') || '(almost nothing)'}.${
      signals.missing.length
        ? ` Add the highest-weight gaps (${signals.missing.slice(0, 5).join(', ')}) to skills or experience.`
        : ' Keywords are covered — focus on numbers.'
    }`,
    `**${signals.bulletCount - signals.quantifiedCount} metric placeholders** — every unquantified line became "action + method + ${HEADINGS.en.placeholder}". A placeholder is a metric you still have to look up (conversion, latency, coverage, defect count — anything countable).`,
    '**Verb level** — "responsible for / helped with / participated in" became "owned / delivered / drove": recruiters read the verb as seniority.',
    (() => {
      const missingSections = ['education', 'experience', 'projects', 'skills'].filter(
        (kind) => !signals.sections.includes(kind)
      );
      return missingSections.length
        ? `**Missing sections** — ${missingSections.map((kind) => SECTION_TITLES.en[kind]).join(', ')}; add them and keep "education → experience → projects → skills".`
        : '**Complete structure** — education, experience, projects and skills are all present; keep that order so an 8-second scan hits the relevant part first.';
    })(),
    `**Job family (${signals.roleLabel})** — ${signals.roleFocus}; every bullet is biased that way. Swap this line for other roles.`,
    '**Formatting** — keep bullets to 1-2 lines, prefer checkable phrasing ("from A to B", "covered N scenarios") over "significantly improved".',
  ];
  return [HEADINGS.en.changes, '', ...items.map((item, index) => `${index + 1}. ${item}`), ''].join('\n');
}

function renderGapsEn(signals) {
  const out = [HEADINGS.en.gaps, ''];
  if (signals.missing.length) {
    out.push(
      `- **Missing keywords (expect these questions)** — ${signals.missing
        .slice(0, 4)
        .map((term) => `"What have you actually done with ${term}?"`)
        .join(' ')}If the answer is "read about it", say so — do not invent a project.`
    );
  }
  out.push(
    `- **Numbers still missing** — ${signals.bulletCount - signals.quantifiedCount} placeholders. Look up the 3 most important ones first; leaving all of them blank looks evasive.`
  );
  if (signals.yearsRequired) {
    out.push(
      `- **Years of experience** — the posting asks for ${signals.yearsRequired} years; ${
        signals.yearsStated
          ? 'spell out the internship/project dates you do have'
          : 'you have no direct evidence, so argue with project depth instead of inflating dates'
      }.`
    );
  }
  out.push(`- **Job-family risks** — ${signals.roleFocus}; prepare a two-minute story for each.`);
  out.push(
    '- **About this report** — generated by local rules (lexical and structural analysis only). Configure LLM_API_KEY and run "Start optimizing" for the full model rewrite.'
  );
  out.push('');
  return out.join('\n');
}

/**
 * Build the offline report.
 * @param {{jd:string, resume:string, company?:string, position?:string, roleType?:string, lang?:string}} input
 * @returns {{content:string, signals:OfflineSignals}}
 */
function buildOffline(input) {
  const safe = {
    jd: clean(input && input.jd),
    resume: clean(input && input.resume),
    company: clean(input && input.company),
    position: clean(input && input.position),
    roleType: input && input.roleType,
    lang: normalizeLang(input && input.lang),
  };
  const signals = analyse(safe);

  if (signals.lang === 'en') {
    const content = [
      renderDiagnosisEn(signals),
      renderResumeEn(signals, safe),
      renderChangesEn(signals),
      renderGapsEn(signals),
      '---',
      '',
      `> Offline report: keyword coverage ${signals.keywordScore}%, quantified bullets ${signals.quantifiedRatio}%, background fit ${signals.levelScore}/100.`,
      '',
    ].join('\n');
    return { content, signals };
  }

  const content = [
    renderDiagnosisZh(signals),
    renderResumeZh(signals, safe),
    renderChangesZh(signals),
    renderGapsZh(signals),
    '---',
    '',
    `> 离线报告：关键词覆盖 ${signals.keywordScore}%，带数字的经历 ${signals.quantifiedRatio}%，背景匹配 ${signals.levelScore}/100。`,
    '',
  ].join('\n');
  return { content, signals };
}

/** Convenience wrapper for callers that only need the markdown. */
function buildOfflineReport(input) {
  return buildOffline(input).content;
}

module.exports = {
  buildOffline,
  buildOfflineReport,
  analyse,
  tokenize,
  jdKeywords,
  hasMetric,
  parseResume,
};
