'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Parser = require('./parser.js');
const Engine = require('./replay-engine.js');
const Features = require('./feature-tools.js');
const text = fs.readFileSync(__dirname + '/reference-history.txt', 'utf8');
const hands = Parser.parseHistory(text).hands;
const compiled = hands.map(Engine.compile);

assert.deepEqual(Features.normalizeTags('  Blefe,call difícil,BLEFE,, call   difícil, BB vs BB '), ['Blefe', 'call difícil', 'BB vs BB']);
assert.deepEqual(Features.normalizeTags([null, {}, ' x ', 'X']), ['x']);
assert.equal(Features.normalizeTags(Array.from({length: 20}, (_, i) => 'tag' + i)).length, 12);
assert.equal(Array.from(Features.normalizeTags('🃏'.repeat(50))[0]).length, 32);

for (const pattern of ['AKo', 'AK', 'KA', 'A', 'As Kh', 'Kh As', 'A♠ K♥', '[As, Kh]']) assert(Features.cardsMatch(['As', 'Kh'], pattern), pattern);
assert(Features.cardsMatch(['Ah', 'Kh'], 'AKs'));
assert(Features.cardsMatch(['8h', '8s'], '88'));
assert(Features.cardsMatch(['Th', 'As'], '10h As'));
for (const pattern of ['AKs', 'AQ', 'AA', 'As Ks', '88s', 'garbage']) assert(!Features.cardsMatch(['As', 'Kh'], pattern), pattern);
assert(!Features.cardsMatch([], 'AK'));

const sample = {...hands[0], id: '100001', totalPot: 180, hero: 'Herói', players: [{name: 'Herói', seat: 1, initial: 1000}, {name: 'Rival longo', seat: 2, initial: 900}], button: 1, events: [{type: 'deal', player: 'Herói', cards: ['As', 'Kh']}]};
const sampleReplay = {position: 'BTN / SB', final: {players: [{name: 'Herói', stack: 1080, total: 90}, {name: 'Rival longo', stack: 820, total: 90}]}};
const annotation = {tags: ['Call difícil', 'Blind vs blind']};
assert(Features.matches(sample, sampleReplay, annotation, 'heroi AKo'));
assert(Features.matches(sample, sampleReplay, annotation, 'As Kh'));
assert(!Features.matches(sample, sampleReplay, annotation, 'As Ks'));
assert(Features.matches(sample, sampleReplay, annotation, '1000 rival', {position: 'SB', cards: 'AKo', player: 'longo', tag: 'call dificil', minPot: 180, maxPot: 180}, true));
assert(!Features.matches(sample, sampleReplay, annotation, '', {minPot: 1}, false), 'Pot filter must not classify hidden results');
assert(!Features.matches(sample, sampleReplay, annotation, '', {maxPot: 179}, true));
assert(!Features.matches(sample, sampleReplay, annotation, '', {minPot: 'invalid'}, true));
assert(!Features.matches(sample, sampleReplay, annotation, '', {minPot: 190, maxPot: 180}, true));
assert(Features.matches(sample, sampleReplay, annotation, '', {minPot: '', maxPot: ''}, false));
assert(!Features.matches(sample, sampleReplay, annotation, 'unknown'));

// Merge a partial library, an overlapping import and another tournament. The
// complete output must parse again and preserve imported notes' stable hand IDs.
const first = Features.libraryMerge([], hands.slice(0, 20));
const unchanged = JSON.stringify(first);
const secondText = hands[0].original.replaceAll(hands[0].tournament, '9999999999').replaceAll(hands[0].id, '999999999991');
const secondHands = Parser.parseHistory(secondText).hands;
assert.equal(secondHands.length, 1);
const merged = Features.libraryMerge(first, [...hands.slice(10), ...secondHands, hands[0]]);
assert.equal(JSON.stringify(first), unchanged, 'Merging must not mutate the stored library');
assert.equal(merged.length, 2);
assert.equal(merged[0].count, 47);
assert.equal(merged[1].count, 1);
assert.equal(merged[1].id, '9999999999');
assert.deepEqual(merged[0].handIds, hands.map(hand => hand.id));
assert.deepEqual(Parser.parseHistory(merged[0].text).hands.map(hand => hand.id), hands.map(hand => hand.id));
assert.deepEqual(Parser.parseHistory(merged[1].text).hands.map(hand => hand.id), secondHands.map(hand => hand.id));
assert.deepEqual(Features.libraryMerge(merged, hands), merged, 'Duplicate imports are idempotent');
assert.deepEqual(Features.libraryMerge([{text: 'invalid history'}], []), []);

const all = Features.chartPoints(hands, compiled, 0, 0, false);
assert.equal(all.length, 94);
const hidden = Features.chartPoints(hands, compiled, 1, 0, true);
assert.deepEqual(hidden.map(point => [point.hand, point.phase]), [[0, 'start'], [0, 'end'], [1, 'start']]);
assert(!hidden.some(point => point.hand > 1), 'Future stack values must never reach the chart');
assert.equal(Features.chartPoints(hands, compiled, 1, hands[1].events.length, true).length, 4);
assert.equal(hidden[0].value, hands[0].players.find(player => player.name === hands[0].hero).initial / hands[0].bigBlind);
assert.equal(hidden[1].value, compiled[0].final.players.find(player => player.name === hands[0].hero).stack / hands[0].bigBlind);
assert.equal(Features.chartPoints([{...sample, bigBlind: 0}], [sampleReplay], 0, 0, false).length, 0);

const notes = {[hands[0].tournament + ':' + hands[0].id]: {favorite: true, tags: 'Revisar', eventNotes: {4: {note: 'call?', reviewed: true}, 9: {note: ''}, '-1': {note: 'invalid'}, 999999: {note: 'invalid'}}}};
const queue = Features.reviewItems(hands, notes, (index, cursor) => index === 0 && cursor <= 4);
assert.deepEqual(queue.map(item => [item.type, item.cursor, item.reviewed]), [['hand', 0, false], ['decision', 4, true]]);
assert.deepEqual(queue[1].tags, ['Revisar']);
assert.equal(Features.reviewItems(hands, notes, () => false).length, 0);

console.log('Feature tools passed: cards, combined search, spoiler-safe filters/chart, deduplicated multi-tournament library and review queue.');
