'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  LANGS,
  OUTPUT_LANGS,
  ROLE_TYPES,
  normalizeLang,
  normalizeOutputLang,
  buildSystemPrompt,
  buildUserPrompt,
  buildMessages,
} = require('../prompt');

const hasCJK = (text) => /[\u4e00-\u9fff]/.test(text);

test('language tables', () => {
  assert.deepEqual(LANGS, ['zh', 'en']);
  assert.deepEqual(OUTPUT_LANGS, ['auto', 'zh', 'en']);
  assert.ok(ROLE_TYPES.includes('tech'));
  assert.ok(ROLE_TYPES.includes('general'));
});

test('normalizeLang falls back to zh', () => {
  assert.equal(normalizeLang('en'), 'en');
  assert.equal(normalizeLang('EN'), 'en');
  assert.equal(normalizeLang(' zh '), 'zh');
  assert.equal(normalizeLang('fr'), 'zh');
  assert.equal(normalizeLang(undefined), 'zh');
});

test('normalizeOutputLang: explicit value wins, auto follows the UI', () => {
  assert.equal(normalizeOutputLang('en', 'zh'), 'en');
  assert.equal(normalizeOutputLang('zh', 'en'), 'zh');
  assert.equal(normalizeOutputLang('auto', 'en'), 'en');
  assert.equal(normalizeOutputLang('auto', 'zh'), 'zh');
  assert.equal(normalizeOutputLang(undefined, 'zh'), 'zh');
  assert.equal(normalizeOutputLang('nonsense', 'en'), 'en');
});

test('system prompt follows the report language', () => {
  const zh = buildSystemPrompt('tech', 'zh');
  const en = buildSystemPrompt('tech', 'en');
  assert.ok(hasCJK(zh), 'zh prompt should contain Chinese');
  assert.ok(!hasCJK(en), 'en prompt should be free of Chinese');
  assert.match(zh, /当前岗位类型/);
  assert.match(en, /Target job family/);
});

test('system prompt falls back to the general job family', () => {
  const prompt = buildSystemPrompt('no-such-family', 'en');
  assert.match(prompt, /Target job family/);
  assert.ok(prompt.length > 100);
});

test('user prompt carries the JD, the resume and the labels', () => {
  const zh = buildUserPrompt({
    company: 'Acme',
    position: 'Backend Engineer',
    jd: 'JD-MARKER',
    resume: 'RESUME-MARKER',
    roleType: 'tech',
    lang: 'zh',
  });
  const en = buildUserPrompt({
    company: 'Acme',
    position: 'Backend Engineer',
    jd: 'JD-MARKER',
    resume: 'RESUME-MARKER',
    roleType: 'tech',
    lang: 'en',
  });
  for (const prompt of [zh, en]) {
    assert.ok(prompt.includes('JD-MARKER'));
    assert.ok(prompt.includes('RESUME-MARKER'));
    assert.ok(prompt.includes('Acme'));
    assert.ok(prompt.includes('Backend Engineer'));
  }
  assert.match(en, /## Job description/);
  assert.match(en, /## My resume/);
  assert.match(zh, /岗位要求|岗位描述/);
});

test('buildMessages returns system + user in the requested language', () => {
  const messages = buildMessages({
    company: 'Acme',
    position: 'Engineer',
    jd: 'jd',
    resume: 'resume',
    roleType: 'product',
    lang: 'en',
  });
  assert.equal(messages.length, 2);
  assert.equal(messages[0].role, 'system');
  assert.equal(messages[1].role, 'user');
  assert.ok(!hasCJK(messages[0].content));
  assert.equal(buildMessages({ jd: 'j', resume: 'r', lang: 'zh' })[0].role, 'system');
});
