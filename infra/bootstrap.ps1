$ErrorActionPreference = "Stop"

if (-not (Test-Path .env)) {
  Copy-Item .env.example .env
}

docker compose -f infra/compose.yaml up -d --wait
corepack pnpm install
corepack pnpm db:migrate
corepack pnpm db:seed
