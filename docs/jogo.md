# Cobertor Curto: regras e dados do jogo

Como o jogo funciona por dentro e como acrescentar conteúdo. As fórmulas de saúde (EDE, saldo ponderado) estão em [`modelo.md`](modelo.md). Todo o código fica na seção "Jogo" do script de `index.html`.

A ideia central é "o cobertor que encolhe": cada programa aprovado continua custando todo ano enquanto funciona, então o espaço para os próximos diminui. Para pagar a conta do ano, o jogador escolhe o que deixa de ser feito, e cada escolha tira saúde de grupos diferentes.

## Configuração da partida

Definida na tela "Antes de assumir" e guardada em `cfg`:

| Opção | Valores | Efeito |
|---|---|---|
| Duração | 10 anos (padrão) ou 5 | 4 eventos e 4 dilemas em 10 anos; 2 e 2 em 5 anos. Muda também o apoio político inicial e a régua das notas finais. |
| Dificuldade | fácil, normal, difícil | ver [Dificuldade](#dificuldade) |
| Cidade | capital desigual, cidade média, cidade envelhecida | saúde de partida, erosão da rotina, quem perde em cada corte e bônus de infraestrutura (`CITIES`) |
| ε da Ouvidora | 0 a 20 (padrão 11) | aversão à desigualdade usada no saldo ponderado |
| Tutorial | ligado (padrão) | anos 1 e 2 com cartas fixas, dilema da equipe de avaliação no ano 2 e dicas passo a passo (`coach`) |
| Mostrar a conta | desligado (padrão) | abre a planilha da DCEA ao fechar cada ano (`mathHtml`) |
| Código da partida | 1 a 9999 | semente do sorteio |

### Semente e reprodutibilidade

`rng(seed)` é um gerador mulberry32. A partida usa `rng(código × 7919 + duração)`, e `newGame` sorteia logo no início o calendário de eventos e dilemas e a ordem do baralho. Duas pessoas com o mesmo código, a mesma duração e a mesma escolha de tutorial recebem os mesmos eventos, dilemas e propostas.

O mesmo gerador continua sendo usado durante a partida (realização da evidência, reembaralhamento do baralho, resultado da negociação da emenda). A quantidade de sorteios por ano não depende das escolhas, com uma exceção: escolher "Negociar o endereço" consome um sorteio a mais. Daí em diante, para quem negociou, a realização da evidência e as cartas depois que o baralho é refeito deixam de coincidir com as de quem não negociou. O calendário de eventos e dilemas não muda. Encerrar programas, escolher o que deixa de ser feito e o apoio político não usam o gerador.

O jornal tem um gerador próprio (`G.jr`), derivado do mesmo código, para a data, as variações de texto, a carta do leitor e as notas breves. Assim, acrescentar ou tirar textos do jornal não muda nenhuma partida.

Piloto, equipes, combinações, custeio que encarece, conferência, pacto e eleição não usam o gerador: o card de "ampliar o piloto" volta à mesa com a realização já sorteada no ano do piloto. Por isso essas regras não mudaram o que cada código produz.

Qualquer mudança que acrescente, remova ou reordene chamadas a `G.r()` muda o que cada código produz. O mesmo vale para acrescentar cartas, dilemas ou eventos, que mudam o tamanho do que é embaralhado.

### Conferir uma mudança

`tests/motor.js` reescreve as regras deste documento sem navegador, lendo os dados do próprio `index.html`, e `tests/validar.js` joga partidas na página e no motor com as mesmas decisões e compara ano a ano (ver o [README](../README.md#validação-automática-do-jogo)). Mudar dados não exige mexer no motor; mudar uma regra, sim.

## O ciclo de um ano

```
dealYear()        abre o ano: evento, apoio, margem, repasse do pacto, dilema, cartas (e o piloto do ano anterior,
   │              para ampliar), realização sorteada, equipes, conferência e espaço para programas novos
   │
   ├─ dilema?  →  applyDilemma(k)   (antes do orçamento)
   │
   ├─ jogador marca cartas, complementos, pilotos, programas a encerrar, o compromisso da conferência (anos de
   │  conferência), o pacto (ano 1) e o que deixa de ser feito  (renderYear redesenha a cada ação)
   │
closeYear()       encerra, inicia programas e pilotos, planta o ganho do ano (com as combinações), paga a conta,
   │              cobra a saúde deslocada, confere conferência, pacto e eleição, gera jornal e jurados
   │
nextYear()        próximo ano, ou renderFinal() no último
```

### 1. O dinheiro do ano (`dealYear`, `computeRoom`)

| Parcela | Valor | Constante |
|---|---|---|
| Margem do ano | R$ 150 mi; na crise fiscal, R$ 53 mi (× 0,35) | `MARGIN`, `CRISIS_F` |
| Transferência federal (evento) | R$ 200 mi, só naquele ano | `TRANSFER` |
| Cortes permitidos além da margem, para abrir espaço a programas novos | R$ 100 mi | `EXTRA` |
| Compromissos | custeio municipal dos programas em funcionamento, contas de dilemas, segunda parcela da ordem judicial | `commitments` |
| Ordem judicial (evento) | R$ 125 mi neste ano | `JUD` |
| Dilema | o que a opção escolhida tira do ano (mutirão, equipe de avaliação, resposta à enchente) | `G.dilemmaSpend` |
| Repasse do pacto | R$ 150 mi no ano seguinte ao prazo, se a meta foi cumprida; soma-se à transferência | `PACTO.bonus`, `G.fedPact` |

**Espaço para programas novos** = transferência (do evento e do pacto) + margem + `EXTRA` − compromissos − ordem judicial − dilema, com mínimo zero. As cartas marcadas precisam caber nele: se passarem, "Fechar o ano" fica desabilitado até o jogador desmarcar algo ou encerrar um programa. Compromissos, ordem judicial e dilema são pagos sempre, mesmo que passem do limite (o painel avisa quando isso acontece), então nenhuma partida trava.

**Equipes.** Além do dinheiro, as cartas marcadas precisam caber nas equipes do ano (`G.eqCap`): quantas a secretaria consegue contratar e treinar para implantar programas novos. São `CITY.eq` (5 na capital, 3 na cidade média, 4 na envelhecida), mais 1 por ano depois de conceder o reajuste da atenção básica (`eqUp`) e menos 2 no ano da greve (`eqMinus`). Cada carta pede `eq` equipes; a busca ativa pede mais 1 (`ADDON.busca.eq`); um piloto pede 1 se a carta pede alguma. Equipes não acumulam de um ano para o outro e não são gastas pelos programas que já funcionam. Se a seleção passar das equipes, "Fechar o ano" fica desabilitado.

A margem é o quanto a receita da saúde cresce no ano. Sem programa novo, ela reforçaria a rede; gasta em outra coisa, desloca saúde como qualquer gasto (ver [3](#3-para-pagar-o-que-deixa-de-ser-feito-exits)). Os cortes vindos de dilemas (reordenar a fila: R$ 40 mi; emenda negociada que dá errado: R$ 60 mi) saem da margem do ano seguinte, com piso zero, e o aviso lista cada motivo (`G.pens`).

### 2. As cartas e a ficha de cada uma

Saem quatro cartas do baralho (`DECK`). O evento "Pressão da indústria" acrescenta uma quinta e a "Judicialização" impõe uma carta paga obrigatoriamente. Quando restam menos de cinco cartas, o baralho é refeito com todas as propostas, menos as que estiveram na mesa no ano anterior.

Para cada carta, sorteia-se já na abertura do ano a fração do ganho prometido que vai de fato aparecer, uniforme na faixa da força da evidência (`EVSPREAD`):

| Evidência | Faixa |
|---|---|
| forte | 90% a 110% |
| moderada | 70% a 120% |
| fraca | 30% a 130% |

Com a equipe de avaliação contratada (ou no modo fácil), as cartas de evidência moderada ou fraca mostram esse valor antes da escolha.

**Programa ou ação pontual** (`cardPlan`). Cada carta tem o custo total para o SUS (`cost`) e, se for um programa, uma ficha com implantação (`imp`) e custeio anual (`cus`), com `imp + n·cus = cost`, em que n é o número de anos do `profile`:

- no ano da aprovação, o programa paga `imp + cus` (o card mostra "R$ X mi + R$ Y mi/ano");
- a partir do ano seguinte, paga o custeio todo ano enquanto funcionar, como compromisso. O custeio sobe `CUS_G` (3%) por ano de funcionamento: no ano y, `cus × 1,03^(y − início)`. É o reajuste de salários e contratos, que a margem não acompanha. A União paga a parte `h` desse custeio (o card diz como, em `hab`); essa parte não sai da cidade e vai para o custo exportado;
- cada ano de funcionamento planta `gain/n` anos de vida saudável (× complemento × realização, e × `CITY.infra` se for infraestrutura), espalhados pelo `profile`. Em n anos o programa entrega exatamente a promessa do card; depois, segue rendendo `gain/n` por ano.

O custo por ano ganho e o selo do limiar usam o preço de hoje (`cost ÷ gain`, com `imp + n·cus = cost`), sem o reajuste; na lista de compromissos, o custo por ano ganho de cada programa em funcionamento usa o custeio do ano.

Cartas sem `cus` são ações pontuais (terapia gênica, campanha de mídia, aplicativo, mutirão de catarata): pagam `cost` no ano e rendem `gain` uma vez, pelo `profile`. O SAMU rende em dois anos (`profile:[.5,.5]`).

Financiar de novo uma carta cujo programa já funciona cria um segundo programa, com o próprio custeio e o próprio ganho; o card avisa.

**Complementos** (`ADDON`): ao marcar uma carta que tem o campo `addon`, aparece uma escolha extra sobre como fazer. O complemento multiplica custo (implantação e custeio) e ganho e mistura a distribuição original com um perfil de referência (`POOR` ou `RICH`):

$$s'_i = (1-w)\cdot 100\cdot\frac{s_i}{\sum_j s_j} + w \cdot \text{ref}_i$$

| Chave | Rótulo | Custo | Ganho | Mistura |
|---|---|---:|---:|---|
| `busca` | com busca ativa | ×1,25 | ×1,10 | 50% `POOR` |
| `periferia` | instalar na periferia | ×1,15 | ×1,00 | 50% `POOR` |
| `criterio` | fila por critério clínico | ×1,00 | ×1,00 | 30% `POOR` |
| `particular` | estender à rede particular conveniada | ×1,10 | ×1,15 | 50% `RICH` |
| `gratuito` | com transporte gratuito até o serviço | ×1,20 | ×1,05 | 50% `POOR` |

**Piloto** (`PILOT`). Cartas com o campo `pilot` (programas de evidência moderada ou fraca que dá para testar em pequena escala: telessaúde, mamografia móvel, saúde mental, tomógrafo, check-up, central de regulação, farmácia) oferecem "só um piloto", que exclui o programa completo no mesmo ano. Obras grandes, remédios e ações pontuais não têm piloto. O piloto:

- custa `0,2 × (imp + cus)` só neste ano, sem custeio depois, e usa 1 equipe (0 se a carta não pede equipe);
- rende `0,2 ×` o ganho de um ano de funcionamento (`gain/n`), espalhado pelo `profile`, com a realização sorteada da carta;
- revela, ao fechar o ano, quanto a carta rendeu de verdade;
- volta à mesa no ano seguinte, uma única vez, como "ampliar o piloto": a mesma carta, com a realização do piloto × `PILOT.scale` (0,9, o efeito de escala), sem novo sorteio. Se não for ampliado naquele ano, some.

O preço do piloto: o dinheiro do teste, um ano de atraso no programa (e no ganho) e 10% a menos de realização em escala. Vale mais quando a evidência é fraca e a implantação é cara; com a equipe de avaliação, que já mostra a estimativa, vale menos. No último ano não há piloto.

**Combinações** (`SINERGIAS`). Cada combinação tem `alvo` (cartas que rendem mais), `par` (cartas que as fazem render mais) e `bonus`. Em cada ano em que um programa do alvo funciona junto com algum programa do par (outro programa, também em funcionamento naquele ano, inclusive se começou no mesmo ano), o ganho daquele ano do alvo é multiplicado por `1 + bonus`; bônus de combinações diferentes se somam. Ações pontuais e pilotos não entram. O card mostra com quem combina e se o parceiro já funciona; o jornal anuncia a primeira vez que cada combinação rende.

**Encerrar.** Na lista de compromissos, cada programa em funcionamento desde um ano anterior tem a caixa "encerrar este ano", com o quanto ele rende por ano e o custo por ano ganho para a cidade. Encerrar vale já no ano: o custeio (municipal e federal) para, o espaço do ano cresce e o programa deixa de plantar ganho novo; o que já foi plantado continua aparecendo nos anos seguintes. Não custa apoio político, mas sai no jornal. Um programa de saneamento encerrado deixa de amortecer a epidemia.

### 3. Para pagar, o que deixa de ser feito? (`EXITS`)

A conta do ano (compromissos + ordem judicial + dilema + programas novos) é paga nesta ordem (`waterfall`):

1. a transferência federal, se houver, que não tira saúde na cidade;
2. a opção escolhida pelo jogador, até o teto dela (o "até R$ X mi/ano" do botão: o máximo que dá para cortar dali num ano);
3. a margem;
4. a rotina das unidades básicas, que paga o que sobrar.

Cada parte paga desloca `valor × 10⁶ / 40.000 × multiplicador` anos de vida saudável, repartidos pelo perfil de quem perde (`lossOf`):

| Parte | Aparece | Teto | Multiplicador | Quem perde (capital) | Quando | Apoio |
|---|---|---:|---:|---|---|---|
| Margem | sempre | a margem | 1,0 | `CITY.net`: 31/26/21/14/8 | no ano | — |
| Rotina das unidades básicas | 2027 | — | 1,1 | `CITY.srcAb`: 35/27/20/12/6 | 75% no ano, 25% no seguinte | 0 |
| Fila de cirurgias e exames | 2027 | R$ 200 mi | 0,85 | 27/25/22/16/10 | no ano | 1, +1 em ano de eleição, +1 se pagou algo no ano anterior |
| Cortar o que rende pouco | 2028 | R$ 50 mi | 0,2 | 18/19/20/21/22 | no ano | 1, +1 se pagou algo no ano anterior |
| Pedir ao prefeito | 2029 | R$ 150 mi | 0,45 | 33/26/20/13/8 | metade no ano, metade no seguinte | 2, +1 em ano de eleição; some na crise fiscal |

- **Outras cidades.** O perfil da rede é 25/22/20/18/15 na cidade média e 28/24/21/16/11 na envelhecida. A rotina usa o `srcAb` da cidade. Fila, prefeito e baixo valor seguem a inclinação da cidade: com t = (srcAb₁ − 20)/15, cada valor vira 20 + t·(o − 20).
- **Greve.** No ano da greve, a margem, a rotina e a fila recaem 40/30/15/10/5. Prefeito e baixo valor mantêm o próprio perfil.
- **Perdas adiadas.** A parte que vence no ano seguinte fica em `G.pendingLoss` e é cobrada quando o ano chega. A que passa do fim do mandato é descontada do Legado.
- **Apoio político.** Começa com 2 pontos (1 no modo de 5 anos), recupera 1 por ano a partir do ano 2, até 3. Só é gasto se a opção pagou alguma coisa. Os anos de eleição são 2028, 2032 e 2036. Uma opção sem apoio suficiente aparece desabilitada, com o motivo. A conferência de saúde soma ou tira 1 ponto, e a eleição depende do que sobra (ver [Política](#política-pacto-conferência-e-eleição)).
- **Padrão.** O ano abre com a última opção escolhida pelo jogador, se ainda estiver ao alcance; senão, com a rotina, e um aviso diz por quê.

Antes de fechar o ano, a prévia (`compareHtml`) mostra, para cada opção ao alcance, quantos anos de vida saudável a conta tira, quanto disso neste ano, quanto dos mais pobres e de onde sai cada parte.

### 4. Fechamento (`closeYear`)

Nesta ordem:

1. encerra os programas marcados;
2. calcula os compromissos do ano;
3. inicia os programas novos (uma ação pontual já agenda todo o ganho em `G.pending`) e depois os pilotos;
4. cada programa em funcionamento, inclusive os novos, planta o ganho de um ano em `G.pending`, com o bônus das combinações ativas;
5. ordem judicial: o ganho do medicamento é agendado pelo perfil e a segunda parcela vira compromisso do ano seguinte (R$ 62,5 mi para a cidade e R$ 62,5 mi para a União);
6. o ganho do ano é o que `G.pending` tem para este ano;
7. a conta do ano passa pela cascata; o que a União paga (custeio e transferência) entra em `G.exported`;
8. o apoio político é debitado; num ano de conferência, o compromisso assumido é conferido (+1 ou −1 de apoio);
9. somam-se às perdas a erosão da rotina, as perdas adiadas que vencem agora e o dano da epidemia;
10. o saldo do ano (ganhos − perdas) é somado em `G.cum`, e a saúde de cada grupo passa a ser $h_i + \text{cum}_i / P$;
11. no ano do prazo do pacto, a meta é conferida;
12. em ano de eleição, se o apoio está em zero, o prefeito perde.

- **Erosão** (`CITIES[*].erosion`): o que a rotina perde todo ano sem reforço, com programas ou sem. O reajuste da atenção básica reduz pela metade de forma permanente; negá-lo aumenta 30% por dois anos.
- **Epidemia de dengue**: o dano cai pela metade se um programa com a tag `vig` funciona desde um ano anterior.

### Política: pacto, conferência e eleição

**Pacto com o Ministério** (`PACTO`), oferecido só no ano 1, com "Assinar o pacto" ou "Não assinar" (padrão). Meta: reduzir a distância pobres–ricos em `alvo` dias por pessoa, em relação a 2027, até o fim do ano `ate` (4 dias até 2031 em 10 anos; 2 dias até 2029 em 5 anos). Conferida no fim desse ano: cumprida, R$ 150 mi de repasse no ano seguinte, que pagam primeiro a conta, como a transferência federal; descumprida, R$ 60 mi a menos na margem do ano seguinte (entra em `G.pens`). Não assinar não tem efeito.

**Conferência municipal de saúde** (`CONF`): nos anos 3 e 7 (no ano 3 em 5 anos). Cada região pede um compromisso para aquele ano, e o jogador assume um ou nenhum (padrão):

| Compromisso | Cumprido se |
|---|---|
| Periferia (mais pobres) | algum programa novo completo (não piloto) tem ganho que favorece os mais pobres (`lean > 10`, já com o complemento) |
| Bairros do meio | a fila de cirurgias e exames não pagou nada da conta do ano |
| Centro (mais ricos) | nenhum programa foi encerrado no ano |

Cumprido, +1 ponto de apoio (até 3); quebrado, −1 (até 0); sem compromisso, nada muda. O painel mostra, com a seleção do momento, se o compromisso está cumprido.

**Eleição** nos anos de eleição municipal (2028, 2032, 2036): no fim do ano, depois do débito e da conferência, se o apoio é 0, o prefeito perde. Antes do último ano, o novo governo encerra no ano seguinte (`closedAt = ano + 1`, `closedBy = 'prefeito'`) o programa em funcionamento com o maior custeio municipal do ano seguinte por ano de vida ganho (`q·f`), e um aviso abre o ano seguinte. Esse encerramento não conta como encerramento do jogador no resumo. No último ano, a eleição só aparece no jornal e no retrato final. No modo de 5 anos, com 1 ponto de apoio no começo, cortar da fila em 2027 e de novo em 2028 já leva à derrota.

### 5. Os três jurados

| Jurado | O que mede | Onde |
|---|---|---|
| **Contador** | soma simples dos QALYs realizados desde 2027 | `popStats().net` |
| **Ouvidora** | saldo ponderado por equidade com o ε da partida | `popStats().ew` |
| **Legado** | QALYs já plantados que ainda vão aparecer, menos as perdas adiadas que ainda vão vencer | `popStats().legacy` |

A cada ano, o Contador comenta o saldo do ano, e a Ouvidora, o saldo ponderado, explicado pela variação da distância entre os mais pobres e os mais ricos (em dias de vida saudável por pessoa).

## Fim de mandato (`renderFinal`)

**Notas de 0 a 10.** Cada nota é 10 × resultado ÷ régua, entre 0 e 10 (`GRADES`):

| Duração | Contador | Ouvidora | Legado |
|---|---:|---:|---:|
| 10 anos | 62.000 | 76.000 | 20.000 |
| 5 anos | 22.000 | 25.000 | 20.000 |

**Título.** O primeiro que se aplicar, nesta ordem. Δd é a variação da distância pobres–ricos em dias por pessoa (negativa = menos desigual); os limiares são 40.000 QALYs e 15 dias em 10 anos, ou 14.000 QALYs e 2,5 dias em 5 anos.

| Título | Condição |
|---|---|
| O Ausente | nenhum programa financiado por escolha |
| O Equilibrista | saldo ≥ limiar de QALYs, Δd ≤ −limiar de dias e saldo ponderado > 0 |
| O Contador-chefe | saldo ≥ limiar de QALYs |
| A Ouvidora | Δd ≤ −limiar de dias e saldo ponderado > 0 |
| O Afundador | saldo < 0 e Δd > 5 dias |
| O Plantador | Legado ≥ 80% da régua do Legado e saldo < limiar de QALYs |
| O Morno | nenhum dos anteriores |

A tela final mostra também a **herança** (programas que seguem funcionando e o custeio que deixam para o sucessor no primeiro ano dele, já reajustado) e o **custo exportado** (o que a União pagou das contas da cidade, convertido em anos de vida saudável a R$ 40 mil, que o placar da cidade não cobra).

**Jogar de novo com o mesmo código.** Recomeça a partida com a mesma configuração e guarda a anterior (`GHOST`, em `G.ghost`): o painel do ano mostra o que foi decidido no mesmo ano da partida anterior, o gráfico da distância traz a linha tracejada dela, e a tela final compara as duas, com as decisões de cada ano.

**Código da turma.** A tela final gera um código `CC1.` + JSON em base64 (nome, configuração, título, notas, placares, distância e as decisões de cada ano em forma curta: índice em `DECK`, `a` com complemento, `p` piloto, `j` ordem judicial, `x` carta extra; a opção que pagou; quantos encerrados). Em "Comparar a turma", na tela inicial, os códigos colados viram um gráfico Contador × Ouvidora, uma tabela e, para quem jogou a mesma partida, as decisões ano a ano lado a lado. Os códigos guardam índices de `DECK`: reordenar o baralho troca o nome das decisões em códigos antigos.

**Imagem.** "Baixar imagem" desenha num canvas (1200 × 630, com as cores do tema) o título, as notas, os dias por grupo e a distância.

## Dificuldade

| | Fácil | Normal | Difícil |
|---|---|---|---|
| Custo por ano ganho e selo do limiar | sim | sim | não |
| Faixa de realização da evidência | sim | sim | não |
| Detalhe "por grupo" | sim | sim | não |
| Estimativa da equipe de avaliação | desde o ano 1 | só se contratada | só se contratada |
| Dica de leitura em cada carta (`tip`) | sim | não | não |
| Dilemas | com números (`d`) | com números (`d`) | sem números (`n`) |
| Prévia do que deixa de ser feito | com números | com números | só quem perde |
| Custo por ano ganho dos programas em funcionamento | sim | sim | não |

## Como acrescentar conteúdo

Todos os dados ficam em constantes no topo da seção do jogo. Os comentários acima de cada constante descrevem os campos.

### Nova proposta

Acrescente um objeto a `DECK`:

```js
{nm:'Nome da proposta', src:'estudo ou fonte que inspirou os números', cost:120, gain:3000,
 sh:[30,25,20,15,10], tipo:'prevenção', ev:'moderada', profile:[.4,.3,.3],
 imp:30, cus:30, h:.3, hab:'com o financiamento federal da atenção primária',
 tags:['aps'], addon:'busca', story:'Uma frase concreta, de preferência com uma pessoa.'}
```

- `sh` deve somar 100: `tilt` e `tip` comparam pontos percentuais com limiares de ±10.
- `profile` deve somar 1. Com mais anos do que restam no mandato, a sobra vai para o Legado.
- Num programa, `imp + n·cus` deve ser igual a `cost` (n = `profile.length`). Sem `cus`, a carta é uma ação pontual. `h` e `hab` são opcionais; `hab` começa com "com", porque o card diz "a União paga 30% do custeio a partir de 2028, com …".
- `tipo` deve ser um dos quatro que têm ícone em `ICON`; outro valor funciona, mas a carta fica sem ícone. Com `'infraestrutura'`, o ganho recebe o bônus `CITY.infra`.
- `tags` e `addon` são opcionais. Use `'aps'` para a carta poder ser garantida na transferência federal e `'vig'` para amortecer a epidemia.
- `eq`: equipes que a implantação exige (0 para remédio, campanha, aplicativo). `pilot` (opcional): como seria o piloto, em poucas palavras ("em duas unidades básicas"); só em programas (com `cus`) que dá para testar em pequena escala. Para a carta entrar numa combinação, ponha o `nm` dela em `alvo` ou `par` de `SINERGIAS`.
- Se mudar o `nm` das cartas do tutorial, atualize as listas `want` em `dealYear` e os prefixos procurados em `coach`.

### Novo complemento

Acrescente uma chave em `ADDON` com `t`, `d`, `cost`, `gain`, `mix:[w, POOR|RICH]` e, se exigir gente, `eq`, e use essa chave no campo `addon` das cartas.

### Nova combinação

Acrescente a `SINERGIAS` um objeto `{nm, bonus, par:[nomes], alvo:[nomes], txt}`. `txt` completa a frase do jornal "... passa a render X% a mais, porque {txt}".

### Novo dilema

Acrescente a `DILEMMAS` um objeto `{id, nm, txt, opts:[…]}`. Cada opção precisa de `t`, `d` e `n`; os efeitos possíveis estão listados no comentário acima de `DILEMMAS` e aplicados em `applyDilemma`. Um `budget` negativo entra na conta do ano e desloca saúde; um `recurring` vira compromisso dos anos seguintes. O `id` `'avaliacao'` é reservado para o ano 2 do tutorial.

### Novo evento

Acrescente uma chave a `EVENTS` com `nm`, `good` e `txt`, mais os efeitos desejados (`marginF`, `fed`, `forced`, `extra`, `ensureTag`, `damage` + `mitigTag` + `mitigTxt`, `oc`, `eqMinus`). Um efeito novo precisa ser tratado em `dealYear` ou `closeYear`. Como as chaves de `EVENTS` são embaralhadas em `newGame`, acrescentar uma muda o calendário de todos os códigos de partida.

### Nova opção de corte

Acrescente uma chave a `EXITS` com os campos descritos no comentário acima da constante (`prod`, `oc` ou `cityOc`, `tilt`, `lag`, `cap`, `apoio`, `elec`, `rep`, `from`, `noCrise`, `spare`), os textos `hint`, `quem` e `who`, e a forma curta em `DA` ("da fila", "de outras pastas"). A ordem das chaves em `EXITS` é a ordem dos botões.

### Nova cidade

Acrescente a `CITIES` (`nm`, `h0`, `erosion`, `srcAb`, `net`, `infra`, `eq`, `desc`) e um botão `data-city` em `#cityPick`. O gráfico final ajusta o eixo sozinho se a saúde de partida ficar fora de 60–75 anos.

### Textos do jornal

O jornal de cada ano (`paperData`, `headline`) é montado com textos de várias listas:

| Onde | O quê |
|---|---|
| `JORNAL.manchete` | manchetes, por situação (aposta em evidência fraca, busca ativa, transporte gratuito, cada opção de corte, encerramento, ano sem programa novo) |
| `JORNAL.abertura`, `JORNAL.balanco` | primeira frase da matéria e o balanço do ano (positivo, negativo e a ressalva de que parte do ganho ainda vem) |
| `JORNAL.distancia` | a frase sobre a distância entre os bairros (caiu, subiu, ficou igual) |
| `EXITS[*].who`, `JORNAL.margem` | quem pagou a conta: uma história de quem sentiu o corte |
| `JORNAL.encerrado`, `JORNAL.calmo` | encerramento de programa; ano sem evento nem dilema |
| `EVENTS[*].jornal` | a repercussão de cada evento (na epidemia, com e sem saneamento; na pressão da indústria, com e sem o tratamento) |
| opções de `DILEMMAS`, campo `jornal` | o que aconteceu depois da escolha (na negociação da emenda, `{ok, no}`) |
| `CARTAS` | a carta do leitor, por situação: quem pagou a conta, para quem foi o programa novo, encerramento, aposta, ano sem programa, distância que caiu ou subiu |
| `BREVES` | as notas breves da coluna lateral, duas por ano |

Nos textos com marcador, `{p}` é o programa, `{c}` os programas encerrados, `{w}` a aposta, `{n}` e `{s}` os programas em funcionamento, `{y}` o ano, `{k}` e `{l}` quantos e quais programas novos, `{x}` o saldo do ano e `{d}` os dias por pessoa. Cada lista funciona como um baralho (`deal`): um texto só se repete quando a lista acaba. Para acrescentar um texto, basta pô-lo na lista. Ele não muda nenhuma partida, porque o jornal tem gerador próprio. A carta do leitor e as histórias podem sair mais de uma vez na mesma partida, então não devem dizer "pela primeira vez".

### Cenário novo no laboratório

Acrescente a `PRESETS` (`gain`, `shares`, `cost`, `oc`, `desc` e, opcionalmente, `limiar`, `cur`, `h0`, `src`) e um botão `data-preset` em `#controls .presets`.
