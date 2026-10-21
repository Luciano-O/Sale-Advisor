# Relatório do parser

Gerado em 2026-10-21T17:30:10.735Z. Somente contagens agregadas; nenhum texto, preço ou URL.

## Mensagens

Total: 1120

| Origem | Mensagens |
| --- | ---: |
| telegram | 1120 |

| Status | Mensagens |
| --- | ---: |
| partial | 1096 |
| completed | 24 |

## Mensagens que não viraram oferta

| Motivo | Mensagens |
| --- | ---: |
| Parse incompleto (total) | 1096 |
| Sem produto canônico | 1030 |
| Sem preço | 39 |
| Sem loja | 961 |
| Falha ao resolver URL | 944 |

## GPUs citadas sem produto canônico

Mensagens: 815

| Modelo | Mensagens |
| --- | ---: |
| RTX 5060 | 294 |
| RTX 5060 Ti | 155 |
| RTX 5050 | 80 |
| RTX 5070 | 69 |
| RX 9060 XT | 66 |
| RX 9070 XT | 36 |
| RTX 5070 Ti | 28 |
| RX 9070 | 27 |
| RTX 5080 | 21 |
| RTX 3070 | 7 |
| RTX 5090 | 7 |
| RTX 2070 | 5 |
| RTX 3050 | 5 |
| RX 5500 | 4 |
| RX 5600 | 4 |

## Notebooks e computadores classificados como GPU

Mensagens: 0

## Domínios sem adaptador dedicado

| Domínio | Mensagens |
| --- | ---: |
| amzn.to | 52 |
| a.aliexpress.com | 14 |
| kabum.com.br | 7 |
| mercadolivre.com | 4 |
| link.amazon | 2 |
| cutt.ly | 1 |
| t.me | 1 |

## Hosts com falha de redirecionamento

| Host | Mensagens |
| --- | ---: |
| s.shopee.com.br | 358 |
| aoferta.net | 297 |
| meli.la | 289 |

## Histórico de preços

Produtos com pelo menos 3 preços nos últimos 30 dias: 1 de 9

## Contexto da coleta

- Fonte: 1 canal Telegram da allowlist local, com mensagens de 23/07/2026 a 21/10/2026.
- 105 mensagens tinham sido coletadas até 03/08/2026, ainda com o parser v2. As demais vieram da
  recuperação após restart, já com a correção do limite (fase 0).
- Todas as mensagens foram reprocessadas pelo parser v3: 1118 delas; 6 continuam v2 porque não
  contêm URL de loja ou encurtador alvo do reprocessamento.

## Leitura

1. **A resolução de links descarta a URL final (944 falhas).** Os três encurtadores redirecionam
   normalmente (301/302), mas a página final da loja responde 200 com mais de 64 KB. O resolvedor
   rejeita a resposta por tamanho antes de reconhecer que já chegou ao destino
   (`apps/worker/src/url-resolver.ts`). 132 links do `aoferta.net` terminam em 403 em um salto
   intermediário. Corrigir isso é o primeiro item da fase 3.
2. **A taxonomia não cobre o mercado atual.** 815 mensagens citam GPUs sem produto canônico.
   RTX 5060, 5060 Ti, 5050 e 5070 e RX 9060 XT, 9070 e 9070 XT somam mais de 700 delas.
3. **Faltam encurtadores e adaptadores.** `amzn.to`, `a.aliexpress.com`, `link.amazon` e
   `cutt.ly` não são resolvidos. `kabum.com.br` e `mercadolivre.com` não têm adaptador dedicado.
4. **Não há histórico de preços utilizável.** Só 1 dos 9 produtos canônicos tem 3 preços em 30
   dias. Nenhuma oferta passaria de "normal" hoje.
5. **Nenhum notebook ou PC foi classificado como GPU**, mas só porque quase nada foi
   classificado. A guarda continua necessária quando a taxonomia crescer.

## Metas para a fase 3

Medidas com o mesmo relatório, sobre as mesmas mensagens reprocessadas:

- falhas de resolução de URL: de 944 para menos de 5% das resoluções;
- mensagens de GPU sem produto canônico: de 815 para menos de 10% das mensagens de GPU;
- notebooks e computadores classificados como GPU: 0;
- golden set (`apps/worker/fixtures/telegram-real-messages.json`): pelo menos 90% das GPUs avulsas
  com produto canônico correto depois da revisão manual dos rótulos.
