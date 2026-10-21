# Runbook de staging no Railway

Este runbook publica a baseline em um ambiente `staging`. Producao, dominio proprio, FCM e build do
app mobile ficam fora do procedimento.

## Topologia e regiao

Crie um environment `staging` e mantenha todos os servicos em **US East Metal (Virginia)**, com uma
replica:

```text
admin (publico) -> api (publica) -> Postgres (privado)
                                  -> Redis (privado) <- worker (privado)
```

Use exatamente os nomes `Postgres`, `Redis`, `api`, `worker` e `admin`. Nao gere dominio para
Postgres, Redis ou worker. Desabilite Serverless/App Sleep no worker.

## Provisionamento

1. No environment `staging`, adicione PostgreSQL e Redis pelos templates oficiais.
2. Crie tres servicos vazios chamados `api`, `worker` e `admin`.
3. Gere dominios Railway apenas para `api` e `admin`.
4. Conecte os tres servicos ao repositorio `Luciano-O/Sale-Advisor`, branch
   `codex/railway-deployment`.
5. Em **Config File Path**, use:
   - API: `/infra/railway/api.railway.json`;
   - worker: `/infra/railway/worker.railway.json`;
   - admin: `/infra/railway/admin.railway.json`.
6. Confirme US East em Settings > Scale > Regions antes de aplicar os staged changes.

Os arquivos de configuracao fixam o runtime Docker, comandos, pre-deploy, healthchecks, uma replica
e graceful shutdown. Nao configure Root Directory: o contexto de build deve continuar na raiz do
monorepo.

## Variaveis

Cadastre em `api` e `worker`:

```dotenv
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
LOG_LEVEL=info
```

Cadastre na API:

```dotenv
ADMIN_API_KEY=<valor-aleatorio-com-32-ou-mais-caracteres>
CORS_ALLOWED_ORIGINS=https://${{admin.RAILWAY_PUBLIC_DOMAIN}}
TRUST_PROXY_HOPS=1
RATE_LIMIT_MAX=120
RATE_LIMIT_WINDOW_SECONDS=60
```

Sele `ADMIN_API_KEY`. O Railway injeta `PORT`; nao crie `API_PORT` no staging.

Cadastre no admin:

```dotenv
PORT=8080
VITE_API_URL=https://${{api.RAILWAY_PUBLIC_DOMAIN}}
```

`VITE_API_URL` e lida como `ARG` durante o build. Nunca coloque `ADMIN_API_KEY` no admin.

Cadastre inicialmente no worker:

```dotenv
NOTIFICATION_PROVIDER=fake
TELEGRAM_ENABLED=false
TELEGRAM_INITIAL_HISTORY_LIMIT=0
WORKER_INSTANCE_ID=railway-staging-1
```

Nao importe automaticamente `.env`, `.env.production.example` ou segredos sugeridos pelo painel.

## Primeiro deploy e smoke

Primeiro aplique Postgres e Redis e aguarde ambos ficarem ativos. Depois aplique API, worker e
admin. A migration roda antes de API e worker e nao executa seed.

1. Confirme HTTP 200 em `/v1/health/live` e `/v1/health/ready` no dominio da API.
2. Abra o dominio do admin, informe a `ADMIN_API_KEY` e valide o dashboard.
3. Importe uma oferta controlada pelo admin e aguarde o status `completed`.
4. Confirme a oferta no feed e uma unica mencao consolidada.
5. Reinicie API e worker e repita readiness e consulta.
6. Revise logs e metricas; nenhum segredo deve aparecer.
7. Confirme novamente que apenas API e admin possuem dominios publicos.

## Ativacao controlada do Telegram

Depois do smoke, copie os valores locais sem imprimi-los e sele `TELEGRAM_API_HASH`,
`TELEGRAM_SESSION` e `TELEGRAM_CHATS`:

```dotenv
TELEGRAM_ENABLED=true
TELEGRAM_API_ID=<api-id>
TELEGRAM_API_HASH=<segredo-selado>
TELEGRAM_SESSION=<sessao-selada>
TELEGRAM_CHATS=<uma-allowlist-pequena>
TELEGRAM_INITIAL_HISTORY_LIMIT=0
```

Redeploye apenas o worker. Confirme nos logs que a sessao foi autorizada e a lideranca adquirida,
sem valores de credenciais. Aguarde uma unica mensagem nova de uma fonte permitida e valide
`raw_messages`, pipeline e feed pelo admin. Historico zero evita importacao retroativa.

## Custo, backup e observabilidade

- mantenha uma replica por servico e revise CPU/RAM apos o smoke;
- configure limite de gasto e alertas no projeto;
- mantenha worker e bancos ativos continuamente;
- antes de promover para producao, habilite backup PostgreSQL, realize uma restauracao de ensaio e
  documente RPO/RTO;
- use um monitor externo para `/v1/health/ready`, pois o healthcheck Railway cobre principalmente o
  momento do deploy.

## Rollback

1. Em falha Telegram, defina `TELEGRAM_ENABLED=false` e redeploye o worker.
2. Para regressao de codigo, use Rollback no deployment anterior de API, worker ou admin.
3. Preserve as migrations aditivas; codigo anterior ignora colunas novas.
4. Nao remova volumes nem recrie Postgres/Redis como forma de rollback.
5. Em perda de dados, interrompa ingestao e restaure o backup em um banco separado antes de trocar
   `DATABASE_URL`.

## Promocao futura

Somente depois do aceite completo, integre a branch em `codex/production-baseline`. A promocao para
producao deve usar environment separado, segredos proprios, backup habilitado e novo smoke. Nunca
copie automaticamente a sessao Telegram de staging entre environments.
