#Requires -Version 7.0
$ErrorActionPreference = 'Stop'

if (-not $env:GITHUB_OUTPUT) {
    throw '未设置 GITHUB_OUTPUT, 本脚本仅供 GitHub Actions 使用。'
}

function Read-LogFile($path) {
    if (-not (Test-Path $path)) { return '' }
    $content = Get-Content $path -Raw -ErrorAction SilentlyContinue
    if ($null -eq $content) { return '' }
    if ($content.Length -gt 32768) {
        return $content.Substring($content.Length - 32768)
    }
    return $content
}

function Encode-LogOutput($path) {
    $content = Read-LogFile $path
    if ($content -eq '') { return '' }
    [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($content))
}

$runnerTemp = $env:RUNNER_TEMP
if (-not $runnerTemp) {
    throw '未设置 RUNNER_TEMP。'
}

"format_outcome=$($env:FORMAT_OUTCOME)" >> $env:GITHUB_OUTPUT
"build_outcome=$($env:BUILD_OUTCOME)" >> $env:GITHUB_OUTPUT
"dotnet_sdk_version=$(dotnet --version)" >> $env:GITHUB_OUTPUT
"format_log_b64=$(Encode-LogOutput "$runnerTemp/format.log")" >> $env:GITHUB_OUTPUT
"build_log_b64=$(Encode-LogOutput "$runnerTemp/build.log")" >> $env:GITHUB_OUTPUT
