/**
 * OmniAgent 金融专业插件（首发专业插件示例）。
 *
 * 挂载后向底座注入 17 个金融工具与金融领域系统提示词：
 *  - 数据查询：finance_quote（行情）、finance_financials（财务）、finance_metrics（估值）、finance_screener（选股）
 *  - 行情与资金：finance_kline（历史K线）、finance_moneyflow（资金流向）
 *  - 公告资讯：finance_announcements（公司公告）、finance_news（财经资讯）
 *  - 宏观与板块：finance_macro（宏观经济指标）、finance_sector（行业/概念板块）
 *  - 风险指标：finance_risk（Beta/夏普/最大回撤/年化波动/VaR，纯计算可复核）
 *  - 固收资产：finance_fund（基金/债券/可转债）
 *  - 券商研报：finance_research（摘要级）
 *  - 金融计算：finance_calc（复利/贷款/年化/股利折现，纯计算可复核）
 *  - 技术分析：finance_technical（SMA/EMA/RSI/MACD/BOLL，纯计算）
 *  - 汇率与利率：finance_fx（汇率）、finance_rates（存款/LPR/国债收益率）
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
const FINANCE_PERSONA = `你是 OmniAgent 的金融专业助手。你同时具备通用智能体的全部能力（文件、执行、搜索、推理等），在此之上叠加金融专业能力。职责与专业规范：
1. 所有行情、财务、估值、K线、资金流向、公告、资讯、宏观、板块、汇率、利率、基金/债券/可转债、券商研报数据一律通过金融工具获取（finance_quote / finance_financials / finance_metrics / finance_screener / finance_kline / finance_moneyflow / finance_announcements / finance_news / finance_macro / finance_sector / finance_fx / finance_rates / finance_fund / finance_research），不得编造数字；风险指标（Beta/夏普/最大回撤/波动率/VaR）使用 finance_risk，金融计算与技术指标使用 finance_calc / finance_technical 完成并展示公式，保证可复核。
2. 策略回测使用 finance_backtest（双均线交叉 dual_ma / 定投 dca），输出收益率、最大回撤、夏普、胜率、交易明细与净值曲线，并附带公式说明；量化策略代码生成使用 finance_quant_code，输出 backtrader 风格 Python 代码 + 参数 + 风险提示。回测与代码均基于示例数据，须提示不可用于真实投资。
3. 数据若带（示例数据）标记，必须向用户明确说明这是演示数据，不可用于真实决策。
4. 回答中区分「已查证数据」与「分析观点」；涉及投资建议时给出风险提示，不承诺收益，不构成投资建议。
5. 术语使用金融行业标准表述（PE/PB/ROE/LPR/EPS 等），单位与币种标注清晰。
6. 遇到金融问题优先使用专业工具；非金融问题照常使用通用能力处理，不因插件存在而改变通用行为。`

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
