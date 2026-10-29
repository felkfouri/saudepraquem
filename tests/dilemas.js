'use strict';
/* Equilíbrio dos dilemas: mede se algum dilema tem resposta dominante, isto é, uma opção que deixa o Contador
   (saldo) e a Ouvidora (saldo ponderado) melhores no fim do mandato do que qualquer outra.
   Para cada partida (código × cidade × tipo de jogador), cada ano de dilema é rejogado uma vez por opção, com tudo o
   mais igual (os outros dilemas na primeira opção), no motor de referência (tests/motor.js, com os dados do index.html).
   Resultado por dilema:
     sem dominante  os jurados discordam sobre a melhor opção (é o que se quer)
     empate         todas as opções dão o mesmo resultado (dilema no último ano, com efeitos só a partir do seguinte)
     dominante      quanto cada opção vence nos dois jurados
   Uso: node tests/dilemas.js [códigos=150] [anos=10] [ajustes.json]
   ajustes.json (opcional) troca números sem editar a página, para testar: {"doacao":{"0":{"gainQ":[...]}}} muda
   campos da opção 0 do dilema doacao; {"avaliacao":{"opts":[...]}} troca a lista inteira de opções. */
const fs=require('fs');
const M=require('./motor.js');
const nSeeds=+(process.argv[2]||150),YEARS=+(process.argv[3]||10),adj=process.argv[4];
if(adj){const P=JSON.parse(fs.readFileSync(adj,'utf8'));
  for(const id in P){const d=M.D.DILEMMAS.find(x=>x.id===id);if(!d)throw new Error('dilema desconhecido: '+id);
    if(P[id].opts){d.opts=P[id].opts;continue;}
    for(const k in P[id])for(const f in P[id][k]){if(P[id][k][f]===null)delete d.opts[+k][f];else d.opts[+k][f]=P[id][k][f];}}}

// ---------- quatro tipos de jogador (as cartas e o corte de cada ano; os dilemas são decididos pelo rejogo)
const plan=(G,i,on)=>M.cardPlan(G.hand[i],on);
const lean=sh=>(sh[0]+sh[1])-(sh[3]+sh[4]);
function fill(G,order,addonOk){const cards=[],addons=[];let left=G.room;
  for(const i of order){const a=M.addonOf(G.hand[i]);const pa=a&&addonOk(a)?plan(G,i,true).first:Infinity,p0=plan(G,i,false).first;
    if(pa<=left+1e-9){cards.push(i);addons.push(i);left-=pa;}else if(p0<=left+1e-9){cards.push(i);left-=p0;}}
  return {cards,addons};}
const firstOk=(G,ks)=>ks.find(k=>M.exitOk(G,k))||'ab';
// custo por ano ganho que o jogador vê: com a equipe de avaliação, a estimativa local entra na conta
const icerSeen=(G,i)=>{const c=G.hand[i],f=G.evalOn&&c.ev!=='forte'?G.f[i]:1;return c.cost/(c.gain*f);};
const PLAYERS={
  'segue o limiar':G=>Object.assign(fill(G,G.hand.map((_,i)=>i).filter(i=>icerSeen(G,i)*1e6<40000).sort((a,b)=>icerSeen(G,a)-icerSeen(G,b)||a-b),()=>false),{exit:'ab'}),
  'pró-equidade':G=>{G.closeSel=new Set(M.closable(G).filter(p=>(p.cus-p.cus*p.h)*1e6/(p.q*p.f)>40000).map(p=>p.id));M.computeRoom(G);
    const sel=fill(G,G.hand.map((_,i)=>i).filter(i=>icerSeen(G,i)*1e6<60000).sort((a,b)=>lean(G.hand[b].sh)-lean(G.hand[a].sh)||a-b),a=>a.mix[1][0]>a.mix[1][4]);
    return Object.assign(sel,{exit:firstOk(G,['baixo','pref','fila']),close:[...G.closeSel]});},
  'gasta tudo':G=>Object.assign(fill(G,G.hand.map((_,i)=>i),()=>true),{exit:firstOk(G,['fila','baixo'])}),
  'gasta tudo, com a avaliação':G=>Object.assign(fill(G,G.hand.map((_,i)=>i).filter(i=>!(G.evalOn&&G.hand[i].ev!=='forte'&&G.f[i]<0.85)),()=>true),{exit:firstOk(G,['fila','baixo'])})
};
// joga a partida inteira; ov = {y, k}: no ano y, o dilema vai na opção k (os outros, na opção 0)
function play(cfg,player,ov){
  const G=M.newGame(cfg),dil=[];
  for(;;){
    if(!G.dilemmaDone){dil.push({y:G.year,id:G.dilemma.id,n:G.dilemma.opts.length});M.applyDilemma(G,ov&&ov.y===G.year?ov.k:0);}
    M.choose(G,player(G));M.closeYear(G);
    if(!M.nextYear(G))break;
  }
  const f=M.finalStats(G);return {C:f.net,O:f.ew,dil};
}

const R={},tau=1;
for(let seed=1;seed<=nSeeds;seed++)for(const city of Object.keys(M.D.CITIES))for(const pn in PLAYERS){
  const cfg={seed,city,years:YEARS,tutorial:false,eps:11,diff:'normal'};
  for(const d of play(cfg,PLAYERS[pn],null).dil){
    const outs=[];for(let k=0;k<d.n;k++)outs.push(play(cfg,PLAYERS[pn],{y:d.y,k}));
    const r=R[d.id]=R[d.id]||{n:0,tie:0,none:0,dom:Array(d.n).fill(0),bestC:Array(d.n).fill(0),bestO:Array(d.n).fill(0)};r.n++;
    const tie=outs.every(o=>Math.abs(o.C-outs[0].C)<=tau&&Math.abs(o.O-outs[0].O)<=tau);
    const dom=tie?-1:outs.findIndex((o,k)=>outs.every((p,j)=>j===k||(o.C>=p.C-tau&&o.O>=p.O-tau)));
    if(tie)r.tie++;else if(dom<0)r.none++;else r.dom[dom]++;
    let bc=0,bo=0;outs.forEach((o,k)=>{if(o.C>outs[bc].C)bc=k;if(o.O>outs[bo].O)bo=k;});r.bestC[bc]++;r.bestO[bo]++;
  }
}
const pc=(x,n)=>Math.round(100*x/n)+'%';
console.log('Dilemas em partidas de '+YEARS+' anos: '+nSeeds+' códigos × '+Object.keys(M.D.CITIES).length+' cidades × '+Object.keys(PLAYERS).length+' tipos de jogador.');
for(const d of M.D.DILEMMAS){const r=R[d.id];if(!r)continue;
  console.log('\n'+d.nm+' ('+r.n+' casos): sem dominante '+pc(r.none,r.n)+(r.tie?', empate '+pc(r.tie,r.n):''));
  d.opts.forEach((o,k)=>console.log('  '+o.t+': dominante '+pc(r.dom[k],r.n)+' · melhor para o Contador '+pc(r.bestC[k],r.n)+' · para a Ouvidora '+pc(r.bestO[k],r.n)));
}
