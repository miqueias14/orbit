/* DOM integration tests. No browser, network, layout or screenshot claims. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {parseHTML}=require('linkedom');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const history=fs.readFileSync(__dirname+'/reference-history.txt','utf8');
const Parser=require('./parser'), Study=require('./study-tools');
const hands=Parser.parseHistory(history).hands;
function boot(data=new Map(), blocked=false, width=390){
  const {window,document}=parseHTML(html), timers=new Map();let serial=0;
  for(const input of document.querySelectorAll('input[type=checkbox]'))input.checked=input.hasAttribute('checked');
  for(const node of document.querySelectorAll('select')){
    let value=node.querySelector('[selected]')?.getAttribute('value')||node.querySelector('option')?.getAttribute('value');
    Object.defineProperty(node,'value',{get:()=>value,set:v=>{value=String(v);}});
  }
  for(const dialog of document.querySelectorAll('dialog')){dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};}
  const localStorage={getItem:k=>{if(blocked)throw Error('blocked');return data.get(k)??null;},setItem:(k,v)=>{if(blocked)throw Error('quota');data.set(k,String(v));},removeItem:k=>{if(blocked)throw Error('blocked');data.delete(k);}};
  const context=vm.createContext({document,window,localStorage,navigator:{},innerWidth:width,Blob,URL,console,setTimeout:(fn,ms)=>{const id=++serial;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)});
  for(const file of ['parser.js','replay-engine.js','study-tools.js','feature-tools.js','table-export.js','studio.js','app.js'])vm.runInContext(fs.readFileSync(__dirname+'/'+file,'utf8'),context,{filename:file});
  const $=id=>document.getElementById(id);
  return {document,window,data,timers,$,click:id=>{assert(!$(id).disabled,id+' is enabled');$(id).onclick();},import:()=>{$('paste').value=history;$('import-paste').onclick();},flushPosition:()=>{for(const [id,t]of [...timers])if(t.ms===150){timers.delete(id);t.fn();}},cursor:()=>Number($('timeline').value)};
}
async function main(){
  let app=boot();app.import();
  assert(app.document.body.classList.contains('has-history'));
  assert.equal(app.$('hand-count').textContent,'47');
  assert.equal(JSON.parse(app.data.get('orbit-session-history-v1')).text,history.replace(/^\uFEFF/,''));
  assert.equal(app.cursor(),hands[0].events.findIndex(e=>e.type==='deal')+1);
  assert(app.$('hand-summary').hidden);
  const seat=app.document.querySelector('.seat');
  const target=Study.nextDecision(hands,0,app.cursor());app.click('next-decision');
  assert.equal(app.cursor(),target.cursor);assert.equal(app.$('next-decision').textContent,'Revelar minha decisão →');
  assert.equal(app.document.querySelector('.seat'),seat,'Seats reused');
  app.click('mark-decision');assert(app.$('decision-dialog').open);
  app.$('decision-note').value='Revisar meu call <img src=x onerror=alert(1)>';
  app.click('save-decision');assert(!app.$('decision-dialog').open);
  assert.equal(app.$('decision-bookmarks').querySelectorAll('img').length,0,'Imported notes rendered as text');
  app.click('next-decision');assert.equal(app.cursor(),target.cursor+1);
  app.flushPosition();const resumeCursor=app.cursor();
  app=boot(app.data);assert.equal(app.cursor(),resumeCursor);assert(app.$('mark-decision').textContent.includes('Marcar'));
  assert.equal(app.$('decision-bookmarks').querySelectorAll('.bookmark-row').length,1);
  app.click('end');assert(!app.$('hand-summary').hidden);assert.equal(app.$('summary-net').textContent,'-53 fichas');
  assert.equal(app.$('summary-stack').textContent,'72,35 BB');assert.match(app.$('summary-payments').textContent,/PokerRog/);assert.match(app.$('summary-payments').textContent,/157/);
  app.click('start');assert(app.$('hand-summary').hidden);assert.equal(app.$('decision-bookmarks').querySelectorAll('.bookmark-row').length,0,'Future notes hidden');
  assert.equal(app.cursor(),9,'Antes skipped, accounting snapshots retained');
  app.click('play');assert([...app.timers.values()].some(t=>t.ms===1000));app.click('next-hand');assert(![...app.timers.values()].some(t=>t.ms===1000),'Switch cancels playback');
  app.click('favorite');app.document.querySelector('[data-filter="favorite"]').onclick();assert.equal(app.$('hand-list').querySelectorAll('.hand-row').length,1);
  app.document.querySelector('[data-filter="all"]').onclick();assert.equal(app.$('hand-list').querySelectorAll('.hand-row').length,47);
  app.click('end');const later=Study.nextDecision(hands,1,app.cursor());app.click('next-decision');assert.equal(app.$('hand-title').textContent,'Mão '+(later.hand+1));assert.equal(app.cursor(),later.cursor);
  app.click('mark-decision');app.$('decision-note').value='Teste de remoção';app.click('save-decision');app.click('mark-decision');app.click('delete-decision');assert.equal(app.$('mark-decision').textContent,'☆ Marcar jogada');
  app.$('backup-file').files=[{text:async()=>JSON.stringify({version:1,annotations:{'4040939869:262448536385':{note:'Nota antiga',favorite:true,eventNotes:{20:{note:'Turn'}}}}})}];
  await app.$('backup-file').onchange({target:app.$('backup-file')});
  const annotations=JSON.parse(app.data.get('orbit-replay-v1')).annotations;
  assert.equal(annotations['4040939869:262448536385'].eventNotes[20].note,'Turn');
  app.document.querySelectorAll('.hand-open')[46].onclick();app.click('end');assert(app.$('next-decision').disabled);assert(app.$('summary-next').disabled);assert.equal(app.$('summary-stack').textContent,'0 BB');
  assert.match(app.$('summary-payments').textContent,/203/);
  app.click('start');app.click('play');app.document.querySelector('button[data-tab="history"]').onclick();
  assert.equal(app.document.querySelector('.workspace').dataset.tab,'history');assert(![...app.timers.values()].some(t=>t.ms===1000),'Study tab pauses playback');
  app.click('history-close');assert.equal(app.document.querySelector('.workspace').dataset.tab,'table');
  app.click('clear-session');assert(!app.document.body.classList.contains('has-history'));assert(!app.data.has('orbit-session-history-v1'));assert(!app.data.has('orbit-session-position-v1'));assert(app.data.has('orbit-replay-v1'));
  const clean=boot(app.data);assert(!clean.document.body.classList.contains('has-history'));
  const noStorage=boot(new Map(),true);noStorage.import();assert(noStorage.document.body.classList.contains('has-history'));assert.match(noStorage.$('storage-status').textContent,/apenas nesta sessão/);
  console.log('PASS: DOM integration — import, decisions before reveal, cross-hand jump, summaries, spoiler rewind, notes CRUD and backup, safe text, session restore/clear, blocked storage, filters, timers and reused seats.');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={boot,hands,history};
