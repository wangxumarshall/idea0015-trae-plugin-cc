let mockServerManager: {
  start: jest.Mock;
  stop: jest.Mock;
  isRunning: jest.Mock;
  getClient: jest.Mock;
  getStatus: jest.Mock;
};

let mockSessionReader: {
  getRecentSession: jest.Mock;
};

let mockHostSummaryBridge: {
  buildPrefix: jest.Mock;
  composePrompt: jest.Mock;
};

let mockSplitHostSummaryOverrides: jest.Mock;

const mockCreateInterface = jest.fn();

jest.mock('../../src/utils/acp-server-manager', () => ({
  AcpServerManager: jest.fn().mockImplementation(() => mockServerManager),
}));

jest.mock('../../src/utils/session-reader', () => ({
  SessionReader: jest.fn().mockImplementation(() => mockSessionReader),
}));

jest.mock('../../src/utils/host-session-summary', () => ({
  HostSessionSummaryBridge: jest.fn().mockImplementation(() => mockHostSummaryBridge),
  splitHostSessionSummaryOverrides: (...args: unknown[]) => mockSplitHostSummaryOverrides(...args),
}));

jest.mock('readline', () => ({
  createInterface: (...args: unknown[]) => mockCreateInterface(...args),
}));

describe('acp chat', () => {
  let acpCommand: typeof import('../../src/commands/acp').acp;
  let mockClient: {
    initialize: jest.Mock;
    createSession: jest.Mock;
    loadSession: jest.Mock;
    sessionPrompt: jest.Mock;
    sessionCancel: jest.Mock;
    getSessionId: jest.Mock;
  };
  let consoleLogMock: jest.SpyInstance;
  let consoleErrorMock: jest.SpyInstance;
  let stdoutWriteMock: jest.SpyInstance;
  let cwdMock: jest.SpyInstance;
  let stdinDescriptor: PropertyDescriptor | undefined;
  let stdoutDescriptor: PropertyDescriptor | undefined;

  function setTtyMode(enabled: boolean): void {
    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      value: enabled,
    });
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: enabled,
    });
  }

  function createMockReadline(lines: string[]) {
    return {
      setPrompt: jest.fn(),
      prompt: jest.fn(),
      close: jest.fn(),
      async *[Symbol.asyncIterator]() {
        for (const line of lines) {
          yield line;
        }
      },
    };
  }

  beforeEach(async () => {
    jest.resetModules();

    stdinDescriptor = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
    stdoutDescriptor = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');

    mockClient = {
      initialize: jest.fn().mockResolvedValue({}),
      createSession: jest.fn().mockResolvedValue({ sessionId: 'new-session' }),
      loadSession: jest.fn().mockResolvedValue(undefined),
      sessionPrompt: jest.fn().mockImplementation(async (
        prompt: string,
        onUpdate?: (update: unknown) => void,
      ) => {
        onUpdate?.({
          sessionId: mockClient.getSessionId(),
          update: {
            sessionUpdate: 'delta',
            content: { type: 'text', text: `reply:${prompt}` },
          },
        });
        return { stopReason: 'completed' };
      }),
      sessionCancel: jest.fn().mockResolvedValue(undefined),
      getSessionId: jest.fn().mockReturnValue('session-1'),
    };

    mockServerManager = {
      start: jest.fn().mockResolvedValue({ client: mockClient }),
      stop: jest.fn().mockResolvedValue(undefined),
      isRunning: jest.fn().mockReturnValue(false),
      getClient: jest.fn().mockReturnValue(mockClient),
      getStatus: jest.fn().mockReturnValue({ running: false, baseUrl: '' }),
    };

    mockSessionReader = {
      getRecentSession: jest.fn(),
    };

    mockHostSummaryBridge = {
      buildPrefix: jest.fn().mockReturnValue({ prefix: '', applied: false }),
      composePrompt: jest.fn().mockImplementation((...parts: Array<string | undefined>) =>
        parts.filter(Boolean).join('\n\n'),
      ),
    };

    mockSplitHostSummaryOverrides = jest.fn().mockImplementation(() => ({
      hostConfig: {},
      remainingOverrides: undefined,
    }));

    mockCreateInterface.mockReset();
    consoleLogMock = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    consoleErrorMock = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    stdoutWriteMock = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    cwdMock = jest.spyOn(process, 'cwd').mockReturnValue('/repo');

    ({ acp: acpCommand } = await import('../../src/commands/acp'));
  });

  afterEach(() => {
    consoleLogMock.mockRestore();
    consoleErrorMock.mockRestore();
    stdoutWriteMock.mockRestore();
    cwdMock.mockRestore();

    if (stdinDescriptor) {
      Object.defineProperty(process.stdin, 'isTTY', stdinDescriptor);
    }
    if (stdoutDescriptor) {
      Object.defineProperty(process.stdout, 'isTTY', stdoutDescriptor);
    }
  });

  it('should reuse a loaded session across multiple interactive turns', async () => {
    setTtyMode(true);
    mockCreateInterface.mockReturnValue(createMockReadline(['第一轮', '第二轮', '/exit']));

    await acpCommand(['chat', '--session-id', 'session-1']);

    expect(mockServerManager.start).toHaveBeenCalledWith({
      yolo: true,
      allowedTools: undefined,
      disabledTools: undefined,
    });
    expect(mockClient.loadSession).toHaveBeenCalledWith('session-1', '/repo', []);
    expect(mockClient.createSession).not.toHaveBeenCalled();
    expect(mockClient.sessionPrompt).toHaveBeenNthCalledWith(1, '第一轮', expect.any(Function));
    expect(mockClient.sessionPrompt).toHaveBeenNthCalledWith(2, '第二轮', expect.any(Function));
    expect(mockServerManager.stop).toHaveBeenCalledTimes(1);
  });

  it('should resume the most recent session in non-interactive mode', async () => {
    setTtyMode(false);
    mockSessionReader.getRecentSession.mockReturnValue({ id: 'recent-session' });

    await acpCommand(['chat', '继续优化', '--resume']);

    expect(mockSessionReader.getRecentSession).toHaveBeenCalledWith('/repo');
    expect(mockClient.loadSession).toHaveBeenCalledWith('recent-session', '/repo', []);
    expect(mockClient.sessionPrompt).toHaveBeenCalledWith('继续优化', expect.any(Function));
    expect(mockCreateInterface).not.toHaveBeenCalled();
  });

  it('should handle local cancel command in interactive mode', async () => {
    setTtyMode(true);
    mockCreateInterface.mockReturnValue(createMockReadline(['/cancel', '/exit']));

    await acpCommand(['chat']);

    expect(mockClient.createSession).toHaveBeenCalledWith('/repo', []);
    expect(mockClient.sessionCancel).toHaveBeenCalledTimes(1);
    expect(mockClient.sessionPrompt).not.toHaveBeenCalled();
    expect(mockServerManager.stop).toHaveBeenCalledTimes(1);
  });

  it('should inject host summary only into the first chat turn', async () => {
    setTtyMode(true);
    mockHostSummaryBridge.buildPrefix.mockReturnValue({ prefix: 'HOST SUMMARY', applied: true });
    mockCreateInterface.mockReturnValue(createMockReadline(['第二轮', '/exit']));

    await acpCommand(['chat', '第一轮', '--inject-current-session']);

    expect(mockClient.sessionPrompt).toHaveBeenNthCalledWith(
      1,
      'HOST SUMMARY\n\n第一轮',
      expect.any(Function),
    );
    expect(mockClient.sessionPrompt).toHaveBeenNthCalledWith(
      2,
      '第二轮',
      expect.any(Function),
    );
  });

  it('should parse run flags separately from the prompt', async () => {
    setTtyMode(false);
    mockHostSummaryBridge.buildPrefix.mockReturnValue({ prefix: 'HOST SUMMARY', applied: true });

    await acpCommand(['run', '继续优化', '--yolo', '--inject-current-session']);

    expect(mockServerManager.start).toHaveBeenCalledWith({
      yolo: true,
      allowedTools: undefined,
      disabledTools: undefined,
    });
    expect(mockClient.sessionPrompt).toHaveBeenCalledWith(
      'HOST SUMMARY\n\n继续优化',
      expect.any(Function),
    );
  });
});

export {};
