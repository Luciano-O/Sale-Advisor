# API

API NestJS do MVP. Em execução normal usa PostgreSQL; testes HTTP usam um repositório em memória
com o mesmo contrato.

## Rotas públicas

- `GET /v1/health`
- `GET /v1/offers` e `GET /v1/offers/:id`
- `POST /v1/installations`
- `PUT /v1/installations/:id/push-target`
- `PUT /v1/installations/:id/notification-preferences`
- `POST /v1/events/batch`

## Rotas administrativas

- `POST /v1/admin/messages`
- `POST /v1/admin/imports`

Rotas administrativas exigem `x-admin-key`. O corpo JSON é limitado a 5 MB e o limite global é
de 120 requisições por minuto por endereço e rota.

```powershell
pnpm --filter @sale-advisor/api dev
```
