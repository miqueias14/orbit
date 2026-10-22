/* PokerStars English tournament histories. No network or DOM dependencies. */
(function (root) {
  'use strict';
  const amount = s => Number(String(s).replace(/[, $€£]/g, ''));
  const cards = s => (s.match(/\b[2-9TJQKA][cdhs]\b/g) || []);
  function parseHistory(input) {
    const source = String(input).replace(/^([ \t]*)\uFEFF/gm, '$1');
    const sourceStarts = [...source.matchAll(/^[ \t]*PokerStars Hand #/gm)];
    const normalized = source.replace(/\r\n?/g, '\n').split('\n').map(line => line.trim()).join('\n');
    const starts = [...normalized.matchAll(/^PokerStars Hand #/gm)];
    const hands = [], warnings = [], seen = new Set();
    starts.forEach((start, index) => {
      const original = source.slice(sourceStarts[index].index, sourceStarts[index + 1]?.index ?? source.length);
      const lines = normalized.slice(start.index, starts[index + 1]?.index ?? normalized.length).split('\n');
      const header = lines[0].match(/^PokerStars Hand #(\d+):\s*Tournament #(\d+),\s*(.*?)\s+Hold'em No Limit.*?\(([\d,.]+)\/([\d,.]+)\)/);
      const lineBase = normalized.slice(0, start.index).split('\n').length;
      const warn = (line, message) => warnings.push({hand: header?.[1] || String(index + 1), line: lineBase + line, message});
      if (!header) { warn(0, 'Cabeçalho não compatível.'); return; }
      if (seen.has(header[1])) { warn(0, 'Mão duplicada ignorada.'); return; }
      seen.add(header[1]);
      const hand = {id: header[1], tournament: header[2], buyin: header[3], smallBlind: amount(header[4]), bigBlind: amount(header[5]), original, players: [], events: [], summaryCards: {}, summaryWins: {}, summaryPots: [], totalPot: null, rake: 0, hero: null, button: null, ante: 0, complete: false};
      let summary = false, street = 'setup';
      const push = (type, line, data = {}) => hand.events.push({type, street, line: lineBase + line, text: lines[line].trim(), ...data});
      lines.forEach((raw, i) => {
        const text = raw.trim(); let m;
        if (!text || i === 0) return;
        if ((m = text.match(/^Table '(.*)' (\d+)-max Seat #(\d+) is the button/))) { hand.table = m[1]; hand.maxSeats = +m[2]; hand.button = +m[3]; return; }
        if (text === '*** SUMMARY ***') { summary = true; hand.complete = true; return; }
        if (summary) {
          if ((m = text.match(/^Total pot ([\d,.]+).*?\| Rake ([\d,.]+)/))) {
            hand.totalPot = amount(m[1]); hand.rake = amount(m[2]);
            hand.summaryPots = [...text.matchAll(/(Main pot|Side pot(?:-\d+)?) ([\d,]+)(?:\.|\s|$)/g)].map(p => ({label: p[1], amount: amount(p[2])}));
          }
          for (const p of hand.players) if (text.startsWith(`Seat ${p.seat}: ${p.name} `)) {
            const shown = text.match(/(?:showed|mucked) \[([^\]]+)\]/); if (shown) hand.summaryCards[p.name] = cards(shown[1]);
            const won = text.match(/(?:won|collected) \(([\d,.]+)\)/); if (won) hand.summaryWins[p.name] = amount(won[1]);
          }
          return;
        }
        if ((m = text.match(/^Seat (\d+): (.+) \(([\d,.]+) in chips\)(.*)$/))) { hand.players.push({seat: +m[1], name: m[2], initial: amount(m[3]), sittingOut: /sitting out/.test(m[4])}); return; }
        if ((m = text.match(/^\*\*\* (HOLE CARDS|FLOP|TURN|RIVER|SHOW DOWN) \*\*\*(.*)/))) {
          street = ({'HOLE CARDS': 'preflop', FLOP: 'flop', TURN: 'turn', RIVER: 'river', 'SHOW DOWN': 'showdown'})[m[1]];
          push('street', i, {board: cards(m[2])}); return;
        }
        if ((m = text.match(/^Dealt to (.+) \[([^\]]+)\]/))) { hand.hero = m[1]; push('deal', i, {player: m[1], cards: cards(m[2])}); return; }
        if ((m = text.match(/^Uncalled bet \(([\d,.]+)\) returned to (.+)$/))) { push('return', i, {player: m[2], amount: amount(m[1])}); return; }
        if ((m = text.match(/^(.+) collected ([\d,.]+) from (.+)$/))) { push('collect', i, {player: m[1], amount: amount(m[2]), pot: m[3]}); return; }
        const player = hand.players.find(p => text.startsWith(p.name + ': '));
        if (player) {
          const action = text.slice(player.name.length + 2), data = {player: player.name, allIn: /all-in/.test(action)};
          if ((m = action.match(/^posts (the ante|small blind|big blind|small & big blinds) ([\d,.]+)/))) {
            const kind = m[1] === 'the ante' ? 'ante' : m[1] === 'small blind' ? 'sb' : m[1] === 'big blind' ? 'bb' : 'blinds';
            if (kind === 'ante') hand.ante = Math.max(hand.ante, amount(m[2]));
            push('post', i, {...data, kind, amount: amount(m[2])}); return;
          }
          if ((m = action.match(/^(calls|bets) ([\d,.]+)/))) { push(m[1] === 'calls' ? 'call' : 'bet', i, {...data, amount: amount(m[2])}); return; }
          if ((m = action.match(/^raises ([\d,.]+) to ([\d,.]+)/))) { push('raise', i, {...data, amount: amount(m[1]), to: amount(m[2])}); return; }
          if (/^folds/.test(action)) { push('fold', i, data); return; }
          if (/^checks/.test(action)) { push('check', i, data); return; }
          if ((m = action.match(/^shows \[([^\]]+)\]/))) { push('show', i, {...data, cards: cards(m[1])}); return; }
          if (/^(mucks|doesn't show)/.test(action)) { push('muck', i, data); return; }
          warn(i, 'Ação não reconhecida, preservada como evento.'); push('info', i, data); return;
        }
        const actor = [...hand.players].sort((a,b) => b.name.length-a.name.length).find(p => text.startsWith(p.name + ' '));
        if (actor) {
          const status = /is disconnected/.test(text) ? 'disconnected' : /is connected/.test(text) ? 'connected' : /is sitting out/.test(text) ? 'sittingOut' : /has returned/.test(text) ? 'returned' : /timed out/.test(text) ? 'timeout' : /finished the tournament/.test(text) ? 'eliminated' : 'info';
          push('status', i, {player: actor.name, status}); return;
        }
        push('info', i); warn(i, 'Linha não reconhecida preservada.');
      });
      if (!hand.players.length) { warn(1, 'Mão sem assentos válidos ignorada.'); return; }
      if (!hand.complete) warn(lines.length - 1, 'Mão incompleta: replay disponível até o último evento.');
      if (!hand.hero) warn(0, 'Cartas do herói não identificadas.');
      hands.push(hand);
    });
    if (!starts.length) warnings.push({hand: '—', line: 1, message: 'Nenhum cabeçalho PokerStars Hand # encontrado.'});
    return {hands, warnings};
  }
  root.PokerParser = {parseHistory, amount, cards};
  if (typeof module !== 'undefined') module.exports = root.PokerParser;
})(globalThis);
