$ErrorActionPreference = "Stop"

Push-Location (Resolve-Path (Join-Path $PSScriptRoot ".."))
try {
  node scripts/preflight.mjs
  if ($LASTEXITCODE -ne 0) { throw "Preflight failed." }

  corepack pnpm install --frozen-lockfile
  if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed." }

  if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
  }

  Get-Content .env | ForEach-Object {
    if ($_ -match '^(?<key>[A-Z0-9_]+)=(?<value>.*)$') {
      Set-Item "Env:$($Matches.key)" $Matches.value
    }
  }

  docker compose -f infra/compose.yaml up -d --wait
  if ($LASTEXITCODE -ne 0) { throw "Docker services failed to start." }
  corepack pnpm db:migrate
  if ($LASTEXITCODE -ne 0) { throw "Database migrations failed." }
  corepack pnpm db:seed
  if ($LASTEXITCODE -ne 0) { throw "Database seed failed." }
} finally {
  Pop-Location
}
