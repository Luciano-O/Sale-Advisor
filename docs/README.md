# Docs

Deploy atual: `vps-runbook.md` publica o MVP pessoal em uma VPS com Docker Compose, HTTPS,
backup e coleta do Telegram 24/7 (ADR 0007). O deploy no Railway (`railway-deployment-runbook.md`,
ADR 0006) está suspenso.

Documentação técnica do Sale Advisor.

Use `docs/adr` para decisões arquiteturais relevantes.

- `mvp-local-runbook.md`: inicialização, jornada E2E, Android e matriz de aceite do MVP.
- `releases/v0.1.0-local.1.md`: escopo, evidências e limitações da primeira entrega local.
- `releases/v0.2.0-local.1.md`: coleta Telegram opcional, segurança da sessão e homologação.
- `reports/`: relatórios agregados do parser (`pnpm report:parser -- --source=telegram`), sem
  texto, preço ou URL. `2026-10-21-parser-baseline.md` é a linha de base da fase 1 e
  `2026-10-21-phase3-resolver-taxonomy.md` mede o resolvedor v2 e a taxonomia ampliada.

Fixtures reais anonimizadas ficam em `apps/worker/fixtures/telegram-real-messages.json` e são
geradas por `pnpm --filter @sale-advisor/worker export:fixtures`. O campo `baseline` registra a
saída do parser no momento da exportação; não é rótulo revisado.
