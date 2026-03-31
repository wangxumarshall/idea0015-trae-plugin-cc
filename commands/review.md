---
description: 对当前 Git 变更或指定 branch 进行标准的代码审查
allowed-tools: Bash(git:*), Bash(trae-cli:*)
---

# /trae:review

**Description:**
对当前 Git 变更或指定 branch 进行标准的代码审查。它会自动抓取 `git diff` 并交给 Trae Agent 审查。

**Usage:**
```bash
/trae:review [--base main] [--background]
```

**Options:**
- `--base <branch>`: 指定对比的基准分支，默认为 `main`。
- `--background`: 将审查任务放到后台运行，适用于大型审查。

**Internal Execution:**
```bash
npx --yes trae-plugin-cc review [--base <branch>] [--background]
```
