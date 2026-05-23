#Requires -Version 7.0
$ErrorActionPreference = 'Stop'

$archive = Join-Path $env:RUNNER_TEMP $env:DALAMUD_ARCHIVE_FILENAME
$skipDownload = $env:DALAMUD_CACHE_HIT -eq 'true'

if (-not $skipDownload) {
    Invoke-WebRequest -Uri $env:DALAMUD_DOWNLOAD_URL -OutFile $archive
}
if (-not (Test-Path -LiteralPath $archive)) {
    throw "Dalamud 压缩包不存在: $archive"
}

$dest = Join-Path $env:AppData 'XIVLauncherCN\addon\Hooks\dev'
New-Item -ItemType Directory -Force -Path $dest | Out-Null
if (-not (Get-Command 7z -ErrorAction SilentlyContinue)) {
    choco install 7zip -y --no-progress
}
7z x $archive "-o$dest" -y
if ($LASTEXITCODE -ne 0) {
    throw "Dalamud 解压失败 (exit code $LASTEXITCODE): $archive -> $dest"
}

