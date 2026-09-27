/**
 * OS 级通知插件：在 host（CLI / headless）环境下提供模型可调用的 notify_send 工具。
 *
 * 设计目标：任务完成、定时触发等场景下提醒用户。轻量优先——只用 node:child_process
 * 调用系统自带命令，不引入 node-notifier 等重型依赖；任何失败都静默降级，绝不抛错、
 * 不阻断主流程。
 *
 * 通道降级顺序（host 端）：
 *   1. 系统通知命令：Linux notify-send / macOS osascript / Windows PowerShell BurntToast；
 *   2. 终端降级：响铃 \x07 + stdout 打印 `[通知] title: body`；
 *   3. 最终兜底：静默（stdout 不可写等极端情况）。
 *
 * Web 端（浏览器原生 Notification API / 页面内 Toast）由 `src/client/index.ts` 提供：
 * 任务结束（running true→false）或审批请求出现时，若页面不在前台则弹系统通知，
 * 点击聚焦窗口；Notification 不可用或权限被拒时静默降级为页面内 Toast。
 *
 * @module @deepseek-ai/dsh-tool-notify
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { execFile } from 'node:child_process'

export const name = 'tool-notify'
export const inject = ['tools']

/** 通知优先级（与 notify-send 的 urgency 对齐）。 */
export type NotifyPriority = 'low' | 'normal' | 'high'

/** notify() 的可选项。 */
export interface NotifyOptions {
  /** 优先级，默认 normal。 */
  priority?: NotifyPriority
  /** 是否尝试系统通知命令，默认 true；false 时直接走终端降级。 */
  system?: boolean
  /** 终端降级时是否响铃 \x07，默认 true。 */
  bell?: boolean
}

/** 通知投递结果（对模型/调用方可见）。 */
export interface NotifyResult {
  /** 是否最终送达（终端降级也算送达）。 */
  delivered: boolean
  /** 实际使用的通道。 */
  channel: 'system' | 'terminal' | 'silent'
  /** 人类可读的细节说明（中文）。 */
  detail: string
}

/** 插件配置。 */
export interface Config {
  /** 是否允许调用系统通知命令，默认 true。 */
  system: boolean
  /** 终端降级时是否响铃，默认 true。 */
  bell: boolean
}

export const Config: z<Config> = z.object({
  system: z.boolean().default(true),
  bell: z.boolean().default(true),
})

/** 优先级 → notify-send urgency 映射（high 对应 critical）。 */
const URGENCY: Record<NotifyPriority, string> = {
  low: 'low',
  normal: 'normal',
  high: 'critical',
}

/**
 * 执行一条外部命令，超时后视为失败；只要退出码为 0 就认为成功。
 * 命令不存在（ENOENT）、超时、非零退出都会 resolve(false)，绝不 reject。
 */
function runCommand(command: string, args: readonly string[], timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false
    const done = (ok: boolean) => {
      if (!settled) {
        settled = true
        resolve(ok)
      }
    }
    try {
      const child = execFile(command, args, { timeout: timeoutMs, windowsHide: true }, (error) => {
        // error 为 null 表示退出码 0；否则（非零退出 / 超时被杀）视为失败。
        done(error === null)
      })
      // 命令不存在等启动期错误走 'error' 事件。
      child.on('error', () => done(false))
    } catch {
      done(false)
    }
  })
}

/** PowerShell 单引号字符串转义：单引号 doubled。 */
function psQuote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`
}

/**
 * 尝试系统级通知命令。返回 true 表示成功弹出系统通知；false 表示本环境
 * 没有可用命令或调用失败，调用方应继续走终端降级。
 */
async function trySystemNotify(title: string, body: string, priority: NotifyPriority): Promise<boolean> {
  const platform = process.platform
  if (platform === 'linux') {
    // notify-send：-u 指定 urgency，--app-name 让通知来源显示为 DSH。
    return runCommand('notify-send', ['-u', URGENCY[priority], '--app-name', 'DSH', title, body])
  }
  if (platform === 'darwin') {
    // osascript 弹出 macOS 原生通知；body/title 用 JSON.stringify 得到带引号的字符串字面量。
    const script = `display notification ${JSON.stringify(body)} with title ${JSON.stringify(title)}`
    return runCommand('osascript', ['-e', script])
  }
  if (platform === 'win32') {
    // PowerShell 调用 BurntToast；未安装该模块时命令非零退出，自然降级。
    const cmd = `New-BurntToastNotification -Text ${psQuote(title)}, ${psQuote(body)}`
    return runCommand('powershell', ['-NoProfile', '-Command', cmd])
  }
  // 其他平台（freebsd 等）暂不支持系统通知，直接降级。
  return false
}

/**
 * 发送一条通知：按 系统通知 → 终端响铃打印 → 静默 的顺序降级。
 * 该函数永不抛错，总是返回一个 NotifyResult。
 */
export async function notify(title: string, body: string, options: NotifyOptions = {}): Promise<NotifyResult> {
  const system = options.system !== false
  const bell = options.bell !== false

  // 通道一：系统通知命令。
  if (system) {
    try {
      const ok = await trySystemNotify(title, body, options.priority ?? 'normal')
      if (ok) {
        return { delivered: true, channel: 'system', detail: '系统通知已弹出' }
      }
    } catch {
      // 系统通道异常，吞掉并继续终端降级。
    }
  }

  // 通道二：终端降级（响铃 + stdout 打印）。
  try {
    if (bell) process.stdout.write('\x07')
    process.stdout.write(`[通知] ${title}: ${body}\n`)
    return { delivered: true, channel: 'terminal', detail: '已在终端输出（系统通知不可用，已降级）' }
  } catch {
    // 通道三：静默兜底。
    return { delivered: false, channel: 'silent', detail: '通知静默（终端输出不可写）' }
  }
}

export function apply(ctx: Context, config: Config): void {
  // ── notify_send：发送 OS 级通知 ──
  ctx.tools.register(defineTool({
    name: 'notify_send',
    description:
      '发送一条系统级通知提醒用户。适用于任务完成、定时任务触发、长时间操作结束等场景。'
      + '优先弹出系统通知；当前环境没有通知命令时自动降级为终端响铃并打印，永不报错、不阻断主流程。'
      + '可与 schedule 定时任务配合：定时任务结束后调用本工具提醒用户。',
    parameters: {
      title: { type: 'string', required: true, description: '通知标题，简短中文' },
      body: { type: 'string', required: true, description: '通知正文内容' },
      priority: { type: 'string', enum: ['low', 'normal', 'high'], description: '优先级：low/normal/high，默认 normal' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          delivered: { type: 'boolean', required: true },
          channel: { type: 'string', required: true },
          detail: { type: 'string', required: true },
        },
      },
      render: (_args, v: NotifyResult) => [{
        type: 'text',
        text: v.delivered
          ? `通知已送达（${v.channel === 'system' ? '系统通知' : v.channel === 'terminal' ? '终端降级' : '静默'}）：${v.detail}`
          : `通知未送达（静默）：${v.detail}`,
      }],
    },
    async execute(args: { title: string; body: string; priority?: string }): Promise<NotifyResult> {
      try {
        const priority: NotifyPriority = args.priority === 'low' || args.priority === 'high' ? args.priority : 'normal'
        // 任何失败都被 notify() 内部吞掉并降级，这里再包一层兜底，确保绝不抛给主流程。
        return await notify(args.title, args.body, {
          priority,
          system: config.system,
          bell: config.bell,
        })
      } catch (error) {
        return { delivered: false, channel: 'silent', detail: String(error) }
      }
    },
  }))
}
