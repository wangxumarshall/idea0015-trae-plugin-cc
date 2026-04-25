import { tool } from "@opencode-ai/plugin"
import { $ } from "bun"
import path from "path"

const PLUGIN_DIR = path.dirname(path.dirname(import.meta.dir))
const DIST_INDEX = path.join(PLUGIN_DIR, "dist", "index.js")

export default tool({
  description:
    "使用 Trae Agent 执行任意自然语言任务。支持会话恢复、工具控制、结构化输出、隔离工作树、YOLO 模式、后台执行等高级选项。通过 trae-cli auth 认证，无需额外 API Key。",
  args: {
    prompt: tool.schema.string().describe("任务描述"),
    resume: tool.schema
      .string()
      .optional()
      .describe("恢复会话：会话ID 或 'AUTO' 自动恢复最近会话"),
    session_id: tool.schema.string().optional().describe("指定新会话 ID"),
    yolo: tool.schema.boolean().optional().describe("YOLO 模式，跳过工具权限确认"),
    allowed_tools: tool.schema
      .array(tool.schema.string())
      .optional()
      .describe("自动批准的工具列表，如 Bash, Edit, Replace"),
    disallowed_tools: tool.schema
      .array(tool.schema.string())
      .optional()
      .describe("自动拒绝的工具列表"),
    json_output: tool.schema.boolean().optional().describe("返回结构化 JSON 输出"),
    background: tool.schema.boolean().optional().describe("后台执行"),
    worktree: tool.schema
      .string()
      .optional()
      .describe("在隔离的 git worktree 中工作，'__auto__' 自动生成名称"),
    query_timeout: tool.schema
      .string()
      .optional()
      .describe("单次查询超时，如 30s, 5m"),
    bash_tool_timeout: tool.schema.string().optional().describe("Bash 工具超时"),
    inject_context: tool.schema
      .string()
      .optional()
      .describe("注入指定会话的上下文到 prompt 中"),
    inject_current_session: tool.schema
      .boolean()
      .optional()
      .describe("是否注入当前 OpenCode 会话摘要；默认自动开启"),
    session_summary_source: tool.schema
      .enum(["auto", "cache", "off"])
      .optional()
      .describe("宿主会话摘要来源：auto|cache|off"),
    session_summary_text: tool.schema
      .string()
      .optional()
      .describe("显式提供宿主会话摘要文本，优先级高于自动缓存"),
    host_session_id: tool.schema
      .string()
      .optional()
      .describe("读取指定宿主会话 ID 的摘要缓存"),
  },
  async execute(args, context) {
    const cliArgs: string[] = ["node", DIST_INDEX, "run"]

    cliArgs.push(args.prompt)
    if (args.resume) cliArgs.push("--resume", args.resume)
    if (args.session_id) cliArgs.push("--session-id", args.session_id)
    if (args.yolo) cliArgs.push("--yolo")
    if (args.allowed_tools)
      for (const t of args.allowed_tools) cliArgs.push("--allowed-tool", t)
    if (args.disallowed_tools)
      for (const t of args.disallowed_tools) cliArgs.push("--disallowed-tool", t)
    if (args.json_output) cliArgs.push("--json")
    if (args.background) cliArgs.push("--background")
    if (args.worktree) cliArgs.push("--worktree", args.worktree)
    if (args.query_timeout) cliArgs.push("--query-timeout", args.query_timeout)
    if (args.bash_tool_timeout)
      cliArgs.push("--bash-tool-timeout", args.bash_tool_timeout)
    if (args.inject_context)
      cliArgs.push("--inject-context", args.inject_context)

    cliArgs.push("-c", "host_session_summary.platform=opencode")
    if (args.inject_current_session === false || args.session_summary_source === "off") {
      cliArgs.push("-c", "host_session_summary.enabled=false")
      cliArgs.push("-c", "host_session_summary.source=off")
    } else {
      cliArgs.push("-c", "host_session_summary.enabled=true")
      cliArgs.push("-c", "host_session_summary.source=auto")
      if (
        args.inject_current_session === true ||
        args.session_summary_source ||
        args.session_summary_text ||
        args.host_session_id
      ) {
        cliArgs.push("--inject-current-session")
      }
      if (args.session_summary_source)
        cliArgs.push("--session-summary-source", args.session_summary_source)
      if (args.session_summary_text)
        cliArgs.push("--session-summary-text", args.session_summary_text)
      if (args.host_session_id)
        cliArgs.push("--host-session-id", args.host_session_id)
    }

    const result = await $`${cliArgs}`.quiet().cwd(PLUGIN_DIR)
    if (result.exitCode !== 0 && result.stderr) {
      process.stderr.write(result.stderr)
    }
    return {
      text: result.stdout,
    }
  },
})
