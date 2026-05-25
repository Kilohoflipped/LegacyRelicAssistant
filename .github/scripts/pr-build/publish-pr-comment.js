module.exports = async ({ github, context }) => {
    const marker = '<!-- legacy-relic-assistant-pr-build -->';
    const runUrl = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;

    const icon = (outcome) => {
        if (outcome === 'success') return '✅';
        if (outcome === 'failure') return '❌';
        if (outcome === 'skipped') return '⏭️';
        if (outcome === 'cancelled') return '🚫';
        return '❓';
    };

    const buildResult = process.env.BUILD_RESULT;
    const overallIcon = buildResult === 'success' ? '✅' : buildResult === 'cancelled' ? '🚫' : '❌';

    let body;
    if (buildResult === 'cancelled') {
        body = [
            `## ${overallIcon} Legacy Relic Assistant - CI 报告`,
            '',
            '构建已取消。',
            '',
            `[查看 Workflow 运行](${runUrl})`,
            marker,
        ].join('\n');
    } else {
        const cacheLabel = process.env.DALAMUD_CACHE_HIT === 'true' ? '命中' : '未命中';
        const shortSha = process.env.SHORT_SHA ?? context.sha.slice(0, 7);
        const artifactLine = buildResult === 'success'
            ? `📦 **Artifact:** \`LegacyRelicAssistant-${shortSha}\`（在 Workflow 运行页的 Artifacts 中下载）`
            : '📦 **Artifact:** 未生成（构建未成功）';

        body = [
            `## ${overallIcon} Legacy Relic Assistant - CI 报告`,
            '',
            '| 检查项 | 结果 |',
            '| --- | --- |',
            `| \`dotnet format --verify-no-changes\` | ${icon(process.env.FORMAT_OUTCOME)} ${process.env.FORMAT_OUTCOME ?? 'unknown'} |`,
            `| \`dotnet build\` (Release, x64, -warnaserror) | ${icon(process.env.BUILD_OUTCOME)} ${process.env.BUILD_OUTCOME ?? 'unknown'} |`,
            '',
            '### 构建环境',
            '',
            '| 项 | 值 |',
            '| --- | --- |',
            `| Commit | \`${shortSha}\` |`,
            `| 插件版本 (csproj) | \`${process.env.PLUGIN_VERSION ?? '—'}\` |`,
            '| .NET SDK | `10.0.x` |',
            '| Runner | `windows-2022` |',
            '| Dalamud SDK | `Dalamud.CN.NET.Sdk/15.0.0` |',
            `| Dalamud \`latest.7z\` digest | \`${(process.env.DALAMUD_DIGEST ?? '—').slice(0, 16)}…\` |`,
            `| Dalamud 缓存 | ${cacheLabel} |`,
            `| Roslynator.Analyzers | \`${process.env.ROSLYNATOR_VERSION ?? '—'}\` |`,
            '',
            artifactLine,
            '',
            `[查看完整日志](${runUrl})`,
            marker,
        ].join('\n');
    }

    const { data: comments } = await github.rest.issues.listComments({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.issue.number,
    });

    const existing = comments.find((c) => c.body.includes(marker));

    if (existing) {
        await github.rest.issues.updateComment({
            owner: context.repo.owner,
            repo: context.repo.repo,
            comment_id: existing.id,
            body,
        });
    } else {
        await github.rest.issues.createComment({
            owner: context.repo.owner,
            repo: context.repo.repo,
            issue_number: context.issue.number,
            body,
        });
    }
};
