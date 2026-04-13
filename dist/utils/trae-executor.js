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
exports.TraeExecutor = void 0;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const auth_bridge_1 = require("./auth-bridge");
const PLUGIN_DIR = path.join(process.cwd(), '.claude-trae-plugin');
function ensurePluginDir() {
    if (!fs.existsSync(PLUGIN_DIR)) {
        fs.mkdirSync(PLUGIN_DIR, { recursive: true });
    }
}
class TraeExecutor {
    authBridge;
    constructor() {
        this.authBridge = new auth_bridge_1.AuthBridge();
    }
    async execute(config) {
        ensurePluginDir();
        const taskId = Date.now().toString();
        const logFile = path.join(PLUGIN_DIR, `${taskId}.log`);
        const pidFile = path.join(PLUGIN_DIR, `${taskId}.pid`);
        const args = this.buildArgs(config);
        const env = this.authBridge.buildSpawnEnv();
        const startTime = Date.now();
        if (config.background) {
            return this.executeBackground(args, env, taskId, logFile, pidFile, startTime);
        }
        return this.executeForeground(args, env, taskId, logFile, pidFile, startTime, config.jsonOutput);
    }
    buildArgs(config) {
        const args = [];
        if (config.allowedTools) {
            for (const tool of config.allowedTools) {
                args.push('--allowed-tool', tool);
            }
        }
        if (config.disallowedTools) {
            for (const tool of config.disallowedTools) {
                args.push('--disallowed-tool', tool);
            }
        }
        if (config.yolo)
            args.push('--yolo');
        if (config.queryTimeout)
            args.push('--query-timeout', config.queryTimeout);
        if (config.bashToolTimeout)
            args.push('--bash-tool-timeout', config.bashToolTimeout);
        if (config.sessionId)
            args.push('--session-id', config.sessionId);
        if (config.resume) {
            if (config.resume === 'AUTO') {
                args.push('--resume');
            }
            else {
                args.push('--resume', config.resume);
            }
        }
        if (config.worktree) {
            if (config.worktree === '__auto__') {
                args.push('--worktree');
            }
            else {
                args.push('--worktree', config.worktree);
            }
        }
        if (config.configOverrides) {
            for (const [k, v] of Object.entries(config.configOverrides)) {
                args.push('-c', `${k}=${v}`);
            }
        }
        args.push('--print');
        if (config.jsonOutput) {
            args.push('--json');
        }
        args.push(config.prompt);
        return args;
    }
    executeBackground(args, env, taskId, logFile, pidFile, startTime) {
        const out = fs.openSync(logFile, 'a');
        const err = fs.openSync(logFile, 'a');
        const child = (0, child_process_1.spawn)('trae-cli', args, {
            detached: true,
            stdio: ['ignore', out, err],
            env,
        });
        child.unref();
        if (child.pid) {
            fs.writeFileSync(pidFile, child.pid.toString());
        }
        return {
            taskId,
            output: `任务已在后台启动 (ID: ${taskId})\n日志文件: ${logFile}`,
            exitCode: null,
            duration: Date.now() - startTime,
        };
    }
    executeForeground(args, env, taskId, logFile, pidFile, startTime, parseJson = false) {
        return new Promise((resolve, reject) => {
            const child = (0, child_process_1.spawn)('trae-cli', args, {
                stdio: ['ignore', 'pipe', 'pipe'],
                env,
            });
            if (child.pid) {
                fs.writeFileSync(pidFile, child.pid.toString());
            }
            let combinedOutput = '';
            const append = (chunk) => {
                const text = chunk.toString();
                combinedOutput += text;
                fs.appendFileSync(logFile, text);
            };
            child.stdout?.on('data', append);
            child.stderr?.on('data', append);
            child.on('error', (error) => {
                if (fs.existsSync(pidFile))
                    fs.unlinkSync(pidFile);
                reject(new Error(`执行失败: ${error.message}`));
            });
            child.on('close', (code) => {
                if (fs.existsSync(pidFile))
                    fs.unlinkSync(pidFile);
                let jsonOutput = undefined;
                let sessionId;
                if (parseJson && combinedOutput.trim()) {
                    try {
                        jsonOutput = JSON.parse(combinedOutput);
                        sessionId = jsonOutput?.session_id;
                    }
                    catch { }
                }
                resolve({
                    taskId,
                    output: combinedOutput,
                    exitCode: code,
                    sessionId,
                    duration: Date.now() - startTime,
                    jsonOutput,
                });
            });
        });
    }
}
exports.TraeExecutor = TraeExecutor;
