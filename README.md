# Saúde para quem?

Guia interativo sobre **análise de custo-efetividade distributiva (DCEA)** para o público geral, com um simulador e o jogo **Cobertor Curto** (dez anos na secretaria de saúde de uma cidade de 1 milhão de habitantes).

Produto técnico da disciplina de Análise Econômica em Saúde, programa de pós-graduação da Faculdade de Medicina da USP, 2026.

## O que tem no site

- **Guia** em cinco partes: a conta tradicional (QALY, ICER, limiar), o que ela não vê, o que a DCEA acrescenta, laboratório interativo (índice de Atkinson, plano de impacto equidade-eficiência, caso real do NHS), e o cenário brasileiro.
- **Qual é o seu ε?** — um teste de escolhas binárias que converte suas preferências em um parâmetro de aversão à desigualdade.
- **Cobertor Curto** — jogo de gestão: orçamento anual, propostas com custo, ganho, distribuição e força da evidência; eventos, dilemas, custeio de infraestrutura; três jurados (Contador, Ouvidora, Legado); três cidades; tutorial e dificuldades.

## Como rodar

É um único arquivo estático. Abra `index.html` no navegador ou publique com GitHub Pages (Settings → Pages → branch `main`, pasta `/`).

Não há dependências além das fontes do Google Fonts. Todo o cálculo (equivalente igualmente distribuído de Atkinson, custo de oportunidade, plano de impacto) roda no navegador.

## Estrutura

```
index.html   guia + laboratório + jogo (HTML, CSS e JS em um arquivo)
README.md
```

## Referências principais

- Asaria M, Griffin S, Cookson R. Distributional cost-effectiveness analysis: a tutorial. *Med Decis Making*. 2016.
- Asaria M et al. Distributional cost-effectiveness analysis of health care programmes: NHS bowel cancer screening. *Health Econ*. 2015.
- Cookson R et al. (orgs.) *Distributional Cost-Effectiveness Analysis*. Oxford University Press, 2020.
- Robson M et al. Eliciting the level of health inequality aversion in England. *Health Econ*. 2017.
- CONITEC. O uso de limiares de custo-efetividade nas decisões em saúde. 2022.

A lista completa, incluindo as fontes de cada card do jogo, está no fim do próprio site.

## Licença

Conteúdo e código: CC BY 4.0. Os números do laboratório e do jogo são ilustrativos.
