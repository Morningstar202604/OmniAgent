/**
 * 电商数据契约与内置示例数据（mock）数据源。
 * 工具层只依赖 {@link EcommerceDataSource} 契约，与具体数据源解耦；
 * 所有 mock 数据带 `mock: true` 标记，模型必须向用户明示为演示数据。
 * @module @deepseek-ai/dsh-ecommerce-agent/src/source
 */

/** 类目（示例数据覆盖 6 个常见大类）。 */
export type EcommerceCategory = '数码配件' | '家居日用' | '美妆护肤' | '食品饮料' | '服饰鞋包' | '母婴玩具'

/** 竞争度。 */
export type EcommerceCompetition = '低' | '中' | '高'

/** 类目集合（供参数校验）。 */
export const CATEGORIES: readonly EcommerceCategory[] = ['数码配件', '家居日用', '美妆护肤', '食品饮料', '服饰鞋包', '母婴玩具']

/** 平台（脚本建议用）。 */
export type EcommercePlatform = 'douyin' | 'kuaishou' | 'taobao' | 'jd'

/** 活动节点。 */
export type EcommerceCampaignNode = '日常' | '618' | '双11' | '双12' | '年货节' | '开学季' | '女神节' | '国庆'

/** 关键词建议。 */
export interface EcommerceKeyword {
  word: string
  volume: number
  competition: EcommerceCompetition
  mock: true
}

/** 类目市场洞察。 */
export interface EcommerceMarketInsight {
  category: EcommerceCategory
  marketSize: number
  growthPct: number
  competition: EcommerceCompetition
  seasonality: number[]
  updatedAt: string
  mock: true
}

/** 价格带分布。 */
export interface EcommercePriceBand {
  band: '低价格带' | '中价格带' | '高价格带'
  share: number
  avgPrice: number
}

/** 价格带分析结果。 */
export interface EcommercePriceInsight {
  category: EcommerceCategory
  bands: EcommercePriceBand[]
  suggestedPrice: number
  updatedAt: string
  mock: true
}

/** 电商数据源契约：mock 为内置示例，未来可按同一契约接入真实电商数据服务。 */
export interface EcommerceDataSource {
  /** 关键词拓词（确定性长尾词生成）。 */
  keywords(seed: string, count: number): EcommerceKeyword[]
  /** 类目市场洞察（规模/增速/竞争/季节指数）。 */
  marketInsight(category: EcommerceCategory): EcommerceMarketInsight
  /** 类目价格带分布与建议定价。 */
  priceBands(category: EcommerceCategory): EcommercePriceInsight
  /** 类目季节指数（1-12 月，用于选品季节适配打分）。 */
  seasonIndex(category: EcommerceCategory, month: number): number
}

/** 类目示例数据表（市场规模：亿元；增速：%；季节指数：1-12 月，>1 为旺季）。 */
const MARKET_DATA: Record<EcommerceCategory, { marketSize: number; growthPct: number; competition: EcommerceCompetition; seasonality: number[] }> = {
  '数码配件': { marketSize: 3800, growthPct: 8.5, competition: '高', seasonality: [0.9, 0.9, 1.0, 1.0, 1.0, 1.1, 1.1, 1.2, 1.2, 1.1, 1.2, 1.0] },
  '家居日用': { marketSize: 6200, growthPct: 6.2, competition: '中', seasonality: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.1, 1.1, 1.1, 1.1] },
  '美妆护肤': { marketSize: 5400, growthPct: 12.4, competition: '高', seasonality: [1.0, 0.9, 1.0, 1.0, 1.0, 1.1, 1.2, 1.2, 1.1, 1.0, 1.3, 1.4] },
  '食品饮料': { marketSize: 8100, growthPct: 9.8, competition: '中', seasonality: [1.1, 1.1, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 1.0, 1.0, 1.1, 1.3] },
  '服饰鞋包': { marketSize: 12600, growthPct: 4.1, competition: '高', seasonality: [0.7, 0.8, 1.0, 1.0, 1.0, 1.0, 0.9, 0.9, 1.2, 1.3, 1.2, 1.1] },
  '母婴玩具': { marketSize: 4600, growthPct: 7.6, competition: '中', seasonality: [0.9, 0.9, 0.9, 0.9, 0.9, 1.3, 1.1, 0.9, 1.2, 1.0, 1.0, 1.0] },
}

/** 类目价格带分布（示例）。 */
const PRICE_BANDS: Record<EcommerceCategory, EcommercePriceBand[]> = {
  '数码配件': [
    { band: '低价格带', share: 0.35, avgPrice: 19.9 },
    { band: '中价格带', share: 0.45, avgPrice: 59 },
    { band: '高价格带', share: 0.2, avgPrice: 169 },
  ],
  '家居日用': [
    { band: '低价格带', share: 0.3, avgPrice: 15.9 },
    { band: '中价格带', share: 0.5, avgPrice: 45 },
    { band: '高价格带', share: 0.2, avgPrice: 129 },
  ],
  '美妆护肤': [
    { band: '低价格带', share: 0.25, avgPrice: 39 },
    { band: '中价格带', share: 0.5, avgPrice: 129 },
    { band: '高价格带', share: 0.25, avgPrice: 399 },
  ],
  '食品饮料': [
    { band: '低价格带', share: 0.4, avgPrice: 19.9 },
    { band: '中价格带', share: 0.4, avgPrice: 49.9 },
    { band: '高价格带', share: 0.2, avgPrice: 129 },
  ],
  '服饰鞋包': [
    { band: '低价格带', share: 0.3, avgPrice: 49 },
    { band: '中价格带', share: 0.45, avgPrice: 149 },
    { band: '高价格带', share: 0.25, avgPrice: 499 },
  ],
  '母婴玩具': [
    { band: '低价格带', share: 0.35, avgPrice: 29 },
    { band: '中价格带', share: 0.45, avgPrice: 89 },
    { band: '高价格带', share: 0.2, avgPrice: 259 },
  ],
}

/** 关键词长尾后缀池（确定性拼装用）。 */
const KEYWORD_SUFFIXES = ['排行榜', '测评', '推荐', '品牌', '新款', '官方旗舰店', '性价比', '家用', '学生党', '便携', '大容量', '加厚', '2026热销', '工厂直销', '礼盒装', '不踩雷']

/** 校验类目参数，非法值抛错（给模型可行动的提示）。 */
export function parseCategory(category: string): EcommerceCategory {
  const normalized = CATEGORIES.find(c => c === category)
  if (normalized === undefined) {
    throw new Error(`未知类目 ${JSON.stringify(category)}，可选：${CATEGORIES.join('、')}`)
  }
  return normalized
}

/** 校验平台参数。 */
export function parsePlatform(platform: string | undefined): EcommercePlatform {
  const value = (platform ?? 'douyin') as EcommercePlatform
  if (value !== 'douyin' && value !== 'kuaishou' && value !== 'taobao' && value !== 'jd') {
    throw new Error(`未知平台 ${JSON.stringify(platform)}，可选：douyin、kuaishou、taobao、jd`)
  }
  return value
}

/** 校验活动节点参数。 */
export function parseCampaignNode(node: string | undefined): EcommerceCampaignNode {
  const value = (node ?? '日常') as EcommerceCampaignNode
  const nodes: readonly EcommerceCampaignNode[] = ['日常', '618', '双11', '双12', '年货节', '开学季', '女神节', '国庆']
  if (!nodes.includes(value)) {
    throw new Error(`未知活动节点 ${JSON.stringify(node)}，可选：${nodes.join('、')}`)
  }
  return value
}

/** 确定性哈希（用于从种子词生成稳定的长尾词组合）。 */
function hashString(input: string): number {
  let hash = 0
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0
  }
  return hash
}

/** 创建 mock 数据源（当前唯一数据源，未来可扩展 http 等实现同一契约）。 */
export function createSource(): EcommerceDataSource {
  return {
    keywords(seed: string, count: number) {
      const trimmed = seed.trim()
      if (trimmed.length === 0) throw new Error('关键词种子不能为空')
      const base = hashString(trimmed)
      const total = Math.max(1, Math.min(20, Math.floor(count) || 10))
      const words: EcommerceKeyword[] = []
      for (let index = 0; index < total; index += 1) {
        const suffix = KEYWORD_SUFFIXES[(base + index * 7) % KEYWORD_SUFFIXES.length]
        const word = `${trimmed} ${suffix}`
        const volume = 3000 + ((base + index * 131) % 197000)
        const competition: EcommerceKeyword['competition'] = (base + index) % 3 === 0 ? '低' : (base + index) % 3 === 1 ? '中' : '高'
        words.push({ word, volume, competition, mock: true })
      }
      return words
    },

    marketInsight(category: EcommerceCategory) {
      const data = MARKET_DATA[category]
      return {
        category,
        marketSize: data.marketSize,
        growthPct: data.growthPct,
        competition: data.competition,
        seasonality: data.seasonality,
        updatedAt: '2026-09（示例数据）',
        mock: true,
      }
    },

    priceBands(category: EcommerceCategory) {
      const bands = PRICE_BANDS[category]
      const mid = bands.find(band => band.band === '中价格带')
      const suggestedPrice = mid === undefined ? 59 : mid.avgPrice
      return { category, bands, suggestedPrice, updatedAt: '2026-09（示例数据）', mock: true }
    },

    seasonIndex(category: EcommerceCategory, month: number) {
      const normalized = Math.max(1, Math.min(12, Math.floor(month) || 1))
      return MARKET_DATA[category].seasonality[normalized - 1] ?? 1
    },
  }
}
