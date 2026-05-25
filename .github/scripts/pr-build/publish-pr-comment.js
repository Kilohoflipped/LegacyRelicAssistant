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

    const formatOutcomeLabel = (outcome) => {
        const value = outcome ?? 'unknown';
        return value.charAt(0).toUpperCase() + value.slice(1);
    };

    const buildResult = process.env.BUILD_RESULT;
    const overallIcon = buildResult === 'success' ? '✅' : buildResult === 'cancelled' ? '🚫' : '❌';

    let body;
    if (buildResult === 'cancelled') {
        body = [
            `## ${overallIcon} Build 报告`,
            '',
            '构建已取消。',
            '',
            `[查看 Workflow 运行](${runUrl})`,
            marker,
        ].join('\n');
    } else {
        const cacheLabel = process.env.DALAMUD_CACHE_HIT === 'true' ? '命中' : '未命中';
        const shortSha = process.env.SHORT_SHA?.trim() || context.sha.slice(0, 7);
        const dalamudReleaseTag = process.env.DALAMUD_RELEASE_TAG?.trim();
        const dalamudReleaseUrl = process.env.DALAMUD_RELEASE_URL?.trim();
        const dalamudVersionLabel = dalamudReleaseTag
            ? (dalamudReleaseUrl ? `[${dalamudReleaseTag}](${dalamudReleaseUrl})` : `\`${dalamudReleaseTag}\``)
            : '/';
        const artifactName = `LegacyRelicAssistant-${shortSha}`;
        const artifactId = process.env.ARTIFACT_ID?.trim();

        let artifactLine;
        if (buildResult === 'success' && artifactId) {
            const nightlyUrl = `https://nightly.link/${context.repo.owner}/${context.repo.repo}/actions/runs/${process.env.GITHUB_RUN_ID}/artifacts/${artifactId}.zip`;
            artifactLine = `[${artifactName}](${nightlyUrl})`;
        } else {
            artifactLine = '未生成（构建未成功）';
        }

        body = [
            `## ${overallIcon} 代码质量与构建报告`,
            '',
            '### 检查项执行情况',
            '| 检查项 | 结果 |',
            '| --- | --- |',
            `| \`dotnet format\` | ${icon(process.env.FORMAT_OUTCOME)} ${formatOutcomeLabel(process.env.FORMAT_OUTCOME)} |`,
            `| \`dotnet build\` | ${icon(process.env.BUILD_OUTCOME)} ${formatOutcomeLabel(process.env.BUILD_OUTCOME)} |`,
            '',
            '### 构建环境',
            '',
            '| 环境项 | 值 |',
            '| --- | --- |',
            `| Commit | \`${shortSha}\` |`,
            `| 插件版本 | \`${process.env.PLUGIN_VERSION ?? '/'}\` |`,
            `| .NET SDK 版本 | \`${process.env.DOTNET_SDK_VERSION ?? '/'}\` |`,
            '| 操作系统 | `windows-2022` |',
            `| Dalamud SDK | \`${process.env.DALAMUD_SDK_VERSION ?? '/'}\` |`,
            `| Dalamud 版本 | ${dalamudVersionLabel} |`,
            `| Dalamud \`${process.env.DALAMUD_RELEASE_ASSET_NAME ?? '/'}\` 摘要 | \`${(process.env.DALAMUD_DIGEST ?? '—').slice(0, 16)}…\` |`,
            `| Dalamud 缓存 | ${cacheLabel} |`,
            `| Roslynator 版本 | \`${process.env.ROSLYNATOR_VERSION ?? '/'}\` |`,
            '',
            '### 构建产物',
            '',
            artifactLine,
            '',
            '---',
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
