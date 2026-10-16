param([switch]$Stop)
$ErrorActionPreference = 'Stop'
$workspacePath = Split-Path -Parent $PSScriptRoot
$runtimePath = Join-Path $workspacePath 'fastapi-backend\data\postgres-runtime\pgsql\bin\pg_ctl.exe'
$clusterPath = Join-Path $workspacePath 'fastapi-backend\data\pgdata'
$logPath = Join-Path $workspacePath 'fastapi-backend\data\postgres.log'
if (-not (Test-Path -LiteralPath $runtimePath) -or -not (Test-Path -LiteralPath (Join-Path $clusterPath 'PG_VERSION'))) {
    Write-Host 'Local PostgreSQL runtime is not installed; use DATABASE_URL for your existing server.'
    exit 0
}
& $runtimePath -D $clusterPath status *> $null
$isRunning = $LASTEXITCODE -eq 0
if ($Stop) {
    if ($isRunning) {
        & $runtimePath -D $clusterPath -m fast -w stop
        exit $LASTEXITCODE
    }
    Write-Host 'Local PostgreSQL is already stopped.'
    exit 0
}
if ($isRunning) {
    Write-Host 'Local PostgreSQL is already running at 127.0.0.1:5432.'
    exit 0
}
$dbProcess = Start-Process -FilePath $runtimePath -ArgumentList @(
    '-D', ('"' + $clusterPath + '"'), '-l', ('"' + $logPath + '"'), '-w', 'start'
) -WindowStyle Hidden -PassThru
$dbProcess.WaitForExit()
if ($dbProcess.ExitCode -ne 0) {
    throw "PostgreSQL startup failed. Check $logPath"
}
Write-Host 'Local PostgreSQL started at 127.0.0.1:5432.'
