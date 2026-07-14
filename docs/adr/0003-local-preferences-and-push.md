# ADR 0003: preferências locais e push data-only

- Status: aceita
- Data: 2026-07-14

## Decisão

Manter preferências finas e cache em SQLite no aparelho. O backend recebe somente categoria ampla
e label mínimo. Push transmite apenas `offerId`; o app busca, filtra e cria a notificação local.
O provider fake é padrão e FCM é habilitado apenas com credenciais explícitas.

## Consequências

Feed, cache e eventos continuam operando sem push. Development build Expo é requisito para o
aceite de push Android; nenhuma credencial Apple faz parte do MVP.
