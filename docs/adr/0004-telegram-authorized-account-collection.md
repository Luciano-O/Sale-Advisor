# ADR 0004: coleta Telegram por conta autorizada no worker

- Status: aceita
- Data: 2026-07-30

## Contexto

Os grupos e canais de promoções do MVP nem sempre permitem bots. A coleta precisa preservar o
payload original, sobreviver a reinícios, produzir jobs idempotentes e permanecer isolada da API
HTTP.

## Decisão

Usar MTProto com `teleproto` e uma `StringSession` injetada por segredo. Somente o worker mantém a
conexão. Uma allowlist configurável resolve chats para IDs estáveis; eventos novos e histórico
recuperado viram jobs `telegram-ingest` determinísticos.

O processor grava `sources`, `raw_messages` e `outbox_events` usando a chave
`sha256("telegram:<peerId>:<messageId>")`. O payload completo serializável e todas as URLs capturadas
ficam em `original_payload`; a URL comercial preferida fica também em `supplied_url`. A outbox
existente inicia parsing, consolidação, scoring e notificações.

No primeiro startup são importadas até 100 mensagens por chat sem notificar. Depois disso, o maior
`external_id` persistido atua como cursor; lacunas e eventos ao vivo são elegíveis para notificação.
Somente mensagens novas são coletadas nesta versão.

## Consequências

- Nenhuma migration é necessária; o schema atual já contém os campos e constraints exigidos.
- Redis pode repetir ou remover jobs sem comprometer a idempotência no PostgreSQL.
- Falhas de configuração são fatais; falhas transitórias de conexão são retentadas sem interromper
  os processors já ativos.
- A sessão concede acesso à conta e deve permanecer em `.env` ignorado ou secret manager.
- Edições e exclusões exigirão um modelo futuro de revisões para não inflar `mention_count`.

## Alternativas consideradas

- Bot API: descartada porque bots podem não ter acesso aos grupos monitorados.
- Coleta pela API HTTP: descartada para não acoplar uma conexão MTProto persistente ao backend web.
- Persistir sessão no repositório: descartado por risco de comprometimento da conta.
