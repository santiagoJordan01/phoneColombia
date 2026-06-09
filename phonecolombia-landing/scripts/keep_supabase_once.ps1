<#
  scripts/keep_supabase_once.ps1

  Usage:
    powershell -File scripts/keep_supabase_once.ps1 -Url "https://mi-dominio.com"
  Or set environment variable KEEP_ALIVE_URLS to a comma-separated list.
#>

param(
  [string]$Url = $env:KEEP_ALIVE_URLS
)

if (-not $Url) {
  Write-Error "Proporcione -Url o configure la variable de entorno KEEP_ALIVE_URLS"
  exit 1
}

$urls = $Url -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' }

foreach ($u in $urls) {
  try {
    $resp = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 15
    Write-Output "$(Get-Date -Format o) PING $u -> $($resp.StatusCode)"
  } catch {
    Write-Output "$(Get-Date -Format o) ERROR ping $u -> $($_.Exception.Message)"
  }
}

Exit 0
