# Relatório do parser

Gerado em 2026-10-21T18:16:40.919Z. Somente contagens agregadas; nenhum texto, preço ou URL.

## Mensagens

Total: 1120

| Origem | Mensagens |
| --- | ---: |
| telegram | 1120 |

| Status | Mensagens |
| --- | ---: |
| completed | 887 |
| partial | 233 |

## Mensagens que não viraram oferta

| Motivo | Mensagens |
| --- | ---: |
| Parse incompleto (total) | 233 |
| Sem produto canônico | 233 |
| Sem preço | 165 |
| Sem loja | 17 |
| Falha ao resolver URL | 0 |

## GPUs citadas sem produto canônico

Mensagens: 18

| Modelo | Mensagens |
| --- | ---: |
| RTX 2070 | 5 |
| RX 5500 | 4 |
| RX 5600 | 4 |
| RTX 2060 | 3 |
| RTX 2060 Super | 1 |
| RTX 3050 | 1 |
| RTX 4050 | 1 |
| RTX 5070 | 1 |

## Notebooks e computadores classificados como GPU

Mensagens: 0

## Domínios sem adaptador dedicado

| Domínio | Mensagens |
| --- | ---: |
| m.aliexpress.com | 14 |
| mercadolivre.com | 4 |
| aceleraafiliado.com | 2 |
| patoloco.com.br | 1 |
| t.me | 1 |

## Hosts com falha de redirecionamento

_Nenhum registro em host._

## Histórico de preços

Produtos com pelo menos 3 preços nos últimos 30 dias: 15 de 31

## Contexto

Mesmas 1120 mensagens, reprocessadas com os adaptadores de KaBuM, Terabyte e Magazine Luiza, a
limpeza dos parâmetros de afiliado (Awin e Magazine Luiza), a regra de cupons e o preenchimento do
ID de produto em ofertas já consolidadas. Compara com `2026-10-21-phase3-resolver-taxonomy.md`.

## Comparação

| Métrica | Antes | Depois |
| --- | ---: | ---: |
| Mensagens que viraram oferta | 882 | 887 |
| Parses com preço abaixo de R$ 500 (cupom lido como preço) | 155 | 10 |
| Mensagens sem preço | 39 | 165 |
| Ofertas ativas KaBuM com ID de produto | 0 de 115 | 113 de 115 |
| Ofertas ativas Terabyte com ID de produto | 0 de 45 | 45 de 45 |
| Ofertas ativas Magazine Luiza com ID de produto | 0 de 23 | 23 de 23 |
| Ofertas ativas Amazon com ID de produto | 95 de 96 | 96 de 96 |

O aumento de "sem preço" é esperado: anúncios só de cupom ("R$ 100 OFF a partir de R$ 999")
deixaram de ter um preço inventado e não viram oferta.

## Limitações conhecidas

- **Mercado Livre (0 de 208 com ID):** os links `meli.la` dos canais redirecionam para a página
  "social" do afiliado, não para o produto. O ID do item só aparece no app ou via JavaScript, o que
  exigiria scraping (fora do escopo). Essas ofertas continuam deduplicadas por produto, loja e faixa
  de preço.
- **Shopee (27 de 143 com ID):** parte dos links termina em páginas de campanha ou `live.shopee`.
- `m.aliexpress.com` ainda não tem adaptador.
