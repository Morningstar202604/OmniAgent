/**
 * 多智能体协作（team 编排层）：在 dsh-subagent 之上提供 agent_team_run 工具。
 *
 * 输入一个总任务 + 一组角色配置（分析师/研究员/执行员……），并行启动多个
 * 子代理，各自以角色人设独立完成任务，主代理收集结果并汇总。
 *
 * 最小可用版：基于现有 subagent provider 做并行前台编排；角色人设通过每个
 * 子代理的 persona/prompt 注入。后续路线：角色间消息传递、共享黑板、按依赖
 * DAG 编排（当前为 all-parallel）。
 *
 * @module @deepseek-ai/dsh-agent-team
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool, type ToolExecution } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
// 触发 dsh-subagent 对 cordis Context 的服务声明合并（ctx.subagents）。
import type {} from '@deepseek-ai/dsh-subagent'

export const name = 'agent-team'
export const inject = ['tools', 'subagents']

/** 一个团队角色。 */
interface TeamRole {
  /** 角色名，如 分析师、研究员、执行员。 */
  role: string
  /** 角色职责/关注点。 */
  focus: string
}

/** 插件配置。 */
export interface Config {
  /** 使用的 subagent provider 名（如 spawn / in-process）。 */
  provider: string
}

export const Config: z<Config> = z.object({
  provider: z.string().default('spawn'),
})

/** 从子代理输出内容块中抽取纯文本。 */
function outputText(output: readonly ContentBlock[]): string {
  return output
    .filter((b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('')
}

/** 默认角色阵容：分析师 + 研究员 + 执行员。 */
const DEFAULT_ROLES: TeamRole[] = [
  { role: '数据分析师', focus: '从数据与事实出发，给出量化、可复核的观察与关键点' },
  { role: '行业研究员', focus: '从行业逻辑与基本面出发，给出趋势判断与逻辑链条' },
  { role: '执行落地员', focus: '把结论拆成可执行的下一步动作与注意事项' },
]

/** 注册 agent_team_run 工具。 */
export function apply(ctx: Context, config: Config): void {
  const providerName = config.provider

  ctx.tools.register(defineTool({
    name: 'agent_team_run',
    description: '组建一个多智能体小队并行协作：给定一个总任务与若干角色（默认 数据分析师/行业研究员/执行落地员），同时启动多个子代理，各自以角色视角完成任务，最后汇总各方结果。适合需要多角度分析、研究+落地一体化的复杂任务。',
    parameters: {
      task: { type: 'string', required: true, description: '要交给团队的总任务描述' },
      roles: {
        type: 'array', description: '自定义角色阵容（可选，默认三角阵容）。每项 {role: 角色名, focus: 职责}',
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            role: { type: 'string', required: true, description: '角色名，如 风控审查员' },
            focus: { type: 'string', required: true, description: '该角色的职责与关注点' },
          },
        },
      },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          task: { type: 'string', required: true },
          members: {
            type: 'array', required: true,
            items: {
              type: 'object', additionalProperties: false,
              properties: {
                role: { type: 'string', required: true },
                focus: { type: 'string', required: true },
                output: { type: 'string', required: true },
                ok: { type: 'boolean', required: true },
              },
            },
          },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: [
          `多智能体团队协作结果（任务：${value.task}）`,
          ...value.members.flatMap((m: { role: string; output: string; ok: boolean }) => [
            `—— ${m.role} ${m.ok ? '' : '（未完成）'} ——`,
            m.output.slice(0, 1500),
          ]),
        ].join('\n'),
      }],
    },
    async execute(args: { task: string; roles?: TeamRole[] }, exec: ToolExecution) {
      const parent = exec.agent
      if (!parent) throw new Error('agent_team_run 需要在有调用 Agent 的上下文中运行')
      const provider = ctx.subagents.getProvider(providerName)
      if (provider === undefined) {
        throw new Error(`agent_team_run：未找到 subagent provider "${providerName}"。请在 profile 中启用子代理能力（如 in-process/spawn provider）后再试。`)
      }
      const roles = Array.isArray(args.roles) && args.roles.length > 0 ? args.roles : DEFAULT_ROLES

      // 并行启动各角色子代理。
      const started = roles.map((r) => {
        const promptText = `你是「${r.role}」，职责：${r.focus}。\n团队总任务：${args.task}\n请站在你的角色视角，独立完成并给出你负责部分的分析结论（简洁、聚焦、可执行）。`
        return ctx.subagents.start(providerName, {
          label: `team:${r.role}`,
          prompt: [{ type: 'text', text: promptText }] as ContentBlock[],
          parent,
          persona: `你是团队中的「${r.role}」，始终从「${r.focus}」的视角发言，不越俎代庖。`,
          signal: exec.signal,
        }).then((run) => run.result.then((res) => ({ run, res })))
      })

      const settled = await Promise.allSettled(started)
      const members = roles.map((r, i) => {
        const s = settled[i]
        if (s === undefined || s.status === 'rejected') {
          return { role: r.role, focus: r.focus, output: `（角色执行失败：${s?.reason instanceof Error ? s.reason.message : String(s?.reason)}）`, ok: false }
        }
        const { run, res } = s.value
        // 释放子代理资源（前台编排，结果已收集）。
        void run.dispose()
        const ok = res.stopReason === 'completed'
        return { role: r.role, focus: r.focus, output: outputText(res.output) || `（停止原因：${res.stopReason}）`, ok }
      })

      return { task: args.task, members }
    },
  }))
}
