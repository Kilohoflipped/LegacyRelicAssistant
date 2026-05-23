#Requires -Version 7.0
$ErrorActionPreference = 'Stop'

if (-not $env:GITHUB_OUTPUT) {
    throw '未设置 GITHUB_OUTPUT, 本脚本仅供 GitHub Actions 使用。'
}

$headers = @{
    Accept       = 'application/vnd.github+json'
    'User-Agent' = 'LRA-CI'
}
$release = Invoke-RestMethod `
    -Uri $env:DALAMUD_RELEASE_API_URI `
    -Headers $headers
$asset = $release.assets | Where-Object { $_.name -eq $env:DALAMUD_RELEASE_ASSET_NAME }
if (-not $asset) {
    throw "最新的 release 中未找到 $($env:DALAMUD_RELEASE_ASSET_NAME)"
}
$digest = if ($asset.digest -match '^sha256:(.+)$') { $Matches[1] } else { $asset.id }

"asset_digest=$digest" >> $env:GITHUB_OUTPUT
"download_url=$($asset.browser_download_url)" >> $env:GITHUB_OUTPUT
