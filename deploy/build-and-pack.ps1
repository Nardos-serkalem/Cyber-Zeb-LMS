# Run on your Windows PC.
# Packs Docker source so the VPS can rebuild web + api with the latest updates.
#
# Usage:
#   deploy\build-and-pack.cmd

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$staging = Join-Path $Root "deploy\.release-staging"
$zipPath = Join-Path $Root "deploy\berana-release.zip"

Write-Host "=== Pack Docker source (one zip) ===" -ForegroundColor Yellow

if (Test-Path $staging) {
    Remove-Item $staging -Recurse -Force
}
New-Item -ItemType Directory -Path $staging | Out-Null

$excludeDirs = @(
    "node_modules",
    "dist",
    ".git",
    ".venv",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    "tests",
    "agent-transcripts",
    ".release-staging"
)
$excludeFiles = @(
    ".env",
    ".env.local",
    "backend\.env",
    "*.db",
    "*.pyc",
    "*.pyo",
    "berana-release.zip"
)

robocopy $Root $staging /E /NFL /NDL /NJH /NJS /nc /ns /np `
    /XD $excludeDirs `
    /XF $excludeFiles | Out-Null

if ($LASTEXITCODE -gt 7) {
    Write-Host "Failed to copy project files." -ForegroundColor Red
    exit 1
}

Remove-Item "$staging\deploy\.release-staging" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$staging\deploy\berana-release.zip" -Force -ErrorAction SilentlyContinue
Remove-Item "$staging\deploy\certs" -Recurse -Force -ErrorAction SilentlyContinue

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}
Compress-Archive -Path "$staging\*" -DestinationPath $zipPath -Force

$sizeMb = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Write-Host "Created: $zipPath ($sizeMb MB)" -ForegroundColor Green
Write-Host ""
Write-Host "On the VPS:" -ForegroundColor Cyan
Write-Host "  1. Unzip over the project folder"
Write-Host "  2. Put Zoom keys in the project-root .env"
Write-Host "  3. ./deploy/vps-docker.sh --ip YOUR_VPS_IP"
