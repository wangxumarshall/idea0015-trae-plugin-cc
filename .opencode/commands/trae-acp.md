---
description: Manages ACP (Agent Communication Protocol) server. Start/stop ACP server, discover agents, execute tasks, stream results, or continue a session via ACP STDIO JSON-RPC.
---

Manage ACP protocol server by running:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" acp $ARGUMENTS
```

Actions:
- `start`: Start the ACP Server (trae-cli acp serve)
- `stop`: Stop the ACP Server
- `status`: Check server status
- `agents`: Discover available agents
- `run "task"`: Execute a task via ACP
- `stream "task"`: Stream a task execution (real-time output)
- `chat "task"`: Continue chatting in the same ACP session; interactive on TTY, single-turn in non-interactive callers

Options for `start`:
- `--yolo`: Skip tool permission confirmations
- `--allowed-tool <name>`: Allow specific tools
- `--disabled-tool <name>`: Disable specific tools

Options for `chat`:
- `--session-id <id>`: Load an existing ACP session
- `--resume [id]`: Resume a specific session, or the most recent session for the current cwd
- `--cwd <path>`: Working directory used when loading/creating the session
- `--session-summary-source <auto|cache|off>`: Host session summary source for `run`/`stream`/`chat`
- `--host-session-id <id>`: Read a cached host session summary by ID
- `--session-summary-text "<text>"`: Use explicit host session summary text

OpenCode tools default to `host_session_summary.enabled=true` and `host_session_summary.source=auto`, so `run`, `stream`, and the first turn of `chat` try to inject the current OpenCode session summary automatically.

Example: `acp start`, `acp status`, `acp agents`, `acp run "analyze code quality"`, `acp chat "continue the refactor" --resume`
