"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectBaseBranch = detectBaseBranch;
exports.getUntrackedFiles = getUntrackedFiles;
exports.estimateReviewSize = estimateReviewSize;
exports.formatEstimate = formatEstimate;
const child_process_1 = require("child_process");
async function detectBaseBranch() {
    const commonBranches = ['main', 'master', 'develop', 'dev', 'mainline'];
    // Check current branch's upstream
    try {
        const upstream = (0, child_process_1.execSync)('git rev-parse --abbrev-ref --symbolic-full-name @{u}', {
            encoding: 'utf-8'
        }).trim();
        if (upstream) {
            const base = upstream.split('/').pop();
            if (base && commonBranches.includes(base.toLowerCase())) {
                return base;
            }
        }
    }
    catch {
        // Ignore
    }
    // Check if current branch is one of common branches
    try {
        const currentBranch = (0, child_process_1.execSync)('git branch --show-current', { encoding: 'utf-8' }).trim();
        if (commonBranches.includes(currentBranch.toLowerCase())) {
            return 'main';
        }
    }
    catch {
        // Ignore
    }
    // Try to find default branch from remote
    try {
        const remoteDefault = (0, child_process_1.execSync)('git remote show origin | grep "HEAD branch" | sed "s/.*: //"', {
            encoding: 'utf-8'
        }).trim();
        if (remoteDefault) {
            return remoteDefault;
        }
    }
    catch {
        // Ignore
    }
    // Fallback to common branches
    for (const branch of commonBranches) {
        try {
            (0, child_process_1.execSync)(`git rev-parse --verify ${branch}`, { stdio: 'ignore' });
            return branch;
        }
        catch {
            continue;
        }
    }
    return 'main';
}
async function getUntrackedFiles() {
    try {
        const output = (0, child_process_1.execSync)('git status --porcelain', { encoding: 'utf-8' }).trim();
        if (!output)
            return [];
        return output
            .split('\n')
            .filter(line => line.startsWith('??'))
            .map(line => line.substring(3).trim());
    }
    catch {
        return [];
    }
}
async function estimateReviewSize(baseBranch) {
    let linesAdded = 0;
    let linesDeleted = 0;
    let filesChanged = 0;
    // Get diff stats - using fixed commands only
    try {
        const diffStats = (0, child_process_1.execSync)(`git diff --shortstat ${baseBranch}...HEAD`, {
            encoding: 'utf-8'
        }).trim();
        if (diffStats) {
            const match = diffStats.match(/(\d+)\s+files? changed.*?(\d+)\s+insertions.*?(\d+)\s+deletions/);
            if (match) {
                filesChanged = parseInt(match[1]) || 0;
                linesAdded = parseInt(match[2]) || 0;
                linesDeleted = parseInt(match[3]) || 0;
            }
        }
    }
    catch {
        // Fallback to unstaged
        try {
            const diffStats = (0, child_process_1.execSync)('git diff --shortstat', { encoding: 'utf-8' }).trim();
            if (diffStats) {
                const match = diffStats.match(/(\d+)\s+files? changed/);
                if (match) {
                    filesChanged = parseInt(match[1]) || 0;
                }
            }
        }
        catch {
            // Ignore
        }
    }
    // Get untracked files
    const untrackedFiles = await getUntrackedFiles();
    const totalChanges = linesAdded + linesDeleted;
    // Determine estimated time
    let estimatedTime;
    if (totalChanges < 100) {
        estimatedTime = 'quick';
    }
    else if (totalChanges < 500) {
        estimatedTime = 'moderate';
    }
    else if (totalChanges < 2000) {
        estimatedTime = 'lengthy';
    }
    else {
        estimatedTime = 'very_large';
    }
    // Determine recommendation - based on tracked changes, not untracked
    let useBackground = false;
    let reason = '';
    if (totalChanges < 100) {
        useBackground = false;
        reason = '变更较小，可以同步等待';
    }
    else if (totalChanges < 500) {
        useBackground = true;
        reason = '变更适中，建议后台运行';
    }
    else if (totalChanges < 2000) {
        useBackground = true;
        reason = '变更较大，建议后台运行';
    }
    else {
        useBackground = true;
        reason = '变更非常大，建议后台运行或拆分审查';
    }
    return {
        baseBranch,
        linesAdded,
        linesDeleted,
        filesChanged,
        untrackedFiles,
        estimatedTime,
        recommendation: { useBackground, reason }
    };
}
function formatEstimate(estimate) {
    const lines = [
        '📊 审查估算:',
        `   基准分支: ${estimate.baseBranch}`,
        `   变更: +${estimate.linesAdded} -${estimate.linesDeleted} 行`,
        `   文件: ${estimate.filesChanged} 个`,
    ];
    if (estimate.untrackedFiles.length > 0) {
        lines.push(`   未跟踪: ${estimate.untrackedFiles.length} 个文件`);
    }
    const timeMap = {
        quick: '快速 (1-2分钟)',
        moderate: '中等 (5-10分钟)',
        lengthy: '较长 (10-30分钟)',
        very_large: '非常长 (30分钟+)'
    };
    lines.push(`   预计时间: ${timeMap[estimate.estimatedTime]}`);
    lines.push('');
    lines.push(`💡 建议: ${estimate.recommendation.reason}`);
    return lines.join('\n');
}
