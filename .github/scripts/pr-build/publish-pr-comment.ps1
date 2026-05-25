#Requires -Version 7.0
$ErrorActionPreference = 'Stop'

function Get-OutcomeIcon {
    param([string]$Outcome)
    switch ($Outcome) {
        'success' { return '✅' }
        'failure' { return '❌' }
        'skipped' { return '⏭️' }
        'cancelled' { return '🚫' }
        default { return '❓' }
    }
}

function Get-DisplayOrDash {
    param([string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) { return '/' }
    return $Value
}

function Get-DigestPreview {
    param([string]$Digest)
    if ([string]::IsNullOrWhiteSpace($Digest)) { return '/' }
    if ($Digest.Length -le 16) { return $Digest }
    return "$($Digest.Substring(0, 16))…"
}

$marker = '<!-- legacy-relic-assistant-pr-build -->'
$runUrl = "$env:GITHUB_SERVER_URL/$env:GITHUB_REPOSITORY/actions/runs/$env:GITHUB_RUN_ID"
$buildResult = $env:BUILD_RESULT

$overallIcon = switch ($buildResult) {
    'success' { '✅' }
    'cancelled' { '🚫' }
    default { '❌' }
}

if ($buildResult -eq 'cancelled') {
    $body = @(
        "## $overallIcon Legacy Relic Assistant — CI 报告"
        ''
        '构建已取消。'
        ''
        "[查看 Workflow 运行]($runUrl)"
        $marker
    ) -join "`n"
}
else {
    $cacheLabel = if ($env:DALAMUD_CACHE_HIT -eq 'true') { '命中' } else { '未命中' }
    $shortSha = Get-DisplayOrDash $env:SHORT_SHA
    if ($shortSha -eq '—') {
        $shortSha = $env:GITHUB_SHA.Substring(0, 7)
    }

    $formatOutcome = if ([string]::IsNullOrWhiteSpace($env:FORMAT_OUTCOME)) { 'unknown' } else { $env:FORMAT_OUTCOME }
    $buildOutcome = if ([string]::IsNullOrWhiteSpace($env:BUILD_OUTCOME)) { 'unknown' } else { $env:BUILD_OUTCOME }

    $artifactLine = if ($buildResult -eq 'success') {
        "📦 **Artifact:** ``LegacyRelicAssistant-$($env:SHORT_SHA)``（在 Workflow 运行页的 Artifacts 中下载）"
    }
    else {
        '📦 **Artifact:** 未生成（构建未成功）'
    }

    $body = @(
        "## $overallIcon Legacy Relic Assistant — CI 报告"
        ''
        '| 检查项 | 结果 |'
        '| --- | --- |'
        "| ``dotnet format --verify-no-changes`` | $(Get-OutcomeIcon $formatOutcome) $formatOutcome |"
        "| ``dotnet build`` (Release, x64, -warnaserror) | $(Get-OutcomeIcon $buildOutcome) $buildOutcome |"
        ''
        '### 构建环境'
        ''
        '| 项 | 值 |'
        '| --- | --- |'
        "| Commit | ``$shortSha`` |"
        "| 插件版本 (csproj) | ``$(Get-DisplayOrDash $env:PLUGIN_VERSION)`` |"
        '| .NET SDK | `10.0.x` |'
        '| Runner | `windows-2022` |'
        '| Dalamud SDK | `Dalamud.CN.NET.Sdk/15.0.0` |'
        "| Dalamud ``latest.7z`` digest | ``$(Get-DigestPreview $env:DALAMUD_DIGEST)`` |"
        "| Dalamud 缓存 | $cacheLabel |"
        "| Roslynator.Analyzers | ``$(Get-DisplayOrDash $env:ROSLYNATOR_VERSION)`` |"
        ''
        $artifactLine
        ''
        "[查看完整日志]($runUrl)"
        $marker
    ) -join "`n"
}

$owner, $repo = $env:GITHUB_REPOSITORY -split '/', 2
if (-not $repo) {
    throw "GITHUB_REPOSITORY 格式无效: $($env:GITHUB_REPOSITORY)"
}

$headers = @{
    Authorization          = "Bearer $env:GITHUB_TOKEN"
    Accept                 = 'application/vnd.github+json'
    'X-GitHub-Api-Version' = '2022-11-28'
    'User-Agent'           = 'LRA-CI'
}

$commentsUri = "https://api.github.com/repos/$owner/$repo/issues/$env:PR_NUMBER/comments?per_page=100"
$comments = Invoke-RestMethod -Uri $commentsUri -Headers $headers -Method Get

$existing = $comments | Where-Object { $_.body -like "*$marker*" } | Select-Object -First 1

$jsonBody = @{ body = $body } | ConvertTo-Json -Compress

if ($existing) {
    $updateUri = "https://api.github.com/repos/$owner/$repo/issues/comments/$($existing.id)"
    Invoke-RestMethod -Uri $updateUri -Headers $headers -Method Patch -Body $jsonBody -ContentType 'application/json; charset=utf-8' | Out-Null
    Write-Host "已更新 PR 评论 #$($existing.id)"
}
else {
    $createUri = "https://api.github.com/repos/$owner/$repo/issues/$env:PR_NUMBER/comments"
    Invoke-RestMethod -Uri $createUri -Headers $headers -Method Post -Body $jsonBody -ContentType 'application/json; charset=utf-8' | Out-Null
    Write-Host '已创建 PR 评论'
}
