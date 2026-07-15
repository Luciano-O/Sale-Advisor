# Homologação local do MVP

Este runbook valida a fatia vertical sem Telegram: cadastro administrativo, persistência bruta,
processamento assíncrono, deduplicação, scoring, feed, notificação fake, eventos anônimos e app
Android offline-first.

## Pré-requisitos

- Windows 11 com virtualização habilitada no firmware.
- Docker Desktop com containers Linux ativos.
- Node.js 20 ou superior e Corepack.
- pnpm 11.7, fixado no `packageManager` do repositório.
- Para Android: JDK 21, Android SDK/API 36 e um device ou emulador API 36.

Crie o ambiente local sem preencher credenciais FCM:

```powershell
Copy-Item .env.example .env
Get-Content .env | ForEach-Object {
  if ($_ -match '^(?<key>[A-Z0-9_]+)=(?<value>.*)$') {
    Set-Item "Env:$($Matches.key)" $Matches.value
  }
}
corepack enable
corepack pnpm install --frozen-lockfile
```

O bloco também carrega o `.env` no processo PowerShell atual. Repita esse carregamento ao abrir um
novo terminal antes de executar migrations ou iniciar as aplicações; o bootstrap chamado com
`powershell -ExecutionPolicy Bypass -File .\infra\bootstrap.ps1` já faz isso automaticamente.

`NOTIFICATION_PROVIDER=fake` é o modo de aceite. `GOOGLE_APPLICATION_CREDENTIALS` pode permanecer
vazio; FCM real é opcional.

## Banco, Redis e aplicações

```powershell
docker compose -f infra/compose.yaml up -d --wait
corepack pnpm db:migrate
corepack pnpm db:seed
corepack pnpm dev
```

O admin usa a chave de `.env` em `x-admin-key`; a interface a mantém apenas em
`sessionStorage`. API, admin e mobile usam respectivamente as portas/configurações declaradas em
`.env` e nos scripts de cada workspace.

## Verificação automatizada

```powershell
corepack pnpm lint
corepack pnpm test
corepack pnpm typecheck
corepack pnpm build
corepack pnpm db:migrate
corepack pnpm test:e2e
```

`test:e2e` primeiro gera os artefatos, executa a jornada Playwright do admin e depois sobe
PostgreSQL/Redis para uma jornada isolada na porta 3100. Essa jornada:

1. aplica migrations e seeds;
2. inicia API e worker reais com provider fake;
3. registra uma instalação Android e preferências amplas;
4. cadastra duas vezes a mesma mensagem e verifica idempotência;
5. espera parse, menção, snapshot, score e publicação no feed;
6. confirma que o detalhe público não expõe texto bruto;
7. envia duas vezes o mesmo evento anônimo e confirma uma única persistência;
8. confirma no PostgreSQL a entrega fake e a rastreabilidade da mensagem até a oferta.

O Compose permanece ativo para inspeção. Encerre apenas os containers com:

```powershell
docker compose -f infra/compose.yaml down
```

Os volumes persistentes não são removidos por esse comando.

## Aceite manual no Android

Configure a URL que o emulador usa para acessar o host e gere um development build:

```powershell
$env:EXPO_PUBLIC_API_URL="http://10.0.2.2:3000"
corepack pnpm --filter @sale-advisor/mobile android
```

Valide no device/emulador:

- primeira abertura gera e registra um `installation_id`;
- feed carrega e continua visível com rede desligada;
- preferências permanecem após fechar e reabrir o app;
- bloquear loja, marca ou ocultar oferta remove o item localmente;
- um payload data-only com `offerId` relevante cria notificação local e abre o detalhe correto;
- eventos acumulados sem rede são reenviados quando a API volta.

O APK debug local é gerado em `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`.
Diretórios nativos gerados continuam ignorados pelo Git.

## Migrations e recuperação

A compatibilidade, impacto e rollback de cada migration ficam em
`packages/database/migrations/README.md`. `corepack pnpm db:rollback:local` recria somente o schema
`public`, limpa o histórico interno de migrations do Drizzle e é bloqueado em produção. Dados
persistidos em volumes devem ser copiados antes de qualquer rollback destrutivo local.

## Limites deste aceite

O MVP não instala biblioteca, credencial ou coletor Telegram; `telegram` existe apenas como valor
reservado no modelo para compatibilidade futura e em fixtures de normalização de tracking. Não há
login mobile, deploy público, publicação em loja, scraping ou integração com encurtadores.
