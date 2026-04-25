---
description: 保存宿主会话摘要缓存，供 run/acp 注入当前会话上下文
allowed-tools: Bash(node:*)
---

# /trae:session-summary

**Description:**
显式保存 Claude Code 或 OpenCode 宿主会话的紧凑摘要，供 `/trae:run` 和 `/trae:acp` 在后续调用中注入当前会话上下文。

**Usage:**
```bash
/trae:session-summary save --platform <claude|opencode> --session-id <id> --text "summary"
```

**Examples:**
```bash
/trae:session-summary save --platform claude --session-id sess-123 --text "当前目标: 修复 ACP 注入逻辑；约束: 不改 review/rescue；已改文件: src/commands/run.ts, src/commands/acp.ts"
```

**Internal Execution:**
```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" session-summary save --platform <claude|opencode> --session-id <id> --text "summary"
```
