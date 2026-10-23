'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Parser = require('./parser.js');
const Engine = require('./replay-engine.js');
const TableExport = require('./table-export.js');

const hands = Parser.parseHistory(fs.readFileSync(__dirname + '/reference-history.txt', 'utf8')).hands;
let checked = 0;
for (const hand of hands) {
  const replay = Engine.compile(hand);
  for (const state of replay.snapshots) {
    const before = JSON.stringify({hand, state});
    const scene = TableExport.createScene(hand, state, {bb: true, fourColors: true});
    assert.equal(JSON.stringify({hand, state}), before, 'Export must not mutate replay inputs');
    assert.equal(scene.players[0].name, hand.hero);
    assert.equal(scene.pot, state.pot);
    assert.deepEqual(scene.board, state.board);
    for (const shown of scene.players) {
      const original = state.players.find(p => p.name === shown.name);
      assert.deepEqual(shown.cards, [original.cards[0] || null, original.cards[1] || null], 'No implicit summary cards');
      assert.equal(shown.stack, original.stack);
    }
    checked++;
  }
}

const hand = hands.find(h => Object.keys(h.summaryCards).some(name => name !== h.hero));
assert(hand, 'Fixture with opponent summary cards');
const initial = Engine.initial(hand);
const base = TableExport.createScene(hand, initial);
assert(base.players.every(p => p.cards.every(c => c === null)), 'Initial export has no future cards');
const explicit = TableExport.createScene(hand, initial, {studyCards: hand.summaryCards});
for (const player of explicit.players) assert.deepEqual(player.cards, hand.summaryCards[player.name] || [null, null]);
const malicious = {...initial, players: [{seat: 1, name: 'x\u202ey\n<test>', stack: Infinity, bet: -5, cards: ['As', '<img>'], action: '\u0000FOLD'}], board: ['2c', '<script>']};
const safe = TableExport.createScene({...hand, hero: 'x\u202ey\n<test>'}, malicious, {title: '\u0000My title', actionText: '\u202eHello'});
assert.equal(safe.players[0].name, 'x y <test>');
assert.deepEqual(safe.players[0].cards, ['As', null]);
assert.equal(safe.players[0].stack, 0); assert.equal(safe.players[0].bet, 0);
assert.deepEqual(safe.board, ['2c', null]); assert.equal(safe.actionText, 'Hello');
assert.throws(() => TableExport.createScene(null, null), /Carregue/);

function fakeCanvas() {
  const labels = [], gradients = {addColorStop() {}};
  const noop = () => {};
  const context = {
    beginPath: noop, moveTo: noop, lineTo: noop, quadraticCurveTo: noop, closePath: noop,
    fill: noop, stroke: noop, ellipse: noop, fillRect: noop, save: noop, restore: noop,
    createLinearGradient() {return gradients;},
    measureText(value) {return {width: String(value).length * 12};},
    fillText(value) {labels.push(String(value));}
  };
  return {labels, getContext(type) {assert.equal(type, '2d'); return context;}, toBlob(callback, type) {assert.equal(type, 'image/png'); callback(new Blob(['png'], {type}));}};
}

const foldedReplay=Engine.compile(hands[46]),foldedIndex=hands[46].events.findIndex(e=>e.type==='fold'&&e.player===hands[46].hero);
const foldedScene=TableExport.createScene(hands[46],foldedReplay.snapshots[foldedIndex+1]);assert(foldedScene.players[0].folded);assert.equal(foldedScene.players[0].allIn,false);
const foldedCanvas=fakeCanvas();TableExport.render(foldedCanvas,foldedScene);assert(foldedCanvas.labels.includes('FOLD'));assert(!foldedCanvas.labels.includes('ALL-IN'),'export must display fold after the recorded forced blind all-in');
(async () => {
  const canvas = fakeCanvas();
  assert.equal(TableExport.render(canvas, base), canvas);
  assert.equal(canvas.width, 1000); assert.equal(canvas.height, 1480);
  assert(canvas.labels.includes('ORBIT REPLAY')); assert(canvas.labels.includes('POTE'));
  assert(canvas.labels.some(label => label.includes('VOCÊ')));
  assert.throws(() => TableExport.render({getContext() {return null;}}, base), /criar a imagem/);
  await assert.rejects(TableExport.exportPNG(hand, initial), /navegador/);
  global.document = {createElement(tag) {assert.equal(tag, 'canvas'); return fakeCanvas();}};
  const blob = await TableExport.exportPNG(hand, initial, {title: 'Mesa para revisão'});
  assert.equal(blob.type, 'image/png'); assert(blob.size > 0);
  global.document = {createElement() {return {...fakeCanvas(), toBlob(callback) {callback(null);}};}};
  await assert.rejects(TableExport.exportPNG(hand, initial), /gerar a imagem/);
  delete global.document;
  console.log(`PASS: table export, ${checked} real replay states without future card disclosure, explicit study reveal, sanitized scenes, canvas rendering calls and PNG blob handling.`);
})().catch(error => {console.error(error); process.exitCode = 1;});
