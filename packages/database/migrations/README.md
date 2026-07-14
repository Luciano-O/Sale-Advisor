# Migrations

## 0000_secret_beast.sql

- Compatibilidade: migration inicial para banco PostgreSQL 17 vazio; não altera instalações
  anteriores porque ainda não existe schema de produção.
- Impacto: cria enums, 17 tabelas, constraints e índices do MVP. Nenhum dado bruto é removido.
- Rollback local: `pnpm db:rollback:local` remove e recria somente o schema `public`; o comando é
  bloqueado quando `NODE_ENV=production`.
- Rollback fora do ambiente local: não automatizado. Preservar o banco e restaurar backup é
  preferível a apagar tabelas auditáveis.

Migrations posteriores devem ser aditivas e documentar compatibilidade, impacto e rollback.
