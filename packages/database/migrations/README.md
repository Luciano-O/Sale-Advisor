# Migrations

## 0000_secret_beast.sql

- Compatibilidade: migration inicial para banco PostgreSQL 17 vazio; não altera instalações
  anteriores porque ainda não existe schema de produção.
- Impacto: cria enums, 17 tabelas, constraints e índices do MVP. Nenhum dado bruto é removido.
- Rollback local: `pnpm db:rollback:local` remove e recria o schema `public` e limpa somente a
  tabela interna `drizzle.__drizzle_migrations`, permitindo reaplicar as migrations; o comando é
  bloqueado quando `NODE_ENV=production`.
- Rollback fora do ambiente local: não automatizado. Preservar o banco e restaurar backup é
  preferível a apagar tabelas auditáveis.

Migrations posteriores devem ser aditivas e documentar compatibilidade, impacto e rollback.

## 0001_plain_tinkerer.sql

- Compatibilidade: aditiva; `input_hash` é nullable para que scores já existentes permaneçam
  válidos durante a atualização.
- Impacto: novos scores recebem um hash determinístico e um índice único impede duplicação por
  replay. Mensagens, menções, snapshots e scores legados não são alterados ou removidos.
- Rollback: remover o índice `offer_scores_input_unique` e a coluna `input_hash`; a aplicação deve
  ser revertida no mesmo deploy para não tentar gravar a coluna ausente.
