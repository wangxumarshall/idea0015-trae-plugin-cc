# Trae Plugin for Claude Code

A "parasitic" Claude Code plugin that integrates Bytedance's open-source LLM-based software engineering agent, [trae-cli](https://github.com/bytedance/trae-agent).

Inspired by the `openai/codex-plugin-cc`, this plugin allows you to execute `trae-cli` directly inside Claude Code via slash commands (`/trae:` prefix) **without additional runtimes, secondary authentication, or wasting tokens.**

## Features

- **No New Runtimes:** Relies entirely on your local `trae-cli` installation.
- **Context Injection:** Automatically grabs your git diffs and passes them directly to Trae Agent for reviews.
- **Adversarial Reviews:** Leverage Trae Agent to rigorously scrutinize changes before landing them.
- **Task Delegation:** If Claude Code is stuck, hand the task over to Trae Agent to see if it can solve the problem.
- **Background Tasks:** Send long-running reviews and tasks to the background and check their status later.
- **Review Gate (Optional):** Ensure high-quality code. Enable the post-tool-use hook so Claude Code *must* pass a `/trae:review` before continuing.

## Prerequisites

You must have `trae-cli` installed globally on your machine.

If you don't have it, run `/trae:setup` inside Claude Code after installing this plugin, or run:

```bash
git clone https://github.com/bytedance/trae-agent.git
cd trae-agent
uv sync --all-extras
cp trae_config.yaml.example trae_config.yaml
# Edit trae_config.yaml with your provider/API keys
uv tool install .
```

Ensure `trae-cli --help` works in your terminal.

## Installation

Inside Claude Code:

```bash
/plugin marketplace add wangxumarshall/trae-plugin-cc
/plugin install trae@wangxumarshall-trae-plugin-cc
/reload-plugins
```

Then verify your setup:

```bash
/trae:setup
```

## Commands

### Standard & Adversarial Reviews

- `/trae:review [--base main] [--background]`: Conduct a standard, professional code review of your current Git changes against `main` (or a specified base branch).
- `/trae:adversarial-review [--base main] [--background]`: Conduct an adversarial review, where Trae Agent specifically looks for flaws, challenges assumptions, and seeks out deep logic errors.

*Note: The plugin automatically retrieves your `git diff`.*

### Task Delegation

- `/trae:run "Refactor the authentication module" [--background]`: Delegate a natural language task to Trae Agent.

### Background Task Management

If you run commands with `--background`, use these commands to manage them:

- `/trae:status`: List all background tasks and their current running state.
- `/trae:result <Task ID>`: Fetch the results of a specific task.
- `/trae:cancel <Task ID>`: Forcibly kill a background task.

## Architecture & How it works

- **Plugin Logic:** Built in TypeScript, compiled to Node.js CLI.
- **Hooks & MCP:** Uses `.claude-plugin/plugin.json` and `.mcp.json` to expose tools natively to Claude.
- **Parasitic Execution:** We spawn `trae-cli` using `child_process`. We do not handle tokens or LLM calls; we let `trae-cli` use its own configuration (`trae_config.yaml`).
- **Context:** Because the plugin runs in the same workspace directory as Claude Code, `trae-cli` naturally inherits your codebase context.

## Author

Created by wangxumarshall.
