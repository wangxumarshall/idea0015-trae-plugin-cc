"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AcpServerManager = exports.AcpClient = exports.TraeExecutor = exports.ContextBridge = exports.AuthBridge = exports.SessionReader = exports.execAsync = void 0;
exports.isTraeCliInstalled = isTraeCliInstalled;
exports.getGitDiff = getGitDiff;
exports.ensurePluginDir = ensurePluginDir;
exports.runTraeCli = runTraeCli;
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
exports.execAsync = (0, util_1.promisify)(child_process_1.exec);
const PLUGIN_DIR = path.join(process.cwd(), '.claude-trae-plugin');
function getTraeCliEnv() {
    const env = { ...process.env };
    const homeBin = path.join(os.homedir(), '.local', 'bin');
    const existingPath = env.PATH || '';
    if (!existingPath.split(':').includes(homeBin)) {
        env.PATH = `${homeBin}:${existingPath}`;
    }
    return env;
}
function isSafeGitRef(ref) {
    return /^[A-Za-z0-9._\/-]+$/.test(ref);
}
async function isTraeCliInstalled() {
    try {
        const env = getTraeCliEnv();
        await (0, exports.execAsync)('which trae-cli', { env });
        return true;
    }
    catch {
        return false;
    }
}
async function getGitDiff(baseBranch = 'main') {
    const safeBase = isSafeGitRef(baseBranch) ? baseBranch : 'main';
    try {
        const { stdout } = await (0, exports.execAsync)(`git diff ${safeBase}...HEAD`);
        return stdout;
    }
    catch (error) {
        try {
            const { stdout } = await (0, exports.execAsync)('git diff');
            return stdout;
        }
        catch {
            return '无法获取 git diff，可能不在 git 仓库中。';
        }
    }
}
function ensurePluginDir() {
    if (!fs.existsSync(PLUGIN_DIR)) {
        fs.mkdirSync(PLUGIN_DIR, { recursive: true });
    }
}
async function runTraeCli(prompt, background = false) {
    ensurePluginDir();
    const env = getTraeCliEnv();
    const timestamp = Date.now();
    const logFile = path.join(PLUGIN_DIR, `${timestamp}.log`);
    const pidFile = path.join(PLUGIN_DIR, `${timestamp}.pid`);
    if (background) {
        const out = fs.openSync(logFile, 'a');
        const err = fs.openSync(logFile, 'a');
        const child = (0, child_process_1.spawn)('trae-cli', ['--print', prompt], {
            detached: true,
            stdio: ['ignore', out, err],
            env,
        });
        child.unref();
        if (child.pid) {
            fs.writeFileSync(pidFile, child.pid.toString());
        }
        return `任务已在后台启动 (ID: ${timestamp})。\n使用 /trae:status 查看状态，或查看日志文件：${logFile}`;
    }
    return new Promise((resolve, reject) => {
        const child = (0, child_process_1.spawn)('trae-cli', ['--print', prompt], {
            stdio: ['ignore', 'pipe', 'pipe'],
            env,
        });
        if (child.pid) {
            fs.writeFileSync(pidFile, child.pid.toString());
        }
        let combinedOutput = '';
        const append = (chunk, isErr = false) => {
            const text = chunk.toString();
            combinedOutput += text;
            fs.appendFileSync(logFile, text);
            if (isErr) {
                process.stderr.write(chunk);
            }
            else {
                process.stdout.write(chunk);
            }
        };
        child.stdout?.on('data', (chunk) => append(chunk, false));
        child.stderr?.on('data', (chunk) => append(chunk, true));
        child.on('error', (error) => {
            if (fs.existsSync(pidFile))
                fs.unlinkSync(pidFile);
            reject(new Error(`执行失败: ${error.message}`));
        });
        child.on('close', (code) => {
            if (fs.existsSync(pidFile))
                fs.unlinkSync(pidFile);
            if (code === 0) {
                resolve(combinedOutput);
            }
            else {
                reject(new Error(`执行失败: trae-cli 退出码 ${code}。日志: ${logFile}`));
            }
        });
    });
}
var session_reader_1 = require("./utils/session-reader");
Object.defineProperty(exports, "SessionReader", { enumerable: true, get: function () { return session_reader_1.SessionReader; } });
var auth_bridge_1 = require("./utils/auth-bridge");
Object.defineProperty(exports, "AuthBridge", { enumerable: true, get: function () { return auth_bridge_1.AuthBridge; } });
var context_bridge_1 = require("./utils/context-bridge");
Object.defineProperty(exports, "ContextBridge", { enumerable: true, get: function () { return context_bridge_1.ContextBridge; } });
var trae_executor_1 = require("./utils/trae-executor");
Object.defineProperty(exports, "TraeExecutor", { enumerable: true, get: function () { return trae_executor_1.TraeExecutor; } });
var acp_client_1 = require("./utils/acp-client");
Object.defineProperty(exports, "AcpClient", { enumerable: true, get: function () { return acp_client_1.AcpClient; } });
var acp_server_manager_1 = require("./utils/acp-server-manager");
Object.defineProperty(exports, "AcpServerManager", { enumerable: true, get: function () { return acp_server_manager_1.AcpServerManager; } });
