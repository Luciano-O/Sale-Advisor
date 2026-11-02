# API

API NestJS do MVP. Em execução normal usa PostgreSQL; testes HTTP usam um repositório em memória
com o mesmo contrato.

## Rotas públicas

- `GET /v1/health`
- `GET /v1/offers?sort=recent|discount`: ofertas ativas, por mais recentes (padrão) ou por maior
  desconto contra a mediana de 30 dias, com as sem histórico por último. O cursor só continua a
  ordenação que o gerou.
- `GET /v1/offers/:id`: também abre ofertas expiradas (`status: "expired"`), para pushes antigos.
  Toda oferta traz `history` com a mediana de 30 dias, a mínima de 90 dias e o desconto contra a
  mediana, `null` quando o histórico não basta.
- `GET /v1/catalog` e `GET /v1/stores` (lojas que o app pode bloquear)
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
