# Plano 2: verificação ativa de preços por lista monitorada

- Status: proposto em 2026-11-11, aguardando aprovação
- Depende de: [plano 1](01-hardware-categories.md) até a HW-08 (produto genérico e API
  multi-categoria). As categorias HW-09 a HW-13 podem seguir em paralelo.
- Objetivo: manter uma lista revisável de páginas de produto e checar o preço delas
  periodicamente, usando a VPS e o PC pessoal (RX 9070 XT) com IA local só como reserva. O
  resultado alimenta o histórico de preços, confirma ofertas antes do push e detecta quedas de
  preço que nenhum canal divulgou.

## Evidências que motivam o desenho (medidas em 2026-11-11, a partir do PC)

| Loja                      | Requisição simples | HTML bruto                                   | Onde está o preço                                                                      |
| ------------------------- | ------------------ | -------------------------------------------- | -------------------------------------------------------------------------------------- |
| KaBuM (página de produto) | 200                | ~156 mil caracteres (~44 mil tokens)         | JSON-LD `Product` e `__NEXT_DATA__`: preço no PIX, preço cheio, desconto, estoque      |
| Amazon (`/dp/`)           | 200                | ~1,14 milhão de caracteres (~326 mil tokens) | sem JSON-LD; bloco `corePriceDisplay_desktop_feature_div`; ~20 preços no texto visível |
| Terabyte                  | 403 (Cloudflare)   | —                                            | bloqueado                                                                              |
| Pichau                    | 403 (Cloudflare)   | —                                            | bloqueado                                                                              |

- `robots.txt` da KaBuM permite `/produto/` e proíbe `/carrinho*`, `/precarrinho*`, busca com
  parâmetros e ordenação por preço. O da Amazon permite `/dp/`.
- O HTML bruto não cabe em um modelo local de 16 GB de VRAM (Amazon) e é quase todo script
  (KaBuM). A IA só recebe um recorte de 1 a 2 mil tokens, e só quando a extração fixa falha.
- Ainda não medido: se a KaBuM e a Amazon respondem ao IP da VPS; termos de uso de cada loja.

## Arquitetura proposta (vira o ADR 0010 na issue AC-01)

```text
VPS                                              PC pessoal (quando ligado)
───                                              ──────────────────────────
lista monitorada (admin)
  → agendador cria checagens por cadência
      → fila de checagens ── API interna ──────→ runner puxa a checagem (só conexão de saída)
                                                   baixa a página, calcula hash
                                                   1. dados estruturados
                                                   2. seletor fixo da loja
                                                   3. recorte → IA local (llama-server, Vulkan)
      ← resultado (preço, estoque, vendedor) ────  devolve o resultado
  → page_checks → price_snapshots → score → push
```

Princípios:

1. **Extração determinística primeiro.** IA local é reserva, nunca o caminho principal.
2. **Sem IA externa: o que depende do PC espera o PC.** Não há API paga de reserva. Com o PC
   desligado, a checagem que precisa dele fica pendente na fila e é feita quando ele ligar. Cada
   item tem no máximo uma checagem pendente, então a fila não acumula. A coleta do Telegram e o
   push continuam normalmente, sem a confirmação de preço. O mesmo runner pode rodar na VPS, só
   com os extratores fixos, para as lojas que aceitam o IP dela.
3. **O PC só faz conexão de saída.** Nada é exposto na rede de casa.
4. **Acesso educado.** Respeitar `robots.txt`, uma requisição por vez por loja, cadência baixa,
   backoff em erro. Resposta 403 ou desafio anti-bot pausa a loja; **não se contorna bloqueio**.
5. **Só páginas de produto.** Nada de carrinho, login ou busca.
6. **Preço comparável.** Cada observação guarda o tipo de preço (PIX, à vista, parcelado) e o
   vendedor. O score só compara preços do mesmo tipo.
7. **Idempotência.** Checagem repetida não duplica snapshot (ADR 0002).

## Issues

### AC-01 — ADR 0010: verificação ativa por lista monitorada

- **Depende de:** HW-08.
- **Escopo:** registrar a arquitetura e os princípios acima; ler e resumir os termos de uso e o
  `robots.txt` da KaBuM e da Amazon Brasil; definir cadência inicial, retenção de HTML e o que
  acontece quando a loja bloqueia; registrar que não há IA externa e que as checagens esperam o
  PC ligar. Testar se a VPS recebe 200 dessas lojas.
- **Critérios de aceite:**
  - [ ] ADR aceito, com política de acesso por loja.
  - [ ] Lista inicial de lojas confirmada (proposta: KaBuM e Amazon).

### AC-02 — Banco: lista monitorada e observações de página

- **Depende de:** AC-01.
- **Escopo:**
  - `watched_products`: produto canônico, loja, URL normalizada, `store_product_id`, estado
    (`suggested`, `active`, `paused`, `dead`), cadência, origem da sugestão, contadores de falha.
  - `page_checks`: uma linha por checagem, com estado, HTTP, hash do conteúdo, método de extração
    (`structured`, `selector`, `llm`), campos extraídos, executor (`vps` ou `pc`) e duração.
  - `price_snapshots`: hoje exige `raw_message_id`. Passa a aceitar origem `page_check`, com
    referência à checagem, tipo de preço e nova regra de unicidade.
- **Critérios de aceite:**
  - [ ] Migration aditiva, com rollback descrito.
  - [ ] Snapshots vindos de mensagens continuam idênticos.
- **Testes:** `schema.test.ts`, integração de snapshots.

### AC-03 — Domínio: extratores de página por loja

- **Depende de:** AC-02.
- **Escopo:** funções puras em `packages/domain` que recebem HTML e devolvem
  `{ priceCents, priceType, listPriceCents, availability, seller, title }` ou um motivo de falha.
  - KaBuM: JSON-LD e `__NEXT_DATA__`.
  - Amazon: bloco principal de preço, disponibilidade e vendedor.
  - Função de recorte: devolve o trecho mínimo com preço para a reserva por IA.
  - Checagem de coerência: o título da página precisa casar com o produto canônico esperado.
- **Critérios de aceite:**
  - [ ] Fixtures de HTML reais (reduzidas) por loja: em estoque, esgotado, vendido por terceiro,
        página removida.
  - [ ] Página de outro produto na mesma URL é rejeitada.
- **Testes:** escritos antes, um arquivo por loja.

### AC-04 — API interna de checagens

- **Depende de:** AC-02.
- **Escopo:** endpoints versionados para o runner: reservar um lote de checagens (com prazo de
  devolução), enviar resultado, enviar falha. Chave própria do runner, separada da chave de admin.
  Reserva expirada volta para a fila.
- **Critérios de aceite:**
  - [ ] Dois runners não recebem a mesma checagem.
  - [ ] Enviar o mesmo resultado duas vezes não duplica snapshot.
- **Testes:** `api.e2e.test.ts`, integração com PostgreSQL.

### AC-05 — Agendador de checagens na VPS

- **Depende de:** AC-04.
- **Escopo:** job no worker que cria checagens conforme a cadência de cada item; limite por loja;
  backoff e pausa automática do item (404, falhas seguidas, dias sem estoque) e da loja (403 ou
  desafio anti-bot); prioridade para produtos com oferta ativa. Sem runner disponível, a checagem
  fica pendente; uma nova não é criada enquanto a anterior do mesmo item não for feita.
- **Critérios de aceite:**
  - [ ] Depois de horas sem runner, cada item tem uma única checagem pendente, e a fila é
        consumida respeitando o limite por loja quando o PC volta.
  - [ ] Nenhuma loja recebe mais requisições que o limite configurado.
  - [ ] Loja que responde 403 fica pausada e aparece no admin.
- **Testes:** agendador com relógio falso; idempotência.

### AC-06 — Runner de checagens (`apps/checker`)

- **Depende de:** AC-03, AC-04.
- **Escopo:** processo Node que puxa checagens, confere `robots.txt`, baixa a página com timeout,
  calcula o hash, roda os extratores e devolve o resultado. Guarda o HTML só quando a extração
  falha. Roda no PC (Windows) e, como serviço opcional do Compose, na VPS.
- **Critérios de aceite:**
  - [ ] Página com hash igual ao da última checagem não é reprocessada.
  - [ ] Erro em uma página não interrompe o lote.
  - [ ] Funciona sem GPU e sem IA (só os extratores fixos).
- **Testes:** runner com servidor HTTP falso.

### AC-07 — Reserva com IA local (RX 9070 XT)

- **Depende de:** AC-06.
- **Escopo:**
  - `llama-server` com backend Vulkan no PC; saída restrita por JSON schema.
  - O runner envia só o recorte da AC-03.
  - Validação: o preço devolvido precisa existir literalmente no recorte; senão, descarta.
  - Comparativo de modelos (8B e 14B) contra as fixtures de HTML: acerto, tempo por página e uso
    de VRAM, registrado em `docs/reports/`.
  - Sem IA externa: página que precisa de IA e foi baixada por um runner sem IA (VPS) volta para
    a fila marcada para o PC, e espera ele ligar.
- **Critérios de aceite:**
  - [ ] Com o servidor de IA fora do ar, a checagem fica pendente e nenhum dado sai para serviço
        externo.
  - [ ] Nenhum preço inventado nas fixtures (validação literal).
  - [ ] Relatório de comparativo escolhe o modelo padrão.
- **Testes:** validação literal, schema e espera pelo PC, com servidor de IA falso.

### AC-08 — Histórico, score e push com preços verificados

- **Depende de:** AC-05, AC-06.
- **Escopo:**
  - Resultado de checagem vira `price_snapshot` com origem e tipo de preço.
  - Mediana e mínimos comparam preços do mesmo tipo; ponto fora da curva é descartado.
  - Queda de preço detectada pela checagem gera oferta, mesmo sem menção em canal.
  - Antes do push, se houver checagem recente, o preço é confirmado; "esgotado" expira a oferta.
- **Critérios de aceite:**
  - [ ] Oferta divulgada por R$ X e verificada em estoque por R$ X é notificada uma única vez.
  - [ ] Oferta verificada como esgotada não gera push.
  - [ ] Score de produtos sem checagem não muda.
- **Testes:** `price-history`, `quality-score`, integração de scoring e de notificação.

### AC-09 — Admin: gestão da lista monitorada

- **Depende de:** AC-05.
- **Escopo:** sugestões automáticas a partir das ofertas (URL e ID de produto já normalizados);
  aprovar, pausar e remover; saúde por loja e por item; fila de revisão semanal com links mortos,
  itens pausados e produtos novos sem link.
- **Critérios de aceite:**
  - [ ] Aprovar uma sugestão cria checagens no ciclo seguinte.
  - [ ] A revisão semanal cabe em uma tela.
- **Testes:** `App.test.tsx`, e2e do admin.

### AC-10 — Operação e medição

- **Depende de:** AC-07, AC-08, AC-09.
- **Escopo:** runbook do PC (`docs/`): instalar o runner e o `llama-server`, iniciar com o
  Windows, atualizar e desligar; métricas por loja (sucesso, método de extração, bloqueios);
  relatório depois de duas semanas com cobertura, custo de energia estimado e impacto no score.
- **Critérios de aceite:**
  - [ ] Duas semanas rodando sem bloqueio de loja.
  - [ ] Relatório em `docs/reports/`, com decisão sobre cadência e sobre ampliar a lista.

### AC-11 — Pesquisa futura: incluir Pichau e Terabyte

- **Depende de:** AC-10. **Não bloqueia nada; fica registrada para avaliação posterior.**
- **Contexto:** em 2026-11-11 as duas lojas responderam 403 com desafio do Cloudflare a uma
  requisição simples vinda de IP residencial. Elas continuam cobertas só pelos canais.
- **Caminhos a avaliar (nenhum contorna o bloqueio):**
  1. Feed ou API de programa de afiliados (os links dos canais já passam por redes como a Awin).
  2. Pedido de autorização ou de acesso de parceiro às lojas.
  3. Comparadores de preço ou agregadores com API ou licença de uso.
  4. Reforçar a cobertura por canais dessas lojas e aceitar a falta de verificação.
- **Critérios de decisão:** permissão explícita da loja ou do programa, custo, atualização dos
  dados e esforço de manutenção.
- **Critérios de aceite:**
  - [ ] Nota em `docs/reports/` comparando os caminhos, com recomendação.
  - [ ] Se algum caminho for aprovado, nova issue de implementação; senão, registro da decisão.

## Fora do escopo deste plano

- Testar cupom no carrinho (o `robots.txt` da KaBuM proíbe o carrinho).
- Varredura de listagens e busca nas lojas.
- Canais de promoção dentro do app para outros usuários.
- Mercado Livre e Shopee (links de afiliado não levam ao produto; avaliar depois da AC-10).
