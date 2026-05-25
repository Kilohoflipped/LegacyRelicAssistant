#Requires -Version 7.0
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'Get-PrimaryCsproj.ps1')

function Read-LogFile($path) {
    if (-not (Test-Path $path)) { return '' }
    $content = Get-Content $path -Raw -ErrorAction SilentlyContinue
    if ($null -eq $content) { return '' }
    if ($content.Length -gt 32768) {
        return $content.Substring($content.Length - 32768)
    }
    return $content
}

function ConvertTo-LogOutputBase64($path) {
    $content = Read-LogFile $path
    if ($content -eq '') { return '' }
    [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($content))
}

function Get-ProjectMetadata {
    $csprojPath = Get-PrimaryCsprojPath
    $lockPath = (Join-Path (Split-Path -Path $csprojPath -Parent) 'packages.lock.json') -replace '\\', '/'

    [xml]$proj = Get-Content -LiteralPath $csprojPath
    $sdk = $proj.Project.Sdk
    $propertyGroups = @($proj.Project.PropertyGroup)
    $version = ($propertyGroups | ForEach-Object { $_.Version } | Where-Object { $_ } | Select-Object -First 1)

    $lock = Get-Content -LiteralPath $lockPath -Raw | ConvertFrom-Json
    $tfm = ($lock.dependencies.PSObject.Properties | Select-Object -First 1).Name
    $roslynatorEntry = $lock.dependencies.$tfm.'Roslynator.Analyzers'
    $roslynator = $roslynatorEntry.resolved

    return @{
        plugin_version      = $version
        dalamud_sdk_version = $sdk
        roslynator_version  = $roslynator
    }
}

$runnerTemp = $env:RUNNER_TEMP
$metadata = Get-ProjectMetadata
"format_outcome=$($env:FORMAT_OUTCOME)" >> $env:GITHUB_OUTPUT
"build_outcome=$($env:BUILD_OUTCOME)" >> $env:GITHUB_OUTPUT
"dotnet_sdk_version=$(dotnet --version)" >> $env:GITHUB_OUTPUT
"format_log_b64=$(ConvertTo-LogOutputBase64 "$runnerTemp/format.log")" >> $env:GITHUB_OUTPUT
"build_log_b64=$(ConvertTo-LogOutputBase64 "$runnerTemp/build.log")" >> $env:GITHUB_OUTPUT
"plugin_version=$($metadata.plugin_version)" >> $env:GITHUB_OUTPUT
"dalamud_sdk_version=$($metadata.dalamud_sdk_version)" >> $env:GITHUB_OUTPUT
"roslynator_version=$($metadata.roslynator_version)" >> $env:GITHUB_OUTPUT
