'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildOffline, analyse, jdKeywords } = require('../offline');

const ZH_JD =
  '负责数据产品规划，熟悉 SQL、Python、A/B 实验，3 年以上数据分析经验，有用户增长与埋点指标体系经验';
const ZH_RESUME = [
  '张三',
  '13800138000 | zhangsan@example.com | github.com/zhangsan',
  '教育背景',
  '某某大学 本科 计算机 2018-2022',
  '工作经历',
  '负责数据看板建设',
  '参与用户增长项目，做过需求调研',
  '技能',
  'SQL、Excel、Tableau',
].join('\n');

function zhInput(overrides = {}) {
  return {
    company: 'Acme',
    position: '数据产品经理',
    jd: ZH_JD,
    resume: ZH_RESUME,
    roleType: 'data',
    lang: 'zh',
    ...overrides,
  };
}

test('offline report carries the four canonical sections in zh', () => {
  const { content, signals } = buildOffline(zhInput());
  for (const heading of [
    '## 一、匹配度诊断',
    '## 二、优化后的简历',
    '## 三、关键修改说明',
    '## 四、待补充/风险提示',
  ]) {
    assert.ok(content.includes(heading), `missing heading: ${heading}`);
  }
  assert.equal(signals.lang, 'zh');
  assert.ok(content.includes('离线报告'), 'should disclose that no model was called');
});

test('offline report is deterministic for the same input', () => {
  const first = buildOffline(zhInput()).content;
  const second = buildOffline(zhInput()).content;
  assert.equal(first, second);
});

test('jd keywords split RAG/Agent and skip filler words', () => {
  const terms = jdKeywords(`${ZH_JD}，有 RAG/Agent 项目经验优先`).map((item) => item.term);
  assert.ok(terms.includes('rag'), 'rag should be its own keyword');
  assert.ok(terms.includes('agent'), 'agent should be its own keyword');
  assert.ok(!terms.includes('优先'), 'filler words must not become keywords');
  assert.ok(!terms.includes('经验'), 'filler words must not become keywords');
});

test('keyword coverage reflects what the resume actually mentions', () => {
  const zh = analyse(zhInput());
  assert.ok(zh.matched.includes('sql'), 'SQL is in both JD and resume');
  assert.ok(zh.missing.includes('python'), 'Python is only in the JD');
  assert.ok(zh.keywordScore > 0 && zh.keywordScore <= 100);
});

test('placeholders land on unquantified experience lines only', () => {
  const { content } = buildOffline(zhInput());
  const experienceBlock = content.split('**工作 / 实习经历**')[1].split('**技能**')[0];
  assert.match(experienceBlock, /\[请补充具体数字/, 'experience lines need a metric placeholder');
  const educationBlock = content.split('**教育背景**')[1].split('**工作 / 实习经历**')[0];
  assert.ok(!educationBlock.includes('[请补充具体数字'), 'education facts must stay literal');
  const skillsBlock = content.split('**技能**')[1].split('\n\n')[0];
  assert.ok(!skillsBlock.includes('[请补充具体数字'), 'skill lines must stay literal');
});

test('verb upgrades and the metric suffix are both applied', () => {
  const { content } = buildOffline(zhInput());
  assert.match(content, /主导数据看板建设/, '负责 should become 主导');
  assert.match(content, /参与并交付用户增长项目/, '参与 should become 参与并交付');
});

test('name and contact lines are shown verbatim', () => {
  const { content } = buildOffline(zhInput());
  assert.match(content, /\*\*张三\*\*/);
  assert.match(content, /zhangsan@example\.com/);
  assert.ok(!content.includes('张三，[请补充具体数字'), 'the name line must not get a placeholder');
});

test('header fields and a piped first line stay verbatim', () => {
  const resume = [
    '张三 | 男 | 1998 | 本科 | 3 年经验',
    '求职意向：数据产品经理',
    '电话：13800138000 | 邮箱：zhangsan@example.com',
    '工作经历',
    '负责数据看板建设',
  ].join('\n');
  const { content } = buildOffline(zhInput({ resume }));
  assert.match(content, /\*\*张三 \| 男 \| 1998 \| 本科 \| 3 年经验\*\*/, 'the first line is a heading');
  assert.match(content, /求职意向：数据产品经理/);
  assert.ok(!content.includes('求职意向：数据产品经理，['), 'header fields must not get placeholders');
  assert.match(content, /主导数据看板建设，\[请补充具体数字/);
});

test('signals stay inside their documented ranges', () => {
  const signals = analyse(zhInput());
  assert.ok(signals.score >= 20 && signals.score <= 95);
  assert.ok(signals.keywordScore >= 5 && signals.keywordScore <= 100);
  assert.ok(signals.levelScore >= 40 && signals.levelScore <= 95);
  assert.ok(signals.quantifiedRatio >= 0 && signals.quantifiedRatio <= 100);
});

test('english report contains no CJK characters', () => {
  const { content } = buildOffline({
    company: 'Acme',
    position: 'Data Product Manager',
    lang: 'en',
    jd: 'Own the data product roadmap; 3+ years of analytics experience; SQL, Python, A/B testing',
    resume: [
      'Zhang San',
      '+86 138 0013 8000 | zs@example.com',
      'Education',
      'Some University, BSc Computer Science, 2018-2022',
      'Experience',
      'Responsible for building the data dashboard',
      'Skills',
      'SQL, Python',
    ].join('\n'),
  });
  for (const heading of [
    '## 1. Match Diagnosis',
    '## 2. Optimised Resume',
    '## 3. Key Changes',
    '## 4. Gaps & Risks',
  ]) {
    assert.ok(content.includes(heading), `missing heading: ${heading}`);
  }
  assert.ok(!/[\u4e00-\u9fff]/.test(content), 'English report must not contain CJK');
  assert.match(content, /Owned building the data dashboard/, 'English verbs should be upgraded too');
});

test('empty resume still produces a usable report', () => {
  const { content, signals } = buildOffline({ jd: ZH_JD, resume: '', lang: 'zh', position: '', company: '' });
  assert.ok(content.includes('## 一、匹配度诊断'));
  assert.equal(signals.bulletCount, 0);
  assert.equal(signals.quantifiedRatio, 0);
});

test('optimised resume keeps the original names and has no edge text', () => {
  const content = buildOffline(zhInput()).content;
  const resumeSection = content.split('## 二、优化后的简历')[1].split('## 三、')[0];
  assert.ok(resumeSection.includes('某某大学 本科 计算机 2018-2022'), 'school line stays verbatim');
  assert.ok(resumeSection.includes('SQL、Excel、Tableau'), 'skill names stay verbatim');
  assert.ok(!resumeSection.includes('目标公司'), 'no target-company line inside the resume');
  assert.ok(!resumeSection.includes('方向）'), 'no role-label aside next to the objective');
  assert.ok(!resumeSection.includes('> 以上是结构改写'), 'no closing note inside the resume');
});

test('english optimised resume has no target-company line either', () => {
  const { content } = buildOffline({
    company: 'Acme',
    position: 'Data Product Manager',
    lang: 'en',
    jd: 'Own the data product roadmap; SQL, Python',
    resume: ['Zhang San', 'Education', 'Some University, BSc Computer Science', 'Skills', 'SQL'].join('\n'),
  });
  const resumeSection = content.split('## 2. Optimised Resume')[1].split('## 3. Key Changes')[0];
  assert.ok(resumeSection.includes('Some University, BSc Computer Science'));
  assert.ok(!resumeSection.includes('**Company**'), 'no company line inside the resume');
  assert.ok(!resumeSection.includes('> Structure only'), 'no closing note inside the resume');
});
