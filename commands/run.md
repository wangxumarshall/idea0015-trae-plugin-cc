# /trae:run

**Description:**
将任务描述直接交给 Trae Agent (`trae-cli`) 执行。当你遇到 Claude Code 卡住或需要不同的 Agent 接手时使用。

**Usage:**
```bash
/trae:run "自然语言任务描述" [--background]
```

**Options:**
- `--background`: 将任务放到后台运行。

**Internal Execution:**
```bash
npx --yes trae-plugin-cc run "任务描述" [--background]
```
