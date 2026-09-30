/**
 * 电商运营纯逻辑引擎：标题优化、评论分析、选品评估、活动方案。
 * 全部为确定性规则计算（无随机），结果可手工复核，供工具层与冒烟测试共用。
 * @module @deepseek-ai/dsh-ecommerce-agent/src/engine
 */

/** 评论情感词库（正/负），用于规则情感打分。 */
const POSITIVE_WORDS = ['好', '快', '赞', '满意', '推荐', '喜欢', '值得', '实惠', '漂亮', '好用', '耐用', '舒服', '精致', '划算', '完美']
const NEGATIVE_WORDS = ['差', '慢', '破', '漏', '贵', '失望', '退货', '掉色', '异味', '划痕', '磨损', '破损', '挤压', '客服', '敷衍', '不值']

/** 评论问题聚类关键词。 */
const ISSUE_KEYWORDS: ReadonlyArray<readonly [string, string[]]> = [
  ['质量', ['破', '漏', '掉色', '异味', '划痕', '磨损', '破损', '做工']],
  ['物流', ['慢', '快递', '物流', '挤压', '运输']],
  ['客服', ['客服', '敷衍', '不回复', '态度']],
  ['包装', ['包装', '箱子', '压坏']],
  ['尺码', ['尺码', '偏大', '偏小', '不合身']],
  ['价格', ['贵', '不值', '涨价', '性价比']],
]

/** 选品评分维度权重（市场需求 30 / 竞争度 30 / 利润空间 25 / 季节适配 15）。 */
export const EVALUATION_WEIGHTS = { demand: 30, competition: 30, margin: 25, season: 15 } as const

/** 类目基准需求分（0-100），与 source.ts 的类目表保持一致。 */
export const CATEGORY_DEMAND: Record<string, number> = {
  '数码配件': 86, '家居日用': 78, '美妆护肤': 82, '食品饮料': 84, '服饰鞋包': 76, '母婴玩具': 80,
}

/**
 * 标题优化：应用一组可解释的电商标题规则。
 * @param title - 原标题。
 * @param keywords - 候选关键词（优先取前几个）。
 * @returns 优化后的标题、命中的规则与使用的关键词。
 */
export function optimizeTitle(title: string, keywords: readonly string[] = []): {
  optimized: string
  appliedRules: string[]
  keywordsUsed: string[]
  reason: string
} {
  const appliedRules: string[] = []
  const keywordsUsed: string[] = []
  let optimized = title.trim()

  // 规则 1：标题过短（< 8 字）时补充类目词。
  if (optimized.length < 8) {
    appliedRules.push('标题过短（<8字），已补充类目词')
    optimized += '【家用优选】'
  }

  // 规则 2：长度上限（电商标题常规 30 字内，超长截断并提示）。
  if (optimized.length > 30) {
    optimized = optimized.slice(0, 30)
    appliedRules.push('标题超过 30 字，已截断到上限')
  }

  // 规则 3：插入 1-2 个关键词（按给定顺序，未使用则不重复）。
  for (const keyword of keywords) {
    if (keywordsUsed.length >= 2) break
    if (keyword.length === 0) continue
    if (optimized.includes(keyword)) continue
    if (optimized.length + keyword.length + 1 > 30) continue
    optimized = `${optimized} ${keyword}`
    keywordsUsed.push(keyword)
  }
  if (keywordsUsed.length > 0) appliedRules.push(`已嵌入关键词 ${keywordsUsed.length} 个`)

  // 规则 4：标题含数字/规格词更易被理解，缺失时提示（不强行编造）。
  const hasSpec = /[0-9０-９]|ml|ML|g|G|件|支|片|盒/.test(optimized)
  if (!hasSpec) {
    appliedRules.push('建议补充规格词（容量/件数/克重），当前标题无数字规格')
  }

  // 规则 5：情绪/利益点词（如"包邮""加厚"）缺失时提示。
  if (!/(包邮|加厚|正品|官方|免费|券)/.test(optimized)) {
    appliedRules.push('建议补充利益点词（包邮/加厚/正品等）提升点击')
  }

  return {
    optimized,
    appliedRules,
    keywordsUsed,
    reason: appliedRules.length > 0 ? `应用了 ${appliedRules.length} 条规则：${appliedRules.join('；')}` : '标题已符合常规规范，无需调整',
  }
}

/**
 * 评论情感与问题分析（词库规则法，确定性）。
 * @param text - 评论文本。
 * @returns 情感倾向、得分、命中问题与改进建议。
 */
export function analyzeReview(text: string): {
  sentiment: 'positive' | 'neutral' | 'negative'
  score: number
  issues: string[]
  suggestion: string
} {
  const hitPositive = POSITIVE_WORDS.filter(word => text.includes(word)).length
  const hitNegative = NEGATIVE_WORDS.filter(word => text.includes(word)).length
  const score = Math.max(-1, Math.min(1, (hitPositive - hitNegative) / Math.max(1, hitPositive + hitNegative)))
  const sentiment = score > 0.2 ? 'positive' : score < -0.2 ? 'negative' : 'neutral'

  const issues: string[] = []
  for (const [label, keywords] of ISSUE_KEYWORDS) {
    if (keywords.some(word => text.includes(word))) issues.push(label)
  }

  let suggestion: string
  if (sentiment === 'negative') {
    suggestion = `集中处理「${issues.join('、') || '综合体验'}」问题：优先排查复现率最高的差评点，48 小时内回复并给出补偿/退换方案`
  } else if (sentiment === 'positive') {
    suggestion = '可将好评中的具体卖点整理为商品详情/广告语素材，并引导买家带图评价'
  } else {
    suggestion = '内容中性，可推送关怀信息或优惠券促进转化，同时关注未命中词库的具体描述'
  }

  return { sentiment, score, issues, suggestion }
}

/**
 * 选品评估：市场需求 × 竞争度 × 利润空间 × 季节适配 加权打分（0-100）。
 * @param category - 类目（需在类目表中，否则按 60 分基准）。
 * @param price - 售价（元）。
 * @param cost - 成本（元）。
 * @param seasonIndex - 当前季节指数（0-1.5，默认 1.0）。
 * @returns 分项得分、总分与结论。
 */
export function evaluateProduct(category: string, price: number, cost: number, seasonIndex = 1): {
  total: number
  parts: { demand: number; competition: number; margin: number; season: number }
  verdict: '推荐' | '可做' | '谨慎' | '不建议'
  reason: string
} {
  const baseDemand = CATEGORY_DEMAND[category] ?? 60
  const demandScore = Math.max(0, Math.min(100, baseDemand + (price < 30 ? 6 : price > 300 ? -6 : 0)))

  // 竞争度直接取类目竞争分（低 85 / 中 65 / 高 45，来自 source.marketInsight）。
  const competitionByCategory: Record<string, number> = {
    '数码配件': 45, '家居日用': 65, '美妆护肤': 45, '食品饮料': 65, '服饰鞋包': 45, '母婴玩具': 65,
  }
  const competitionScore = competitionByCategory[category] ?? 60

  const margin = price > 0 ? (price - cost) / price : 0
  const marginScore = Math.max(0, Math.min(100, margin * 200)) // 50% 毛利 → 100 分

  const seasonScore = Math.max(0, Math.min(100, seasonIndex * 100))

  const total = Math.round(
    (demandScore * EVALUATION_WEIGHTS.demand
      + competitionScore * EVALUATION_WEIGHTS.competition
      + marginScore * EVALUATION_WEIGHTS.margin
      + seasonScore * EVALUATION_WEIGHTS.season) / 100,
  )

  const verdict = total >= 75 ? '推荐' : total >= 60 ? '可做' : total >= 40 ? '谨慎' : '不建议'
  const reason = `总分 ${total}/100：市场需求 ${demandScore}（权重30%）+ 竞争度 ${competitionScore}（权重30%）+ 利润空间 ${marginScore}（权重25%，毛利率 ${(margin * 100).toFixed(1)}%）+ 季节适配 ${seasonScore}（权重15%）`

  return { total, parts: { demand: demandScore, competition: competitionScore, margin: marginScore, season: seasonScore }, verdict, reason }
}

/** 大促节点的默认玩法组合。 */
const CAMPAIGN_PLAYS: Record<string, string[]> = {
  '618': ['预售定金', '跨店满减', '店铺券叠加', '限时秒杀'],
  '双11': ['预售定金', '跨店满减', '会员专享价', '前N件半价'],
  '双12': ['跨店满减', '店铺券', '满赠小样'],
  '年货节': ['满减', '第二件半价', '赠品', '顺丰包邮'],
  '开学季': ['学生券', '满件折扣', '套装价'],
  '女神节': ['美妆券', '满赠', '会员日折扣'],
  '国庆': ['店铺券', '满减', '出行套装价'],
}

/**
 * 活动促销方案：按节点给玩法、折扣力度与节奏建议。
 * @param category - 类目。
 * @param node - 活动节点（日常/618/双11/双12/年货节/开学季/女神节/国庆）。
 * @param margin - 毛利率（0-1，用于折扣力度测算，默认 0.4）。
 * @returns 玩法、折扣建议与节奏安排。
 */
export function buildCampaign(category: string, node: string, margin = 0.4): {
  node: string
  plays: string[]
  discount: string
  rhythm: string[]
  note: string
} {
  const plays = CAMPAIGN_PLAYS[node] ?? ['店铺券', '满减', '赠品']
  const maxDiscount = Math.max(0, Math.min(0.5, margin * 0.5))
  const discount = `建议最大让利幅度 ≈ 毛利率×50% = ${(maxDiscount * 100).toFixed(0)}% 以内（${category} 常规毛利场景）`
  const rhythm = ['预热期（提前3-7天：种草/加购/收藏）', '爆发期（活动当天：秒杀+直播冲量）', '返场期（结束后1-2天：清仓/回购券）']
  const note = '以上为通用运营建议（演示数据），实际折扣需结合平台扣点、运费与库存综合测算'

  return { node, plays, discount, rhythm, note }
}
