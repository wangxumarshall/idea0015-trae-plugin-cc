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
exports.AcpClient = void 0;
const http = __importStar(require("http"));
class AcpClient {
    baseUrl;
    constructor(baseUrl = 'http://localhost:8000') {
        this.baseUrl = baseUrl;
    }
    async discoverAgents() {
        try {
            const result = await this.request('GET', '/agents');
            return result.agents || [];
        }
        catch {
            return [];
        }
    }
    async runAgent(req) {
        return this.request('POST', '/runs', req);
    }
    async getRun(runId) {
        return this.request('GET', `/runs/${runId}`);
    }
    async runStream(req, onEvent) {
        const url = new URL('/runs/stream', this.baseUrl);
        const payload = JSON.stringify(req);
        return new Promise((resolve, reject) => {
            const options = {
                hostname: url.hostname,
                port: url.port || 80,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream',
                    'Content-Length': Buffer.byteLength(payload),
                },
            };
            const httpReq = http.request(options, (res) => {
                let buffer = '';
                res.on('data', (chunk) => {
                    buffer += chunk.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                onEvent(JSON.parse(line.substring(6)));
                            }
                            catch { }
                        }
                    }
                });
                res.on('end', resolve);
                res.on('error', reject);
            });
            httpReq.on('error', reject);
            httpReq.write(payload);
            httpReq.end();
        });
    }
    async healthCheck() {
        try {
            await this.request('GET', '/agents');
            return true;
        }
        catch {
            return false;
        }
    }
    request(method, urlPath, body) {
        const url = new URL(urlPath, this.baseUrl);
        return new Promise((resolve, reject) => {
            const options = {
                hostname: url.hostname,
                port: url.port || 80,
                path: url.pathname + url.search,
                method,
                headers: {},
            };
            if (body) {
                const payload = JSON.stringify(body);
                options.headers = {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload),
                };
            }
            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    }
                    catch {
                        resolve(data);
                    }
                });
            });
            req.on('error', reject);
            if (body)
                req.write(JSON.stringify(body));
            req.end();
        });
    }
}
exports.AcpClient = AcpClient;
