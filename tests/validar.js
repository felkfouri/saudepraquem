'use strict';
/* Validação do jogo Cobertor Curto na página real (Playwright + Chromium). Duas partes:
   1. Paridade com o motor de referência (tests/motor.js). Cada partida é jogada na página, por cliques nos
      elementos reais, e no motor, com as mesmas decisões, tomadas por quatro políticas a partir do estado do motor.
      Compara, ano a ano: dilema, cartas na mesa, apoio político, opções de corte ao alcance, compromissos, espaço
      para programas novos e os quatro placares; no fim, título, notas, herança e custo exportado.
   2. Partidas com cliques ao acaso: nenhum erro de JavaScript e nenhum ano que não feche.
   Uso: node tests/validar.js [códigos=4] [partidas ao acaso=20]
   Termina com código 0 se tudo bater. Leva cerca de 3 segundos por partida. */
const {chromium}=require('playwright');
const path=require('path'),{pathToFileURL}=require('url');
const M=require('./motor.js');
const URL=pathToFileURL(path.join(__dirname,'..','index.html')).href+'#jogo';
const KS=Object.keys(M.D.EXITS);
const fmt=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0});
const fmt1=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1,minimumFractionDigits:1});
const sgn=x=>(x>0?'+':'')+fmt.format(x);
const num=t=>t==null?NaN:+String(t).replace(/[^\d,−-]/g,'').replace(',','.').replace('−','-'); // "− R$ 1.234 mi" → -1234

// ---------- políticas: decidem pelo estado do motor (que é o da página, se ela estiver certa)
const plan=(G,i,on)=>M.cardPlan(G.hand[i],on);
const icer=(G,i)=>G.hand[i].cost/G.hand[i].gain;
const lean=sh=>(sh[0]+sh[1])-(sh[3]+sh[4]);
// marca as cartas na ordem dada enquanto couberem; com complemento quando addonOk aceita e cabe
function fill(G,order,addonOk){const cards=[],addons=[];let left=G.room;
  for(const i of order){const a=M.addonOf(G.hand[i]);const pa=a&&addonOk(a)?plan(G,i,true).first:Infinity,p0=plan(G,i,false).first;
    if(pa<=left+1e-9){cards.push(i);addons.push(i);left-=pa;}else if(p0<=left+1e-9){cards.push(i);left-=p0;}}
  return {cards,addons};}
const firstOk=(G,ks)=>ks.find(k=>M.exitOk(G,k))||'ab';
// encerramentos entram antes de escolher as cartas: o custeio liberado aumenta o espaço do ano
const withClose=(G,close)=>{G.closeSel=new Set(close);M.computeRoom(G);return close;};
const POLICIES=[
  {name:'limiar, rotina',dilemma:G=>0,   // só abaixo de R$ 40 mil, pelo custo por ano ganho; sem complemento
    decide:G=>Object.assign(fill(G,G.hand.map((_,i)=>i).filter(i=>icer(G,i)*1e6<40000).sort((a,b)=>icer(G,a)-icer(G,b)||a-b),()=>false),{exit:'ab'})},
  {name:'equidade, rodízio, encerra caros',dilemma:G=>(G.year+G.cfg.seed)%G.dilemma.opts.length,
    decide:G=>{const close=withClose(G,M.closable(G).filter(p=>(p.cus-p.cus*p.h)*1e6/(p.q*p.f)>40000).map(p=>p.id));
      const sel=fill(G,G.hand.map((_,i)=>i).sort((a,b)=>lean(G.hand[b].sh)-lean(G.hand[a].sh)||a-b),a=>a.mix[1][0]>a.mix[1][4]);
      const r=(G.year+G.cfg.seed)%KS.length;return Object.assign(sel,{exit:firstOk(G,KS.slice(r).concat(KS.slice(0,r))),close});}},
  {name:'gasta tudo, fila',dilemma:G=>G.dilemma.opts.length-1,
    decide:G=>Object.assign(fill(G,G.hand.map((_,i)=>i),()=>true),{exit:firstOk(G,['fila','baixo'])})},
  {name:'encerra um por ano, prefeito',dilemma:G=>Math.min(1,G.dilemma.opts.length-1),
    decide:G=>{const cl=M.closable(G),close=withClose(G,cl.length?[cl[0].id]:[]);
      const sel=fill(G,G.hand.map((_,i)=>i).sort((a,b)=>plan(G,a,false).first-plan(G,b,false).first||a-b),()=>false);
      return Object.assign(sel,{exit:firstOk(G,['pref','baixo','fila']),close});}}
];

function tilesOf(G){const s=M.popStats(G),d=(s.gap-s.gap0)*365;
  return {jC:sgn(Math.round(s.net)),jO:sgn(Math.round(s.ew)),jL:sgn(Math.round(s.legacy)),jG:fmt1.format(s.gap)+' anos',
    jGs:'era '+fmt1.format(s.gap0)+' em 2027 · '+(Math.abs(d)<0.05?'sem mudança':(d<0?'−':'+')+fmt1.format(Math.abs(d))+' dias por pessoa')};}
const pageTiles=page=>page.evaluate(()=>{const t=id=>document.getElementById(id).textContent;return {jC:t('jC'),jO:t('jO'),jL:t('jL'),jG:t('jG'),jGs:t('jGs')};});
const pageYear=page=>page.evaluate(()=>{
  const L=document.getElementById('gameLeft'),q=s=>L.querySelector(s),opts=L.querySelectorAll('[data-opt]');
  if(opts.length)return {dilemma:q('.event .hd').textContent};
  return {cards:[...L.querySelectorAll('.cards label.card')].map(el=>({locked:el.classList.contains('locked'),nm:el.querySelector('.nm').textContent})),
    room:(q('.money .row.tot b')||{}).textContent,apoio:(q('.apoio')||{getAttribute:()=>''}).getAttribute('aria-label'),
    chips:[...L.querySelectorAll('[data-exit]')].map(b=>({k:b.dataset.exit,on:!b.disabled}))};
});

async function start(page,cfg){
  await page.goto('about:blank');await page.goto(URL);
  await page.locator('#gStart summary',{hasText:'Configurações avançadas'}).click();
  if(!cfg.tutorial)await page.locator('#gTut').uncheck();
  if(cfg.showMath)await page.locator('#gMath').check();
  await page.locator('[data-years="'+cfg.years+'"]').click();
  await page.locator('[data-city="'+cfg.city+'"]').click();
  if(cfg.diff)await page.locator('[data-diff="'+cfg.diff+'"]').click();
  await page.locator('#gSeed').fill(String(cfg.seed));
  await page.locator('#gBegin').click();
}

// ---------- parte 1: paridade com o motor
async function parity(page,cfg,pol){
  const G=M.newGame(Object.assign({eps:11,diff:'normal'},cfg));
  await start(page,cfg);
  const diffs=[],D=(y,m)=>diffs.push('ano '+y+': '+m);
  for(;;){
    const y=G.year;let st=await pageYear(page);
    if(!G.dilemmaDone){
      if(st.dilemma!==G.dilemma.nm)D(y,'dilema na página "'+st.dilemma+'", no motor "'+G.dilemma.nm+'"');
      const k=pol.dilemma(G);M.applyDilemma(G,k);await page.locator('[data-opt="'+k+'"]').click();st=await pageYear(page);
    }else if(st.dilemma)D(y,'a página tem um dilema que o motor não tem');
    const hp=st.cards.filter(c=>!c.locked).map(c=>c.nm),hm=G.hand.map(c=>c.nm);
    if(hp.join('|')!==hm.join('|'))D(y,'cartas na página '+hp.join(' | ')+'; no motor '+hm.join(' | '));
    if(st.cards.some(c=>c.locked)!==!!G.forced)D(y,'ordem judicial difere');
    const ap=+(/: (\d+) de/.exec(st.apoio||'')||[])[1];if(ap!==G.apoio)D(y,'apoio na página '+ap+', no motor '+G.apoio);
    const kE=KS.filter(k=>G.year>=M.D.EXITS[k].from);
    if(st.chips.map(c=>c.k).join()!==kE.join())D(y,'opções visíveis na página '+st.chips.map(c=>c.k)+', no motor '+kE);
    for(const c of st.chips)if(c.on!==M.exitOk(G,c.k))D(y,'opção '+c.k+' ao alcance na página: '+c.on+'; no motor: '+M.exitOk(G,c.k));
    if(num(st.room)!==Math.round(G.room))D(y,'espaço na página '+st.room+', no motor '+G.room.toFixed(2));
    const sel=pol.decide(G);M.choose(G,sel);
    if(sel.close&&sel.close.length){
      if(!(await page.locator('#kSum').evaluate(s=>s.parentNode.open)))await page.locator('#kSum').click();
      for(const id of sel.close)await page.locator('#cl'+id).click();
    }
    if(G.K.items.length||(sel.close||[]).length){const kp=await page.locator('#kSum b').textContent().catch(()=>null);
      if(Math.abs(num(kp))!==Math.round(G.K.mun))D(y,'compromissos na página '+kp+', no motor '+G.K.mun.toFixed(2));}
    for(const i of sel.cards)await page.locator('#hc'+i).click();
    for(const i of sel.addons)await page.locator('#ac'+i).click();
    await page.locator('[data-exit="'+sel.exit+'"]').click();
    const room=await page.locator('.money .row.tot b').textContent();
    if(num(room)!==Math.round(G.room))D(y,'espaço depois de encerrar na página '+room+', no motor '+G.room.toFixed(2));
    if(await page.locator('#closeYear').isDisabled()){D(y,'"Fechar o ano" desabilitado');break;}
    await page.locator('#closeYear').click();M.closeYear(G);
    const tp=await pageTiles(page),tm=tilesOf(G);for(const k in tm)if(tp[k]!==tm[k])D(y,k+' na página '+tp[k]+', no motor '+tm[k]);
    await page.locator('#nextYear').click();
    if(!M.nextYear(G))break;
  }
  const f=M.finalStats(G);
  const fin=await page.evaluate(()=>({t:(document.querySelector('.final .n')||{}).textContent,g:[...document.querySelectorAll('.final .grades .g')].map(e=>e.textContent),share:(document.getElementById('shareTxt')||{}).value||''}));
  if(fin.t!==f.title)D('fim','título na página '+fin.t+', no motor '+f.title);
  const g=[f.gradeC,f.gradeO,f.gradeL].map(x=>fmt1.format(x));if(fin.g.join()!==g.join())D('fim','notas na página '+fin.g+', no motor '+g);
  const her=/Herança: (\d+) programas, R\$ ([\d.]+) mi por ano de custeio para a cidade · pago pela União no mandato: R\$ ([\d.]+) mi/.exec(fin.share);
  if(!her)D('fim','o resumo final não tem a linha da herança');
  else if(+her[1]!==f.herancaN||num(her[2])!==Math.round(f.herancaMun)||num(her[3])!==Math.round(f.exported))
    D('fim','herança e custo exportado na página '+her.slice(1).join(' / ')+', no motor '+[f.herancaN,Math.round(f.herancaMun),Math.round(f.exported)].join(' / '));
  return {diffs,summary:f.title+' · Contador '+sgn(Math.round(f.net))+' · Ouvidora '+sgn(Math.round(f.ew))+' · Legado '+sgn(Math.round(f.legacy))+(f.nClosed?' · '+f.nClosed+' encerrados':'')};
}

// ---------- parte 2: cliques ao acaso
async function random(page,r){
  const pick=a=>a[Math.floor(r()*a.length)];
  const cfg={seed:1+Math.floor(r()*9999),city:pick(['capital','media','envelhecida']),years:pick([10,10,5]),diff:pick(['facil','normal','normal','dificil']),tutorial:r()<0.3,showMath:r()<0.5};
  const tag=cfg.seed+' '+cfg.city+' '+cfg.years+' anos '+cfg.diff+(cfg.tutorial?' com tutorial':'');
  await start(page,cfg);
  for(let y=1;y<=cfg.years;y++){
    const nOpt=await page.locator('[data-opt]').count();if(nOpt)await page.locator('[data-opt="'+Math.floor(r()*nOpt)+'"]').click();
    if(await page.locator('#tutAck').count()&&r()<0.7)await page.locator('#tutAck').click();
    const nCl=await page.locator('.money input[id^=cl]').count();
    if(nCl&&r()<0.4){if(!(await page.locator('#kSum').evaluate(s=>s.parentNode.open)))await page.locator('#kSum').click();
      await page.locator('.money input[id^=cl]').nth(Math.floor(r()*nCl)).click();}
    const n=await page.locator('.cards label.card:not(.locked)').count();
    for(let i=0;i<n;i++)if(r()<0.45){await page.locator('#hc'+i).click();if(await page.locator('#ac'+i).count()&&r()<0.5)await page.locator('#ac'+i).click();}
    const ex=await page.locator('[data-exit]:not([disabled])').all();if(ex.length&&r()<0.7)await pick(ex).click();
    for(let i=n-1;i>=0&&await page.locator('#closeYear').isDisabled();i--)if(await page.locator('#hc'+i).isChecked())await page.locator('#hc'+i).click();
    if(await page.locator('#closeYear').isDisabled())return tag+': o ano '+y+' não fecha nem sem cartas';
    await page.locator('#closeYear').click();await page.locator('#nextYear').click();
  }
  return (await page.locator('.final .n').count())?'':tag+': não chegou à tela final';
}

(async()=>{
  const nCodes=+(process.argv[2]||4),nRandom=+(process.argv[3]||20);
  const seeds=[1,42,777,2026,9999,314,5000,123,55,8080].slice(0,nCodes);
  const cities=Object.keys(M.D.CITIES);
  const runs=[];
  for(const seed of seeds)for(const city of cities)for(const pol of POLICIES)runs.push({cfg:{seed,city,years:10,tutorial:false},pol});
  for(const seed of seeds)for(const city of cities)for(const pol of [POLICIES[0],POLICIES[2]])runs.push({cfg:{seed,city,years:5,tutorial:true},pol});
  const browser=await chromium.launch();
  const page=await (await browser.newContext({reducedMotion:'reduce'})).newPage();
  page.setDefaultTimeout(8000);page.on('dialog',d=>d.accept());
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const t0=Date.now();let ok=0;
  console.log('Parte 1: paridade com o motor de referência ('+runs.length+' partidas)');
  for(const r of runs){
    const tag=r.cfg.seed+' '+r.cfg.city+' '+r.cfg.years+' anos'+(r.cfg.tutorial?' com tutorial':'')+' · '+r.pol.name;
    let x;try{x=await parity(page,r.cfg,r.pol);}catch(e){x={diffs:['erro: '+String(e.message).split('\n')[0]]};}
    if(!x.diffs.length)ok++;
    console.log((x.diffs.length?'DIFERE  ':'igual   ')+tag+(x.summary?' → '+x.summary:'')+(x.diffs.length?'\n        '+x.diffs.slice(0,5).join('\n        '):''));
  }
  console.log('Parte 2: '+nRandom+' partidas com cliques ao acaso');
  let a=20261029;const rand=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
  const stuck=[];
  for(let k=0;k<nRandom;k++){let s;try{s=await random(page,rand);}catch(e){s='erro: '+String(e.message).split('\n')[0];}if(s){stuck.push(s);console.log('PROBLEMA '+s);}}
  await browser.close();
  console.log('\nParidade: '+ok+' de '+runs.length+' partidas iguais ao motor. Ao acaso: '+(nRandom-stuck.length)+' de '+nRandom+' chegaram ao fim. Erros de JavaScript: '+errors.length+'. Tempo: '+Math.round((Date.now()-t0)/1000)+' s.');
  if(errors.length)console.log(errors.slice(0,5).join('\n'));
  process.exit(ok===runs.length&&!stuck.length&&!errors.length?0:1);
})().catch(e=>{console.error(e);process.exit(2);});
