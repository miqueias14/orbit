/* Pure library, search and study helpers. No DOM, storage or network access. */
(function (root) {
  'use strict';
  const folded = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
  const parser = () => root.PokerParser || (typeof require === 'function' ? require('./parser.js') : null);
  const engine = () => root.ReplayEngine || (typeof require === 'function' ? require('./replay-engine.js') : null);

  function normalizeTags(value) {
    const output = [], seen = new Set();
    for (const input of Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []) {
      if (typeof input !== 'string') continue;
      const tag = Array.from(input.replace(/[\u0000-\u001f\u007f]/g, '').trim().replace(/\s+/g, ' ')).slice(0, 32).join('');
      const key = folded(tag);
      if (!tag || seen.has(key)) continue;
      seen.add(key); output.push(tag);
      if (output.length === 12) break;
    }
    return output;
  }

  function heroCards(hand) {
    return hand?.events?.find(event => event.type === 'deal' && event.player === hand.hero)?.cards || [];
  }

  function cardText(value) {
    return String(value ?? '').replace(/10/g, 'T').replace(/♠/g, 's').replace(/♥/g, 'h').replace(/♦/g, 'd').replace(/♣/g, 'c').toUpperCase();
  }

  /* Patterns: AKs (suited), AQo (offsuit), 88 (pair), AK (either), A (rank),
     or exact As Kh / A♠ K♥. Order never matters. Invalid patterns match nothing. */
  function cardsMatch(cards, pattern) {
    const p = cardText(pattern).trim();
    if (!p) return true;
    const actual = (Array.isArray(cards) ? cards : []).map(cardText).filter(card => /^[2-9TJQKA][CDHS]$/.test(card));
    if (actual.length !== 2) return false;
    const compact = p.replace(/[\s,\[\]-]+/g, '');
    if (/^(?:[2-9TJQKA][CDHS]){2}$/.test(compact)) {
      return [compact.slice(0, 2), compact.slice(2, 4)].sort().join('') === [...actual].sort().join('');
    }
    if (/^[2-9TJQKA]$/.test(compact)) return actual.some(card => card[0] === compact);
    const rank = compact.match(/^([2-9TJQKA])([2-9TJQKA])([SO])?$/);
    if (!rank || (rank[1] === rank[2] && rank[3])) return false;
    if ([rank[1], rank[2]].sort().join('') !== actual.map(card => card[0]).sort().join('')) return false;
    return !rank[3] || (rank[3] === 'S') === (actual[0][1] === actual[1][1]);
  }

  function position(hand, replay) {
    if (typeof replay?.position === 'string') return replay.position;
    return engine()?.position(hand) || '';
  }

  function totalPot(hand, replay) {
    if (Number.isFinite(hand?.totalPot)) return hand.totalPot;
    if (replay?.final?.players) return replay.final.players.reduce((total, player) => total + (Number(player.total) || 0), 0);
    return null;
  }

  function matches(hand, replay, annotation, query = '', advanced = {}, canSeeResult = true) {
    if (!hand) return false;
    advanced = advanced && typeof advanced === 'object' ? advanced : {};
    const cards = heroCards(hand), tags = normalizeTags(annotation?.tags);
    const names = [hand.hero, ...(hand.players || []).map(player => player.name)].join(' ');
    const bag = folded([hand.id, hand.tournament, names, cards.join(' '), cards.map(card => card[0]).join(''), position(hand, replay), tags.join(' ')].join(' '));
    const q = String(query ?? '').trim();
    if (q && !cardsMatch(cards, q)) {
      // A full exact-card query is checked as a pair above; other words may mix
      // names, IDs and rank notation, for example "zaro AKs".
      if (!q.split(/\s+/).every(term => bag.includes(folded(term)) || cardsMatch(cards, term))) return false;
    }
    if (advanced.player && !folded(names).includes(folded(String(advanced.player).trim()))) return false;
    if (advanced.cards && !cardsMatch(cards, advanced.cards)) return false;
    if (advanced.position) {
      const sought = folded(String(advanced.position).trim());
      const current = folded(position(hand, replay));
      if (current !== sought && !current.split(/\s*\/\s*/).includes(sought)) return false;
    }
    if (advanced.tag && !tags.some(tag => folded(tag) === folded(String(advanced.tag).trim()))) return false;
    const hasBound = value => value !== undefined && value !== null && String(value).trim() !== '';
    if (hasBound(advanced.minPot) || hasBound(advanced.maxPot)) {
      if (!canSeeResult) return false;
      const pot = totalPot(hand, replay);
      if (!Number.isFinite(pot)) return false;
      for (const [key, test] of [['minPot', (value) => pot >= value], ['maxPot', (value) => pot <= value]]) {
        if (!hasBound(advanced[key])) continue;
        const bound = Number(String(advanced[key]).replace(',', '.'));
        if (!Number.isFinite(bound) || bound < 0 || !test(bound)) return false;
      }
    }
    return true;
  }

  /* records is [{id: tournamentId, text: rawHistory, handIds, count, hero, buyin}].
     Incoming hands come from PokerParser.parseHistory. Neither input is mutated.
     Each group is rebuilt from original hand blocks; existing hands win duplicates. */
  function libraryMerge(records, incomingHands) {
    const groups = new Map(), seen = new Set();
    const add = hand => {
      if (!hand || hand.id == null || hand.tournament == null || typeof hand.original !== 'string' || !hand.original.trim()) return;
      const id = String(hand.id), tournament = String(hand.tournament);
      if (seen.has(id)) return;
      seen.add(id);
      if (!groups.has(tournament)) groups.set(tournament, {id: tournament, text: '', handIds: [], count: 0, hero: '', buyin: String(hand.buyin || ''), blocks: []});
      const group = groups.get(tournament);
      group.handIds.push(id); group.blocks.push(hand.original); group.count++;
      if (!group.hero && hand.hero) group.hero = String(hand.hero);
      if (!group.buyin && hand.buyin) group.buyin = String(hand.buyin);
    };
    for (const record of Array.isArray(records) ? records : []) {
      if (typeof record?.text !== 'string') continue;
      const sourceParser = parser();
      if (!sourceParser) throw new Error('PokerParser must be loaded before merging the library.');
      for (const hand of sourceParser.parseHistory(record.text).hands) add(hand);
    }
    for (const hand of Array.isArray(incomingHands) ? incomingHands : []) add(hand);
    return [...groups.values()].map(({blocks, ...group}) => ({...group, text: blocks.reduce((text,block)=>text+(text&&!/[\r\n]$/.test(text)?'\n\n':'')+block,'')}));
  }

  /* cursor counts consumed events (the initial state has cursor 0).
     x reserves a small gap between one hand's end and the next hand's start. */
  function chartPoints(hands, compiled, current, cursor, spoilers) {
    const points = [];
    for (let index = 0; index < hands.length; index++) {
      if (spoilers && index > current) break;
      const hand = hands[index], bb = Number(hand.bigBlind);
      if (!(bb > 0)) continue;
      const hero = hand.players?.find(player => player.name === hand.hero);
      if (!hero || !Number.isFinite(hero.initial)) continue;
      points.push({hand: index, id: hand.id, x: index, value: hero.initial / bb, phase: 'start'});
      const replay = compiled instanceof Map ? (compiled.get(hand.id) || compiled.get(index)) : compiled?.[index];
      const finalHero = replay?.final?.players?.find(player => player.name === hand.hero);
      if ((!spoilers || index < current || cursor >= hand.events.length) && Number.isFinite(finalHero?.stack)) {
        points.push({hand: index, id: hand.id, x: index + .85, value: finalHero.stack / bb, phase: 'end'});
      }
    }
    return points;
  }

  /* A queue item is a hand note/favorite/tag or a marked decision. The optional
     predicate receives (handIndex, cursor) and can hide unseen decisions. */
  function reviewItems(hands, annotations, canReveal = () => true) {
    const result = [];
    hands.forEach((hand, index) => {
      const value = annotations?.[hand.tournament + ':' + hand.id] || {}, tags = normalizeTags(value.tags);
      const common = {hand: index, id: hand.id, tournament: hand.tournament, tags};
      if ((value.favorite || value.note || tags.length) && canReveal(index, 0)) {
        result.push({...common, cursor: 0, note: typeof value.note === 'string' ? value.note : '', reviewed: !!value.reviewed, type: 'hand'});
      }
      for (const [key, entry] of Object.entries(value.eventNotes || {}).sort((a, b) => Number(a[0]) - Number(b[0]))) {
        const cursor = Number(key);
        if (!/^(0|[1-9]\d*)$/.test(key) || !Number.isSafeInteger(cursor) || cursor > hand.events.length || !entry || typeof entry !== 'object' || !canReveal(index, cursor)) continue;
        result.push({...common, cursor, note: typeof entry.note === 'string' ? entry.note : '', reviewed: !!entry.reviewed, type: 'decision'});
      }
    });
    return result;
  }

  root.FeatureTools = {normalizeTags, heroCards, cardsMatch, matches, libraryMerge, chartPoints, reviewItems};
  if (typeof module !== 'undefined') module.exports = root.FeatureTools;
})(globalThis);
