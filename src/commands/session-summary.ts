import {
  HOST_SESSION_PLATFORMS,
  HostSessionPlatform,
  HostSessionSummaryStore,
} from '../utils/host-session-summary';

function printUsage(): void {
  console.log('用法: session-summary save --platform <claude|opencode> --session-id <id> --text "<summary>"');
}

function normalizePlatform(value?: string): HostSessionPlatform | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if ((HOST_SESSION_PLATFORMS as readonly string[]).includes(normalized)) {
    return normalized as HostSessionPlatform;
  }
  return null;
}

export async function sessionSummary(args: string[]): Promise<void> {
  const action = args[0];
  if (action !== 'save') {
    printUsage();
    return;
  }

  let platform: HostSessionPlatform | null = null;
  let sessionId = '';
  let text = '';

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--platform' && args[i + 1]) {
      platform = normalizePlatform(args[i + 1]);
      i++;
    } else if (arg.startsWith('--platform=')) {
      platform = normalizePlatform(arg.substring('--platform='.length));
    } else if (arg === '--session-id' && args[i + 1]) {
      sessionId = args[i + 1].trim();
      i++;
    } else if (arg.startsWith('--session-id=')) {
      sessionId = arg.substring('--session-id='.length).trim();
    } else if (arg === '--text' && args[i + 1]) {
      text = args[i + 1].trim();
      i++;
    } else if (arg.startsWith('--text=')) {
      text = arg.substring('--text='.length).trim();
    }
  }

  if (!platform || !sessionId || !text) {
    printUsage();
    return;
  }

  const store = new HostSessionSummaryStore();
  store.saveManualSummary(platform, sessionId, text);
  console.log(`已保存 ${platform} 会话摘要: ${sessionId}`);
}
