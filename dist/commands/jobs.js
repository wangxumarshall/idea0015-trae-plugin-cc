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
exports.getJobs = getJobs;
exports.status = status;
exports.result = result;
exports.cancel = cancel;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const PLUGIN_DIR = path.join(process.cwd(), '.claude-trae-plugin');
function getJobs() {
    if (!fs.existsSync(PLUGIN_DIR)) {
        return [];
    }
    const files = fs.readdirSync(PLUGIN_DIR);
    const pids = files.filter(f => f.endsWith('.pid')).map(f => f.replace('.pid', ''));
    return pids.map(pid => {
        const timestamp = parseInt(pid, 10);
        const logFile = path.join(PLUGIN_DIR, `${pid}.log`);
        const pidFile = path.join(PLUGIN_DIR, `${pid}.pid`);
        let status = '未知';
        if (fs.existsSync(pidFile)) {
            try {
                const processId = fs.readFileSync(pidFile, 'utf-8').trim();
                process.kill(parseInt(processId, 10), 0); // Check if process is running
                status = '运行中';
            }
            catch (e) {
                if (e.code === 'ESRCH') {
                    status = '已完成或已中止';
                }
                else {
                    status = '无法验证状态';
                }
            }
        }
        else {
            status = '已完成或已中止';
        }
        return { id: pid, timestamp, status, logFile, pidFile };
    });
}
function status(args) {
    const jobs = getJobs();
    if (jobs.length === 0) {
        console.log('当前没有运行或记录的后台任务。');
        return;
    }
    console.log('后台任务状态:\n');
    jobs.forEach(job => {
        const date = new Date(job.timestamp).toLocaleString();
        console.log(`[ID: ${job.id}] (${date}) 状态: ${job.status}`);
    });
}
function result(args) {
    const id = args[0];
    if (!id) {
        console.log('请提供任务 ID。例如: /trae:result 1633022... \n你可以用 /trae:status 获取任务 ID。');
        return;
    }
    const logFile = path.join(PLUGIN_DIR, `${id}.log`);
    if (!fs.existsSync(logFile)) {
        console.log(`找不到 ID 为 ${id} 的日志文件。`);
        return;
    }
    const content = fs.readFileSync(logFile, 'utf-8');
    console.log(`任务 ${id} 的结果输出:\n`);
    console.log(content);
}
function cancel(args) {
    const id = args[0];
    if (!id) {
        console.log('请提供要取消的任务 ID。例如: /trae:cancel 1633022... \n你可以用 /trae:status 获取任务 ID。');
        return;
    }
    const pidFile = path.join(PLUGIN_DIR, `${id}.pid`);
    if (!fs.existsSync(pidFile)) {
        console.log(`找不到 ID 为 ${id} 的任务记录。它可能已经完成或被清理。`);
        return;
    }
    try {
        const pidStr = fs.readFileSync(pidFile, 'utf-8').trim();
        const pid = parseInt(pidStr, 10);
        process.kill(pid, 'SIGKILL'); // Force kill
        console.log(`已发送强制终止信号给任务 ${id} (PID: ${pid})。`);
        fs.unlinkSync(pidFile); // Remove pid file
    }
    catch (e) {
        if (e.code === 'ESRCH') {
            console.log(`任务 ${id} 的进程已经不再运行。`);
        }
        else {
            console.error(`取消任务时发生错误: ${e.message}`);
        }
    }
}
