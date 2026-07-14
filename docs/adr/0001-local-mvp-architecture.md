# ADR 0001: arquitetura da fatia vertical local

- Status: aceita
- Data: 2026-07-14

## Decisão

Usar monorepo pnpm com domínio independente, contratos Zod, PostgreSQL/Drizzle, Redis/BullMQ,
API e worker NestJS, admin React/Vite e mobile Expo. O pipeline preserva mensagens brutas,
parses versionados, menções e scores auditáveis. Telegram fica explicitamente fora do MVP.

## Consequências

O ambiente local depende de Docker Desktop. Apps compartilham somente contratos e pacotes de
domínio/banco, não detalhes internos de frameworks. Mudanças de schema exigem migration.
