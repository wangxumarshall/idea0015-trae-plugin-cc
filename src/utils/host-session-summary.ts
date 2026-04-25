import * as fs from 'fs';
import * as path from 'path';
import { getHostSessionSummaryDir } from '../config';

export const HOST_SESSION_PLATFORMS = ['claude', 'opencode'] as const;
export const SESSION_SUMMARY_SOURCES = ['auto', 'cache', 'off'] as const;

export type HostSessionPlatform = typeof HOST_SESSION_PLATFORMS[number];
export type SessionSummarySource = typeof SESSION_SUMMARY_SOURCES[number];

export interface HostSessionSummarySections {
  currentGoal?: string;
  recentUserIntent?: string;
  decisionsConstraints?: string[];
  mentionedFiles?: string[];
  mentionedTools?: string[];
  handoffInstructions?: string;
  rawText?: string;
}

export interface HostSessionSummaryRecord {
  version: number;
  platform: HostSessionPlatform;
  sessionId: string;
  updatedAt: string;
  source: 'auto' | 'manual';
  summary: HostSessionSummarySections;
}

export interface HostSessionSummaryArgs {
  injectCurrentSession?: boolean;
  sessionSummarySource?: string;
  sessionSummaryText?: string;
  hostSessionId?: string;
}

export interface HostSessionSummaryConfig {
  enabled?: boolean;
  source?: SessionSummarySource;
  maxChars?: number;
  maxItems?: number;
  preferredPlatform?: HostSessionPlatform;
}

interface CurrentSessionMarker {
  platform: HostSessionPlatform;
  sessionId: string;
  updatedAt: string;
}

export interface ResolvedHostSessionSummaryOptions extends HostSessionSummaryArgs {
  enabled: boolean;
  sessionSummarySource: SessionSummarySource;
  maxChars: number;
  maxItems: number;
  preferredPlatform?: HostSessionPlatform;
  explicitRequested: boolean;
}

export interface HostSessionSummaryBuildResult {
  prefix: string;
  applied: boolean;
  notice?: string;
}

const DEFAULT_MAX_CHARS = 2400;
const DEFAULT_MAX_ITEMS = 5;
const HOST_SESSION_SUMMARY_PREFIX = 'host_session_summary.';

function cleanText(value?: string | null): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function truncateText(value: string, maxChars: number): string {
  const trimmed = cleanText(value);
  if (!trimmed) return '';
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

function sanitizeSessionId(sessionId: string): string {
  return sessionId.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function normalizeSource(value?: string | null): SessionSummarySource | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if ((SESSION_SUMMARY_SOURCES as readonly string[]).includes(normalized)) {
    return normalized as SessionSummarySource;
  }
  return undefined;
}

function normalizePlatform(value?: string | null): HostSessionPlatform | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if ((HOST_SESSION_PLATFORMS as readonly string[]).includes(normalized)) {
    return normalized as HostSessionPlatform;
  }
  return undefined;
}

function parseBooleanLike(value?: string | null): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return undefined;
}

function parsePositiveInt(value?: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function dedupeList(values: string[], maxItems: number, maxChars: number): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const cleaned = truncateText(value, Math.min(maxChars, 180));
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
    if (result.length >= maxItems) break;
  }

  return result;
}

export function splitHostSessionSummaryOverrides(
  overrides?: Record<string, string>,
): { hostConfig: HostSessionSummaryConfig; remainingOverrides?: Record<string, string> } {
  const hostConfig: HostSessionSummaryConfig = {};
  const remainingOverrides: Record<string, string> = {};

  if (!overrides) {
    return { hostConfig };
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (!key.startsWith(HOST_SESSION_SUMMARY_PREFIX)) {
      remainingOverrides[key] = value;
      continue;
    }

    const subKey = key.substring(HOST_SESSION_SUMMARY_PREFIX.length);
    switch (subKey) {
      case 'enabled':
        hostConfig.enabled = parseBooleanLike(value);
        break;
      case 'source':
        hostConfig.source = normalizeSource(value);
        break;
      case 'max_chars':
        hostConfig.maxChars = parsePositiveInt(value);
        break;
      case 'max_items':
        hostConfig.maxItems = parsePositiveInt(value);
        break;
      case 'platform':
        hostConfig.preferredPlatform = normalizePlatform(value);
        break;
      default:
        remainingOverrides[key] = value;
        break;
    }
  }

  return {
    hostConfig,
    remainingOverrides: Object.keys(remainingOverrides).length ? remainingOverrides : undefined,
  };
}

export function resolveHostSessionSummaryOptions(
  args: HostSessionSummaryArgs,
  config?: HostSessionSummaryConfig,
): ResolvedHostSessionSummaryOptions {
  const explicitText = cleanText(args.sessionSummaryText);
  const explicitSource = normalizeSource(args.sessionSummarySource);
  const enabled = explicitText
    ? true
    : args.injectCurrentSession === true
      ? true
      : config?.enabled === true;

  return {
    injectCurrentSession: args.injectCurrentSession,
    sessionSummarySource: explicitSource || config?.source || 'auto',
    sessionSummaryText: explicitText,
    hostSessionId: cleanText(args.hostSessionId),
    enabled,
    maxChars: config?.maxChars || DEFAULT_MAX_CHARS,
    maxItems: config?.maxItems || DEFAULT_MAX_ITEMS,
    preferredPlatform: config?.preferredPlatform,
    explicitRequested: Boolean(
      args.injectCurrentSession ||
      explicitText ||
      args.hostSessionId ||
      args.sessionSummarySource,
    ),
  };
}

export class HostSessionSummaryStore {
  private summaryDir: string;

  constructor() {
    this.summaryDir = getHostSessionSummaryDir();
  }

  save(record: HostSessionSummaryRecord, options?: { markCurrent?: boolean }): void {
    this.ensureDir();
    fs.writeFileSync(
      this.getSummaryPath(record.platform, record.sessionId),
      JSON.stringify(record, null, 2),
    );

    if (options?.markCurrent !== false) {
      const marker: CurrentSessionMarker = {
        platform: record.platform,
        sessionId: record.sessionId,
        updatedAt: record.updatedAt,
      };
      fs.writeFileSync(this.getCurrentPath(record.platform), JSON.stringify(marker, null, 2));
    }
  }

  saveManualSummary(platform: HostSessionPlatform, sessionId: string, text: string): HostSessionSummaryRecord {
    const record: HostSessionSummaryRecord = {
      version: 1,
      platform,
      sessionId,
      updatedAt: new Date().toISOString(),
      source: 'manual',
      summary: {
        rawText: cleanText(text),
      },
    };
    this.save(record, { markCurrent: true });
    return record;
  }

  getSummary(platform: HostSessionPlatform, sessionId: string): HostSessionSummaryRecord | null {
    const filePath = this.getSummaryPath(platform, sessionId);
    if (!fs.existsSync(filePath)) return null;

    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as HostSessionSummaryRecord;
    } catch {
      return null;
    }
  }

  findSummaryBySessionId(
    sessionId: string,
    preferredPlatform?: HostSessionPlatform,
  ): HostSessionSummaryRecord | null {
    const platforms = preferredPlatform
      ? [preferredPlatform, ...HOST_SESSION_PLATFORMS.filter(platform => platform !== preferredPlatform)]
      : [...HOST_SESSION_PLATFORMS];

    let newest: HostSessionSummaryRecord | null = null;
    for (const platform of platforms) {
      const record = this.getSummary(platform, sessionId);
      if (!record) continue;

      if (!newest) {
        newest = record;
        continue;
      }

      if (new Date(record.updatedAt).getTime() > new Date(newest.updatedAt).getTime()) {
        newest = record;
      }
    }

    return newest;
  }

  getCurrentSummary(preferredPlatform?: HostSessionPlatform): HostSessionSummaryRecord | null {
    if (preferredPlatform) {
      const preferred = this.readCurrentMarker(preferredPlatform);
      if (preferred) {
        const record = this.getSummary(preferred.platform, preferred.sessionId);
        if (record) return record;
      }
    }

    let newestMarker: CurrentSessionMarker | null = null;
    for (const platform of HOST_SESSION_PLATFORMS) {
      const marker = this.readCurrentMarker(platform);
      if (!marker) continue;

      if (!newestMarker) {
        newestMarker = marker;
        continue;
      }

      if (new Date(marker.updatedAt).getTime() > new Date(newestMarker.updatedAt).getTime()) {
        newestMarker = marker;
      }
    }

    if (!newestMarker) return null;
    return this.getSummary(newestMarker.platform, newestMarker.sessionId);
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.summaryDir)) {
      fs.mkdirSync(this.summaryDir, { recursive: true });
    }
  }

  private getSummaryPath(platform: HostSessionPlatform, sessionId: string): string {
    return path.join(this.summaryDir, `${platform}__${sanitizeSessionId(sessionId)}.json`);
  }

  private getCurrentPath(platform: HostSessionPlatform): string {
    return path.join(this.summaryDir, `_current__${platform}.json`);
  }

  private readCurrentMarker(platform: HostSessionPlatform): CurrentSessionMarker | null {
    const filePath = this.getCurrentPath(platform);
    if (!fs.existsSync(filePath)) return null;

    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as CurrentSessionMarker;
    } catch {
      return null;
    }
  }
}

export class HostSessionSummaryBridge {
  private store: HostSessionSummaryStore;

  constructor(store?: HostSessionSummaryStore) {
    this.store = store || new HostSessionSummaryStore();
  }

  buildPrefix(
    args: HostSessionSummaryArgs,
    config?: HostSessionSummaryConfig,
  ): HostSessionSummaryBuildResult {
    const options = resolveHostSessionSummaryOptions(args, config);

    if (options.sessionSummaryText) {
      return {
        prefix: this.renderSummary({ rawText: options.sessionSummaryText }, options),
        applied: true,
      };
    }

    if (!options.enabled || options.sessionSummarySource === 'off') {
      return { prefix: '', applied: false };
    }

    const record = options.hostSessionId
      ? this.store.findSummaryBySessionId(options.hostSessionId, options.preferredPlatform)
      : this.store.getCurrentSummary(options.preferredPlatform);

    if (!record) {
      return {
        prefix: '',
        applied: false,
        notice: this.shouldShowMissingNotice(options)
          ? '未找到宿主当前会话摘要，已跳过注入。'
          : undefined,
      };
    }

    const prefix = this.renderSummary(record.summary, options);
    if (!prefix) {
      return {
        prefix: '',
        applied: false,
        notice: this.shouldShowMissingNotice(options)
          ? '宿主当前会话摘要为空，已跳过注入。'
          : undefined,
      };
    }

    return { prefix, applied: true };
  }

  composePrompt(...parts: Array<string | undefined | null>): string {
    return parts
      .map(part => part?.trim())
      .filter((part): part is string => Boolean(part))
      .join('\n\n')
      .trim();
  }

  private shouldShowMissingNotice(options: ResolvedHostSessionSummaryOptions): boolean {
    if (!options.enabled) return false;
    if (options.preferredPlatform === 'opencode' && options.sessionSummarySource === 'auto') {
      return false;
    }
    return options.explicitRequested || options.sessionSummarySource !== 'off';
  }

  private renderSummary(
    summary: HostSessionSummarySections,
    options: ResolvedHostSessionSummaryOptions,
  ): string {
    const currentGoal = truncateText(summary.currentGoal || '', Math.min(options.maxChars, 480));
    const recentUserIntent = truncateText(
      summary.recentUserIntent || summary.rawText || '',
      Math.min(options.maxChars, 720),
    );
    const decisions = dedupeList(summary.decisionsConstraints || [], options.maxItems, options.maxChars);
    const mentionedFiles = dedupeList(summary.mentionedFiles || [], options.maxItems, options.maxChars);
    const mentionedTools = dedupeList(summary.mentionedTools || [], options.maxItems, options.maxChars);
    const handoff = truncateText(
      summary.handoffInstructions || '请把以上摘要仅作为宿主会话续接上下文，再结合后续 prompt 继续执行。',
      Math.min(options.maxChars, 520),
    );

    const sections: string[] = ['## 宿主当前会话摘要', ''];

    sections.push('### 当前目标');
    sections.push(currentGoal || '延续宿主会话中的当前任务。');
    sections.push('');

    sections.push('### 最近用户意图');
    sections.push(recentUserIntent || '未提供结构化摘要，请结合后续 prompt 自行承接。');
    sections.push('');

    sections.push('### 已确认决定 / 约束');
    if (decisions.length > 0) {
      for (const item of decisions) {
        sections.push(`- ${item}`);
      }
    } else {
      sections.push('- 暂无额外已确认约束。');
    }
    sections.push('');

    sections.push('### 提及文件 / 工具');
    const fileAndToolItems = [...mentionedFiles, ...mentionedTools.map(tool => `工具: ${tool}`)];
    if (fileAndToolItems.length > 0) {
      for (const item of fileAndToolItems.slice(0, options.maxItems)) {
        sections.push(`- ${item}`);
      }
    } else {
      sections.push('- 暂无明确提及。');
    }
    sections.push('');

    sections.push('### 对 Trae 的续接说明');
    sections.push(handoff);

    return truncateText(sections.join('\n').trim(), options.maxChars);
  }
}
