# Homologação local do MVP

Este runbook valida cadastro administrativo, persistência bruta, processamento assíncrono,
deduplicação, scoring, feed, notificação fake, eventos anônimos e app Android offline-first. A
coleta Telegram por conta autorizada é opcional e fica desabilitada no aceite automatizado.

## Pré-requisitos

- Windows 11 com virtualização habilitada no firmware.
- Docker Desktop com containers Linux ativos.
- Node.js 24.x e Corepack.
- pnpm 11.7.0, fixado no `packageManager` do repositório.
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
corepack pnpm run doctor
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

## Coleta Telegram com conta autorizada

O worker usa MTProto e não expõe endpoint HTTP de coleta. Obtenha `api_id` e `api_hash` em
`https://my.telegram.org` com a conta que já participa dos grupos/canais desejados. Carregue os
valores somente no terminal local e gere uma sessão:

```powershell
$env:TELEGRAM_API_ID="<api_id>"
$env:TELEGRAM_API_HASH="<api_hash>"
corepack pnpm --filter @sale-advisor/worker telegram:login
```

O comando solicita telefone, código e senha 2FA quando aplicável. Copie o
`TELEGRAM_SESSION=...` resultante para `.env`, que é ignorado pelo Git. A sessão concede acesso à
conta; não a envie a logs, tickets ou commits. Se houver exposição, encerre a sessão em
**Telegram > Configurações > Dispositivos** e gere outra.

Configure a allowlist e habilite a integração:

```dotenv
TELEGRAM_ENABLED=true
TELEGRAM_CHATS=@canal_publico,-1001234567890
TELEGRAM_INITIAL_HISTORY_LIMIT=100
```

Recarregue `.env` no PowerShell e inicie PostgreSQL, Redis e worker. Referências inválidas ou
credenciais ausentes falham imediatamente sem imprimir os segredos. Falhas transitórias de conexão
são retentadas com backoff de até 60 segundos.

No primeiro startup de cada chat, o worker enfileira as mensagens mais recentes até o limite
configurado, em ordem cronológica e com notificações desabilitadas. Depois, usa o maior ID
persistido como cursor: mensagens perdidas durante indisponibilidade e eventos ao vivo são
elegíveis para notificação. Corridas entre histórico e evento ao vivo são absorvidas pelo job ID e
pela constraint de idempotência.

### Smoke test do Telegram

Envie uma mensagem nova em um chat da allowlist, por exemplo com texto, preço e link de uma loja.
Confirme a preservação bruta, URLs e estado do pipeline:

```sql
select s.name, rm.external_id, rm.text, rm.supplied_url,
  rm.original_payload -> 'capturedUrls' as captured_urls, rm.status
from raw_messages rm
join sources s on s.id = rm.source_id
where s.kind = 'telegram'
order by rm.captured_at desc
limit 10;

select topic, aggregate_id, version, published_at, attempts, last_error
from outbox_events
where topic = 'raw-message.created'
order by created_at desc
limit 10;
```

O esperado é uma única `raw_message` por `peerId + messageId`, payload e URLs originais presentes,
uma única outbox versão 1 e progressão do status para `completed` ou `partial`. Repetir o mesmo job
não deve criar outra mensagem ou outbox.

## Verificação automatizada

```powershell
corepack pnpm verify:baseline
```

O aceite automatizado mantém `TELEGRAM_ENABLED=false`; CI não usa rede, conta ou credenciais reais
do Telegram. Os testes do coletor usam um cliente falso.

`test:e2e` primeiro gera os artefatos, executa a jornada Playwright do admin e depois sobe o Compose
efêmero `sale-advisor-e2e`, com PostgreSQL `sale_advisor_e2e` em `55432` e Redis em `56379`, para
uma jornada isolada na porta 3100. Essa jornada:

1. aplica migrations e seeds;
2. inicia API e worker reais com provider fake;
3. registra uma instalação Android e preferências amplas;
4. cadastra duas vezes a mesma mensagem e verifica idempotência;
5. espera parse, menção, snapshot, score e publicação no feed;
6. confirma que o detalhe público não expõe texto bruto;
7. envia duas vezes o mesmo evento anônimo e confirma uma única persistência;
8. confirma no PostgreSQL a entrega fake e a rastreabilidade da mensagem até a oferta.

O runner encerra API, worker, containers e qualquer volume temporário no bloco de limpeza, inclusive
quando a jornada falha. O Compose e os volumes de desenvolvimento nunca são usados pelo E2E.

## Aceite manual no Android

Valide requisitos, crie (se necessário) e inicie o AVD padronizado, depois gere e instale o
development build:

```powershell
corepack pnpm android:prepare
corepack pnpm run doctor -- --android
$env:EXPO_PUBLIC_API_URL="http://10.0.2.2:3000"
corepack pnpm --filter @sale-advisor/mobile android
```

Com duas ofertas existentes no feed, use o deep link apenas do development build para exercitar o
mesmo `handleOfferPush` usado pelo transporte:

```powershell
adb shell am start -a android.intent.action.VIEW -d "saleadvisor://debug-notification"
adb shell am start -a android.intent.action.VIEW -d "saleadvisor://debug-notification?offerId=<id-filtrado>"
adb shell am start -a android.intent.action.VIEW -d "saleadvisor://debug-notification?offerId=<id-relevante>"
adb shell am start -a android.intent.action.VIEW -d "saleadvisor://debug-notification?offerId=<id-relevante>"
```

Os resultados esperados, mostrados no app, são `invalid`, `filtered`, `shown` e `duplicate`. Não
existe endpoint HTTP de debug e builds de produção ignoram a rota.

### Registro da matriz Android

Execução de 28/07/2026 no AVD `SaleAdvisor_API_36`, API 36, build-tools 36.0.0 e development build
compilado com `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000`. Os quatro deep links retornaram, em ordem,
`invalid`, `filtered`, `shown` e `duplicate`.

| Item                                            | Resultado | Evidência                                                                                 |
| ----------------------------------------------- | --------- | ----------------------------------------------------------------------------------------- |
| Criação e registro do `installation_id`         | Aprovado  | App e PostgreSQL registraram `3fe8f039-5ed2-4230-b994-3e3fb25c8f2c`                       |
| Carregamento e atualização do feed              | Aprovado  | Três cards às 05:25; ofertas RTX 4060/Kabum e RX 7600/Pichau incluídas                    |
| Cache disponível sem rede                       | Aprovado  | API parada às 05:34; banner offline e card RTX 4060 permaneceram visíveis                 |
| Persistência das preferências após reiniciar    | Aprovado  | Nível `normal`, Pichau bloqueada e oferta oculta persistiram após `force-stop`/cold start |
| Bloqueio de loja/marca e ocultação local        | Aprovado  | `pichau.com.br`, `NVIDIA` e oferta `a768298f-008b-493a-861a-54cc9eaed31b` validados       |
| Notificação relevante exibida uma única vez     | Aprovado  | Oferta `a768298f-008b-493a-861a-54cc9eaed31b`: `shown`, depois `duplicate`                |
| Toque abre o detalhe correto                    | Aprovado  | Notificação abriu RTX 4060, Kabum, R$ 1.899,00                                            |
| Eventos offline reenviados quando a API retorna | Aprovado  | `pending_events`: 2 → 0; `anonymous_events` no backend: 11 → 14 após atualizar            |

O APK debug local é gerado em `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`.
Diretórios nativos gerados continuam ignorados pelo Git.

## Migrations e recuperação

A compatibilidade, impacto e rollback de cada migration ficam em
`packages/database/migrations/README.md`. `corepack pnpm db:rollback:local` recria somente o schema
`public` do banco E2E e limpa o histórico interno de migrations do Drizzle. O comando exige
`NODE_ENV=test`, banco terminado em `_e2e`, PostgreSQL em `127.0.0.1:55432` e Redis em
`127.0.0.1:56379`; qualquer divergência falha antes do SQL. O banco de desenvolvimento não possui
fluxo de rollback nesta baseline.

## Limites deste aceite

A coleta Telegram considera somente mensagens novas; edições e exclusões ainda não possuem modelo
de revisões. Não há download de mídia, login mobile, deploy público, publicação em loja, scraping
de páginas de lojas ou integração com encurtadores.
