/**
 * Fine-grained tool permission-rules host service.
 *
 * Runs a wildcard rule engine (allow / auto / ask / deny) on the
 * `tools/pre-execute` waterfall and exposes it two ways:
 * - model-visible tools `permission_presets` / `permission_get` / `permission_set`;
 * - a Typert Remote face `permissionRules.getState()` / `permissionRules.setRules()`
 *   used by the settings-page rule editor.
 *
 * Custom rules persist to `<DSH_HOME>/permission-rules.json` so the editor
 * survives restarts. The default preset `normal` registers no extra rules and
 * falls back to allow, so existing tool-call behavior is unchanged.
 *
 * @module @deepseek-ai/dsh-permission-rules
 */

import { promises as fs } from 'node:fs'
import { join } from 'node:path'

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool, type PreToolDecision, type ToolExecution } from '@deepseek-ai/dsh-tools'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import {
  decidePermission,
  findPreset,
  PERMISSION_PRESETS,
  type PermissionLevel,
  type PermissionPresetName,
  type PermissionRule,
} from './rules.ts'
import type { PermissionRulesPresetInfo, PermissionRulesState } from './types.ts'

/** A persisted rules document on disk. */
interface PersistedDocument {
  /** Stored custom rules. */
  rules: PermissionRule[]
}

/** One decision audit record. */
interface DecisionRecord {
  /** Timestamp (ms). */
  at: number
  /** Tool name. */
  tool: string
  /** Matched pattern (null when no rule matched). */
  pattern: string | null
  /** Effective level. */
  level: PermissionLevel
  /** Mapped outcome. */
  outcome: 'allow' | 'ask' | 'deny'
}

/** Valid levels, for runtime validation. */
const LEVELS: readonly PermissionLevel[] = ['allow', 'auto', 'ask', 'deny']

/** Decision audit log capacity (ring buffer). */
const MAX_LOG = 100

/** Plugin config (resolved by Cordis from the schemastery schema below). */
export interface Config {
  preset: PermissionPresetName
  rules: PermissionRule[]
  fallback: PermissionLevel
}

/**
 * Owns the rule engine state, the pre-execute decision listener, the
 * model-visible tools, and the settings-page Remote face.
 */
export class PermissionRulesService extends TypertRemoteService {
  /** Cordis plugin config (projected into the settings document). */
  static Config: z<Config> = z.object({
    preset: z.union(['normal', 'full-auto', 'strict', 'custom'] as const).default('normal'),
    rules: z.array(z.object({
      pattern: z.string().required(),
      level: z.union(['allow', 'auto', 'ask', 'deny'] as const).required(),
    })).default([]),
    fallback: z.union(['allow', 'auto', 'ask', 'deny'] as const).default('allow'),
  })

  /** Required services. */
  static inject = ['tools']

  private presetName: PermissionPresetName
  private rules: PermissionRule[]
  private readonly fallback: PermissionLevel
  private readonly log: DecisionRecord[] = []
  private readonly homeDir: string | undefined

  /**
   * Wire the decision listener, register the model tools, and restore the
   * persisted rule document.
   * @param ctx - host context.
   * @param config - validated plugin config.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, 'permissionRules')
    this.fallback = config.fallback

    // Resolve the home directory best-effort: app-boot profileContext first,
    // then DSH_HOME, then ~/.dsh. Persistence is best-effort and never throws
    // out of construction.
    const profileContext = (ctx as { profileContext?: { home?: string } }).profileContext
    this.homeDir = profileContext?.home ?? process.env.DSH_HOME ?? undefined

    const envPreset = process.env.DSH_PERMISSION_PRESET as PermissionPresetName | undefined
    this.presetName = envPreset !== undefined && findPreset(envPreset) !== undefined
      ? envPreset
      : config.preset

    // Seed from the boot config, then land the preset's rule set.
    this.rules = [...config.rules]
    this.applyPreset(this.presetName)
    // Overlay the on-disk document (user edits win); async and best-effort.
    void this.restore().catch(() => { /* best-effort */ })

    // pre-execute decision listener.
    ctx.on('tools/pre-execute', async (exec: ToolExecution, next): Promise<PreToolDecision> => {
      const decision = decidePermission(exec.name, this.rules, this.fallback)
      const outcome: 'allow' | 'ask' | 'deny' = decision.level === 'deny'
        ? 'deny'
        : decision.level === 'ask'
          ? 'ask'
          : 'allow'
      this.log.push({
        at: Date.now(),
        tool: exec.name,
        pattern: decision.rule ? decision.rule.pattern : null,
        level: decision.level,
        outcome,
      })
      if (this.log.length > MAX_LOG) this.log.shift()

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
      return next()
    })

    this.registerModelTools(ctx)
  }

  // ---- Remote face (settings-page editor) -------------------------------

  /**
   * Read the full engine state for the settings editor.
   * @returns current preset, fallback, effective rules, and the preset catalog.
   */
  @Remote('getState')
  getState(): PermissionRulesState {
    return {
      preset: this.presetName,
      fallback: this.fallback,
      rules: this.rules.map(r => ({ pattern: r.pattern, level: r.level })),
      presets: PERMISSION_PRESETS.map(p => ({
        name: p.name, label: p.label, description: p.description,
      })) satisfies PermissionRulesPresetInfo[],
    }
  }

  /**
   * Replace the custom rule list from the settings editor. Validates every
   * entry, swaps the in-memory rules, flips the preset to custom, and
   * persists the document.
   * @param rules - the new full rule list.
   * @returns the refreshed engine state.
   */
  @Remote('setRules')
  setRules(rules: PermissionRule[]): PermissionRulesState {
    if (!Array.isArray(rules)) throw new Error('permissionRules.setRules: rules 必须是数组')
    const cleaned: PermissionRule[] = []
    for (const [index, r] of rules.entries()) {
      if (typeof r.pattern !== 'string' || r.pattern.length === 0) {
        throw new Error(`permissionRules.setRules: 第 ${index + 1} 条规则 pattern 不能为空`)
      }
      if (!LEVELS.includes(r.level)) {
        throw new Error(`permissionRules.setRules: 第 ${index + 1} 条规则等级 "${r.level}" 非法`)
      }
      cleaned.push({ pattern: r.pattern, level: r.level })
    }
    this.rules = cleaned
    this.presetName = 'custom'
    void this.persist().catch(() => { /* best-effort */ })
    return this.getState()
  }

  // ---- internals --------------------------------------------------------

  /** Land a built-in preset as the active rule set (custom keeps user rules). */
  private applyPreset(name: PermissionPresetName): void {
    this.presetName = name
    if (name !== 'custom') {
      const preset = findPreset(name)
      this.rules = preset ? [...preset.rules] : []
    }
  }

  /** Path of the persisted document, when a home is known. */
  private persistedPath(): string | undefined {
    return this.homeDir === undefined ? undefined : join(this.homeDir, 'permission-rules.json')
  }

  /** Load the on-disk document over the config seed. */
  private async restore(): Promise<void> {
    const path = this.persistedPath()
    if (path === undefined) return
    let raw: string
    try {
      raw = await fs.readFile(path, 'utf8')
    } catch {
      return // no document yet: keep config seed
    }
    try {
      const parsed = JSON.parse(raw) as Partial<PersistedDocument>
      if (Array.isArray(parsed.rules)) {
        this.rules = parsed.rules.filter(
          r => typeof r.pattern === 'string' && LEVELS.includes(r.level),
        )
        this.presetName = 'custom'
      }
    } catch {
      // Corrupt document: ignore and keep the in-memory seed.
    }
  }

  /** Flush the current rules to disk. */
  private async persist(): Promise<void> {
    const path = this.persistedPath()
    if (path === undefined) return
    const doc: PersistedDocument = { rules: this.rules }
    await fs.writeFile(path, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
  }

  /** Register the model-visible permission_* tools. */
  private registerModelTools(ctx: Context): void {
    // defineTool invokes execute() as a bare function (no receiver), so we
    // capture the service instance via arrow-function lexical `this`.
    // permission_presets: list presets and the current one.
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
      // oxlint-disable-next-line typescript/require-await -- 工具接口要求 async 签名
      execute: async () => {
        return {
          current: this.presetName,
          presets: PERMISSION_PRESETS.map(p => ({
            name: p.name, label: p.label, description: p.description,
          })),
        }
      },
    }))

    // permission_get: current rules + optional per-tool decision.
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
      // oxlint-disable-next-line typescript/require-await -- 工具接口要求 async 签名
      execute: async (args: { tool_name?: string }) => {
        const out: {
          preset: string
          fallback: string
          rules: { pattern: string; level: string }[]
          decision?: { tool: string; matchedPattern: string | null; level: string }
        } = {
          preset: this.presetName,
          fallback: this.fallback,
          rules: this.rules.map(r => ({ pattern: r.pattern, level: r.level })),
        }
        if (typeof args.tool_name === 'string' && args.tool_name.length > 0) {
          const d = decidePermission(args.tool_name, this.rules, this.fallback)
          out.decision = {
            tool: args.tool_name,
            matchedPattern: d.rule ? d.rule.pattern : null,
            level: d.level,
          }
        }
        return out
      },
    }))

    // permission_set: switch preset or set custom rules (model-facing).
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
      // oxlint-disable-next-line typescript/require-await -- 工具接口要求 async 签名
      execute: async (args: { preset?: PermissionPresetName; rules?: PermissionRule[] }) => {
        if (typeof args.preset === 'string') {
          if (findPreset(args.preset) === undefined) {
            throw new Error(`permission_set: 未知预设 "${args.preset}"，可选 normal/full-auto/strict/custom`)
          }
          this.applyPreset(args.preset)
        }
        if (Array.isArray(args.rules)) {
          for (const r of args.rules) {
            if (typeof r.pattern !== 'string' || r.pattern.length === 0) {
              throw new Error('permission_set: 每条规则必须有非空 pattern')
            }
            if (!LEVELS.includes(r.level)) {
              throw new Error(`permission_set: 非法等级 "${r.level}"，可选 allow/auto/ask/deny`)
            }
          }
          this.rules = args.rules.map(r => ({ pattern: r.pattern, level: r.level }))
          this.presetName = 'custom'
          void this.persist().catch(() => { /* best-effort */ })
        }
        return {
          ok: true,
          preset: this.presetName,
          rules: this.rules.map(r => ({ pattern: r.pattern, level: r.level })),
        }
      },
    }))
  }
}

export default PermissionRulesService
