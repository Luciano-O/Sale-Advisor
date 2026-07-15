$ErrorActionPreference = "Stop"

if (-not (Test-Path .env)) {
  Copy-Item .env.example .env
}

Get-Content .env | ForEach-Object {
  if ($_ -match '^(?<key>[A-Z0-9_]+)=(?<value>.*)$') {
    Set-Item "Env:$($Matches.key)" $Matches.value
  }
}

docker compose -f infra/compose.yaml up -d --wait
corepack pnpm install
corepack pnpm db:migrate
corepack pnpm db:seed
