# Worker

Worker NestJS standalone com coleta Telegram opcional e cinco filas BullMQ persistidas no Redis:

```text
Telegram -> telegram-ingest -> raw_messages + outbox -> parse -> consolidate -> score -> notify
```

O job `telegram-ingest` e o dispatcher da outbox usam IDs determinísticos. Cada job tem cinco
tentativas com backoff exponencial. A persistência bruta e a outbox são transacionais; a
consolidação usa advisory locks; e replay não duplica mensagens, menções, snapshots, scores ou
entregas.

`TELEGRAM_ENABLED=false` é o padrão. Quando habilitado, o worker exige `TELEGRAM_API_ID`,
`TELEGRAM_API_HASH`, `TELEGRAM_SESSION` e uma allowlist em `TELEGRAM_CHATS`. A API HTTP não participa
da coleta. Gere a sessão autorizada em um terminal local:

```powershell
pnpm --filter @sale-advisor/worker telegram:login
```

Trate `TELEGRAM_SESSION` como senha da conta: mantenha-a apenas em `.env` ignorado ou secret manager,
nunca em logs ou arquivos versionados.

`NOTIFICATION_PROVIDER=fake` é o padrão. Para FCM, configure `NOTIFICATION_PROVIDER=fcm` e
`GOOGLE_APPLICATION_CREDENTIALS`; o payload é data-only e contém somente `offerId`.

```powershell
pnpm --filter @sale-advisor/worker dev
```
