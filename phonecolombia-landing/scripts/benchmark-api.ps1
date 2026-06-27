# Benchmark GET endpoints per inventario module
$base = "http://127.0.0.1:8000/api"
$email = "admin@phonecolombia.com"
$password = "admin123"

function Measure-Get {
    param([string]$Path, [hashtable]$Headers, [int]$Runs = 3)
    $times = @()
    foreach ($i in 1..$Runs) {
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        try {
            $r = Invoke-WebRequest -Uri "$base$Path" -Headers $Headers -UseBasicParsing -TimeoutSec 30
            $sw.Stop()
            $times += [pscustomobject]@{ ms = $sw.ElapsedMilliseconds; status = $r.StatusCode; bytes = $r.RawContentLength }
        } catch {
            $sw.Stop()
            $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
            $times += [pscustomobject]@{ ms = $sw.ElapsedMilliseconds; status = $status; bytes = 0 }
        }
        Start-Sleep -Milliseconds 50
    }
    $ok = $times | Where-Object { $_.status -eq 200 }
    [pscustomobject]@{
        path = $Path
        min = ($ok | Measure-Object ms -Minimum).Minimum
        avg = [math]::Round(($ok | Measure-Object ms -Average).Average, 0)
        max = ($ok | Measure-Object ms -Maximum).Maximum
        bytes = ($ok | Select-Object -Last 1).bytes
        status = ($times | Select-Object -Last 1).status
    }
}

Write-Host "=== Login ===" -ForegroundColor Cyan
$loginSw = [System.Diagnostics.Stopwatch]::StartNew()
$loginBody = @{ email = $email; password = $password } | ConvertTo-Json
$login = Invoke-RestMethod -Uri "$base/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
$loginSw.Stop()
$token = $login.token
Write-Host "Login: $($loginSw.ElapsedMilliseconds) ms"
if (-not $token) { Write-Error "No token"; exit 1 }

$h = @{ Authorization = "Bearer $token"; Accept = "application/json" }

$endpoints = @(
    @{ module = "Auth"; path = "/auth/me" },
    @{ module = "Dashboard"; path = "/dashboard" },
    @{ module = "Inventario"; path = "/inventory" },
    @{ module = "Inventario"; path = "/inventory/products" },
    @{ module = "Inventario"; path = "/suppliers" },
    @{ module = "Inventario"; path = "/device-colors" },
    @{ module = "Inventario"; path = "/inventory/summary-by-model" },
    @{ module = "Ventas"; path = "/sales" },
    @{ module = "Ventas"; path = "/inventory?status=disponible" },
    @{ module = "Servicio tecnico"; path = "/service-tickets/workshops" },
    @{ module = "Servicio tecnico"; path = "/service-tickets" },
    @{ module = "Servicio tecnico (modal)"; path = "/service-tickets/technicians" },
    @{ module = "Servicio tecnico (modal)"; path = "/service/customers?active_only=1" },
    @{ module = "Informes"; path = "/suppliers" },
    @{ module = "Informes"; path = "/users" },
    @{ module = "Informes"; path = "/reports/daily?date=$(Get-Date -Format yyyy-MM-dd)" },
    @{ module = "Informes"; path = "/reports/monthly?year=$(Get-Date -Format yyyy)&month=$([int](Get-Date -Format MM))" },
    @{ module = "Ajustes"; path = "/users" },
    @{ module = "Ajustes"; path = "/audit-logs?per_page=50" }
)

Write-Host "`n=== Bootstrap endpoints (1 request per module) ===" -ForegroundColor Cyan
$bootstrapEndpoints = @(
    @{ Name = "Dashboard"; path = "/bootstrap/dashboard" },
    @{ Name = "Inventario"; path = "/bootstrap/inventory" },
    @{ Name = "Ventas"; path = "/bootstrap/sales" },
    @{ Name = "Servicio tecnico"; path = "/bootstrap/service-tickets" },
    @{ Name = "Informes"; path = "/bootstrap/reports?tab=daily&date=$(Get-Date -Format yyyy-MM-dd)" }
)
foreach ($ep in $bootstrapEndpoints) {
    $m = Measure-Get -Path $ep.path -Headers $h -Runs 3
    Write-Host ("  {0,-18} {1,-50} avg={2,4}ms" -f $ep.Name, $ep.path, $m.avg)
}

Write-Host "`n=== Individual GET (3 runs each, warm) ===" -ForegroundColor Cyan
$results = @()
foreach ($ep in $endpoints) {
    $m = Measure-Get -Path $ep.path -Headers $h -Runs 3
    $results += [pscustomobject]@{
        Module = $ep.module
        Endpoint = $ep.path
        MinMs = $m.min
        AvgMs = $m.avg
        MaxMs = $m.max
        Bytes = $m.bytes
    }
    Write-Host ("  {0,-28} {1,-45} avg={2,4}ms min={3,4}ms max={4,4}ms" -f $ep.module, $ep.path, $m.avg, $m.min, $m.max)
}

Write-Host "`n=== Simulated page load (parallel, like browser) ===" -ForegroundColor Cyan

function Measure-ParallelPage {
    param([string]$Name, [string[]]$Paths)
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $jobs = foreach ($p in $Paths) {
        Start-Job -ScriptBlock {
            param($base, $path, $token)
            $h = @{ Authorization = "Bearer $token"; Accept = "application/json" }
            $s = [System.Diagnostics.Stopwatch]::StartNew()
            try {
                Invoke-WebRequest -Uri "$base$path" -Headers $h -UseBasicParsing -TimeoutSec 60 | Out-Null
                $s.Stop()
                return $s.ElapsedMilliseconds
            } catch {
                $s.Stop()
                return -1
            }
        } -ArgumentList $base, $p, $token
    }
    $jobTimes = $jobs | Wait-Job | Receive-Job
    $jobs | Remove-Job
    $sw.Stop()
    [pscustomobject]@{
        Page = $Name
        WallMs = $sw.ElapsedMilliseconds
        Requests = $Paths.Count
        PerRequestMs = ($jobTimes | Where-Object { $_ -ge 0 }) -join ", "
    }
}

$pages = @(
    @{ Name = "Inventario (lista)"; Paths = @("/auth/me", "/inventory") },
    @{ Name = "Inventario (lista + modales)"; Paths = @("/auth/me", "/inventory", "/inventory/products", "/suppliers", "/device-colors") },
    @{ Name = "Ventas"; Paths = @("/auth/me", "/sales", "/inventory?status=disponible") },
    @{ Name = "Servicio tecnico"; Paths = @("/auth/me", "/service-tickets/workshops", "/service-tickets") },
    @{ Name = "Servicio tecnico + modal"; Paths = @("/auth/me", "/service-tickets/workshops", "/service-tickets", "/service-tickets/technicians", "/service/customers?active_only=1") },
    @{ Name = "Informes (diario)"; Paths = @("/auth/me", "/suppliers", "/users", "/reports/daily?date=$(Get-Date -Format yyyy-MM-dd)") },
    @{ Name = "Dashboard"; Paths = @("/auth/me", "/dashboard") }
)

$pageResults = @()
foreach ($p in $pages) {
    $r = Measure-ParallelPage -Name $p.Name -Paths $p.Paths
    $pageResults += $r
    Write-Host ("  {0,-32} wall={1,5}ms  ({2} requests, each: {3})" -f $r.Page, $r.WallMs, $r.Requests, $r.PerRequestMs)
}

Write-Host "`n=== Cold start (single /inventory after 2s idle) ===" -ForegroundColor Cyan
Start-Sleep -Seconds 2
$cold = Measure-Get -Path "/inventory" -Headers $h -Runs 1
Write-Host "  Cold /inventory: $($cold.avg) ms"

Write-Host "`n=== Summary by module (avg GET ms) ===" -ForegroundColor Cyan
$results | Group-Object Module | ForEach-Object {
    $avg = [math]::Round(($_.Group | Measure-Object AvgMs -Average).Average, 0)
    $sum = ($_.Group | Measure-Object AvgMs -Sum).Sum
    Write-Host ("  {0,-22} avg={1,4}ms per endpoint  sum={2,5}ms if sequential" -f $_.Name, $avg, $sum)
}

Write-Host "`n=== Page load wall time (parallel) ===" -ForegroundColor Cyan
$pageResults | Sort-Object WallMs -Descending | ForEach-Object {
    Write-Host ("  {0,-32} {1,5} ms" -f $_.Page, $_.WallMs)
}
