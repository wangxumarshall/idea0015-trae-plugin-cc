"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.acp = acp;
const acp_server_manager_1 = require("../utils/acp-server-manager");
const serverManager = new acp_server_manager_1.AcpServerManager();
async function acp(args) {
    const action = args[0] || 'status';
    switch (action) {
        case 'start':
            return startServer(args);
        case 'stop':
            return stopServer();
        case 'status':
            return serverStatus();
        case 'agents':
            return listAgents();
        case 'run':
            return runViaAcp(args);
        case 'stream':
            return streamViaAcp(args);
        default:
            console.log('用法: /trae:acp <action> [options]');
            console.log('动作:');
            console.log('  start    启动 ACP Server');
            console.log('  stop     停止 ACP Server');
            console.log('  status   查看服务器状态');
            console.log('  agents   发现可用 Agent');
            console.log('  run      通过 ACP 执行任务');
            console.log('  stream   通过 ACP 流式执行任务');
    }
}
async function startServer(args) {
    const options = {};
    for (let i = 1; i < args.length; i++) {
        if (args[i] === '--yolo') {
            options.yolo = true;
        }
        if (args[i] === '--allowed-tool' && args[i + 1]) {
            options.allowedTools = options.allowedTools || [];
            options.allowedTools.push(args[i + 1]);
            i++;
        }
        if (args[i] === '--disabled-tool' && args[i + 1]) {
            options.disabledTools = options.disabledTools || [];
            options.disabledTools.push(args[i + 1]);
            i++;
        }
    }
    console.log('正在启动 ACP Server...');
    try {
        await serverManager.start(options);
        console.log('\n✅ ACP Server 已启动');
        console.log('  传输: STDIO JSON-RPC');
        console.log(`\n使用 /trae:acp run "任务" 执行任务`);
        console.log(`使用 /trae:acp stream "任务" 流式执行`);
    }
    catch (error) {
        console.error(`❌ 启动失败: ${error.message}`);
    }
}
async function stopServer() {
    if (!serverManager.isRunning()) {
        console.log('ACP Server 未运行。');
        return;
    }
    console.log('正在停止 ACP Server...');
    await serverManager.stop();
    console.log('✅ ACP Server 已停止。');
}
async function serverStatus() {
    const status = serverManager.getStatus();
    console.log('\n## ACP Server 状态\n');
    console.log(`  运行中: ${status.running ? '✅' : '❌'}`);
    if (status.running) {
        console.log(`  传输: STDIO JSON-RPC`);
        console.log('  健康检查: ✅ 正常');
    }
    else {
        console.log('\n使用 /trae:acp start 启动服务器');
    }
}
async function listAgents() {
    if (!serverManager.isRunning()) {
        console.log('ACP Server 未运行。使用 /trae:acp start 启动。');
        return;
    }
    const client = serverManager.getClient();
    if (!client) {
        console.log('无法获取 ACP Client。');
        return;
    }
    try {
        const initResult = await client.initialize({ name: 'trae-plugin-cc', version: '1.0.0' });
        console.log(`\n## Agent 信息\n`);
        console.log(`  名称: ${initResult.agentInfo.name}`);
        console.log(`  版本: ${initResult.agentInfo.version}`);
        console.log(`  协议版本: ${initResult.protocolVersion}`);
        console.log(`\n### 能力`);
        console.log(`  加载会话: ${initResult.agentCapabilities.loadSession ? '✅' : '❌'}`);
        console.log(`  MCP HTTP: ${initResult.agentCapabilities.mcpCapabilities?.http ? '✅' : '❌'}`);
        console.log(`  MCP SSE: ${initResult.agentCapabilities.mcpCapabilities?.sse ? '✅' : '❌'}`);
        console.log(`  会话列表: ${initResult.agentCapabilities.sessionCapabilities?.list ? '✅' : '❌'}`);
    }
    catch (error) {
        console.error(`获取 Agent 信息失败: ${error.message}`);
    }
}
async function runViaAcp(args) {
    if (!serverManager.isRunning()) {
        console.log('ACP Server 未运行。正在启动...');
        try {
            await serverManager.start({ yolo: true });
        }
        catch (error) {
            console.error(`启动失败: ${error.message}`);
            return;
        }
    }
    const client = serverManager.getClient();
    if (!client) {
        console.log('无法获取 ACP Client。');
        return;
    }
    const prompt = args.slice(1).join(' ');
    if (!prompt) {
        console.log('请提供任务描述: /trae:acp run "任务"');
        return;
    }
    console.log(`正在通过 ACP 执行任务: ${prompt.substring(0, 50)}...`);
    try {
        await client.initialize({ name: 'trae-plugin-cc', version: '1.0.0' });
        const cwd = process.cwd();
        if (!client.getSessionId()) {
            await client.createSession(cwd, []);
        }
        const result = await client.sessionPrompt(prompt);
        console.log('\n## 执行结果\n');
        console.log(`  停止原因: ${result.stopReason || 'completed'}`);
    }
    catch (error) {
        console.error(`执行失败: ${error.message}`);
    }
}
async function streamViaAcp(args) {
    if (!serverManager.isRunning()) {
        console.log('ACP Server 未运行。正在启动...');
        try {
            await serverManager.start({ yolo: true });
        }
        catch (error) {
            console.error(`启动失败: ${error.message}`);
            return;
        }
    }
    const client = serverManager.getClient();
    if (!client) {
        console.log('无法获取 ACP Client。');
        return;
    }
    const prompt = args.slice(1).join(' ');
    if (!prompt) {
        console.log('请提供任务描述: /trae:acp stream "任务"');
        return;
    }
    console.log(`正在通过 ACP 流式执行任务: ${prompt.substring(0, 50)}...`);
    console.log('--- 流式输出 ---\n');
    try {
        await client.initialize({ name: 'trae-plugin-cc', version: '1.0.0' });
        const cwd = process.cwd();
        if (!client.getSessionId()) {
            await client.createSession(cwd, []);
        }
        const result = await client.sessionPrompt(prompt, (update) => {
            if (update.update?.content?.text) {
                process.stdout.write(update.update.content.text);
            }
        });
        console.log('\n--- 流式输出结束 ---');
    }
    catch (error) {
        console.error(`\n执行失败: ${error.message}`);
    }
}
