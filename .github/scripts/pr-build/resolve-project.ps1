#Requires -Version 7.0
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'Get-PrimaryCsproj.ps1')

$csproj = Get-PrimaryCsprojPath
[xml]$proj = Get-Content -LiteralPath $csproj
$assemblyName = ($proj.Project.PropertyGroup | ForEach-Object { $_.AssemblyName } | Where-Object { $_ } | Select-Object -First 1)
if (-not $assemblyName) {
    throw "无法从 $csproj 解析 AssemblyName"
}

$projectDir = Split-Path -Path $csproj -Parent
$artifactPath = "$projectDir/bin/x64/Release/$assemblyName" -replace '\\', '/'

"assembly_name=$assemblyName" >> $env:GITHUB_OUTPUT
"artifact_path=$artifactPath" >> $env:GITHUB_OUTPUT
