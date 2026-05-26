module.exports = async ({ github, context }) => {
    const marker = '<!-- pr-build-bot-comment-marker -->';
    const runUrl = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
    const maxDetailLines = 10;

    const icon = (outcome) => {
        if (outcome === 'success') return '✅';
        if (outcome === 'failure') return '❌';
        if (outcome === 'skipped') return '⏭️';
        if (outcome === 'cancelled') return '🚫';
        return '❓';
    };

    const decodeLog = (encoded) => {
        if (!encoded?.trim()) return '';
        try {
            return Buffer.from(encoded, 'base64').toString('utf8');
        } catch {
            return '';
        }
    };

    const formatOutcomeLabel = (outcome) => {
        const value = outcome ?? 'unknown';
        return value.charAt(0).toUpperCase() + value.slice(1);
    };

    const extractFormatIssues = (log) => {
        if (!log?.trim()) return [];
        const patterns = [
            /:\s*error\s/i,
            /:\s*warning\s/i,
            /IDE0055/i,
            /needs formatting/i,
            /would be formatted/i,
            /formatting violation/i,
        ];
        return log
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line && patterns.some((pattern) => pattern.test(line)));
    };

    const extractBuildIssues = (log) => {
        if (!log?.trim()) return [];
        return log
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line && /:\s*error\s/i.test(line));
    };

    const fallbackExcerpt = (log, maxLines) => {
        if (!log?.trim()) return [];
        return log
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .slice(-maxLines);
    };

    const escapeHtml = (text) => text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const formatIssueBlock = (title, lines, maxLines) => {
        if (!lines.length) return null;
        const shown = lines.slice(0, maxLines);
        const overflow = lines.length - maxLines;
        const contentLines = shown.map((line) => `> ${escapeHtml(line)}`);
        if (overflow > 0) {
            contentLines.push(`> ... 还有 ${overflow} 条，请[查看完整日志](${runUrl})`);
        }
        return [
            `#### ${title}`,
            '',
            '<details>',
            `<summary>展开详情（共 ${lines.length} 条）</summary>`,
            '',
            ...contentLines,
            '',
            '</details>',
        ].join('\n');
    };

    const buildDetailSections = () => {
        const sections = [];

        if (process.env.FORMAT_OUTCOME === 'failure') {
            const formatLog = decodeLog(process.env.FORMAT_LOG_B64);
            let formatIssues = extractFormatIssues(formatLog);
            if (!formatIssues.length) {
                formatIssues = fallbackExcerpt(formatLog, maxDetailLines);
            }
            const block = formatIssueBlock('dotnet format 详情', formatIssues, maxDetailLines);
            if (block) sections.push(block);
        }

        if (process.env.BUILD_OUTCOME === 'failure') {
            const buildLog = decodeLog(process.env.BUILD_LOG_B64);
            let buildIssues = extractBuildIssues(buildLog);
            if (!buildIssues.length) {
                buildIssues = fallbackExcerpt(buildLog, maxDetailLines);
            }
            const block = formatIssueBlock('dotnet build 详情', buildIssues, maxDetailLines);
            if (block) sections.push(block);
        }

        if (sections.length) {
            sections.unshift('', '### 详细检查信息');
        }

        return sections;
    };

    const buildResult = process.env.BUILD_RESULT;
    const overallIcon = buildResult === 'success' ? '✅' : buildResult === 'cancelled' ? '🚫' : '❌';

    let body;
    if (buildResult === 'cancelled') {
        body = [
            `## ${overallIcon} 构建与代码质量构建报告`,
            '',
            '构建已取消。',
            '',
            `[查看完整日志](${runUrl})`,
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
        const artifactName = process.env.ARTIFACT_NAME?.trim();
        const artifactId = process.env.ARTIFACT_ID?.trim();

        let artifactLine;
        if (buildResult === 'success' && artifactName) {
            const nightlyUrl = `https://nightly.link/${context.repo.owner}/${context.repo.repo}/actions/runs/${process.env.GITHUB_RUN_ID}/${encodeURIComponent(artifactName)}.zip`;
            artifactLine = `[${artifactName}](${nightlyUrl})`;
        } else if (buildResult === 'success' && artifactId) {
            const nightlyUrl = `https://nightly.link/${context.repo.owner}/${context.repo.repo}/actions/runs/${process.env.GITHUB_RUN_ID}/artifacts/${artifactId}.zip`;
            artifactLine = `[${artifactId}](${nightlyUrl})`;
        } else {
            artifactLine = '未生成（构建未成功）';
        }

        body = [
            `## ${overallIcon} 构建与代码质量报告`,
            '',
            '### 检查项执行情况',
            '| 检查项 | 结果 |',
            '| --- | --- |',
            `| \`dotnet format\` | ${icon(process.env.FORMAT_OUTCOME)} ${formatOutcomeLabel(process.env.FORMAT_OUTCOME)} |`,
            `| \`dotnet build\` | ${icon(process.env.BUILD_OUTCOME)} ${formatOutcomeLabel(process.env.BUILD_OUTCOME)} |`,
            ...(() => {
                const detailSections = buildDetailSections();
                return detailSections.length ? ['', ...detailSections] : [];
            })(),
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
