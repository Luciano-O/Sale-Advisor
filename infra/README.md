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
