/* Playback, filtered navigation and saved-session regressions. DOM only; no browser/layout claims. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {parseHTML} = require('linkedom');
const Parser = require('./parser');
const Study = require('./study-tools');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const history = fs.readFileSync(__dirname + '/reference-history.txt', 'utf8');
const hands = Parser.parseHistory(history).hands;
const historyKey = 'orbit-session-history-v1';
const positionKey = 'orbit-session-position-v1';

function boot(data = new Map(), storage = {}) {
  const {window, document} = parseHTML(html);
  const timers = new Map();
  let serial = 0;
  for (const input of document.querySelectorAll('input[type=checkbox]')) input.checked = input.hasAttribute('checked');
  for (const select of document.querySelectorAll('select')) {
    let value = select.querySelector('[selected]')?.getAttribute('value') || select.querySelector('option')?.getAttribute('value');
    Object.defineProperty(select, 'value', {get: () => value, set: v => {value = String(v);}});
  }
  for (const dialog of document.querySelectorAll('dialog')) {
    dialog.showModal = () => {dialog.open = true;};
    dialog.close = () => {dialog.open = false;};
  }
  const localStorage = {
    getItem: k => data.get(k) ?? null,
    setItem: (k, v) => {
      if (storage.writeBlocked) throw Error('QuotaExceededError');
      data.set(k, String(v));
    },
    removeItem: k => data.delete(k),
  };
  const context = vm.createContext({
    document, window, localStorage, navigator: {}, innerWidth: 390, Blob, URL, console,
    setTimeout: (fn, ms) => {const id = ++serial; timers.set(id, {fn, ms}); return id;},
    clearTimeout: id => timers.delete(id),
  });
  for (const file of ['parser.js', 'replay-engine.js', 'study-tools.js', 'feature-tools.js', 'table-export.js', 'studio.js', 'app.js']) {
    vm.runInContext(fs.readFileSync(__dirname + '/' + file, 'utf8'), context, {filename: file});
  }
  const $ = id => document.getElementById(id);
  const click = id => {assert(!$(id).disabled, id + ' must be enabled'); $(id).onclick();};
  const playbackTimers = () => [...timers].filter(([, t]) => t.ms === 1000 / +$('speed').value);
  const tick = () => {
    const pending = playbackTimers();
    assert.equal(pending.length, 1, 'exactly one playback timer must be scheduled');
    const [id, timer] = pending[0]; timers.delete(id); timer.fn();
  };
  const runUntilStopped = inspect => {
    for (let i = 0; i < 3000; i++) {
      if (!playbackTimers().length) return;
      tick(); if (inspect) inspect();
    }
    assert.fail('playback must stop without automatically looping');
  };
  return {
    $, document, data, storage, click, tick, playbackTimers, runUntilStopped,
    cursor: () => Number($('timeline').value),
    handNumber: () => Number($('hand-title').textContent.match(/\d+/)[0]),
    import: (text = history) => {$('paste').value = text; $('import-paste').onclick();},
    open: index => {const buttons = document.querySelectorAll('.hand-open'); assert(buttons[index]); buttons[index].onclick();},
    check: (id, value) => {$(id).checked = value; $(id).onchange();},
    seek: cursor => {$('timeline').value = cursor; $('timeline').oninput({target: $('timeline')});},
    search: text => {$('search').value = text; $('search').oninput();},
    filter: value => {$('filter').value = value; $('filter').onchange();},
    flushPosition: () => {
      for (const [id, timer] of [...timers]) if (timer.ms === 150) {timers.delete(id); timer.fn();}
    },
  };
}

function storedText(raw) {
  try {const value = JSON.parse(raw); if (value && typeof value.text === 'string') return value.text;} catch {}
  return raw;
}

function testHeroPauseResume() {
  const app = boot(); app.import(); app.check('hero-pause', true);
  const start = app.cursor();
  const decisions = hands[0].events.flatMap((event, i) => i >= start && Study.isHeroDecision(hands[0], i) ? [i] : []);
  assert(decisions.length >= 2, 'fixture needs two hero decisions');
  app.click('play'); app.runUntilStopped();
  assert.equal(app.cursor(), decisions[0], 'playback stops before revealing the first hero decision');
  app.click('play'); app.tick();
  assert.equal(app.cursor(), decisions[0] + 1, 'resuming Play reveals the paused decision');
  assert.equal(app.playbackTimers().length, 1, 'playback continues after revealing it');
  app.runUntilStopped();
  assert.equal(app.cursor(), decisions[1], 'the next hero decision pauses playback again');
}

function testLastHandRestart() {
  const app = boot(); app.import(); app.check('continuous', true); app.check('hero-pause', false);
  app.open(hands.length - 1); app.click('end');
  const last = hands.at(-1).events.length;
  assert.equal(app.cursor(), last);
  app.click('play');
  assert.equal(app.handNumber(), hands.length, 'Play restarts the same last hand');
  assert(app.cursor() < last, 'restart moves before the end with continuous playback enabled');
  app.runUntilStopped(() => assert.equal(app.handNumber(), hands.length));
  assert.equal(app.cursor(), last, 'playback reaches the end again');
  assert.equal(app.playbackTimers().length, 0, 'continuous playback does not loop the last hand automatically');
}

function testFilteredNavigation() {
  const app = boot(); app.import();
  app.click('favorite'); app.click('next-hand'); app.click('next-hand'); app.click('favorite');
  app.filter('favorite');
  assert.equal(app.$('hand-list').querySelectorAll('.hand-row').length, 2);
  app.click('prev-hand'); assert.equal(app.handNumber(), 1, 'previous hand skips non-favorites');
  assert(app.$('prev-hand').disabled, 'first filtered hand has no previous hand');
  app.click('next-hand'); assert.equal(app.handNumber(), 3, 'next hand skips non-favorites');
  assert(app.$('next-hand').disabled, 'last filtered hand has no next hand');
  app.click('prev-hand'); app.click('end');
  app.click('summary-next'); assert.equal(app.handNumber(), 3, 'summary follows the same filtered sequence');
  app.click('prev-hand'); app.click('end'); app.click('next-decision');
  const nextHeroDecision = hands[2].events.findIndex((_, i) => Study.isHeroDecision(hands[2], i));
  assert.equal(app.handNumber(), 3, 'next decision skips the excluded second hand');
  assert.equal(app.cursor(), nextHeroDecision, 'next decision remains hidden until explicitly revealed');
  app.click('next-decision'); assert.equal(app.cursor(), nextHeroDecision + 1);
  assert(app.$('next-decision').disabled, 'next decision does not escape the final filtered hand');

  app.click('prev-hand'); app.seek(hands[0].events.length - 1);
  app.check('continuous', true); app.check('hero-pause', false); app.click('play');
  app.runUntilStopped(() => assert([1, 3].includes(app.handNumber()), 'continuous playback stays inside the filter'));
  assert.equal(app.handNumber(), 3); assert.equal(app.cursor(), hands[2].events.length);
  assert(app.$('summary-next').disabled, 'summary ends at the last filtered hand');

  app.search(hands[2].id);
  assert.equal(app.$('hand-list').querySelectorAll('.hand-row').length, 1);
  assert(app.$('prev-hand').disabled && app.$('next-hand').disabled, 'ID search also limits hand navigation');
  app.click('start'); app.click('next-decision');
  assert.equal(app.handNumber(), 3); assert.equal(app.cursor(), nextHeroDecision);
  app.click('next-decision'); assert(app.$('next-decision').disabled, 'ID search also limits decision navigation');

  app.click('start'); app.click('play'); app.search('does-not-exist');
  assert.equal(app.$('hand-list').querySelectorAll('.hand-row').length, 0);
  assert.equal(app.playbackTimers().length, 0, 'empty results stop active playback');
  for (const id of ['prev-hand', 'next-hand', 'play', 'start', 'end', 'prev', 'next', 'timeline', 'next-decision', 'summary-next']) {
    assert(app.$(id).disabled, id + ' is disabled with no matching hands');
  }
  app.search('');
  assert(!app.$('play').disabled, 'clearing search restores controls for matching hands');
}

function testQuotaPreservesSession() {
  const app = boot(); app.import(); app.click('next'); app.flushPosition();
  const savedCursor = app.cursor();
  const savedHistory = app.data.get(historyKey), savedPosition = app.data.get(positionKey);
  assert.equal(storedText(savedHistory), history.replace(/^\uFEFF/,''), 'session A was saved before storage fills');
  app.storage.writeBlocked = true;
  app.import(hands[1].original.replace(/4040939869/g,'9990000001').replace(/262448544858/g,'999000111222'));
  assert.equal(app.$('hand-count').textContent, '1', 'session B remains usable in memory');
  app.click('next'); app.flushPosition();
  assert.equal(app.data.get(historyKey), savedHistory, 'failed history write preserves session A');
  assert.equal(app.data.get(positionKey), savedPosition, 'failed import preserves the matching cursor for session A');
  const resumed = boot(app.data);
  assert.equal(resumed.$('hand-count').textContent, String(hands.length), 'a fresh boot restores session A');
  assert.equal(resumed.handNumber(), 1); assert.equal(resumed.cursor(), savedCursor, 'a fresh boot restores A at its original cursor');

  const legacy = boot(new Map([[historyKey, history], [positionKey, JSON.stringify({tournament: hands[2].tournament, hand: hands[2].id, cursor: 19})]]));
  assert.equal(legacy.handNumber(), 3, 'legacy saved history is still accepted');
  assert.equal(legacy.cursor(), 19, 'legacy cursor is still accepted');
}

for (const test of [testHeroPauseResume, testLastHandRestart, testFilteredNavigation, testQuotaPreservesSession]) {
  try {test(); console.log('PASS:', test.name);}
  catch (error) {console.error('FAIL:', test.name, error); process.exitCode = 1;}
}
if (!process.exitCode) console.log('PASS: playback resume, final-hand restart, filtered navigation/search and quota-safe session restore.');
