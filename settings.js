/* Local preferences shared by the settings dialog, replay and image export. */
(function(root){
  'use strict';
  const defaults={theme:'dark',accent:'#7966c7',tableColor:'green',deckFace:'ivory',deckBack:'purple',showExplanations:true,showPositions:true,reducedMotion:false,'four-colors':false,continuous:false,'hero-pause':false,spoilers:true,speed:'1','moment-pause':'0',bb:false};
  const tables={green:'#203c3b',blue:'#203c58',purple:'#39294e',graphite:'#30363d'};
  const backs={purple:'#493663',blue:'#244c7e',green:'#235847',red:'#7d3042'};
  const themes={
    dark:{bg:'#101216',panel:'#181b21',panel2:'#22262e',surface:'#14171c',field:'#12151a',text:'#f0f1f5',muted:'#a7adb9',line:'#ffffff1f',hover:'#30333e'},
    light:{bg:'#f1f3f6',panel:'#ffffff',panel2:'#e9edf3',surface:'#ffffff',field:'#f5f7fa',text:'#202735',muted:'#536174',line:'#17243b26',hover:'#e2e7ef'},
    midnight:{bg:'#0b1220',panel:'#131f32',panel2:'#1d2e46',surface:'#101b2d',field:'#0d1727',text:'#edf3fb',muted:'#a4b7ce',line:'#c1d8ff26',hover:'#283c58'}
  };
  const hex=(value,fallback)=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value.toLowerCase():fallback;
  function normalize(prefs={}){
    const p={...defaults};
    for(const key of ['showExplanations','showPositions','reducedMotion','four-colors','continuous','hero-pause','spoilers','bb'])if(typeof prefs[key]==='boolean')p[key]=prefs[key];
    for(const [key,values]of Object.entries({theme:Object.keys(themes),tableColor:Object.keys(tables),deckFace:['ivory','white','dark'],deckBack:Object.keys(backs),speed:['0.5','1','2','4'],'moment-pause':['0','1000','2000','3000']}))if(values.includes(prefs[key]))p[key]=prefs[key];
    p.accent=hex(prefs.accent,defaults.accent);return p;
  }
  function luminance(color){const rgb=color.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];}
  function appearance(prefs){
    const p=normalize(prefs),dark=p.deckFace==='dark';
    return {table:tables[p.tableColor],face:p.deckFace==='white'?'#ffffff':dark?'#232b38':'#fffaf0',back:backs[p.deckBack],ink:dark?'#f0f3f9':'#202136',red:dark?'#ff91a5':'#c32e51',diamond:dark?'#8cbcff':'#2365b9',club:dark?'#7ee0b2':'#177750'};
  }
  function create(api){
    const $=id=>document.getElementById(id),dialog=$('settings-dialog');let opener=null,lastSignature='';
    const fields={'setting-theme':'theme','setting-accent':'accent','setting-table':'tableColor','setting-face':'deckFace','setting-back':'deckBack','setting-explanations':'showExplanations','setting-positions':'showPositions','setting-reduced-motion':'reducedMotion'};
    function sync(){
      const p=normalize(api.view().prefs),signature=JSON.stringify([p,api.stored()]);
      if(signature===lastSignature)return;lastSignature=signature;
      const t=themes[p.theme],a=appearance(p),style=document.documentElement.style;
      for(const [key,value]of Object.entries({bg:t.bg,panel:t.panel,'panel-2':t.panel2,text:t.text,muted:t.muted,line:t.line,'ui-surface':t.surface,'ui-field':t.field,'ui-hover':t.hover,purple:p.accent,accent:p.theme==='light'?t.text:'#e3ddf5','site-accent':p.accent,'accent-ink':luminance(p.accent)>.179?'#101216':'#ffffff','table-color':a.table,'card-face':a.face,'card-ink':a.ink,'card-red':a.red,'card-diamond':a.diamond,'card-club':a.club,'card-back':a.back}))style.setProperty('--'+key,value);
      document.documentElement.setAttribute('data-theme',p.theme);style.setProperty('color-scheme',p.theme==='light'?'light':'dark');
      document.body.classList.toggle('hide-explanations',!p.showExplanations);document.body.classList.toggle('hide-positions',!p.showPositions);document.body.classList.toggle('reduce-motion',p.reducedMotion);
      for(const [id,key]of Object.entries(fields))if($(id).type==='checkbox')$(id).checked=p[key];else $(id).value=p[key];
      for(const id of ['four-colors','continuous','hero-pause','spoilers'])$(id).checked=p[id];
      $('setting-accent-value').textContent=p.accent.toUpperCase();$('setting-speed').value=p.speed;$('setting-units').value=p.bb?'bb':'chips';
      $('speed').value=p.speed;$('moment-pause').value=p['moment-pause'];
      document.querySelector('meta[name="theme-color"]').setAttribute('content',t.bg);
      const preview=$('settings-card-preview');preview.replaceChildren();
      for(const [rank,suit]of [['A','s'],['K','h'],['Q','d'],['J','c'],['','']]){
        const card=document.createElement('span');card.className='card'+(!rank?' back':'');card.dataset.suit=suit;
        if(rank){const r=document.createElement('span'),s=document.createElement('span');r.className='rank';r.textContent=rank;s.className='suit';s.textContent=({s:'♠',h:'♥',d:'♦',c:'♣'})[suit];card.append(r,s);card.setAttribute('aria-label',rank+' '+s.textContent);}else{card.textContent='◈';card.setAttribute('aria-label','Verso das cartas');}preview.append(card);
      }
      document.querySelectorAll('[data-accent]').forEach(n=>n.setAttribute('aria-pressed',String(n.dataset.accent===p.accent)));
      $('settings-status').textContent=api.stored()?'Preferências salvas neste navegador.':'Armazenamento indisponível · preferências só nesta sessão.';
    }
    function update(patch){api.stop();api.preferences(patch);if(patch.bb!==undefined)api.units(patch.bb);sync();api.changed();}
    function tab(name,focus=false){
      dialog.scrollTop=0;
      for(const button of document.querySelectorAll('[data-settings-tab]')){const selected=button.dataset.settingsTab===name;button.setAttribute('aria-selected',String(selected));button.setAttribute('tabindex',selected?'0':'-1');$(button.getAttribute('aria-controls')).hidden=!selected;if(selected&&focus)button.focus();}
    }
    function open(name='appearance',source=$('settings-open')){api.stop();opener=source;sync();tab(name);if(!dialog.open)dialog.showModal();$('options-toggle').setAttribute('aria-expanded','true');$('settings-tab-'+name).focus();}
    function restoreFocus(){$('options-toggle').setAttribute('aria-expanded','false');opener?.focus();}
    $('settings-open').onclick=()=>open();$('options-toggle').onclick=()=>open('playback',$('options-toggle'));
    $('settings-close').onclick=()=>{dialog.close();restoreFocus();};dialog.addEventListener('close',restoreFocus);
    for(const button of document.querySelectorAll('[data-settings-tab]')){
      button.onclick=()=>tab(button.dataset.settingsTab);
      button.onkeydown=e=>{const names=['appearance','cards','playback'],i=names.indexOf(button.dataset.settingsTab);if(['ArrowRight','ArrowLeft','Home','End'].includes(e.key)){e.preventDefault();tab(e.key==='Home'?names[0]:e.key==='End'?names[2]:names[(i+(e.key==='ArrowRight'?1:2))%3],true);}};
    }
    for(const [id,key]of Object.entries(fields))$(id).onchange=()=>update({[key]:$(id).type==='checkbox'?$(id).checked:$(id).value});
    $('setting-accent').oninput=$('setting-accent').onchange;
    document.querySelectorAll('[data-accent]').forEach(n=>n.onclick=()=>update({accent:n.dataset.accent}));
    $('setting-speed').onchange=()=>update({speed:$('setting-speed').value});$('setting-units').onchange=()=>update({bb:$('setting-units').value==='bb'});
    $('settings-reset').onclick=()=>{update({...defaults});api.toast('Configurações restauradas. Seu histórico e suas anotações foram preservados.');};
    sync();return {sync,open};
  }
  root.OrbitSettings={create,normalize,appearance};
  if(typeof module!=='undefined')module.exports={normalize,appearance};
})(globalThis);
