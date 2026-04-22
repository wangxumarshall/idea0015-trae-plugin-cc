# trae-plugin-cc

在 Claude Code 中无缝使用字节 Trae Agent (trae-cli) 的插件。支持任务委托、代码审查、会话管理、ACP 协议通信，实现与 Claude Code 原生功能一致的体验。

## 功能概览

| 功能 | 说明 | 核心文件 |
|------|------|----------|
| 任务执行 | 将自然语言任务委托给 Trae Agent，支持 YOLO 模式、会话恢复、隔离工作树 | `src/commands/run.ts` |
| 代码审查 | 自动获取 git diff 提交审查，支持标准/对抗性审查模式，智能检测基准分支 | `src/commands/review.ts` |
| 会话管理 | 读取 trae-cli 历史会话、对话历史、工具调用记录、上下文摘要 | `src/commands/sessions.ts` |
| ACP 协议 | 通过 ACP (Agent Communication Protocol) 与 Trae Agent 交互，支持流式执行 | `src/commands/acp.ts` |
| 上下文注入 | 将已有会话上下文注入到新任务中，实现跨会话连续性 | `src/utils/context-bridge.ts` |
| MCP 工具 | Claude AI 自主调用 trae-cli，用户无需手动触发 | `.mcp.json` |
| 后台任务 | 支持后台执行长时间任务，可查询状态、获取结果、取消任务 | `src/commands/jobs.ts` |
| 故障恢复 | 分析失败任务并提供诊断建议 | `src/commands/rescue.ts` |

## 示例

### 1: 对抗性代码审查

```bash
/trae:adversarial-review
```
极度严苛的审查模式，专门挑刺、质疑假设、主动寻找安全漏洞和性能瓶颈。

### 2: Token 额度互补

```bash
/trae:run "重构大型模块" --yolo
```
额度不足时，无缝切换到 trae-cli 账号额度继续工作。

### 3: 上下文共享

```bash
/trae:run "优化登录模块" --inject-context <session-id>
```
已理解的项目上下文直接注入 Trae，无需重新分析。

### 4: 任务委托

```bash
/trae:run "重构用户模块" --yolo
```
将编码任务委托给 Trae Agent，体验与原生功能一致。

### 5: 代码审查

```bash
/trae:review
```
自动获取 git diff，提交给 Trae 进行专业代码审查。

### 6: 会话管理

```bash
/trae:run "继续任务" --resume
```
恢复历史会话，无需记忆 session ID。

### 7: ACP 协议通信

```bash
/trae:acp run "分析代码质量"
```
通过 ACP 协议实现跨框架 Agent 协作。

### 8: 后台任务

```bash
/trae:run "分析整个代码库" --background
```
长时间任务后台执行，不阻塞当前工作流。

## 前置条件

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI 已安装
- [trae-cli](https://docs.trae.cn/cli) 已安装并完成 auth 认证

```bash
# 验证 trae-cli 是否可用
trae-cli --help

# 验证认证状态（需看到模型名称和登录地址）
cat ~/.trae/trae_cli.yaml
```

## 安装

### 方式 1: 通过 Claude Code Marketplace 安装（推荐）

```bash
# 步骤 1: 添加 Marketplace
claude plugin marketplace add https://github.com/wangxumarshall/trae-plugin-cc

# 步骤 2: 安装插件
claude plugin install trae

# 步骤 3: 验证安装
claude plugin list | grep trae
```

安装范围选项：
- `--scope user`（默认）: 全局可用
- `--scope project`: 仅当前项目可用
- `--scope local`: 仅当前会话可用

### 方式 2: 从本地目录安装

```bash
# 步骤 1: 克隆并编译
git clone https://github.com/wangxumarshall/trae-plugin-cc.git
cd trae-plugin-cc
npm install
npm run build

# 步骤 2: 添加本地 Marketplace
claude plugin marketplace add /path/to/trae-plugin-cc

# 步骤 3: 安装插件
claude plugin install trae
```

### 方式 3: 手动验证插件

```bash
# 验证插件清单是否合法
claude plugin validate /path/to/trae-plugin-cc
# 应输出: ✔ Validation passed
```

## 安装后配置与验证

### 步骤 1: 验证 trae-cli 认证

```bash
# 在 Claude Code 中运行
/trae:setup
```

预期输出：
```
检查 trae-cli 状态...

✅ trae-cli 已安装并可用！

## 认证状态

  已认证: ✅
  配置文件: ~/.trae/trae_cli.yaml (存在)
  模型: GLM-5.1
  登录地址: https://console.enterprise.trae.cn

  已允许的工具: Edit, Write

## ACP/MCP 服务

  ACP Server: trae-cli acp serve
  MCP Server: trae-cli mcp serve
```

如果认证状态为 ❌，请先运行 `trae-cli` 完成登录。

### 步骤 2: 验证 MCP 工具

插件安装后，`.mcp.json` 中定义的 4 个 MCP 工具自动注册到 Claude Code：

| 工具 | 说明 | 触发方式 |
|------|------|---------|
| `trae_run` | 执行任务 | Claude AI 自主调用 或 `/trae:run` |
| `trae_review` | 代码审查 | Claude AI 自主调用 或 `/trae:review` |
| `trae_sessions` | 会话管理 | Claude AI 自主调用 或 `/trae:sessions` |
| `trae_acp` | ACP 协议管理 | Claude AI 自主调用 或 `/trae:acp` |

### 步骤 3: 验证 ACP 配置

```bash
# 检查 ACP Server 状态
/trae:acp status

# 启动 ACP Server
/trae:acp start

# 发现可用 Agent
/trae:acp agents
```

ACP Server 支持的参数（与 `trae-cli acp serve` 一致）：

| 参数 | 说明 | 示例 |
|------|------|------|
| `--yolo` | 跳过工具权限确认 | `/trae:acp start --yolo` |
| `--allowed-tool` | 允许的工具 | `/trae:acp start --allowed-tool Bash` |
| `--disabled-tool` | 禁用的工具（默认禁用 AskUserQuestion） | `/trae:acp start --disabled-tool AskUserQuestion` |

### 步骤 4: 验证 MCP Server 配置

trae-cli 也支持 MCP Server 模式：

```bash
# 直接启动 MCP Server（COCO 协议）
trae-cli mcp serve

# 添加 MCP Server 到配置
trae-cli mcp add-json 'my-server' '{"command":"npx","args":["my-mcp-server"]}'
```

## 无缝使用指南

### 集成架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Claude Code                                   │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  ① 斜杠命令 (commands/*.md)     用户主动触发                    │ │
│  │     /trae:run, /trae:review, /trae:sessions, /trae:acp        │ │
│  ├────────────────────────────────────────────────────────────────┤ │
│  │  ② MCP 工具 (.mcp.json)        Claude AI 自主决策调用          │ │
│  │     trae_run, trae_review, trae_sessions, trae_acp             │ │
│  ├────────────────────────────────────────────────────────────────┤ │
│  │  ③ 钩子 (hooks/hooks.json)     生命周期事件自动触发            │ │
│  │     SessionStart, SessionEnd, Stop, PostToolUse                │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                           │                                          │
│  ┌────────────────────────▼──────────────────────────────────────┐ │
│  │  TraeExecutor → trae-cli 子进程 (继承 auth token)              │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 方式 A: 斜杠命令（用户主动触发）

```bash
# 执行任务
/trae:run "重构用户认证模块"

# YOLO 模式（跳过工具权限确认，体验与 Claude Code 原生一致）
/trae:run "修复登录bug" --yolo

# 代码审查（自动获取 git diff）
/trae:review

# 对抗性审查
/trae:adversarial-review

# 恢复会话
/trae:run "继续之前的任务" --resume

# 查看历史会话
/trae:sessions list

# 通过 ACP 执行
/trae:acp start
/trae:acp run "分析代码质量"
```

### 方式 B: MCP 工具调用（AI 自主决策，用户无感）

Claude AI 根据对话上下文自主调用 MCP 工具，用户无需输入斜杠命令：

```
用户: "帮我审查一下当前代码变更"
  → Claude AI 自动调用 trae_review
  → 体验与 Claude Code 原生 /review 完全一致

用户: "用 Trae Agent 重构认证模块"
  → Claude AI 自动调用 trae_run, prompt="重构认证模块"

用户: "我之前用 Trae 做了什么？"
  → Claude AI 自动调用 trae_sessions, action="list"
```

### 方式 C: 钩子自动触发（完全无感）

| 钩子 | 触发时机 | 行为 |
|------|---------|------|
| `SessionStart` | Claude Code 启动 | 检查 trae-cli 状态 |
| `SessionEnd` | Claude Code 退出 | 清理会话资源 |
| `Stop` | 用户停止操作 | 触发审查门禁 |
| `PostToolUse` | 执行 `/trae:review` 后 | 记录审查结果 |

## 核心功能详解

### 1. 任务执行 (`/trae:run`)

将自然语言任务委托给 Trae Agent 执行，支持多种执行模式和高级配置。

**执行模式**:

| 模式 | 参数 | 说明 |
|------|------|------|
| 前台执行 | (默认) | 阻塞当前会话，实时输出结果 |
| 后台执行 | `--background` | 不阻塞当前会话，适合长时间任务 |
| YOLO 模式 | `--yolo` / `-y` | 自动确认所有工具权限，无需人工干预 |
| 会话恢复 | `--resume [ID]` | 恢复之前的会话继续执行 |
| Worktree 隔离 | `--worktree` | 在隔离的 git worktree 中执行，不影响主分支 |

**高级参数**:

| 参数 | 说明 | 示例 |
|------|------|------|
| `--session-id <ID>` | 指定会话 ID | `--session-id my-session` |
| `--allowed-tool <TOOL>` | 自动批准的工具（可多次指定） | `--allowed-tool Bash --allowed-tool Edit` |
| `--disallowed-tool <TOOL>` | 自动拒绝的工具 | `--disallowed-tool AskUserQuestion` |
| `--query-timeout <DURATION>` | 单次查询超时 | `--query-timeout 5m` |
| `--bash-tool-timeout <DURATION>` | Bash 工具超时 | `--bash-tool-timeout 30s` |
| `--inject-context <SESSION_ID>` | 注入其他会话的上下文 | `--inject-context abc123` |
| `-c KEY=VALUE` | 覆盖配置项 | `-c model.name=GLM-4` |
| `--json` | 输出结构化 JSON 结果 | `--json` |

**使用示例**:

```bash
# 基本任务执行
/trae:run "重构用户认证模块"

# YOLO 模式 - 自动确认所有操作
/trae:run "修复登录bug" --yolo

# 后台执行长时间任务
/trae:run "生成项目文档" --background

# 恢复最近的会话
/trae:run "继续之前的任务" --resume

# 恢复指定会话
/trae:run "继续" --resume 0d3cbdc3-e365-468e-982c-fb3d5849f5cc

# 在隔离的 worktree 中实验性修改
/trae:run "实验性重构" --worktree

# 注入其他会话的上下文
/trae:run "继续优化" --inject-context abc123

# 获取结构化输出
/trae:run "分析项目" --json
```

**内部实现**:
- `TraeExecutor` 类管理 trae-cli 子进程生命周期
- 自动继承 `~/.trae/trae_cli.yaml` 中的认证信息
- 后台任务存储在 `.claude-trae-plugin/` 目录

---

### 2. 代码审查 (`/trae:review`)

自动获取 git diff 并提交给 Trae Agent 进行专业代码审查。

**智能特性**:
- **自动检测基准分支**: 分析 git 远程分支，智能选择 `main`/`master`/`develop` 作为基准
- **变更大小估算**: 自动估算变更规模，大型变更自动启用后台模式
- **对抗性审查模式**: 极度严苛的审查，专门挑刺和质疑假设

**审查模式对比**:

| 模式 | 命令 | 审查风格 |
|------|------|----------|
| 标准审查 | `/trae:review` | 专业代码审查，找出错误和改进建议 |
| 对抗性审查 | `/trae:adversarial-review` | 极度严苛，专门挑刺、质疑假设、找出安全漏洞 |

**支持的参数**:

| 参数 | 说明 |
|------|------|
| `--base <BRANCH>` | 指定基准分支（默认自动检测） |
| `--background` | 后台执行审查 |
| `--yolo` / `-y` | YOLO 模式 |
| `--json` | 结构化输出 |
| `--session-id <ID>` | 指定会话 ID |

**使用示例**:

```bash
# 标准审查（自动检测基准分支）
/trae:review

# 指定基准分支
/trae:review --base develop

# 对抗性审查
/trae:adversarial-review

# 后台执行大型审查
/trae:review --background
```

**内部实现**:
- `detectBaseBranch()` 自动检测基准分支
- `estimateReviewSize()` 估算变更规模
- 大型变更自动建议后台模式

---

### 3. 会话管理 (`/trae:sessions`)

管理和查询 Trae Agent 的历史会话，支持多种维度的查询和分析。

**支持的子命令**:

| 子命令 | 说明 | 示例 |
|--------|------|------|
| `list` | 列出所有会话（默认） | `/trae:sessions list --limit 10` |
| `recent` | 查看最近会话 | `/trae:sessions recent` |
| `detail <ID>` | 查看会话详情 | `/trae:sessions detail abc123` |
| `conversation <ID>` | 获取对话历史 | `/trae:sessions conversation abc123 --limit 50` |
| `tools <ID>` | 获取工具调用记录 | `/trae:sessions tools abc123` |
| `context <ID>` | 获取完整上下文摘要 | `/trae:sessions context abc123` |
| `find <TOPIC>` | 按主题搜索会话 | `/trae:sessions find "重构"` |
| `delete <ID>` | 删除会话 | `/trae:sessions delete abc123` |

**筛选选项**:
- `--cwd <PATH>`: 按工作目录筛选
- `--limit <N>`: 限制返回数量

**数据来源**:
直接读取 `~/Library/Caches/trae_cli/sessions/` 目录：
- `session.json`: 会话元数据（ID、标题、工作目录、模型、权限模式）
- `events.jsonl`: 完整事件流（对话消息、工具调用、状态变更）

**内部实现**:
- `SessionReader` 类直接读取文件系统，零延迟
- 解析 JSONL 事件流，聚合对话、工具调用、上下文信息

---

### 4. ACP 协议管理 (`/trae:acp`)

管理 ACP (Agent Communication Protocol) 服务器，实现跨框架 Agent 协作。

**支持的子命令**:

| 子命令 | 说明 | 示例 |
|--------|------|------|
| `start` | 启动 ACP Server | `/trae:acp start --yolo` |
| `stop` | 停止 ACP Server | `/trae:acp stop` |
| `status` | 查看服务器状态 | `/trae:acp status` |
| `agents` | 发现可用 Agent | `/trae:acp agents` |
| `run "任务"` | 通过 ACP 执行任务 | `/trae:acp run "分析代码"` |
| `stream "任务"` | 流式执行任务（实时输出） | `/trae:acp stream "实时分析"` |

**ACP Server 参数**:

| 参数 | 说明 |
|------|------|
| `--yolo` | 跳过工具权限确认 |
| `--allowed-tool <NAME>` | 允许的工具 |
| `--disabled-tool <NAME>` | 禁用的工具（默认禁用 AskUserQuestion） |

**ACP REST API 端点**:

| 端点 | 方法 | 说明 |
|------|------|------|
| `/agents` | GET | 发现可用 Agent |
| `/runs` | POST | 创建执行 |
| `/runs/stream` | POST | 流式执行（SSE） |
| `/runs/{id}` | GET | 查询执行状态 |

**内部实现**:
- `AcpServerManager` 管理 ACP Server 生命周期
- `AcpClient` 封装 REST API 调用
- 支持 SSE 流式输出

---

### 5. 后台任务管理

管理后台执行的长时间任务。

| 命令 | 说明 | 示例 |
|------|------|------|
| `/trae:status` | 查看所有后台任务状态 | `/trae:status` |
| `/trae:result <ID>` | 获取任务执行结果 | `/trae:result 1633022...` |
| `/trae:cancel <ID>` | 取消正在运行的任务 | `/trae:cancel 1633022...` |

**任务状态**:
- 运行中
- 已完成或已中止
- 无法验证状态

**任务存储**: `.claude-trae-plugin/` 目录
- `<timestamp>.pid`: 进程 ID 文件
- `<timestamp>.log`: 日志文件

---

### 6. 环境配置 (`/trae:setup`)

检查 trae-cli 安装和认证状态。

**检查项**:
- trae-cli 是否安装
- 认证状态（读取 `~/.trae/trae_cli.yaml`）
- 当前模型
- 已允许的工具
- 已安装的插件

---

### 7. 故障恢复 (`/trae:rescue`)

分析失败任务并提供恢复建议。

**支持的参数**:

| 参数 | 说明 |
|------|------|
| `--context <TEXT>` | 附加上下文信息 |
| `--retries <N>` | 重试次数 |
| `--force` | 强制执行 |

**工作流程**:
1. 收集最近的错误日志
2. 获取当前 git 状态
3. 分析最近提交
4. 提交给 Trae Agent 诊断

---

## 命令参考

### 任务执行

```bash
/trae:run "任务描述" [options]
```

| 选项 | 缩写 | 说明 |
|------|------|------|
| `--yolo` | `-y` | YOLO 模式，跳过工具权限确认 |
| `--background` | | 后台执行 |
| `--json` | | 返回结构化 JSON 输出（含 session_id） |
| `--resume [ID]` | | 恢复会话，不指定 ID 则自动恢复最近会话 |
| `--session-id <id>` | | 指定新会话 ID |
| `--worktree [NAME]` | `-w` | 在隔离的 git worktree 中工作 |
| `--allowed-tool <name>` | | 自动批准的工具（可多次指定） |
| `--disallowed-tool <name>` | | 自动拒绝的工具（可多次指定） |
| `--query-timeout <duration>` | | 单次查询超时（如 30s, 5m） |
| `--bash-tool-timeout <duration>` | | Bash 工具超时 |
| `--inject-context <session-id>` | | 注入指定会话的上下文到 prompt 中 |
| `-c k=v` | | 覆盖配置项（可多次指定） |

### 代码审查

```bash
/trae:review [options]
/trae:adversarial-review [options]
```

| 选项 | 说明 |
|------|------|
| `--base <branch>` | 基准分支（默认自动检测） |
| `--background` | 后台执行（大型变更自动启用） |
| `--yolo` / `-y` | YOLO 模式 |
| `--json` | 返回结构化 JSON 输出 |
| `--session-id <id>` | 指定会话 ID |

### 会话管理

```bash
/trae:sessions <action> [options]
```

| 动作 | 说明 | 必需参数 |
|------|------|---------|
| `list` | 列出所有会话 | — |
| `recent` | 查看最近会话 | — |
| `detail <id>` | 查看会话详情 | session-id |
| `conversation <id>` | 获取对话历史 | session-id |
| `tools <id>` | 获取工具调用记录 | session-id |
| `context <id>` | 获取完整上下文摘要 | session-id |
| `find <topic>` | 按主题搜索会话 | topic |
| `delete <id>` | 删除会话 | session-id |

选项：`--cwd <path>` 按工作目录筛选，`--limit <n>` 限制返回数量

### ACP 协议

```bash
/trae:acp <action> [options]
```

| 动作 | 说明 |
|------|------|
| `start` | 启动 ACP Server |
| `stop` | 停止 ACP Server |
| `status` | 查看服务器状态 |
| `agents` | 发现可用 Agent |
| `run "任务"` | 通过 ACP 执行任务 |
| `stream "任务"` | 流式执行任务（实时输出） |

`start` 选项：`--yolo`、`--allowed-tool <name>`、`--disabled-tool <name>`

### 其他命令

```bash
/trae:setup              # 环境配置检查
/trae:status             # 后台任务状态
/trae:result <task-id>   # 获取后台任务结果
/trae:cancel <task-id>   # 取消后台任务
/trae:rescue             # 故障恢复
```

## 三种上下文获取路径

### 路径 1: 文件系统直读

直接读取 `~/Library/Caches/trae_cli/sessions/` 下的文件，零延迟、无需启动进程。

| 文件 | 内容 |
|------|------|
| `session.json` | 会话元数据（ID、标题、工作目录、模型、权限模式） |
| `events.jsonl` | 完整事件流（对话消息、工具调用、状态变更） |

```bash
/trae:sessions list           # 读取 session.json
/trae:sessions conversation   # 解析 events.jsonl 的 message 事件
/trae:sessions tools          # 解析 events.jsonl 的 tool_call 事件
/trae:sessions context        # 综合分析所有事件
```

### 路径 2: --json 结构化输出

通过 `trae-cli -p --json` 执行任务，获取完整的结构化 JSON 输出，含 `session_id` 可追踪。

```bash
/trae:run "任务" --json
```

### 路径 3: ACP REST API

通过 `trae-cli acp serve` 启动 ACP Server，使用标准 REST + SSE 协议通信。

| API 端点 | 说明 |
|----------|------|
| `GET /agents` | 发现可用 Agent |
| `POST /runs` | 创建执行（含 session 管理） |
| `POST /runs/stream` | 流式执行（SSE） |
| `GET /runs/{id}` | 查询执行状态 |

```bash
/trae:acp start              # 启动 ACP Server
/trae:acp agents             # 发现 Agent
/trae:acp run "任务"         # 执行任务
/trae:acp stream "任务"      # 流式执行
```

### 路径选择指南

| 场景 | 推荐路径 |
|------|---------|
| 查询历史会话 | 路径 1（文件系统直读） |
| 执行任务并获取结构化结果 | 路径 2（--json） |
| 跨框架 Agent 协作 | 路径 3（ACP） |
| 恢复会话继续对话 | 路径 2（--resume） |
| 实时追踪执行进度 | 路径 3（SSE 流式） |

## 认证机制

trae-cli 使用 OAuth2 Auth 认证（非 API Key），认证配置存储在 `~/.trae/trae_cli.yaml`：

```yaml
allowed_tools:
  - Edit
  - Write
model:
  name: GLM-5.1
plugins:
  - enabled: true
    name: superpowers
    source: wangxumarshall/superpowers
    type: github
trae_login_base_url: https://console.enterprise.trae.cn
```

插件通过 `AuthBridge` 自动检测认证状态，无需用户手动配置 API Key。trae-cli 子进程自动继承 auth token。

## 项目结构

```
trae-plugin-cc/
├── .claude-plugin/
│   ├── plugin.json              # Claude Code 插件声明
│   └── marketplace.json         # Marketplace 清单
├── .mcp.json                    # MCP 工具声明（4 个工具）
├── commands/                    # Claude Code 斜杠命令定义
│   ├── run.md                   # /trae:run
│   ├── review.md                # /trae:review
│   ├── adversarial-review.md    # /trae:adversarial-review
│   ├── sessions.md              # /trae:sessions
│   ├── acp.md                   # /trae:acp
│   ├── setup.md                 # /trae:setup
│   ├── status.md                # /trae:status
│   ├── result.md                # /trae:result
│   ├── cancel.md                # /trae:cancel
│   └── rescue.md                # /trae:rescue
├── hooks/
│   └── hooks.json               # Claude Code 钩子配置
├── scripts/                     # 钩子脚本
│   ├── session-lifecycle-hook.mjs
│   ├── stop-review-gate-hook.mjs
│   ├── trae-companion.mjs
│   └── job-utils.mjs
├── src/
│   ├── index.ts                 # CLI 入口
│   ├── utils.ts                 # 公共工具 + 模块导出
│   ├── commands/
│   │   ├── run.ts               # 任务执行（增强型执行器）
│   │   ├── review.ts            # 代码审查
│   │   ├── sessions.ts          # 会话管理
│   │   ├── acp.ts               # ACP 协议管理
│   │   ├── setup.ts             # 环境配置与认证检查
│   │   ├── jobs.ts              # 后台任务管理
│   │   ├── hooks.ts             # 钩子处理
│   │   └── rescue.ts            # 故障恢复
│   └── utils/
│       ├── session-reader.ts    # 会话数据读取器（路径1: 文件系统直读）
│       ├── trae-executor.ts     # 增强型执行器（路径2: --json 结构化输出）
│       ├── acp-client.ts        # ACP REST API 客户端（路径3: ACP 协议）
│       ├── acp-server-manager.ts # ACP Server 生命周期管理
│       ├── auth-bridge.ts       # Auth 认证桥接
│       ├── context-bridge.ts    # 上下文桥接（跨会话注入）
│       └── branch-detection.ts  # Git 分支自动检测
└── tests/                       # 测试用例
```

## 核心工具类

### TraeExecutor (`src/utils/trae-executor.ts`)

管理 trae-cli 子进程的核心执行器。

**主要功能**:
- 子进程生命周期管理
- 前台/后台执行模式切换
- 参数构建和环境变量传递
- 输出捕获和日志记录
- JSON 输出解析

**接口定义**:

```typescript
interface TraeTaskConfig {
  prompt: string;
  background?: boolean;
  jsonOutput?: boolean;
  yolo?: boolean;
  allowedTools?: string[];
  disallowedTools?: string[];
  sessionId?: string;
  resume?: string;
  worktree?: string;
  queryTimeout?: string;
  bashToolTimeout?: string;
  configOverrides?: Record<string, string>;
}

interface TraeTaskResult {
  taskId: string;
  output: string;
  exitCode: number | null;
  sessionId?: string;
  duration: number;
  jsonOutput?: any;
}
```

---

### SessionReader (`src/utils/session-reader.ts`)

直接读取文件系统获取会话数据，零延迟访问。

**主要功能**:
- 列出所有会话
- 获取会话元数据和事件
- 解析对话历史
- 聚合工具调用记录
- 生成上下文摘要

**数据源**: `~/Library/Caches/trae_cli/sessions/`

---

### AuthBridge (`src/utils/auth-bridge.ts`)

自动检测认证状态，无需用户手动配置。

**主要功能**:
- 读取 `~/.trae/trae_cli.yaml` 配置
- 检测认证状态
- 获取模型、工具、插件配置
- 构建子进程环境变量

---

### ContextBridge (`src/utils/context-bridge.ts`)

跨会话上下文注入，实现会话连续性。

**主要功能**:
- 构建会话摘要
- 注入上下文到新任务
- 支持会话恢复

---

### AcpServerManager (`src/utils/acp-server-manager.ts`)

ACP Server 生命周期管理。

**主要功能**:
- 启动/停止 ACP Server
- 管理服务器状态
- 获取 ACP Client

---

### AcpClient (`src/utils/acp-client.ts`)

ACP REST API 客户端封装。

**主要功能**:
- 健康检查
- 发现 Agent
- 执行任务
- 流式执行（SSE）

---

### BranchDetection (`src/utils/branch-detection.ts`)

Git 分支自动检测工具。

**主要功能**:
- 自动检测基准分支
- 估算变更大小
- 格式化估算结果

## 钩子

| 钩子 | 触发时机 | 脚本 |
|------|---------|------|
| `SessionStart` | Claude Code 会话启动 | `session-lifecycle-hook.mjs` |
| `SessionEnd` | Claude Code 会话结束 | `session-lifecycle-hook.mjs` |
| `Stop` | 用户停止操作 | `stop-review-gate-hook.mjs` |
| `PostToolUse` | 执行 `/trae:review` 后 | `session-lifecycle-hook.mjs` |

## 开发

```bash
# 编译
npm run build

# 运行测试
npm test

# 直接运行 CLI
node dist/index.js <command> [args]

# 验证插件
claude plugin validate /path/to/trae-plugin-cc
```

## License

MIT
