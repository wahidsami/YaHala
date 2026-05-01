$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# Keep Node from resolving the wrong home directory on this machine.
$env:HOME = $root
$env:USERPROFILE = $root
$env:HOMEDRIVE = 'D:'
$env:HOMEPATH = '\Waheed\MypProjects\Rawaj'

Write-Host "Starting Rawaj services from $root..." -ForegroundColor Cyan

Start-Process pwsh -WorkingDirectory $root -ArgumentList @(
    '-NoExit',
    '-Command',
    'npm run dev'
)

Start-Process pwsh -WorkingDirectory $root -ArgumentList @(
    '-NoExit',
    '-Command',
    'npm run dev:scanner'
)

Start-Process pwsh -WorkingDirectory $root -ArgumentList @(
    '-NoExit',
    '-Command',
    'npm run worker:delivery'
)

Write-Host 'API + admin + scanner + delivery worker launch windows opened.' -ForegroundColor Green
