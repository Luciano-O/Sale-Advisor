# Mobile

App Android-first em Expo SDK 57 com Expo Router e SQLite local.

O app cria uma instalação anônima, mantém feed e preferências offline, filtra ofertas no
aparelho, persiste eventos para retry e transforma push data-only (`offerId`) em notificação
local somente após aplicar os filtros locais.

```powershell
$env:EXPO_PUBLIC_API_URL="http://10.0.2.2:3000"
pnpm --filter @sale-advisor/mobile dev
```

Push remoto exige development build; ele não está disponível no Expo Go. Para gerar e instalar
localmente, configure Android Studio/SDK e execute:

```powershell
pnpm --filter @sale-advisor/mobile android
```

Sem credenciais FCM, feed, cache, filtros e retry de eventos continuam operando normalmente.
