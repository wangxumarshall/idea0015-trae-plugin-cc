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
exports.SessionReader = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
class SessionReader {
    sessionsDir;
    historyFile;
    jsonOutputCache = new Map();
    constructor() {
        const homeDir = os.homedir();
        const candidates = [
            path.join(homeDir, 'Library', 'Caches', 'trae-cli'),
            path.join(homeDir, 'Library', 'Caches', 'trae_cli'),
            path.join(homeDir, '.cache', 'trae-cli'),
            path.join(homeDir, '.cache', 'trae_cli'),
        ];
        const cacheDir = candidates.find(dir => fs.existsSync(dir)) || candidates[0];
        this.sessionsDir = path.join(cacheDir, 'sessions');
        this.historyFile = path.join(cacheDir, 'history.jsonl');
    }
    listSessions(options) {
        if (!fs.existsSync(this.sessionsDir))
            return [];
        const sessions = fs.readdirSync(this.sessionsDir)
            .filter(dir => {
            const sessionFile = path.join(this.sessionsDir, dir, 'session.json');
            return fs.existsSync(sessionFile);
        })
            .map(dir => {
            try {
                const content = fs.readFileSync(path.join(this.sessionsDir, dir, 'session.json'), 'utf-8');
                return JSON.parse(content);
            }
            catch {
                return null;
            }
        })
            .filter((s) => s !== null)
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        let filtered = sessions;
        if (options?.cwd) {
            filtered = filtered.filter(s => s.metadata.cwd === options.cwd);
        }
        if (options?.limit) {
            filtered = filtered.slice(0, options.limit);
        }
        return filtered;
    }
    getSession(sessionId) {
        const filePath = path.join(this.sessionsDir, sessionId, 'session.json');
        if (!fs.existsSync(filePath))
            return null;
        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        }
        catch {
            return null;
        }
    }
    getEvents(sessionId) {
        const filePath = path.join(this.sessionsDir, sessionId, 'events.jsonl');
        if (!fs.existsSync(filePath))
            return [];
        const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
        return lines
            .filter(line => line.trim())
            .map(line => {
            try {
                return JSON.parse(line);
            }
            catch {
                return null;
            }
        })
            .filter((e) => e !== null);
    }
    getConversation(sessionId, options) {
        const events = this.getEvents(sessionId);
        let messages = events
            .filter(e => e.message)
            .map(e => {
            const msg = e.message.message;
            let content = '';
            if (typeof msg.content === 'string') {
                content = msg.content;
            }
            else if (Array.isArray(msg.content)) {
                content = msg.content.map(c => c.text || '').join('\n');
            }
            return {
                role: msg.role,
                content,
                toolCalls: msg.tool_calls?.map(tc => tc.function.name),
                timestamp: e.created_at,
            };
        });
        if (options?.limit) {
            messages = messages.slice(-options.limit);
        }
        return messages;
    }
    getToolCalls(sessionId) {
        const events = this.getEvents(sessionId);
        const callMap = new Map();
        for (const e of events) {
            if (e.tool_call) {
                callMap.set(e.tool_call.tool_call_id, {
                    id: e.tool_call.tool_call_id,
                    name: e.tool_call.tool_info.name,
                    input: e.tool_call.input,
                    timestamp: e.created_at,
                });
            }
        }
        for (const e of events) {
            if (e.tool_call_output) {
                const call = callMap.get(e.tool_call_output.tool_call_id);
                if (call) {
                    call.output = e.tool_call_output.output;
                    call.isError = e.tool_call_output.is_error;
                }
            }
        }
        return Array.from(callMap.values());
    }
    getFileTrackStatus(sessionId) {
        const events = this.getEvents(sessionId);
        for (const e of events) {
            if (e.state_update?.updates?.file_track_status) {
                return e.state_update.updates.file_track_status;
            }
        }
        return {};
    }
    getRecentSession(cwd) {
        const sessions = this.listSessions({ cwd });
        return sessions[0] || null;
    }
    findSessionByTopic(topic) {
        const sessions = this.listSessions();
        const match = sessions.find(s => s.metadata.title.toLowerCase().includes(topic.toLowerCase()));
        return match || null;
    }
    getContextSummary(sessionId) {
        const meta = this.getSession(sessionId);
        if (!meta)
            return '会话不存在';
        const conversation = this.getConversation(sessionId, { limit: 20 });
        const toolCalls = this.getToolCalls(sessionId);
        let summary = `## 会话: ${meta.metadata.title}\n`;
        summary += `- ID: ${meta.id}\n`;
        summary += `- 工作目录: ${meta.metadata.cwd}\n`;
        summary += `- 模型: ${meta.metadata.model_name}\n`;
        summary += `- 权限模式: ${meta.metadata.permission_mode}\n`;
        summary += `- 创建时间: ${meta.created_at}\n`;
        summary += `- 更新时间: ${meta.updated_at}\n\n`;
        summary += `### 最近对话 (${conversation.length} 条消息)\n`;
        for (const msg of conversation) {
            const content = msg.content.length > 200
                ? msg.content.substring(0, 200) + '...'
                : msg.content;
            summary += `**${msg.role}**: ${content}`;
            if (msg.toolCalls?.length) {
                summary += ` [调用工具: ${msg.toolCalls.join(', ')}]`;
            }
            summary += '\n\n';
        }
        summary += `### 工具调用统计 (${toolCalls.length} 次)\n`;
        const toolStats = {};
        for (const tc of toolCalls) {
            toolStats[tc.name] = (toolStats[tc.name] || 0) + 1;
        }
        for (const [name, count] of Object.entries(toolStats)) {
            summary += `- ${name}: ${count} 次\n`;
        }
        return summary;
    }
    getHistory() {
        if (!fs.existsSync(this.historyFile))
            return [];
        const lines = fs.readFileSync(this.historyFile, 'utf-8').split('\n');
        return lines
            .filter(line => line.trim())
            .map(line => {
            try {
                return JSON.parse(line);
            }
            catch {
                return null;
            }
        })
            .filter((h) => h !== null);
    }
    deleteSession(sessionId) {
        const sessionDir = path.join(this.sessionsDir, sessionId);
        if (!fs.existsSync(sessionDir))
            return false;
        try {
            fs.rmSync(sessionDir, { recursive: true, force: true });
            return true;
        }
        catch {
            return false;
        }
    }
    cacheJsonOutput(sessionId, output) {
        this.jsonOutputCache.set(sessionId, output);
    }
    getJsonOutputSession(sessionId) {
        return this.jsonOutputCache.get(sessionId) || null;
    }
    getSessionsDir() {
        return this.sessionsDir;
    }
}
exports.SessionReader = SessionReader;
