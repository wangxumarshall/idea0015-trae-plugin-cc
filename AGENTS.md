# trae-plugin-cc — Agent Guide

## What this does

A Claude Code + OpenCode plugin that delegates tasks to 字节 Trae Agent (`trae-cli`).
Provides slash commands, MCP tools, Bun-based OpenCode tools/commands, and lifecycle hooks.

## Developer Commands

### Claude Code / CLI
```bash
npm run build      # bundle via esbuild (NOT tsc)
npm run build:tsc  # alternative: tsc only (rarely needed)
npm test           # jest, runs all tests/commands/*.test.ts
node dist/index.js <cmd> [args]  # run CLI directly
```

### OpenCode (Bun-based)
```bash
cd .opencode && npm install && cd ..   # install plugin deps (once)
# No build needed for .opencode/tools/*.ts — Bun runs them directly
# BUT: src/ changes still require `npm run build` (tools invoke dist/index.js)
```

**Build MUST use `npm run build`** (esbuild) — the dist/index.js output
includes a `#!/usr/bin/env node` shebang and is bundled with externals.
`tsc` output in dist/ is incomplete for production use.

## Architecture in brief

```
commands/*.md        → Claude Code slash command definitions
.mcp.json            → 4 MCP tools (trae_run, trae_review, trae_sessions, trae_acp)
hooks/hooks.json     → SessionStart, SessionEnd, Stop, PostToolUse hooks
src/commands/*.ts    → CLI command handlers (invoked by node dist/index.js)
src/utils/*.ts       → Shared utilities
scripts/*.mjs        → Hook scripts (run directly by hooks.json, NOT by CLI)
.opencode/tools/*.ts → OpenCode Bun tools (run directly by Bun, NO build needed)
.opencode/commands/*.md → OpenCode command descriptions for agents
.opencode/plugins/trae-hooks.ts → OpenCode lifecycle event hooks
```

## Key Commands / Internal Entrypoint

The single CLI entrypoint is `src/index.ts` → `dist/index.js`:

```
trae-plugin-cc <command>
  setup              # check trae-cli install + auth
  run "prompt"       # delegate task to trae-cli
  review             # git diff + review
  adversarial-review # same but strict prompt
  sessions <action>  # list/detail/conversation/tools/context/find/delete/delete-smoke
  acp <action>       # start/stop/status/agents/run/stream
  status             # background job listing
  result <job-id>    # read job log
  cancel <job-id>    # SIGKILL a background job
  rescue             # diagnose recent failures
  hooks <hook-type>  # internal (session-start/session-end/stop-gate)
```

## Runtime Dependencies

- **trae-cli** must be installed and authenticated (`~/.trae/trae_cli.yaml`)
- trae-cli may live in `~/.local/bin/` — PATH prepend logic exists in
  `src/utils.ts:getTraeCliEnv`, `src/utils/auth-bridge.ts:buildSpawnEnv`,
  and `src/utils/acp-server-manager.ts`
- Sessions cached at `~/Library/Caches/trae_cli/sessions/` (macOS) or
  `~/.cache/trae_cli/sessions/` (Linux)

## Testing Notes

- Jest + ts-jest, `testEnvironment: "node"`
- Tests mock `child_process`, `fs`, traеe-executor
- `npm test` runs fast (~12s), tests all 5 test files
- No separate lint or typecheck scripts — rely on `npm run build`
  and `npm test`

## Build → Test Order

```bash
npm run build && npm test
```

Run build before testing so dist/ matches src/.

## ⚠️ CRITICAL: Always compile after changes

**You MUST run `npm run build` after ANY change to `src/` files before testing or verifying.**

The runtime entrypoint is `dist/index.js` (bundled via esbuild), NOT `src/index.ts`.
If you modify any `.ts` file in `src/` and immediately test with `node dist/index.js` or `dist/utils/*.js`, you will be running **stale code** because tsc (`npm run build:tsc`) and esbuild (`npm run build`) produce separate outputs:

| Command | Output | Used by |
|---------|--------|---------|
| `npm run build` | `dist/index.js` (bundled, with shebang) | **Runtime CLI** (`node dist/index.js`) |
| `npm run build:tsc` | `dist/**/*.js` (separate .js files) | Direct module imports (`require('dist/utils/acp-server-manager.js')`) |

**Rule of thumb: Always run `npm run build` before any verification.**

## Directory Conventions

| Directory | Purpose |
|-----------|---------|
| `.claude-plugin/` | Claude Code plugin + marketplace manifest |
| `commands/` | Slash command `.md` files (user-facing docs) |
| `src/commands/` | TypeScript handlers for each CLI subcommand |
| `src/utils/` | Shared: TraеExecutor, SessionReader, AuthBridge, Acp*, etc. |
| `scripts/` | `.mjs` hook scripts — called by hooks.json, not by CLI |
| `.opencode/tools/` | OpenCode Bun tools (`export default tool({...})`), run directly by Bun |
| `.opencode/commands/` | OpenCode command descriptions (`.md` with Frontmatter) |
| `.opencode/plugins/` | OpenCode lifecycle hooks (event-driven, not hooks.json) |
| `.opencode/package.json` | OpenCode deps (`@opencode-ai/plugin`), managed separately |

## OpenCode Tool → CLI Mapping

Each `.opencode/tools/*.ts` maps to a CLI subcommand via `spawn("node", [dist/index.js, cmd, ...args])`:

| OpenCode Tool | CLI Command | Notes |
|--------------|-------------|-------|
| `trae-setup` | `setup` | No args |
| `trae-run` | `run` | Supports all CLI flags (resume, yolo, worktree, etc.) |
| `trae-review` | `review` / `adversarial-review` | Uses `adversarial` boolean arg |
| `trae-sessions` | `sessions` | Supports all 9 actions including `delete-smoke` |
| `trae-acp` | `acp` | Supports start/stop/status/agents/run/stream |
| `trae-status` | `status` | No args |
| `trae-result` | `result` | Requires `task_id` arg |
| `trae-cancel` | `cancel` | Requires `task_id` arg |
| `trae-rescue` | `rescue` | Optional `context` arg |

**Critical**: OpenCode tools call `dist/index.js`, so **any `src/` change requires `npm run build`** before the OpenCode tools pick it up.
