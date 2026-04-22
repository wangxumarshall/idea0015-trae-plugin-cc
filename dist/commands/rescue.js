"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rescue = rescue;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = require("path");
const utils_1 = require("../utils");
const PLUGIN_DIR = '.claude-trae-plugin';
function getLastError() {
    const pluginDir = (0, path_1.join)(process.cwd(), PLUGIN_DIR);
    if (!(0, fs_1.existsSync)(pluginDir))
        return null;
    try {
        const files = (0, fs_1.readdirSync)(pluginDir);
        const logs = files.filter(f => f.endsWith('.log'));
        if (logs.length === 0)
            return null;
        logs.sort().reverse();
        const latestLog = logs[0];
        const logPath = (0, path_1.join)(pluginDir, latestLog);
        return (0, fs_1.readFileSync)(logPath, 'utf-8');
    }
    catch {
        return null;
    }
}
function getGitStatus() {
    try {
        // Fixed command, no user input - safe
        return (0, child_process_1.execSync)('git status --short', { encoding: 'utf-8' }).trim();
    }
    catch {
        return '';
    }
}
function getRecentChanges() {
    try {
        // Fixed command, no user input - safe
        return (0, child_process_1.execSync)('git diff --stat -10', { encoding: 'utf-8' }).trim();
    }
    catch {
        return '';
    }
}
async function rescue(args) {
    let context = '';
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--context' && args[i + 1]) {
            context = args[i + 1];
            i++;
        }
    }
    console.log('🔧 [Trae Plugin] Rescue Mode');
    console.log('─'.repeat(40));
    const lastError = getLastError();
    const gitStatus = getGitStatus();
    const recentChanges = getRecentChanges();
    console.log('📊 收集故障信息...');
    if (lastError) {
        console.log('\n📝 最近错误:');
        const errorLines = lastError.split('\n').slice(-10);
        console.log(errorLines.join('\n'));
    }
    if (gitStatus) {
        console.log('\n📁 当前变更:');
        console.log(gitStatus);
    }
    if (recentChanges) {
        console.log('\n📈 最近提交:');
        console.log(recentChanges);
    }
    if (context) {
        console.log('\n📋 用户提供上下文:');
        console.log(context);
    }
    console.log('\n🔍 正在分析问题...');
    const diagnosisPrompt = `作为 Trae Agent 的故障诊断助手，请分析以下失败上下文并提供恢复建议：

${lastError ? `错误输出:\n${lastError}\n` : ''}
${gitStatus ? `Git 状态:\n${gitStatus}\n` : ''}
${context ? `附加上下文:\n${context}\n` : ''}

请提供:
1. 问题诊断: 可能的原因是什么？
2. 恢复建议: 应该尝试什么操作？
3. 预防建议: 如何避免类似问题？`;
    try {
        console.log('─'.repeat(40));
        const result = await (0, utils_1.runTraeCli)(diagnosisPrompt, false);
        console.log('\n💡 诊断结果:');
        console.log(result);
    }
    catch (error) {
        console.error('❌ 诊断失败:', error.message);
    }
    console.log('─'.repeat(40));
}
