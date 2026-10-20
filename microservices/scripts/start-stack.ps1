<#
.SYNOPSIS
  Start the local DLS microservices stack (Orders, Catalog, Payment, Notif, RabbitMQ, Postgres).

.DESCRIPTION
  Morning / pre-chat bootstrap: ensures Docker is running, creates missing .env files
  (fake Stripe/Resend, shared INTERNAL_JWT_SECRET), brings compose services up, waits
  for health, then prints endpoints and RabbitMQ topology.

  Does not rebuild images unless -Rebuild is passed (use that after Dockerfile/deps changes).

.PARAMETER Rebuild
  Run `docker compose up --build -d` instead of `up -d`.

.PARAMETER TimeoutSeconds
  Max seconds to wait for Docker daemon and for each service health check (default 180).

.EXAMPLE
  .\scripts\start-stack.ps1

.EXAMPLE
  .\scripts\start-stack.ps1 -Rebuild
#>
[CmdletBinding()]
param(
  [switch]$Rebuild,
  [int]$TimeoutSeconds = 180
)

$ErrorActionPreference = "Stop"

$ComposeDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$DockerDesktop = "C:\Program Files\Docker\Docker\Docker Desktop.exe"

function Write-Step([string]$Message) {
  Write-Host "`n=== $Message ===" -ForegroundColor Cyan
}

function Ensure-DockerDesktop {
  Write-Step "Docker daemon"
  try {
    docker info 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
      Write-Host "Docker is already running."
      return
    }
  } catch {}

  if (-not (Test-Path $DockerDesktop)) {
    throw "Docker Desktop not found at '$DockerDesktop'. Install Docker Desktop or start the daemon manually."
  }

  Write-Host "Starting Docker Desktop..."
  Start-Process $DockerDesktop | Out-Null

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      docker info 2>$null | Out-Null
      if ($LASTEXITCODE -eq 0) {
        Write-Host "Docker is ready."
        return
      }
    } catch {}
    Start-Sleep -Seconds 3
  }
  throw "Docker daemon did not become ready within ${TimeoutSeconds}s."
}

function New-SharedSecret {
  -join ((1..40) | ForEach-Object { "{0:x}" -f (Get-Random -Maximum 16) })
}

function Ensure-EnvFile {
  param(
    [string]$Path,
    [string]$Content
  )
  if (Test-Path $Path) {
    Write-Host "Keeping existing $Path"
    return
  }
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($Path, $Content.TrimStart() + "`n", $utf8)
  Write-Host "Created $Path"
}

function Ensure-EnvFiles {
  Write-Step "Env files"
  $secret = New-SharedSecret
  $ordersEnvPath = Join-Path $ComposeDir "orders\.env"
  $ordersSecret = $null
  if (Test-Path $ordersEnvPath) {
    $ordersSecret = (Select-String -Path $ordersEnvPath -Pattern '^INTERNAL_JWT_SECRET=(.+)$').Matches.Groups[1].Value
  }
  # Catalog must verify the token Orders already signs. Reuse that secret when the orders file exists.
  $catalogSecret = if ($ordersSecret) { $ordersSecret } else { $secret }

  Ensure-EnvFile -Path (Join-Path $ComposeDir "orders\.env") -Content @"
PORT=3000

DATABASE_URL=postgresql://orders:orders@localhost:5433/orders
RABBITMQ_URL=amqp://guest:guest@localhost:5672

CATALOG_URL=http://localhost:3002
INTERNAL_JWT_SECRET=$secret

# Flat shipping price in ore (300 DKK, as in the monolith)
SHIPPING_PRICE_MINOR=30000
"@

  Ensure-EnvFile -Path (Join-Path $ComposeDir "payments\.env") -Content @"
PORT=3006

RABBITMQ_URL=amqp://guest:guest@localhost:5672

ORDERS_URL=http://localhost:3000
INTERNAL_JWT_SECRET=$secret

PAYMENT_PROVIDER=fake
STRIPE_SECRET_KEY=sk_test_unused_with_fake
STRIPE_WEBHOOK_SECRET=whsec_unused_with_fake
"@

  Ensure-EnvFile -Path (Join-Path $ComposeDir "emails\.env") -Content @"
PORT=3007

RABBITMQ_URL=amqp://guest:guest@localhost:5672

MAILER=fake
RESEND_API_KEY=re_unused_with_fake
RESEND_FROM_EMAIL=onboarding@resend.dev
"@

  Ensure-EnvFile -Path (Join-Path $ComposeDir "catalog\.env") -Content @"
PORT=3002

DATABASE_URL=postgresql://catalog:catalog@localhost:5434/catalog
RABBITMQ_URL=amqp://guest:guest@localhost:5672

INTERNAL_JWT_SECRET=$catalogSecret
"@

  $ordersEnv = Join-Path $ComposeDir "orders\.env"
  $paymentsEnv = Join-Path $ComposeDir "payments\.env"
  $catalogEnv = Join-Path $ComposeDir "catalog\.env"
  if ((Test-Path $ordersEnv) -and (Test-Path $paymentsEnv)) {
    $ordersSecret = (Select-String -Path $ordersEnv -Pattern '^INTERNAL_JWT_SECRET=(.+)$').Matches.Groups[1].Value
    $paymentsSecret = (Select-String -Path $paymentsEnv -Pattern '^INTERNAL_JWT_SECRET=(.+)$').Matches.Groups[1].Value
    if ($ordersSecret -and $paymentsSecret -and ($ordersSecret -ne $paymentsSecret)) {
      Write-Host "WARNING: orders and payments INTERNAL_JWT_SECRET differ. Align them if service-to-service calls fail." -ForegroundColor Yellow
    }
  }
  if ((Test-Path $ordersEnv) -and (Test-Path $catalogEnv)) {
    $ordersJwt = (Select-String -Path $ordersEnv -Pattern '^INTERNAL_JWT_SECRET=(.+)$').Matches.Groups[1].Value
    $catalogJwt = (Select-String -Path $catalogEnv -Pattern '^INTERNAL_JWT_SECRET=(.+)$').Matches.Groups[1].Value
    if ($ordersJwt -and $catalogJwt -and ($ordersJwt -ne $catalogJwt)) {
      Write-Host "WARNING: orders and catalog INTERNAL_JWT_SECRET differ. Align them if reservation calls fail." -ForegroundColor Yellow
    }
  }
}

function Start-ComposeStack {
  Write-Step "docker compose up"
  Push-Location $ComposeDir
  try {
    if ($Rebuild) {
      Write-Host "Building and starting (this can take several minutes on first run)..."
      docker compose up --build -d
    } else {
      Write-Host "Starting existing images (pass -Rebuild after code/Dockerfile changes)..."
      docker compose up -d
    }
    if ($LASTEXITCODE -ne 0) {
      throw "docker compose up failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
}

function Wait-HttpOk {
  param(
    [string]$Name,
    [string]$Url
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
      if ($response.StatusCode -eq 200) {
        Write-Host "$Name OK  $Url  $($response.Content)"
        return
      }
    } catch {}
    Start-Sleep -Seconds 2
  }
  throw "$Name did not become healthy at $Url within ${TimeoutSeconds}s. Try: docker compose -f `"$ComposeDir\docker-compose.yml`" logs $Name"
}

function Wait-ServicesHealthy {
  Write-Step "Health checks"
  Wait-HttpOk -Name "orders"  -Url "http://localhost:3000/health"
  Wait-HttpOk -Name "catalog" -Url "http://localhost:3002/health"
  Wait-HttpOk -Name "payment" -Url "http://localhost:3006/health"
  Wait-HttpOk -Name "notif"   -Url "http://localhost:3007/health"
}

function Show-RabbitMqSummary {
  Write-Step "RabbitMQ"
  $cred = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("guest:guest"))
  $headers = @{ Authorization = "Basic $cred" }

  Write-Host "UI: http://localhost:15672  (guest / guest)"

  try {
    $exchanges = Invoke-RestMethod -Uri "http://localhost:15672/api/exchanges/%2F" -Headers $headers
    $named = $exchanges | Where-Object { $_.name -and -not $_.name.StartsWith("amq.") }
    Write-Host "`nExchanges:"
    $named | ForEach-Object { Write-Host ("  {0,-16} {1}" -f $_.name, $_.type) }

    $queues = Invoke-RestMethod -Uri "http://localhost:15672/api/queues" -Headers $headers
    Write-Host "`nQueues (messages / consumers):"
    $queues | Sort-Object name | ForEach-Object {
      Write-Host ("  {0,-32} {1,4} msg  {2} consumers" -f $_.name, $_.messages, $_.consumers)
    }
  } catch {
    Write-Host "Could not query RabbitMQ management API: $_" -ForegroundColor Yellow
  }
}

function Show-ComposePs {
  Write-Step "Containers"
  Push-Location $ComposeDir
  try {
    docker compose ps
  } finally {
    Pop-Location
  }
}

# --- main ---
Write-Host "DLS stack bootstrap"
Write-Host "Compose dir: $ComposeDir"

Ensure-DockerDesktop
Ensure-EnvFiles
Start-ComposeStack
Wait-ServicesHealthy
Show-ComposePs
Show-RabbitMqSummary

Write-Host "`nStack is ready. Orders reaches Catalog at http://catalog:3002 on the compose network." -ForegroundColor Green
Write-Host "Stop later with:  docker compose -f `"$ComposeDir\docker-compose.yml`" down"
exit 0
