"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AcpServerManager = void 0;
const child_process_1 = require("child_process");
const acp_client_1 = require("../utils/acp-client");
class AcpServerManager {
    process = null;
    client = null;
    async start(options) {
        if (this.isRunning()) {
            return {
                client: this.client,
            };
        }
        return new Promise((resolve, reject) => {
            const args = ['acp', 'serve'];
            if (options?.yolo)
                args.push('--yolo');
            if (options?.allowedTools) {
                for (const tool of options.allowedTools) {
                    args.push('--allowed-tool', tool);
                }
            }
            if (options?.disabledTools) {
                for (const tool of options.disabledTools) {
                    args.push('--disabled-tool', tool);
                }
            }
            const startupEvents = [];
            const outputSnippets = [];
            let started = false;
            let settled = false;
            const recordEvent = (event, detail) => {
                startupEvents.push({
                    at: new Date().toISOString(),
                    event,
                    detail,
                });
            };
            const rememberOutput = (source, text) => {
                const normalized = text.replace(/\s+/g, ' ').trim();
                if (!normalized)
                    return;
                outputSnippets.push(`[${source}] ${normalized}`);
                if (outputSnippets.length > 8)
                    outputSnippets.shift();
            };
            const buildDiagnostic = () => {
                const trace = startupEvents
                    .map((item, idx) => `${idx + 1}. ${item.at} ${item.event}${item.detail ? ` | ${item.detail}` : ''}`)
                    .join('\n');
                const recentOutput = outputSnippets.length > 0
                    ? outputSnippets.map((line, idx) => `${idx + 1}. ${line}`).join('\n')
                    : 'none';
                return `\n[ACP] startup diagnostics\ntrace:\n${trace || 'none'}\nrecent_output:\n${recentOutput}`;
            };
            const fail = (message) => {
                if (settled)
                    return;
                settled = true;
                reject(new Error(`${message}${buildDiagnostic()}`));
            };
            const succeed = () => {
                if (settled)
                    return;
                settled = true;
                const client = new acp_client_1.AcpClient(child.stdin, child.stdout, child.stderr);
                this.process = child;
                this.client = client;
                recordEvent('stdio:ready');
                resolve({ client });
            };
            const env = { ...process.env };
            const homeBin = require('path').join(require('os').homedir(), '.local', 'bin');
            const existingPath = env.PATH || '';
            if (!existingPath.split(':').includes(homeBin)) {
                env.PATH = `${homeBin}:${existingPath}`;
            }
            if (process.env.TRAECLI_PERSONAL_ACCESS_TOKEN) {
                env.TRAECLI_PERSONAL_ACCESS_TOKEN = process.env.TRAECLI_PERSONAL_ACCESS_TOKEN;
            }
            recordEvent('spawn:start', `cmd=trae-cli ${args.join(' ')}`);
            // 关键修复：使用 pipe 而不是 ignore, 保持 stdin 打开
            // ACP 协议使用 STDIO JSON-RPC, 需要 stdin 保持连接
            const child = (0, child_process_1.spawn)('trae-cli', args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                env,
            });
            recordEvent('spawn:created', `pid=${child.pid || 'unknown'}`);
            child.stdout?.on('data', (chunk) => {
                rememberOutput('stdout', chunk.toString());
            });
            child.stderr?.on('data', (chunk) => {
                rememberOutput('stderr', chunk.toString());
            });
            child.on('error', (err) => {
                recordEvent('process:error', err.message);
                fail(`ACP server spawn failed: ${err.message}`);
            });
            child.on('close', (code, signal) => {
                recordEvent('process:close', `code=${code ?? 'null'}, signal=${signal ?? 'null'}`);
                this.process = null;
                if (!started) {
                    fail(`ACP server exited before ready (code=${code ?? 'null'}, signal=${signal ?? 'null'})`);
                }
            });
            // 等待进程启动
            // trae-cli 认证成功后会通过 stderr 输出日志
            setTimeout(() => {
                if (!started && !settled) {
                    const alive = child.exitCode === null;
                    recordEvent('startup:timeout', `alive=${alive}, exitCode=${child.exitCode ?? 'null'}`);
                    if (alive) {
                        started = true;
                        succeed();
                        return;
                    }
                    fail('ACP server startup timeout (15s)');
                }
            }, 5000);
        });
    }
    async stop() {
        if (this.process) {
            this.process.stdin?.end();
            this.process.kill('SIGTERM');
            await new Promise((resolve) => {
                setTimeout(() => {
                    if (this.process) {
                        this.process.kill('SIGKILL');
                    }
                    resolve();
                }, 3000);
            });
            this.process = null;
            this.client = null;
        }
    }
    isRunning() {
        return this.process !== null && this.process.exitCode === null;
    }
    getClient() {
        return this.client;
    }
    getStatus() {
        return {
            running: this.isRunning(),
            baseUrl: this.isRunning() ? 'stdio://trae-cli' : '',
        };
    }
}
exports.AcpServerManager = AcpServerManager;
