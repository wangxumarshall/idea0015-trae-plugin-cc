import * as readline from 'readline';
import { AcpServerManager } from '../utils/acp-server-manager';
import { AcpClient } from '../utils/acp-client';
import { SessionReader } from '../utils/session-reader';
import {
  HostSessionSummaryArgs,
  HostSessionSummaryBridge,
  HostSessionSummaryConfig,
  splitHostSessionSummaryOverrides,
} from '../utils/host-session-summary';

interface StartOptions {
  yolo?: boolean;
  allowedTools?: string[];
  disabledTools?: string[];
}

interface PromptActionOptions extends StartOptions, HostSessionSummaryArgs {
  prompt: string;
  configOverrides?: Record<string, string>;
  hostSummaryConfig?: HostSessionSummaryConfig;
}

interface ChatOptions extends PromptActionOptions {
  sessionId?: string;
  resume?: string;
  cwd: string;
}

type LocalChatAction = 'prompt' | 'handled' | 'exit';

const serverManager = new AcpServerManager();
const hostSummaryBridge = new HostSessionSummaryBridge();

export async function acp(args: string[]): Promise<void> {
  const action = args[0] || 'status';

  const handlers: Record<string, () => Promise<void>> = {
    start: () => startServer(args),
    stop: stopServer,
    status: serverStatus,
    agents: listAgents,
    run: () => runViaAcp(args),
    stream: () => streamViaAcp(args),
    chat: () => chatViaAcp(args),
  };

  const handler = handlers[action];
  if (!handler) {
    printUsage();
    return;
  }

  await handler();
}

function printUsage(): void {
  console.log('用法: acp <action> [options]');
  console.log('动作:');
  console.log('  start    启动 ACP Server');
  console.log('  stop     停止 ACP Server');
  console.log('  status   查看服务器状态');
  console.log('  agents   发现可用 Agent');
  console.log('  run      通过 ACP 执行任务');
  console.log('  stream   通过 ACP 流式执行任务');
  console.log('  chat     通过 ACP 进行多轮对话');
}

async function startServer(args: string[]): Promise<void> {
  const options = parseStartOptions(args, 1);

  console.log('正在启动 ACP Server...');

  try {
    await serverManager.start(options);
    console.log('\nACP Server 已启动');
    console.log('  传输: STDIO JSON-RPC');
    console.log('\n使用 acp run "任务" 执行任务');
    console.log('使用 acp stream "任务" 流式执行');
    console.log('使用 acp chat "任务" 进入多轮对话');
    await new Promise(() => {});
  } catch (error: unknown) {
    console.error(`启动失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function stopServer(): Promise<void> {
  if (!serverManager.isRunning()) {
    console.log('ACP Server 未运行。');
    return;
  }

  console.log('正在停止 ACP Server...');
  await serverManager.stop();
  console.log('ACP Server 已停止。');
}

async function serverStatus(): Promise<void> {
  const status = serverManager.getStatus();

  console.log('\nACP Server 状态\n');
  console.log(`  运行中: ${status.running ? '是' : '否'}`);
  if (status.running) {
    console.log('  传输: STDIO JSON-RPC');
    console.log('  健康检查: 正常');
  } else {
    console.log('\n使用 acp start 启动服务器');
  }
}

async function listAgents(): Promise<void> {
  if (!await ensureServerRunning()) return;

  const client = serverManager.getClient();
  if (!client) {
    console.log('无法获取 ACP Client。');
    return;
  }

  try {
    const initResult = await client.initialize({ name: 'trae-plugin-cc', version: '1.0.0' });
    console.log('\nAgent 信息\n');
    if (initResult.agentInfo) {
      console.log(`  名称: ${initResult.agentInfo.name}`);
      console.log(`  版本: ${initResult.agentInfo.version}`);
    }
    console.log(`  协议版本: ${initResult.protocolVersion}`);
    console.log('\n能力');
    console.log(`  加载会话: ${initResult.agentCapabilities.loadSession ? '是' : '否'}`);
    console.log(`  MCP HTTP: ${initResult.agentCapabilities.mcpCapabilities?.http ? '是' : '否'}`);
    console.log(`  MCP SSE: ${initResult.agentCapabilities.mcpCapabilities?.sse ? '是' : '否'}`);
    console.log(`  会话列表: ${initResult.agentCapabilities.sessionCapabilities?.list ? '是' : '否'}`);
  } catch (error: unknown) {
    console.error(`获取 Agent 信息失败: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await serverManager.stop();
  }
}

async function runViaAcp(args: string[]): Promise<void> {
  const options = parsePromptActionArgs(args, 1);
  if (!options.prompt) {
    console.log('请提供任务描述: acp run "任务"');
    return;
  }

  if (!await ensureServerRunning(getPromptStartOptions(options))) return;

  const client = serverManager.getClient();
  if (!client) {
    console.log('无法获取 ACP Client。');
    return;
  }

  try {
    const prompt = buildPromptWithHostSummary(options);
    console.log(`通过 ACP 执行任务: ${options.prompt.substring(0, 50)}...`);
    console.log('正在初始化...');
    await client.initialize({ name: 'trae-plugin-cc', version: '1.0.0' });
    console.log('初始化成功');

    const cwd = process.cwd();
    console.log('正在创建会话...');
    if (!client.getSessionId()) {
      await client.createSession(cwd, []);
    }
    console.log(`会话已创建: ${client.getSessionId()}`);

    console.log('\n--- 开始执行 ---\n');
    let output = '';
    const result = await client.sessionPrompt(prompt, (update) => {
      if (update.update?.content?.text) {
        output += update.update.content.text;
        process.stdout.write(update.update.content.text);
      }
    });

    console.log('\n--- 执行结束 ---\n');
    if (output) {
      console.log('输出\n');
      console.log(output);
    }
    console.log(`\n停止原因: ${result.stopReason || 'completed'}`);
  } catch (error: unknown) {
    console.error(`\n执行失败: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    console.log('正在停止 ACP Server...');
    await serverManager.stop();
  }
}

async function streamViaAcp(args: string[]): Promise<void> {
  const options = parsePromptActionArgs(args, 1);
  if (!options.prompt) {
    console.log('请提供任务描述: acp stream "任务"');
    return;
  }

  if (!await ensureServerRunning(getPromptStartOptions(options))) return;

  const client = serverManager.getClient();
  if (!client) {
    console.log('无法获取 ACP Client。');
    return;
  }

  try {
    const prompt = buildPromptWithHostSummary(options);
    console.log(`通过 ACP 流式执行任务: ${options.prompt.substring(0, 50)}...`);
    await client.initialize({ name: 'trae-plugin-cc', version: '1.0.0' });

    const cwd = process.cwd();
    if (!client.getSessionId()) {
      await client.createSession(cwd, []);
    }

    console.log('\n--- 流式输出 ---\n');
    await client.sessionPrompt(prompt, (update) => {
      if (update.update?.content?.text) {
        process.stdout.write(update.update.content.text);
      }
    });
    console.log('\n--- 流式输出结束 ---');
  } catch (error: unknown) {
    console.error(`\n执行失败: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await serverManager.stop();
  }
}

async function chatViaAcp(args: string[]): Promise<void> {
  const options = parseChatArgs(args.slice(1));
  const interactive = isInteractiveTerminal();

  if (!options.prompt && !interactive) {
    console.log('请提供首轮消息，或在交互终端中运行: acp chat "任务"');
    return;
  }

  if (!await ensureServerRunning(getChatStartOptions(options))) return;

  const client = serverManager.getClient();
  if (!client) {
    console.log('无法获取 ACP Client。');
    return;
  }

  try {
    await client.initialize({ name: 'trae-plugin-cc', version: '1.0.0' });

    const session = await prepareChatSession(client, options);
    if (!session) {
      return;
    }

    console.log('\nACP Chat 已连接');
    console.log(`  会话 ID: ${session.sessionId}`);
    console.log(`  工作目录: ${options.cwd}`);
    console.log(`  模式: ${session.resumed ? '恢复已有会话' : '新建会话'}`);

    if (interactive) {
      console.log('  输入 /help 查看本地命令');
    } else {
      console.log('  非交互模式: 执行单轮消息后退出');
    }

    if (options.prompt) {
      await streamChatPrompt(client, buildPromptWithHostSummary(options));
    }

    if (interactive) {
      await runChatRepl(client);
    }
  } catch (error: unknown) {
    console.error(`\n执行失败: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await serverManager.stop();
  }
}

function parseStartOptions(args: string[], startFrom: number): StartOptions {
  const options: StartOptions = {};

  for (let i = startFrom; i < args.length; i++) {
    if (args[i] === '--yolo') {
      options.yolo = true;
    } else if (args[i] === '--allowed-tool' && args[i + 1]) {
      options.allowedTools = options.allowedTools || [];
      options.allowedTools.push(args[i + 1]);
      i++;
    } else if (args[i] === '--disabled-tool' && args[i + 1]) {
      options.disabledTools = options.disabledTools || [];
      options.disabledTools.push(args[i + 1]);
      i++;
    }
  }

  return options;
}

function parsePromptActionArgs(args: string[], startFrom: number): PromptActionOptions {
  const options: PromptActionOptions = {
    prompt: '',
  };
  const promptParts: string[] = [];

  for (let i = startFrom; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--yolo') {
      options.yolo = true;
    } else if (arg === '--allowed-tool' && args[i + 1]) {
      options.allowedTools = options.allowedTools || [];
      options.allowedTools.push(args[i + 1]);
      i++;
    } else if (arg === '--disabled-tool' && args[i + 1]) {
      options.disabledTools = options.disabledTools || [];
      options.disabledTools.push(args[i + 1]);
      i++;
    } else if (arg === '-c' && args[i + 1]) {
      const override = args[i + 1];
      options.configOverrides = options.configOverrides || {};
      const eqIdx = override.indexOf('=');
      if (eqIdx > 0) {
        options.configOverrides[override.substring(0, eqIdx)] = override.substring(eqIdx + 1);
      }
      i++;
    } else if (arg === '--inject-current-session') {
      options.injectCurrentSession = true;
    } else if (arg === '--session-summary-source' && args[i + 1]) {
      options.sessionSummarySource = args[i + 1];
      i++;
    } else if (arg.startsWith('--session-summary-source=')) {
      options.sessionSummarySource = arg.substring('--session-summary-source='.length);
    } else if (arg === '--session-summary-text' && args[i + 1]) {
      options.sessionSummaryText = args[i + 1];
      i++;
    } else if (arg.startsWith('--session-summary-text=')) {
      options.sessionSummaryText = arg.substring('--session-summary-text='.length);
    } else if (arg === '--host-session-id' && args[i + 1]) {
      options.hostSessionId = args[i + 1];
      i++;
    } else if (arg.startsWith('--host-session-id=')) {
      options.hostSessionId = arg.substring('--host-session-id='.length);
    } else if (!arg.startsWith('-')) {
      promptParts.push(arg);
    }
  }

  const { hostConfig, remainingOverrides } = splitHostSessionSummaryOverrides(options.configOverrides);
  options.hostSummaryConfig = hostConfig;
  options.configOverrides = remainingOverrides;
  options.prompt = promptParts.join(' ').trim();
  return options;
}

function parseChatArgs(args: string[]): ChatOptions {
  const options: ChatOptions = {
    prompt: '',
    cwd: process.cwd(),
  };
  const promptParts: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--yolo') {
      options.yolo = true;
    } else if (arg === '--allowed-tool' && args[i + 1]) {
      options.allowedTools = options.allowedTools || [];
      options.allowedTools.push(args[i + 1]);
      i++;
    } else if (arg === '--disabled-tool' && args[i + 1]) {
      options.disabledTools = options.disabledTools || [];
      options.disabledTools.push(args[i + 1]);
      i++;
    } else if (arg === '--session-id' && args[i + 1]) {
      options.sessionId = args[i + 1];
      i++;
    } else if (arg.startsWith('--session-id=')) {
      options.sessionId = arg.substring('--session-id='.length);
    } else if (arg === '--resume') {
      if (args[i + 1] && !args[i + 1].startsWith('-')) {
        options.resume = args[i + 1];
        i++;
      } else {
        options.resume = 'AUTO';
      }
    } else if (arg.startsWith('--resume=')) {
      const resumeValue = arg.substring('--resume='.length);
      options.resume = resumeValue || 'AUTO';
    } else if (arg === '--cwd' && args[i + 1]) {
      options.cwd = args[i + 1];
      i++;
    } else if (arg.startsWith('--cwd=')) {
      options.cwd = arg.substring('--cwd='.length);
    } else if (arg === '-c' && args[i + 1]) {
      const override = args[i + 1];
      options.configOverrides = options.configOverrides || {};
      const eqIdx = override.indexOf('=');
      if (eqIdx > 0) {
        options.configOverrides[override.substring(0, eqIdx)] = override.substring(eqIdx + 1);
      }
      i++;
    } else if (arg === '--inject-current-session') {
      options.injectCurrentSession = true;
    } else if (arg === '--session-summary-source' && args[i + 1]) {
      options.sessionSummarySource = args[i + 1];
      i++;
    } else if (arg.startsWith('--session-summary-source=')) {
      options.sessionSummarySource = arg.substring('--session-summary-source='.length);
    } else if (arg === '--session-summary-text' && args[i + 1]) {
      options.sessionSummaryText = args[i + 1];
      i++;
    } else if (arg.startsWith('--session-summary-text=')) {
      options.sessionSummaryText = arg.substring('--session-summary-text='.length);
    } else if (arg === '--host-session-id' && args[i + 1]) {
      options.hostSessionId = args[i + 1];
      i++;
    } else if (arg.startsWith('--host-session-id=')) {
      options.hostSessionId = arg.substring('--host-session-id='.length);
    } else if (!arg.startsWith('-')) {
      promptParts.push(arg);
    }
  }

  const { hostConfig, remainingOverrides } = splitHostSessionSummaryOverrides(options.configOverrides);
  options.hostSummaryConfig = hostConfig;
  options.configOverrides = remainingOverrides;
  options.prompt = promptParts.join(' ').trim();
  return options;
}

function getChatStartOptions(options: ChatOptions): StartOptions {
  return {
    yolo: options.yolo,
    allowedTools: options.allowedTools,
    disabledTools: options.disabledTools,
  };
}

function getPromptStartOptions(options: PromptActionOptions): StartOptions {
  return {
    yolo: options.yolo,
    allowedTools: options.allowedTools,
    disabledTools: options.disabledTools,
  };
}

function isInteractiveTerminal(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

async function prepareChatSession(
  client: AcpClient,
  options: ChatOptions,
): Promise<{ sessionId: string; resumed: boolean } | null> {
  if (options.sessionId) {
    await client.loadSession(options.sessionId, options.cwd, []);
    return { sessionId: options.sessionId, resumed: true };
  }

  const resumeId = resolveResumeSessionId(options);
  if (resumeId === null) {
    return null;
  }

  if (resumeId) {
    await client.loadSession(resumeId, options.cwd, []);
    return { sessionId: resumeId, resumed: true };
  }

  const session = await client.createSession(options.cwd, []);
  return { sessionId: session.sessionId, resumed: false };
}

function resolveResumeSessionId(options: ChatOptions): string | null | undefined {
  if (!options.resume) {
    return undefined;
  }

  if (options.resume !== 'AUTO') {
    return options.resume;
  }

  const recent = new SessionReader().getRecentSession(options.cwd);
  if (!recent) {
    console.log('未找到可恢复的最近会话。');
    return null;
  }

  return recent.id;
}

async function streamChatPrompt(client: AcpClient, prompt: string): Promise<void> {
  console.log('\n--- 开始回复 ---\n');

  let wroteOutput = false;
  const result = await client.sessionPrompt(prompt, (update) => {
    if (update.update?.content?.text) {
      wroteOutput = true;
      process.stdout.write(update.update.content.text);
    }
  });

  if (wroteOutput) {
    process.stdout.write('\n');
  }

  console.log(`\n--- 本轮结束 (${result.stopReason || 'completed'}) ---`);
}

function buildPromptWithHostSummary(options: PromptActionOptions): string {
  const hostSummary = hostSummaryBridge.buildPrefix(options, options.hostSummaryConfig);
  if (hostSummary.notice) {
    console.log(hostSummary.notice);
  }
  return hostSummaryBridge.composePrompt(hostSummary.prefix, options.prompt);
}

async function runChatRepl(client: AcpClient): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  let promptInFlight = false;
  let exitRequested = false;

  const handleSigint = () => {
    if (promptInFlight) {
      exitRequested = true;
      process.stdout.write('\n正在取消当前请求并退出...\n');
      void client.sessionCancel().catch((error: unknown) => {
        console.error(`取消失败: ${error instanceof Error ? error.message : String(error)}`);
      });
      return;
    }

    exitRequested = true;
    process.stdout.write('\n正在退出 ACP Chat...\n');
    rl.close();
  };

  process.on('SIGINT', handleSigint);

  try {
    console.log('\n进入交互模式，输入消息后回车发送。');
    rl.setPrompt('trae> ');
    rl.prompt();

    for await (const line of rl) {
      const input = line.trim();

      if (!input) {
        if (exitRequested) break;
        rl.prompt();
        continue;
      }

      const action = await handleLocalChatCommand(input, client);
      if (action === 'exit') {
        break;
      }
      if (action === 'handled') {
        if (!exitRequested) {
          rl.prompt();
        }
        continue;
      }

      promptInFlight = true;
      try {
        await streamChatPrompt(client, input);
      } catch (error: unknown) {
        console.error(`\n执行失败: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        promptInFlight = false;
      }

      if (exitRequested) {
        break;
      }

      rl.prompt();
    }
  } finally {
    process.off('SIGINT', handleSigint);
    rl.close();
  }
}

async function handleLocalChatCommand(
  input: string,
  client: AcpClient,
): Promise<LocalChatAction> {
  switch (input) {
    case '/help':
      console.log('\n本地命令');
      console.log('  /help     查看帮助');
      console.log('  /session  查看当前会话 ID');
      console.log('  /cancel   向当前会话发送取消信号');
      console.log('  /exit     退出 ACP Chat');
      console.log('  /quit     退出 ACP Chat');
      return 'handled';
    case '/session':
      console.log(`当前会话 ID: ${client.getSessionId() || '未知'}`);
      return 'handled';
    case '/cancel':
      try {
        await client.sessionCancel();
        console.log('已发送取消信号。');
      } catch (error: unknown) {
        console.error(`取消失败: ${error instanceof Error ? error.message : String(error)}`);
      }
      return 'handled';
    case '/exit':
    case '/quit':
      console.log('正在退出 ACP Chat...');
      return 'exit';
    default:
      return 'prompt';
  }
}

async function ensureServerRunning(startOptions?: StartOptions): Promise<boolean> {
  if (!serverManager.isRunning()) {
    const options = normalizeAutoStartOptions(startOptions);
    console.log('ACP Server 未运行。正在启动...');
    try {
      await serverManager.start(options);
      return true;
    } catch (error: unknown) {
      console.error(`启动失败: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
  return true;
}

function normalizeAutoStartOptions(startOptions?: StartOptions): StartOptions {
  const options: StartOptions = { ...startOptions };

  if (
    options.yolo === undefined &&
    !options.allowedTools?.length &&
    !options.disabledTools?.length
  ) {
    options.yolo = true;
  }

  return options;
}
