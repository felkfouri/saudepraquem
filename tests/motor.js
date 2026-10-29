'use strict';
/* Motor de referência do Cobertor Curto, sem navegador: as regras do jogo escritas de novo, à parte da página, para
   tests/validar.js conferir a página contra elas. Os dados (cidades, propostas com a ficha de cada uma, dilemas,
   eventos, opções de corte, dinheiro do ano e réguas) vêm do próprio index.html; as regras, não. Se uma regra mudar
   na página, mude aqui também: a validação acusa qualquer diferença.
   Faz as mesmas chamadas ao gerador da partida, na mesma ordem que a página: calendário, baralho, realizações e
   negociação da emenda (o jornal tem gerador próprio e não entra aqui). Os nomes das funções são os da página. Unidades como na página:
   saúde por grupo em QALYs, dinheiro em R$ milhões, vetores dos mais pobres (0) aos mais ricos (4).
   Regras descritas em docs/jogo.md. */
const fs=require('fs'),path=require('path');

// ---------- dados do jogo, lidos do index.html (o trecho de dados roda sozinho, sem o resto da página)
function readData(file){
  const html=fs.readFileSync(file,'utf8');
  const part=(from,to)=>{const i=html.indexOf(from),j=i<0?-1:html.indexOf(to,i);if(j<0)throw new Error(file+': não achei o trecho que começa com '+JSON.stringify(from));return html.slice(i,j);};
  const src=part('  /* ---------- Jogo: dez anos de gestão ---------- */','  // gerador com semente')+part('  const GRADES=','\n')+'\n';
  return new Function(src+'return {Y0,GL,MARGIN,CRISIS_F,EXTRA,TRANSFER,JUD,APOIO0,APOIO0_5,APOIO_MAX,CITIES,ADDON,EXITS,DECK,DILEMMAS,EVSPREAD,EVENTS,GRADES};')();
}
const D=readData(path.join(__dirname,'..','index.html'));
// cartas fixas dos anos 1 e 2 do tutorial (dealYear na página)
const TUTORIAL_HANDS={1:['Vacinação na escola pública','Rastreamento de câncer por carta','Centro de cirurgia robótica','Campanha de mídia sobre alimentação'],
  2:['Hipertensão e diabetes na atenção básica','Hospital-dia de cirurgia eletiva','Terapia gênica para doença rara','Transporte sanitário para consultas']};

const POP=200000,N=5,TOTAL=POP*N;
const sum=a=>a.reduce((s,x)=>s+x,0),mean=a=>sum(a)/a.length,zeros=()=>Array(N).fill(0);
// equivalente igualmente distribuído de Atkinson (docs/modelo.md)
function ede(h,eps){const m=mean(h);if(Math.abs(eps-1)<1e-9)return Math.exp(mean(h.map(x=>Math.log(x))));
  const s=mean(h.map(x=>Math.pow(x/m,1-eps)));return m*Math.pow(s,1/(1-eps));}
// mulberry32, o mesmo gerador da página
function rng(seed){let a=seed>>>0;return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function shuffle(a,r){for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
const addonOf=c=>D.ADDON[c.addon]||null;
function effShares(sh,a){const s=sum(sh);const [w,ref]=a.mix;return sh.map((v,i)=>(1-w)*100*v/s+w*ref[i]);}

// ---------- partida
// cfg: {seed, years: 10|5, eps, tutorial, city: 'capital'|'media'|'envelhecida', diff: 'facil'|'normal'|'dificil'}
function newGame(cfg0){
  const cfg=Object.assign({years:10,eps:11,seed:1,tutorial:false,city:'capital',diff:'normal'},cfg0);
  cfg.seed=Math.max(1,Math.min(9999,Math.floor(+cfg.seed)||1));
  const city=D.CITIES[cfg.city];if(!city)throw new Error('cidade desconhecida: '+cfg.city);
  const r=rng(cfg.seed*7919+cfg.years);
  const evKeys=shuffle(Object.keys(D.EVENTS),r);
  const nEv=cfg.years===10?4:2,nDi=nEv;
  const pool=shuffle(Array.from({length:cfg.years-1},(_,k)=>k+2),r);
  const pick=(n,avoid)=>{const out=[];for(const y of pool){if(out.length>=n)break;if(avoid.has(y))continue;out.push(y);}return out.sort((a,b)=>a-b);};
  const dYears=cfg.tutorial?[2,...pick(nDi-1,new Set([2]))]:pick(nDi,new Set());
  const evYears=pick(nEv,new Set(dYears));
  const sched={};evYears.forEach((y,i)=>sched[y]=evKeys[i]);
  const G={cfg,city,r,year:1,deck:shuffle(D.DECK.slice(),r),sched,cum:zeros(),funded:[],progs:[],nextId:1,pending:{},pendingLoss:{},due:{},pens:[],
    hand:[],apoio:cfg.years===5?D.APOIO0_5:D.APOIO0,lastPaid:'ab',exported:{fed:0,transfer:0},evalOn:cfg.diff==='facil',erosionF:1,erosionTemp:null,dsched:{}};
  const dk=shuffle(D.DILEMMAS.slice(),r);
  if(cfg.tutorial){const k=dk.findIndex(d=>d.id==='avaliacao');[dk[0],dk[k]]=[dk[k],dk[0]];}
  dYears.forEach((y,i)=>G.dsched[y]=dk[i]);
  dealYear(G);
  return G;
}
function dealYear(G){
  const evk=G.sched[G.year]||null;G.evKey=evk;G.ev=evk?D.EVENTS[evk]:null;
  G.chosen=new Set();G.active=new Set();G.closeSel=new Set();G.exit='ab';G.closed=false;
  if(G.year>1)G.apoio=Math.min(D.APOIO_MAX,G.apoio+1);
  let margin=D.MARGIN;if(G.ev&&G.ev.marginF)margin=Math.round(D.MARGIN*G.ev.marginF);
  const pen=sum(G.pens.map(p=>p.amt));if(pen){margin=Math.max(0,margin-pen);G.pens=[];}
  G.margin=margin;G.fedYear=G.ev&&G.ev.fed||0;
  G.dilemma=G.dsched[G.year]||null;G.dilemmaDone=!G.dilemma;G.dilemmaSpend=0;
  if(G.deck.length<5)G.deck=shuffle(D.DECK.filter(d=>!G.hand.includes(d)),G.r);
  let hand=G.deck.splice(0,4);
  if(G.cfg.tutorial&&G.year<=2){G.deck.push(...hand);hand=TUTORIAL_HANDS[G.year].map(n=>D.DECK.find(c=>c.nm===n));G.deck=G.deck.filter(c=>!hand.includes(c));}
  if(G.ev&&G.ev.ensureTag&&!hand.some(c=>(c.tags||[]).includes(G.ev.ensureTag))){
    const i=G.deck.findIndex(c=>(c.tags||[]).includes(G.ev.ensureTag));if(i>=0){G.deck.push(hand[0]);hand[0]=G.deck.splice(i,1)[0];}
  }
  if(G.ev&&G.ev.extra)hand.push(G.ev.extra);
  G.hand=hand;G.forced=G.ev&&G.ev.forced?G.ev.forced:null;
  const draw=c=>{const [lo,hi]=D.EVSPREAD[c.ev];return lo+(hi-lo)*G.r();};G.f=hand.map(draw);G.fForced=G.forced?draw(G.forced):1;
  G.forcedMun=G.forced?D.JUD.cus:0;
  computeRoom(G);
}

// ---------- opções de corte e apoio político
const isElection=G=>(D.Y0+G.year-1)%4===0;
const apoioCost=(G,k)=>{const s=D.EXITS[k];return s.apoio+(s.elec&&isElection(G)?1:0)+(s.rep&&G.lastPaid===k?1:0);};
const exitOk=(G,k)=>k==='ab'||G.year>=D.EXITS[k].from&&!(D.EXITS[k].noCrise&&G.evKey==='crise')&&G.apoio>=apoioCost(G,k);
function exitOc(G,k){const s=D.EXITS[k];if(G.ev&&G.ev.oc&&!s.spare)return G.ev.oc;
  const base=s.cityOc?G.city.srcAb:s.oc;if(!s.tilt)return base;const t=(G.city.srcAb[0]-20)/15;return base.map(v=>20+t*(v-20));}
const marginOc=G=>G.ev&&G.ev.oc?G.ev.oc:G.city.net;

// ---------- programas, compromissos e espaço do ano
function cardPlan(c,on){
  const a=addonOf(c),useA=!!(a&&on),cm=useA?a.cost:1,gm=useA?a.gain:1,n=c.profile.length;
  const cost=Math.round(c.cost*cm),gain=Math.round(c.gain*gm),sh=useA?effShares(c.sh,a):c.sh.slice();
  const p={useA,addonT:useA?a.t:'',pontual:!c.cus,n,cost,gain,sh,profile:c.profile};
  if(p.pontual)return Object.assign(p,{first:c.cost*cm,imp:c.cost*cm,cus:0,h:0,q:0});
  const imp=c.imp*cm,cus=c.cus*cm;
  return Object.assign(p,{first:imp+cus,imp,cus,h:c.h||0,q:gain/n});
}
function progYearCost(p,y){if(p.pontual||p.closedAt&&p.closedAt<=y||y<=p.start)return null;const fed=p.cus*p.h;return {mun:p.cus-fed,fed};}
function addDue(G,yr,mun,fed,nm){const d=G.due[yr]||(G.due[yr]={mun:0,fed:0,items:[]});d.mun+=mun;d.fed+=fed;d.items.push({nm,mun,fed});}
const addRecurring=(G,amt,y0,y1,nm)=>{for(let y=y0;y<=y1;y++)addDue(G,y,amt,0,nm);};
function commitments(G,skip){
  let mun=0,fed=0;const items=[];
  for(const p of G.progs){if(skip&&skip.has(p.id))continue;const c=progYearCost(p,G.year);if(!c)continue;mun+=c.mun;fed+=c.fed;items.push({id:p.id,nm:p.nm,mun:c.mun,fed:c.fed});}
  const d=G.due[G.year];if(d){mun+=d.mun;fed+=d.fed;items.push(...d.items);}
  return {mun,fed,items};
}
const capOf=G=>G.fedYear+G.margin+D.EXTRA;
function computeRoom(G){G.K=commitments(G,G.closeSel);G.room=Math.max(0,capOf(G)-G.K.mun-G.forcedMun-G.dilemmaSpend);}
const closable=G=>G.progs.filter(p=>!p.pontual&&!p.closedAt&&p.start<G.year);
function schedule(G,profile,sh,y0,total){const tot=sum(sh);
  profile.forEach((pp,k)=>{const yr=y0+k;if(!G.pending[yr])G.pending[yr]=zeros();for(let q=0;q<N;q++)G.pending[yr][q]+=total*pp*sh[q]/tot;});}
// a conta do ano: transferência → opção escolhida, até o teto → margem → rotina
function waterfall(G,Tm,k){
  let rest=Math.max(0,Tm);const fed=Math.min(G.fedYear,rest);rest-=fed;
  let ex=0;if(k!=='ab'){ex=Math.min(D.EXITS[k].cap,rest);rest-=ex;}
  const m=Math.min(Math.max(0,G.margin),rest);rest-=m;
  return {fed,exit:ex,margin:m,ab:rest,k};
}
function lossOf(G,tr){
  const now=zeros(),later={};let d=0;
  const add=(amt,prod,oc,lag)=>{if(!(amt>0))return;const x=amt*1e6/D.GL*prod;d+=x;
    (lag||[1]).forEach((f,j)=>{let t=now;if(j){if(!later[G.year+j])later[G.year+j]=zeros();t=later[G.year+j];}for(let i=0;i<N;i++)t[i]+=x*oc[i]/100*f;});};
  add(tr.margin,1,marginOc(G),null);
  if(tr.exit>0){const s=D.EXITS[tr.k];add(tr.exit,s.prod,exitOc(G,tr.k),s.lag);}
  if(tr.ab>0)add(tr.ab,D.EXITS.ab.prod,exitOc(G,'ab'),D.EXITS.ab.lag);
  return {now,later,d};
}

// ---------- decisões do ano
function applyDilemma(G,k){
  if(!G.dilemma||G.dilemmaDone)throw new Error('não há dilema pendente no ano '+G.year);
  const o=G.dilemma.opts[k];if(!o)throw new Error('opção de dilema inválida: '+k);
  G.dilemmaChoice=k;G.dilemmaDone=true;
  if(o.budget&&o.budget<0)G.dilemmaSpend+=-o.budget;
  if(o.gainQ){for(let i=0;i<N;i++)G.cum[i]+=o.gainQ[i];}
  if(o.lossQ){for(let i=0;i<N;i++)G.cum[i]-=o.lossQ[i];}
  if(o.penalty)G.pens.push({amt:o.penalty,why:o.why});
  if(o.recurring)addRecurring(G,o.recurring.amt,G.year+1,Math.min(G.cfg.years,G.year+o.recurring.years),o.recurring.nm);
  if(o.evalOn)G.evalOn=true;
  if(o.erosion)G.erosionF=o.erosion;
  if(o.erosionTemp)G.erosionTemp={f:o.erosionTemp.f,until:G.year+o.erosionTemp.years-1};
  if(o.negotiate){const ng=o.negotiate;if(G.r()<0.5){for(let i=0;i<N;i++)G.cum[i]+=ng.gainQ[i];addRecurring(G,ng.amt,G.year+1,G.cfg.years,'UPA negociada');}
    else G.pens.push({amt:ng.penalty,why:'emenda negociada'});}
  computeRoom(G);
}
// sel: {cards: [índices da mão], addons: [índices com complemento], exit: 'ab'|'fila'|'pref'|'baixo', close: [ids de programa]}
function choose(G,sel){
  if(G.closed)throw new Error('ano já fechado');
  if(!G.dilemmaDone)throw new Error('resolva o dilema antes');
  G.chosen=new Set(sel.cards||[]);G.active=new Set(sel.addons||[]);G.closeSel=new Set(sel.close||[]);
  for(const i of G.chosen)if(!G.hand[i])throw new Error('carta inválida: '+i);
  for(const i of G.active)if(!G.chosen.has(i)||!addonOf(G.hand[i]))throw new Error('complemento inválido: '+i);
  const cl=closable(G);for(const id of G.closeSel)if(!cl.some(p=>p.id===id))throw new Error('programa que não pode ser encerrado: '+id);
  const k=sel.exit||'ab';if(!exitOk(G,k))throw new Error('opção fora de alcance no ano '+G.year+': '+k);G.exit=k;
  computeRoom(G);
  const spent=sum([...G.chosen].sort((a,b)=>a-b).map(i=>cardPlan(G.hand[i],G.active.has(i)).first));
  if(spent>G.room+1e-9)throw new Error('as cartas passam do espaço do ano '+G.year+': '+spent.toFixed(1)+' > '+G.room.toFixed(1));
}
function closeYear(G){
  if(G.closed)throw new Error('ano já fechado');
  if(!G.dilemmaDone)throw new Error('resolva o dilema antes');
  // 1. encerramentos  2. compromissos  3. programas novos
  for(const p of G.progs)if(G.closeSel.has(p.id))p.closedAt=G.year;
  const K=commitments(G,null);
  let newMun=0;
  for(const i of [...G.chosen].sort((a,b)=>a-b)){
    const c=G.hand[i],pl=cardPlan(c,G.active.has(i));
    const f=G.f[i]*(c.tipo==='infraestrutura'?G.city.infra:1);
    const p=Object.assign({id:G.nextId++,nm:c.nm+(pl.useA?' ('+pl.addonT+')':''),card:c.nm,tags:c.tags||[],f,start:G.year,closedAt:0},pl);
    newMun+=pl.first;
    if(pl.pontual)schedule(G,pl.profile,pl.sh,G.year,pl.gain*f);
    G.progs.push(p);G.funded.push(p);
  }
  // 4. cada programa em funcionamento planta o ganho de um ano  5. ordem judicial
  for(const p of G.progs){if(p.pontual||p.closedAt||p.start>G.year)continue;schedule(G,p.profile,p.sh,G.year,p.q*p.f);}
  if(G.forced){const c=G.forced;schedule(G,c.profile,c.sh,G.year,c.gain*G.fForced);
    for(let k=1;k<c.profile.length;k++){const fed=D.JUD.cus*D.JUD.h;addDue(G,G.year+k,D.JUD.cus-fed,fed,c.nm);}
    G.funded.push({nm:c.nm,forced:true});}
  // 6. ganho do ano  7. a conta do ano e quem paga  8. apoio político
  const gainQ=(G.pending[G.year]||zeros()).slice();delete G.pending[G.year];
  const Tm=K.mun+G.forcedMun+newMun+G.dilemmaSpend;
  const tr=waterfall(G,Tm,G.exit),Lo=lossOf(G,tr),lossQ=Lo.now.slice();
  for(const yr in Lo.later){if(!G.pendingLoss[yr])G.pendingLoss[yr]=zeros();for(let i=0;i<N;i++)G.pendingLoss[yr][i]+=Lo.later[yr][i];}
  G.exported.fed+=K.fed;G.exported.transfer+=tr.fed;
  if(tr.exit>0)G.apoio-=apoioCost(G,G.exit);
  G.lastPaid=tr.exit>0?G.exit:'ab';
  // 9. erosão, perdas adiadas que vencem agora e epidemia
  let ef=G.erosionF;if(G.erosionTemp){if(G.year<=G.erosionTemp.until)ef*=G.erosionTemp.f;else G.erosionTemp=null;}
  for(let i=0;i<N;i++)lossQ[i]+=G.city.erosion[i]*ef;
  const late=G.pendingLoss[G.year]||zeros();delete G.pendingLoss[G.year];for(let i=0;i<N;i++)lossQ[i]+=late[i];
  if(G.ev&&G.ev.damage){const mit=G.progs.some(p=>p.tags.includes(G.ev.mitigTag)&&p.start<G.year&&(!p.closedAt||p.closedAt>G.year));G.ev.damage.forEach((d,i)=>{lossQ[i]+=mit?d/2:d;});}
  // 10. saldo do ano
  for(let i=0;i<N;i++)G.cum[i]+=gainQ[i]-lossQ[i];
  G.closed=true;
  return {gainQ,lossQ,Tm,tr,displaced:Lo.d};
}
function nextYear(G){if(!G.closed)throw new Error('feche o ano antes');if(G.year>=G.cfg.years)return false;G.year++;dealYear(G);return true;}

// ---------- placar
const pendingTotal=G=>Object.values(G.pending).reduce((s,a)=>s+sum(a),0);
const pendingLossTotal=G=>Object.values(G.pendingLoss).reduce((s,a)=>s+sum(a),0);
function popStats(G){
  const h0=G.city.h0,h=h0.map((x,i)=>x+G.cum[i]/POP),future=pendingTotal(G),owe=pendingLossTotal(G);
  return {h,net:sum(G.cum),ew:(ede(h,G.cfg.eps)-ede(h0,G.cfg.eps))*TOTAL,gap:h[4]-h[0],gap0:h0[4]-h0[0],future,owe,legacy:future-owe};
}
function heranca(G){let mun=0,fed=0,n=0;for(const p of G.progs){if(p.pontual||p.closedAt)continue;n++;const f=p.cus*p.h;mun+=p.cus-f;fed+=f;}return {mun,fed,n};}
function finalStats(G){
  const s=popStats(G),d=(s.gap-s.gap0)*365,R=D.GRADES[G.cfg.years],cl=x=>Math.max(0,Math.min(10,x));
  let title;
  if(!G.funded.some(c=>!c.forced))title='O Ausente';
  else if(s.net>=R.thrN&&d<=-R.thrD&&s.ew>0)title='O Equilibrista';
  else if(s.net>=R.thrN)title='O Contador-chefe';
  else if(d<=-R.thrD&&s.ew>0)title='A Ouvidora';
  else if(s.net<0&&d>5)title='O Afundador';
  else if(s.legacy>=R.L*0.8&&s.net<R.thrN)title='O Plantador';
  else title='O Morno';
  const her=heranca(G);
  return {title,net:s.net,ew:s.ew,legacy:s.legacy,gapDays:d,gradeC:cl(s.net/R.C*10),gradeO:cl(s.ew/R.O*10),gradeL:cl(s.legacy/R.L*10),
    herancaN:her.n,herancaMun:her.mun,exported:G.exported.fed+G.exported.transfer,nClosed:G.progs.filter(p=>p.closedAt).length};
}

module.exports={D,newGame,dealYear,applyDilemma,choose,closeYear,nextYear,cardPlan,computeRoom,closable,exitOk,apoioCost,addonOf,popStats,finalStats};
