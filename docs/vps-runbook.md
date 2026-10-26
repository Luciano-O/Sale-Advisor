# Runbook da VPS (MVP pessoal)

Publica API, worker, admin, PostgreSQL, Redis e backup em uma VPS Ubuntu 24.04 com Docker
Compose (ADR 0007). O HTTPS fica com o Apache do painel **Enhance**, que já ocupa 80/443 na VPS;
para um host sem servidor web, veja o apêndice "Caddy".

```text
internet → Apache/Enhance :443 ─┬─ api.<domínio>   → 127.0.0.1:3200 → api ─┬─ postgres (privado)
                                └─ admin.<domínio> → 127.0.0.1:3201 → admin └─ redis (privado) ← worker
                                                          backup → /var/backups/sale-advisor
```

O Sale Advisor usa PostgreSQL e Redis próprios em containers, sem publicar portas. Não altere os
serviços que já rodam no host (Apache, MariaDB, PostgreSQL e Redis do painel, e-mail, TeamSpeak,
outros apps).

## 1. Sites no Enhance (no painel)

1. Crie registros DNS `A` (e `AAAA`, se houver IPv6) para `api.<domínio>` e `admin.<domínio>`
   apontando para o IP da VPS.
2. No Enhance, crie um site para cada domínio e ative o SSL (Let's Encrypt).
3. Confirme que `https://api.<domínio>` e `https://admin.<domínio>` abrem a página padrão do
   Enhance com certificado válido.

## 2. Pré-requisitos no host

Comandos como `root` na VPS. Pule o que já existir:

```bash
docker compose version          # Docker Compose v2
git --version
free -h                         # swap configurado
ufw status | grep -E '^(80|443)'  # 80 e 443 liberados
ss -tln | grep -E ':(3200|3201) ' # deve voltar vazio: portas livres
```

Se faltar swap (com menos de 8 GB de RAM), crie 2 GB:

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

Se 3200 ou 3201 estiverem ocupadas, escolha outras e use-as em `API_HOST_PORT` e
`ADMIN_HOST_PORT` no passo 4.

## 3. Código

Crie uma chave só de leitura para o repositório:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/sale_advisor_deploy -N "" -C "sale-advisor-vps"
cat ~/.ssh/sale_advisor_deploy.pub
```

Cadastre a chave pública em **Settings > Deploy keys** do repositório, sem permissão de escrita.
Depois:

```bash
printf 'Host github.com\n  IdentityFile ~/.ssh/sale_advisor_deploy\n' >> ~/.ssh/config
git clone git@github.com:Luciano-O/Sale-Advisor.git /opt/sale-advisor
cd /opt/sale-advisor
```

## 4. Configuração

```bash
cp .env.vps.example .env.vps
chmod 600 .env.vps
mkdir -p /var/backups/sale-advisor
```

Edite `.env.vps`:

- `API_DOMAIN`, `ADMIN_DOMAIN`, `API_HOST_PORT` e `ADMIN_HOST_PORT`;
- senhas novas para `POSTGRES_PASSWORD`, `REDIS_PASSWORD` e `ADMIN_API_KEY`, geradas com
  `openssl rand -hex 32`, repetindo as duas senhas dentro de `DATABASE_URL` e `REDIS_URL`;
- `CORS_ALLOWED_ORIGINS=https://<ADMIN_DOMAIN>`;
- mantenha `TELEGRAM_ENABLED=false` e `NOTIFICATION_PROVIDER=fake` até o passo 8.

Atalho para os comandos seguintes:

```bash
sa() { docker compose --env-file .env.vps -f infra/compose.production.yaml -f infra/compose.vps.yaml "$@"; }
```

## 5. Proxy do Apache

Gere um include por site, com o domínio e a porta de loopback correspondentes:

```bash
infra/vps/render-apache-include.sh api.<domínio> 3200 > /etc/apache2/vhost_includes/api.<domínio>.conf
infra/vps/render-apache-include.sh admin.<domínio> 3201 > /etc/apache2/vhost_includes/admin.<domínio>.conf
apachectl configtest && systemctl reload apache2
```

O Enhance carrega `vhost_includes/<domínio>.conf` nos virtual hosts HTTP e HTTPS do site. O
include mantém a validação do Let's Encrypt, redireciona HTTP para HTTPS e faz o proxy para
`127.0.0.1`. Se `configtest` falhar, remova os dois arquivos e recarregue o Apache antes de
investigar; os outros sites não podem ficar fora do ar.

## 6. Primeira subida e smoke

```bash
sa up -d --build --wait
sa ps
curl -fsS https://<API_DOMAIN>/v1/health/ready
```

1. `sa ps` mostra `api`, `worker`, `admin`, `backup`, `postgres` e `redis` em execução, `migrate`
   encerrado com código 0, e só `127.0.0.1:3200` e `127.0.0.1:3201` publicados.
2. `/v1/health/ready` responde 200 com HTTPS válido.
3. Abra `https://<ADMIN_DOMAIN>`, informe a `ADMIN_API_KEY`, importe uma oferta controlada e
   confirme o status `completed` e a oferta em `https://<API_DOMAIN>/v1/offers`.
4. Rode `sa restart api worker` e repita o item 2.
5. Confira que nenhum segredo aparece em `sa logs --tail 200 api worker`.

**Traga para validação:** a saída de `sa ps` e o JSON de `/v1/health/ready`.

## 7. Backup e restauração

O serviço `backup` grava um dump por dia, depois das migrations, e apaga os de mais de 7 dias:

```bash
ls -lh /var/backups/sale-advisor
sa logs backup --tail 5
```

**Cópia externa (na sua máquina),** pelo menos uma vez por semana:

```bash
scp 'root@<ip-da-vps>:/var/backups/sale-advisor/*.dump' ./sale-advisor-backups/
```

**Ensaio de restauração** (obrigatório antes de confiar nos dados), em um banco separado:

```bash
latest=$(ls -t /var/backups/sale-advisor/*.dump | head -1)
sa exec -T postgres sh -c 'createdb -U "$POSTGRES_USER" sale_advisor_restore'
sa exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d sale_advisor_restore' < "$latest"
sa exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d sale_advisor_restore -Atc "select count(*) from raw_messages"'
sa exec -T postgres sh -c 'dropdb -U "$POSTGRES_USER" sale_advisor_restore'
```

**Traga para validação:** o nome do dump e a contagem de `raw_messages` restaurada.

## 8. Coleta do Telegram 24/7

A VPS precisa de uma **sessão própria**: não reutilize a do `.env` local.

1. **Na sua máquina**, gere uma sessão nova com
   `pnpm --filter @sale-advisor/worker telegram:login`, informando `TELEGRAM_API_ID` e
   `TELEGRAM_API_HASH` no ambiente. O valor impresso é um segredo; não o envie por chat.
2. **Na sua máquina**, pare qualquer worker local com Telegram ligado. Só a VPS deve coletar.
3. Na VPS, preencha no `.env.vps`: `TELEGRAM_ENABLED=true`, `TELEGRAM_API_ID`,
   `TELEGRAM_API_HASH`, `TELEGRAM_SESSION` e `TELEGRAM_CHATS`. Mantenha
   `TELEGRAM_INITIAL_HISTORY_LIMIT=1000`: como o banco está vazio, o histórico inicial é importado
   sem notificar e alimenta o histórico de preços.
4. Recrie só o worker e acompanhe:

```bash
sa up -d --wait worker
sa logs -f worker
```

**Verificação de 48 horas:**

```bash
sa exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "
  select role, state, heartbeat_at from collector_instances order by heartbeat_at desc limit 1;
  select count(*), max(captured_at) from raw_messages;
  select status, count(*) from raw_messages group by 1;
  select count(*) from outbox_events where published_at is null;"'
```

O coletor deve estar `active/healthy`, `max(captured_at)` deve acompanhar a última mensagem do
canal e a outbox pendente deve voltar a 0. Depois de um `sa restart worker`, as mensagens
publicadas durante a parada também devem aparecer.

**Traga para validação:** essa saída logo após ativar e de novo 48 horas depois.

## 8a. Push real (Firebase Cloud Messaging)

A chave de serviço do Firebase é um segredo: copie-a por `scp`, nunca por chat ou Git.

```bash
mkdir -p /opt/sale-advisor/secrets
# na sua máquina: scp <chave>.json root@<ip-da-vps>:/opt/sale-advisor/secrets/firebase-service-account.json
chown root:1000 /opt/sale-advisor/secrets/firebase-service-account.json
chmod 640 /opt/sale-advisor/secrets/firebase-service-account.json
```

O worker roda como o usuário `node` (uid 1000), por isso o grupo 1000. Defina
`FIREBASE_CREDENTIALS_FILE=/opt/sale-advisor/secrets/firebase-service-account.json` no `.env.vps`
e passe a incluir `infra/compose.fcm.yaml` no atalho:

```bash
sa() { docker compose --env-file .env.vps -f infra/compose.production.yaml -f infra/compose.vps.yaml -f infra/compose.fcm.yaml "$@"; }
sa up -d --wait worker
```

Para voltar ao provedor `fake`, remova `compose.fcm.yaml` do atalho e recrie o worker.

## 9. Monitoramento

Cadastre um monitor HTTP gratuito (UptimeRobot, Better Stack ou similar) para
`https://<API_DOMAIN>/v1/health/ready` a cada 5 minutos, com alerta por e-mail. O healthcheck do
Compose só reinicia containers; não avisa você.

## 10. Atualização e rollback

```bash
cd /opt/sale-advisor
git pull --ff-only
sa up -d --build --wait
```

As migrations rodam antes de API e worker. Para voltar uma versão, use `git checkout <commit>` e
repita `sa up -d --build --wait`; as migrations são aditivas e o código anterior ignora colunas
novas. Em falha do Telegram, defina `TELEGRAM_ENABLED=false` e rode `sa up -d --wait worker`.
Para tirar o site do ar sem parar a stack, remova o include do Apache e recarregue-o.

Nunca use `sa down --volumes` neste ambiente: apaga o banco. Para parar sem perder dados, use
`sa down`.

## Apêndice: Caddy, para um host sem servidor web

Em uma VPS sem nada escutando em 80/443, o profile `caddy` assume o HTTPS com certificados
automáticos. Pule o passo 5, libere 80/tcp, 443/tcp e 443/udp no firewall e use
`sa --profile caddy up -d --build --wait` em todos os comandos de subida.
