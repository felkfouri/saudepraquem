# Saúde para quem?

Guia interativo sobre **análise de custo-efetividade distributiva (DCEA)** para o público geral, com um laboratório, um teste de aversão à desigualdade e o jogo **Cobertor Curto** (dez anos na secretaria de saúde de uma cidade de 1 milhão de habitantes).

Produto técnico da disciplina de Análise Econômica em Saúde, programa de pós-graduação da Faculdade de Medicina da USP, 2026.

## O que tem no site

- **Guia em cinco partes**: a conta tradicional (QALY, ICER, limiar), o que ela não vê, o que a DCEA acrescenta, um laboratório interativo e o cenário brasileiro, mais glossário e referências.
- **Laboratório**: uma população fictícia em cinco grupos de renda. Você define quanto de saúde um programa gera, para quem, quanto custa e sobre quem recai o custo de oportunidade, e compara o veredito da conta tradicional com o da conta distributiva (equivalente igualmente distribuído de Atkinson, plano de impacto equidade-eficiência, curva do veredito por ε). Inclui quatro cenários ilustrativos e o caso real do rastreamento de câncer de intestino do NHS.
- **Qual é o seu ε?**: escolhas binárias entre programas que convertem as suas preferências em um parâmetro de aversão à desigualdade, que pode ser levado para o laboratório.
- **Cobertor Curto**: jogo de gestão com orçamento anual, propostas com custo, ganho, distribuição e força da evidência, complementos de "como fazer", eventos, dilemas e custeio de infraestrutura. Três jurados (Contador, Ouvidora, Legado), três cidades, três níveis de dificuldade, tutorial e códigos de partida reproduzíveis para comparar decisões em sala.

## Como rodar

É um único arquivo estático, sem build e sem dependências além das fontes do Google Fonts (sem elas, o navegador usa fontes do sistema).

- **Direto no navegador:** abra `index.html`.
- **Servidor local**, recomendado para testar o botão "Copiar resumo", que precisa de `https` ou `localhost`:

  ```bash
  python3 -m http.server 8000
  ```

  e acesse <http://localhost:8000>.
- **GitHub Pages:** Settings → Pages → branch `main`, pasta `/`.

`index.html#jogo` abre direto o jogo.

## Como o código está organizado

```
index.html      guia + laboratório + teste + jogo (HTML, CSS e JS em um arquivo)
docs/modelo.md  as fórmulas: custo de oportunidade, EDE de Atkinson, saldo ponderado, conversão do teste em ε
docs/jogo.md    regras do jogo, campos dos dados e como acrescentar propostas, dilemas, eventos e cidades
README.md
```

Dentro de `index.html`:

| Parte | O que contém |
|---|---|
| `<style>` | variáveis de cor (tema claro e escuro), layout do guia, laboratório, teste e jogo |
| `<div id="guia">` | as cinco partes do texto, os painéis do laboratório e do teste, glossário e referências |
| `<div id="jogo">` | tela inicial ("Antes de assumir") e mesa de jogo (`#gameLeft`, `#gameRight`) |
| `<script>` | uma função autoexecutável, em cinco seções comentadas: núcleo da DCEA, laboratório, teste, rotas e jogo |

Alguns comportamentos gerais:

- **Rotas.** O hash `#jogo` mostra o jogo e esconde o guia; qualquer outro hash mostra o guia (`route()`).
- **Tema.** O tema escuro segue o sistema operacional. Para forçar um tema, use `<html data-theme="dark">` ou `data-theme="light"`. Todas as cores vêm das variáveis CSS do topo do arquivo.
- **Renderização.** Gráficos são SVG montados como texto. O laboratório redesenha tudo a cada mudança nos controles (cerca de 1 ms). No jogo, o painel esquerdo é redesenhado a cada ação, e os cliques são tratados por delegação de eventos no próprio painel.
- **Dados.** Propostas, complementos, dilemas, eventos, cidades e cenários do laboratório são constantes no início de cada seção do script. Os comentários acima de cada uma descrevem os campos; [`docs/jogo.md`](docs/jogo.md) explica como acrescentar itens.

## Como verificar uma mudança

Não há testes automatizados. Antes de publicar:

1. Abra a página com o console do navegador aberto e confira que não há erros.
2. **Laboratório:** clique nos cinco cenários e mova o ε de 0 a 20. Os valores do cenário "Rastreamento por carta" estão calculados à mão em [`docs/modelo.md`](docs/modelo.md#7-exemplo-rastreamento-por-carta) (saldo +3.000, ICER R$ 25.000, saldo ponderado +1.717 com ε = 11).
3. **Teste:** responda até o fim pelos dois lados e use o resultado no laboratório.
4. **Jogo:** jogue uma partida com um código fixo antes e depois da mudança. Com as mesmas escolhas, o resumo final deve ser idêntico, a menos que a mudança mexa de propósito nos sorteios ou nos dados (ver [semente e reprodutibilidade](docs/jogo.md#semente-e-reprodutibilidade)).
5. Repita com o tema escuro e numa tela estreita (celular).

## Referências principais

- Asaria M, Griffin S, Cookson R. Distributional cost-effectiveness analysis: a tutorial. *Med Decis Making*. 2016.
- Asaria M et al. Distributional cost-effectiveness analysis of health care programmes: NHS bowel cancer screening. *Health Econ*. 2015.
- Cookson R et al. (orgs.) *Distributional Cost-Effectiveness Analysis*. Oxford University Press, 2020.
- Robson M et al. Eliciting the level of health inequality aversion in England. *Health Econ*. 2017.
- CONITEC. O uso de limiares de custo-efetividade nas decisões em saúde. 2022.

A lista completa, incluindo as fontes de cada proposta do jogo, está no fim do próprio site.

## Licença

Conteúdo e código: CC BY 4.0. Os números do laboratório e do jogo são ilustrativos e não representam avaliações reais de tecnologias.
