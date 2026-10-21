# ADR 0007: deploy em VPS de host único para o MVP pessoal

- Status: aceita
- Data: 2026-10-21
- Suspende: ADR 0006 (Railway)

## Contexto

O MVP passou a ser de uso pessoal: um único usuário, APK instalado direto, sem Play Store. O que
mais demora para existir é o histórico de preços, então a coleta do Telegram precisa rodar 24/7
o quanto antes. O Railway (ADR 0006) foi preparado, mas nunca validado, e cobra por serviço: cinco
processos permanentes (Postgres, Redis, API, worker e admin) mais volumes.

A baseline portátil (`infra/compose.production.yaml`) já executa API, worker, migrations,
PostgreSQL e Redis em um host, mas deixa de fora HTTPS, o admin e o backup. A API exige CORS com
origem HTTPS em produção, e o app mobile precisa alcançar a API por HTTPS.

## Decisão

Rodar tudo em uma VPS Ubuntu 24.04 com Docker Compose, combinando `compose.production.yaml` com
um override `infra/compose.vps.yaml` que adiciona:

- **Caddy** como único serviço publicado (80/443), com certificados automáticos do Let's Encrypt
  para `api.<domínio>` e `admin.<domínio>`;
- **admin** compilado com `VITE_API_URL=https://api.<domínio>`, reaproveitando
  `infra/railway/admin.Dockerfile` e o Nginx não-root;
- **backup** com `pg_dump` diário em uma pasta do host, mantendo 7 dias.

A API deixa de publicar a porta 3000 no host, passa a confiar em um proxy
(`TRUST_PROXY_HOPS=1`) e aceita CORS apenas do domínio do admin. `DATABASE_POOL_MAX` limita as
conexões por pool, porque API e worker abrem vários pools no mesmo PostgreSQL.

O build acontece na própria VPS a partir do repositório (`git pull` e `up --build`). Não há
registry nem CI de deploy.

## Consequências

- Custo fixo baixo e previsível, com uma única máquina para operar.
- Sem alta disponibilidade: queda da VPS interrompe coleta, API e push. A recuperação de
  mensagens após restart (fase 0) cobre quedas curtas do worker.
- O backup fica no mesmo disco até ser copiado para fora; o runbook exige a cópia e um ensaio
  de restauração.
- O build na VPS consome CPU e memória; a máquina precisa de pelo menos 2 vCPU e 4 GB.
- Os arquivos do Railway continuam no repositório, sem uso, e podem ser retomados reabrindo o
  ADR 0006.

## Compatibilidade, migration e rollback

Não há mudança de schema. As migrations continuam rodando no serviço `migrate` antes de API e
worker. `DATABASE_POOL_MAX` é opcional (padrão 10), então os demais ambientes não mudam.

Rollback de código: `git checkout` da revisão anterior na VPS e `up -d --build --wait`. Rollback
de dados: restaurar um dump em um banco separado antes de trocar `DATABASE_URL`, nunca sobre o
banco em uso.

## Alternativas consideradas

- Manter o Railway: rejeitado pelo custo por serviço para um único usuário e por nunca ter sido
  validado.
- Expor a API sem domínio, só por IP: rejeitado porque o app mobile e o CORS do admin exigem HTTPS.
- Tailscale no lugar de HTTPS público: rejeitado porque o push e o feed dependeriam de a VPN do
  celular estar sempre ativa.
