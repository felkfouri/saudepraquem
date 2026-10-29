# O modelo por trás do site

Este documento descreve, fórmula por fórmula, o que o laboratório, o teste "Qual é o seu ε?" e o jogo calculam. Tudo roda no navegador, dentro de `index.html`; os nomes entre crases são as funções e constantes do script.

## Notação e unidades

| Símbolo | Significado | No código |
|---|---|---|
| $i = 1..5$ | grupo socioeconômico (quintil), dos 20% mais pobres ($i=1$) aos 20% mais ricos ($i=5$) | posições 0 a 4 dos vetores |
| $P$ | pessoas por grupo: 200 mil | `POP` |
| $h_i$ | saúde de partida do grupo: expectativa de vida ajustada pela qualidade (QALE), em anos por pessoa | `H0BR`, `H0NHS`, `CITIES[*].h0` |
| $g_i$, $\ell_i$ | QALYs ganhos com o programa e perdidos pelo custo de oportunidade, somados no grupo inteiro | `gainQ`, `lossQ` |
| $C$ | custo líquido, em R$ milhões | `state.cost` |
| $k$ | limiar de custo-efetividade, em R$ por QALY | `state.limiar`, `GL` |
| $\varepsilon$ | aversão à desigualdade | `state.eps`, `cfg.eps` |

Os ganhos e as perdas são sempre QALYs absolutos do grupo. Para virar saúde por pessoa, divide-se por $P$; para virar dias por pessoa, multiplica-se ainda por 365.

## 1. Do custo à saúde deslocada

O dinheiro gasto no programa sai de outros serviços. O limiar diz quanto esses serviços gastam, em média, para produzir um QALY. A saúde deslocada é então

$$D = \frac{C \times 10^6}{k}$$

e ela se reparte entre os grupos segundo um perfil $o_i$ (em %, somando 100):

$$\ell_i = D \cdot \frac{o_i}{100}$$

No laboratório, os perfis estão em `OC`: `igual` (20/20/20/20/20), `pobres` (30/25/20/15/10) e `ricos` (10/15/20/25/30).

No jogo, a conta do ano é paga por partes (a margem do ano, a opção de corte escolhida e a rotina das unidades básicas), e cada fonte $p$ tem um multiplicador $m_p$: quantos QALYs ela deixa de produzir por R$ $k$. A margem vale 1; a rotina das unidades básicas, 1,1; a fila de cirurgias e exames, 0,85; outras pastas da prefeitura, 0,45; o corte do que rende pouco, 0,2. Cada parte tem também o próprio perfil de quem perde e pode vencer em parte no ano seguinte:

$$D = \sum_p \frac{C_p \times 10^6}{k}\, m_p \qquad\qquad \ell_i = \sum_p \frac{C_p \times 10^6}{k}\, m_p \cdot \frac{o_{p,i}}{100}$$

Os valores e a ordem em que as fontes pagam estão em [`jogo.md`](jogo.md#3-para-pagar-o-que-deixa-de-ser-feito-exits).

O ganho do programa se reparte pelas participações $s_i$ escolhidas nos controles, normalizadas para somar 1:

$$g_i = G \cdot \frac{s_i}{\sum_j s_j}$$

## 2. A conta tradicional

$$\text{saldo} = \sum_i (g_i - \ell_i) = G - D \qquad\qquad \text{ICER} = \frac{C \times 10^6}{G}$$

Como os perfis de custo de oportunidade somam 100%, $\text{saldo} \ge 0$ equivale a $\text{ICER} \le k$. Por isso o laboratório mostra os dois selos sempre de acordo.

## 3. A conta distributiva

A saúde de cada grupo depois da decisão é

$$h'_i = h_i + \frac{g_i - \ell_i}{P}$$

O **equivalente igualmente distribuído** (EDE) de Atkinson resume uma distribuição em um único nível de saúde: aquele que, se todos tivessem, a sociedade acharia tão bom quanto a distribuição real. Com média $\bar h$:

$$\text{EDE}_\varepsilon(h) = \bar h \left[\frac{1}{5}\sum_i \left(\frac{h_i}{\bar h}\right)^{1-\varepsilon}\right]^{\frac{1}{1-\varepsilon}} \qquad (\varepsilon \ne 1)$$

$$\text{EDE}_1(h) = \exp\left(\frac{1}{5}\sum_i \ln h_i\right) \qquad \text{(média geométrica)}$$

Implementação: `ede(h, eps)`. Com $\varepsilon = 0$, o EDE é a média; quanto maior $\varepsilon$, mais o EDE é puxado para o grupo com menos saúde.

O **saldo ponderado por equidade**, o número do tile "Conta distributiva" e da Ouvidora no jogo, é a variação do EDE vezes a população:

$$\text{saldo ponderado} = \left[\text{EDE}_\varepsilon(h') - \text{EDE}_\varepsilon(h)\right] \times 5P$$

Com $\varepsilon = 0$ ele coincide com o saldo simples. A decisão é "aprovada com ε" quando ele é maior ou igual a zero.

O **índice de Atkinson** é a fração da saúde média que a sociedade aceitaria perder para eliminar a desigualdade:

$$A_\varepsilon = 1 - \frac{\text{EDE}_\varepsilon}{\bar h}$$

Tudo isso está em `evaluate(h0, gainQ, lossQ, eps)`, usada pelo laboratório e pela planilha do jogo. O jogo usa diretamente `ede` em `closeYear` e `popStats`.

### Quanto vale um QALY para cada grupo

O peso marginal de um QALY é proporcional a $h_i^{-\varepsilon}$. Para os grupos extremos do cenário brasileiro ilustrativo (62 e 72,5 anos), com $\varepsilon = 11$:

$$\left(\frac{72{,}5}{62}\right)^{11} \approx 5{,}6$$

Ou seja, um QALY para os 20% mais pobres vale cerca de cinco vezes um QALY para os 20% mais ricos. É a frase que aparece abaixo do controle de ε.

## 4. Plano de impacto equidade-eficiência

`drawPlane` põe o saldo simples no eixo horizontal e, no vertical, a diferença entre o saldo dos mais pobres e o dos mais ricos:

$$\text{gap} = (g_1 - \ell_1) - (g_5 - \ell_5)$$

Positivo significa que a decisão aproxima os extremos. É uma medida simples e legível, e não depende de ε. O veredito distributivo, que depende de ε, vem do EDE.

## 5. Onde o veredito muda

`drawEps` recalcula o saldo ponderado para $\varepsilon$ de 0 a 20, de 0,25 em 0,25, usando a mesma distribuição final $h'$ (que não depende de ε). O primeiro ponto em que o sinal troca é marcado como "veredito muda em ε ≈ …".

## 6. Teste "Qual é o seu ε?"

A pessoa escolhe entre $X = 1.000$ QALYs para os mais ricos e $Y$ QALYs para os mais pobres. $Y$ desce pela escada `LADDER` (1.000, 800, 600, 450, 300, 200, 120, 60) até a pessoa trocar de lado.

No ponto de indiferença, os ganhos ponderados se igualam: $X \cdot h_5^{-\varepsilon} = Y \cdot h_1^{-\varepsilon}$. Daí

$$\varepsilon = \frac{\ln(X/Y)}{\ln(h_5/h_1)}$$

com $h$ de `H0BR` (62 e 72,5). Para $Y$ usa-se a média geométrica entre o último valor aceito e o primeiro recusado.

| Respostas | ε |
|---|---|
| Escolhe os mais ricos já na primeira pergunta | 0 |
| Aceita 800, recusa 600 | ≈ 2,4 |
| Escolhe os mais pobres até o fim (60 contra 1.000) | ≥ 18,0 |

O botão "Usar este ε no laboratório" arredonda para o 0,5 mais próximo, com teto de 20.

## 7. Exemplo: "Rastreamento por carta"

Ganho de 8.000 QALYs com participações 12/16/20/24/28%, custo de R$ 200 milhões, limiar de R$ 40 mil, custo de oportunidade igual para todos.

| Grupo | Ganho | Perda | Saldo | Dias por pessoa |
|---|---:|---:|---:|---:|
| Mais pobres | 960 | 1.000 | −40 | −0,07 |
| Pobres | 1.280 | 1.000 | +280 | +0,51 |
| Do meio | 1.600 | 1.000 | +600 | +1,09 |
| Ricos | 1.920 | 1.000 | +920 | +1,68 |
| Mais ricos | 2.240 | 1.000 | +1.240 | +2,26 |
| **Total** | **8.000** | **5.000** | **+3.000** | |

ICER: R$ 25.000 por QALY, abaixo do limiar. A distância entre os extremos cresce (gap = −1.280).

| ε | Saldo ponderado | Atkinson antes → depois |
|---:|---:|---|
| 0 | +3.000 | 0 → 0 |
| 1 | +2.882 | 0,00145 → 0,00145 |
| 5 | +2.405 | 0,00737 → 0,00737 |
| 11 | +1.717 | 0,01625 → 0,01627 |
| 20 | +895 | 0,02853 → 0,02856 |

O programa continua aprovado em toda a faixa, mas cada vez com menos folga: o ganho concentrado no topo vale menos à medida que a desigualdade pesa mais. O caso real do NHS (`PRESETS.nhs`) mostra o mesmo padrão com dados publicados.

## 8. Cenários prontos do laboratório

| Chave | Ganho (QALYs) | Participação (pobres → ricos) | Custo | Custo de oportunidade | Observação |
|---|---:|---|---:|---|---|
| `rastreio` | 8.000 | 12/16/20/24/28 | R$ 200 mi | igual | ganho concentrado no topo |
| `vacina` | 12.000 | 32/26/20/13/9 | R$ 150 mi | mais sobre os pobres | barata e pró-pobre |
| `droga` | 6.000 | 10/14/20/26/30 | R$ 600 mi | mais sobre os pobres | reprovada nas duas contas |
| `aps` | 9.000 | 45/27/15/9/4 | R$ 400 mi | mais sobre os pobres | saldo −1.000, mas aprovada pela conta distributiva a partir de ε ≈ 5,8 |
| `nhs` | 44.000 | 35/42/48/55/61 | £ 72 mi | igual | limiar de £ 20 mil e QALE do artigo de Asaria et al. (2015) |

## 9. Simplificações assumidas

- O saldo de cada grupo é somado direto à QALE de partida ($h + \text{saldo}/P$), como se fosse um ganho permanente de expectativa de vida saudável. Não há desconto no tempo nem horizonte de vida.
- O custo de oportunidade é linear: cada R$ $k$ desloca exatamente um QALY, qualquer que seja o tamanho do gasto. No jogo, os multiplicadores de cada fonte e os perfis de quem perde são hipóteses ilustrativas: que cortar a atenção básica tire mais saúde por real do que cortar procedimentos de baixo valor segue a literatura de custo de oportunidade, mas os números não foram estimados.
- No jogo, o que a União paga (parte do custeio dos programas, transferência federal, metade da segunda parcela da ordem judicial) não desloca saúde na cidade. Esse dinheiro sai de outro lugar do SUS; o jogo mostra esse custo exportado no fim, sem cobrá-lo no placar.
- Os grupos têm o mesmo tamanho e a desigualdade é medida só entre quintis. Diferenças dentro de cada quintil (raça/cor, região) ficam invisíveis.
- Fora o caso do NHS, todos os números (QALE de partida, ganhos, custos, distribuições) são ilustrativos.
