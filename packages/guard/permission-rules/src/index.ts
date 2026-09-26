/**
 * 细粒度工具权限规则宿主插件。
 *
 * 在 `tools/pre-execute` 瀑布上挂一个决策监听器：按工具名匹配通配符规则，
 * 把四档权限（allow / auto / ask / deny）映射为 {@link PreToolDecision}。
 * - `deny` → 直接拒绝（deny）
 * - `ask`  → 交给现有 user-approval 服务弹审批（ask）
 * - `allow`/`auto` → 放行（next()），由下游沙箱/审批策略继续决定
 *
 * 同时注册三个模型可见工具：`permission_presets` / `permission_get` / `permission_set`，
 * 用于运行时查看预设、查询某工具的生效规则、动态切换预设或增删自定义规则。
 *
 * 默认预设 `normal` 不注册任何额外规则、兜底放行，因此**不改变**现有工具调用行为。
 *
 * @module @deepseek-ai/dsh-permission-rules
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool, type PreToolDecision, type ToolExecution } from '@deepseek-ai/dsh-tools'
import {
  decidePermission,
  findPreset,
  PERMISSION_PRESETS,
  type PermissionLevel,
  type PermissionPresetName,
  type PermissionRule,
} from './rules.ts'

/** Cordis 插件名。 */
export const name = 'permission-rules'

/** 规则可被运行时修改，因此无需 inject（纯事件/工具注册型插件）。 */
export const inject: readonly string[] = []

/** 一条决策审计记录。 */
interface DecisionRecord {
  /** 时间戳（ms）。 */
  at: number
  /** 工具名。 */
  tool: string
  /** 命中的模式（未命中规则为 null）。 */
  pattern: string | null
  /** 生效等级。 */
  level: PermissionLevel
  /** 最终映射出的决策：allow / ask / deny。 */
  outcome: 'allow' | 'ask' | 'deny'
}

/** 插件配置。 */
export interface Config {
  /**
   * 启动时选择的预设：normal（默认，不改变现有行为）/ full-auto / strict / custom。
   * 环境变量 `DSH_PERMISSION_PRESET` 可覆盖此默认值。
   */
  preset?: PermissionPresetName
  /** 自定义规则列表（preset 为 custom 时生效；其他预设也会与这些规则合并）。 */
  rules?: PermissionRule[]
  /** 未命中任何规则时的兜底等级，默认 `allow`（放行）。 */
  fallback?: PermissionLevel
}

/** schemastery 校验器。 */
export const Config: z<Config> = z.object({
  preset: z.union(['normal', 'full-auto', 'strict', 'custom'] as const).default('normal'),
  rules: z.array(z.object({
    pattern: z.string().required(),
    level: z.union(['allow', 'auto', 'ask', 'deny'] as const).required(),
  })).default([]),
  fallback: z.union(['allow', 'auto', 'ask', 'deny'] as const).default('allow'),
})

/** 决策审计日志的最大条数（环形缓冲）。 */
const MAX_LOG = 100

/**
 * 安装权限规则引擎。
 * @param ctx - 宿主上下文。
 * @param config - 校验后的插件配置。
 */
export function apply(ctx: Context, config: Config): void {
  // 环境变量可覆盖全局默认预设，便于部署侧统一管控。
  const envPreset = process.env.DSH_PERMISSION_PRESET as PermissionPresetName | undefined
  let presetName: PermissionPresetName = envPreset !== undefined && findPreset(envPreset) !== undefined
    ? envPreset
    : (config.preset as PermissionPresetName)
  // 自定义规则（配置里写死的，作为运行时规则的初始值）。
  let rules: PermissionRule[] = [...(config.rules as PermissionRule[])]
  const fallback = config.fallback as PermissionLevel
  // 决策审计环形日志。
  const log: DecisionRecord[] = []

  /** 把预设落地为规则并替换当前规则集（custom 保留现有自定义规则）。 */
  function applyPreset(name: PermissionPresetName): void {
    presetName = name
    if (name !== 'custom') {
      const preset = findPreset(name)
      rules = preset ? [...preset.rules] : []
    }
  }
  // 启动时按配置预设初始化规则（custom 时保留 config.rules）。
  applyPreset(presetName)

  // pre-execute 决策监听器：按工具名决策，映射为 PreToolDecision。
  ctx.on('tools/pre-execute', async (exec: ToolExecution, next): Promise<PreToolDecision> => {
    const decision = decidePermission(exec.name, rules, fallback)
    const outcome: 'allow' | 'ask' | 'deny' = decision.level === 'deny'
      ? 'deny'
      : decision.level === 'ask'
        ? 'ask'
        : 'allow'
    // 记录审计日志（失败不影响主流程）。
    log.push({
      at: Date.now(),
      tool: exec.name,
      pattern: decision.rule ? decision.rule.pattern : null,
      level: decision.level,
      outcome,
    })
    if (log.length > MAX_LOG) log.shift()

    if (decision.level === 'deny') {
      return {
        kind: 'deny',
        reason: `权限规则拒绝：工具 "${exec.name}" 匹配模式 "${decision.rule?.pattern}"（等级 deny），被禁止调用。`,
      }
    }
    if (decision.level === 'ask') {
      return {
        kind: 'ask',
        reason: `权限规则：工具 "${exec.name}" 匹配模式 "${decision.rule?.pattern}"（等级 ask），需要用户确认后才能执行。`,
      }
    }
    // allow / auto：放行，交由下游策略继续处理。
    return next()
  })

  // ---- 模型可见工具 -------------------------------------------------------

  // permission_presets：列出全部预设与当前预设。
  ctx.tools.register(defineTool({
    name: 'permission_presets',
    description: '列出所有内置权限预设（normal/full-auto/strict/custom）及其说明，并显示当前生效的预设。用于了解可用的权限档位。',
    parameters: {},
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          current: { type: 'string', required: true },
          presets: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                name: { type: 'string', required: true },
                label: { type: 'string', required: true },
                description: { type: 'string', required: true },
              },
            },
          },
        },
      },
      render: (_args, value) => {
        const lines = [`当前权限预设：${value.current}`]
        for (const p of value.presets) lines.push(`- ${p.name}（${p.label}）：${p.description}`)
        return [{ type: 'text', text: lines.join('\n') }]
      },
    },
    async execute() {
      return {
        current: presetName,
        presets: PERMISSION_PRESETS.map(p => ({
          name: p.name, label: p.label, description: p.description,
        })),
      }
    },
  }))

  // permission_get：查询当前规则与某工具的生效决策。
  ctx.tools.register(defineTool({
    name: 'permission_get',
    description: '查看当前权限规则状态：当前预设、兜底等级、全部自定义规则，以及（可选）指定工具名时它实际命中的权限等级。',
    parameters: {
      tool_name: {
        type: 'string',
        description: '可选。要查询生效决策的工具名（如 "bash"、"finance_quote"）。不传则只返回当前规则状态。',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          preset: { type: 'string', required: true },
          fallback: { type: 'string', required: true },
          rules: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                pattern: { type: 'string', required: true },
                level: { type: 'string', required: true },
              },
            },
          },
          decision: {
            type: 'object',
            additionalProperties: false,
            properties: {
              tool: { type: 'string', required: true },
              matchedPattern: { oneOf: [{ type: 'string' }, { type: 'null' }] },
              level: { type: 'string', required: true },
            },
          },
        },
      },
      render: (_args, value) => {
        const lines = [
          `当前预设：${value.preset}，兜底等级：${value.fallback}`,
          value.rules.length > 0 ? '规则列表：' : '（无自定义规则）',
          ...value.rules.map(r => `  ${r.pattern} → ${r.level}`),
        ]
        if (value.decision !== undefined) {
          const d = value.decision
          lines.push(
            `工具 "${d.tool}" 生效等级：${d.level}`
            + (d.matchedPattern !== null ? `（命中模式 ${d.matchedPattern}）` : '（未命中规则，走兜底）'),
          )
        }
        return [{ type: 'text', text: lines.join('\n') }]
      },
    },
    async execute(args: { tool_name?: string }) {
      const out: {
        preset: string
        fallback: string
        rules: { pattern: string; level: string }[]
        decision?: { tool: string; matchedPattern: string | null; level: string }
      } = { preset: presetName, fallback, rules: rules.map(r => ({ pattern: r.pattern, level: r.level })) }
      if (typeof args.tool_name === 'string' && args.tool_name.length > 0) {
        const d = decidePermission(args.tool_name, rules, fallback)
        out.decision = {
          tool: args.tool_name,
          matchedPattern: d.rule ? d.rule.pattern : null,
          level: d.level,
        }
      }
      return out
    },
  }))

  // permission_set：运行时切换预设或设置自定义规则。
  ctx.tools.register(defineTool({
    name: 'permission_set',
    description: '运行时修改权限规则。传 preset 切换预设（normal/full-auto/strict/custom）；或传 rules 数组设置自定义规则（每条含 pattern 通配符与 level）。同时传入时先切预设再套用 rules。',
    parameters: {
      preset: {
        type: 'string',
        enum: ['normal', 'full-auto', 'strict', 'custom'],
        description: '要切换到的预设名。',
      },
      rules: {
        type: 'array',
        description: '自定义规则列表（设置后预设变为 custom）。',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            pattern: { type: 'string', required: true, description: '工具名通配符，如 "shell.*"、"finance_*"、"file.write"、"*"。' },
            level: { type: 'string', required: true, enum: ['allow', 'auto', 'ask', 'deny'], description: '该模式的权限等级。' },
          },
        },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          preset: { type: 'string', required: true },
          rules: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                pattern: { type: 'string', required: true },
                level: { type: 'string', required: true },
              },
            },
          },
        },
      },
      render: (_args, value) => {
        const lines = [`权限规则已更新，当前预设：${value.preset}`]
        lines.push(...value.rules.map(r => `  ${r.pattern} → ${r.level}`))
        return [{ type: 'text', text: lines.join('\n') }]
      },
    },
    async execute(args: { preset?: PermissionPresetName; rules?: PermissionRule[] }) {
      if (typeof args.preset === 'string') {
        if (findPreset(args.preset) === undefined) {
          throw new Error(`permission_set: 未知预设 "${args.preset}"，可选 normal/full-auto/strict/custom`)
        }
        applyPreset(args.preset)
      }
      if (Array.isArray(args.rules)) {
        for (const r of args.rules) {
          if (typeof r.pattern !== 'string' || r.pattern.length === 0) {
            throw new Error('permission_set: 每条规则必须有非空 pattern')
          }
          if (!['allow', 'auto', 'ask', 'deny'].includes(r.level)) {
            throw new Error(`permission_set: 非法等级 "${String(r.level)}"，可选 allow/auto/ask/deny`)
          }
        }
        rules = args.rules.map(r => ({ pattern: r.pattern, level: r.level }))
        // 一旦用户显式设置规则，预设归入 custom。
        presetName = 'custom'
      }
      return { ok: true, preset: presetName, rules: rules.map(r => ({ pattern: r.pattern, level: r.level })) }
    },
  }))
}
