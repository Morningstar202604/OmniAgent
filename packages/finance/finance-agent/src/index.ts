/**
 * OmniAgent 金融专业插件（首发专业插件示例）。
 *
 * 挂载后向底座注入 4 个金融工具（行情/财务/估值/选股）与金融领域系统提示词。
 * 数据源可插拔：默认 `mock`（内置示例数据，开箱即用）；配置 `source: http`
 * + `baseURL` + `apiKeyEnv` 即可对接任意行情/财务数据服务。
 *
 * profile 用法（finance profile）：
 * ```yaml
 * - id: finance-agent
 *   name: '@deepseek-ai/dsh-finance-agent'
 *   config:
 *     source: mock
 *     # source: http
 *     # baseURL: https://your-finance-gateway.example/v1
 *     # apiKeyEnv: FINANCE_API_KEY
 * ```
 * @module @deepseek-ai/dsh-finance-agent
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { createSource } from './source.ts'
import { buildFinanceTools } from './tools.ts'

/** Cordis 插件名（loader 诊断用）。 */
export const name = 'finance-agent'

/** 依赖的服务：工具注册表与系统提示词。 */
export const inject = ['tools', 'systemPrompt']

/** 插件配置：数据源模式与连接参数（密钥走环境变量，配置文件不落明文）。 */
export interface Config {
  /** 数据源模式：mock=内置示例；http=自定义网关。 */
  source?: 'mock' | 'http'
  /** HTTP 数据源根地址（source=http 时必填），如 https://finance-gateway.example/v1 */
  baseURL?: string
  /** 读取 API key 的环境变量名，默认 FINANCE_API_KEY。 */
  apiKeyEnv?: string
}

export const Config: z<Config> = z.object({
  source: z.union([z.const('mock'), z.const('http')]).default('mock'),
  baseURL: z.string().default(''),
  apiKeyEnv: z.string().default('FINANCE_API_KEY'),
})

/** 金融领域系统提示词（挂载时注入 systemPrompt 的 persona 区）。 */
const FINANCE_PERSONA = `你是 OmniAgent 的金融专业助手。职责边界：
1. 所有行情、财务、估值数据一律通过 finance_quote / finance_financials / finance_metrics / finance_screener 工具获取，不得编造数字。
2. 数据若带（示例数据）标记，必须向用户明确说明这是演示数据，不可用于真实决策。
3. 回答中区分「已查证数据」与「分析观点」；涉及投资建议时给出风险提示，不承诺收益。
4. 术语使用金融行业标准表述（PE/PB/ROE/市值等），单位与币种标注清晰。`

/** 注册金融工具集与领域提示词。 */
export function apply(ctx: Context, config: Config): void {
  const resolved = config as Required<Config>
  const source = createSource(resolved)

  // 系统提示词：金融 persona（仅当工具可见时注入，避免空挂）
  ctx.systemPrompt.section({
    name: 'finance-persona',
    order: -900,
    text: () => FINANCE_PERSONA,
  })

  // 注册工具
  for (const tool of buildFinanceTools(source)) {
    ctx.tools.register(tool)
  }
}
