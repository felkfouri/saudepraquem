'use strict';
/* Consistência dos dados do jogo, sem navegador e em menos de um segundo: confere as regras que os comentários de
   index.html e docs/jogo.md pedem para cada proposta, cidade, opção de corte, evento, dilema e combinação (somas,
   imp + n·cus = cost, chaves que existem, nomes repetidos). Os dados são lidos do index.html por tests/motor.js.
   Uso: node tests/dados.js   (termina com código 0 se não houver problema) */
const M=require('./motor.js'),D=M.D;
const sum=a=>a.reduce((s,x)=>s+x,0),near=(a,b)=>Math.abs(a-b)<1e-9;
const TIPOS=['prevenção','tratamento','infraestrutura','gestão'],TAGS=['aps','vig'];
const P=[],bad=(onde,msg)=>P.push(onde+': '+msg);

// uma carta (do baralho ou de evento): distribuição, perfil, ficha do programa e campos com valores conhecidos
function card(c,onde){
  if(!c.nm)bad(onde,'carta sem nm');
  if(!Array.isArray(c.sh)||c.sh.length!==5||!near(sum(c.sh),100))bad(onde,'sh deve ter 5 valores somando 100 (soma '+sum(c.sh||[])+')');
  if(!Array.isArray(c.profile)||!near(sum(c.profile),1))bad(onde,'profile deve somar 1 (soma '+sum(c.profile||[])+')');
  if(!D.EVSPREAD[c.ev])bad(onde,'ev desconhecida: '+c.ev);
  if(!TIPOS.includes(c.tipo))bad(onde,'tipo sem ícone: '+c.tipo);
  if(c.cus){if(!near((c.imp||0)+c.profile.length*c.cus,c.cost))bad(onde,'imp + n·cus = '+((c.imp||0)+c.profile.length*c.cus)+', cost = '+c.cost);}
  else if(c.imp||c.h||c.hab)bad(onde,'ação pontual (sem cus) com imp, h ou hab');
  if(c.h&&!(c.h>0&&c.h<1))bad(onde,'h fora de (0, 1)');
  if(c.h&&!/^com /.test(c.hab||''))bad(onde,'h sem hab que comece com "com "');
}

const names=new Set();
D.DECK.forEach((c,i)=>{const onde='DECK['+i+'] '+c.nm;card(c,onde);
  if(names.has(c.nm))bad(onde,'nome repetido');names.add(c.nm);
  if(!c.story||!c.src)bad(onde,'falta story ou src');
  if(!(Number.isInteger(c.eq)&&c.eq>=0))bad(onde,'eq deve ser um inteiro ≥ 0');
  if(c.addon&&!D.ADDON[c.addon])bad(onde,'addon desconhecido: '+c.addon);
  if(c.pilot&&!c.cus)bad(onde,'piloto só em programa (com cus)');
  for(const t of c.tags||[])if(!TAGS.includes(t))bad(onde,'tag desconhecida: '+t);
});
for(const k in D.ADDON){const a=D.ADDON[k];if(!(a.t&&a.d&&a.cost>0&&a.gain>0&&a.mix&&a.mix[1].length===5&&near(sum(a.mix[1]),100)))bad('ADDON.'+k,'precisa de t, d, cost, gain e mix:[w, perfil que soma 100]');}
for(const s of D.SINERGIAS)for(const n of [...s.par,...s.alvo])if(!names.has(n))bad('SINERGIAS "'+s.nm+'"','carta inexistente: '+n);
for(const y in D.TUTORIAL_HANDS)for(const n of D.TUTORIAL_HANDS[y])if(!names.has(n))bad('TUTORIAL_HANDS['+y+']','carta inexistente: '+n);

for(const k in D.CITIES){const c=D.CITIES[k];
  for(const f of ['h0','erosion','srcAb','net'])if(!Array.isArray(c[f])||c[f].length!==5)bad('CITIES.'+k,f+' deve ter 5 valores');
  for(const f of ['srcAb','net'])if(!near(sum(c[f]),100))bad('CITIES.'+k,f+' deve somar 100 (soma '+sum(c[f])+')');
  if(!(c.infra>0&&Number.isInteger(c.eq)&&c.nm&&c.desc))bad('CITIES.'+k,'precisa de nm, desc, infra e eq');}
for(const k in D.EXITS){const e=D.EXITS[k];
  if(e.oc&&!near(sum(e.oc),100))bad('EXITS.'+k,'oc deve somar 100');
  if(!e.oc&&!e.cityOc)bad('EXITS.'+k,'precisa de oc ou cityOc');
  if(e.lag&&!near(sum(e.lag),1))bad('EXITS.'+k,'lag deve somar 1');
  if(k!=='ab'&&!(e.cap>0))bad('EXITS.'+k,'falta o teto (cap)');
  if(!(e.who&&e.who.length&&e.hint&&e.quem))bad('EXITS.'+k,'faltam hint, quem ou who');}
for(const k in D.EVENTS){const e=D.EVENTS[k];
  if(!(e.nm&&e.txt&&e.jornal))bad('EVENTS.'+k,'faltam nm, txt ou jornal');
  if(e.forced)card(e.forced,'EVENTS.'+k+'.forced');
  if(e.extra)card(e.extra,'EVENTS.'+k+'.extra');
  if(e.oc&&!near(sum(e.oc),100))bad('EVENTS.'+k,'oc deve somar 100');
  if(e.damage&&!e.mitigTag)bad('EVENTS.'+k,'damage sem mitigTag');
  if(e.ensureTag&&!D.DECK.some(c=>(c.tags||[]).includes(e.ensureTag)))bad('EVENTS.'+k,'nenhuma carta com a tag '+e.ensureTag);}
const ids=new Set();
for(const d of D.DILEMMAS){const onde='DILEMMAS '+d.id;
  if(ids.has(d.id))bad(onde,'id repetido');ids.add(d.id);
  d.opts.forEach((o,k)=>{if(!(o.t&&o.d&&o.n))bad(onde,'opção '+k+' sem t, d ou n');
    for(const f of ['gainQ','lossQ','gainYear'])if(o[f]&&o[f].length!==5)bad(onde,'opção '+k+': '+f+' deve ter 5 valores');});}
if(!ids.has('avaliacao'))bad('DILEMMAS','falta o dilema avaliacao, usado no ano 2 do tutorial');
for(const n of [5,10]){if(!D.GRADES[n]||!D.PACTO[n]||!D.CONF[n])bad('GRADES/PACTO/CONF','faltam as regras do modo de '+n+' anos');}

console.log(P.length?P.length+' problema(s) nos dados:\n  '+P.join('\n  '):'Dados do jogo consistentes: '+D.DECK.length+' propostas, '+D.DILEMMAS.length+' dilemas, '+Object.keys(D.EVENTS).length+' eventos, '+Object.keys(D.CITIES).length+' cidades.');
process.exit(P.length?1:0);
