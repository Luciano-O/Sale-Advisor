# Sale Advisor

Monorepo para um app de monitoramento de promoções. O MVP local foca em placas de vídeo e usa
cadastro manual/importação JSON; integração com Telegram não faz parte desta versão.

## Estrutura

```text
apps/api      Backend HTTP
apps/worker   Parsing, dedupe, scoring e notificações
apps/mobile   App Android-first
apps/admin    Painel interno
packages      Domínio, contratos, banco e código compartilhado
infra         Infraestrutura local
docs          Decisões arquiteturais
```

## Ambiente local

Requisitos: Node.js 20+, pnpm 10 e Docker Desktop.

```powershell
Copy-Item .env.example .env
./infra/bootstrap.ps1
pnpm dev
```

As decisões técnicas e práticas de desenvolvimento estão em `AGENTS.md`.
