'use strict';
const assert=require('node:assert/strict'),{boot,hands,history}=require('./ui-tests');
const {Event}=require('linkedom');
function change(app,id,value,type='input'){app.$(id).value=value;app.$(id).dispatchEvent(new Event(type));}
function toggle(app,id,on){app.$(id).checked=on;app.$(id).onchange();}
function saved(app){return JSON.parse(app.data.get('orbit-replay-v1'));}
async function main(){
  const batch=boot(),secondSource=hands[1].original.replace(/4040939869/g,'9990000001').replace(/262448544858/g,'999000111222');
  batch.$('file').files=[{text:async()=>history},{text:async()=>secondSource},{text:async()=>history}];
  await batch.$('file').onchange({target:batch.$('file')});batch.click('library-open');assert.equal(batch.$('library-list').querySelectorAll('.library-item').length,2,'multiple file import groups tournaments and deduplicates hands');
  assert.equal(batch.$('hand-count').textContent,'47');
  let app=boot();app.import();
  app.click('library-open');assert.equal(app.$('library-list').querySelectorAll('.library-item').length,1);app.$('library-dialog').close();
  app.import();app.click('library-open');assert.equal(app.$('library-list').querySelectorAll('.library-item').length,1);assert.match(app.$('library-list').textContent,/47 mãos/);app.$('library-dialog').close();
  const extra=hands[1].original.replace(/4040939869/g,'9990000001').replace(/262448544858/g,'999000111222');
  app.$('paste').value=extra;app.click('import-paste');assert.equal(app.$('hand-count').textContent,'1');
  app.click('library-open');assert.equal(app.$('library-list').querySelectorAll('.library-item').length,2);
  app.$('library-list').querySelector('.primary').onclick();assert.equal(app.$('hand-count').textContent,'47');
  assert.match(app.$('tournament-title').textContent,/4040939869/);
  change(app,'search','zaroizinho');app.$('search').oninput();assert.equal(app.$('hand-list').querySelectorAll('.hand-row').length,47);
  app.click('clear-search');change(app,'adv-cards','KK');assert.equal(app.$('hand-list').querySelectorAll('.hand-row').length,1);
  app.$('hand-list').querySelector('.hand-open').onclick();assert.equal(app.$('hand-title').textContent,'Mão 2');
  app.click('clear-search');app.$('tag-input').value='Call difícil';app.click('tag-add');
  assert.match(app.$('tags-list').textContent,/Call difícil/);
  change(app,'adv-tag','Call difícil','change');assert.equal(app.$('hand-list').querySelectorAll('.hand-row').length,1);
  app.click('clear-search');
  app.click('end');change(app,'adv-pot-min','7');change(app,'adv-pot-max','8');assert.equal(app.$('hand-list').querySelectorAll('.hand-row').length,1,'advanced pot range converts BB to nominal chips');app.click('clear-search');app.click('start');
  app.click('next-decision');toggle(app,'four-colors',true);assert(app.document.body.classList.contains('four-colors'));
  assert(app.document.querySelector('.card[data-suit]'));
  app.click('graph-open');assert(app.$('stack-chart').querySelector('svg'));
  const graphButtons=app.$('stack-chart').querySelectorAll('[role=button]');
  assert([...graphButtons].every(n=>!n.getAttribute('aria-label').includes('Mão 3')),'graph hides later hands');
  app.$('graph-dialog').close();
  app.click('start');app.click('next-decision');
  const before=app.cursor();
  assert.equal(app.$('training-toggle'),null);assert.equal(app.$('training-panel'),null);
  assert.equal(app.document.querySelector('[data-choice]'),null);
  app.click('next');assert.equal(app.cursor(),before+1,'replay advances without requiring a training choice');
  app.click('mark-decision');app.$('decision-note').value='Revisar ranges';app.click('save-decision');
  app.click('review-open');assert.equal(app.$('review-list').querySelectorAll('.review-item').length,1);
  app.$('review-list').querySelector('.review-actions button:not(.primary)').onclick();assert.match(app.$('review-status').textContent,/0 pendentes/);
  app.$('review-dialog').close();
  app.flushPosition();app=boot(app.data);assert(app.document.body.classList.contains('four-colors'));assert.match(app.$('tags-list').textContent,/Call difícil/);
  app.click('review-open');assert.match(app.$('review-status').textContent,/1 revisadas/);app.$('review-dialog').close();
  // New metadata survives backup import and does not turn text into markup.
  const a=saved(app).annotations, key='4040939869:'+hands[1].id;
  app.$('backup-file').files=[{text:async()=>JSON.stringify({version:1,annotations:a})}];await app.$('backup-file').onchange({target:app.$('backup-file')});
  assert.equal(saved(app).annotations[key].tags[0],'Call difícil');assert(saved(app).annotations[key].eventNotes[before+1].reviewed);
  app.click('library-open');const records=app.$('library-list').querySelectorAll('.library-item');records[1].querySelector('.text-button').onclick();assert.equal(app.$('library-list').querySelectorAll('.library-item').length,1);
  const legacy=boot(new Map([['orbit-replay-v1',JSON.stringify({prefs:{'training-toggle':true,'four-colors':true},annotations:{[key]:{note:'Minha nota',training:{2:{choice:'call'}}}}})]]));
  legacy.import();legacy.click('next-decision');legacy.click('end');assert.equal(legacy.cursor(),hands[0].events.length,'legacy training preference cannot block replay');
  assert.equal(saved(legacy).prefs['training-toggle'],undefined);assert.equal(saved(legacy).annotations[key].training,undefined);assert.equal(saved(legacy).annotations[key].note,'Minha nota');
  console.log('PASS: studio DOM — multi-tournament library/dedup/switch/remove, advanced card/name/tag search, four colors, spoiler-safe chart, review completion, persistence and metadata backup.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
