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

Requisitos: Node.js 20+, pnpm 11.7 e Docker Desktop com backend Linux ativo.

```powershell
Copy-Item .env.example .env
powershell -ExecutionPolicy Bypass -File .\infra\bootstrap.ps1
pnpm dev
```

As decisões técnicas e práticas de desenvolvimento estão em `AGENTS.md`.
O passo a passo de homologação está em `docs/mvp-local-runbook.md`.
