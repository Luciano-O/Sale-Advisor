# Infraestrutura local

`compose.yaml` inicia PostgreSQL e Redis com persistência e health checks.

```powershell
Copy-Item .env.example .env
./infra/bootstrap.ps1
```

O script é idempotente para dependências e seeds. Para remover apenas o schema local em uma
instalação nova, use `pnpm db:rollback:local`; volumes não são apagados automaticamente.
