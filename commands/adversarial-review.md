# /trae:adversarial-review

**Description:**
进行对抗性审查（Adversarial Review）。与标准审查不同，它会要求 Trae Agent 专门挑刺、质疑假设，找出潜在的安全漏洞或深层逻辑错误。

**Usage:**
```bash
/trae:adversarial-review [--base main] [--background]
```

**Options:**
- `--base <branch>`: 指定对比的基准分支，默认为 `main`。
- `--background`: 将审查任务放到后台运行，适用于大型审查。

**Internal Execution:**
```bash
npx --yes trae-plugin-cc adversarial-review [--base <branch>] [--background]
```
