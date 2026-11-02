---
name: Sale Advisor
description: Alertas de oferta de hardware que mostram o teste contra o histórico de preços.
colors:
  ink: "#0B1220"
  slate: "#485264"
  ground: "#F1F2F5"
  surface: "#FFFFFF"
  line: "#D5D9E0"
  hairline: "#E6E9EE"
  dash: "#A3AAB6"
  pebble: "#C9CED8"
  cobalt: "#2147F0"
  cobalt-deep: "#1A36B8"
  cobalt-mist: "#D5DDFE"
  cobalt-grid: "#4A69F4"
  cobalt-wash: "#EEF3FE"
  ink-raised: "#1E2838"
  ink-mist: "#B9C2D3"
  steel: "#8A96AB"
  steel-deep: "#6B7385"
  signal: "#FF6B2C"
  label-normal: "#DDE1E8"
  label-boa: "#9DB0FB"
  label-muito-boa: "#2147F0"
  label-excepcional: "#FF6B2C"
typography:
  display:
    fontFamily: "Barlow Condensed, Barlow, sans-serif"
    fontSize: "58px"
    fontWeight: 800
    lineHeight: 0.9
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Barlow Condensed, Barlow, sans-serif"
    fontSize: "42px"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.01em"
  price:
    fontFamily: "Barlow Condensed, Barlow, sans-serif"
    fontSize: "52px"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
  title:
    fontFamily: "Barlow Condensed, Barlow, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.05
  title-sm:
    fontFamily: "Barlow Condensed, Barlow, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.1
  section:
    fontFamily: "Barlow Condensed, Barlow, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.2
  tag:
    fontFamily: "Barlow Condensed, Barlow, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
  body-sm:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
  caption:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.35
  button:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1
  button-sm:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1
rounded:
  tag: "4px"
  chip: "6px"
  control: "8px"
  panel: "10px"
  sheet: "16px"
  pill: "16px"
spacing:
  tight: "6px"
  group: "10px"
  stack: "16px"
  gutter: "20px"
  gutter-wide: "24px"
  section: "28px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    height: "56px"
    padding: "0 20px 0 22px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.button-sm}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "0 16px"
  chip-selected:
    backgroundColor: "{colors.cobalt}"
    textColor: "{colors.surface}"
    typography: "{typography.tag}"
    rounded: "{rounded.chip}"
    height: "30px"
    padding: "0 10px"
  chip-soft:
    backgroundColor: "{colors.cobalt-wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    height: "30px"
    padding: "0 10px"
  tag-label-muito-boa:
    backgroundColor: "{colors.label-muito-boa}"
    textColor: "{colors.surface}"
    typography: "{typography.tag}"
    rounded: "{rounded.tag}"
    padding: "5px 8px"
  tag-label-boa:
    backgroundColor: "{colors.label-boa}"
    textColor: "{colors.ink}"
    typography: "{typography.tag}"
    rounded: "{rounded.tag}"
    padding: "5px 8px"
  tag-delta:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.ink}"
    typography: "{typography.tag}"
    rounded: "{rounded.tag}"
    padding: "5px 6px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
    padding: "16px"
  panel-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.panel}"
    padding: "16px 16px 16px 18px"
  input-search:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.slate}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: "52px"
    padding: "0 16px"
  segment-on:
    backgroundColor: "{colors.cobalt}"
    textColor: "{colors.surface}"
    height: "44px"
  segment-off:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    height: "44px"
  nav-indicator:
    backgroundColor: "{colors.cobalt}"
    rounded: "{rounded.control}"
    width: "56px"
    height: "32px"
  snackbar:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    height: "52px"
  sheet:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.sheet}"
---

<!-- Fonte da verdade: o canvas de design aprovado (https://claude.ai/artifact/JzYhnGbHRsNPLzQ6FDGyq2), etapa por etapa, em 2026-10-29. O código do app ainda usa o tema anterior (escuro com verde menta, em src/theme.ts) até a implementação; não use esse tema como referência. -->

# Design System: Sale Advisor

## Overview

**Creative North Star: "O Gráfico de Benchmark"**

Cada tela se lê como um gráfico de review de hardware: barras horizontais, eixo, anotação e veredito. A tese é que toda oferta passa por um teste antes de chegar ao usuário, e o design mostra esse teste em vez de anunciar desconto. A oferta de hoje aparece contra a mediana de 30 dias e a mínima de 90 dias, e o rótulo (normal, boa, muito boa, excepcional) é sempre a conclusão de uma comparação visível.

O mundo é claro, plano e preciso. Fundo cinza frio, painéis brancos com borda fina, tinta quase preta e um único acento forte, o cobalto, que marca o que é do usuário e o que está em teste. O laranja de sinal entra como a caneta do revisor: anota o gráfico (a barra de hoje, o "−11%") e marca o "excepcional". A personalidade vem da Barlow Condensed em tamanho cheio nos títulos, nos nomes de produto e nos preços, e de faixas inteiras em cobalto nos momentos-herói (boas-vindas, alertas, veredito do detalhe).

A densidade é de app de tarefa (modo Operate): listas escaneáveis, alvos de 48dp e padrões nativos do Android, com a marca nos detalhes, nunca à custa da leitura. O mundo recusa o card de oferta com selo de "% OFF" e o visual de promoção berrante, e substitui o tema escuro com verde menta da versão anterior.

**Key Characteristics:**

- Barras horizontais como linguagem: etapas, rótulos, descontos, canais e o próprio símbolo são barras.
- Um acento só (cobalto), com o laranja restrito a anotações e ao "excepcional".
- Títulos, produtos e números em Barlow Condensed 700–800; frases em Barlow.
- Superfícies planas com borda de 1px; sombra só no que flutua.
- Rampa de rótulos fixa em todo o sistema, do feed ao canal de notificação.

## Colors

Uma paleta de laboratório: neutros frios e precisos, um cobalto saturado como voz própria e um laranja de sinal usado com parcimônia.

### Primary

- **Cobalto de Teste** (#2147F0): seleção e posse. Linhas escolhidas, chips de produto, segmento ativo, indicador da navegação, switch ligado e as faixas cheias dos gráficos-herói. Também é a cor do rótulo "muito boa". No hover de links, escurece para **Cobalto Fundo** (#1A36B8).
- **Névoa Cobalto** (#D5DDFE): texto secundário sobre fundo cobalto. **Grade Cobalto** (#4A69F4): linhas de grade e divisórias dentro das faixas cobalto. **Lavagem Cobalto** (#EEF3FE): chips suaves de inclusão ("Incluídas").

### Secondary

- **Laranja de Sinal** (#FF6B2C): a anotação do revisor. A barra de hoje no gráfico, o chip de delta ("−11%"), o rótulo "excepcional", a etiqueta "Bloqueados no Android" e os marcadores da lista "Nunca". Sempre com texto em tinta.

### Neutral

- **Tinta** (#0B1220): texto principal, botão primário, painel "seguir tudo", aviso de desfazer, contorno de campos e do segmentado.
- **Ardósia** (#485264): texto secundário, metadados e cabeçalhos de seção.
- **Chão** (#F1F2F5): fundo de todas as telas.
- **Superfície** (#FFFFFF): painéis, listas, folhas e diálogos.
- **Linha** (#D5D9E0): borda de painéis e etapa futura do eixo. **Fio** (#E6E9EE): divisórias entre linhas de uma lista.
- **Tracejado** (#A3AAB6): borda tracejada de estados vazios e de modo demonstração. **Seixo** (#C9CED8): indicador inativo (ponto de status, alça da folha).
- **Sobre a tinta:** **Tinta Elevada** (#1E2838) no trilho do switch desligado, **Aço** (#8A96AB) no polegar e na borda desligados, e **Névoa Tinta** (#B9C2D3) no texto secundário.

### Rampa de rótulos

Normal (#DDE1E8), boa (#9DB0FB), muito boa (#2147F0) e excepcional (#FF6B2C), sempre nessa ordem e nesses tons, em barras de desconto, chips, réguas "Você recebe estas" e na prancha de canais do push.

### Named Rules

**A Regra do Cobalto É Seu.** O cobalto marca só o que o usuário escolheu ou o que está em teste. Ele não decora títulos, ícones soltos ou fundos sem significado.

**A Regra do Laranja Sinal.** O laranja aparece em no máximo uma anotação por bloco e nunca em botão, link ou texto corrido. Sempre com texto em tinta por cima.

**A Regra da Rampa Fixa.** Cada rótulo tem uma cor e só uma, em qualquer superfície. Não existe "verde de oferta boa".

## Typography

**Display Font:** Barlow Condensed (com Barlow e sans-serif)
**Body Font:** Barlow (com system-ui)

**Character:** A Barlow Condensed traz a voz de tabela de benchmark, estreita, pesada e numérica; a Barlow mantém as frases calmas e legíveis. Ambas da mesma família, então o contraste vem de largura e peso, não de estilo.

### Hierarchy

- **Display** (800, 58px, 0.9): o título da boas-vindas, uma vez por fluxo.
- **Headline** (800, 42px, 0.95): o título de cada tela ("Seguindo", "Ajustes", "Não mostrar"). O nome do produto no detalhe sobe para 46px.
- **Price** (800, 52px, 0.95, tabular): o preço no detalhe. Nas linhas do feed, o preço usa a mesma família em tamanho de título.
- **Title** (700, 24px, 1.05): nomes de subcategoria e de produto em cards. **Title-sm** (700, 20px, 1.1) nas linhas de lista e nas folhas.
- **Section** (600, 16px, Ardósia): cabeçalhos de seção ("Hardware · 2 subcategorias", "Não mostrar").
- **Tag** (700, 14px): chips de rótulo e de delta; o delta usa 800.
- **Body** (400, 15px, 1.45) e **Body-sm** (400, 14px, 1.4): frases de apoio, até cerca de 45 caracteres por linha no celular. **Caption** (13px) para metadados.
- **Button** (700, 17px) no botão primário; **Button-sm** (600, 15px) nos secundários.

### Named Rules

**A Regra do Condensado.** Números, nomes de produto, títulos e rótulos vão em Barlow Condensed; frases inteiras vão em Barlow. Uma frase em condensado ou um preço em Barlow está errado.

**A Regra dos Numerais Tabulares.** Todo preço, porcentagem e contagem usa numerais tabulares, para que colunas de preço alinhem.

## Layout

Android primeiro, desenhado a 390px de largura. As abas (Ofertas, Seguindo, Ajustes) começam com o símbolo e o nome do app, depois o título da tela, com margem lateral de 20px e blocos empilhados a cada 16px. As telas internas trocam o símbolo por uma barra de voltar de 48px e usam margem de 20–24px. A navegação inferior tem 80px e três itens iguais.

Os momentos-herói (gráfico da boas-vindas, prévia do alerta, veredito do detalhe) quebram a margem e ocupam a largura inteira numa faixa cobalto. Listas vivem dentro de um painel branco, com linhas de 56–68px separadas por fio. Ações primárias ficam na base da tela. O ritmo é apertado dentro de um grupo (6–10px) e generoso entre grupos (16–28px), sempre com mais espaço acima de um cabeçalho do que abaixo.

**A Regra dos 48dp.** Todo alvo de toque tem pelo menos 48dp, inclusive o × de remover e as setas de expandir.

## Elevation & Depth

O sistema é plano. A profundidade vem do contraste entre o Chão e a Superfície, da borda de 1px e dos blocos sólidos em tinta e cobalto. Sombra só aparece no que flutua sobre o conteúdo e precisa ser lido como camada separada.

### Shadow Vocabulary

- **Folha** (`box-shadow: 0 -12px 28px rgba(11, 18, 32, 0.25)`): folhas de baixo para cima (adicionar subcategoria, bloquear loja).
- **Aviso** (`box-shadow: 0 8px 20px rgba(11, 18, 32, 0.3)`): o aviso de desfazer.
- **Diálogo** (`box-shadow: 0 16px 40px rgba(11, 18, 32, 0.3)`): o diálogo de confirmação destrutiva.
- **Prévia sobre cobalto** (`box-shadow: 0 10px 24px rgba(8, 20, 90, 0.35), 0 2px 4px rgba(8, 20, 90, 0.25)`): a notificação de exemplo sobre a faixa cobalto.
- **Véu** (rgba(11, 18, 32, 0.5)): o fundo escurecido atrás de folhas e diálogos.

**A Regra do Plano Por Padrão.** Painéis, cards e listas não têm sombra. Sombra só em folha, aviso, diálogo e prévia de notificação.

## Shapes

Retângulos de cantos levemente suavizados, como barras de gráfico, nunca pílulas. A escala cresce com o tamanho do objeto: etiquetas com raio 4px, chips com 6px, botões, campos e controles com 8px, painéis com 10px e folhas e diálogos com 16px no topo. As barras de dados usam 2px. Contornos são de 1px em painéis e de 1,5–2px em tinta nos controles (campo de busca, segmentado, botão secundário). Bordas tracejadas de 1,5px marcam estados vazios.

**A Regra da Barra.** O símbolo do app é a forma-mãe: três barras alinhadas à esquerda (22, 15 e 9 de largura numa grade de 28), a mais curta em cobalto. No ícone do app, a mais curta é laranja; no ícone de notificação, as três são monocromáticas.

## Components

### Buttons

- **Shape:** retangular com cantos suaves (8px).
- **Primary:** fundo Tinta, texto branco em Barlow 700 17px, altura 56px, com seta à direita ("Começar", "Continuar", "Abrir na KaBuM!"). Um por tela, na base.
- **Outline:** contorno de 1,5px em Tinta, fundo transparente, 44–48px ("Adicionar subcategoria", "Mostrar", "Desbloquear").
- **Destrutivo:** texto em Tinta sublinhado com ícone de lixeira, sem cor de alerta ("Parar de seguir", "Apagar dados deste aparelho"). A confirmação, quando existe, é um diálogo com o botão final em Tinta sólida.
- **Sobre tinta:** fundo branco e texto em Tinta ("Abrir configurações do Android").

### Chips

- **Produto escolhido:** Cobalto com texto branco em Barlow Condensed 700 16px, 30px de altura, raio 6px, com × quando removível.
- **Inclusão:** Lavagem Cobalto com texto em Tinta, para listas que não se editam ali.
- **Rótulo e delta:** etiquetas de 4px de raio. O rótulo segue a rampa (muito boa em cobalto com texto branco; boa e normal com texto em tinta) e o delta é laranja com texto em tinta em 800.

### Cards / Containers

- **Corner Style:** 10px.
- **Background:** Superfície sobre o Chão, com borda de 1px em Linha.
- **Shadow Strategy:** nenhuma (ver Elevation & Depth).
- **Internal Padding:** 14–16px; rodapé de status separado por fio.
- **Painel em tinta:** o bloco de decisão "Seguir todo o hardware" e "Alertas de ofertas", com título condensado 23px, apoio em Névoa Tinta e switch à direita. Ligado, ganha borda de 2px em cobalto.

### Inputs / Fields

- **Busca rápida:** 52px, contorno de 2px em Tinta, raio 8px, lupa à esquerda e exemplo como placeholder ("Adicionar placa, ex.: RTX 5070 Ti"). Em foco, o campo sobe para o topo da tela por causa do teclado, e o trecho que casa com a busca aparece em cobalto na lista.
- **Escolha, nunca texto livre:** todo produto, loja e marca é escolhido de uma lista.
- **Desabilitado:** campo apagado com aviso em tinta acima ("Sem conexão com a lista de produtos").

### Navigation

- **Barra inferior:** 80px, fundo branco com borda superior em Linha, três itens (Ofertas, Seguindo, Ajustes) com ícone de traço 2px e rótulo em Barlow Condensed 13px. O item ativo ganha um indicador cobalto de 56×32px com ícone branco e rótulo em 700.
- **Telas internas:** seta de voltar num alvo de 48px, sem barra de título; o título grande vem logo abaixo.

### Segmented Control

Dois segmentos iguais dentro de um contorno de 1,5px em Tinta, 44px de altura e raio 8px. O segmento ativo é cobalto com texto branco e ícone de check; o inativo é branco. Usado para "Produtos específicos | Subcategoria inteira" e "Mais recentes | Maior desconto".

### Switch

Trilho de 52×32px. Ligado: trilho cobalto, polegar branco de 24px com check cobalto. Desligado sobre tinta: trilho Tinta Elevada com borda e polegar em Aço; desligado sobre branco: trilho Fio com borda e polegar em Aço Fundo (#6B7385).

### Stepper em eixo

O onboarding mostra as etapas como três barras nomeadas de 6px de altura: feitas em Tinta, a atual em Cobalto e as futuras em Linha, com o nome em Barlow Condensed 13px abaixo.

### Gráfico de veredito (assinatura)

Faixa cobalto de largura inteira com barras horizontais para mediana de 30 dias e mínima de 90 dias (#9DB0FB) e a de hoje em laranja, valores tabulares à direita, um colchete de anotação ("−11% vs. mediana") e o veredito abaixo de uma divisória em Grade Cobalto. **Movimento:** as barras crescem a partir do eixo (`scaleX` de 0 a 1, 900ms, `cubic-bezier(0.16, 1, 0.3, 1)`, em sequência, a de hoje por último); a anotação e o veredito sobem 6px e aparecem depois (500ms). Com movimento reduzido, tudo aparece pronto.

### Linha de oferta

Nome em condensado, metadados "rótulo · loja · há 8 min", barra de desconto na cor do rótulo, delta e preço à direita. Ofertas novas ganham um quadrado cobalto "Nova". A linha inteira leva ao detalhe.

### Folha, aviso e diálogo

- **Folha:** de baixo para cima, raio 16px no topo, alça Seixo, título condensado 30px e lista de opções de 60px.
- **Aviso de desfazer:** bloco Tinta de 52px a 16px das bordas, com "Desfazer" em #9DB0FB.
- **Diálogo:** só para ação destrutiva, centralizado, raio 16px.

### Notificação push

Desenhada pelo Android, em fonte e layout do sistema. O app define o ícone pequeno (o símbolo de barras monocromático), a cor de destaque (Cobalto em todos os rótulos), as ações "Abrir na loja" e "Ocultar" e um canal por rótulo.

## Do's and Don'ts

### Do:

- **Do** mostrar o teste: preço de hoje contra mediana de 30 dias e mínima de 90 dias, com o rótulo como conclusão.
- **Do** usar a rampa de rótulos (#DDE1E8, #9DB0FB, #2147F0, #FF6B2C) sempre na mesma ordem e com as mesmas cores.
- **Do** colocar texto secundário sobre cobalto em Névoa Cobalto (#D5DDFE) e sobre tinta em Névoa Tinta (#B9C2D3).
- **Do** manter o primário em Tinta (#0B1220), 56px, raio 8px, com seta, um por tela.
- **Do** usar Barlow Condensed com numerais tabulares para todo preço e porcentagem.
- **Do** dar a cada estado (carregando, vazio, sem conexão, expirada, bloqueado) um desenho próprio no mesmo sistema.

### Don't:

- **Don't** usar selo de "% OFF", estrela de desconto, degradê ou visual de promoção berrante.
- **Don't** voltar ao tema escuro com verde menta da versão anterior.
- **Don't** usar o laranja (#FF6B2C) em botões, links ou texto corrido, nem com texto branco por cima.
- **Don't** pôr sombra em painel, card ou linha de lista.
- **Don't** colocar sobretítulo (eyebrow) acima dos títulos.
- **Don't** criar campo para o usuário digitar preço, faixa de preço ou nível de alerta.
- **Don't** usar cinza para texto sobre cobalto ou sobre tinta.
