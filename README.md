# trae-plugin-cc

The plugin bridges [**Claude Code**](https://claude.ai/code) and [**OpenCode**](https://opencode.ai) with ByteDance [**Trae Agent**](https://docs.trae.cn/cli) (`trae-cli`). Delegate natural language tasks, run code reviews, manage sessions, and enable Agent-to-Agent communication — all inheriting trae-cli's OAuth2 auth (no extra API keys needed).

## Features

| Feature | Description |
|---------|-------------|
| **Task Delegation** | Send natural language prompts to Trae Agent with YOLO mode, session resume, git worktree isolation, and fine-grained tool permissions |
| **Code Review** | Automatic git diff + professional review — standard or adversarial (extremely strict), with smart base branch detection and change-size estimation |
| **Session Management** | Query trae-cli's history: conversations, tool calls, context summaries, topic search, and bulk cleanup |
| **ACP Protocol** | JSON-RPC over STDIO for inter-agent communication (start/stop servers, discover agents, execute/stream tasks) |
| **Background Tasks** | Long-running tasks with PID tracking, status listing, result retrieval, and cancellation |
| **Lifecycle Hooks** | Auto-triggered on session start/end/stop: env checks, background task reminders, uncommitted-change gates |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        trae-plugin-cc                             │
│                                                                    │
│  ┌──────────────────────┐          ┌──────────────────────────┐   │
│  │    Claude Code       │          │       OpenCode           │   │
│  ├──────────────────────┤          ├──────────────────────────┤   │
│  │ 10 Slash Commands    │          │  9 Tools + 10 Commands   │   │
│  │    commands/*.md     │          │    tools/ + commands/    │   │
│  │ 4  MCP Tools (.json) │          │  Event Hooks (.ts)       │   │
│  │ 4  Lifecycle Hooks   │          │    plugins/              │   │
│  └──────────┬───────────┘          └──────────┬───────────────┘   │
│             │                                  │                    │
│  ┌──────────▼──────────────────────────────────▼───────────────┐   │
│  │              Core CLI (src/ → dist/index.js)                 │   │
│  │  setup | run | review | adversarial-review | sessions |      │   │
│  │  acp | status | result | cancel | rescue | hooks            │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                             │                                       │
│                    ┌─────────▼──────────┐                          │
│                    │    trae-cli        │                          │
│                    │  (OAuth2 inherit)  │                          │
│                    └────────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

Both platforms share the same core CLI (`dist/index.js`). Claude Code uses slash commands (`/trae:*`), MCP tools for AI-autonomous invocation, and lifecycle hooks; OpenCode uses Bun tools (`.opencode/tools/`) and command descriptions (`.opencode/commands/`) — all ultimately invoking `node dist/index.js <command>`.

## Prerequisites

- **Node.js 18+** (runtime)
- **trae-cli** installed and authenticated

```bash
# Verify trae-cli
trae-cli --help

# Verify auth (should show model + login URL)
cat ~/.trae/trae_cli.yaml
```

## Installation

### Claude Code

**Option 1: Marketplace (recommended)**

```bash
claude plugin marketplace add https://github.com/wangxumarshall/idea0015-trae-plugin-cc
claude plugin install trae
claude plugin list | grep trae
```

Scope: `--scope user` (global) | `--scope project` (current project) | `--scope local` (current session)

**Option 2: Local directory**

```bash
git clone https://github.com/wangxumarshall/idea0015-trae-plugin-cc.git
cd idea0015-trae-plugin-cc
npm install   # ⚡ auto-builds dist/ via postinstall
claude plugin marketplace add "$(pwd)"
claude plugin install trae
```

### OpenCode

```bash
git clone https://github.com/wangxumarshall/idea0015-trae-plugin-cc.git
cd idea0015-trae-plugin-cc
npm install   # ⚡ auto-builds dist/ via postinstall
cd .opencode && npm install && cd ..
```

OpenCode auto-discovers tools in `.opencode/tools/` and commands in `.opencode/commands/`.

### Verify Installation

```bash
node dist/index.js setup
```

Expected output:
```
✅ trae-cli 已安装并可用！

## 认证状态
  已认证: ✅
  模型: GLM-5
  登录地址: https://console.enterprise.trae.cn
```

> **What `npm install` does**: Automatically runs `npm run build` via the `postinstall` hook, producing `dist/index.js` (the runtime CLI). If you `git pull` new source changes, run `npm run build` again.

## Quick Start

**Claude Code** (slash commands — user types directly):

```
/trae:run "重构用户认证模块"           # execute task
/trae:run "修复登录bug" --yolo         # skip tool confirmations
/trae:review                           # standard review
/trae:adversarial-review               # adversarial review
/trae:sessions list                    # list sessions
/trae:acp run "分析代码质量"            # execute via ACP
```

Claude Code additionally auto-registers 4 MCP tools (`trae_run`, `trae_review`, `trae_sessions`, `trae_acp`) for AI-autonomous invocation.

**OpenCode** (Bun tools — agent calls tools):

| Tool | CLI | Description |
|------|-----|-------------|
| `trae-setup` | `setup` | Check env & auth |
| `trae-run` | `run` | Execute task |
| `trae-review` | `review` / `adversarial-review` | Code review |
| `trae-sessions` | `sessions` | Session management (9 actions) |
| `trae-acp` | `acp` | ACP protocol (6 actions) |
| `trae-status` | `status` | Background task status |
| `trae-result` | `result` | Get task output |
| `trae-cancel` | `cancel` | Cancel task |
| `trae-rescue` | `rescue` | Failure diagnosis |

OpenCode's TUI `/` panel lists available tools from `.opencode/tools/`; `trae-` prefix comes from filenames, not from this plugin.

## Commands Reference

All commands map to `node dist/index.js <command> [args]`.
In **Claude Code**, users type `/trae:<command>` (slash commands).
In **OpenCode**, agents call `trae-<command>` tools or follow command descriptions.

### `setup`

Verify trae-cli installation and auth status.

<table><tr><td>Claude Code</td><td>/trae:setup</td></tr><tr><td>OpenCode</td><td>trae-setup tool (no args)</td></tr></table>

---

### `run "prompt"`

Delegate a natural language task to Trae Agent.

<table><tr><td>Claude Code</td><td>/trae:run "描述任务" [options]</td></tr><tr><td>OpenCode</td><td>trae-run tool with prompt + options</td></tr></table>

| Option | Alias | Description |
|--------|-------|-------------|
| `--background` | | Run in background (returns job ID) |
| `--json` | | Structured JSON output with `session_id` |
| `--yolo` | `-y` | Skip tool permission confirmations |
| `--resume [ID]` | | Resume session (omit ID = auto-resume latest) |
| `--session-id <id>` | | Specify new session ID |
| `--worktree [name]` | `-w` | Isolated git worktree (omit name = `__auto__`) |
| `--allowed-tool <n>` | | Auto-approve tool (repeatable) |
| `--disallowed-tool <n>` | | Auto-reject tool (repeatable) |
| `--query-timeout <d>` | | Per-query timeout (e.g. `30s`, `5m`) |
| `--bash-tool-timeout <d>` | | Bash tool timeout |
| `-c <k=v>` | | Config override (repeatable) |
| `--inject-context <id>` | | Inject another session's context |

**Examples:**
```bash
/trae:run "重构认证模块" --background --json
/trae:run "继续" --resume --yolo
/trae:run "修复 bug" --worktree --allowed-tool Edit --allowed-tool Bash
```

---

### `review` / `adversarial-review`

Code review with automatic git diff.

<table><tr><td>Claude Code</td><td>/trae:review or /trae:adversarial-review</td></tr><tr><td>OpenCode</td><td>trae-review tool with `adversarial: true/false`</td></tr></table>

| Option | Alias | Description |
|--------|-------|-------------|
| `--base <branch>` | | Base branch (auto-detected: main/master/develop) |
| `--background` | | Run in background (recommended for large diffs) |
| `--yolo` | `-y` | Skip tool confirmations |
| `--json` | | Structured JSON output |
| `--session-id <id>` | | Specify session ID |

Auto-detects base branch and estimates review size, recommending background mode for large changes.

---

### `sessions <action>`

Manage trae-cli's historical sessions (reads from file cache directly — no HTTP calls).

<table><tr><td>Claude Code</td><td>/trae:sessions <action> [options]</td></tr><tr><td>OpenCode</td><td>trae-sessions tool with `action` + args</td></tr></table>

| Action | Args | Options | Description |
|--------|------|---------|-------------|
| `list` | | `--cwd`, `--limit` (default 20) | List all sessions |
| `recent` | | `--cwd` | Most recent session for cwd |
| `detail <id>` | `<session-id>` | | Session metadata + event counts |
| `conversation <id>` | `<session-id>` | `--limit` (default 50) | Conversation messages |
| `tools <id>` | `<session-id>` | | Tool call stats + records (up to 30) |
| `context <id>` | `<session-id>` | | Full context summary |
| `find <topic>` | `<topic>` | | Search by keyword |
| `delete <id>` | `<session-id>` | | Delete a session |
| `delete-smoke` | | | Bulk delete sessions with "smoke" in ID/title |

---

### `acp <action>`

ACP protocol: **JSON-RPC over STDIO** (not HTTP). Enables Agent-to-Agent communication.

<table><tr><td>Claude Code</td><td>/trae:acp <action> [options]</td></tr><tr><td>OpenCode</td><td>trae-acp tool with `action` + args</td></tr></table>

| Action | Args | Description |
|--------|------|-------------|
| `start` | `--yolo`, `--allowed-tool`, `--disabled-tool` | Start ACP Server (blocks, keeps STDIO pipe open) |
| `stop` | | Stop ACP Server |
| `status` | | Check server status |
| `agents` | | Discover available agents (auto-starts server if needed) |
| `run <prompt>` | `<prompt>` | Execute task via ACP (auto-starts server) |
| `stream <prompt>` | `<prompt>` | Stream task output in real-time (auto-starts server) |

> **Note**: `acp start` is a blocking call — it holds the process alive for the STDIO pipe. Use `agents`, `run`, or `stream` for interactive use (they auto-start the server).

---

### `status`

List all background tasks (reads `.claude-trae-plugin/` for PID files).

<table><tr><td>Claude Code</td><td>/trae:status</td></tr><tr><td>OpenCode</td><td>trae-status tool</td></tr></table>

---

### `result <task-id>`

Get output of a background task.

<table><tr><td>Claude Code</td><td>/trae:result <task-id></td></tr><tr><td>OpenCode</td><td>trae-result tool with `task_id`</td></tr></table>

---

### `cancel <task-id>`

Force-kill a background task (SIGKILL).

<table><tr><td>Claude Code</td><td>/trae:cancel <task-id></td></tr><tr><td>OpenCode</td><td>trae-cancel tool with `task_id`</td></tr></table>

---

### `rescue`

Diagnose recent task failures, collect error logs and git status.

<table><tr><td>Claude Code</td><td>/trae:rescue [--context text]</td></tr><tr><td>OpenCode</td><td>trae-rescue tool with optional `context`</td></tr></table>

| Option | Description |
|--------|-------------|
| `--context <text>` | Additional context for diagnosis |

---

### Lifecycle Hooks

Auto-triggered — no manual invocation needed.

| Hook | Trigger | Behavior |
|------|---------|----------|
| `SessionStart` | Claude Code startup / OpenCode session.created | Check trae-cli, remind background tasks |
| `SessionEnd` | Claude Code exit / OpenCode session.deleted | Clean old logs, remind running tasks |
| `Stop` | User stops operation | Gate on uncommitted changes |
| `PostToolUse` | After `/trae:review` | Log review results |

---

### `hooks <type>` (internal)

Internal hook handler — invoked by lifecycle scripts, not users.

```bash
trae-plugin-cc hooks session-start|session-end|stop-gate
```

## Project Structure

```
trae-plugin-cc/
├── .claude-plugin/          # Claude Code plugin + marketplace manifest
├── commands/                # Slash command docs (*.md)
├── .mcp.json                # 4 MCP tool definitions
├── hooks/hooks.json         # Claude Code lifecycle hooks
├── scripts/                 # Hook scripts (*.mjs)
├── src/                     # Core CLI (TypeScript → dist/index.js)
│   ├── index.ts             # Entrypoint
│   ├── commands/            # Command handlers
│   └── utils/               # TraeExecutor, SessionReader, AuthBridge, AcpClient...
├── .opencode/               # OpenCode integration
│   ├── tools/               # 9 Bun tools (*.ts)
│   ├── commands/            # 10 command docs (*.md)
│   ├── plugins/             # Event hooks
│   └── package.json         # OpenCode deps (@opencode-ai/plugin)
└── tests/                   # Jest tests
```

## Development

```bash
npm run build          # esbuild → dist/index.js (run after ANY src/ change)
npm test               # jest (all tests)
cd .opencode && npm install && cd ..   # OpenCode deps (once)
```

### Build After Pulling Updates

When you pull new code from the repository:

```bash
git pull
npm run build   # required if src/ files changed
```

> `npm install` also builds (via `postinstall`), so either command works after a `git pull`.

### ⚠️ Build Rule

`npm run build` uses **esbuild** (bundled single file with shebang) — this is the **production entrypoint**. `npm run build:tsc` produces separate `.js` files for module imports but is not used at runtime.

| Command | Output | Used By |
|---------|--------|---------|
| `npm run build` | `dist/index.js` (bundled) | **Runtime CLI** |
| `npm run build:tsc` | `dist/**/*.js` (separate) | Direct module imports |

**Always run `npm run build` after modifying `src/` before testing.** This applies to OpenCode too — its tools spawn `dist/index.js`.

## Session Cache Paths

trae-cli stores sessions on disk (read directly by this plugin):

| Platform | Path |
|----------|------|
| macOS | `~/Library/Caches/trae_cli/sessions/` |
| Linux | `~/.cache/trae_cli/sessions/` |

## License

MIT
