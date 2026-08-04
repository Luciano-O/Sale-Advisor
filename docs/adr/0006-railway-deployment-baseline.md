# ADR 0006: baseline de deploy gerenciado no Railway

- Status: aceita
- Data: 2026-08-04

## Contexto

A baseline portatil existente executa API, worker, migrations, PostgreSQL e Redis com Docker
Compose em um unico host. O Railway nao preserva a semantica de `depends_on` do Compose e representa
cada processo persistente como um servico independente. API e worker tambem podem receber deploys
simultaneos do mesmo monorepo, o que permite duas tentativas concorrentes de migration.

O painel admin precisa conhecer a URL publica da API no momento do build Vite, enquanto banco,
Redis e worker nao devem receber exposicao publica. A coleta Telegram exige um worker permanente e
uma sessao tratada como segredo.

## Decisao

Usar cinco servicos no mesmo ambiente e regiao Railway:

- `Postgres` e `Redis` provisionados pelos templates oficiais, com volumes e rede privada;
- `api` e `worker` construidos a partir de um runtime Node compartilhado, mas iniciados por comandos
  independentes;
- `admin` compilado pelo Vite e servido por Nginx nao-root em um container proprio.

API e worker executam o mesmo migrator como pre-deploy. O migrator adquire um PostgreSQL advisory
lock de sessao antes de chamar o Drizzle e libera o lock em `finally`. Isso mantem migrations
idempotentes e serializadas mesmo quando pushes do GitHub disparam deploys independentes.

A API aceita `PORT` injetado pelo Railway, mantendo `API_PORT` com precedencia para compatibilidade.
Somente API e admin recebem dominios publicos. As URLs internas usam referencias de variaveis do
Railway, e credenciais administrativas e Telegram sao seladas. O Telegram inicia desabilitado e e
ativado apenas depois do smoke da infraestrutura, com historico inicial zero.

## Consequencias

- O Compose local e os targets `api`, `worker` e `migrate` continuam validos e portateis.
- API e worker constroem a mesma imagem, aumentando o trabalho de build, mas eliminando divergencia
  de artefatos entre os dois processos.
- A URL da API fica incorporada no bundle do admin; mudar dominio exige rebuild do admin.
- Uma replica por servico e US East reduzem custo e latencia para o MVP brasileiro, sem alta
  disponibilidade regional.
- Nenhum seed e executado automaticamente em staging ou producao.

## Compatibilidade, migration e rollback

Esta decisao nao altera endpoints HTTP nem o schema do produto. `PORT` e apenas uma nova entrada de
configuracao. As migrations existentes permanecem aditivas.

Em rollback, restaurar os deployments anteriores de API, worker e admin. Nao reverter nem apagar
colunas ja migradas. Se a coleta falhar, definir `TELEGRAM_ENABLED=false` e redeployar somente o
worker. Restauracao de banco usa backup do volume PostgreSQL e deve ser ensaiada antes da promocao
para producao.

## Alternativas consideradas

- Importar o Compose diretamente: rejeitado porque nao oferece a mesma ordenacao operacional e nao
  resolve os comandos distintos do monorepo.
- Um servico unico para API e worker: rejeitado por acoplar escalabilidade, healthcheck e falhas.
- Um servico permanente apenas para migrations: rejeitado porque adiciona coordenacao manual entre
  deploys independentes.
- Servir o admin pelo processo NestJS: rejeitado para manter frontend estatico desacoplado da API.
