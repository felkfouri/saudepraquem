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

O mesmo gerador continua sendo usado durante a partida (realização da evidência, reembaralhamento do baralho, datas e notas do jornal, resultado da negociação da emenda). A quantidade de sorteios por ano não depende das escolhas, com uma exceção: escolher "Negociar o endereço" consome um sorteio a mais. Daí em diante, para quem negociou, a realização da evidência, as cartas depois que o baralho é refeito e o jornal deixam de coincidir com os de quem não negociou. O calendário de eventos e dilemas não muda. Encerrar programas, escolher o que deixa de ser feito e o apoio político não usam o gerador.

Qualquer mudança que acrescente, remova ou reordene chamadas a `G.r()` muda o que cada código produz. O mesmo vale para acrescentar cartas, dilemas ou eventos, que mudam o tamanho do que é embaralhado.

## O ciclo de um ano

```
dealYear()        abre o ano: evento, apoio, margem, dilema, cartas, realização sorteada e espaço para programas novos
   │
   ├─ dilema?  →  applyDilemma(k)   (antes do orçamento)
   │
   ├─ jogador marca cartas, complementos, programas a encerrar e o que deixa de ser feito
   │  (renderYear redesenha a cada ação)
   │
closeYear()       encerra, inicia, planta o ganho do ano, paga a conta, cobra a saúde deslocada, gera jornal e jurados
   │
nextYear()        próximo ano, ou renderFinal() no último
```

### 1. O dinheiro do ano (`dealYear`, `computeRoom`)

| Parcela | Valor | Constante |
|---|---|---|
| Margem do ano | R$ 150 mi; na crise fiscal, R$ 53 mi (× 0,35) | `MARGIN`, `CRISIS_F` |
| Transferência federal (evento) | R$ 200 mi, só naquele ano | `TRANSFER` |
| O máximo que dá para tirar do que deixa de ser feito, além da margem | R$ 100 mi | `EXTRA` |
| Compromissos | custeio municipal dos programas em funcionamento, contas de dilemas, segunda parcela da ordem judicial | `commitments` |
| Ordem judicial (evento) | R$ 125 mi neste ano | `JUD` |
| Dilema | o que a opção escolhida tira do ano (mutirão, equipe de avaliação, resposta à enchente) | `G.dilemmaSpend` |

**Espaço para programas novos** = transferência + margem + `EXTRA` − compromissos − ordem judicial − dilema, com mínimo zero. As cartas marcadas precisam caber nele: se passarem, "Fechar o ano" fica desabilitado até o jogador desmarcar algo ou encerrar um programa. Compromissos, ordem judicial e dilema são pagos sempre, mesmo que passem do limite (o painel avisa quando isso acontece), então nenhuma partida trava.

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
- a partir do ano seguinte, paga `cus` todo ano enquanto funcionar, como compromisso. A União paga a parte `h` desse custeio (o card diz como, em `hab`); essa parte não sai da cidade e vai para o custo exportado;
- cada ano de funcionamento planta `gain/n` anos de vida saudável (× complemento × realização, e × `CITY.infra` se for infraestrutura), espalhados pelo `profile`. Em n anos o programa entrega exatamente a promessa do card; depois, segue rendendo `gain/n` por ano.

Como `imp + n·cus = cost`, o custo por ano ganho e o selo do limiar (`cost ÷ gain`) não dependem de quem paga nem de quando.

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

**Encerrar.** Na lista de compromissos, cada programa em funcionamento desde um ano anterior tem a caixa "encerrar este ano", com o quanto ele rende por ano e o custo por ano ganho para a cidade. Encerrar vale já no ano: o custeio (municipal e federal) para, o espaço do ano cresce e o programa deixa de plantar ganho novo; o que já foi plantado continua aparecendo nos anos seguintes. Não custa apoio político, mas sai no jornal. Um programa de saneamento encerrado deixa de amortecer a epidemia.

### 3. Para pagar, o que deixa de ser feito? (`EXITS`)

A conta do ano (compromissos + ordem judicial + dilema + programas novos) é paga nesta ordem (`waterfall`):

1. a transferência federal, se houver, que não tira saúde na cidade;
2. a opção escolhida pelo jogador, até o teto dela;
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
- **Apoio político.** Começa com 2 pontos (1 no modo de 5 anos), recupera 1 por ano a partir do ano 2, até 3. Só é gasto se a opção pagou alguma coisa. Os anos de eleição são 2028, 2032 e 2036. Uma opção sem apoio suficiente aparece desabilitada, com o motivo.
- **Padrão.** O ano abre com a última opção escolhida pelo jogador, se ainda estiver ao alcance; senão, com a rotina, e um aviso diz por quê.

Antes de fechar o ano, a prévia (`compareHtml`) mostra, para cada opção ao alcance, quantos anos de vida saudável a conta tira, quanto disso neste ano, quanto dos mais pobres e de onde sai cada parte.

### 4. Fechamento (`closeYear`)

Nesta ordem:

1. encerra os programas marcados;
2. calcula os compromissos do ano;
3. inicia os programas novos (uma ação pontual já agenda todo o ganho em `G.pending`);
4. cada programa em funcionamento, inclusive os novos, planta o ganho de um ano em `G.pending`;
5. ordem judicial: o ganho do medicamento é agendado pelo perfil e a segunda parcela vira compromisso do ano seguinte (R$ 62,5 mi para a cidade e R$ 62,5 mi para a União);
6. o ganho do ano é o que `G.pending` tem para este ano;
7. a conta do ano passa pela cascata; o que a União paga (custeio e transferência) entra em `G.exported`;
8. o apoio político é debitado;
9. somam-se às perdas a erosão da rotina, as perdas adiadas que vencem agora e o dano da epidemia;
10. o saldo do ano (ganhos − perdas) é somado em `G.cum`, e a saúde de cada grupo passa a ser $h_i + \text{cum}_i / P$.

- **Erosão** (`CITIES[*].erosion`): o que a rotina perde todo ano sem reforço, com programas ou sem. O reajuste da atenção básica reduz pela metade de forma permanente; negá-lo aumenta 30% por dois anos.
- **Epidemia de dengue**: o dano cai pela metade se um programa com a tag `vig` funciona desde um ano anterior.

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
| 10 anos | 70.000 | 85.000 | 20.000 |
| 5 anos | 22.000 | 25.000 | 20.000 |

**Título.** O primeiro que se aplicar, nesta ordem. Δd é a variação da distância pobres–ricos em dias por pessoa (negativa = menos desigual); os limiares são 45.000 QALYs e 15 dias em 10 anos, ou 14.000 QALYs e 2,5 dias em 5 anos.

| Título | Condição |
|---|---|
| O Ausente | nenhum programa financiado por escolha |
| O Equilibrista | saldo ≥ limiar de QALYs, Δd ≤ −limiar de dias e saldo ponderado > 0 |
| O Contador-chefe | saldo ≥ limiar de QALYs |
| A Ouvidora | Δd ≤ −limiar de dias e saldo ponderado > 0 |
| O Afundador | saldo < 0 e Δd > 5 dias |
| O Plantador | Legado ≥ 80% da régua do Legado e saldo < limiar de QALYs |
| O Morno | nenhum dos anteriores |

A tela final mostra também a **herança** (programas que seguem funcionando e o custeio anual que deixam para o sucessor) e o **custo exportado** (o que a União pagou das contas da cidade, convertido em anos de vida saudável a R$ 40 mil, que o placar da cidade não cobra).

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
- Se mudar o `nm` das cartas do tutorial, atualize as listas `want` em `dealYear` e os prefixos procurados em `coach`.

### Novo complemento

Acrescente uma chave em `ADDON` com `t`, `d`, `cost`, `gain` e `mix:[w, POOR|RICH]`, e use essa chave no campo `addon` das cartas.

### Novo dilema

Acrescente a `DILEMMAS` um objeto `{id, nm, txt, opts:[…]}`. Cada opção precisa de `t`, `d` e `n`; os efeitos possíveis estão listados no comentário acima de `DILEMMAS` e aplicados em `applyDilemma`. Um `budget` negativo entra na conta do ano e desloca saúde; um `recurring` vira compromisso dos anos seguintes. O `id` `'avaliacao'` é reservado para o ano 2 do tutorial.

### Novo evento

Acrescente uma chave a `EVENTS` com `nm`, `good` e `txt`, mais os efeitos desejados (`marginF`, `fed`, `forced`, `extra`, `ensureTag`, `damage` + `mitigTag` + `mitigTxt`, `oc`). Um efeito novo precisa ser tratado em `dealYear` ou `closeYear`. Como as chaves de `EVENTS` são embaralhadas em `newGame`, acrescentar uma muda o calendário de todos os códigos de partida.

### Nova opção de corte

Acrescente uma chave a `EXITS` com os campos descritos no comentário acima da constante (`prod`, `oc` ou `cityOc`, `tilt`, `lag`, `cap`, `apoio`, `elec`, `rep`, `from`, `noCrise`, `spare`), os textos `hint`, `quem` e `who`, e a forma curta em `DA` ("da fila", "de outras pastas"). A ordem das chaves em `EXITS` é a ordem dos botões.

### Nova cidade

Acrescente a `CITIES` (`nm`, `h0`, `erosion`, `srcAb`, `net`, `infra`, `desc`) e um botão `data-city` em `#cityPick`. O gráfico final ajusta o eixo sozinho se a saúde de partida ficar fora de 60–75 anos.

### Cenário novo no laboratório

Acrescente a `PRESETS` (`gain`, `shares`, `cost`, `oc`, `desc` e, opcionalmente, `limiar`, `cur`, `h0`, `src`) e um botão `data-preset` em `#controls .presets`.
