'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const I18N_SOURCE = fs.readFileSync(path.join(ROOT, 'public/i18n.js'), 'utf8');
const HTML = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');

/** Minimal DOM element used to exercise the translation runtime without a browser. */
function makeElement(options = {}) {
  const attrs = { ...(options.attrs || {}) };
  const element = {
    _html: options.html || '',
    dataset: options.dataset || {},
    classes: new Set(options.classes || []),
    get innerHTML() {
      return element._html;
    },
    set innerHTML(value) {
      element._html = value;
    },
    getAttribute: (name) => (Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null),
    setAttribute: (name, value) => {
      attrs[name] = String(value);
    },
    hasAttribute: (name) => Object.prototype.hasOwnProperty.call(attrs, name),
    classList: {
      toggle: (name, on) => (on ? element.classes.add(name) : element.classes.delete(name)),
      add: (name) => element.classes.add(name),
      remove: (name) => element.classes.delete(name),
    },
  };
  return element;
}

function bootRuntime(navigatorLanguage = 'zh-CN') {
  const elements = {
    home: makeElement({ attrs: { 'data-i18n': 'nav.home' }, html: '首页' }),
    hero: makeElement({
      attrs: { 'data-i18n': 'hero.title' },
      html: '让简历 <span class="hl">精准匹配</span> 目标岗位',
    }),
    company: makeElement({
      attrs: { 'data-i18n-placeholder': 'placeholder.company', placeholder: '例如：字节跳动' },
    }),
    langGroup: makeElement({
      attrs: { 'data-i18n-aria-label': 'aria.lang', 'aria-label': '语言 / Language' },
    }),
    btnZh: makeElement({
      attrs: { 'data-lang': 'zh', 'aria-pressed': 'true' },
      dataset: { lang: 'zh' },
      classes: ['lang-btn'],
    }),
    btnEn: makeElement({
      attrs: { 'data-lang': 'en', 'aria-pressed': 'false' },
      dataset: { lang: 'en' },
      classes: ['lang-btn'],
    }),
  };
  const all = Object.values(elements);

  const document = {
    title: '职优简历 · AI 智能优化系统',
    documentElement: makeElement({ attrs: { lang: 'zh-CN' } }),
    querySelectorAll(selector) {
      if (selector === '.lang-btn') return [elements.btnZh, elements.btnEn];
      return all.filter((element) => {
        if (selector.includes('[data-i18n]') && element.hasAttribute('data-i18n')) return true;
        return ['data-i18n-placeholder', 'data-i18n-title', 'data-i18n-aria-label', 'data-i18n-alt'].some(
          (attribute) => selector.includes(`[${attribute}]`) && element.hasAttribute(attribute)
        );
      });
    },
    dispatchEvent() {},
    addEventListener() {},
  };

  const store = {};
  const localStorage = {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
  };
  const navigator = { language: navigatorLanguage };

  const sandbox = {
    window: { document, navigator, localStorage },
    document,
    navigator,
    localStorage,
    CustomEvent: class {
      constructor(type, options) {
        this.type = type;
        this.detail = options && options.detail;
      }
    },
    console,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(I18N_SOURCE, sandbox);

  return { runtime: sandbox.window.RI18N, elements, document, store };
}

test('i18n dictionary covers every data-i18n key used in index.html', () => {
  const start = I18N_SOURCE.indexOf('const EN = {');
  const end = I18N_SOURCE.indexOf('const ZH = {');
  const enKeys = new Set([...I18N_SOURCE.slice(start, end).matchAll(/'([^'\\]+)'\s*:/g)].map((m) => m[1]));
  const used = new Set([...HTML.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)].map((m) => m[1]));
  const missing = [...used].filter((key) => !enKeys.has(key));
  assert.deepEqual(missing, [], `missing English keys: ${missing.join(', ')}`);
  assert.ok(enKeys.size >= 150, `expected a full dictionary, got ${enKeys.size} keys`);
});

test('runtime switches to English and back without losing inline markup', () => {
  const { runtime, elements, document } = bootRuntime();
  assert.equal(runtime.lang, 'zh');
  assert.equal(elements.home.innerHTML, '首页');

  runtime.setLang('en');
  assert.equal(runtime.lang, 'en');
  assert.equal(elements.home.innerHTML, 'Home');
  assert.match(elements.hero.innerHTML, /precisely match/);
  assert.match(elements.hero.innerHTML, /<span class="hl">/);
  assert.equal(elements.company.getAttribute('placeholder'), 'e.g. Acme Corp');
  assert.equal(elements.langGroup.getAttribute('aria-label'), 'Language');
  assert.equal(document.documentElement.getAttribute('lang'), 'en');
  assert.equal(document.title, 'Resume Optimizer · AI resume tailoring');
  assert.equal(elements.btnEn.getAttribute('aria-pressed'), 'true');

  runtime.setLang('zh');
  assert.equal(elements.home.innerHTML, '首页');
  assert.equal(elements.hero.innerHTML, '让简历 <span class="hl">精准匹配</span> 目标岗位');
  assert.equal(elements.company.getAttribute('placeholder'), '例如：字节跳动');
  assert.equal(document.documentElement.getAttribute('lang'), 'zh-CN');
  assert.equal(document.title, '职优简历 · AI 智能优化系统');
});

test('t() interpolates variables and falls back to the key', () => {
  const { runtime } = bootRuntime();
  runtime.setLang('en');
  assert.match(runtime.t('health.ready', { model: 'hunyuan' }), /hunyuan/);
  assert.equal(runtime.t('missing.key'), 'missing.key');
  assert.match(runtime.t('err.NO_API_KEY'), /API key/);
});

test('saved language wins over the navigator language', () => {
  const first = bootRuntime('en-US');
  assert.equal(first.runtime.lang, 'en');
  first.runtime.setLang('zh');
  assert.equal(first.store['resume-optimizer-lang'], 'zh');
});
