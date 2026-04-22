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
exports.AuthBridge = void 0;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const yaml = __importStar(require("js-yaml"));
class AuthBridge {
    configPath;
    config = null;
    constructor() {
        this.configPath = path.join(os.homedir(), '.trae', 'trae_cli.yaml');
    }
    loadConfig() {
        if (this.config)
            return this.config;
        if (fs.existsSync(this.configPath)) {
            try {
                const content = fs.readFileSync(this.configPath, 'utf-8');
                this.config = yaml.load(content);
                return this.config;
            }
            catch {
                return null;
            }
        }
        return null;
    }
    async checkAuthStatus() {
        const config = this.loadConfig();
        let authenticated = false;
        try {
            (0, child_process_1.execSync)('trae-cli config edit --help', { stdio: 'ignore' });
            authenticated = true;
        }
        catch {
            authenticated = config !== null;
        }
        return {
            authenticated,
            model: config?.model?.name || 'unknown',
            loginUrl: config?.trae_login_base_url || 'https://console.enterprise.trae.cn',
            configPath: this.configPath,
            configExists: fs.existsSync(this.configPath),
        };
    }
    getLoginBaseUrl() {
        if (!this.config)
            this.loadConfig();
        return this.config?.trae_login_base_url || 'https://console.enterprise.trae.cn';
    }
    getModelName() {
        if (!this.config)
            this.loadConfig();
        return this.config?.model?.name || 'unknown';
    }
    getAllowedTools() {
        if (!this.config)
            this.loadConfig();
        return this.config?.allowed_tools || [];
    }
    getPlugins() {
        if (!this.config)
            this.loadConfig();
        return this.config?.plugins || [];
    }
    buildSpawnEnv() {
        const env = { ...process.env };
        const homeBin = path.join(os.homedir(), '.local', 'bin');
        const existingPath = env.PATH || '';
        if (!existingPath.split(':').includes(homeBin)) {
            env.PATH = `${homeBin}:${existingPath}`;
        }
        return env;
    }
}
exports.AuthBridge = AuthBridge;
