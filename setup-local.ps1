<#
.SYNOPSIS
  Cai dat va van hanh CubeSAT LMS tren mot may (Windows, chi can Docker Desktop).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\setup-local.ps1            # cai dat / cap nhat
  powershell -ExecutionPolicy Bypass -File .\setup-local.ps1 stop       # dung
  powershell -ExecutionPolicy Bypass -File .\setup-local.ps1 start      # chay lai
  powershell -ExecutionPolicy Bypass -File .\setup-local.ps1 logs       # xem log backend
  powershell -ExecutionPolicy Bypass -File .\setup-local.ps1 admin      # tao/nang quyen admin
#>
param(
    [ValidateSet('install', 'start', 'stop', 'status', 'logs', 'admin')]
    [string]$Action = 'install',
    [int]$Port = 8080,
    [switch]$SkipCompiler
)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$envFile = Join-Path $PSScriptRoot '.env.local'
$compose = @('compose', '--env-file', $envFile, '-f', 'docker-compose.local.yml')

function Invoke-Docker([string[]]$Arguments) {
    & docker @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Lenh that bai: docker $($Arguments -join ' ')" }
}

function New-Secret([int]$Bytes) {
    $buffer = New-Object byte[] $Bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
    return -join ($buffer | ForEach-Object { $_.ToString('x2') })
}

function Read-EnvValue([string]$Name, [string]$Default) {
    $line = Get-Content -LiteralPath $envFile | Where-Object { $_ -match "^$Name=" } | Select-Object -First 1
    if ($line) { return $line.Substring($Name.Length + 1) }
    return $Default
}

& docker info *> $null
if ($LASTEXITCODE -ne 0) { throw 'Docker chua chay. Hay mo Docker Desktop, doi trang thai "Engine running" roi chay lai.' }

if (-not (Test-Path -LiteralPath $envFile)) {
    # Secrets are generated once and kept with the database volume; never commit this file.
    $content = @(
        '# Sinh boi setup-local.ps1. Giu file nay cung du lieu; khong dua len Git.'
        "POSTGRES_PASSWORD=$(New-Secret 24)"
        "JWT_SECRET=$(New-Secret 32)"
        "LOCAL_PORT=$Port"
        'COMPILER_IMAGE=pscubesat-compiler:1'
        'LMS_CLASS_MODE=false'
    ) -join "`n"
    [System.IO.File]::WriteAllText($envFile, "$content`n", (New-Object System.Text.UTF8Encoding $false))
    Write-Host "Da tao .env.local (mat khau ngau nhien, cong $Port)."
}
$localPort = Read-EnvValue 'LOCAL_PORT' '8080'
$compilerImage = Read-EnvValue 'COMPILER_IMAGE' 'pscubesat-compiler:1'

switch ($Action) {
    'stop' { Invoke-Docker ($compose + @('stop')); return }
    'status' { Invoke-Docker ($compose + @('ps', '-a')); return }
    'logs' { Invoke-Docker ($compose + @('logs', '--tail', '200', '-f', 'fastapi')); return }
    'start' { Invoke-Docker ($compose + @('up', '-d', '--wait', '--wait-timeout', '300')) }
    'admin' { Invoke-Docker ($compose + @('exec', 'fastapi', 'python', 'scripts/create_admin.py')); return }
    'install' {
        Write-Host 'Build va khoi dong PostgreSQL, Redis, backend, frontend (lan dau 3-10 phut)...'
        Invoke-Docker ($compose + @('up', '-d', '--build', '--wait', '--wait-timeout', '300'))
        & docker image inspect $compilerImage *> $null
        if ($LASTEXITCODE -ne 0) {
            if ($SkipCompiler) {
                Write-Warning "Bo qua image compiler; chuc nang Bien dich se bao loi cho den khi chay lai khong co -SkipCompiler."
            } else {
                Write-Host "Build image compiler $compilerImage (tai toolchain ESP32, ~6 GB, lan dau 15-40 phut)..."
                Invoke-Docker @('build', '-f', 'fastapi-backend/compiler/Dockerfile', '-t', $compilerImage, 'fastapi-backend')
            }
        }
        $admins = & docker @($compose + @('exec', '-T', 'postgres', 'psql', '-U', 'cubesat', '-d', 'cubesat', '-tAc', "SELECT count(*) FROM users WHERE role = 'admin'"))
        if ($LASTEXITCODE -eq 0 -and "$admins".Trim() -eq '0') {
            if ([Console]::IsInputRedirected) {
                Write-Warning 'Chua co admin. Mo PowerShell va chay: .\setup-local.ps1 admin'
            } else {
                Write-Host 'Chua co tai khoan admin. Nhap thong tin admin dau tien:'
                Invoke-Docker ($compose + @('exec', 'fastapi', 'python', 'scripts/create_admin.py'))
            }
        }
    }
}
Write-Host ''
Write-Host "CubeSAT LMS dang chay: http://localhost:$localPort  (admin dang nhap tai http://localhost:$localPort/admin/login)"
Write-Host 'Nap firmware qua USB can Chrome/Edge mo bang dia chi localhost tren chinh may nay.'
