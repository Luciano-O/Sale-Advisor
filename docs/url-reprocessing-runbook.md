# Runbook de resolução e reprocessamento de URLs

## Preparação

1. Aplicar migrations e confirmar PostgreSQL/Redis saudáveis.
2. Manter os workers parados durante o levantamento inicial.
3. Registrar apenas contagens agregadas de mensagens, parses, menções, snapshots, ofertas e filas.
4. Não acessar Telegram nem lojas reais em CI; testes usam DNS e HTTP falsos.

## Dry-run obrigatório

O comando padrão é somente leitura e cobre apenas encurtadores/lojas alvo:

```powershell
pnpm --filter @sale-advisor/worker reprocess:target-urls
```

A saída contém `mode` e `total`, sem texto, URL ou identificadores externos. Compare o total com uma
consulta administrativa independente antes de executar.

## Execução retomável

```powershell
pnpm --filter @sale-advisor/worker reprocess:target-urls -- --execute --checkpoint=C:\safe\sale-advisor-url-checkpoint.json
```

O script ordena por `created_at,id`, agenda lotes de 100 na outbox e grava o checkpoint somente após
o commit do lote. Repetir o mesmo comando retoma do último item confirmado. Remover o checkpoint
inicia um novo run e deve ocorrer somente após validar que a execução anterior terminou.

## Validação antes/depois

- `url_resolutions`: uma derivação por mensagem, URL, resolver e versão do pipeline;
- parses novos: `parser_version = 3`;
- falhas conhecidas: parse parcial com `url_resolution_failed`, sem oferta do encurtador;
- menções: exatamente uma ativa por mensagem reprocessada;
- snapshots: exatamente um ativo por mensagem reprocessada, mantendo os anteriores inativos;
- ofertas: `mention_count` igual às menções ativas; oferta sem menções expirada;
- filas: `resolve-url`, `parse`, `consolidate`, `score` e `notify` sem crescimento contínuo de falhas.

## Interrupção e rollback

Para interromper, pare os workers; o checkpoint já gravado permanece consistente. Não apague jobs,
mensagens nem derivações. Em rollback de código, mantenha as novas tabelas/colunas e use `git revert`
revisado. Mensagens já reprocessadas continuam auditáveis e o feed público permanece compatível.
