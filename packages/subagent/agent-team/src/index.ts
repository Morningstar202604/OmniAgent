/**
 * 多智能体协作（team 编排层）：在 dsh-subagent 之上提供 agent_team_run 工具。
 *
 * 输入一个总任务 + 一组角色配置（role/focus/依赖），按依赖图（DAG）分阶段执行：
 * 无依赖的角色并行启动；有依赖的角色等待上游完成后，把上游输出作为上下文注入
 * 到自己的 prompt 中再启动。主代理最后汇总所有角色结果。
 *
 * 复用现有 ctx.subagents 服务（provider 可配 spawn/in-process），角色人设通过
 * persona/prompt 注入。角色间消息传递为文本注入（上游输出拼到下游 prompt），
 * 不引入复杂消息队列。
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
export interface TeamRole {
  /** 角色名，如 分析师、研究员、执行员。 */
  role: string
  /** 角色职责/关注点。 */
  focus: string
  /**
   * 依赖的角色名列表；这些角色的输出会作为本角色的输入上下文注入。
   * 不填（或空数组）表示本角色无上游依赖，可与其他无依赖角色并行启动。
   */
  dependsOn?: string[]
  /**
   * 阶段号（可选，用于显式分组）。不填则由 dependsOn 推导拓扑序。
   * 显式阶段号必须大于其所依赖角色的阶段号，否则视为配置错误。
   */
  stage?: number
}

/** 插件配置。 */
export interface Config {
  /** 使用的 subagent provider 名（如 spawn / in-process）。 */
  provider: string
}

export const Config: z<Config> = z.object({
  provider: z.string().default('spawn'),
})

/** 单个角色执行后的结构化结果。 */
interface TeamMemberResult {
  role: string
  focus: string
  /** 上游依赖角色名（按声明顺序）。 */
  dependsOn: string[]
  /** 本角色所处的执行阶段（从 0 开始）。 */
  stage: number
  output: string
  ok: boolean
}

/** 从子代理输出内容块中抽取纯文本。 */
function outputText(output: readonly ContentBlock[]): string {
  return output
    .filter((b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('')
}

/** 默认角色阵容：分析师 + 研究员 + 执行员（无依赖，全并行，向后兼容旧行为）。 */
const DEFAULT_ROLES: TeamRole[] = [
  { role: '数据分析师', focus: '从数据与事实出发，给出量化、可复核的观察与关键点' },
  { role: '行业研究员', focus: '从行业逻辑与基本面出发，给出趋势判断与逻辑链条' },
  { role: '执行落地员', focus: '把结论拆成可执行的下一步动作与注意事项' },
]

/** 注入到下游 prompt 的上游输出片段的最大长度，避免上下文爆炸。 */
const UPSTREAM_OUTPUT_LIMIT = 4000

/**
 * 把上游角色的输出拼接到下游 prompt 中，作为消息传递的上下文。
 * @param upstream 上游角色名 -> 其纯文本输出 的映射。
 * @returns 拼接好的上游上下文文本；无上游时返回空串。
 */
function buildUpstreamContext(upstream: ReadonlyMap<string, string>): string {
  if (upstream.size === 0) return ''
  const blocks: string[] = ['\n—— 以下是上游协作角色已完成的输出，请基于这些事实开展你的工作 ——']
  for (const [name, text] of upstream) {
    const trimmed = text.length > UPSTREAM_OUTPUT_LIMIT
      ? `${text.slice(0, UPSTREAM_OUTPUT_LIMIT)}……（已截断）`
      : text
    blocks.push(`【上游角色「${name}」的输出】：\n${trimmed}`)
  }
  blocks.push('—— 上游输出结束 ——\n')
  return blocks.join('\n')
}

/**
 * 校验角色配置并构建 DAG 执行计划（分阶段）。
 *
 * 规则：
 * - 角色名不可重复；dependsOn 必须指向已存在的角色，且不能自依赖。
 * - 依赖图不可成环；成环时抛出带环信息的错误。
 * - 每个角色的执行阶段 = 0 + max(依赖阶段) + 1；若显式声明了 stage，则要求
 *   stage >= 所有依赖推导的阶段（否则依赖不可能在它之前完成）。
 * - 同一阶段内的角色彼此无依赖，可并行启动；跨阶段严格串行。
 *
 * @param roles 角色配置列表。
 * @returns 分阶段的执行计划：plan[stage] 为该阶段要并行执行的角色数组。
 * @throws 配置非法（重名 / 悬空依赖 / 自依赖 / 环 / stage 冲突）时抛出可读错误。
 */
export function buildExecutionPlan(roles: readonly TeamRole[]): TeamRole[][] {
  // 角色名 -> 角色配置，顺带检测重名。
  const byName = new Map<string, TeamRole>()
  for (const r of roles) {
    if (byName.has(r.role)) throw new Error(`agent_team_run：角色名「${r.role}」重复，请为每个角色起唯一名字。`)
    byName.set(r.role, r)
  }

  // 校验依赖指向存在的角色，且不能自依赖。
  for (const r of roles) {
    for (const dep of r.dependsOn ?? []) {
      if (!byName.has(dep)) {
        throw new Error(`agent_team_run：角色「${r.role}」依赖了不存在的角色「${dep}」。`)
      }
      if (dep === r.role) {
        throw new Error(`agent_team_run：角色「${r.role}」不能依赖自己。`)
      }
    }
  }

  // Kahn 拓扑排序：仅用于检测环 + 计算每个角色的推导阶段（拓扑深度）。
  // 实际分阶段按"最终阶段号"分桶（见下方），这样显式 stage 也能正确分组。
  const indeg = new Map<string, number>()
  // dependents[dep] = 依赖 dep 的角色列表（反向邻接表）。
  const dependents = new Map<string, string[]>()
  for (const r of roles) {
    indeg.set(r.role, (r.dependsOn ?? []).length)
  }
  for (const r of roles) {
    for (const dep of r.dependsOn ?? []) {
      const list = dependents.get(dep)
      if (list === undefined) dependents.set(dep, [r.role])
      else list.push(r.role)
    }
  }

  // queue：当前入度为 0 的角色。topoOrder 收集 Kahn 输出的拓扑序。
  let queue = roles.filter((r) => (indeg.get(r.role) ?? 0) === 0).map((r) => r.role)
  const topoOrder: string[] = []
  let remaining = roles.length

  while (queue.length > 0) {
    const currentWave = queue.splice(0, queue.length)
    topoOrder.push(...currentWave)
    // 释放本波角色，更新下游入度；入度归零的角色进入下一波。
    const nextQueue: string[] = []
    for (const name of currentWave) {
      for (const dependent of dependents.get(name) ?? []) {
        const d = (indeg.get(dependent) ?? 0) - 1
        indeg.set(dependent, d)
        if (d === 0) nextQueue.push(dependent)
      }
    }
    queue = nextQueue
    remaining -= currentWave.length
  }

  // 还有角色未被排进拓扑序 => 存在环。
  if (remaining > 0) {
    const cycled = roles.filter((r) => (indeg.get(r.role) ?? 0) > 0).map((r) => r.role)
    throw new Error(`agent_team_run：角色依赖图存在环，涉及角色：${cycled.join(' -> ')}。请调整 dependsOn 以消除循环依赖。`)
  }

  // 按拓扑序计算最终阶段号：依赖的最终阶段 + 1，再与显式 stage 取 max。
  // 这样显式 stage 把上游往后推时，下游会自动跟着顺延，不会先于上游运行。
  const finalStage = new Map<string, number>()
  for (const name of topoOrder) {
    const role = byName.get(name)
    if (role === undefined) throw new Error(`agent_team_run：未找到角色「${name}」`)
    const depStage = (role.dependsOn ?? []).reduce((max, dep) => {
      const s = finalStage.get(dep) ?? 0
      return Math.max(max, s + 1)
    }, 0)
    if (role.stage !== undefined && role.stage < depStage) {
      throw new Error(
        `agent_team_run：角色「${role.role}」声明的 stage=${role.stage} 早于其依赖推导的阶段 ${depStage}，依赖无法在它之前完成。`,
      )
    }
    finalStage.set(name, role.stage === undefined ? depStage : Math.max(depStage, role.stage))
  }

  // 按最终阶段号分桶；同阶段角色并行、跨阶段串行。
  const stageBuckets = new Map<number, TeamRole[]>()
  for (const r of roles) {
    const s = finalStage.get(r.role) ?? 0
    const bucket = stageBuckets.get(s)
    if (bucket === undefined) stageBuckets.set(s, [r])
    else bucket.push(r)
  }

  // 按阶段号升序输出执行计划。
  return [...stageBuckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, members]) => members)
}

/** 注册 agent_team_run 工具。 */
export function apply(ctx: Context, config: Config): void {
  const providerName = config.provider

  ctx.tools.register(defineTool({
    name: 'agent_team_run',
    description: '组建一个多智能体小队，按角色依赖图（DAG）分阶段协作：给定一个总任务与若干角色，无依赖的角色并行执行，有依赖的角色等待上游完成后把上游输出作为输入继续分析。适合"先收集数据、再分析结论、最后落地执行"这类多阶段任务；不声明依赖时退化为全并行。',
    parameters: {
      task: { type: 'string', required: true, description: '要交给团队的总任务描述' },
      roles: {
        type: 'array', description: '自定义角色阵容（可选，默认三角阵容）。每项 {role: 角色名, focus: 职责, dependsOn?: 依赖的角色名数组, stage?: 阶段号}',
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            role: { type: 'string', required: true, description: '角色名，如 研究员/分析师' },
            focus: { type: 'string', required: true, description: '该角色的职责与关注点' },
            dependsOn: {
              type: 'array', items: { type: 'string' },
              description: '依赖的角色名列表；这些角色的输出会作为本角色的输入上下文。留空/省略表示无上游依赖。',
            },
            stage: { type: 'number', description: '可选阶段号；不填则由 dependsOn 自动推导拓扑顺序。' },
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
                dependsOn: { type: 'array', items: { type: 'string' }, required: true },
                stage: { type: 'number', required: true },
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
          ...value.members.flatMap((m: { role: string; dependsOn: string[]; stage: number; output: string; ok: boolean }) => {
            const dep = m.dependsOn.length > 0 ? `（依赖：${m.dependsOn.join('、')}，阶段 ${m.stage}）` : `（阶段 ${m.stage}，无依赖）`
            return [
              `—— ${m.role} ${dep} ${m.ok ? '' : '（未完成）'} ——`,
              m.output.slice(0, 1500),
            ]
          }),
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

      // 构建 DAG 执行计划：返回按阶段分组的角色数组，同阶段并行、跨阶段串行。
      const plan = buildExecutionPlan(roles)

      // upstreamOutputs：已完成角色的纯文本输出，供下游注入 prompt。
      const upstreamOutputs = new Map<string, string>()
      // 按执行阶段顺序收集结果（而非按输入顺序），便于下游依赖关系清晰呈现。
      const ordered: TeamMemberResult[] = []

      for (let stageNo = 0; stageNo < plan.length; stageNo += 1) {
        const stageRoles = plan[stageNo]
        if (stageRoles === undefined) continue
        // 启动本阶段所有角色：它们彼此无依赖，可并行跑。
        const started = stageRoles.map((r) => {
          const deps = r.dependsOn ?? []
          // 收集本角色直接上游的输出，拼进 prompt 实现角色间消息传递。
          const upstream = new Map<string, string>()
          for (const dep of deps) {
            const text = upstreamOutputs.get(dep)
            if (text !== undefined) upstream.set(dep, text)
          }
          const upstreamContext = buildUpstreamContext(upstream)
          const promptText = [
            `你是「${r.role}」，职责：${r.focus}。`,
            `团队总任务：${args.task}`,
            upstreamContext,
            `请站在你的角色视角，基于上游已给出的事实（若有），完成你负责部分的分析结论（简洁、聚焦、可执行）。`,
          ].join('\n')
          return ctx.subagents.start(providerName, {
            label: `team:${r.role}`,
            prompt: [{ type: 'text', text: promptText }] as ContentBlock[],
            parent,
            persona: `你是团队中的「${r.role}」，始终从「${r.focus}」的视角发言，不越俎代庖。`,
            signal: exec.signal,
          }).then((run) => run.result.then((res) => ({ run, res })))
        })

        const settled = await Promise.allSettled(started)

        // 结算本阶段结果，写回 upstreamOutputs 供下一阶段使用。
        stageRoles.forEach((r, i) => {
          const s = settled[i]
          let output: string
          let ok: boolean
          if (s === undefined || s.status === 'rejected') {
            output = `（角色执行失败：${s?.reason instanceof Error ? s.reason.message : String(s?.reason)}）`
            ok = false
          } else {
            const { run, res } = s.value
            // 释放子代理资源（前台编排，结果已收集）。
            void run.dispose()
            ok = res.stopReason === 'completed'
            output = outputText(res.output) || `（停止原因：${res.stopReason}）`
          }
          upstreamOutputs.set(r.role, output)
          ordered.push({
            role: r.role,
            focus: r.focus,
            dependsOn: r.dependsOn ?? [],
            stage: stageNo,
            output,
            ok,
          })
        })
      }

      return { task: args.task, members: ordered }
    },
  }))
}
