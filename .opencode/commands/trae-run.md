---
description: Delegates a natural-language task to Trae Agent (trae-cli) for execution. Supports session resume, tool control, structured output, isolated git worktrees, YOLO mode, and background execution.
---

Execute the task by running the trae-plugin-cc CLI:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" run $ARGUMENTS
```

If the user provides no arguments, show usage:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" run
```

Usage examples:
- `task "refactor the user module"`
- `task "fix the login bug" --yolo`
- `task "generate project docs" --background`
- `task "analyze the codebase" --json`
- `task "continue" --resume`
- `task "continue" --resume 0d3cbdc3-e365-468e-982c-fb3d5849f5cc`
- `task "experimental changes" --worktree`
- `task "run script" --allowed-tool Bash --allowed-tool Edit`
- `task "continue optimization" --inject-context abc123`
- `task "continue current implementation" --session-summary-source cache --host-session-id claude-session-123`

OpenCode tools default to `host_session_summary.enabled=true` and `host_session_summary.source=auto`, so the current OpenCode session summary will be injected unless explicitly disabled with `inject_current_session=false` or `session_summary_source="off"`.
