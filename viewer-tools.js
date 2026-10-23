/* Factual explanations of the current replay state. No strategy or equity estimates. */
(function(root){
  'use strict';
  function position(hand,name){return root.ReplayEngine.position({...hand,hero:name});}
  function participants(state){
    const active=state.players.filter(p=>!p.folded);
    return {active:active.length,allIn:active.filter(p=>p.allIn).length};
  }
  function actionDetail(before,event,format){
    if(!event)return '';
    const player=before?.players.find(p=>p.name===event.player);
    const extra=event.allIn?' · All-in':'';
    if(event.type==='bet'){
      const ratio=before?.pot>0?' · '+(event.amount/before.pot*100).toLocaleString('pt-BR',{maximumFractionDigits:1})+'% do pote':'';
      return `Apostou ${format(event.amount)}${before?.pot>0?' em um pote de '+format(before.pot):''}${ratio}${extra}`;
    }
    if(event.type==='raise'&&player){
      const highest=Math.max(0,...before.players.map(p=>p.bet));
      return `Aumentou de ${format(highest)} para ${format(event.to)} · Acrescentou ${format(event.to-player.bet)}${extra}`;
    }
    if(event.type==='call')return `Pagou mais ${format(event.amount)} para acompanhar a aposta${extra}`;
    if(event.type==='check')return 'Passou a vez sem apostar.';
    if(event.type==='fold')return 'Desistiu desta mão. As fichas já investidas continuam no pote.';
    if(event.type==='street')return ({flop:'As três primeiras cartas comunitárias estão na mesa.',turn:'A quarta carta comunitária está na mesa.',river:'A quinta e última carta comunitária está na mesa.',showdown:'Confira as cartas reveladas e a distribuição dos potes.'})[event.street]||'';
    if(event.type==='return')return 'A parte da aposta que não foi paga voltou para o jogador.';
    if(event.type==='collect')return 'Pagamento registrado no histórico da mão.';
    return '';
  }
  function important(event){return !!event&&(event.allIn||event.type==='street'&&['flop','turn','river','showdown'].includes(event.street));}
  const ranks='23456789TJQKA',names={2:'dois',3:'três',4:'quatros',5:'cincos',6:'seis',7:'setes',8:'oitos',9:'noves',10:'dez',11:'valetes',12:'damas',13:'reis',14:'ases'};
  function rankFive(cards){
    const values=cards.map(c=>ranks.indexOf(c[0])+2).sort((a,b)=>b-a),counts=new Map();
    for(const v of values)counts.set(v,(counts.get(v)||0)+1);
    const groups=[...counts].sort((a,b)=>b[1]-a[1]||b[0]-a[0]),unique=[...counts.keys()],flush=cards.every(c=>c[1]===cards[0][1]);
    const high=unique.length===5?(unique[0]-unique[4]===4?unique[0]:unique.join(',')==='14,5,4,3,2'?5:0):0;
    if(flush&&high)return [8,high];
    if(groups[0][1]===4)return [7,groups[0][0],groups[1][0]];
    if(groups[0][1]===3&&groups[1][1]===2)return [6,groups[0][0],groups[1][0]];
    if(flush)return [5,...values];
    if(high)return [4,high];
    if(groups[0][1]===3)return [3,...groups.map(g=>g[0])];
    if(groups[0][1]===2&&groups[1][1]===2)return [2,...groups.map(g=>g[0])];
    if(groups[0][1]===2)return [1,...groups.map(g=>g[0])];
    return [0,...values];
  }
  function compare(a,b){for(let i=0;i<Math.max(a.length,b.length);i++)if((a[i]||0)!==(b[i]||0))return (a[i]||0)-(b[i]||0);return 0;}
  function madeHand(cards){
    if(!Array.isArray(cards)||cards.length<5||cards.length>7||cards.some(c=>!(/^[2-9TJQKA][cdhs]$/).test(c))||new Set(cards).size!==cards.length)return null;
    let best=null;
    for(let a=0;a<cards.length-4;a++)for(let b=a+1;b<cards.length-3;b++)for(let c=b+1;c<cards.length-2;c++)for(let d=c+1;d<cards.length-1;d++)for(let e=d+1;e<cards.length;e++){
      const rank=rankFive([cards[a],cards[b],cards[c],cards[d],cards[e]]);if(!best||compare(rank,best)>0)best=rank;
    }
    const n=names[best[1]],k=names[best[2]],high={11:'valete',12:'dama',13:'rei',14:'ás'}[best[1]]||String(best[1]);
    const label=[`Carta alta: ${high}`,`Par de ${n}`,`Dois pares: ${n} e ${k}`,`Trinca de ${n}`,`Sequência até ${high}`,'Flush',`Full house: ${n} com ${k}`,`Quadra de ${n}`,best[1]===14?'Royal flush':`Straight flush até ${high}`][best[0]];
    return {rank:best,label};
  }
  const api={position,participants,actionDetail,important,madeHand,compare};root.ViewerTools=api;
  if(typeof module!=='undefined')module.exports=api;
})(globalThis);
