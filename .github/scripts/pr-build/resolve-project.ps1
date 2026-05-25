#Requires -Version 7.0
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'Get-PrimaryCsproj.ps1')

$csproj = Get-PrimaryCsprojPath
$props = dotnet msbuild $csproj -getProperty:AssemblyName -nologo | ConvertFrom-Json
$assemblyName = $props.Properties.AssemblyName
if (-not $assemblyName) {
    throw "无法从 $csproj 解析 AssemblyName"
}

$projectDir = Split-Path -Path $csproj -Parent
$artifactPath = "$projectDir/bin/x64/Release/$assemblyName" -replace '\\', '/'

"assembly_name=$assemblyName" >> $env:GITHUB_OUTPUT
"artifact_path=$artifactPath" >> $env:GITHUB_OUTPUT
