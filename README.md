# Sale Advisor

Monorepo para um app de monitoramento de promoções. O MVP local foca em placas de vídeo, aceita
cadastro manual/importação JSON e possui coleta opcional de grupos e canais do Telegram por uma
conta autorizada.

## Estrutura

```text
apps/api      Backend HTTP
apps/worker   Coleta Telegram, parsing, dedupe, scoring e notificações
apps/mobile   App Android-first
apps/admin    Painel interno
packages      Domínio, contratos, banco e código compartilhado
infra         Infraestrutura local
docs          Decisões arquiteturais
```

## Ambiente local

Requisitos: Node.js 24.x, pnpm 11.7.0 e Docker Desktop com backend Linux ativo.

```powershell
Copy-Item .env.example .env
powershell -ExecutionPolicy Bypass -File .\infra\bootstrap.ps1
pnpm dev
```

Use `pnpm run doctor` para validar a baseline local e `pnpm run doctor -- --android` para incluir
Java 21, Android SDK/API 36, build-tools 36 e um device ADB pronto. O `run` é obrigatório porque
pnpm 11.7 reserva `doctor` para um comando interno. `pnpm verify:baseline` executa o mesmo aceite
automatizado usado pela CI.

As decisões técnicas e práticas de desenvolvimento estão em `AGENTS.md`.
O passo a passo de homologação está em `docs/mvp-local-runbook.md`.
Para executar a baseline portátil em containers, use `docs/production-baseline-runbook.md`.
