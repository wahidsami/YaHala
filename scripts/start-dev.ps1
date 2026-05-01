$ErrorActionPreference = 'Stop'

$ports = @(3001, 5173, 5174, 5175, 5176)
$killed = @{}

foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($connection in $connections) {
        $procId = $connection.OwningProcess
        if ($procId -and -not $killed.ContainsKey($procId)) {
            try {
                Stop-Process -Id $procId -Force -ErrorAction Stop
                $killed[$procId] = $true
                Write-Host "Stopped process $procId on port $port" -ForegroundColor Yellow
            } catch {
                Write-Host "Could not stop process $procId on port ${port}: $($_.Exception.Message)" -ForegroundColor DarkYellow
            }
        }
    }
}

Write-Host "Starting Rawaj API + Admin + Scanner..." -ForegroundColor Cyan
npm run dev:raw
