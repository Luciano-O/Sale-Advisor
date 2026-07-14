# Worker

Worker NestJS standalone com quatro filas BullMQ persistidas no Redis:

```text
parse -> consolidate -> score -> notify
```

O dispatcher lê a outbox PostgreSQL em ordem cronológica e publica jobs determinísticos. Cada job
tem cinco tentativas com backoff exponencial. A consolidação usa advisory locks, parses são
versionados e replay não duplica menções, snapshots, scores ou entregas.

`NOTIFICATION_PROVIDER=fake` é o padrão. Para FCM, configure `NOTIFICATION_PROVIDER=fcm` e
`GOOGLE_APPLICATION_CREDENTIALS`; o payload é data-only e contém somente `offerId`.

```powershell
pnpm --filter @sale-advisor/worker dev
```
