/**
 * OmniAgent 电商运营专业插件（第二个领域插件示例，验证"任意垂直领域皆可打包成插件"）。
 *
 * 挂载后向底座注入 8 个电商运营工具与电商领域系统提示词：
 *  - ecom_keyword_suggest（关键词拓词）、ecom_title_optimize（标题优化）
 *  - ecom_market_insight（类目市场洞察）、ecom_product_evaluate（选品评估）
 *  - ecom_review_analyze（评论分析）、ecom_price_compare（价格带分析）
 *  - ecom_script_suggest（带货脚本建议）、ecom_campaign_plan（活动促销方案）
 *
 * 数据源为内置示例（mock，确定性可复核），工具层只依赖 {@link EcommerceDataSource} 契约，
 * 未来可按同一契约接入真实电商数据服务。所有示例数据带 mock 标记，模型必须明示。
 *
 * profile 用法（ecommerce profile）：
 * ```yaml
 * - id: ecommerce-agent
 *   name: '@deepseek-ai/dsh-ecommerce-agent'
 * ```
 * @module @deepseek-ai/dsh-ecommerce-agent
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { createSource } from './source.ts'
import { buildEcommerceTools } from './tools.ts'

/** Cordis 插件名（loader 诊断用）。 */
export const name = 'ecommerce-agent'

/** 依赖的服务：工具注册表与系统提示词。 */
export const inject = ['tools', 'systemPrompt']

/** 插件配置：当前仅内置示例数据源，预留字段便于未来扩展。 */
export interface Config {
  /** 数据源模式：当前仅 mock（内置示例）；接入真实服务时扩展实现同一契约。 */
  source?: 'mock'
}

export const Config: z<Config> = z.object({
  source: z.union([z.const('mock')]).default('mock'),
})

/** 电商领域系统提示词（挂载时注入 systemPrompt 的 persona 区）。 */
const ECOMMERCE_PERSONA = `你是 OmniAgent 的电商运营专业助手。你同时具备通用智能体的全部能力（文件、执行、搜索、推理等），在此之上叠加电商运营专业能力。职责与专业规范：
1. 关键词、市场洞察、价格带、选品评估等数据一律通过电商工具获取（ecom_keyword_suggest / ecom_market_insight / ecom_price_compare / ecom_product_evaluate），不得编造数字；标题优化（ecom_title_optimize）与评论分析（ecom_review_analyze）为确定性规则计算，可展示命中规则供复核。
2. 数据若带（示例数据）标记，必须向用户明确说明这是演示数据，不可用于真实经营决策。
3. 带货脚本（ecom_script_suggest）与活动方案（ecom_campaign_plan）为方法论建议，不承诺销量、排名或转化效果。
4. 回答中区分「已查证数据」「规则计算结果」与「运营建议」；涉及投入资金（投放预算、备货）时给出风险提示。
5. 术语使用电商行业标准表述（UV/转化率/GMV/价格带/毛利/活动节点等），金额与单位标注清晰。
6. 遇到电商问题优先使用专业工具；非电商问题照常使用通用能力处理，不因插件存在而改变通用行为。`

/** 注册电商工具集与领域提示词。 */
export function apply(ctx: Context, _config: Config): void {
  const source = createSource()

  // 系统提示词：电商 persona（仅当工具可见时注入，避免空挂）
  ctx.systemPrompt.section({
    name: 'ecommerce-persona',
    order: -900,
    text: () => ECOMMERCE_PERSONA,
  })

  // 注册工具
  for (const tool of buildEcommerceTools(source)) {
    ctx.tools.register(tool)
  }
}
