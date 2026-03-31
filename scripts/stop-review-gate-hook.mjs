#!/usr/bin/env node
/**
 * stop-review-gate-hook.mjs
 * Optional review gate that prompts for review before stopping
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const PLUGIN_DIR = '.claude-trae-plugin';

function hasUncommittedChanges() {
  try {
    // Check for staged, unstaged, and untracked changes
    const staged = execSync('git diff --cached --name-only', { encoding: 'utf-8' }).trim();
    if (staged) return true;

    const unstaged = execSync('git diff --name-only', { encoding: 'utf-8' }).trim();
    if (unstaged) return true;

    const untracked = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
    if (untracked) return true;

    return false;
  } catch {
    return false;
  }
}

function getRunningJobs() {
  const pluginDir = join(process.cwd(), PLUGIN_DIR);
  if (!existsSync(pluginDir)) return [];

  try {
    const files = readdirSync(pluginDir);
    const pids = files.filter(f => f.endsWith('.pid'));
    const running = [];

    for (const pidFile of pids) {
      try {
        const pid = parseInt(readFileSync(join(pluginDir, pidFile), 'utf-8').trim());
        process.kill(pid, 0);
        running.push(pidFile.replace('.pid', ''));
      } catch {
        // Process not running
      }
    }
    return running;
  } catch {
    return [];
  }
}

async function stopGate() {
  const force = process.argv.includes('--force');

  if (force) {
    console.log('⏭️  [Trae Plugin] Stop gate bypassed (--force)');
    process.exit(0);
  }

  const hasChanges = hasUncommittedChanges();
  const runningJobs = getRunningJobs();

  if (!hasChanges && runningJobs.length === 0) {
    process.exit(0);
  }

  console.log('⚠️  [Trae Plugin] Stop Gate');
  console.log('─'.repeat(40));

  if (hasChanges) {
    console.log('📝 检测到未提交的代码变更');
    console.log('   建议在离开前运行 /trae:review 进行审查');
  }

  if (runningJobs.length > 0) {
    console.log(`📋 有 ${runningJobs.length} 个后台任务仍在运行`);
  }

  console.log('─'.repeat(40));
  console.log('使用 --force 参数可强制退出');

  process.exit(0);
}

stopGate();