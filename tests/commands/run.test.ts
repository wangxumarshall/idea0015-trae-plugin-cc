let mockExecutor: {
  execute: jest.Mock;
};

let mockContextBridge: {
  buildContextFromSession: jest.Mock;
};

let mockHostSummaryBridge: {
  buildPrefix: jest.Mock;
  composePrompt: jest.Mock;
};

let mockSplitHostSummaryOverrides: jest.Mock;

jest.mock('../../src/utils/trae-executor', () => ({
  TraeExecutor: jest.fn().mockImplementation(() => mockExecutor),
}));

jest.mock('../../src/utils/context-bridge', () => ({
  ContextBridge: jest.fn().mockImplementation(() => mockContextBridge),
}));

jest.mock('../../src/utils/host-session-summary', () => ({
  HostSessionSummaryBridge: jest.fn().mockImplementation(() => mockHostSummaryBridge),
  splitHostSessionSummaryOverrides: (...args: unknown[]) => mockSplitHostSummaryOverrides(...args),
}));

describe('run command', () => {
  let runTask: typeof import('../../src/commands/run').runTask;
  let consoleLogMock: jest.SpyInstance;

  beforeEach(async () => {
    jest.resetModules();

    mockExecutor = {
      execute: jest.fn().mockResolvedValue({
        taskId: 'task-1',
        output: 'ok',
        exitCode: 0,
        duration: 10,
        sessionId: 'trae-session-1',
      }),
    };

    mockContextBridge = {
      buildContextFromSession: jest.fn().mockReturnValue('TRAE CONTEXT'),
    };

    mockHostSummaryBridge = {
      buildPrefix: jest.fn().mockReturnValue({ prefix: 'HOST SUMMARY', applied: true }),
      composePrompt: jest.fn().mockImplementation((...parts: Array<string | undefined>) =>
        parts.filter(Boolean).join('\n\n'),
      ),
    };

    mockSplitHostSummaryOverrides = jest.fn().mockImplementation((overrides?: Record<string, string>) => ({
      hostConfig: {
        enabled: true,
        source: 'cache',
      },
      remainingOverrides: overrides
        ? Object.fromEntries(
            Object.entries(overrides).filter(([key]) => !key.startsWith('host_session_summary.')),
          )
        : undefined,
    }));

    consoleLogMock = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    ({ runTask } = await import('../../src/commands/run'));
  });

  afterEach(() => {
    consoleLogMock.mockRestore();
  });

  it('should compose host summary, trae context, and user prompt in order', async () => {
    await runTask([
      '继续实现',
      '--inject-current-session',
      '--inject-context',
      'trae-session-1',
      '-c',
      'host_session_summary.enabled=true',
      '-c',
      'foo=bar',
    ]);

    expect(mockHostSummaryBridge.buildPrefix).toHaveBeenCalledWith(
      expect.objectContaining({
        injectCurrentSession: true,
      }),
      expect.objectContaining({
        enabled: true,
        source: 'cache',
      }),
    );
    expect(mockExecutor.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'HOST SUMMARY\n\nTRAE CONTEXT\n\n继续实现',
        configOverrides: {
          foo: 'bar',
        },
      }),
    );
  });

  it('should surface missing-summary notices but still run the task', async () => {
    mockHostSummaryBridge.buildPrefix.mockReturnValue({
      prefix: '',
      applied: false,
      notice: '未找到宿主当前会话摘要，已跳过注入。',
    });

    await runTask(['继续实现']);

    expect(consoleLogMock).toHaveBeenCalledWith('未找到宿主当前会话摘要，已跳过注入。');
    expect(mockExecutor.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: '继续实现',
      }),
    );
  });
});

export {};
