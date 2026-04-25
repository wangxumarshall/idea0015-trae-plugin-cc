import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  HostSessionSummaryBridge,
  HostSessionSummaryStore,
  splitHostSessionSummaryOverrides,
} from '../../src/utils/host-session-summary';

describe('HostSessionSummaryBridge', () => {
  let tempDir: string;
  let cwdMock: jest.SpyInstance;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trae-host-summary-'));
    cwdMock = jest.spyOn(process, 'cwd').mockReturnValue(tempDir);
  });

  afterEach(() => {
    cwdMock.mockRestore();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should prefer explicit summary text over cached summary', () => {
    const store = new HostSessionSummaryStore();
    store.saveManualSummary('claude', 'sess-1', 'cached summary');

    const bridge = new HostSessionSummaryBridge(store);
    const result = bridge.buildPrefix(
      {
        injectCurrentSession: true,
        sessionSummarySource: 'cache',
        sessionSummaryText: 'explicit summary',
      },
      {
        enabled: true,
        source: 'cache',
      },
    );

    expect(result.applied).toBe(true);
    expect(result.prefix).toContain('explicit summary');
    expect(result.prefix).not.toContain('cached summary');
  });

  it('should read the current cached summary when enabled', () => {
    const store = new HostSessionSummaryStore();
    store.save({
      version: 1,
      platform: 'claude',
      sessionId: 'sess-2',
      updatedAt: '2026-04-25T00:00:00.000Z',
      source: 'manual',
      summary: {
        currentGoal: '修复 run 与 acp 的摘要注入',
        decisionsConstraints: ['不要改 review 和 rescue'],
        mentionedFiles: ['src/commands/run.ts'],
        handoffInstructions: '继续按现有 CLI 结构实现。',
      },
    });

    const bridge = new HostSessionSummaryBridge(store);
    const result = bridge.buildPrefix(
      {
        injectCurrentSession: true,
        sessionSummarySource: 'cache',
      },
      {
        enabled: true,
        source: 'cache',
      },
    );

    expect(result.applied).toBe(true);
    expect(result.prefix).toContain('修复 run 与 acp 的摘要注入');
    expect(result.prefix).toContain('不要改 review 和 rescue');
    expect(result.prefix).toContain('src/commands/run.ts');
  });

  it('should emit a notice when a claude-style cached summary is missing', () => {
    const bridge = new HostSessionSummaryBridge(new HostSessionSummaryStore());
    const result = bridge.buildPrefix(
      {
        injectCurrentSession: true,
        sessionSummarySource: 'cache',
      },
      {
        enabled: true,
        source: 'cache',
      },
    );

    expect(result.applied).toBe(false);
    expect(result.notice).toBe('未找到宿主当前会话摘要，已跳过注入。');
  });

  it('should suppress missing-summary notice for default opencode auto mode', () => {
    const bridge = new HostSessionSummaryBridge(new HostSessionSummaryStore());
    const result = bridge.buildPrefix(
      {},
      {
        enabled: true,
        source: 'auto',
        preferredPlatform: 'opencode',
      },
    );

    expect(result.applied).toBe(false);
    expect(result.notice).toBeUndefined();
  });
});

describe('splitHostSessionSummaryOverrides', () => {
  it('should separate host session summary overrides from trae cli overrides', () => {
    const result = splitHostSessionSummaryOverrides({
      'host_session_summary.enabled': 'true',
      'host_session_summary.source': 'cache',
      'host_session_summary.max_chars': '1200',
      foo: 'bar',
    });

    expect(result.hostConfig).toEqual({
      enabled: true,
      source: 'cache',
      maxChars: 1200,
    });
    expect(result.remainingOverrides).toEqual({
      foo: 'bar',
    });
  });
});
