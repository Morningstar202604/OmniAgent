/**
 * 细粒度工具权限规则引擎（纯函数，无 Cordis 依赖，便于单测）。
 *
 * 四档权限：
 * - `allow`：允许执行（与 auto 最终都放行，但语义上是"显式允许"）
 * - `auto`：自动允许、无需任何确认（与 allow 在决策上等价，仅日志/预设语义不同）
 * - `ask`：调用前弹审批（交给现有 user-approval 服务）
 * - `deny`：直接拒绝
 *
 * 规则匹配：按工具名做 `*` 通配符匹配（如 `shell.*`、`finance_*`、`*`）。
 * 优先级：deny > ask > allow > auto；同档时更具体（非通配符字符更多）的规则胜出。
 *
 * @module @deepseek-ai/dsh-permission-rules/rules
 */

/** 四档权限等级。 */
export type PermissionLevel = 'allow' | 'auto' | 'ask' | 'deny'

/** 一条用户自定义权限规则。 */
export interface PermissionRule {
  /** 工具名通配符模式，支持 `*`。 */
  pattern: string
  /** 命中该模式时采取的权限等级。 */
  level: PermissionLevel
}

/** 决策结果：交由调用方映射为 PreToolDecision。 */
export interface PermissionDecision {
  /** 最终命中的规则；未命中任何规则时为 undefined（走兜底档）。 */
  rule: PermissionRule | undefined
  /** 最终生效的权限等级。 */
  level: PermissionLevel
  /** 命中的工具名（便于审计）。 */
  toolName: string
}

/** 等级排序权重：deny 最高，auto 最低；同具体度时高权重胜出。 */
const LEVEL_RANK: Record<PermissionLevel, number> = {
  deny: 3,
  ask: 2,
  allow: 1,
  auto: 0,
}

/**
 * 把 `*` 通配符模式编译为锚定正则（与 repeat-tool-reminder 一致的转义策略：
 * 除 `*` 外的正则元字符按字面匹配）。
 */
function wildcardToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[|\\{}()[\]^$+?.]/g, String.raw`\$&`)
  return new RegExp(`^${escaped.replaceAll('*', '.*')}$`)
}

/**
 * 计算模式的"具体度"：非通配符字符数。数字越大越具体，同档优先命中。
 * 精确名（无 `*`）自然比通配符更具体。
 */
function specificity(pattern: string): number {
  let score = 0
  for (const ch of pattern) {
    if (ch !== '*') score += 1
  }
  return score
}

/**
 * 对工具名做权限决策。
 *
 * @param toolName - 实际被调用的工具名（如 `bash`、`finance_quote`）。
 * @param rules - 当前生效的规则列表（顺序即注册顺序）。
 * @param fallback - 未命中任何规则时的兜底等级，默认 `allow`（放行，不改变现有行为）。
 * @returns 决策结果。
 */
export function decidePermission(
  toolName: string,
  rules: readonly PermissionRule[],
  fallback: PermissionLevel = 'allow',
): PermissionDecision {
  let best: { rule: PermissionRule; score: [number, number] } | undefined
  for (const rule of rules) {
    const regex = wildcardToRegExp(rule.pattern)
    if (!regex.test(toolName)) continue
    // 排序键：[具体度降序, 等级权重降序]；首条命中同分时保留先注册者。
    const score: [number, number] = [specificity(rule.pattern), LEVEL_RANK[rule.level]]
    if (
      best === undefined
      || score[0] > best.score[0]
      || (score[0] === best.score[0] && score[1] > best.score[1])
    ) {
      best = { rule, score }
    }
  }
  if (best === undefined) {
    return { rule: undefined, level: fallback, toolName }
  }
  return { rule: best.rule, level: best.rule.level, toolName }
}

/** 内置权限预设标识。 */
export type PermissionPresetName = 'normal' | 'full-auto' | 'strict' | 'custom'

/** 一个预设的完整描述。 */
export interface PermissionPreset {
  /** 预设标识。 */
  name: PermissionPresetName
  /** 中文展示名。 */
  label: string
  /** 中文一句话说明。 */
  description: string
  /** 该预设落地为的规则列表。 */
  rules: readonly PermissionRule[]
}

/**
 * 内置预设表。
 * - `normal`（默认）：不注册任何额外规则，兜底放行——保持现有 sandbox+approval 行为不变。
 * - `full-auto`：全部工具自动允许，不再额外询问（注意：仍受底层沙箱约束）。
 * - `strict`：全部工具调用前都要求确认。
 * - `custom`：由用户自定义规则决定（不内置规则）。
 */
export const PERMISSION_PRESETS: readonly PermissionPreset[] = [
  {
    name: 'normal',
    label: '默认（敏感操作询问）',
    description: '不施加额外的工具级规则，沿用底层沙箱与现有审批策略；这是默认行为。',
    rules: [],
  },
  {
    name: 'full-auto',
    label: '全自动',
    description: '所有工具自动允许、不再额外确认。',
    rules: [{ pattern: '*', level: 'auto' }],
  },
  {
    name: 'strict',
    label: '严格',
    description: '所有工具调用前都要求用户确认。',
    rules: [{ pattern: '*', level: 'ask' }],
  },
  {
    name: 'custom',
    label: '自定义',
    description: '使用用户配置的自定义规则列表。',
    rules: [],
  },
]

/** 按名字查预设，未命中返回 undefined。 */
export function findPreset(name: string): PermissionPreset | undefined {
  return PERMISSION_PRESETS.find(p => p.name === name)
}
