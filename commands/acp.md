---
description: 通过 ACP 协议与 Trae Agent 交互
allowed-tools: Bash(trae-cli:*)
---

# /trae:acp

**Description:**
通过 ACP (Agent Communication Protocol) 与 Trae Agent 交互。启动/停止 ACP Server，发现可用 Agent，执行任务、流式获取结果，或在同一 session 中继续多轮对话。

**Usage:**
```bash
/trae:acp <action> [options]
```

**Actions:**
- `start`: 启动 ACP Server
- `stop`: 停止 ACP Server
- `status`: 查看服务器状态
- `agents`: 发现可用 Agent
- `run "任务"`: 通过 ACP 执行任务
- `stream "任务"`: 流式执行任务 (实时输出)
- `chat ["任务"]`: 进入 ACP 多轮对话；在非交互调用下执行单轮后退出

**Options (start/chat auto-start):**
- `--yolo`: YOLO 模式，跳过工具权限确认
- `--allowed-tool <name>`: 允许的工具 (可多次指定)
- `--disabled-tool <name>`: 禁用的工具 (可多次指定)

**Options (run/stream/chat prompt 注入):**
- `--inject-current-session`: 尝试注入宿主当前会话摘要
- `--session-summary-source <auto|cache|off>`: 宿主摘要来源
- `--session-summary-text "<text>"`: 显式提供宿主摘要文本
- `--host-session-id <id>`: 读取指定宿主会话 ID 的摘要缓存
- `-c host_session_summary.enabled=true|false`: 默认启用或关闭摘要注入
- `-c host_session_summary.source=auto|cache|off`: 默认摘要来源
- `-c host_session_summary.max_chars=<n>`: 注入摘要最大字符数
- `-c host_session_summary.max_items=<n>`: 摘要列表项最大数量

**Options (chat):**
- `--session-id <id>`: 加载指定 ACP session
- `--resume [id]`: 恢复指定 session；不带值时恢复当前工作目录最近 session
- `--cwd <path>`: 创建/加载 session 时使用的工作目录

**Local Commands (chat):**
- `/help`: 查看本地命令
- `/session`: 显示当前 session ID
- `/cancel`: 向当前会话发送取消信号
- `/exit`, `/quit`: 退出 ACP Chat

**Examples:**
```bash
/trae:acp start
/trae:acp start --yolo
/trae:acp start --allowed-tool Bash --disabled-tool AskUserQuestion
/trae:acp stop
/trae:acp status
/trae:acp agents
/trae:acp run "分析代码质量"
/trae:acp stream "重构模块"
/trae:acp chat "继续这个重构"
/trae:acp chat --resume
/trae:acp chat --session-id 0d3cbdc3-e365-468e-982c-fb3d5849f5cc
/trae:acp run "继续当前实现" --inject-current-session --session-summary-source cache --host-session-id claude-session-123
```

**Internal Execution:**
```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" acp <action> [options]
```
**Notes:**
- `chat` 只在首轮 prompt 注入宿主摘要；同一 ACP session 的后续轮次不再重复注入。
