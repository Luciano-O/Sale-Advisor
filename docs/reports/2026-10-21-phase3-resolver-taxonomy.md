# Relatório do parser

Gerado em 2026-10-21T18:01:49.830Z. Somente contagens agregadas; nenhum texto, preço ou URL.

## Mensagens

Total: 1120

| Origem | Mensagens |
| --- | ---: |
| telegram | 1120 |

| Status | Mensagens |
| --- | ---: |
| completed | 882 |
| partial | 238 |

## Mensagens que não viraram oferta

| Motivo | Mensagens |
| --- | ---: |
| Parse incompleto (total) | 238 |
| Sem produto canônico | 238 |
| Sem preço | 39 |
| Sem loja | 17 |
| Falha ao resolver URL | 0 |

## GPUs citadas sem produto canônico

Mensagens: 23

| Modelo | Mensagens |
| --- | ---: |
| RTX 2070 | 5 |
| RX 5500 | 4 |
| RX 5600 | 4 |
| RTX 2060 | 3 |
| RX 9070 GRE | 3 |
| RX 9050 | 2 |
| RTX 2060 Super | 1 |
| RTX 3050 | 1 |
| RTX 4050 | 1 |
| RTX 5070 | 1 |

## Notebooks e computadores classificados como GPU

Mensagens: 0

## Domínios sem adaptador dedicado

| Domínio | Mensagens |
| --- | ---: |
| kabum.com.br | 170 |
| terabyteshop.com.br | 81 |
| magazineluiza.com.br | 51 |
| m.aliexpress.com | 14 |
| mercadolivre.com | 4 |
| aceleraafiliado.com | 2 |
| patoloco.com.br | 1 |
| t.me | 1 |

## Hosts com falha de redirecionamento

_Nenhum registro em host._

## Histórico de preços

Produtos com pelo menos 3 preços nos últimos 30 dias: 14 de 29

## Contexto

Mesmas 1120 mensagens da linha de base (`2026-10-21-parser-baseline.md`), reprocessadas com o
resolvedor `safe-redirect-v2` e a taxonomia ampliada. As 5 mensagens de RX 9070 GRE e RX 9050
foram adicionadas à taxonomia depois deste reprocessamento e ainda aparecem acima sem produto.

## Comparação com a linha de base

| Métrica | Linha de base | Depois | Meta |
| --- | ---: | ---: | --- |
| Mensagens que viraram oferta | 24 | 882 | — |
| Falhas de resolução de URL | 944 | 0 | < 5% das resoluções |
| Mensagens de GPU sem produto canônico | 815 | 23 | < 10% das mensagens de GPU |
| Notebooks e computadores como GPU | 0 | 0 | 0 |
| Produtos com 3 preços em 30 dias | 1 de 9 | 14 de 29 | — |

As GPUs restantes sem produto são de gerações fora da taxonomia (RTX 20, RX 5000, RTX 4050 de
notebook) e uma mensagem promocional do próprio canal que cita modelos sem ser oferta.

A meta do golden set continua em aberto: os rótulos de `telegram-real-messages.json` ainda não
foram revisados manualmente.

## Próximos itens da fase 3

- adaptadores para `kabum.com.br`, `terabyteshop.com.br` e `magazineluiza.com.br`, que agora
  aparecem como destino final da maioria das ofertas;
- `m.aliexpress.com` e `aceleraafiliado.com` como destinos ou redirecionadores;
- cupons do tipo "R$ 100 OFF a partir de R$ 999" lidos como preço;
- aliases, correções do admin e bloqueio de fonte com efeito real.
