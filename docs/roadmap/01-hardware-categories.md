# Plano 1: novas categorias de hardware

- Status: proposto em 2026-11-11, aguardando aprovação
- Objetivo: ter no app, além de placas de vídeo, **processadores, memórias RAM, SSDs/HDs, fontes e
  placas-mãe**, com produto canônico, histórico de preços, score, feed, seguir e push.
- Sequência: as issues são executadas na ordem. Cada uma vira um PR para o `master`, com testes
  escritos antes da implementação (fluxo do `AGENTS.md`).

## Situação atual (medida no código em 2026-11-11)

O pipeline inteiro assume GPU. Os pontos de acoplamento são:

| Camada   | Onde                                                                   | O que assume                                                                                                     |
| -------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Domínio  | `packages/domain/src/gpu.ts`, `types.ts`                               | `CanonicalGpuProduct { vendor: "NVIDIA" \| "AMD", model, vramGb }`; `identifyGpuProduct` é o único identificador |
| Domínio  | `offer-candidate.ts`                                                   | lista de marcas é de placas de vídeo (`extractBoardBrand`)                                                       |
| Domínio  | `price.ts`                                                             | `isLikelyGpuModelNumber` evita ler "5070" como preço                                                             |
| Domínio  | `price-bucket.ts`                                                      | faixa fixa de R$ 50, grossa demais para um pente de memória de R$ 150                                            |
| Banco    | `products`                                                             | `category` com default `GPU`, coluna `vram_gb`, unicidade por `(vendor, model, vram_gb)`                         |
| Banco    | `notification_subscriptions`                                           | uma única `category` por instalação                                                                              |
| Contrato | `packages/contracts/src/public.ts`, `apps/api/src/controllers.ts`      | `category: z.literal("GPU")`                                                                                     |
| API      | `postgres-repository.ts`                                               | catálogo devolve `'GPU' as category` fixo                                                                        |
| Worker   | `persistent-pipeline.ts`, `notification.ts`, `parser-report.ts`        | insere produto sem categoria; payload de push com `vramGb`; relatório só de GPU                                  |
| Mobile   | `types.ts`, `labels.ts`, `api.ts`, `push.ts`, `ui/SubcategoryIcon.tsx` | `category: "GPU"` literal; textos, ícone e nome do produto só para GPU                                           |

O que já ajuda:

- As preferências locais v2 (ADR 0008) já guardam subcategorias por chave. O app lê as categorias
  ativas do catálogo (`activeSubcategories`), então uma categoria nova aparece no onboarding e em
  Seguindo sem novo formato de preferências.
- As mensagens brutas são preservadas e reprocessáveis. Uma categoria nova ganha histórico
  retroativo com um reprocessamento, sem esperar semanas de coleta.

Risco medido: nas 100 fixtures reais (`apps/worker/fixtures/telegram-real-messages.json`), 80 citam
GPU, 1 cita memória e nenhuma cita processador, SSD, fonte ou placa-mãe. Os canais monitorados
parecem focados em placa de vídeo. Sem fontes novas, as categorias novas ficam vazias. Por isso a
primeira issue é de medição.

## Decisões propostas (viram o ADR 0009 na issue HW-02)

> Decididas em [ADR 0009](../adr/0009-multi-category-products.md). O ADR é a referência: ele ajusta
> a tabela abaixo (prefixo de categoria nas chaves novas, item seguível por categoria, marca do
> anúncio na oferta) e define compatibilidade, migração e rollback.

1. **Produto canônico genérico.** `CanonicalProduct { id, category, brand, model, attributes }`.
   `attributes` é um objeto pequeno e tipado por categoria (VRAM, capacidade, frequência, potência).
   GPU continua com as mesmas chaves canônicas, para não perder histórico.
2. **O produto canônico é a unidade de comparação de preço.** Dois anúncios só entram no mesmo
   histórico se um comprador os consideraria o mesmo item. Proposta por categoria:

   | Categoria      | Chave     | Produto canônico                                              | Exemplo de chave              | Seguir no app      |
   | -------------- | --------- | ------------------------------------------------------------- | ----------------------------- | ------------------ |
   | Placa de vídeo | `GPU`     | chipset + VRAM (como hoje)                                    | `nvidia-rtx-5070-12gb`        | modelo             |
   | Processador    | `CPU`     | modelo exato; sufixos (X, X3D, F, K, G) são modelos distintos | `amd-ryzen-5-5600`            | modelo             |
   | Memória RAM    | `RAM`     | geração + formato + kit + frequência; marca é atributo        | `ram-ddr4-dimm-16gb-2x8-3200` | especificação      |
   | SSD / HD       | `STORAGE` | marca + linha + capacidade                                    | `kingston-nv3-1tb`            | linha + capacidade |
   | Fonte          | `PSU`     | marca + linha + potência; selo 80 Plus é atributo             | `corsair-rm-750w`             | linha + potência   |
   | Placa-mãe      | `MOBO`    | marca + modelo exato; chipset e soquete são atributos         | `asus-tuf-b650m-plus-wifi`    | chipset            |

3. **Taxonomia controlada e determinística** em todas as categorias, como já é para GPU. Sem LLM
   nesta fase. O que não casar com a taxonomia fica sem produto e aparece no relatório do parser.
4. **Roteador de categoria antes da identificação.** Uma mensagem tem um produto principal. Kits
   ("kit upgrade"), PCs montados e notebooks não viram oferta de componente.
5. **Ordem das categorias por dificuldade:** processadores, memórias, SSDs/HDs, fontes e, por
   último, placas-mãe (centenas de modelos e nomes inconsistentes).
6. **Compatibilidade com o APK instalado.** A API continua aceitando `category=GPU`. Categorias
   novas só aparecem no catálogo depois de ativadas, uma a uma.

## Definição de pronto de uma categoria (usada nas issues HW-09 a HW-13)

- [ ] Taxonomia controlada no `packages/domain`, com testes escritos antes da implementação.
- [ ] Pelo menos 30 fixtures reais anonimizadas da categoria, incluindo casos negativos (kit, PC,
      notebook, acessório).
- [ ] Reprocessamento das mensagens brutas da VPS, com 0 jobs com falha.
- [ ] Relatório em `docs/reports/` com: mensagens que viraram oferta, sem produto canônico,
      produtos com pelo menos 3 preços em 30 dias, falsos positivos revisados em amostra.
- [ ] Nenhuma regressão nas métricas de GPU do relatório anterior.
- [ ] Categoria ativada no catálogo e validada no aparelho: feed, seguir, detalhe e push.

## Issues

### HW-01 — Medir a cobertura das fontes por categoria

- **Depende de:** nada.
- **Contexto:** as fixtures indicam que os canais atuais quase só falam de GPU.
- **Escopo:**
  - Estender `report:parser` com uma contagem por categoria baseada em palavras-chave, sobre as
    `raw_messages` da VPS (só contagens agregadas, como os relatórios atuais).
  - Listar canais candidatos de hardware geral. O dono do app entra neles com a conta autorizada.
  - Atualizar `TELEGRAM_CHATS` na VPS e importar o histórico inicial sem notificar.
- **Critérios de aceite:**
  - [ ] Relatório em `docs/reports/` com mensagens por categoria, antes e depois dos canais novos.
  - [ ] Cada categoria tem volume suficiente para as fixtures (meta: 30 mensagens em 30 dias) ou
        fica registrada como "sem fonte", com decisão de adiar.
- **Testes:** contagem por categoria no `parser-report.test.ts`.

### HW-02 — ADR 0009: modelo de produto multi-categoria

- **Depende de:** HW-01.
- **Escopo:** registrar em `docs/adr/0009-multi-category-products.md` as decisões propostas acima,
  ajustadas pelo que a HW-01 medir, com migração, compatibilidade e rollback. Atualizar
  `docs/adr/README.md` e a seção de escopo e taxonomia do `AGENTS.md`.
- **Critérios de aceite:**
  - [ ] Granularidade do produto canônico decidida para as seis categorias.
  - [ ] Regra para kits, PCs e notebooks decidida.
  - [ ] Estratégia de compatibilidade com o APK atual decidida.

### HW-03 — Domínio: produto canônico genérico e roteador de categoria

- **Depende de:** HW-02.
- **Escopo:**
  - `CanonicalProduct` genérico e registro de categorias (cada categoria fornece identificador,
    marcas e formatação do nome).
  - `identifyProduct(text, aliases)` com roteador de categoria. GPU migra para o registro sem
    mudar de comportamento.
  - Regras negativas compartilhadas: kit, PC montado, notebook, console, acessório.
  - `extractBoardBrand` vira marca por categoria.
- **Critérios de aceite:**
  - [ ] Todos os testes atuais de GPU passam sem alteração de expectativa.
  - [ ] As 100 fixtures reais produzem exatamente o mesmo `baseline` de hoje.
  - [ ] Texto com duas categorias (ex.: PC com RTX e Ryzen) não vira oferta de componente.
- **Testes:** roteador, regras negativas, snapshot das fixtures.

### HW-04 — Banco: produtos multi-categoria (migration aditiva)

- **Depende de:** HW-03.
- **Escopo:**
  - `products`: coluna `attributes jsonb`, `brand` (ou reaproveitar `vendor`), `category` sem
    default implícito no código. `vram_gb` continua preenchida para GPU durante a transição.
  - Unicidade passa a ser garantida por `canonical_key`; o índice `(vendor, model, vram_gb)` deixa
    de valer para categorias sem VRAM.
  - `notification_subscriptions`: de uma categoria para um conjunto de categorias.
  - Índice para catálogo e feed por categoria. Seed atualizado.
  - `persistent-pipeline.ts` grava categoria e atributos.
- **Critérios de aceite:**
  - [ ] Migration aditiva; o código da versão anterior continua funcionando (rollback por
        `git checkout`, como no runbook da VPS).
  - [ ] Produtos GPU existentes mantêm `canonical_key` e histórico.
- **Testes:** `schema.test.ts`, integração do pipeline persistente.

### HW-05 — Preço, deduplicação e score por categoria

- **Depende de:** HW-04.
- **Escopo:**
  - `price-bucket`: faixa proporcional ao preço ou configurada por categoria.
  - `price.ts`: generalizar `isLikelyGpuModelNumber` para números de modelo das novas categorias
    ("5600", "3200MHz", "750W", "B650") e capacidades ("1TB", "16GB").
  - Política de score com limiares e piso de sanidade por categoria (preço absurdo não entra no
    histórico). Os limiares começam iguais aos de GPU e são calibrados na HW-14.
- **Critérios de aceite:**
  - [ ] "Ryzen 5 5600 por R$ 899" lê R$ 899 como preço e 5600 como modelo.
  - [ ] Duas ofertas de memória a R$ 149 e R$ 189 não caem na mesma faixa.
  - [ ] Score de GPU não muda para as mesmas entradas.
- **Testes:** `price.test.ts`, `price-bucket.test.ts`, `deduplication.test.ts`, `quality-score.test.ts`.

### HW-06 — Contratos e API multi-categoria

- **Depende de:** HW-04.
- **Escopo:**
  - `category` vira enum nos contratos (`packages/contracts`), no feed, no catálogo e nas
    preferências de notificação.
  - Catálogo devolve categoria real, itens seguíveis e nome de exibição do produto.
  - Oferta pública passa a levar `category`, `brand`, `model`, `displayName` e `attributes`;
    `vendor` e `vramGb` continuam no payload enquanto o APK atual existir.
  - Catálogo só lista categorias ativadas.
- **Critérios de aceite:**
  - [ ] O APK atual continua funcionando sem atualização.
  - [ ] `GET /v1/offers?category=CPU` filtra corretamente.
- **Testes:** `api.e2e.test.ts`, `postgres-repository.integration.test.ts`, contratos.

### HW-07 — Admin multi-categoria

- **Depende de:** HW-06.
- **Escopo:** filtro por categoria em mensagens, ofertas e produtos; correção de produto e aliases
  com categoria; ativar e desativar categoria no catálogo; relatório do parser por categoria.
- **Critérios de aceite:**
  - [ ] É possível corrigir uma mensagem para um produto de qualquer categoria.
  - [ ] Ativar uma categoria no admin faz ela aparecer no catálogo público.
- **Testes:** `App.test.tsx`, e2e do admin.

### HW-08 — Mobile: fundação multi-categoria

- **Depende de:** HW-06.
- **Escopo:**
  - `types.ts`, `api.ts`, `push.ts`: categoria deixa de ser literal `"GPU"`.
  - `labels.ts`: nomes, dicas e exemplos de busca por subcategoria; `offerName` usa `displayName`.
  - `SubcategoryIcon`: um desenho por subcategoria, vindo do canvas de design.
  - Onboarding, Ofertas e Seguindo com várias subcategorias; filtro por subcategoria no feed.
  - `blockedBrands` passa a comparar com a marca do produto.
  - Payload de push e `notification-content` genéricos.
  - Textos seguem a voz "nós encontramos": nenhuma menção a grupos ou fontes.
- **Critérios de aceite:**
  - [ ] Com só GPU ativa, o app se comporta exatamente como hoje.
  - [ ] Com uma categoria de teste ativa, ela aparece no onboarding, em Seguindo e no feed.
  - [ ] Preferências salvas hoje continuam válidas (sem novo formato, ou com migração na leitura).
- **Testes:** `preferences`, `filters`, `following`, `labels`, `notification-content`, `push`.

### HW-09 — Categoria: processadores

- **Depende de:** HW-05, HW-07, HW-08.
- **Escopo:** taxonomia AMD (Ryzen 3/5/7/9 das séries 5000, 7000, 8000 e 9000) e Intel (Core
  i3/i5/i7/i9 da 12ª à 14ª geração e Core Ultra); sufixos como modelos distintos; atributo
  `box`/`tray` e "com cooler" quando detectável; processador dentro de kit ou notebook é ignorado.
- **Critérios de aceite:** definição de pronto de categoria.

### HW-10 — Categoria: memórias RAM

- **Depende de:** HW-09.
- **Escopo:** geração (DDR4, DDR5), formato (DIMM, SODIMM), capacidade total e kit (1x16, 2x8),
  frequência; marca e latência como atributos; "16GB" de VRAM ou de notebook não vira memória.
- **Critérios de aceite:** definição de pronto de categoria.

### HW-11 — Categoria: SSDs e HDs

- **Depende de:** HW-10.
- **Escopo:** tipo (NVMe, SATA, HD 3,5", HD 2,5", externo), linhas controladas por marca
  (Kingston NV3, WD Blue SN580, Seagate Barracuda etc.), capacidade; armazenamento citado em
  notebook, console ou celular é ignorado.
- **Critérios de aceite:** definição de pronto de categoria.

### HW-12 — Categoria: fontes

- **Depende de:** HW-11.
- **Escopo:** marca, linha e potência; selo 80 Plus e modularidade como atributos; "fonte" de
  notebook, carregador e fonte de LED são ignorados.
- **Critérios de aceite:** definição de pronto de categoria.

### HW-13 — Categoria: placas-mãe

- **Depende de:** HW-12.
- **Escopo:** chipset (A520, B550, B650, X870, H610, B760, Z790 etc.), soquete derivado do
  chipset, formato (ATX, mATX, ITX), marca e modelo normalizado; seguir por chipset no app;
  aliases do admin para modelos que a regra não normaliza.
- **Risco:** maior taxa de "sem produto canônico". Aceitar cobertura parcial e medir no relatório.
- **Critérios de aceite:** definição de pronto de categoria.

### HW-14 — Fechamento: calibragem e release

- **Depende de:** HW-13.
- **Escopo:** duas semanas de uso; calibrar limiares de score por categoria; revisar volume de push
  por dia; nota de release em `docs/releases/`; atualizar `AGENTS.md`, `docs/README.md` e
  `apps/mobile/PRODUCT.md`.
- **Critérios de aceite:**
  - [ ] As seis categorias ativas no app instalado.
  - [ ] Relatório final com ofertas `boa` ou melhor por categoria e taxa de falso positivo.

## Fora do escopo deste plano

- Gabinetes, coolers, monitores e periféricos.
- Kits e PCs montados como produto.
- LLM no parser (continua condicionado a dados rotulados, como no `AGENTS.md`).
- Verificação ativa de preço: é o [plano 2](02-active-price-checks.md).
