'use strict';
const assert=require('node:assert/strict');
const Engine=require('./replay-engine'),Viewer=require('./viewer-tools');
const {boot,hands}=require('./ui-tests');
const cards=s=>s.split(' '),rank=s=>Viewer.madeHand(cards(s));
for(const [sample,category,label]of [
  ['As Kd Qh 9c 4s',0,'Carta alta: ás'],
  ['As Ad Qh 9c 4s',1,'Par de ases'],
  ['As Ad Kh Kc 4s',2,'Dois pares: ases e reis'],
  ['As Ad Ah 9c 4s',3,'Trinca de ases'],
  ['As 2d 3h 4c 5s',4,'Sequência até 5'],
  ['As Js 9s 6s 2s',5,'Flush'],
  ['As Ad Ah Kc Ks',6,'Full house: ases com reis'],
  ['As Ad Ah Ac Ks',7,'Quadra de ases'],
  ['5s 6s 7s 8s 9s',8,'Straight flush até 9'],
  ['As Ks Qs Js Ts',8,'Royal flush'],
  ['As Ad Ah Kc Ks Kh 2d',6,'Full house: ases com reis'],
  ['As Ad Kh Kc Qs Qh 2d',2,'Dois pares: ases e reis'],
  ['As Ks Qs Js Ts 2d 3h',8,'Royal flush'],
  ['As 2s 3s 4s 5s Kd Qh',8,'Straight flush até 5'],
  ['As 2d 3h 4c 5s 6c Kd',4,'Sequência até 6'],
]){assert.equal(rank(sample).rank[0],category);assert.equal(rank(sample).label,label);}
assert(Viewer.compare(rank('As Ad Kc Qs 9h').rank,rank('Ah Ac Kd Qc 8d').rank)>0,'kicker determines ordering');
assert.equal(Viewer.compare(rank('As Ks Qs Js Ts 2d 3h').rank,rank('As Ks Qs Js Ts 4d 5h').rank),0,'playing the board ties');
assert.equal(rank('As As Kh Qh Jh'),null);assert.equal(rank('As Kd'),null);assert.equal(rank('Ax Kd Qh Jh Th'),null);

const ordinary={pot:300,players:[{name:'a',stack:1000,bet:100,total:100},{name:'b',stack:1000,bet:200,total:200}]};
assert.equal(Engine.decision(ordinary,'a').limited,false,'ordinary raise/call has no eligibility limitation');
assert.equal(Engine.decision(ordinary,'a').odds,25);
assert.equal(Engine.decision({...ordinary,players:ordinary.players.map((p,i)=>i===0?{...p,stack:50}:p)},'a').limited,true,'short caller cannot win excess contributions');
assert.equal(Engine.decision({...ordinary,players:ordinary.players.map((p,i)=>i===0?{...p,allIn:true}:p)},'a'),null);
assert.equal(Viewer.actionDetail({pot:800,players:[]},{type:'bet',amount:600},n=>n+' BB'),'Apostou 600 BB em um pote de 800 BB · 75% do pote');
assert.match(Viewer.actionDetail(ordinary,{type:'raise',player:'a',to:600},String),/de 200 para 600 · Acrescentou 500/);
for(const h of hands){
  const r=Engine.compile(h);
  for(let i=0;i<h.events.length;i++){
    const text=Viewer.actionDetail(r.snapshots[i],h.events[i],String);assert(!/NaN|undefined|Infinity/.test(text));
    const count=Viewer.participants(r.snapshots[i]);assert(count.active>=1&&count.allIn<=count.active);
  }
  for(const p of h.players)assert.equal(Viewer.position(h,p.name),Engine.position({...h,hero:p.name}));
}

const app=boot();app.import();
const seek=n=>{app.$('timeline').value=n;app.$('timeline').oninput({target:app.$('timeline')});};
assert.equal(app.document.querySelectorAll('.seat-position').length,hands[0].players.length);
assert.match(app.$('players-in-hand').textContent,/9 jogadores/);
const first=hands[0],replay=Engine.compile(first);
const villainIndex=first.events.findIndex((e,i)=>i>=app.cursor()&&e.player!==first.hero&&['call','raise','fold','check','bet'].includes(e.type));
seek(villainIndex);
const villain=first.events[villainIndex].player;
assert.match(app.$('decision-player').textContent,new RegExp(villain.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
assert.equal(app.$('hero-stack').textContent,replay.snapshots[villainIndex].players.find(p=>p.name===villain).stack.toLocaleString('pt-BR',{maximumFractionDigits:2}),'displayed stack belongs to the named next actor');
assert.equal(app.$('stack-label').textContent,'STACK · FICHAS');
const raised=first.events.findIndex(e=>e.type==='raise');seek(raised+1);assert.match(app.$('action-detail').textContent,/Aumentou de.*Acrescentou/);
app.click('end');assert.equal(app.$('hero-stack').textContent,'—');assert.equal(app.$('to-call').textContent,'—');assert.equal(app.$('pot-odds').textContent,'—');

const fixture=`PokerStars Hand #999888777: Tournament #999888, $1 Hold'em No Limit - 2026/10/22 (10/20)
Table 'Review' 2-max Seat #1 is the button
Seat 1: Hero (1000 in chips)
Seat 2: Rival (1000 in chips)
Hero: posts small blind 10
Rival: posts big blind 20
*** HOLE CARDS ***
Dealt to Hero [As Kc]
Hero: calls 10
Rival: checks
*** FLOP *** [Ah Kd 2s]
Rival: checks
Hero: checks
*** TURN *** [Ah Kd 2s] [Qh]
Rival: checks
Hero: checks
*** RIVER *** [Ah Kd 2s Qh] [7c]
Rival: checks
Hero: checks
*** SHOW DOWN ***
Hero: shows [As Kc] (two pair, Aces and Kings)
Rival: mucks hand
Hero collected 40 from pot
*** SUMMARY ***
Total pot 40 | Rake 0
Seat 1: Hero showed [As Kc] and won (40)
Seat 2: Rival mucked [Ad Qd]
`;
const show=boot();show.$('paste').value=fixture;show.click('import-paste');
const parsed=require('./parser').parseHistory(fixture).hands[0];
const showSeek=n=>{show.$('timeline').value=n;show.$('timeline').oninput({target:show.$('timeline')});};
assert(show.$('showdown-results').hidden);
show.click('end');assert.match(show.$('showdown-results').textContent,/Hero.*Dois pares: ases e reis/);assert(!show.$('showdown-results').textContent.includes('Rival'));
show.$('study-reveal').checked=true;show.$('study-reveal').onchange();assert.match(show.$('showdown-results').textContent,/Rival.*Dois pares: ases e damas/);
showSeek(parsed.events.findIndex(e=>e.type==='street'&&e.street==='river')+1);assert(show.$('showdown-results').hidden,'rewind never exposes showdown labels');
show.$('moment-pause').value='2000';show.$('moment-pause').onchange();show.click('play');
assert([...show.timers.values()].some(t=>t.ms===3000),'river gives configurable extra viewing time');
show.click('play');show.$('moment-pause').value='0';show.$('moment-pause').onchange();show.click('play');assert([...show.timers.values()].some(t=>t.ms===1000),'extra time can be disabled');show.click('play');
show.click('end');show.flushPosition();const restored=boot(show.data);assert.equal(restored.$('moment-pause').value,'0');
assert.equal(show.document.querySelectorAll('.training-panel,[data-choice]').length,0);
const filters=boot();filters.import();filters.document.querySelector('[data-filter=heroAllin]').onclick();assert.equal(filters.$('hand-list').querySelectorAll('.hand-row').length,0,'preflop folds do not appear as voluntary hero all-ins');
filters.$('filter').value='heroForcedAllin';filters.$('filter').onchange();assert.equal(filters.$('hand-list').querySelectorAll('.hand-row').length,1);filters.$('hand-list').querySelector('.hand-open').onclick();filters.click('end');assert.match(filters.document.querySelector('.seat.hero .seat-status').textContent,/FOLD/);assert(!filters.document.querySelector('.seat.hero .seat-status').textContent.includes('ALL-IN'));
filters.$('filter').value='anyAllin';filters.$('filter').onchange();assert.equal(filters.$('hand-list').querySelectorAll('.hand-row').length,19,'opponents and mandatory all-ins remain accessible separately');
console.log('PASS: viewer explanations, raise increments, pot eligibility, positions, actor-specific values, best-five showdown rankings and kickers, hidden cards, rewind protection and adjustable moment timing.');
