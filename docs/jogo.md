# Cobertor Curto: regras e dados do jogo

Como o jogo funciona por dentro e como acrescentar conteúdo. As fórmulas de saúde (EDE, saldo ponderado) estão em [`modelo.md`](modelo.md). Todo o código fica na seção "Jogo" do script de `index.html`.

## Configuração da partida

Definida na tela "Antes de assumir" e guardada em `cfg`:

| Opção | Valores | Efeito |
|---|---|---|
| Duração | 10 anos (padrão) ou 5 | 4 eventos e 4 dilemas em 10 anos; 2 e 2 em 5 anos. Também muda a régua das notas finais. |
| Dificuldade | fácil, normal, difícil | ver [Dificuldade](#dificuldade) |
| Cidade | capital desigual, cidade média, cidade envelhecida | saúde de partida, erosão da rotina e quem perde quando o dinheiro sai da atenção básica (`CITIES`) |
| ε da Ouvidora | 0 a 20 (padrão 11) | aversão à desigualdade usada no saldo ponderado |
| Tutorial | ligado (padrão) | anos 1 e 2 com cartas fixas, dilema da equipe de avaliação no ano 2 e dicas passo a passo (`coach`) |
| Mostrar a conta | desligado (padrão) | abre a planilha da DCEA ao fechar cada ano (`mathHtml`): ganho, custo de oportunidade, erosão e, no ano da epidemia, o dano dela, por grupo |
| Código da partida | 1 a 9999 | semente do sorteio |

### Semente e reprodutibilidade

`rng(seed)` é um gerador mulberry32. A partida usa `rng(código × 7919 + duração)`, e `newGame` sorteia logo no início o calendário de eventos e dilemas e a ordem do baralho. Duas pessoas com o mesmo código, a mesma duração e a mesma escolha de tutorial recebem os mesmos eventos, dilemas e propostas, e as mesmas surpresas ao longo de toda a partida, quaisquer que sejam as escolhas.

Isso funciona porque o gerador da partida (`G.r`) é chamado o mesmo número de vezes a cada ano, independentemente das escolhas: realização da evidência de todas as cartas da mesa, reembaralhamento do baralho, data e notas do jornal. O único sorteio que depende de uma escolha, o resultado de "Negociar o endereço", usa um gerador à parte (`G.rNeg`, semeado a partir do mesmo código). Assim, quem negocia não desloca os sorteios seguintes, e o desfecho da negociação também é o mesmo para todos com o mesmo código.

Ao mexer no código, mantenha essa regra: um sorteio que só acontece por causa de uma escolha deve usar um gerador próprio, nunca `G.r`.

Qualquer mudança que acrescente, remova ou reordene chamadas a `G.r()` muda o que cada código produz. O mesmo vale para acrescentar cartas, dilemas ou eventos, que mudam o tamanho do que é embaralhado.

## O ciclo de um ano

```
dealYear()        abre o ano: evento, orçamento, dilema, cartas e realização sorteada
   │
   ├─ dilema?  →  applyDilemma(k)   (antes do orçamento)
   │
   ├─ jogador marca cartas, complementos e a fonte do dinheiro   (renderYear redesenha a cada ação)
   │
closeYear()       cobra custos, credita ganhos, aplica penalidades, gera jornal e jurados
   │
nextYear()        próximo ano, ou renderFinal() no último
```

### 1. Orçamento (`dealYear`)

Partindo de R$ 600 milhões (`BASE_BUDGET`):

1. o evento do ano pode transformá-lo (crise fiscal: ×0,65; transferência federal: +300);
2. penalidades do ano anterior são descontadas, com piso de R$ 150 mi;
3. custeios recorrentes (infraestrutura, insumos, reajuste, UPA) são descontados, com piso de R$ 100 mi;
4. o dilema, se houver, pode somar ou tirar dinheiro na hora (piso de R$ 50 mi). O que ele tira conta como gasto do ano (`G.dilSpent`) e desloca saúde no fechamento, como o gasto em propostas.

Na transferência federal, R$ 300 mi do orçamento são carimbados (`earmark`): só pagam cartas com a tag `aps`. O gasto nas demais cartas (e na carta judicializada) precisa caber no restante. O que sobra da parte carimbada volta para o ministério.

Dinheiro não gasto volta para a rotina sem perda, mas gastar menos da metade do orçamento dois anos seguidos faz a prefeitura cortar R$ 120 mi no ano seguinte.

### 2. As cartas

Saem quatro cartas do baralho (`DECK`). O evento "Pressão da indústria" acrescenta uma quinta e a "Judicialização" impõe uma carta paga obrigatoriamente. Quando restam menos de cinco cartas, o baralho é refeito com todas as propostas, menos as que estiveram na mesa no ano anterior. As que já foram financiadas voltam como **segunda rodada** (`rep`), com ganho prometido de 60% do original (`REPEAT`): o público mais fácil de alcançar já foi atendido.

Para cada carta, sorteia-se já na abertura do ano a fração do ganho prometido que vai de fato aparecer, uniforme na faixa da força da evidência (`EVSPREAD`):

| Evidência | Faixa |
|---|---|
| forte | 90% a 110% |
| moderada | 70% a 120% |
| fraca | 30% a 130% |

Com a equipe de avaliação contratada (ou no modo fácil), as cartas de evidência moderada ou fraca mostram uma faixa de 25 pontos percentuais que contém esse valor (`evalRange`), dentro da faixa da evidência. A posição da faixa é derivada do próprio valor sorteado, sem novo sorteio.

**Complementos** (`ADDON`): ao marcar uma carta que tem o campo `addon`, aparece uma escolha extra sobre como fazer. O complemento multiplica custo e ganho e mistura a distribuição original com um perfil de referência (`POOR` ou `RICH`):

$$s'_i = (1-w)\cdot 100\cdot\frac{s_i}{\sum_j s_j} + w \cdot \text{ref}_i$$

| Chave | Rótulo | Custo | Ganho | Mistura |
|---|---|---:|---:|---|
| `busca` | com busca ativa | ×1,25 | ×1,10 | 50% `POOR` |
| `periferia` | instalar na periferia | ×1,15 | ×1,00 | 50% `POOR` |
| `criterio` | fila por critério clínico | ×1,00 | ×1,00 | 30% `POOR` |
| `particular` | estender à rede particular conveniada | ×1,10 | ×1,15 | 50% `RICH` |
| `gratuito` | com transporte gratuito até o serviço | ×1,20 | ×1,05 | 50% `POOR` |

### 3. De onde sai o dinheiro (`SRC`)

| Fonte | Quem perde a saúde deslocada | Efeito colateral |
|---|---|---|
| Rotina da atenção básica (padrão) | perfil `srcAb` da cidade, pesado sobre os mais pobres | nenhum |
| Hospitais e exames | 20% para cada grupo | desloca 20% mais saúde por real (`HOSP_F`): a espera agrava os casos |
| Outras pastas da prefeitura | 10/15/20/25/30, mais sobre os ricos | R$ 120 mi a menos no ano seguinte |

No ano da greve, o custo de oportunidade recai 40/30/15/10/5, qualquer que seja a fonte.

### 4. Fechamento (`closeYear`)

Para cada programa financiado:

- **Ganho no tempo.** O ganho efetivo (prometido × complemento × realização sorteada, e × `CITY.infra` se for infraestrutura) é espalhado pelos anos seguintes segundo o `profile` da carta e guardado em `G.pending`. Só a parcela do ano corrente entra no saldo agora.
- **Custeio.** Infraestrutura passa a cobrar 20% do custo (`MAINT`) todo ano, até o fim do mandato.

Depois, para o ano todo:

$$\text{perda}_i = \frac{(\text{gasto} + \text{gasto do dilema}) \times 10^6}{40\,000}\cdot f_\text{fonte}\cdot\frac{o_i}{100} + \text{erosão}_i \cdot f_\text{erosão} \;(+\; \text{dano da epidemia}_i)$$

- $f_\text{fonte}$ é 1,2 para os hospitais e 1 nas demais fontes e no ano da greve.
- **Custeios recorrentes** (infraestrutura, insumos, UPA, reajuste) só reduzem o orçamento dos anos seguintes; não deslocam saúde por conta própria.
- **Erosão** (`CITIES[*].erosion`): o que a rotina perde todo ano sem reforço, com programas ou sem. O reajuste da atenção básica reduz pela metade de forma permanente; negá-lo aumenta 30% por dois anos.
- **Epidemia de dengue**: o dano cai pela metade se algum programa com a tag `vig` foi financiado em ano anterior.

O saldo do ano (ganhos realizados − perdas) é somado em `G.cum`, e a saúde de cada grupo passa a ser $h_i + \text{cum}_i / P$.

### 5. Os três jurados

| Jurado | O que mede | Onde |
|---|---|---|
| **Contador** | soma simples dos QALYs realizados desde 2027 | `popStats().net` |
| **Ouvidora** | saldo ponderado por equidade com o ε da partida | `popStats().ew` |
| **Legado** | QALYs já contratados que só aparecem depois do mandato | soma de `G.pending` |

A cada ano, o Contador comenta o saldo do ano e a Ouvidora, a variação da distância entre os mais pobres e os mais ricos (em dias de vida saudável por pessoa).

## Fim de mandato (`renderFinal`)

**Notas de 0 a 10.** A régua é `scale` = 30.000 QALYs em 10 anos ou 13.000 em 5 anos:

- Contador: $10 \cdot \text{saldo} / \text{scale}$
- Ouvidora: $10 \cdot \text{saldo ponderado} / \text{scale}$
- Legado: $10 \cdot \text{contratado} / (0{,}5 \cdot \text{scale})$

**Título.** O primeiro que se aplicar, nesta ordem. Δd é a variação da distância pobres–ricos em dias por pessoa (negativa = menos desigual); os limiares são 8.000 QALYs e 5 dias em 10 anos, ou 3.500 QALYs e 2,5 dias em 5 anos.

| Título | Condição |
|---|---|
| O Ausente | nenhum programa financiado por escolha |
| O Equilibrista | saldo ≥ limiar de QALYs e Δd ≤ −limiar de dias |
| O Contador-chefe | saldo ≥ limiar de QALYs |
| A Ouvidora | Δd ≤ −limiar de dias |
| O Afundador | saldo < 0 e Δd > 5 dias |
| O Plantador | contratado ≥ 40% da régua e saldo < limiar de QALYs |
| O Morno | nenhum dos anteriores |

## Dificuldade

| | Fácil | Normal | Difícil |
|---|---|---|---|
| Custo por ano ganho e selo do limiar | sim | sim | não |
| Faixa de realização da evidência | sim | sim | não |
| Detalhe "por grupo" | sim | sim | não |
| Estimativa da equipe de avaliação | desde o ano 1 | só se contratada | só se contratada |
| Dica de leitura em cada carta (`tip`) | sim | não | não |
| Dilemas | com números (`d`) | com números (`d`) | sem números (`n`) |

## Como acrescentar conteúdo

Todos os dados ficam em constantes no topo da seção do jogo. Os comentários acima de cada constante descrevem os campos.

### Nova proposta

Acrescente um objeto a `DECK`:

```js
{nm:'Nome da proposta', src:'estudo ou fonte que inspirou os números', cost:120, gain:3000,
 sh:[30,25,20,15,10], tipo:'prevenção', ev:'moderada', profile:[.4,.3,.3],
 tags:['aps'], addon:'busca', story:'Uma frase concreta, de preferência com uma pessoa.'}
```

- `sh` deve somar 100: `tilt` e `tip` comparam pontos percentuais com limiares de ±10.
- `profile` deve somar 1. Com mais anos do que restam no mandato, a sobra vai para o Legado.
- `tipo` deve ser um dos quatro que têm ícone em `ICON`; outro valor funciona, mas a carta fica sem ícone. Com `'infraestrutura'`, a proposta passa a ter custeio anual e o bônus `CITY.infra`.
- `tags` e `addon` são opcionais. Use `'aps'` para entrar na transferência federal e `'vig'` para amortecer a epidemia.
- Se mudar o `nm` das cartas do tutorial, atualize as listas `want` em `dealYear` e os prefixos procurados em `coach`.

### Novo complemento

Acrescente uma chave em `ADDON` com `t`, `d`, `cost`, `gain` e `mix:[w, POOR|RICH]`, e use essa chave no campo `addon` das cartas.

### Novo dilema

Acrescente a `DILEMMAS` um objeto `{id, nm, txt, opts:[…]}`. Cada opção precisa de `t`, `d` e `n`; os efeitos possíveis estão listados no comentário acima de `DILEMMAS` e aplicados em `applyDilemma`. O `id` `'avaliacao'` é reservado para o ano 2 do tutorial.

### Novo evento

Acrescente uma chave a `EVENTS` com `nm`, `good` e `txt`, mais os efeitos desejados (`budget`, `forced`, `extra`, `ensureTag`, `damage` + `mitigTag` + `mitigTxt`, `oc`). Um efeito novo precisa ser tratado em `dealYear` ou `closeYear`. Como as chaves de `EVENTS` são embaralhadas em `newGame`, acrescentar uma muda o calendário de todos os códigos de partida.

### Nova cidade

Acrescente a `CITIES` (`nm`, `h0`, `erosion`, `srcAb`, `infra`, `desc`) e um botão `data-city` em `#cityPick`. O gráfico final ajusta o eixo sozinho se a saúde de partida ficar fora de 60–75 anos.

### Cenário novo no laboratório

Acrescente a `PRESETS` (`gain`, `shares`, `cost`, `oc`, `desc` e, opcionalmente, `limiar`, `cur`, `h0`, `src`) e um botão `data-preset` em `#controls .presets`.
