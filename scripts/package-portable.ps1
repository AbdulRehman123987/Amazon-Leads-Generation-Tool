# Builds dist\lead-scraper-portable.zip: the production build plus a portable
# Node.js and a start.bat, so the team runs it with a double-click — nothing to
# install. Run it with:  npm run package   (add -SkipBuild to reuse the last build)
#
# The zip contains a copy of .env (database password, API keys): hand it out
# inside the team only.
param([switch]$SkipBuild)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

if (-not (Test-Path ".env")) {
  throw ".env not found. The package needs your DATABASE_URL, AUTH_SECRET and API keys."
}

if (-not $SkipBuild) {
  Write-Host "Building the app..." -ForegroundColor Cyan
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
}
if (-not (Test-Path ".next\standalone\server.js")) {
  throw "No standalone build found (.next\standalone\server.js). Run again without -SkipBuild."
}

$dist = Join-Path $root "dist"
$pkg  = Join-Path $dist "lead-scraper"
$zip  = Join-Path $dist "lead-scraper-portable.zip"
if (Test-Path $pkg) { Remove-Item $pkg -Recurse -Force }
if (Test-Path $zip) { Remove-Item $zip -Force }
New-Item -ItemType Directory -Path (Join-Path $pkg "app"), (Join-Path $pkg "node") -Force | Out-Null

# robocopy: far faster than Copy-Item for node_modules, and copes with long paths.
# Exit codes below 8 mean success.
function Copy-Tree($from, $to) {
  robocopy $from $to /E /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy failed copying $from (exit $LASTEXITCODE)" }
}

Write-Host "Assembling the package..." -ForegroundColor Cyan
Copy-Tree ".next\standalone" (Join-Path $pkg "app")
# Next copies the whole .env into the standalone folder; the package ships one
# filtered .env (below) instead, loaded by start.bat.
Remove-Item (Join-Path $pkg "app\.env") -Force -ErrorAction SilentlyContinue
Copy-Tree ".next\static" (Join-Path $pkg "app\.next\static")
if (Test-Path "public") { Copy-Tree "public" (Join-Path $pkg "app\public") }

# The Node.js that is installed here, so the team doesn't need their own.
Copy-Item (Get-Command node).Source (Join-Path $pkg "node\node.exe")

# Only what the running app reads: not DIRECT_URL (migrations are run by the
# admin) and not the Docker-only POSTGRES_* settings.
$keep = '^(DATABASE_URL|AUTH_SECRET|API_KEY_SECRET|REQUIRE_OWN_API_KEYS|SCRAPE_DO_API_KEY|SEARCHAPI_API_KEY|HUNTER_API_KEY|GOOGLE_CSE_API_KEY|GOOGLE_CSE_CX)='
$lines = Get-Content ".env" | Where-Object { $_ -match $keep }
if (-not ($lines | Where-Object { $_ -match '^DATABASE_URL=.+' })) { throw "DATABASE_URL is empty in .env" }
if (-not ($lines | Where-Object { $_ -match '^AUTH_SECRET=.{32,}' })) { throw "AUTH_SECRET is missing or too short in .env (npm run user -- secret)" }
[IO.File]::WriteAllText((Join-Path $pkg ".env"), (($lines -join "`r`n") + "`r`n"))

Copy-Item "scripts\portable\start.bat" (Join-Path $pkg "start.bat")
Copy-Item "scripts\portable\README.txt" (Join-Path $pkg "README.txt")

Write-Host "Zipping..." -ForegroundColor Cyan
# bsdtar (built into Windows 10+) is much faster than Compress-Archive on thousands of small files.
tar.exe -a -c -f $zip -C $dist "lead-scraper"
if ($LASTEXITCODE -ne 0) {
  Write-Host "tar failed, falling back to Compress-Archive (slower)..." -ForegroundColor Yellow
  Compress-Archive -Path $pkg -DestinationPath $zip -Force
}

$mb = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Host ""
Write-Host "Done: $zip  ($mb MB)" -ForegroundColor Green
Write-Host "It contains your database password and API keys - share it inside the team only."
