# ADR 0002: outbox transacional e jobs idempotentes

- Status: aceita
- Data: 2026-07-14

## Decisão

Persistir alterações e eventos de outbox na mesma transação PostgreSQL. O dispatcher publica
jobs BullMQ com IDs determinísticos e payload mínimo. Consumidores registram versões e podem ser
reexecutados sem duplicar menções, snapshots, scores ou notificações.

## Consequências

Falhas após commit são recuperáveis por replay da outbox. A consolidação usa advisory locks em
fingerprints ordenadas para impedir ofertas duplicadas sob concorrência.
