# Sale Advisor - Guia De Arquitetura E Desenvolvimento

Este repositório é um monorepo para um app de monitoramento de promoções. O MVP foca em hardware, começando por placas de vídeo, usando grupos de Telegram como fonte inicial de ofertas.

O objetivo do produto é permitir que o usuário indique intenção de compra por categorias e produtos, enquanto o sistema identifica, classifica e notifica ofertas relevantes com base em histórico de preço e qualidade da oferta. O usuário não deve precisar decidir manualmente qual preço vale a pena.

## Decisões Técnicas Do Produto

### Escopo Inicial

- Categoria inicial: hardware.
- Produto inicial: placas de vídeo.
- Fonte inicial de ofertas: grupos e canais de promoções do Telegram.
- App sem cadastro/login no MVP.
- Preferências finas do usuário armazenadas localmente no aparelho.
- Backend central responsável por coleta, normalização, deduplicação, histórico de preços, scoring e feed.
- Métricas coletadas de forma anônima por instalação.

### Princípio Central

O sistema deve ser construído ao redor de três ativos principais:

- Produto canônico: representação estruturada de um item, como `RTX 4060 8GB`.
- Histórico de preços: base temporal para decidir se uma oferta é realmente boa.
- Menções de oferta: cada aparição de uma promoção em uma fonte, preservada para auditoria e métricas.

Não apague sinais brutos cedo demais. Mensagens originais, URLs capturadas e menções devem ser preservadas para debug, melhoria de parser e métricas de qualidade das fontes.

## Arquitetura Alvo

Fluxo principal:

```text
Telegram
-> Coleta de mensagens
-> Armazenamento bruto
-> Parsing de oferta
-> Normalização de URL/produto/preço
-> Deduplicação
-> Histórico de preços
-> Scoring de relevância
-> API/feed
-> App mobile
-> Filtro local
-> Notificação, clique e métricas
```

Componentes:

- `apps/api`: backend HTTP, ingestão de eventos, feed, admin e endpoints públicos do app.
- `apps/worker`: jobs de coleta, parsing, deduplicação, scoring e notificações.
- `apps/mobile`: app mobile em React Native/Expo.
- `apps/admin`: painel interno para auditoria e correção de dados.
- `packages/domain`: regras de domínio compartilhadas, tipos, parsers e normalizadores puros.
- `packages/shared`: utilitários compartilhados sem dependência de framework.
- `packages/config`: configuração compartilhada de TypeScript, lint, formatting e ambiente.
- `infra`: infraestrutura, Docker Compose, migrações operacionais, scripts de deploy e observabilidade.
- `docs`: decisões arquiteturais, ADRs, diagramas e especificações.

## Stack Recomendada

### Monorepo

- Gerenciador: `pnpm workspaces`.
- Linguagem principal: TypeScript.
- Organização: apps independentes e pacotes compartilhados.

Motivo: `pnpm` mantém workspaces simples, rápidos e econômicos em disco. TypeScript reduz erros nos contratos entre coleta, API, app e pacotes de domínio.

### Backend

- Framework recomendado: NestJS.
- Banco principal: PostgreSQL.
- Fila/cache: Redis + BullMQ.
- Validação de dados: schemas explícitos nas bordas da aplicação.
- Migrations: ferramenta versionada e obrigatória para qualquer alteração de schema.

Motivo: NestJS oferece boa estrutura modular para uma aplicação que terá API, workers, jobs e integrações externas. PostgreSQL é adequado para dados relacionais, histórico de preços, eventos anônimos e consultas analíticas iniciais. Redis + BullMQ simplifica pipelines assíncronos.

### Coleta Do Telegram

- Preferir Telegram Client API para o MVP, usando uma conta autorizada nos grupos/canais monitorados.
- Bot API pode ser usada apenas quando o bot tiver permissão e acesso suficiente.
- A coleta deve rodar em worker separado da API HTTP.

Motivo: grupos de promoções nem sempre aceitam bots ou dão permissões adequadas. Um client autorizado tende a ser mais flexível para validar o MVP.

### App Mobile

- Framework recomendado: React Native com Expo.
- Storage local: SQLite ou MMKV.
- Push: Firebase Cloud Messaging.
- Login: fora do MVP, mas arquitetura deve permitir login opcional no futuro.

Motivo: Expo acelera o desenvolvimento mobile e reduz complexidade nativa inicial. Storage local permite manter preferências sem cadastro e sem enviar filtros sensíveis ao backend.

### Admin

- Deve existir cedo, mesmo simples.
- Pode começar como app web interno.
- Deve permitir revisar mensagens brutas, corrigir produto associado, juntar/separar duplicatas, bloquear fontes ruins e ajustar aliases.

Motivo: a qualidade do produto depende muito da normalização e do matching. Um painel interno acelera correções e gera dados para melhorar o sistema.

## Modelo De Dados Conceitual

Tabelas centrais esperadas:

```text
telegram_sources
raw_messages
products
product_aliases
stores
offers
offer_mentions
price_snapshots
device_installations
anonymous_events
```

Separar `offers` de `offer_mentions` é obrigatório:

- `offers`: oferta consolidada e deduplicada.
- `offer_mentions`: cada mensagem ou fonte que mencionou aquela oferta.

Isso reduz spam para o usuário sem perder rastreabilidade. `mention_count` também vira sinal de popularidade e relevância.

## Deduplicação De Ofertas

Deduplicar em camadas, usando sinais em ordem de confiança:

```text
1. store_domain + store_product_id + price + coupon + janela de tempo
2. normalized_url_hash + price + janela de tempo
3. canonical_product_id + store_domain + price_bucket + coupon + janela de tempo
4. similaridade de título apenas como fallback
```

Diretrizes:

- Começar com janela de deduplicação de 48 horas.
- Preservar preço exato e também calcular `price_bucket` quando útil.
- Normalizar URLs removendo parâmetros de tracking como `utm_*`, `fbclid`, `gclid`, `ref`, `tag` e similares.
- Resolver encurtadores quando possível.
- Adaptadores por domínio devem extrair `store_product_id` quando a loja tiver identificador estável.

Nunca deduplicar apenas pelo texto completo da mensagem.

## Produto Canônico E Normalização

No MVP, usar taxonomia controlada para GPUs:

```text
NVIDIA
- RTX 3060
- RTX 4060
- RTX 4060 Ti
- RTX 4070
- RTX 4070 Super

AMD
- RX 6600
- RX 7600
- RX 7700 XT
- RX 7800 XT
```

Começar com regras determinísticas bem testadas:

- chipset/modelo.
- VRAM.
- marca.
- loja.
- condição do produto, quando detectável.
- cupom.
- preço à vista/pix quando identificado.

IA/LLM só deve entrar depois que houver dados rotulados e casos reais suficientes para justificar custo e complexidade.

## Scoring De Oferta

O backend deve decidir se uma oferta é relevante usando dados históricos.

Métricas iniciais:

- menor preço em 7 dias.
- menor preço em 30 dias.
- menor preço em 90 dias.
- mediana em 30 dias.
- desvio contra mediana.
- frequência de ofertas.
- quantidade de menções.
- confiabilidade da loja.

Rótulos iniciais:

```text
normal
boa
muito_boa
excepcional
```

O score deve ser simples no início, auditável e fácil de ajustar. Evitar modelos opacos enquanto a base de dados ainda é pequena.

## App Sem Login

No MVP:

- Gerar `installation_id` local no primeiro uso.
- Registrar instalação anonimamente no backend.
- Armazenar preferências locais no aparelho.
- Enviar eventos anônimos para métricas.
- Usar push token associado à instalação, não a uma conta.

Preferências finas locais:

- categorias seguidas.
- modelos desejados.
- marcas bloqueadas.
- lojas bloqueadas.
- score mínimo.
- produtos ocultados.

O backend pode receber apenas preferências amplas para notificação, como categoria `GPU` e score mínimo. O filtro final deve continuar no aparelho.

## Métricas E Privacidade

Eventos úteis:

```text
app_opened
feed_refreshed
offer_viewed
offer_clicked
notification_received
notification_opened
product_followed
product_hidden
store_blocked
```

Regras:

- Não coletar email, telefone ou identificadores pessoais no MVP.
- Usar `installation_id` aleatório.
- Manter payloads mínimos.
- Evitar guardar preferências finas do usuário no backend sem necessidade.
- Preparar política de privacidade e opção futura de limitar analytics.

Mesmo dados anônimos de uso devem ser tratados com seriedade e transparência.

## Boas Práticas De Desenvolvimento

### Design De Código

- Domínio primeiro: regras de produto, preço, dedupe e scoring devem ficar em pacotes testáveis, não presas a controllers ou jobs.
- Bordas explícitas: validar dados que entram por Telegram, API, eventos e jobs.
- Idempotência: jobs podem rodar mais de uma vez sem criar dados inconsistentes.
- Observabilidade desde cedo: logs estruturados, IDs de correlação e métricas básicas por pipeline.
- Falhas parciais: erro em uma mensagem não deve parar a coleta inteira.
- Reprocessamento: mensagens brutas devem poder ser reprocessadas após melhoria do parser.

### Banco De Dados

- Toda alteração de schema deve passar por migration.
- Criar índices pensando nos fluxos reais: busca por produto, oferta ativa, janela temporal, URL hash e store product id.
- Usar constraints para proteger unicidade onde o domínio permitir.
- Evitar apagar dados brutos; preferir status e timestamps.
- Separar tabelas operacionais de tabelas analíticas quando volume justificar.

### Filas E Workers

- Jobs devem ter retry com backoff.
- Jobs externos devem ter timeout.
- Evitar chamadas HTTP externas dentro de transações longas.
- Registrar falhas com contexto suficiente para replay.
- Usar filas separadas para coleta, parsing, scoring e notificações quando o volume crescer.

### API

- Endpoints devem ser versionáveis.
- DTOs e contratos devem ser tipados.
- Não expor detalhes internos do parser ou da deduplicação no contrato público.
- Paginar feeds.
- Usar cache onde fizer sentido, mas sem esconder dados incorretos difíceis de invalidar.

### App

- O app deve funcionar mesmo que o feed falhe temporariamente, mantendo estado local.
- Preferências locais devem ter versão de schema para migração futura.
- Eventos anônimos podem ser enviados em lote.
- O usuário não deve ser notificado repetidamente pela mesma oferta consolidada.

### Testes

Prioridades de teste:

- parser de preço.
- normalização de URL.
- extração de `store_product_id`.
- deduplicação.
- identificação de produto canônico.
- cálculo de score.
- idempotência dos jobs.

Casos reais de mensagens do Telegram devem virar fixtures anonimizadas.

### Fluxo Obrigatório De Desenvolvimento Com Testes

Sempre que um plano de implementação for montado, o desenvolvimento deve seguir este fluxo:

1. Plano desenvolvido.
2. Testes robustos que traduzam as regras de negócio.
3. Desenvolvimento da feature.
4. Rodada de testes para checagem do desenvolvimento.
5. Em caso de erros, ajuste do código.

Regras:

- Testes devem ser escritos antes da implementação da feature sempre que houver um plano de desenvolvimento.
- Os testes devem refletir regras de negócio, casos de borda e comportamento esperado, não detalhes acidentais da implementação.
- Após a implementação, a IA deve rodar os testes relevantes e reportar o resultado.
- Se os testes falharem, corrigir o código de produção.
- Nunca alterar os testes para fazer uma implementação incorreta passar.
- Testes só podem ser alterados após a rodada de falha quando ficar demonstrado que o teste não representa a regra de negócio correta, e essa mudança deve ser explicitamente justificada.

### Commit Obrigatório Ao Concluir Planos

Sempre que a IA concluir a implementação de um plano aprovado, ela deve:

- Rodar os testes e verificações relevantes antes do commit.
- Conferir `git status` para revisar os arquivos alterados.
- Criar um commit pequeno e focado com todas as mudanças do plano.
- Usar Conventional Commits, com escopo quando fizer sentido, por exemplo `feat(domain): add initial offer parsing rules`.
- Reportar o hash do commit e o resultado das verificações executadas.
- Se não for possível criar o commit, explicar objetivamente o bloqueio e deixar claro quais verificações foram executadas.

### Escalabilidade

Projetar para crescimento gradual:

- Primeiro monólito modular + workers.
- Depois separar serviços apenas quando houver gargalo real.
- Escalar coleta e parsing horizontalmente por fila.
- Manter domínio compartilhado em pacotes versionados internamente.
- Evitar acoplamento entre app mobile e detalhes de fontes específicas.

Não criar microserviços cedo. A prioridade inicial é qualidade de dados, iteração rápida e arquitetura modular.

## Convenções Do Repositório

- Código e documentação podem usar português para decisões de produto e domínio.
- Identificadores de código devem usar inglês.
- Commits devem ser pequenos e focados.
- Mudanças de arquitetura devem ser documentadas em `docs/adr`.
- Toda feature com impacto em dados deve explicar migração, compatibilidade e estratégia de rollback.
- Não introduzir dependências grandes sem justificar o problema que elas resolvem.

## Estrutura Inicial Do Monorepo

```text
apps/
  api/
  worker/
  mobile/
  admin/
packages/
  domain/
  shared/
  config/
infra/
docs/
  adr/
```

Esta estrutura deve evoluir por necessidade real do produto, preservando clareza entre aplicação, domínio, infraestrutura e documentação.
