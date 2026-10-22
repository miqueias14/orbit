(function (root) {
  'use strict';

  const SUITS = {c: '♣', d: '♦', h: '♥', s: '♠'};
  const cleanText = (value, length) => String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, length || 160);
  const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const card = value => typeof value === 'string' && /^[2-9TJQKA][cdhs]$/.test(value) ? value : null;
  const cards = (value, count) => Array.from({length: count}, (_, i) => card(Array.isArray(value) ? value[i] : null));
  const positive = value => Math.max(0, finite(value, 0));

  function eventText(event, bigBlind, bb) {
    if (!event) return 'Início da mão';
    const name = cleanText(event.player, 64);
    const amount = value => format(positive(value), bigBlind, bb);
    const verbs = {fold: 'desistiu', check: 'passou', call: 'pagou', bet: 'apostou', raise: 'aumentou para', collect: 'recebeu', return: 'recebeu de volta', show: 'revelou as cartas', muck: 'descartou as cartas', deal: 'recebeu as cartas'};
    if (event.type === 'street') return ({preflop: 'Pré-flop', flop: 'Flop', turn: 'Turn', river: 'River', showdown: 'Showdown', summary: 'Resumo'})[event.street] || 'Início da mão';
    if (event.type === 'post') return `${name} colocou ${event.kind === 'ante' ? 'o ante' : cleanText(event.kind, 10).toUpperCase()} · ${amount(event.amount)}`;
    if (verbs[event.type]) return `${name} ${verbs[event.type]}${['call','bet','raise','collect','return'].includes(event.type) ? ' ' + amount(event.type === 'raise' ? event.to : event.amount) : ''}${event.allIn ? ' · all-in' : ''}`;
    return cleanText(event.text, 160) || 'Ação em andamento';
  }

  // Only the supplied replay state and explicit study cards can disclose cards.
  // Hand summaries and future hand events must never be consulted here.
  function createScene(hand, state, options) {
    if (!hand || !state || !Array.isArray(state.players)) throw new Error('Carregue uma mão antes de exportar a mesa.');
    options = options || {};
    const bigBlind = positive(hand.bigBlind) || 1;
    const ordered = state.players.slice(0, 12).map(p => ({
      name: cleanText(p.name, 80), seat: finite(p.seat, 0),
      stack: positive(p.stack), bet: positive(p.bet),
      cards: cards(p.cards && p.cards.length ? p.cards :
        options.studyCards && Object.prototype.hasOwnProperty.call(options.studyCards, p.name) ? options.studyCards[p.name] : [], 2),
      hero: p.name === hand.hero, dealer: p.seat === hand.button,
      folded: Boolean(p.folded), allIn: Boolean(p.allIn),
      sittingOut: Boolean(p.sittingOut), disconnected: Boolean(p.disconnected),
      blind: ['SB','BB'].includes(p.blind) ? p.blind : '',
      current: Boolean(state.current && state.current.player === p.name),
      action: cleanText(p.action, 40)
    })).sort((a, b) => a.seat - b.seat);
    const heroIndex = Math.max(0, ordered.findIndex(p => p.hero));
    const players = ordered.slice(heroIndex).concat(ordered.slice(0, heroIndex));
    return {
      width: 1000, height: 1480,
      title: cleanText(options.title, 100) || 'ORBIT REPLAY',
      handId: cleanText(hand.id, 60),
      handNumber: options.handNumber == null ? null : positive(options.handNumber),
      eventNumber: options.eventNumber == null ? positive(state.index) : positive(options.eventNumber),
      bigBlind, smallBlind: positive(hand.smallBlind), ante: positive(hand.ante),
      bb: Boolean(options.bb), fourColors: Boolean(options.fourColors),
      board: (Array.isArray(state.board) ? state.board : []).slice(0, 5).map(card),
      street: ({setup: 'INÍCIO', preflop: 'PRÉ-FLOP', flop: 'FLOP', turn: 'TURN', river: 'RIVER', showdown: 'SHOWDOWN', summary: 'RESUMO'})[state.street] || 'REPLAY',
      pot: positive(state.pot),
      actionText: cleanText(options.actionText, 200) || eventText(state.current, bigBlind, Boolean(options.bb)),
      players
    };
  }

  function format(value, bigBlind, bb) {
    const number = bb ? value / bigBlind : value;
    return number.toLocaleString('pt-BR', {maximumFractionDigits: bb ? 2 : 2}) + (bb ? ' BB' : '');
  }
  function rounded(ctx, x, y, w, h, radius, fill, stroke, lineWidth) {
    const r = Math.max(0, Math.min(radius, w / 2, h / 2));
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
    if (fill) {ctx.fillStyle = fill; ctx.fill();}
    if (stroke) {ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth || 1; ctx.stroke();}
  }
  function ellipse(ctx, x, y, rx, ry, fill, stroke, lineWidth) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    if (fill) {ctx.fillStyle = fill; ctx.fill();}
    if (stroke) {ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth || 1; ctx.stroke();}
  }
  function text(ctx, value, x, y, size, color, weight, maxWidth, align) {
    const fontWeight=Math.max(100,Math.min(900,Math.round((weight||500)/100)*100));
    ctx.font = `${fontWeight} ${size}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
    let label = cleanText(value, 240);
    if (maxWidth && ctx.measureText(label).width > maxWidth) {
      while (label.length && ctx.measureText(label + '…').width > maxWidth) label = label.slice(0, -1);
      label += '…';
    }
    ctx.fillText(label, x, y);
  }
  function drawCard(ctx, value, x, y, w, h, fourColors) {
    if (!value) {
      rounded(ctx, x, y, w, h, 8, '#352355', '#786397', 1.5);
      rounded(ctx, x + 5, y + 5, w - 10, h - 10, 4, null, '#64507f', 1);
      const cx=x+w/2,cy=y+h/2,r=w*.17;
      ctx.beginPath();ctx.moveTo(cx,cy-r);ctx.lineTo(cx+r,cy);ctx.lineTo(cx,cy+r);ctx.lineTo(cx-r,cy);ctx.closePath();ctx.strokeStyle='#b6a0d2';ctx.lineWidth=1.5;ctx.stroke();
      return;
    }
    const rank = value[0] === 'T' ? '10' : value[0];
    const colors = fourColors ? {c: '#177750', d: '#2365b9', h: '#c32e51', s: '#202136'} : {c: '#202136', d: '#c32e51', h: '#c32e51', s: '#202136'};
    rounded(ctx, x, y, w, h, 8, '#faf8ff', '#ffffff', 1);
    text(ctx, rank, x + 9, y + 17, w * .38, colors[value[1]], 800, w - 12, 'left');
    text(ctx, SUITS[value[1]], x + w / 2, y + h * .68, w * .68, colors[value[1]], 600);
  }
  function wrap(ctx, value, x, y, maxWidth, lineHeight, maxLines) {
    const words = cleanText(value, 240).split(' '); const lines = []; let line = '';
    for (const word of words) {
      if (line && ctx.measureText(line + ' ' + word).width > maxWidth) {lines.push(line); line = word;}
      else line += (line ? ' ' : '') + word;
    }
    if (line) lines.push(line);
    lines.slice(0, maxLines).forEach((item, i) => text(ctx, item + (i === maxLines - 1 && lines.length > maxLines ? '…' : ''), x, y + i * lineHeight, 23, '#e5ddf2', 500, maxWidth));
  }

  function render(canvas, scene) {
    if (!canvas || typeof canvas.getContext !== 'function') throw new Error('Seu navegador não oferece a exportação da mesa.');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível criar a imagem da mesa.');
    canvas.width = 1000; canvas.height = 1480;
    const background = ctx.createLinearGradient(0, 0, 1000, 1480);
    background.addColorStop(0, '#181021'); background.addColorStop(1, '#09090f');
    ctx.fillStyle = background; ctx.fillRect(0, 0, 1000, 1480);
    rounded(ctx, 46, 42, 7, 52, 3, '#a881ff');
    text(ctx, scene.title, 72, 62, 30, '#faf7ff', 800, 800, 'left');
    const handLabel = scene.handNumber ? `Mão ${scene.handNumber}` : 'Mão';
    text(ctx, `${handLabel} · #${scene.handId}`, 72, 102, 19, '#aea3bf', 500, 850, 'left');
    text(ctx, `${format(scene.smallBlind, scene.bigBlind, scene.bb)} / ${format(scene.bigBlind, scene.bigBlind, scene.bb)}${scene.ante ? ' · Ante ' + format(scene.ante, scene.bigBlind, scene.bb) : ''}`, 500, 154, 20, '#c9badc', 500, 900);

    ellipse(ctx, 500, 741, 399, 522, '#09070e', '#31253f', 6);
    ellipse(ctx, 500, 736, 383, 504, '#261b36', '#51405f', 13);
    const felt = ctx.createLinearGradient(150, 250, 850, 1230);
    felt.addColorStop(0, '#35234d'); felt.addColorStop(1, '#20162f');
    ellipse(ctx, 500, 736, 365, 487, felt, '#73518d', 2);
    ellipse(ctx, 500, 736, 328, 445, null, '#5d416b', 1);

    text(ctx, scene.street, 500, 520, 18, '#b5a1cc', 750);
    text(ctx, 'POTE', 500, 558, 17, '#c6b1de', 750);
    text(ctx, format(scene.pot, scene.bigBlind, scene.bb), 500, 605, 44, '#ffffff', 800, 430);
    const cardWidth = 72, cardGap = 12, start = 500 - (5 * cardWidth + 4 * cardGap) / 2;
    for (let i = 0; i < 5; i++) {
      if (i < scene.board.length && scene.board[i]) drawCard(ctx, scene.board[i], start + i * (cardWidth + cardGap), 655, cardWidth, 103, scene.fourColors);
      else rounded(ctx, start + i * (cardWidth + cardGap), 655, cardWidth, 103, 8, '#24192f', '#513b65', 1);
    }
    rounded(ctx, 330, 804, 340, 104, 16, '#1b1327', '#523b6b', 1);
    ctx.font = '500 23px system-ui, -apple-system, "Segoe UI", Arial, sans-serif';
    wrap(ctx, scene.actionText, 500, 843, 300, 29, 2);

    const count = scene.players.length;
    scene.players.forEach((player, i) => {
      const angle = Math.PI / 2 + i * Math.PI * 2 / Math.max(1, count);
      const x = 500 + Math.cos(angle) * 365;
      const y = 742 + Math.sin(angle) * 484;
      const w = player.hero ? 210 : 184;
      const h = 89;
      ctx.save();
      if (player.folded) ctx.globalAlpha = .64;
      if (player.current) rounded(ctx, x - w / 2 - 5, y - 5, w + 10, h + 10, 19, '#64458a');
      const holeW = player.hero ? 49 : 39, holeH = player.hero ? 70 : 56;
      drawCard(ctx, player.cards[0], x - holeW - 3, y - holeH - 11, holeW, holeH, scene.fourColors);
      drawCard(ctx, player.cards[1], x + 3, y - holeH - 11, holeW, holeH, scene.fourColors);
      rounded(ctx, x - w / 2, y, w, h, 15, player.hero ? '#392553' : '#17131f', player.hero ? '#bc97ff' : player.current ? '#b894ee' : '#55445f', player.hero ? 2.5 : 1.5);
      text(ctx, player.name, x, y + 24, player.hero ? 20 : 19, '#f4effa', 750, w - 20);
      text(ctx, format(player.stack, scene.bigBlind, scene.bb), x, y + 57, player.hero ? 25 : 24, player.hero ? '#e1c9ff' : '#dcd2e6', 750, w - 18);
      const status = player.allIn ? 'ALL-IN' : player.folded ? 'FOLD' : player.disconnected ? 'DESCONECTADO' : player.sittingOut ? 'AUSENTE' : player.action;
      if (status) {
        rounded(ctx, x - w / 2 + 12, y + h - 4, w - 24, 27, 8, player.allIn ? '#8f682b' : '#322442');
        text(ctx, status, x, y + h + 10, 14, player.allIn ? '#fff1cf' : '#c5b4d6', 750, w - 35);
      }
      ctx.restore();
      if (player.hero) text(ctx, 'VOCÊ', x, y + h + 43, 14, '#c9a6ff', 800, 150);
      if (player.dealer) {
        ellipse(ctx, x + w / 2 - 2, y - 13, 15, 15, '#ede5f5', '#776184', 2);
        text(ctx, 'D', x + w / 2 - 2, y - 12, 17, '#271731', 900);
      }
      if (player.blind) {
        rounded(ctx, x - w / 2 - 8, y - 22, 42, 26, 8, '#4f3a68', '#9677b3', 1);
        text(ctx, player.blind, x - w / 2 + 13, y - 9, 14, '#f0e6ff', 800);
      }
      if (player.bet > 0) {
        const bx = 500 + Math.cos(angle) * 240;
        const by = 742 + Math.sin(angle) * 337 + (Math.sin(angle) > .8 ? 8 : 0);
        const label = format(player.bet, scene.bigBlind, scene.bb);
        ctx.font = '700 18px system-ui, -apple-system, "Segoe UI", Arial, sans-serif';
        const chipWidth = Math.min(174, Math.max(92, ctx.measureText(label).width + 34));
        rounded(ctx, bx - chipWidth / 2, by - 17, chipWidth, 34, 17, '#221930', '#9475b4', 1);
        text(ctx, label, bx, by, 18, '#eadcf7', 700, chipWidth - 14);
      }
    });

    ctx.fillStyle = '#34273f'; ctx.fillRect(48, 1380, 904, 1);
    text(ctx, `Ação ${scene.eventNumber} · ${scene.bb ? 'Valores em big blinds' : 'Valores em fichas'}`, 48, 1414, 18, '#b5a7c4', 500, 650, 'left');
    text(ctx, 'ORBIT REPLAY', 952, 1446, 15, '#8d7b9f', 700, 250, 'right');
    return canvas;
  }

  function exportPNG(hand, state, options) {
    return new Promise((resolve, reject) => {
      try {
        if (typeof document === 'undefined' || typeof document.createElement !== 'function') throw new Error('A exportação de imagem está disponível no navegador.');
        const scene = createScene(hand, state, options);
        const canvas = render(document.createElement('canvas'), scene);
        if (typeof canvas.toBlob !== 'function') throw new Error('Seu navegador não oferece a exportação PNG.');
        canvas.toBlob(blob => {
          if (blob && blob.size > 0) resolve(blob);
          else reject(new Error('Não foi possível gerar a imagem. Tente exportar novamente.'));
        }, 'image/png');
      } catch (error) {reject(error);}
    });
  }

  root.TableExport = {createScene, render, exportPNG};
  if (typeof module !== 'undefined' && module.exports) module.exports = root.TableExport;
})(globalThis);
