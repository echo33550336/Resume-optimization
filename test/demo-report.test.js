'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { buildDemoReport, DEMO_ZH, DEMO_EN } = require('../demo-report');

const hasCJK = (text) => /[\u4e00-\u9fff]/.test(text);

test('demo report: Chinese report is Chinese and keeps the four-section shape', () => {
  const report = buildDemoReport({ lang: 'zh' });
  assert.ok(report.length > 500, 'report should be substantial');
  assert.ok(hasCJK(report));
  for (const heading of ['匹配诊断', '优化后的简历', '修改清单', '缺口与风险']) {
    assert.ok(report.includes(heading), `missing heading: ${heading}`);
  }
  assert.match(report, /68\s*\/\s*100/);
});

test('demo report: English report has no Chinese characters', () => {
  const report = buildDemoReport({ lang: 'en' });
  assert.ok(!hasCJK(report), 'English demo report must not contain CJK');
  for (const heading of ['Match Diagnosis', 'Optimised Resume', 'Key Changes', 'Gaps']) {
    assert.ok(report.includes(heading), `missing heading: ${heading}`);
  }
});

test('demo report: language defaults to Chinese and ignores unknown languages', () => {
  assert.strictEqual(buildDemoReport({}), DEMO_ZH);
  assert.strictEqual(buildDemoReport({ lang: 'fr' }), DEMO_ZH);
  assert.strictEqual(buildDemoReport({ lang: 'EN' }), DEMO_EN);
});
