(function (root) {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  function initial(hand) {
    return {players: hand.players.map(p => ({...p, stack: p.initial, total: 0, bet: 0, ante: 0, cards: [], folded: false, allIn: false, disconnected: false, action: '', won: 0})), board: [], street: 'setup', pot: 0, paid: 0, current: null, index: 0, issues: []};
  }
  function reduce(previous, event) {
    const s = clone(previous), p = s.players.find(p => p.name === event.player);
    s.current = event; s.index++;
    if (p) p.action = ({post: event.kind === 'ante' ? 'Ante' : event.kind?.toUpperCase(), call: 'Call', bet: 'Bet', raise: 'Raise', fold: 'Fold', check: 'Check', show: 'Revela', muck: 'Muck', collect: 'Recebe', return: 'Devolução'})[event.type] || event.text;
    if (event.type === 'street') {
      s.street = event.street;
      if (['flop','turn','river'].includes(event.street)) { s.players.forEach(p => {p.bet = 0; p.action = '';}); s.board = event.board; }
    }
    if (['post','call','bet','raise'].includes(event.type) && p) {
      const payment = event.type === 'raise' ? event.to - p.bet : event.amount;
      if (payment < -0.001 || payment > p.stack + 0.001) s.issues.push(`Linha ${event.line}: pagamento ${payment} incompatível com stack de ${p.stack}.`);
      // Preserve accounting evidence instead of silently capping a malformed payment.
      p.stack -= payment; p.total += payment; s.pot += payment;
      if (event.kind === 'ante') p.ante += payment; else p.bet += payment;
      p.allIn = event.allIn || p.stack === 0;
      if (event.kind === 'sb' || event.kind === 'bb') p.blind = event.kind.toUpperCase();
    }
    if (event.type === 'return' && p) {p.stack += event.amount; p.total -= event.amount; p.bet = Math.max(0, p.bet - event.amount); s.pot -= event.amount; p.allIn = p.stack === 0;}
    if (event.type === 'collect' && p) {p.stack += event.amount; p.won += event.amount; s.pot -= event.amount; s.paid += event.amount;}
    if (event.type === 'fold' && p) p.folded = true;
    if (['deal','show'].includes(event.type) && p) p.cards = event.cards;
    if (event.type === 'status' && p) {
      if (event.status === 'disconnected') p.disconnected = true;
      if (event.status === 'connected') p.disconnected = false;
      if (event.status === 'sittingOut') p.sittingOut = true;
      if (event.status === 'returned') p.sittingOut = false;
      if (event.status === 'eliminated') p.elimination = event.text;
      if (event.status === 'timeout') p.timedOut = true;
    }
    return s;
  }
  function pots(s) {
    const levels = [...new Set(s.players.map(p => p.total).filter(n => n > 0))].sort((a,b) => a-b);
    let last = 0; const result = [];
    for (const level of levels) {
      const contributors = s.players.filter(p => p.total >= level), eligible = contributors.filter(p => !p.folded).map(p => p.name);
      const value = (level-last)*contributors.length; last = level;
      const prior = result[result.length-1];
      if (prior && JSON.stringify(prior.eligible) === JSON.stringify(eligible)) prior.amount += value;
      else result.push({amount: value, eligible});
    }
    return result;
  }
  function compile(hand) {
    const snapshots = [initial(hand)]; for (const e of hand.events) snapshots.push(reduce(snapshots[snapshots.length-1], e));
    const final = snapshots[snapshots.length-1], issues = [...final.issues];
    const committed = final.players.reduce((n,p) => n+p.total,0);
    if (hand.complete && hand.totalPot !== null && Math.abs(committed-hand.totalPot) > .001) issues.push(`Pote calculado ${committed}; resumo ${hand.totalPot}.`);
    if (hand.complete && hand.totalPot !== null && Math.abs(final.paid + hand.rake - hand.totalPot) > .001) issues.push(`Pagamentos ${final.paid}; rake ${hand.rake}; pote ${hand.totalPot}.`);
    for (const p of final.players) if (hand.summaryWins[p.name] !== undefined && Math.abs(p.won-hand.summaryWins[p.name]) > .001) issues.push(`Pagamento de ${p.name} difere do resumo.`);
    const hero = final.players.find(p => p.name === hand.hero);
    const actions = hand.events.filter(e => e.street === 'preflop' && ['call','bet','raise'].includes(e.type));
    let raises = 0, rfi = false, threebet = false;
    for (const e of actions) {if (e.type === 'raise') {raises++; if (e.player === hand.hero && raises === 2) threebet = true;} if (e === actions[0] && e.type === 'raise' && e.player === hand.hero) rfi = true;}
    return {snapshots, final, issues, net: hero ? hero.stack-hero.initial : null, flags: {vpip: actions.some(e => e.player === hand.hero), rfi, threebet, heroAllin: hand.events.some(e => e.player === hand.hero && e.allIn), anyAllin: hand.events.some(e => e.allIn), showdown: hand.events.some(e => e.street === 'showdown')}};
  }
  function decision(s, name) {
    const p = s.players.find(p => p.name === name); if (!p || p.folded) return null;
    const call = Math.min(p.stack, Math.max(0, ...s.players.map(p => p.bet))-p.bet);
    return {call, odds: call > 0 ? call/(s.pot+call)*100 : null, limited: pots(s).length > 1};
  }
  function position(hand) {
    const seats = hand.players.map(p=>p.seat).sort((a,b)=>a-b), hero = hand.players.find(p=>p.name===hand.hero);
    if (!hero) return '—';
    const button = seats.indexOf(hand.button), offset = (seats.indexOf(hero.seat)-button+seats.length)%seats.length;
    if (offset === 0) return seats.length === 2 ? 'BTN / SB' : 'BTN';
    if (seats.length === 2) return 'BB';
    if (offset === 1) return 'SB'; if (offset === 2) return 'BB';
    const remaining = seats.length-offset;
    return remaining === 1 ? 'CO' : remaining === 2 ? 'HJ' : remaining === 3 ? 'LJ' : 'UTG' + (offset > 3 ? '+'+(offset-3) : '');
  }
  root.ReplayEngine = {initial, reduce, compile, pots, decision, position};
  if (typeof module !== 'undefined') module.exports = root.ReplayEngine;
})(globalThis);
