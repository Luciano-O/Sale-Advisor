# Infraestrutura local

`compose.yaml` inicia PostgreSQL e Redis de desenvolvimento com persistência e health checks.
`compose.e2e.yaml` pertence exclusivamente ao projeto `sale-advisor-e2e`, publica PostgreSQL em
`127.0.0.1:55432` e Redis em `127.0.0.1:56379` e usa somente armazenamento efêmero.

```powershell
Copy-Item .env.example .env
./infra/bootstrap.ps1
```

O bootstrap valida Node/pnpm, instala com lockfile congelado, sobe Docker, aplica migrations e seed,
nessa ordem. O rollback destrutivo existe apenas para o banco E2E isolado e falha antes de executar
SQL quando ambiente, banco ou portas divergem da configuração exclusiva.

## Baseline de produção portátil

`compose.production.yaml` constrói e executa API, worker e migrations a partir do `Dockerfile` da
raiz. PostgreSQL e Redis não publicam portas, migrations são one-shot e nenhum seed é executado.
As variáveis obrigatórias ficam em um arquivo local baseado em `.env.production.example`; valores
reais nunca devem ser commitados.

```powershell
Copy-Item .env.production.example .env.production
docker compose --env-file .env.production -f infra/compose.production.yaml up -d --build --wait
```

A API fica vinculada a `127.0.0.1` por padrão, pronta para ser exposta por um reverse proxy com TLS
no host. Consulte `docs/production-baseline-runbook.md` para validação, rollback e operação.
