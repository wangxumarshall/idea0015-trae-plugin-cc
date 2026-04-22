"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AcpClient = void 0;
class AcpClient {
    stdin;
    stdout;
    stderr;
    messageId = 0;
    pendingRequests = new Map();
    initialized = false;
    sessionId = null;
    onUpdates = [];
    constructor(stdin, stdout, stderr) {
        this.stdin = stdin;
        this.stdout = stdout;
        this.stderr = stderr;
        this.stdout.on('data', (chunk) => {
            this.handleMessages(chunk.toString());
        });
    }
    async initialize(clientInfo = { name: 'trae-plugin-cc', version: '1.0.0' }) {
        if (this.initialized) {
            throw new Error('Already initialized');
        }
        const result = await this.request('initialize', {
            protocolVersion: 1,
            clientCapabilities: {},
            clientInfo,
        });
        this.initialized = true;
        return result;
    }
    async createSession(cwd, mcpServers = []) {
        if (!this.initialized) {
            throw new Error('Not initialized. Call initialize() first');
        }
        const result = await this.request('session/new', {
            cwd,
            mcpServers,
        });
        this.sessionId = result.sessionId;
        return result;
    }
    async loadSession(sessionId, cwd, mcpServers = []) {
        if (!this.initialized) {
            throw new Error('Not initialized. Call initialize() first');
        }
        await this.request('session/load', {
            sessionId,
            cwd,
            mcpServers,
        });
        this.sessionId = sessionId;
    }
    async sessionPrompt(prompt, onUpdate) {
        if (!this.sessionId) {
            throw new Error('No active session. Call createSession() or loadSession() first');
        }
        if (onUpdate) {
            this.onUpdates.push(onUpdate);
        }
        try {
            return await this.request('session/prompt', {
                sessionId: this.sessionId,
                prompt: [{ content: prompt, content_type: 'text/plain' }],
            });
        }
        finally {
            if (onUpdate) {
                this.onUpdates = this.onUpdates.filter((fn) => fn !== onUpdate);
            }
        }
    }
    async sessionCancel() {
        if (!this.sessionId) {
            throw new Error('No active session');
        }
        await this.request('session/cancel', { sessionId: this.sessionId });
    }
    getSessionId() {
        return this.sessionId;
    }
    handleMessages(text) {
        const lines = text.split('\n').filter((line) => line.trim());
        for (const line of lines) {
            let message;
            try {
                message = JSON.parse(line);
            }
            catch {
                continue;
            }
            if (message.id !== undefined && this.pendingRequests.has(message.id)) {
                const pending = this.pendingRequests.get(message.id);
                this.pendingRequests.delete(message.id);
                if (message.error) {
                    pending.reject(new Error(message.error.message || JSON.stringify(message.error)));
                }
                else {
                    pending.resolve(message.result);
                }
            }
            else if (message.method === 'session/update' && message.params) {
                for (const fn of this.onUpdates) {
                    fn(message.params);
                }
            }
        }
    }
    request(method, params) {
        const id = ++this.messageId;
        const message = {
            jsonrpc: '2.0',
            id,
            method,
            params,
        };
        return new Promise((resolve, reject) => {
            this.pendingRequests.set(id, { resolve, reject });
            this.stdin.write(JSON.stringify(message) + '\n', (err) => {
                if (err) {
                    this.pendingRequests.delete(id);
                    reject(new Error(`Failed to write to stdin: ${err.message}`));
                }
            });
        });
    }
}
exports.AcpClient = AcpClient;
