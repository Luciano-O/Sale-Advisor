# Runbook da VPS (MVP pessoal)

Publica API, worker, admin, PostgreSQL, Redis, HTTPS e backup em uma VPS Ubuntu 24.04 com
Docker Compose (ADR 0007). Os comandos rodam na VPS, como um usuário com `sudo`, salvo quando
indicado "na sua máquina".

```text
internet → Caddy :443 ─┬─ api.<domínio>   → api:3000 ─┬─ postgres (privado)
                       └─ admin.<domínio> → admin:8080 └─ redis (privado) ← worker
                                           backup → /var/backups/sale-advisor
```

## 1. Pré-requisitos

- VPS Ubuntu 24.04 com pelo menos 2 vCPU, 4 GB de RAM e 40 GB de disco, acessível por SSH com
  chave.
- Dois registros DNS `A` (e `AAAA`, se houver IPv6) apontando para o IP da VPS:
  `api.<domínio>` e `admin.<domínio>`. Confirme com `dig +short api.<domínio>` antes do passo 6;
  sem DNS correto o Caddy não consegue emitir certificados.

## 2. Sistema e firewall

```bash
sudo apt update && sudo apt -y upgrade
sudo apt -y install unattended-upgrades git curl
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw --force enable
```

Com 4 GB de RAM, adicione 2 GB de swap para o build das imagens:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

O Docker publica portas por fora do `ufw`. Por isso o compose da VPS publica apenas o Caddy;
PostgreSQL, Redis, API e admin ficam na rede interna.

## 3. Docker Engine e Compose

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt update
sudo apt -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
```

Saia e entre de novo na sessão SSH e confirme com `docker compose version`.

## 4. Código

Crie uma chave só de leitura para o repositório:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/sale_advisor_deploy -N "" -C "sale-advisor-vps"
cat ~/.ssh/sale_advisor_deploy.pub
```

No GitHub, em **Settings > Deploy keys** do repositório, adicione a chave pública sem permissão de
escrita. Depois:

```bash
printf 'Host github.com\n  IdentityFile ~/.ssh/sale_advisor_deploy\n' >> ~/.ssh/config
git clone git@github.com:Luciano-O/Sale-Advisor.git ~/sale-advisor
cd ~/sale-advisor
```

## 5. Configuração

```bash
cp .env.vps.example .env.vps
chmod 600 .env.vps
sudo mkdir -p /var/backups/sale-advisor
```

Edite `.env.vps`:

- `API_DOMAIN`, `ADMIN_DOMAIN` e `ACME_EMAIL`;
- senhas novas para `POSTGRES_PASSWORD`, `REDIS_PASSWORD` e `ADMIN_API_KEY`, geradas com
  `openssl rand -hex 32`, repetindo as duas senhas dentro de `DATABASE_URL` e `REDIS_URL`;
- `CORS_ALLOWED_ORIGINS=https://<ADMIN_DOMAIN>`;
- mantenha `TELEGRAM_ENABLED=false` e `NOTIFICATION_PROVIDER=fake` até o passo 8.

Para não repetir os arquivos, defina um atalho na sessão:

```bash
sa() { docker compose --env-file .env.vps -f infra/compose.production.yaml -f infra/compose.vps.yaml "$@"; }
```

## 6. Primeira subida e smoke

```bash
sa up -d --build --wait
sa ps
curl -fsS https://<API_DOMAIN>/v1/health/ready
```

1. `sa ps` mostra `api`, `worker`, `admin`, `caddy`, `backup`, `postgres` e `redis` em execução e
   `migrate` encerrado com código 0.
2. `/v1/health/ready` responde 200 com HTTPS válido.
3. Abra `https://<ADMIN_DOMAIN>`, informe a `ADMIN_API_KEY`, importe uma oferta controlada e
   confirme o status `completed` e a oferta em `https://<API_DOMAIN>/v1/offers`.
4. Rode `sa restart api worker` e repita o item 2.
5. Confira que nenhum segredo aparece em `sa logs --tail 200 api worker caddy`.

**Traga para validação:** a saída de `sa ps` e o JSON de `/v1/health/ready`.

## 7. Backup e restauração

O serviço `backup` grava um dump por dia e apaga os de mais de 7 dias:

```bash
ls -lh /var/backups/sale-advisor
sa logs backup --tail 5
```

**Cópia externa (na sua máquina),** pelo menos uma vez por semana:

```bash
scp '<usuario>@<ip-da-vps>:/var/backups/sale-advisor/*.dump' ./sale-advisor-backups/
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

## 9. Monitoramento

Cadastre um monitor HTTP gratuito (UptimeRobot, Better Stack ou similar) para
`https://<API_DOMAIN>/v1/health/ready` a cada 5 minutos, com alerta por e-mail. O healthcheck do
Compose só reinicia containers; não avisa você.

## 10. Atualização e rollback

```bash
cd ~/sale-advisor
git pull --ff-only
sa up -d --build --wait
```

As migrations rodam antes de API e worker. Para voltar uma versão, use `git checkout <commit>` e
repita `sa up -d --build --wait`; as migrations são aditivas e o código anterior ignora colunas
novas. Em falha do Telegram, defina `TELEGRAM_ENABLED=false` e rode `sa up -d --wait worker`.

Nunca use `sa down --volumes` neste ambiente: apaga o banco. Para parar sem perder dados, use
`sa down`.
