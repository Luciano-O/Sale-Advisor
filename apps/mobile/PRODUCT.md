# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

Compradores de hardware no Brasil que já sabem o que querem montar ou trocar (por exemplo, uma placa de vídeo específica) e não querem passar o dia vigiando grupos de promoção do Telegram. Hoje o único usuário é o próprio autor, num Galaxy S25+ com Android 17. O design, porém, é pensado para a versão final, ou seja, para alguém que nunca viu o app e chega sem contexto.

O trabalho do usuário é declarar a intenção de compra e ser avisado só quando uma oferta realmente valer a pena.

## Product Purpose

O app monitora fontes de promoção (inicialmente grupos e canais do Telegram), consolida ofertas duplicadas, compara cada uma com o histórico de preços e notifica só as relevantes. O usuário não decide manualmente qual preço é bom: o histórico decide.

Sucesso significa que o usuário sai do onboarding com alertas ligados para o que quer comprar e confia no push o bastante para agir quando ele chega.

## Positioning

A classificação vem do histórico de preços do produto canônico (mínima de 7/30/90 dias, mediana de 30 dias, frequência, menções e confiabilidade da loja), e não de "% de desconto" anunciado pela loja. Os filtros finos ficam no aparelho: o servidor recebe apenas as subcategorias seguidas.

## Operating Context

- O push chega com o app fechado. O usuário abre, vê a oferta e decide em segundos se vai para a loja.
- Uma oferta consolidada pode ter sido mencionada várias vezes. A contagem de menções é um sinal interno de score e nunca aparece na interface.
- Rótulos de qualidade: `normal`, `boa`, `muito_boa`, `excepcional`. Há também um score de 0 a 100 e um resumo textual ("abaixo da mediana de 30 dias").
- Preço efetivo em BRL (à vista/pix quando identificado), com cupom e condição quando detectados.
- O app funciona offline com o último cache e mostra ofertas demonstrativas enquanto não houver API.

## Capabilities and Constraints

- Expo SDK 57 / React Native, Android-first, com Expo Router e SQLite local.
- Sem cadastro nem login por enquanto, mas a arquitetura deve permitir login opcional no futuro. Há um `installation_id` anônimo.
- Preferências locais: categorias seguidas, modelos desejados, marcas bloqueadas, lojas bloqueadas e ofertas ocultadas.
- O onboarding pergunta só o que o usuário quer acompanhar, em dois passos.
  - Primeiro, as subcategorias de hardware (placas de vídeo, processadores, SSDs etc.), com seleção múltipla, ou "seguir todo o hardware".
  - Depois, para cada subcategoria, o usuário escolhe entre "subcategoria inteira" e "produtos específicos". Os produtos são sempre escolhidos numa lista do catálogo por busca rápida, nunca por texto livre.
  - Seguir uma categoria ou subcategoria inteira significa receber todas as ofertas `boa`, `muito_boa` e `excepcional` dela, de qualquer produto.
  - O limiar de alerta é decidido pelo sistema e fica fixo em `boa`. O usuário não ajusta nível em nenhuma tela.
- O feed e o detalhe da oferta mostram a mediana de 30 dias, a mínima de 90 dias e a nota de 0 a 100. A API pública os expõe em `history` (`median30dInCents`, `lowest90dInCents`, `discountVsMedianPercent`).
- Uma oferta é "válida" enquanto foi divulgada nas últimas 72 h (`OFFER_TTL_HOURS`). Quem abre um push antigo precisa ver o estado "expirada".
- Hoje o catálogo (`/v1/catalog`) cobre só GPUs. As outras subcategorias precisam de catálogo próprio antes de ficarem ativas. **Decidido em 2026-10-29:** o "nível mínimo" sai do app, inclusive dos Ajustes. O código atual ainda guarda `minimumLabel` e o envia à API; ele passa a ser fixo em `boa`.
- Catálogo: categoria hardware, com GPUs como única categoria ativa no MVP. O layout precisa comportar outras categorias de hardware (CPU, SSD etc.) sem redesenho.
- Taxonomia de GPU controlada (NVIDIA RTX 30/40/50, AMD RX 6000/7000/9000), servida pelo catálogo da API, com fallback para texto livre offline.
- O usuário não deve ser notificado repetidamente pela mesma oferta consolidada.
- Alerta push, aprovado em 2026-10-29:
  - O cabeçalho é "Sale Advisor · loja · hora" e o título é "produto por preço" (por exemplo "RTX 5060 8GB por R$ 1.899,90").
  - A primeira frase do texto traz o veredito, "Muito boa: 11% abaixo da mediana de 30 dias.", porque é a única visível com a notificação fechada. Depois vêm a comparação com a mínima de 90 dias ("R$ 51 acima da mínima de 90 dias." ou "Menor preço dos últimos 90 dias.") e o cupom, quando houver.
  - Há um canal do Android por rótulo: "Ofertas boas" fica na gaveta sem som, "Ofertas muito boas" na gaveta com som, e "Ofertas excepcionais" aparece por cima da tela com som e vibração. Silenciar um canal é feito nas configurações do Android, não no app.
  - As ações são "Abrir na loja", que abre o app já indo para o link, e "Ocultar", que tira a oferta da lista sem abrir o app. Tocar abre o detalhe, ou o detalhe "expirada" depois de 72 h.
  - O ícone pequeno é o símbolo de três barras, monocromático, com cobalto como cor de destaque em todos os rótulos.
  - Não há emoji, caixa alta nem pressa ("corra", "últimas unidades"), e alertas atrasados mais de 24 h são descartados.
  - O resumo do push (`OfferNotificationSummary`) leva produto, loja, preço e rótulo, mais o desconto contra a mediana de 30 dias, a mediana, a mínima de 90 dias, o cupom e o link da loja (omitido se o payload passar de 4 KB).
- Métricas anônimas por instalação, sem email, telefone ou identificadores pessoais.

## Brand Commitments

- Idioma: português do Brasil.
- **Voz: "nós encontramos e trazemos".** O app comunica que ele mesmo encontra as promoções e traz para o usuário, por exemplo "encontramos as ofertas", "encontrada há 8 min" e "trazemos só as que passam".
  - Nenhuma tela, notificação ou texto pode citar grupos, canais ou Telegram, nem dar a entender que o app observa divulgações de terceiros.
  - Não usar "divulgada", "divulgação" nem a contagem de menções em textos visíveis. As menções continuam existindo como sinal interno de score.
- **Nome em aberto.** "Sale Advisor" é o nome de trabalho, e propostas de nome são bem-vindas.
- Ainda não existe logo nem marca registrada.

## Evidence on Hand

- Ofertas demonstrativas em `src/starter-offers.ts`, com preços ilustrativos claramente marcados.
- Não há depoimentos, números de usuários, economia média nem parcerias com lojas. Nada disso deve ser inventado em telas.

## Product Principles

1. **O histórico decide, não o usuário.** O usuário nunca informa preço desejado, preço-alvo nem faixa de preço. Ele só escolhe os produtos que quer, e a análise de histórico decide se uma oferta é boa.
2. **Silêncio é uma feature.** Notificar pouco e bem. Cada push precisa merecer a interrupção.
3. **Privado por padrão.** Os filtros finos não saem do aparelho, e isso deve ser dito com clareza, sem drama.
4. **Auditável.** Todo rótulo de qualidade vem com o porquê (contra qual mínima ou mediana ele foi comparado).
5. **Rápido até o primeiro alerta.** O onboarding termina com alertas ligados, não com um tutorial.

## Accessibility & Inclusion

Seguir Material 3 no Android: alvos de toque de 48 dp, texto em sp respeitando a escala de fonte do sistema e contraste AA. Nenhum requisito específico além disso foi levantado.
