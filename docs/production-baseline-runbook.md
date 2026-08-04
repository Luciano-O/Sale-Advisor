# Baseline de produção portátil

Este runbook cobre a execução da baseline das fases 1 e 2 em um único host. Cloud, registry,
domínio, TLS e staging permanecem fora deste escopo. PostgreSQL e Redis são privados na rede do
Compose; somente a API é vinculada ao host, em `127.0.0.1` por padrão.

## Pré-requisitos

- host Linux ou Docker Desktop com containers Linux;
- Docker Engine com Compose v2;
- espaço persistente para os volumes de PostgreSQL e Redis;
- reverse proxy com HTTPS antes de liberar acesso externo;
- backup externo dos volumes antes de upgrades.

## Configuração

Crie o arquivo local de ambiente e substitua todos os placeholders:

```powershell
Copy-Item .env.production.example .env.production
```

Regras obrigatórias:

- use senhas aleatórias e distintas para PostgreSQL, Redis e `ADMIN_API_KEY`;
- mantenha `CORS_ALLOWED_ORIGINS` somente com origins HTTPS;
- configure `TRUST_PROXY_HOPS` com a quantidade exata de proxies entre o cliente e a API;
- escolha `NOTIFICATION_PROVIDER=fake` para smoke sem push ou `fcm` para entrega real;
- mantenha `TELEGRAM_ENABLED=false` até fornecer credenciais e sessão fora do repositório;
- nunca versione `.env.production`, sessão Telegram ou credenciais Firebase.

O provider `fcm` usa Application Default Credentials. A credencial deve ser montada no container do
worker por um override privado e `GOOGLE_APPLICATION_CREDENTIALS` deve apontar para o caminho
interno somente leitura. O Compose versionado usa `fake` no exemplo para não depender de segredos.

## Build e aceite local

```powershell
corepack pnpm container:build
corepack pnpm container:smoke
```

O smoke usa um projeto Compose isolado, constrói os targets `api`, `worker` e `migrate`, aplica as
migrations em banco vazio, valida liveness/readiness, importa uma oferta e confirma sua publicação
no feed. Ao final, inclusive em falha, remove containers, rede e volumes temporários.

Antes de publicar uma revisão, execute:

```powershell
$env:CI='true'
corepack pnpm verify:baseline
corepack pnpm verify:production
```

## Inicialização

```powershell
docker compose --env-file .env.production -f infra/compose.production.yaml up -d --build --wait
```

A ordem é protegida pelo Compose:

1. PostgreSQL e Redis ficam saudáveis;
2. `migrate` executa uma vez e precisa terminar com código zero;
3. API e worker iniciam somente após a migration.

Não existe seed automático. API e worker rodam como usuário `node`, recebem SIGTERM via `init` e
usam os shutdown hooks da aplicação.

## Verificação operacional

```powershell
Invoke-RestMethod http://127.0.0.1:3000/v1/health/live
Invoke-RestMethod http://127.0.0.1:3000/v1/health/ready
docker compose --env-file .env.production -f infra/compose.production.yaml ps
docker compose --env-file .env.production -f infra/compose.production.yaml logs api worker
```

- `/v1/health/live` comprova que o processo HTTP está vivo, sem acessar dependências;
- `/v1/health/ready` verifica PostgreSQL e Redis e informa `outboxPending`;
- `/v1/health` continua como alias compatível da readiness;
- falhas de readiness retornam 503 sanitizado;
- logs são JSON e podem ser correlacionados por `correlationId`.

Health endpoints não consomem rate limit. As demais rotas compartilham contador Redis e retornam
429 com `Retry-After` ao exceder o limite, ou 503 se o Redis estiver indisponível.

## Atualização e rollback

1. gere backup externo do banco;
2. construa as novas imagens;
3. execute `migrate` e confirme código zero;
4. atualize API e worker;
5. valide readiness, logs e uma jornada controlada.

As migrations desta baseline são aditivas. O rollback operacional consiste em reverter API e
worker para as imagens anteriores, preservando as colunas novas. Em particular,
`notification_deliveries.attempts` não deve ser removida: o código antigo a ignora. Não execute
rollback destrutivo no banco de produção.

Para parar sem apagar dados:

```powershell
docker compose --env-file .env.production -f infra/compose.production.yaml down
```

Use `--volumes` somente no ambiente efêmero do smoke. Nos dados reais, essa opção remove os volumes
persistentes e exige restauração de backup.
