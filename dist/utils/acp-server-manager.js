"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AcpServerManager = void 0;
const child_process_1 = require("child_process");
const acp_client_1 = require("../utils/acp-client");
class AcpServerManager {
    process = null;
    port = 0;
    client = null;
    async start(options) {
        if (this.isRunning()) {
            return {
                port: this.port,
                baseUrl: `http://localhost:${this.port}`,
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
            const child = (0, child_process_1.spawn)('trae-cli', args, {
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            let started = false;
            const detectPort = (text) => {
                const portMatch = text.match(/listening.*?:(\d+)/i) ||
                    text.match(/port.*?(\d+)/i) ||
                    text.match(/http:\/\/localhost:(\d+)/i) ||
                    text.match(/:(\d{4,5})/);
                if (portMatch && !started) {
                    started = true;
                    this.port = parseInt(portMatch[1], 10);
                    this.process = child;
                    this.client = new acp_client_1.AcpClient(`http://localhost:${this.port}`);
                    resolve({
                        port: this.port,
                        baseUrl: `http://localhost:${this.port}`,
                    });
                }
            };
            child.stdout?.on('data', (chunk) => detectPort(chunk.toString()));
            child.stderr?.on('data', (chunk) => detectPort(chunk.toString()));
            child.on('error', (err) => {
                if (!started)
                    reject(err);
            });
            child.on('close', (code) => {
                this.process = null;
                if (!started)
                    reject(new Error(`ACP server exited with code ${code}`));
            });
            setTimeout(() => {
                if (!started) {
                    child.kill('SIGTERM');
                    reject(new Error('ACP server startup timeout (15s)'));
                }
            }, 15000);
        });
    }
    async stop() {
        if (this.process) {
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
            this.port = 0;
            this.client = null;
        }
    }
    isRunning() {
        return this.process !== null && this.process.exitCode === null;
    }
    getPort() {
        return this.port;
    }
    getClient() {
        return this.client;
    }
    getStatus() {
        return {
            running: this.isRunning(),
            port: this.port,
            baseUrl: this.port ? `http://localhost:${this.port}` : '',
        };
    }
}
exports.AcpServerManager = AcpServerManager;
