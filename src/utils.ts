import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

export const execAsync = promisify(exec);

const PLUGIN_DIR = path.join(process.cwd(), '.claude-trae-plugin');

export async function isTraeCliInstalled(): Promise<boolean> {
  try {
    await execAsync('which trae-cli');
    return true;
  } catch {
    return false;
  }
}

export async function getGitDiff(baseBranch: string = 'main'): Promise<string> {
  try {
    const { stdout } = await execAsync(`git diff ${baseBranch}...HEAD`);
    return stdout;
  } catch (error) {
    try {
        const { stdout } = await execAsync(`git diff`);
        return stdout;
    } catch(e) {
        return "无法获取 git diff，可能不在 git 仓库中。";
    }
  }
}

export function ensurePluginDir() {
  if (!fs.existsSync(PLUGIN_DIR)) {
    fs.mkdirSync(PLUGIN_DIR, { recursive: true });
  }
}

export async function runTraeCli(prompt: string, background: boolean = false): Promise<string> {
    if (background) {
        ensurePluginDir();
        const timestamp = Date.now();
        const logFile = path.join(PLUGIN_DIR, `${timestamp}.log`);
        const pidFile = path.join(PLUGIN_DIR, `${timestamp}.pid`);

        const out = fs.openSync(logFile, 'a');
        const err = fs.openSync(logFile, 'a');

        const child = spawn('trae-cli', ['run', prompt], {
            detached: true,
            stdio: ['ignore', out, err]
        });

        child.unref();

        if (child.pid) {
            fs.writeFileSync(pidFile, child.pid.toString());
        }

        return `任务已在后台启动 (ID: ${timestamp})。\n使用 /trae:status 查看状态，或查看日志文件：${logFile}`;
    } else {
        try {
            const { stdout, stderr } = await execAsync(`trae-cli run "${prompt.replace(/"/g, '\\"')}"`);
            return stdout || stderr;
        } catch (error: any) {
            throw new Error(`执行失败: ${error.message}\n${error.stdout}\n${error.stderr}`);
        }
    }
}
