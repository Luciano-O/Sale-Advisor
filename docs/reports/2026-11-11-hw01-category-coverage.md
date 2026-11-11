# HW-01: cobertura das fontes por categoria

- Issue: HW-01 (#23) do [plano de categorias](../roadmap/01-hardware-categories.md).
- Medição "antes": 2026-11-11, sobre todas as `raw_messages` da VPS.
- Medição "depois": 2026-11-11, depois de adicionar 1 canal de hardware em geral.

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

Canal escolhido pelo dono do app: 1 canal público de hardware em geral, adicionado em
2026-11-11. Passos executados:

1. `TELEGRAM_CHATS` atualizado no `.env.vps` (com backup) e worker recriado com os três arquivos de
   compose, incluindo `infra/compose.fcm.yaml`. O worker continuou com `NOTIFICATION_PROVIDER=fcm`.
2. Histórico inicial importado sem notificar.
3. `report:parser` executado de novo, no mesmo modo só leitura.

## Depois dos canais novos

Contexto da coleta:

- `TELEGRAM_CHATS` passou de 1 para 2 canais. O canal novo é de promoções de hardware em geral.
- O histórico inicial do canal novo trouxe 1000 mensagens (o limite de
  `TELEGRAM_INITIAL_HISTORY_LIMIT`), todas com `notify_eligible = false`. Nenhum push foi enviado
  durante a importação.
- O canal novo publica cerca de 300 mensagens por dia, então as 1000 mensagens cobrem só de
  08/11/2026 a 11/11/2026. A coluna "Últimos 30 dias" mede, na prática, 3 dias do canal novo.
- No fim da medição o canal novo tinha 1001 mensagens (1000 do histórico e 1 recebida ao vivo, o
  que confirma a coleta contínua). 51 viraram oferta completa, 950 ficaram parciais (esperado: a
  taxonomia ainda é só de GPU) e nenhuma ficou pendente.

Gerado em 2026-11-11T18:50:57.667Z. Somente contagens agregadas; nenhum texto, preço ou URL.

### Mensagens

Total: 2372

| Origem | Mensagens |
| --- | ---: |
| telegram | 2371 |
| manual | 1 |

| Status | Mensagens |
| --- | ---: |
| partial | 1270 |
| completed | 1102 |

### Mensagens que não viraram oferta

| Motivo | Mensagens |
| --- | ---: |
| Parse incompleto (total) | 1270 |
| Sem produto canônico | 1269 |
| Sem preço | 445 |
| Sem loja | 38 |
| Falha ao resolver URL | 4 |

### Cobertura por categoria

Contagem por palavras-chave. Meta para as fixtures: 30 mensagens nos últimos 30 dias. Uma mensagem conta em cada categoria que cita.

| Categoria | Chave | Total | Últimos 30 dias | Meta |
| --- | --- | ---: | ---: | --- |
| Placa de vídeo | GPU | 1176 | 567 | atingida |
| Processador | CPU | 72 | 71 | atingida |
| Memória RAM | RAM | 72 | 72 | atingida |
| SSD / HD | STORAGE | 32 | 32 | atingida |
| Fonte | PSU | 28 | 28 | sem fonte |
| Placa-mãe | MOBO | 92 | 92 | atingida |

Notebooks, PCs montados e kits (fora das categorias): 87

Sem categoria de hardware: 898

### GPUs citadas sem produto canônico

Mensagens: 28

| Modelo | Mensagens |
| --- | ---: |
| RTX 4050 | 6 |
| RTX 2070 | 5 |
| RX 5500 | 4 |
| RX 5600 | 4 |
| RTX 2060 | 3 |
| RTX 5060 | 2 |
| RX 5500 XT | 2 |
| RTX 2060 Super | 1 |
| RTX 5070 | 1 |

### Notebooks e computadores classificados como GPU

Mensagens: 1

### Domínios sem adaptador dedicado

| Domínio | Mensagens |
| --- | ---: |
| aliexpress.com | 114 |
| m.aliexpress.com | 17 |
| mercadolivre.com | 14 |
| aceleraafiliado.com | 2 |
| br.gvgmall.com | 2 |
| youtube.com | 2 |
| patoloco.com.br | 1 |
| t.me | 1 |
| youtu.be | 1 |

### Hosts com falha de redirecionamento

| Host | Mensagens |
| --- | ---: |
| a.aliexpress.com | 4 |

### Histórico de preços

Produtos com pelo menos 3 preços nos últimos 30 dias: 16 de 28

## Leitura do depois

1. **Um canal basta para as seis categorias.** Em 3 dias de histórico, cinco categorias passaram da
   meta de 30 mensagens. Fonte ficou em 28, no mesmo período. No ritmo do canal, isso dá mais de
   200 mensagens em 30 dias.
2. **Placa-mãe não é falso positivo.** Os chipsets encontrados são reais (B550M, A520M, B760M,
   B650, B840M, B850, X870E, H610) e 90 mensagens dizem "placa-mãe" no texto.
3. **Kits, PCs e notebooks aparecem bastante (87).** A regra negativa do roteador (HW-03) é
   necessária desde a primeira categoria nova.
4. **O canal também publica outros produtos.** 898 mensagens não são de hardware. Elas não viram
   oferta, porque não casam com nenhuma taxonomia, mas ocupam a fila e o banco.

## Decisão por categoria

| Categoria | Chave | Fonte | Decisão |
| --- | --- | --- | --- |
| Placa de vídeo | GPU | 2 canais | segue como está |
| Processador | CPU | canal novo | segue para a HW-09 |
| Memória RAM | RAM | canal novo | segue para a HW-10 |
| SSD / HD | STORAGE | canal novo | segue para a HW-11 |
| Fonte | PSU | canal novo | segue para a HW-12; 28 em 3 dias, conferir a meta de 30 dias na HW-12 |
| Placa-mãe | MOBO | canal novo | segue para a HW-13 |

Nenhuma categoria fica "sem fonte". As fixtures de cada categoria (HW-09 a HW-13) podem sair das
mensagens brutas que já estão na VPS.
