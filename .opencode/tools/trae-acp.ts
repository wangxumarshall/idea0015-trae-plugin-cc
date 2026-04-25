import { tool } from "@opencode-ai/plugin"
import path from "path"

const PLUGIN_DIR = path.dirname(path.dirname(import.meta.dir))
const DIST_INDEX = path.join(PLUGIN_DIR, "dist", "index.js")

export default tool({
  description:
    "通过 ACP (Agent Communication Protocol) 与 Trae Agent 交互。启动/停止 ACP Server，发现可用 Agent，执行任务、流式获取结果或基于同一 session 继续对话。ACP 使用 STDIO JSON-RPC，由 trae-cli acp serve 提供。",
  args: {
    action: tool.schema
      .enum(["start", "stop", "status", "agents", "run", "stream", "chat"])
      .describe("操作类型"),
    prompt: tool.schema.string().optional().describe("任务描述 (run/stream/chat 需要；chat 在非交互模式下会执行单轮后退出)"),
    yolo: tool.schema.boolean().optional().describe("YOLO 模式 (start/run/chat 自动启动 server 时)"),
    allowed_tools: tool.schema
      .array(tool.schema.string())
      .optional()
      .describe("允许的工具 (start/chat 自动启动 server 时)"),
    disabled_tools: tool.schema
      .array(tool.schema.string())
      .optional()
      .describe("禁用的工具 (start/chat 自动启动 server 时)"),
    session_id: tool.schema.string().optional().describe("chat: 指定已有 session ID"),
    resume: tool.schema
      .string()
      .optional()
      .describe('chat: 恢复 session，传入会话 ID 或 "AUTO" 恢复当前目录最近会话'),
    cwd: tool.schema.string().optional().describe("chat: 创建/加载 session 时使用的工作目录"),
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
    const { $ } = await import("bun")
    const cliArgs: string[] = ["node", DIST_INDEX, "acp", args.action]
    const promptAction = args.action === "run" || args.action === "stream" || args.action === "chat"

    if (args.prompt && promptAction)
      cliArgs.push(args.prompt)
    if (args.yolo) cliArgs.push("--yolo")
    if (args.allowed_tools)
      for (const t of args.allowed_tools) cliArgs.push("--allowed-tool", t)
    if (args.disabled_tools)
      for (const t of args.disabled_tools) cliArgs.push("--disabled-tool", t)
    if (args.action === "chat") {
      if (args.session_id) cliArgs.push("--session-id", args.session_id)
      if (args.resume) {
        if (args.resume === "AUTO") cliArgs.push("--resume")
        else cliArgs.push("--resume", args.resume)
      }
      if (args.cwd) cliArgs.push("--cwd", args.cwd)
    }

    if (promptAction) {
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
