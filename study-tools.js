/* Pure study helpers shared by the browser and tests. */
(function (root) {
  'use strict';
  const decisions = new Set(['fold', 'call', 'check', 'bet', 'raise']);
  function isHeroDecision(hand, index) {
    const e = hand.events[index];
    return !!e && e.player === hand.hero && decisions.has(e.type);
  }
  function nextDecision(hands, handIndex, cursor, queue = hands.map((_, i) => i)) {
    for (const h of queue) {
      if (h < handIndex || !hands[h]) continue;
      for (let i = h === handIndex ? cursor : 0; i < hands[h].events.length; i++) {
        if (isHeroDecision(hands[h], i)) return {hand: h, cursor: i};
      }
    }
    return null;
  }
  function summary(hand, replay) {
    const hero = replay.final.players.find(p => p.name === hand.hero);
    return {
      complete: hand.complete && replay.issues.length === 0,
      net: hero ? hero.stack - hero.initial : null,
      stackBB: hero ? hero.stack / hand.bigBlind : null,
      payments: hand.events.filter(e => e.type === 'collect').map(e => ({player: e.player, amount: e.amount, pot: e.pot})),
    };
  }
  function cleanAnnotation(value) {
    const notes = {};
    if (value?.eventNotes && typeof value.eventNotes === 'object') {
      for (const [index, entry] of Object.entries(value.eventNotes)) {
        if (/^(0|[1-9]\d{0,5})$/.test(index) && entry && typeof entry === 'object') {
          notes[index] = {note: typeof entry.note === 'string' ? entry.note.slice(0,20000) : '', reviewed: !!entry.reviewed};
        }
      }
    }
    const tags = (root.FeatureTools?.normalizeTags || (values => Array.isArray(values)?values.filter(v=>typeof v==='string').slice(0,12):[]))(value?.tags);
    return {favorite: !!value?.favorite, note: typeof value?.note === 'string' ? value.note.slice(0,20000) : '', eventNotes: notes,tags,reviewed:!!value?.reviewed};
  }
  function restoredPosition(hands, position) {
    const h = hands.findIndex(h => h.tournament === position?.tournament && h.id === position?.hand);
    if (h < 0 || !Number.isInteger(position?.cursor)) return null;
    return {hand: h, cursor: Math.max(0, Math.min(position.cursor, hands[h].events.length))};
  }
  root.StudyTools = {isHeroDecision, nextDecision, summary, cleanAnnotation, restoredPosition};
  if (typeof module !== 'undefined') module.exports = root.StudyTools;
})(globalThis);
