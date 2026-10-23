/* Browser-only controller. Classic scripts also work under file://. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id), el = (tag, cls, text) => {const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n;};
  const key = 'orbit-replay-v1';
  const sessionHistoryKey = 'orbit-session-history-v1', sessionPositionKey = 'orbit-session-position-v1';
  let sessionStored = false, sessionTimer, editingDecision = null, activeSessionId = null;
  let pausedDecision = null, bypassDecision = null;
  let studio = null, settings = null;
  let saved = {annotations: {}, prefs: {}}, storage = true, hands = [], compiled = [], warnings = [], current = 0, cursor = 0, timer = null, playing = false, selected = new Set(), filtered = [], toastTimer;
  try {const raw = localStorage.getItem(key); if (raw) {const parsed = JSON.parse(raw); for(const [k,v] of Object.entries(parsed.annotations || {}))if(/^\d+:\d+$/.test(k))saved.annotations[k]=StudyTools.cleanAnnotation(v); saved.prefs = parsed.prefs && typeof parsed.prefs==='object' && !Array.isArray(parsed.prefs) ? parsed.prefs : {}; delete saved.prefs['training-toggle'];} localStorage.setItem(key, JSON.stringify(saved));} catch {storage = false;}
  function persist() {try {if (storage) localStorage.setItem(key, JSON.stringify(saved));} catch {storage = false;} if (!storage) $('storage-status').textContent = 'Armazenamento indisponível · alterações só nesta sessão';}
  persist();
  const hand = () => hands[current], replay = () => compiled[current], state = () => replay()?.snapshots[cursor];
  const annotationKey = h => h.tournament + ':' + h.id;
  const annotation = h => saved.annotations[annotationKey(h)] || {};
  function savePosition() {
    clearTimeout(sessionTimer);
    if (!hand() || !sessionStored) return;
    try {localStorage.setItem(sessionPositionKey, JSON.stringify({sessionId:activeSessionId,tournament:hand().tournament, hand:hand().id, cursor}));studio?.rememberPosition();}
    catch {sessionStored=false; $('storage-status').textContent='Posição não salva · armazenamento indisponível';}
  }
  function rememberHistory(text) {
    // One atomic write commits the new history with a usable initial position.
    // The old history and its position remain intact if this write exceeds quota.
    sessionStored=false;
    try {
      const id=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
      const position={tournament:hand().tournament,hand:hand().id,cursor};
      localStorage.setItem(sessionHistoryKey,JSON.stringify({version:2,id,text,position}));
      activeSessionId=id;sessionStored=true;
      $('storage-status').textContent='Sessão salva neste dispositivo · retomada automática'; savePosition();
    } catch {
      sessionStored=false; $('storage-status').textContent='Histórico apenas nesta sessão · não foi possível salvar';
      toast('Novo histórico disponível nesta sessão. A sessão salva anteriormente foi preservada.');
    }
  }
  function updateAnnotation(change) {if (!hand()) return; const k = annotationKey(hand()); saved.annotations[k] = {...annotation(hand()), ...change}; persist();}
  let bb = saved.prefs.bb===true;
  const fmt = value => (value / (bb && hand() ? hand().bigBlind : 1)).toLocaleString('pt-BR', {maximumFractionDigits: bb ? 2 : 2}) + (bb ? ' BB' : '');
  const spoilersActive = () => $('spoilers').checked;
  const hiddenFuture = index => spoilersActive() && !(index === current && cursor === compiled[index].snapshots.length-1);
  const suitMap = {s:'♠', h:'♥', d:'♦', c:'♣'};
  let boardSignature = '', actionSignature = '', listSignature = '', seatHand = null;
  const seatNodes = new Map();
  function card(code, ghost = false) {
    const n = el('span', 'card' + (ghost ? ' ghost' : !code ? ' back' : /[hd]$/.test(code) ? ' red' : ''));
    if (ghost) {n.setAttribute('aria-hidden','true'); return n;}
    if (!code) {n.textContent = '◈'; n.setAttribute('aria-label','Carta desconhecida'); return n;}
    n.dataset.suit=code[1];n.classList.add('suit-'+code[1]);
    n.append(el('span','rank',code[0] === 'T' ? '10' : code[0]), el('span','suit',suitMap[code[1]])); n.setAttribute('aria-label',code); return n;
  }
  function toast(message) {clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false; toastTimer = setTimeout(() => {$('toast').hidden = true;}, 4300);}
  function stop() {clearTimeout(timer); timer = null; playing = false; $('play').textContent = pausedDecision===current+':'+cursor?'▶ Continuar':'▶ Reproduzir'; $('play').setAttribute('aria-label',pausedDecision?'Revelar sua decisão e continuar':'Reproduzir');}
  function skipAntes(index) {
    const events = hand().events;
    while (index < events.length && events[index].type === 'post' && events[index].kind === 'ante') index++;
    return index;
  }
  function seek(index) {pausedDecision=null;bypassDecision=null;stop(); if (!hand()) return; const target=skipAntes(Math.max(0,Math.min(index,replay().snapshots.length-1)));cursor=target; render();}
  function go(index) {pausedDecision=null;bypassDecision=null;stop(); if (index < 0 || index >= hands.length) return; current = index; cursor = Math.max(0,hand().events.findIndex(e=>e.type==='deal')+1); $('notes').value = annotation(hand()).note || ''; $('study-reveal').checked = false; render();}
  function matchingHands() {
    const q=$('search').value.trim(),filter=$('filter').value;
    return hands.map((_,i)=>i).filter(i=>FeatureTools.matches(hands[i],compiled[i],annotation(hands[i]),q,studio?.advanced(hands[i])||{},!hiddenFuture(i))&&
      (!['positive','negative'].includes(filter)||!hiddenFuture(i))&&
      (filter==='all'||(filter==='favorite'?annotation(hands[i]).favorite:filter==='positive'?compiled[i].net>0:filter==='negative'?compiled[i].net<0:compiled[i].flags[filter])));
  }
  function adjacentHand(direction) {
    const queue=matchingHands();
    return direction>0?queue.find(i=>i>current):queue.slice().reverse().find(i=>i<current);
  }
  function changeHand(direction) {const target=adjacentHand(direction);if(target!==undefined)go(target);}
  function tick() {
    if (!playing || !hand()) return;
    cursor = skipAntes(cursor);
    const last = replay().snapshots.length-1;
    if (cursor >= last) {
      const following=adjacentHand(1);
      if ($('continuous').checked && following!==undefined) {go(following); playing = true;}
      else {stop(); return;}
    }
    const decisionKey=current+':'+cursor;
    if ($('hero-pause').checked && StudyTools.isHeroDecision(hand(),cursor) && bypassDecision!==decisionKey) {pausedDecision=decisionKey;stop();toast('Sua decisão. Toque em Continuar para revelar e seguir.');return;}
    pausedDecision=null;bypassDecision=null;cursor = skipAntes(cursor + 1); render(); schedule();
  }
  function schedule() {clearTimeout(timer); if (!playing) return; $('play').textContent = 'Ⅱ Pausar'; $('play').setAttribute('aria-label','Pausar'); const extra=ViewerTools.important(state()?.current)?Number($('moment-pause').value):0; timer = setTimeout(tick, 1000 / +$('speed').value + extra);}
  function play() {
    if(!hand())return;
    if(playing){stop();return;}
    const queue=matchingHands();if(!queue.length)return;
    if(!queue.includes(current))go(queue.find(i=>i>current)??queue[0]);
    if(cursor===replay().snapshots.length-1){
      const following=adjacentHand(1);
      if($('continuous').checked&&following!==undefined)go(following);
      else cursor=skipAntes(0);
    }
    if(!matchingHands().includes(current)){stop();render();return;}
    pausedDecision=null;bypassDecision=$('hero-pause').checked&&StudyTools.isHeroDecision(hand(),cursor)?current+':'+cursor:null;
    playing=true;render();schedule();
  }
  function describe(e) {
    const p = e.player ? e.player + ' · ' : '';
    if (e.type === 'street') return ({preflop:'Pré-flop',flop:'Flop',turn:'Turn',river:'River',showdown:'Showdown'})[e.street];
    if (e.type === 'post') return p + (e.kind === 'ante' ? 'ante ' : e.kind === 'sb' ? 'small blind ' : 'big blind ') + fmt(e.amount) + (e.allIn?' · all-in':'');
    if (e.type === 'raise') return p + 'aumentou para ' + fmt(e.to) + (e.allIn?' · all-in':'');
    if (e.type === 'call' || e.type === 'bet') return p + (e.type === 'call'?'pagou ':'apostou ') + fmt(e.amount) + (e.allIn?' · all-in':'');
    if (e.type === 'fold') return p + 'desistiu'; if (e.type === 'check') return p + 'passou';
    if (e.type === 'return') return p + 'recebe de volta ' + fmt(e.amount);
    if (e.type === 'collect') return p + 'recebe ' + fmt(e.amount) + ' · ' + e.pot;
    if (e.type === 'deal') return p + 'recebe suas cartas';
    if (e.type === 'show') return p + 'revela ' + e.cards.join(' ');
    if (e.type === 'muck') return p + 'não revela';
    if (e.type === 'status') return p + (({disconnected:'desconectado',connected:'reconectado',sittingOut:'sitting out',returned:'retornou',timeout:'tempo esgotado',eliminated: e.text})[e.status] || e.text);
    return e.text;
  }
  function renderList() {
    const filter = $('filter').value;
    document.querySelectorAll('[data-filter]').forEach(n=>n.setAttribute('aria-pressed',String(n.dataset.filter===filter)));
    filtered = matchingHands();
    $('hand-list').replaceChildren();
    for (const i of filtered) {
      const h = hands[i], r = compiled[i], row = el('div','hand-row'+(current===i?' selected':''));
      const check = el('input'); check.type = 'checkbox'; check.checked = selected.has(i); check.setAttribute('aria-label','Selecionar mão '+h.id); check.onchange = () => {check.checked ? selected.add(i) : selected.delete(i); renderSelection();};
      const open = el('button','hand-open'); open.setAttribute('aria-label',`Abrir mão ${i+1}, ID ${h.id}`); open.onclick = () => {go(i); setTab('table');};
      const top = el('span','row-top'); const dealt = h.events.find(e => e.type === 'deal');
      top.append(el('span','',String(i+1).padStart(2,'0')), el('span','mini-cards',dealt?.cards.map(c=>c[0]+suitMap[c[1]]).join(' ') || '—'), el('span','muted',ReplayEngine.position(h)));
      const bottom = el('span','row-bottom'); bottom.append(el('span','',`${h.smallBlind}/${h.bigBlind}`), el('span',hiddenFuture(i)?'':r.net>0?'positive':r.net<0?'negative':'',hiddenFuture(i)?'•••':(r.net>0?'+':'')+(r.net??0).toLocaleString('pt-BR')));
      open.append(top,bottom); open.title = '#'+h.id;
      const star = el('button','star',annotation(h).favorite?'★':'☆'); star.setAttribute('aria-label','Favoritar mão '+h.id); star.setAttribute('aria-pressed',String(!!annotation(h).favorite)); star.onclick = () => {stop();const k = annotationKey(h); saved.annotations[k] = {...annotation(h),favorite:!annotation(h).favorite}; persist(); renderList(); render();};
      row.append(check,open,star); $('hand-list').append(row);
    }
    if (!filtered.length) $('hand-list').append(el('p','empty-copy',hands.length?'Nenhuma mão corresponde a este filtro.':'Importe seu histórico para explorar as mãos da sessão.'));
    $('filtered-count').textContent = `${filtered.length} de ${hands.length} mãos`; renderSelection();
  }
  function renderSelection() {$('selection-count').textContent = '('+selected.size+')'; $('export-hands').disabled = selected.size === 0;}
  function render() {
    const h = hand(), r = replay(), s = state(), loaded = !!h, queue=matchingHands();
    document.body.classList.toggle('has-history', loaded);
    $('clear-session').hidden=!loaded;
    for (const id of ['play','start','end','prev','next','favorite','copy','units','notes','study-reveal','timeline','next-decision','mark-decision']) $(id).disabled = !loaded;
    $('prev-hand').disabled = !loaded || adjacentHand(-1)===undefined; $('next-hand').disabled = !loaded || adjacentHand(1)===undefined;
    if (!loaded) {document.querySelectorAll('[data-street]').forEach(n=>n.disabled=true); $('hand-summary').hidden=true;$('showdown-results').hidden=true;studio?.render();settings?.sync(); return;}
    $('start').disabled = $('prev').disabled = cursor<=skipAntes(0); $('end').disabled = $('next').disabled = cursor===r.snapshots.length-1;
    if(!queue.length)for(const id of ['play','start','end','prev','next','timeline'])$(id).disabled=true;
    $('units').textContent = bb ? 'BB ⇄ Fichas' : 'Fichas ⇄ BB';
    $('tournament-title').textContent = `Torneio #${h.tournament}`;
    $('session-meta').textContent = `${h.buyin} · ${h.maxSeats || h.players.length}-max\nBlinds ${h.smallBlind}/${h.bigBlind} · Ante ${h.ante}`;
    $('hand-count').textContent = hands.length;
    $('hand-number').textContent = `MÃO ${String(current+1).padStart(2,'0')} DE ${hands.length} · ${h.players.length} JOGADORES`;
    $('hand-title').textContent = `Mão ${current+1}`;
    $('hand-title').title = 'ID #'+h.id;
    $('favorite').textContent = annotation(h).favorite?'★':'☆'; $('favorite').setAttribute('aria-pressed',String(!!annotation(h).favorite));
    $('table-center').querySelector('.eyebrow').textContent = s.paid > 0 ? 'DISTRIBUIÇÃO REGISTRADA' : 'POTE TOTAL';
    const nextBoard = s.board.join(' ');
    if (boardSignature !== nextBoard || !$('board').childElementCount) {
      boardSignature = nextBoard;
      $('board').replaceChildren(); for (let i=0;i<5;i++) $('board').append(card(s.board[i],!s.board[i]));
    }
    $('pot').textContent = fmt(s.pot) + (s.paid ? ` · pago ${fmt(s.paid)}`:'');
    const layers = ReplayEngine.pots(s), done = cursor===r.snapshots.length-1;
    const participants=ViewerTools.participants(s);
    $('players-in-hand').textContent=done?(h.complete?'Mão encerrada':'Fim dos eventos disponíveis'):participants.active+(participants.active===1?' jogador na disputa':' jogadores na disputa')+(participants.allIn?' · '+participants.allIn+' all-in':'');
    const heroDecision = queue.includes(current)&&StudyTools.isHeroDecision(h,cursor);
    const nextDecision = StudyTools.nextDecision(hands,current,cursor,queue);
    $('next-decision').disabled=!nextDecision;
    $('next-decision').textContent=heroDecision?'Revelar minha decisão →':'Minha próxima decisão ↗';
    $('mark-decision').textContent=annotation(h).eventNotes?.[cursor]?'★ Jogada marcada':'☆ Marcar jogada';
    $('mark-decision').setAttribute('aria-pressed',String(!!annotation(h).eventNotes?.[cursor]));
    const upcoming=h.events[cursor], nextActor=upcoming && ['fold','call','check','bet','raise'].includes(upcoming.type) ? upcoming.player : null;
    $('decision-context').textContent=!queue.length?'Nenhuma mão neste filtro. Selecione Todas para continuar.':!queue.includes(current)?'Mão atual fora do filtro. Reproduzir abre uma mão da lista.':heroDecision?'Sua decisão · pense antes de revelar':nextActor?'Próximo a agir: '+nextActor:done?'Mão concluída':'';
    $('decision-context').classList.toggle('hero-turn',heroDecision);
    const displayedPots = done && h.summaryPots.length ? h.summaryPots : layers.length>1 ? layers.map((p,i)=>({label:i?'Paralelo '+i:'Principal',amount:p.amount})) : [];
    $('side-pots').textContent = displayedPots.map(p=>`${p.label.replace('Main pot','Principal').replace('Side pot','Paralelo')}: ${fmt(p.amount)}`).join(' · ');
    $('street-label').textContent = ({setup:'Antes e blinds',preflop:'Pré-flop',flop:'Flop',turn:'Turn',river:'River',showdown:'Showdown'})[s.street];
    let players = [...s.players].sort((a,b)=>a.seat-b.seat), heroIndex = players.findIndex(p=>p.name===h.hero); if (heroIndex < 0) heroIndex = 0;
    players = [...players.slice(heroIndex),...players.slice(0,heroIndex)];
    $('arena').dataset.playerCount=players.length;
    if (seatHand !== h) {seatHand = h; seatNodes.clear(); $('seats').replaceChildren();}
    players.forEach((p,i) => {
      const a = i/players.length*Math.PI*2, x = 50-Math.sin(a)*38, y = 50+Math.cos(a)*40;
      let view = seatNodes.get(p.name);
      if (!view) {
        const seat=el('div','seat'), hole=el('div','seat-cards'), box=el('div','seat-box'), stack=el('div','seat-stack'), status=el('div','seat-status'), action=el('div','seat-action'), bet=el('span','seat-bet'), blind=el('span','blind');
        const identity=el('div','seat-identity'),position=el('span','seat-position',ViewerTools.position(h,p.name)),name=el('div','seat-name',p.name);
        name.title=p.name;position.title='Posição inicial na mão: '+position.textContent;identity.append(position,name);
        box.append(identity,stack,status,blind);
        if(p.seat===h.button) box.append(el('span','dealer','D'));
        seat.append(hole,box,action); $('seats').append(seat,bet);
        bet.dataset.seatIndex=i;
        bet.style.setProperty('--bet-x',(50-Math.sin(a)*27)+'%');bet.style.setProperty('--bet-y',(50+Math.cos(a)*20)+'%');
        seat.style.setProperty('--x',x+'%'); seat.style.setProperty('--y',y+'%'); seat.style.setProperty('--bet-top',y>65?'-24px':y<35?'calc(100% + 6px)':'50%'); seat.style.setProperty('--bet-left',y>65||y<35?'50%':x<50?'calc(100% + 22px)':'-22px');
        view={seat,hole,stack,status,action,bet,blind,cards:null}; seatNodes.set(p.name,view);
      }
      view.seat.className='seat'+(p.name===h.hero?' hero':'')+(p.folded?' folded':'')+(s.current?.player===p.name?' current':'')+(nextActor===p.name?' to-act':'');
      const known = p.cards.length ? p.cards : done && $('study-reveal').checked ? h.summaryCards[p.name] || [] : [];
      const signature=known.join(' ')+':'+p.folded;
      if(view.cards!==signature){view.cards=signature;view.hole.replaceChildren();if(!p.folded||known.length)view.hole.append(card(known[0]),card(known[1]));}
      view.stack.textContent=fmt(p.stack);
      const status = [p.folded?'FOLD':p.allIn?'ALL-IN':'',p.sittingOut?'SITTING OUT':'',p.disconnected?'OFFLINE':'',p.timedOut?'TIMEOUT':''].filter(Boolean).join(' · ');
      view.status.textContent=status || (p.name===h.hero?'VOCÊ':'');
      view.blind.hidden=!p.blind;view.blind.textContent=p.blind||'';
      view.action.textContent=p.action;view.action.title=p.action;
      view.bet.hidden=!p.bet||done;view.bet.textContent='◉ '+fmt(p.bet);
      view.bet.className='seat-bet table-bet'+(p.name===h.hero?' hero-bet':'')+(p.folded?' folded':'');
      view.bet.classList.toggle('latest-bet',s.current?.player===p.name&&['post','bet','raise','call'].includes(s.current?.type));
    });
    $('action-text').textContent = s.current ? describe(s.current) : 'Início da mão · stacks antes dos antes e blinds';
    $('action-detail').textContent=ViewerTools.actionDetail(r.snapshots[Math.max(0,cursor-1)],s.current,fmt);
    $('action-detail').hidden=!$('action-detail').textContent;
    renderShowdown(s,done);
    $('timeline').min = skipAntes(0); $('timeline').max = r.snapshots.length-1; $('timeline').value = cursor; $('event-count').textContent = `${cursor} / ${r.snapshots.length-1}`;
    document.querySelectorAll('[data-street]').forEach(n => {n.disabled = !queue.length||!h.events.some(e=>e.type==='street' && e.street===n.dataset.street); n.classList.toggle('active',s.street===n.dataset.street);});
    const list = $('action-list');
    const count = spoilersActive() ? cursor : h.events.length;
    const nextActionSignature=h.tournament+':'+h.id+':'+bb;
    if(actionSignature!==nextActionSignature){actionSignature=nextActionSignature;list.replaceChildren();h.events.forEach((e,i)=>{const row=el('button','action-row'+(e.type==='street'?' street':''),describe(e));row.onclick=()=>seek(i+1);list.append(row);});}
    const previousActive=list.querySelector('.active');if(previousActive)previousActive.classList.remove('active');
    for(let i=0;i<list.children.length;i++)list.children[i].hidden=i>=count;
    if(cursor)list.children[cursor-1]?.classList.add('active');
    if(playing)list.scrollTop=list.scrollHeight;
    const actor=nextActor, actorState=s.players.find(p=>p.name===actor),hero=s.players.find(p=>p.name===h.hero);
    const d=actorState&&!actorState.folded&&!actorState.allIn&&!done?ReplayEngine.decision(s,actor):null;
    $('decision-player').textContent=d?'Vez de '+(actor===h.hero?'você · ':'')+actor:done?'Mão encerrada':'Aguardando a próxima ação';
    $('stack-label').textContent='STACK · '+(bb?'BB':'FICHAS');
    $('hero-stack').textContent=d?fmt(actorState.stack):'—';
    $('call-label').textContent='PARA PAGAR';
    $('to-call').textContent=d?fmt(d.call):'—';
    $('pot-odds').textContent=d?.odds&&!d.limited?d.odds.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%':'—';
    $('odds-note').textContent=!d?'Os valores aparecem quando há um jogador a agir.':d.limited?'Pot odds indisponíveis: existem contribuições diferentes e a elegibilidade aos potes precisa ser considerada.':d.call>0?'Pot odds: pagamento ÷ pote após o call. Não é a chance de vencer.':'Sem aposta a pagar neste momento.';
    $('end-message').textContent = done ? (current === hands.length-1 ? 'Fim do histórico importado.' : h.complete?'Fim da mão.':'Fim dos eventos disponíveis · mão incompleta.') + (hero?.elimination ? ' '+hero.elimination.replace('finished the tournament in 5th place','terminou o torneio em 5º lugar') : '') : '';
    renderSummary(done); renderBookmarks();studio?.render();settings?.sync();
    const nextListSignature=current+':'+done+':'+spoilersActive()+':'+$('filter').value+':'+$('search').value;
    if(listSignature!==nextListSignature){listSignature=nextListSignature;renderList();}
    clearTimeout(sessionTimer); sessionTimer=setTimeout(savePosition,150);
  }
  function renderShowdown(s,done){
    const host=$('showdown-results');host.replaceChildren();
    if(s.street!=='showdown'&&!done){host.hidden=true;return;}
    for(const p of s.players){
      if(p.folded)continue;
      const cards=p.cards.length===2?p.cards:done&&$('study-reveal').checked?hand().summaryCards[p.name]:null;
      if(!cards||cards.length!==2)continue;
      const made=ViewerTools.madeHand([...cards,...s.board]);if(!made)continue;
      const row=el('div','showdown-row');row.append(el('span','',p.name),el('strong','',made.label));host.append(row);
    }
    host.hidden=!host.childElementCount;
  }
  function renderSummary(done) {
    $('hand-summary').hidden=!done;
    if(!done)return;
    const result=StudyTools.summary(hand(),replay());
    $('summary-warning').textContent=result.complete?'':'Histórico incompleto ou com divergências: valores registrados até aqui.';
    $('summary-net').textContent=result.net===null?'—':(result.net>0?'+':'')+result.net.toLocaleString('pt-BR')+' fichas';
    $('summary-net').className=result.net>0?'positive':result.net<0?'negative':'';
    $('summary-stack').textContent=result.stackBB===null?'—':result.stackBB.toLocaleString('pt-BR',{maximumFractionDigits:2})+' BB';
    $('summary-payments').replaceChildren();
    for(const payment of result.payments){const row=el('li');const potName=payment.pot.replace('main pot','pote principal').replace('side pot','pote paralelo').replace(/^pot$/,'pote');row.append(el('span','',payment.player+' · '+potName),el('strong','',fmt(payment.amount)));$('summary-payments').append(row);}
    if(!result.payments.length)$('summary-payments').append(el('li','muted','Nenhum pagamento registrado.'));
    $('summary-next').disabled=adjacentHand(1)===undefined;
    $('summary-next').textContent=adjacentHand(1)===undefined?(current===hands.length-1?'Fim do histórico':'Fim da seleção'):'Próxima mão →';
  }
  function renderBookmarks() {
    const notes=annotation(hand()).eventNotes||{}, list=$('decision-bookmarks');list.replaceChildren();
    for(const index of Object.keys(notes).map(Number).sort((a,b)=>a-b)){
      if(index>hand().events.length || (spoilersActive()&&index>cursor))continue;
      const row=el('div','bookmark-row'), jump=el('button','bookmark-jump');
      const street=hand().events[Math.max(0,index-1)]?.street||'setup';
      jump.append(el('strong','',`Evento ${index} · ${street}${notes[index].reviewed?' · Revisada':''}`),el('span','',notes[index].note||'Revisar esta jogada'));
      jump.onclick=()=>{seek(index);setTab('table');};
      const edit=el('button','bookmark-edit','Editar');edit.setAttribute('aria-label',`Editar nota do evento ${index}`);edit.onclick=()=>openDecisionNote(index);
      row.append(jump,edit);list.append(row);
    }
    if(!list.childElementCount)list.append(el('p','muted','Use “Marcar jogada” na mesa. No modo sem spoilers, notas futuras ficam ocultas.'));
  }
  function openDecisionNote(index=cursor) {
    if(!hand())return;stop();editingDecision={key:annotationKey(hand()),cursor:index};
    const note=annotation(hand()).eventNotes?.[index];
    $('decision-note').value=note?.note||'';
    $('decision-description').textContent=`Mão ${current+1} · Evento ${index} · `+(StudyTools.isHeroDecision(hand(),index)?'Antes da sua decisão':index?describe(hand().events[index-1]):'Início da mão');
    $('delete-decision').disabled=!note;$('decision-dialog').showModal();$('decision-note').focus();
  }
  function importText(text, restoring = false, position = null, librarySwitch = false) {
    stop();clearTimeout(sessionTimer);if(!restoring)savePosition();const result = PokerParser.parseHistory(text);
    if (!result.hands.length) {$('import-status').textContent = result.warnings.map(w=>w.message).join('\n');if(!restoring&&!$('import-dialog').open)$('import-dialog').showModal(); return false;}
    let chosen=result.hands,importStats=null;
    if(studio&&!restoring&&!librarySwitch){const selection=studio.mergeImport(result.hands);chosen=selection.hands;text=selection.text;importStats=selection;}
    if(studio&&restoring)studio.adoptSession(result.hands);
    sessionStored=false;hands = chosen; warnings = result.warnings; compiled = hands.map(ReplayEngine.compile); selected = new Set(); current=0; cursor=0;
    actionSignature='';listSignature='';seatHand=null;
    const allIssues = warnings.map(w=>`Mão ${w.hand}, linha ${w.line}: ${w.message}`);
    const accounting = compiled.flatMap((c,i)=>c.issues.map(m=>`Mão ${hands[i].id}: ${m}`));
    $('diagnostics').textContent = `${hands.length} mãos importadas.\n${allIssues.length} avisos; ${accounting.length} divergências.\n`+[...allIssues,...accounting].join('\n');
    $('search').value=''; $('filter').value='all';
    for(const id of ['adv-player','adv-cards','adv-position','adv-pot-min','adv-pot-max','adv-tag'])if($(id))$(id).value='';
    go(0); $('import-dialog').close(); setTab('table');
    const restored=restoring?StudyTools.restoredPosition(hands,position):null;
    if(restored){go(restored.hand);seek(restored.cursor);}
    if(restoring){sessionStored=true;$('storage-status').textContent='Sessão retomada · progresso salvo neste dispositivo';toast(`Sessão retomada · mão ${current+1} de ${hands.length}`);}
    else {const issues = compiled.reduce((n,r)=>n+r.issues.length,0);toast(importStats?`${importStats.added} novas mãos · ${importStats.duplicates} já salvas · ${importStats.tournaments} torneios. ${warnings.length} avisos · ${issues} divergências.${importStats.stored?'':' Biblioteca apenas nesta sessão.'}`:`${hands.length} mãos abertas · ${warnings.length} avisos · ${issues} divergências.`);rememberHistory(text);}
    return true;
  }
  async function importFiles(files) {if(!files?.length)return;try{const contents=await Promise.all(Array.from(files,file=>file.text()));importText(contents.join('\n\n'));}catch(error){$('import-status').textContent='Não foi possível ler os arquivos: '+error.message;toast('Não foi possível ler os arquivos: '+error.message);}}
  function download(name,text,type='text/plain;charset=utf-8') {const url = URL.createObjectURL(new Blob([text],{type})), a = el('a'); a.href=url; a.download=name; document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function setTab(tab) {if(tab!=='table')stop();document.querySelector('.workspace').dataset.tab=tab; document.querySelectorAll('[data-tab]').forEach(n=>{if(n.tagName==='BUTTON'){n.classList.toggle('active',n.dataset.tab===tab);n.setAttribute('aria-pressed',String(n.dataset.tab===tab));}});}
  $('import-open').onclick=()=>{stop(); $('import-dialog').showModal();};
  $('welcome-import').onclick=$('import-open').onclick;
  $('next-decision').onclick=()=>{
    const queue=matchingHands();
    if(queue.includes(current)&&StudyTools.isHeroDecision(hand(),cursor)){seek(cursor+1);return;}
    const target=StudyTools.nextDecision(hands,current,cursor,queue);
    if(!target)return;
    if(target.hand!==current)go(target.hand);
    seek(target.cursor);setTab('table');
  };
  $('summary-next').onclick=()=>changeHand(1);
  $('mark-decision').onclick=()=>openDecisionNote();
  $('save-decision').onclick=()=>{
    if(!editingDecision)return;
    const previous=saved.annotations[editingDecision.key]||{};
    saved.annotations[editingDecision.key]={...previous,eventNotes:{...(previous.eventNotes||{}),[editingDecision.cursor]:{...(previous.eventNotes?.[editingDecision.cursor]||{}),note:$('decision-note').value.trim()}}};
    persist();$('decision-dialog').close();render();toast('Jogada marcada. Você pode voltar a ela em Ações e notas.');
  };
  $('delete-decision').onclick=()=>{
    if(!editingDecision)return;
    const previous=saved.annotations[editingDecision.key]||{}, notes={...(previous.eventNotes||{})};delete notes[editingDecision.cursor];
    saved.annotations[editingDecision.key]={...previous,eventNotes:notes};persist();$('decision-dialog').close();render();toast('Marcação removida.');
  };
  $('clear-session').onclick=()=>{
    pausedDecision=null;bypassDecision=null;stop();clearTimeout(sessionTimer);sessionStored=false;activeSessionId=null;
    try{localStorage.removeItem(sessionHistoryKey);localStorage.removeItem(sessionPositionKey);}catch{toast('Não foi possível apagar a sessão salva. Verifique o armazenamento do navegador.');return;}
    hands=[];compiled=[];selected.clear();current=0;cursor=0;actionSignature='';listSignature='';seatHand=null;
    $('notes').value='';$('paste').value='';$('search').value='';$('filter').value='all';$('action-list').replaceChildren();$('seats').replaceChildren();$('diagnostics').textContent='Nenhum histórico carregado.';
    render();renderList();$('storage-status').textContent='Sessão apagada · notas e favoritos preservados';toast('Histórico e progresso apagados deste dispositivo. Notas e favoritos foram preservados.');
  };
  function filterChanged(){stop();renderList();render();}
  document.querySelectorAll('[data-filter]').forEach(n=>n.onclick=()=>{$('filter').value=n.dataset.filter;filterChanged();});
  $('file').onchange=e=>{const files=Array.from(e.target.files);e.target.value='';return importFiles(files);}; $('import-paste').onclick=()=>importText($('paste').value);
  for (const event of ['dragenter','dragover']) $('drop-zone').addEventListener(event,e=>{e.preventDefault(); $('drop-zone').classList.add('drag');});
  $('drop-zone').ondragleave=()=>$('drop-zone').classList.remove('drag'); $('drop-zone').ondrop=e=>{e.preventDefault();e.stopPropagation();$('drop-zone').classList.remove('drag');importFiles(e.dataTransfer.files);};
  document.addEventListener('dragover',e=>e.preventDefault()); document.addEventListener('drop',e=>{e.preventDefault(); if (!$('import-dialog').open) importFiles(e.dataTransfer.files);});
  $('prev-hand').onclick=()=>changeHand(-1); $('next-hand').onclick=()=>changeHand(1); $('start').onclick=()=>seek(0); $('end').onclick=()=>seek(replay().snapshots.length-1); $('prev').onclick=()=>seek(cursor-1); $('next').onclick=()=>seek(cursor+1); $('play').onclick=play; $('timeline').oninput=e=>seek(+e.target.value);
  document.querySelectorAll('[data-street]').forEach(n=>n.onclick=()=>seek(hand().events.findIndex(e=>e.type==='street'&&e.street===n.dataset.street)+1));
  $('speed').onchange=()=>{saved.prefs.speed=$('speed').value; persist(); if(playing) schedule();};
  $('units').onclick=()=>{bb=!bb;saved.prefs.bb=bb;persist();render();};
  $('favorite').onclick=()=>{stop();updateAnnotation({favorite:!annotation(hand()).favorite});renderList();render();}; $('notes').oninput=()=>updateAnnotation({note:$('notes').value});
  $('search').oninput=filterChanged; $('filter').onchange=()=>{filterChanged(); if (['positive','negative'].includes($('filter').value)&&$('spoilers').checked) toast('Sem spoilers: resultados exibidos apenas para a mão concluída.');};
  $('select-all').onclick=()=>{const all=filtered.every(i=>selected.has(i)); filtered.forEach(i=>all?selected.delete(i):selected.add(i));renderList();};
  $('export-hands').onclick=()=>download('orbit-maos-selecionadas.txt',[...selected].sort((a,b)=>a-b).map(i=>hands[i].original.trim()).join('\n\n\n')+'\n');
  $('copy').onclick=async()=>{try {await navigator.clipboard.writeText(hand().original);toast('Histórico original copiado.');} catch {download('mao-'+hand().id+'.txt',hand().original);toast('Clipboard indisponível. Histórico salvo como .txt.');}};
  $('backup-export').onclick=()=>download('orbit-anotacoes.json',JSON.stringify({version:1,annotations:saved.annotations,prefs:saved.prefs},null,2),'application/json');
  $('backup-import').onclick=()=>$('backup-file').click(); $('backup-file').onchange=async e=>{try {const data=JSON.parse(await e.target.files[0].text());if(data.version!==1||!data.annotations||typeof data.annotations!=='object'||Array.isArray(data.annotations))throw Error('Formato inválido');for(const [k,v] of Object.entries(data.annotations)){if (/^\d+:\d+$/.test(k)&&v&&typeof v==='object')saved.annotations[k]=StudyTools.cleanAnnotation(v);}persist();if(hand())$('notes').value=annotation(hand()).note||'';render();renderList();toast('Anotações importadas.');}catch(error){toast('Backup não importado: '+error.message);}e.target.value='';};
  for(const id of ['continuous','hero-pause','spoilers']) {if(saved.prefs[id]!==undefined)$(id).checked=!!saved.prefs[id];$(id).onchange=()=>{saved.prefs[id]=$(id).checked;persist();render();renderList();};}
  if(['0','1000','2000','3000'].includes(saved.prefs['moment-pause']))$('moment-pause').value=saved.prefs['moment-pause'];
  $('moment-pause').onchange=()=>{saved.prefs['moment-pause']=$('moment-pause').value;persist();if(playing)schedule();};
  if(['0.5','1','2','4'].includes(saved.prefs.speed))$('speed').value=saved.prefs.speed;
  $('study-reveal').onchange=()=>{if(cursor!==replay().snapshots.length-1){$('study-reveal').checked=false;toast('Cartas do resumo ficam disponíveis somente após a mão.');}render();};
  $('history-toggle').onclick=()=>{const workspace=document.querySelector('.workspace'); workspace.classList.toggle('history-hidden');$('history-toggle').setAttribute('aria-expanded',String(!workspace.classList.contains('history-hidden')));if(innerWidth<=850)setTab('history');};
  $('history-close').onclick=()=>{document.querySelector('.workspace').classList.add('history-hidden');$('history-toggle').setAttribute('aria-expanded','false');setTab('table');$('history-toggle').focus();};
  document.querySelectorAll('button[data-tab]').forEach(n=>n.onclick=()=>setTab(n.dataset.tab));
  document.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select,[contenteditable=true]')||document.querySelector('dialog[open]')||!hand()||!matchingHands().length)return;if(e.code==='Space'&&!e.target.closest('button,a,summary')){e.preventDefault();play();}if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();const direction=e.key==='ArrowRight'?1:-1;e.shiftKey?changeHand(direction):seek(cursor+direction);}});
  window.addEventListener('pagehide',()=>{savePosition();stop();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){savePosition();stop();}});
  studio=OrbitStudio.create({
    view:()=>({hand:hand(),state:state(),hands,compiled,current,cursor,annotations:saved.annotations,prefs:saved.prefs,bb}),
    stop,seek,go,setTab,describe,toast,download,spoilers:spoilersActive,
    load:(text,options={})=>importText(text,!!options.restoring,options.position||null,!!options.librarySwitch),
    clear:()=>$('clear-session').onclick(),
    update:updateAnnotation,
    changed:filterChanged,
    preference:(key,value)=>{saved.prefs[key]=value;persist();},
    setAnnotation:(key,value)=>{saved.annotations[key]=StudyTools.cleanAnnotation(value);persist();},
  });
  settings=OrbitSettings.create({view:()=>({prefs:saved.prefs}),stop,stored:()=>storage,
    preferences:patch=>{Object.assign(saved.prefs,patch);persist();},units:value=>{bb=value;},changed:filterChanged,toast});
  render(); renderList();
  try {
    const stored=localStorage.getItem(sessionHistoryKey);
    if(stored){
      let text=stored,position=null,envelope=null;
      try{const parsed=JSON.parse(stored);if(parsed?.version===2&&typeof parsed.text==='string'){envelope=parsed;text=parsed.text;activeSessionId=parsed.id;position=parsed.position;}}catch{}
      try{const pointer=JSON.parse(localStorage.getItem(sessionPositionKey));if(!envelope||pointer?.sessionId===envelope.id)position=pointer||position;}catch{}
      if(!importText(text,true,position))toast('A sessão salva não pôde ser lida. Importe o histórico novamente.');
    }
  }catch{ /* Session restore is optional when storage is blocked. */ }
})();
