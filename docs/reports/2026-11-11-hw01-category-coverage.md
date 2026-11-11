# HW-01: cobertura das fontes por categoria

- Issue: HW-01 (#23) do [plano de categorias](../roadmap/01-hardware-categories.md).
- Medição "antes": 2026-11-11, sobre todas as `raw_messages` da VPS.
- Medição "depois": pendente. Ela depende de o dono do app entrar nos canais novos.

## Antes dos canais novos

Contexto da coleta:

- 1 canal Telegram monitorado (`TELEGRAM_CHATS` com 1 entrada), com mensagens de 08/08/2026 a
  11/11/2026, e 1 mensagem manual.
- Relatório gerado com o código desta issue, executado no container do worker da VPS em modo só
  leitura. O código em produção não foi alterado.

Gerado em 2026-11-11T16:17:33.979Z. Somente contagens agregadas; nenhum texto, preço ou URL.

### Mensagens

Total: 1362

| Origem | Mensagens |
| --- | ---: |
| telegram | 1361 |
| manual | 1 |

| Status | Mensagens |
| --- | ---: |
| completed | 1048 |
| partial | 314 |

### Mensagens que não viraram oferta

| Motivo | Mensagens |
| --- | ---: |
| Parse incompleto (total) | 314 |
| Sem produto canônico | 313 |
| Sem preço | 232 |
| Sem loja | 20 |
| Falha ao resolver URL | 1 |

### Cobertura por categoria

Contagem por palavras-chave. Meta para as fixtures: 30 mensagens nos últimos 30 dias. Uma mensagem conta em cada categoria que cita.

| Categoria | Chave | Total | Últimos 30 dias | Meta |
| --- | --- | ---: | ---: | --- |
| Placa de vídeo | GPU | 1118 | 509 | atingida |
| Processador | CPU | 1 | 0 | sem fonte |
| Memória RAM | RAM | 0 | 0 | sem fonte |
| SSD / HD | STORAGE | 0 | 0 | sem fonte |
| Fonte | PSU | 0 | 0 | sem fonte |
| Placa-mãe | MOBO | 0 | 0 | sem fonte |

Notebooks, PCs montados e kits (fora das categorias): 2

Sem categoria de hardware: 241

### GPUs citadas sem produto canônico

Mensagens: 20

| Modelo | Mensagens |
| --- | ---: |
| RTX 2070 | 5 |
| RX 5500 | 4 |
| RX 5600 | 4 |
| RTX 2060 | 3 |
| RTX 2060 Super | 1 |
| RTX 4050 | 1 |
| RTX 5060 | 1 |
| RX 5500 XT | 1 |

### Notebooks e computadores classificados como GPU

Mensagens: 1

### Domínios sem adaptador dedicado

| Domínio | Mensagens |
| --- | ---: |
| m.aliexpress.com | 17 |
| aliexpress.com | 7 |
| mercadolivre.com | 4 |
| aceleraafiliado.com | 2 |
| patoloco.com.br | 1 |
| t.me | 1 |

### Hosts com falha de redirecionamento

| Host | Mensagens |
| --- | ---: |
| a.aliexpress.com | 1 |

### Histórico de preços

Produtos com pelo menos 3 preços nos últimos 30 dias: 16 de 28

## Leitura

1. **O canal atual só cobre placa de vídeo.** GPU tem 509 mensagens nos últimos 30 dias, 17 vezes a
   meta. As outras cinco categorias somam 1 mensagem em todo o histórico.
2. **A heurística confere com buscas diretas no banco.** Os `ddr5` encontrados são GDDR5 de placas
   de vídeo, os `ssd` estão em notebooks e não há nenhuma ocorrência de `ryzen`, `nvme`,
   `placa-mãe` ou `fonte`. A primeira execução contou 9 Intel Arc B580 como placa-mãe (chipset
   B580). O padrão foi corrigido, coberto por teste, e esse é o resultado acima.
3. **As 241 mensagens sem categoria não escondem hardware.** As buscas do item 2 não acharam termos
   das categorias novas nelas. 232 mensagens do canal não têm preço, o que indica avisos e cupons, e
   há poucos produtos de outro tipo (10 celulares, 1 monitor).
4. **Sem canais novos, as categorias HW-09 a HW-13 ficariam vazias.** Fixtures reais também não
   existem para elas.

## Canais candidatos

A escolha é do dono do app, que entra nos canais com a conta autorizada. Critérios:

- canal ou grupo brasileiro de promoções de **hardware em geral** (não só GPU), ativo todo dia;
- postagens com link de loja e preço no texto (o parser depende dos dois);
- preferência por canais que cubram Kabum, Pichau, Terabyte, Amazon e Mercado Livre;
- evitar canais de cupom genérico ou de eletrônicos variados, que inflam "sem categoria".

Passos depois de entrar:

1. Adicionar os chats em `TELEGRAM_CHATS` no `.env.vps` e recriar o worker com os três arquivos de
   compose (incluindo `infra/compose.fcm.yaml`).
2. Importar o histórico inicial sem notificar.
3. Rodar `report:parser` de novo e preencher a seção abaixo.

## Depois dos canais novos

_Pendente._

## Decisão por categoria

Fica em aberto até a medição "depois". Toda categoria que não chegar a 30 mensagens em 30 dias
fica registrada aqui como "sem fonte", com a decisão de adiar a issue dela (HW-09 a HW-13).
