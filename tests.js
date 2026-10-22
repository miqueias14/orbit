'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Parser = require('./parser.js');
const Engine = require('./replay-engine.js');
const Study = require('./study-tools.js');
const source = fs.readFileSync(__dirname + '/reference-history.txt','utf8');
const html = fs.readFileSync(__dirname + '/index.html','utf8');
const controller = fs.readFileSync(__dirname + '/app.js','utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'Unique HTML IDs');
for (const m of controller.matchAll(/\$\('([^']+)'\)/g)) assert(ids.includes(m[1]),'Existing controller target: '+m[1]);
for (const file of ['parser.js','replay-engine.js','study-tools.js','app.js','styles.css']) assert(fs.existsSync(__dirname+'/'+file));
const imported = Parser.parseHistory(source);
assert.equal(imported.hands.length,47);
assert.equal(imported.warnings.length,0);
assert(imported.hands.every(h=>h.hero==='zaroizinho' && h.tournament==='4040939869'));
const get = id => imported.hands.find(h=>h.id===id);
const replay = id => Engine.compile(get(id));
const player = (r,name) => r.final.players.find(p=>p.name===name);
let eventCount = 0;
for (const h of imported.hands) {
  const r = Engine.compile(h), total = h.players.reduce((n,p)=>n+p.initial,0);
  assert.deepEqual(r.issues,[],h.id);
  for (let i=0;i<r.snapshots.length;i++) {
    const s = r.snapshots[i];
    assert(s.players.every(p=>Number.isFinite(p.stack)&&p.stack>=0&&p.total>=0&&p.bet>=0),`${h.id} event ${i}`);
    assert.equal(s.players.reduce((n,p)=>n+p.stack,0)+s.pot,total,'Chip conservation');
    const rebuilt = h.events.slice(0,i).reduce(Engine.reduce,Engine.initial(h));
    assert.deepEqual(rebuilt,s,'Deterministic seek to event '+i);
    eventCount++;
  }
  assert.equal(r.final.pot,0);
  assert.equal(r.final.paid,h.totalPot);
  assert.equal(r.final.players.reduce((n,p)=>n+p.total,0),h.totalPot);
}
let h=get('262448536385'), r=replay(h.id);
assert.equal(h.events.filter(e=>e.kind==='ante' && e.amount===3).length,9);
assert.equal(h.bigBlind,20); assert.equal(h.smallBlind,10);
assert(h.events.some(e=>e.type==='raise'&&e.to===50));
assert(h.events.some(e=>e.type==='call'&&e.amount===50));
assert(h.events.some(e=>e.type==='return'&&e.amount===65));
assert.equal(r.final.paid,157); assert.equal(player(r,'zaroizinho').stack,1447);
h=get('262448633713'); r=replay(h.id);
assert.deepEqual(h.summaryPots.map(p=>p.amount),[177,116]);
assert.equal(r.final.paid,293); assert.equal(player(r,'4973509').won,204); assert.equal(player(r,'ritter7777').won,89);
assert.deepEqual(h.events.filter(e=>e.type==='collect'&&e.pot==='main pot').map(e=>e.amount),[89,88]);
h=get('262448727319'); r=replay(h.id);
assert(h.events.some(e=>e.type==='return'&&e.amount===461&&e.player==='VicLong80'));
assert.deepEqual(h.summaryPots.map(p=>p.amount),[1214,1386,1702]);
assert.equal(r.final.paid,4302); assert.equal(player(r,'VicLong80').won,3088); assert.equal(player(r,'ritter7777').won,1214);
// Compare independently derived pot layers before the first payment with summary.
let before = h.events.findIndex(e=>e.type==='collect');
assert.deepEqual(Engine.pots(r.snapshots[before]).map(p=>p.amount),[1214,1386,1702]);
h=get('262448910884'); r=replay(h.id);
assert.equal(h.bigBlind,200); assert.equal(h.ante,25);
assert(h.events.some(e=>e.kind==='bb'&&e.amount===39&&e.allIn));
assert(h.events.some(e=>e.type==='return'&&e.amount===61));
assert(h.events.some(e=>e.type==='fold'&&e.player==='zaroizinho'));
assert.equal(r.final.paid,203);assert.equal(player(r,'zaroizinho').stack,0);assert(player(r,'zaroizinho').sittingOut);assert.match(player(r,'zaroizinho').elimination,/5th place/);
const first=imported.hands[0];
const duplicate=Parser.parseHistory(first.original+'\n'+first.original);
assert.equal(duplicate.hands.length,1);assert(duplicate.warnings.some(w=>w.message.includes('duplicada')));
const combinedWithBOM=Parser.parseHistory('\uFEFF'+first.original+'\n\uFEFF'+first.original);
assert.equal(combinedWithBOM.hands.length,1);assert(combinedWithBOM.warnings.some(w=>w.message.includes('duplicada')));
const broken=Parser.parseHistory(first.original+'\n'+imported.hands[1].original.split('*** SUMMARY ***')[0]);
assert.equal(broken.hands.length,2);assert(broken.warnings.some(w=>w.message.includes('incompleta')));
const crlf='\uFEFF'+first.original.replace(/\r?\n/g,'\r\n');
assert.equal(Parser.parseHistory(crlf).hands[0].original,crlf.slice(1));
const malformed=Parser.parseHistory(first.original.replace('PokerRog: bets 65','PokerRog: dances 65'));
assert(malformed.warnings.some(w=>w.hand===first.id&&Number.isInteger(w.line)));
for (let index=0;index<imported.hands.length;index++) {
  const hand=imported.hands[index];
  for(let cursor=0;cursor<=hand.events.length;cursor++) {
    const target=Study.nextDecision(imported.hands,index,cursor);
    if(target){assert(target.hand>=index);assert(target.hand>index||target.cursor>=cursor);assert(Study.isHeroDecision(imported.hands[target.hand],target.cursor));}
  }
  const details=Study.summary(hand,Engine.compile(hand));
  assert(details.complete);assert.equal(details.payments.reduce((n,p)=>n+p.amount,0),hand.totalPot);
}
assert.equal(Study.nextDecision(imported.hands,46,imported.hands[46].events.length),null);
assert.deepEqual(Study.restoredPosition(imported.hands,{tournament:first.tournament,hand:first.id,cursor:20}),{hand:0,cursor:20});
assert.equal(Study.restoredPosition(imported.hands,{tournament:'other',hand:first.id,cursor:20}),null);
assert.deepEqual(Study.cleanAnnotation({favorite:true,note:'x',training:{2:{choice:'call'}},eventNotes:{'2':{note:'Review'},'-1':{note:'bad'},'__proto__':{note:'bad'}}}),{favorite:true,note:'x',eventNotes:{'2':{note:'Review',reviewed:false}},tags:[],reviewed:false});
console.log(`PASS: 47 real hands, ${eventCount} states, chip conservation, deterministic rebuild, 4 acceptance hands, side pots, duplicates, BOM/CRLF, incomplete hands and line diagnostics.`);
