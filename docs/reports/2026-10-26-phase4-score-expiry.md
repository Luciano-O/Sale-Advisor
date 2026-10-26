# Fase 4: score e expiração de ofertas

Medição de 26/10/2026. Somente contagens agregadas.

## Problema encontrado

Na VPS, 563 de 564 ofertas ativas tinham o rótulo `normal` com o motivo `insufficient_history`,
embora 16 produtos tivessem pelo menos 3 preços em 30 dias. O score só compara preços do mesmo
produto, e o worker identificava o produto dos snapshots pelo UUID da tabela `products`, enquanto a
oferta usava o `canonical_key`. As chaves nunca coincidiam, então nenhuma oferta encontrava
histórico.

Também não havia expiração: 488 das 563 ofertas "ativas" não eram mencionadas havia mais de 7 dias,
e 288 havia mais de 30.

## Mudanças

- Snapshots usam o `canonical_key`, a mesma chave das ofertas.
- A oferta é avaliada na última menção contra o histórico anterior a ela, e é repontuada a cada
  nova menção (política `offline-price-history-v2`).
- Ofertas sem menção há mais de `OFFER_TTL_HOURS` (72 h) expiram a cada 10 minutos; o histórico de
  preços é mantido. Reprocessar mensagens antigas não reativa ofertas vencidas.

## Por que 72 horas

Nos dados da VPS, o intervalo entre menções da mesma oferta tem mediana de 6,5 h, percentil 90 de
24 h e máximo de 46 h (a deduplicação só junta menções dentro de 48 h). Uma oferta sem nova menção
por 72 h já saiu do ar na prática.

## Resultado

Simulação na VPS (563 ofertas ativas) e reprocessamento local das mesmas 1.102 mensagens da linha
de base:

| Rótulo | Simulação na VPS | Reprocessamento local |
| --- | ---: | ---: |
| excepcional | 7 | 3 |
| muito_boa | 6 | 15 |
| boa | 33 | 48 |
| normal | 457 | 824 |
| sem histórico suficiente | 60 | (contado em normal) |

Cerca de 7% a 8% das ofertas ficam como `boa` ou melhor, o que dá uma base para notificações. Os
limiares (5%, 10% e 15% abaixo da mediana de 30 dias) continuam os mesmos e serão calibrados na
fase 6, com uso real.

No reprocessamento local houve 0 jobs com falha. O job de score levou p50 de 58 ms e p90 de cerca
de 1 s; o custo maior aparece só em reprocessamentos em massa, quando cada mensagem repontua as
ofertas posteriores do mesmo produto.
