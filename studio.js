/* Local study workspace. No network calls or external assets. */
(function(root){
  'use strict';
  function create(api){
    const $=id=>document.getElementById(id), el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
    const libraryKey='orbit-library-v1',progressKey='orbit-library-progress-v1';let library=[],libraryStored=true,tagSignature='',reviewSignature='',progress={};
    const cache=new Map();
    try{const data=JSON.parse(localStorage.getItem(libraryKey));if(data?.version===1)library=FeatureTools.libraryMerge(data.records||[],[]);}catch{libraryStored=false;}
    try{const stored=JSON.parse(localStorage.getItem(progressKey));if(stored&&typeof stored==='object')for(const[key,value]of Object.entries(stored))if(/^\d+$/.test(key)&&/^\d+$/.test(value?.id)&&Number.isInteger(value.cursor))progress[key]={id:value.id,cursor:Math.max(0,value.cursor)};}catch{}
    const view=()=>api.view(), ann=h=>view().annotations[h.tournament+':'+h.id]||{};
    const parsed=record=>{if(!cache.has(record.text))cache.set(record.text,PokerParser.parseHistory(record.text).hands);return cache.get(record.text);};
    function persistLibrary(){try{localStorage.setItem(libraryKey,JSON.stringify({version:1,records:library}));libraryStored=true;}catch{libraryStored=false;api.toast('Biblioteca disponível nesta sessão. Não foi possível salvar as alterações no dispositivo.');}}
    function mergeImport(incoming){
      const before=new Set(library.flatMap(r=>r.handIds));
      library=FeatureTools.libraryMerge(library,incoming);persistLibrary();
      reviewSignature='';
      const record=library.find(r=>r.id===incoming[0].tournament);
      const added=incoming.filter(h=>!before.has(h.id)).length;
      $('library-status').textContent=`${added} novas mãos; ${incoming.length-added} duplicadas ignoradas.`;
      $('library-dialog').close();return {hands:parsed(record),text:record.text,added,duplicates:incoming.length-added,tournaments:new Set(incoming.map(h=>h.tournament)).size,stored:libraryStored};
    }
    function adoptSession(hands){library=FeatureTools.libraryMerge(library,hands);persistLibrary();reviewSignature='';}
    function rememberPosition(){const v=view();if(!v.hand)return;const previous={...progress};progress={...progress,[v.hand.tournament]:{id:v.hand.id,cursor:v.cursor}};try{localStorage.setItem(progressKey,JSON.stringify(progress));}catch{progress=previous;}}
    function activate(record,position){
      if(!position&&view().hand?.tournament===record.id){api.setTab('table');$('library-dialog').close();return;}
      position=position||progress[record.id];
      api.load(record.text,{restoring:false,librarySwitch:true});
      if(position){const index=view().hands.findIndex(h=>h.id===position.id);if(index>=0){api.go(index);api.seek(position.cursor);}}
      api.setTab('table');$('library-dialog').close();$('review-dialog').close();
    }
    function renderLibrary(){
      const list=$('library-list');list.replaceChildren();
      for(const record of library){
        const item=el('article','library-item'), info=el('div','library-info'), actions=el('div','library-actions');
        info.append(el('strong','',`Torneio #${record.id}`),el('span','',`${record.count} mãos · ${record.hero||'Herói desconhecido'} · ${record.buyin}`));
        const open=el('button','primary',view().hand?.tournament===record.id?'Voltar à mesa':progress[record.id]?'Retomar torneio':'Abrir torneio');open.onclick=()=>activate(record);
        const download=el('button','', 'Exportar .txt');download.onclick=()=>api.download(`torneio-${record.id}.txt`,record.text);
        const remove=el('button','text-button','Remover');remove.onclick=()=>{library=library.filter(r=>r.id!==record.id);persistLibrary();if(view().hand?.tournament===record.id)api.clear();renderLibrary();};
        actions.append(open,download,remove);item.append(info,actions);list.append(item);
      }
      if(!library.length)list.append(el('p','empty-state','Sua biblioteca está vazia. Importe um ou vários arquivos .txt para começar.'));
      $('library-status').textContent=`${library.length} torneios · ${library.reduce((n,r)=>n+r.count,0)} mãos${libraryStored?' salvas neste dispositivo':' apenas nesta sessão'}.`;
    }
    function updateTags(){
      const v=view();if(!v.hand)return;
      const tags=FeatureTools.normalizeTags(ann(v.hand).tags), all=[...new Set(Object.values(v.annotations).flatMap(a=>FeatureTools.normalizeTags(a.tags)))].sort();
      const signature=JSON.stringify([v.hand.id,tags,all]);if(signature===tagSignature)return;tagSignature=signature;
      $('tags-list').replaceChildren();
      for(const tag of tags){const chip=el('span','tag-chip'),remove=el('button','tag-remove','×');remove.setAttribute('aria-label','Remover etiqueta '+tag);remove.onclick=()=>{api.update({tags:tags.filter(t=>t!==tag)});api.changed();};chip.append(el('span','',tag),remove);$('tags-list').append(chip);}
      if(!tags.length)$('tags-list').append(el('span','muted','Adicione uma etiqueta para encontrar esta mão depois.'));
      const selected=$('adv-tag').value;$('adv-tag').replaceChildren();
      const option=el('option','','Todas as etiquetas');option.value='';$('adv-tag').append(option);
      // Do not cap the global tag vocabulary to the per-hand limit.
      for(const tag of [...new Set(Object.values(v.annotations).flatMap(a=>FeatureTools.normalizeTags(a.tags)))].sort()){const o=el('option','',tag);o.value=tag;$('adv-tag').append(o);}
      $('adv-tag').value=selected;
    }
    function addTag(value){const v=view();if(!v.hand)return;const tags=FeatureTools.normalizeTags([...(ann(v.hand).tags||[]),value]);api.update({tags});$('tag-input').value='';api.changed();}
    function advanced(hand){
      const number=id=>{const value=$(id).value.trim();return value===''?'':Number(value.replace(',','.'))*hand.bigBlind;};
      return {player:$('adv-player').value,cards:$('adv-cards').value,position:$('adv-position').value,tag:$('adv-tag').value,minPot:number('adv-pot-min'),maxPot:number('adv-pot-max')};
    }
    function reviewEntries(){
      const annotations=view().annotations;return library.flatMap(record=>FeatureTools.reviewItems(parsed(record),annotations).filter(item=>item.type==='decision').map(item=>({...item,record})));
    }
    function renderReview(){
      const entries=reviewEntries(), list=$('review-list');list.replaceChildren();
      for(const item of entries){
        const row=el('article','review-item'+(item.reviewed?' is-reviewed':'')),info=el('div','review-info'),actions=el('div','review-actions');
        const v=view(),active=v.hand?.tournament===item.tournament&&v.hand.id===item.id,canReveal=!api.spoilers()||(active&&item.cursor<=v.cursor);
        info.append(el('strong','',`#${item.id} · Evento ${item.cursor}`),el('span','',canReveal?(item.note||'Revisar esta decisão'):'Abra a jogada para consultar a anotação.'),el('small','',`Torneio #${item.tournament} · ${item.reviewed?'Revisada':'Pendente'}`));
        const open=el('button','primary','Abrir jogada');open.onclick=()=>activate(item.record,item);
        const toggle=el('button','',item.reviewed?'Reabrir revisão':'Marcar revisada');toggle.onclick=()=>{const key=item.tournament+':'+item.id,previous=view().annotations[key]||{},notes={...(previous.eventNotes||{})};notes[item.cursor]={...notes[item.cursor],reviewed:!item.reviewed};api.setAnnotation(key,{...previous,eventNotes:notes});api.changed();renderReview();};
        actions.append(open,toggle);row.append(info,actions);list.append(row);
      }
      const remaining=entries.filter(e=>!e.reviewed).length;$('review-count').textContent=remaining;$('review-status').textContent=`${remaining} pendentes · ${entries.length-remaining} revisadas.`;
      if(!entries.length)list.append(el('p','empty-state','Marque uma jogada na mesa para montar sua fila de revisão.'));
    }
    function graph(showFull = !api.spoilers()){
      const v=view(),host=$('stack-chart');host.replaceChildren();
      if(!v.hand){host.append(el('p','empty-state','Importe um torneio para acompanhar seu stack.'));return;}
      const protectedView=!showFull;
      const points=FeatureTools.chartPoints(v.hands,v.compiled,v.current,v.cursor,protectedView).filter(p=>Number.isFinite(p.value)&&Number.isFinite(p.x));
      const controls=el('div','chart-view-controls');controls.setAttribute('aria-label','Período do gráfico');
      for(const [full,label]of [[false,'Até a mão atual'],[true,'Torneio completo']]){
        const button=el('button','',label);button.dataset.chartView=full?'full':'current';button.setAttribute('aria-pressed',String(showFull===full));button.onclick=()=>graph(full);controls.append(button);
      }
      host.append(controls);
      // The explicit complete view only affects this dialog, never replay preferences.
      const visibleHands=new Set(points.map(p=>p.hand)).size;
      host.append(el('p','chart-caption',`${visibleHands} de ${v.hands.length} mãos · Stack em BB`));
      if(!points.length){host.append(el('p','empty-state','Não há stacks do herói disponíveis neste histórico.'));$('graph-status').textContent='Confira se o arquivo contém assentos, stacks e a linha “Dealt to” do herói.';return;}
      const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
      const node=(tag,attrs,text)=>{const n=document.createElementNS(ns,tag);for(const[k,val]of Object.entries(attrs||{}))n.setAttribute(k,String(val));if(text!==undefined)n.textContent=text;return n;};
      svg.setAttribute('xmlns',ns);svg.setAttribute('viewBox','0 0 800 300');svg.setAttribute('width','800');svg.setAttribute('height','300');svg.setAttribute('font-family','Arial, sans-serif');svg.setAttribute('role','group');svg.setAttribute('aria-label','Gráfico do stack do herói em big blinds');svg.dataset.pointCount=points.length;
      svg.append(node('title',{},'Evolução do stack em BB'));
      let max=1,xmax=0;for(const p of points){max=Math.max(max,p.value);xmax=Math.max(xmax,p.x);}max*=1.15;
      const x=p=>points.length===1?410:70+p.x/Math.max(.85,xmax)*690,y=p=>245-p.value/max*205;
      const format=value=>value.toLocaleString('pt-BR',{maximumFractionDigits:2});
      for(let i=0;i<=4;i++){const value=max*i/4,py=245-value/max*205;svg.append(node('line',{x1:70,x2:760,y1:py,y2:py,stroke:'#ffffff','stroke-opacity':.09}),node('text',{x:60,y:py+4,fill:'#a1a1aa','font-size':12,'text-anchor':'end'},Math.round(value)+' BB'));}
      if(points.length>1)svg.append(node('polyline',{points:points.map(p=>x(p)+','+y(p)).join(' '),fill:'none',stroke:'#b49aff','stroke-width':3,'stroke-linejoin':'round',class:'chart-line'}));
      const detail=el('p','chart-detail');detail.setAttribute('aria-live','polite');
      const describe=point=>`Mão ${point.hand+1} · ${point.phase==='start'?'Início':'Fim'} · ${format(point.value)} BB`;
      const showDetail=point=>{detail.textContent=describe(point);};
      function open(point){if(!point)return;api.go(point.hand);if(point.phase==='end')api.seek(v.hands[point.hand].events.length);$('graph-dialog').close();api.setTab('table');}
      for(const point of points){
        const group=node('g',{tabindex:0,role:'button','aria-label':describe(point),class:'chart-point','data-hand':point.hand,'data-phase':point.phase});
        group.append(node('title',{},describe(point)),node('circle',{cx:x(point),cy:y(point),r:13,fill:'#ffffff','fill-opacity':0,'pointer-events':'all'}),node('circle',{cx:x(point),cy:y(point),r:points.length===1?7:4,fill:point.phase==='start'?'#bda3ff':'#74dab0'}));
        group.onclick=()=>open(point);group.onfocus=()=>showDetail(point);group.onpointerenter=()=>showDetail(point);group.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open(point);}};svg.append(group);
      }
      const first=points[0],last=points[points.length-1];
      svg.append(node('text',{x:points.length===1?410:70,y:277,fill:'#a1a1aa','font-size':12,'text-anchor':points.length===1?'middle':'start'},'Mão '+(first.hand+1)));
      if(last.hand!==first.hand)svg.append(node('text',{x:760,y:277,fill:'#a1a1aa','font-size':12,'text-anchor':'end'},'Mão '+(last.hand+1)));
      host.append(svg);showDetail(last);host.append(detail);
      if(points.length===1)host.append(el('p','chart-empty-hint','Você está no início do replay. Ainda há apenas um ponto visível. Avance nas mãos ou selecione “Torneio completo” para ver toda a evolução.'));
      const select=el('select'),button=el('button','','Abrir mão selecionada');select.setAttribute('aria-label','Escolher ponto do gráfico');
      points.forEach((p,i)=>{const o=el('option','',describe(p));o.value=String(i);if(i===points.length-1)o.setAttribute('selected','');select.append(o);});
      select.onchange=()=>showDetail(points[Number(select.value)]||first);button.onclick=()=>open(points[Number(select.value)]||first);
      const navigation=el('div','chart-navigation');navigation.append(select,button);host.append(navigation);
      $('graph-status').textContent='BB do nível de cada mão. '+(protectedView?'Sem spoilers: apenas mãos até o ponto atual.':showFull?'Visão completa: resultados futuros estão visíveis neste gráfico.':'Visão até a mão atual.');
    }
    function render(){
      const v=view();document.body.classList.toggle('four-colors',$('four-colors').checked);
      if(v.hand){updateTags();}
      const signature=JSON.stringify(v.annotations);if(reviewSignature!==signature){reviewSignature=signature;$('review-count').textContent=reviewEntries().filter(i=>!i.reviewed).length;}
      $('review-open').disabled=!library.length;$('graph-open').disabled=!v.hand;$('export-image').disabled=!v.hand;
    }
    $('library-open').onclick=()=>{api.stop();renderLibrary();$('library-dialog').showModal();};
    $('library-import').onclick=()=>{$('library-dialog').close();$('file').click();};
    $('review-open').onclick=()=>{api.stop();renderReview();$('review-dialog').showModal();};
    $('graph-open').onclick=()=>{api.stop();$('graph-dialog').showModal();try{graph();}catch(error){$('stack-chart').replaceChildren(el('p','empty-state','Não foi possível montar o gráfico deste histórico.'));$('graph-status').textContent=error.message;}};
    $('tag-add').onclick=()=>addTag($('tag-input').value);$('tag-input').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();addTag($('tag-input').value);}};
    document.querySelectorAll('[data-tag]').forEach(n=>n.onclick=()=>addTag(n.dataset.tag));
    for(const id of ['adv-player','adv-cards','adv-position','adv-pot-min','adv-pot-max','adv-tag'])$(id).addEventListener(id==='adv-position'||id==='adv-tag'?'change':'input',api.changed);
    $('clear-search').onclick=()=>{for(const id of ['search','adv-player','adv-cards','adv-position','adv-pot-min','adv-pot-max','adv-tag'])$(id).value='';$('filter').value='all';api.changed();};
    for(const id of ['four-colors']){$(id).checked=!!view().prefs[id];$(id).onchange=()=>{api.stop();api.preference(id,$(id).checked);api.changed();};}
    $('export-image').onclick=async()=>{api.stop();const v=view();$('export-image').disabled=true;try{const blob=await TableExport.exportPNG(v.hand,v.state,{bb:v.bb,fourColors:$('four-colors').checked,appearance:OrbitSettings.appearance(v.prefs),handNumber:v.current+1,eventNumber:v.cursor,studyCards:v.cursor===v.hand.events.length&&$('study-reveal').checked?v.hand.summaryCards:undefined,actionText:api.describe(v.state.current||{text:'Início da mão'})});api.download(`orbit-mao-${v.hand.id}-evento-${v.cursor}.png`,blob,'image/png');api.toast('Imagem da mesa exportada.');}catch(error){api.toast('Não foi possível exportar a imagem: '+error.message);}finally{$('export-image').disabled=false;}};
    return {render,mergeImport,adoptSession,rememberPosition,advanced,refreshLibrary:renderLibrary};
  }
  root.OrbitStudio={create};
})(globalThis);
