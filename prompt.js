'use strict';

/**
 * Single source of truth for the resume-optimization prompts.
 *
 * Both the HTTP server (server.js) and the published Agent Skill
 * (.commandcode/skills/resume-optimizer/SKILL.md) describe the same behaviour;
 * keep this file canonical and let the skill document reference it instead of
 * carrying a second, drifting copy.
 *
 * The prompt is localised: the UI sends `lang` ("zh" | "en") with each request so
 * the model answers in the language the user is reading.
 */

/** Ordered list of supported UI languages. Keep in sync with public/i18n.js. */
const LANGS = ['zh', 'en'];

/** Ordered list of supported job types. Keep in sync with public/index.html. */
const ROLE_TYPES = ['general', 'tech', 'product', 'data', 'ops', 'design', 'marketing'];

/** Human labels used in the prompt, per language. */
const ROLE_LABELS = {
  zh: {
    general: '通用',
    tech: '技术开发',
    product: '产品',
    data: '数据',
    ops: '运营',
    design: '设计',
    marketing: '市场',
  },
  en: {
    general: 'General',
    tech: 'Engineering',
    product: 'Product',
    data: 'Data',
    ops: 'Operations',
    design: 'Design',
    marketing: 'Marketing',
  },
};

/** What each job type should bias the rewrite towards, per language. */
const ROLE_FOCUS = {
  zh: {
    general: '整体匹配度、表达清晰度、成果量化',
    tech: '技术深度、项目复杂度、架构与性能指标、开源/论文产出',
    product: '需求洞察、从 0 到 1 的落地、数据驱动的迭代、跨团队协作',
    data: '指标体系、分析方法、SQL/Python 能力、A/B 实验与业务洞察',
    ops: '增长与转化、活动策划、用户留存、GMV/DAU 等业务指标',
    design: '设计系统、交互与视觉细节、作品集链接、设计对业务的价值',
    marketing: '投放 ROI、渠道策略、内容与品牌、可量化的增长结果',
  },
  en: {
    general: 'overall match, clarity of expression, quantified outcomes',
    tech: 'technical depth, project complexity, architecture and performance metrics, open source or papers',
    product: 'user insight, zero-to-one delivery, data-driven iteration, cross-team collaboration',
    data: 'metric systems, analytical method, SQL/Python, A/B testing and business insight',
    ops: 'growth and conversion, campaign planning, retention, GMV/DAU style metrics',
    design: 'design systems, interaction and visual detail, portfolio links, business value of design',
    marketing: 'channel ROI, media strategy, content and brand, measurable growth results',
  },
};

const SYSTEM_PROMPTS = {
  zh: [
    '你是一位拥有 10 年经验的互联网行业 HR 总监，擅长根据岗位 JD 优化求职者的简历。',
    '你的任务：基于目标岗位的要求，对用户简历进行深度优化，提升匹配度与通过率。',
    '',
    '输出要求（请严格按此结构输出，使用 Markdown）：',
    '',
    '## 一、匹配度诊断',
    '- 给出 0-100 的匹配度评分，并简要说明理由（3-5 条）。',
    '',
    '## 二、优化后的简历',
    '按标准简历结构输出完整优化版本（教育背景、工作/实习经历、项目经历、技能、个人总结等），',
    '每条经历用 STAR 法则重写，量化成果，突出与 JD 匹配的关键词。',
    '保留真实信息，不编造数据；缺失数据用 [请补充具体数字] 占位。',
    '',
    '## 三、关键修改说明',
    '列出最重要的 5-8 处修改，说明"改了什么 + 为什么"。',
    '',
    '## 四、待补充/风险提示',
    '指出简历中缺失或需要用户确认的信息。',
    '',
    '语气专业、直接、有建设性。不要输出与简历无关的内容。',
  ].join('\n'),
  en: [
    'You are an HR director with 10 years of experience in the tech industry, specialised in tailoring resumes to a target job description.',
    'Your task: optimise the candidate resume against the target role so that match quality and screening pass-rate improve.',
    '',
    'Output requirements (follow this structure exactly, in Markdown):',
    '',
    '## 1. Match Diagnosis',
    '- Give a match score from 0 to 100 and briefly explain the number (3-5 points).',
    '',
    '## 2. Optimised Resume',
    'Output the complete optimised resume in a standard structure (education, work/internship experience, projects, skills, summary).',
    'Rewrite every experience with the STAR method, quantify outcomes, and surface the keywords that match the job description.',
    'Keep facts truthful — never invent data; use [add the exact number] as a placeholder where a figure is missing.',
    '',
    '## 3. Key Changes',
    'List the 5-8 most important edits and explain what changed and why.',
    '',
    '## 4. Gaps & Risks',
    'Point out information that is missing or needs confirmation from the candidate.',
    '',
    'Tone: professional, direct, constructive. Do not output anything unrelated to the resume.',
  ].join('\n'),
};

/** Backwards compatible: the Chinese system prompt. */
const SYSTEM_PROMPT = SYSTEM_PROMPTS.zh;

/** Normalise unknown / missing languages to a supported code. */
function normalizeLang(lang) {
  return LANGS.includes(lang) ? lang : 'zh';
}

/**
 * Compose the system prompt for a given job type and UI language.
 * Unknown / missing types fall back to `general`.
 */
function buildSystemPrompt(roleType, lang) {
  const locale = normalizeLang(lang);
  const key = ROLE_TYPES.includes(roleType) ? roleType : 'general';
  const label = ROLE_LABELS[locale][key];
  const focus = ROLE_FOCUS[locale][key];
  const tail =
    locale === 'en'
      ? `\n\nTarget job family: ${label}. Focus especially on: ${focus}.`
      : `\n\n当前岗位类型：${label}。请重点关注：${focus}。`;
  return `${SYSTEM_PROMPTS[locale]}${tail}`;
}

/**
 * Compose the user prompt.
 * @param {{company?:string, position?:string, jd:string, resume:string, roleType?:string, lang?:string}} input
 */
function buildUserPrompt({ company, position, jd, resume, roleType, lang }) {
  const locale = normalizeLang(lang);
  const label = ROLE_LABELS[locale][roleType] || ROLE_LABELS[locale].general;

  if (locale === 'en') {
    return [
      'Optimise the resume below so that it better matches the target role.',
      '',
      `Target company: ${company && company.trim() ? company.trim() : 'not provided'}`,
      `Target role: ${position && position.trim() ? position.trim() : 'not provided'}`,
      `Job family: ${label}`,
      '',
      '## Job description',
      String(jd).trim(),
      '',
      '## My resume',
      String(resume).trim(),
      '',
      'Follow the four-section structure from the system prompt and do not skip any section.',
    ].join('\n');
  }

  return [
    '请优化下面的简历，使其更匹配目标岗位。',
    '',
    `【目标公司】${company ? company.trim() : '未提供'}`,
    `【目标岗位】${position ? position.trim() : '未提供'}`,
    `【岗位类型】${label}`,
    '',
    '【岗位要求 JD】',
    String(jd).trim(),
    '',
    '【我的简历】',
    String(resume).trim(),
    '',
    '请严格按照系统提示中的四段结构输出，不要省略任何一段。',
  ].join('\n');
}

/** Convenience: build the full OpenAI-compatible messages array. */
function buildMessages(input) {
  const lang = normalizeLang(input && input.lang);
  return [
    { role: 'system', content: buildSystemPrompt(input.roleType, lang) },
    { role: 'user', content: buildUserPrompt({ ...input, lang }) },
  ];
}

module.exports = {
  LANGS,
  ROLE_TYPES,
  ROLE_LABELS,
  ROLE_FOCUS,
  SYSTEM_PROMPT,
  SYSTEM_PROMPTS,
  normalizeLang,
  buildSystemPrompt,
  buildUserPrompt,
  buildMessages,
};
