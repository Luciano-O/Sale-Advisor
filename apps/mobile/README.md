# Mobile

App Android-first em Expo SDK 57 com Expo Router e SQLite local.

O app cria uma instalação anônima, mantém feed e preferências offline, filtra ofertas no
aparelho, persiste eventos para retry e transforma push data-only (`offerId`) em notificação
local somente após aplicar os filtros locais.

Quando a API e o cache ainda não estão disponíveis, a primeira execução exibe ofertas
demonstrativas claramente identificadas. Elas permitem validar navegação, detalhes, filtros e
persistência local no APK; uma resposta da API substitui esse conteúdo automaticamente.

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

## Alertas

Um canal do Android por rótulo: `offers-boa` (sem som), `offers-muito-boa` (com som) e
`offers-excepcional` (por cima da tela, com som e vibração). Para testar sem FCM, em um build de
desenvolvimento:

```powershell
adb shell am start -a android.intent.action.VIEW -d "saleadvisor://debug-notification?offerId=<id>" com.saleadvisor.mobile
```

## Ícones

Os SVGs de `assets/brand` são a fonte. Os PNGs ao lado deles foram exportados uma vez, sem dependência
no projeto. Se um SVG mudar, exporte o PNG de novo no mesmo tamanho e gere um build nativo.
