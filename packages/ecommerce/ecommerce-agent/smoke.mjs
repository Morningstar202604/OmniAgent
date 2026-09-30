/**
 * ecommerce-agent 数据源与纯逻辑冒烟测试：直接调用数据契约与引擎，验证示例数据端到端。
 * （工具注册层由单包 tsc 类型检查验证；tsdown 打包产物在本沙箱无法生成）
 * 运行: node --experimental-strip-types packages/ecommerce/ecommerce-agent/smoke.mjs
 */
import { createSource, parseCategory, CATEGORIES } from './src/source.ts'
import { optimizeTitle, analyzeReview, evaluateProduct, buildCampaign, CATEGORY_DEMAND } from './src/engine.ts'

const source = createSource()

let pass = 0
let fail = 0
const check = (name, ok, detail) => {
  if (ok) { pass++; console.log(`✅ ${name}`) }
  else { fail++; console.log(`❌ ${name}: ${detail}`) }
}

// 1. 关键词拓词（确定性）
const words = source.keywords('蓝牙耳机', 5)
check('keywords 数量', words.length === 5, JSON.stringify(words.length))
check('keywords 确定性', JSON.stringify(source.keywords('蓝牙耳机', 5)) === JSON.stringify(words), '两次结果不一致')
check('keywords 带 mock 标记', words.every(w => w.mock === true), JSON.stringify(words[0]))
check('keywords 体积为正', words.every(w => w.volume > 0), '')

// 2. 类目市场洞察
const insight = source.marketInsight('数码配件')
check('marketInsight 字段', insight.marketSize === 3800 && insight.growthPct === 8.5 && insight.mock === true, JSON.stringify(insight))
check('marketInsight 季节指数 12 个月', insight.seasonality.length === 12, JSON.stringify(insight.seasonality.length))

// 3. 价格带
const bands = source.priceBands('美妆护肤')
check('priceBands 三档', bands.bands.length === 3 && bands.suggestedPrice === 129, JSON.stringify(bands))

// 4. 季节指数
check('seasonIndex 边界', source.seasonIndex('食品饮料', 0) === source.seasonIndex('食品饮料', 1), '月份越界未归一')
check('seasonIndex 取值', source.seasonIndex('美妆护肤', 12) === 1.4, String(source.seasonIndex('美妆护肤', 12)))

// 5. 非法类目拒绝
try {
  parseCategory('不存在类目')
  check('非法类目拒绝', false, '未被拒绝')
} catch (e) {
  check('非法类目拒绝', /未知类目/.test(String(e.message)), String(e.message))
}

// 6. 标题优化（确定性规则）
const titleShort = optimizeTitle('蓝牙耳机', ['降噪', '长续航'])
check('title 过短补充', titleShort.optimized.includes('家用优选'), titleShort.optimized)
check('title 嵌入关键词', titleShort.keywordsUsed.includes('降噪'), JSON.stringify(titleShort.keywordsUsed))
const titleLong = optimizeTitle('这是一条非常非常非常长的标题内容用于测试截断逻辑是否正常工作超过三十个字符', ['关键词A'])
check('title 超长截断', titleLong.optimized.length <= 30, `len=${titleLong.optimized.length}`)
const titleOkInput = '无线蓝牙耳机 降噪 长续航 蓝牙5.3 30小时 运动'
const titleOk = optimizeTitle(titleOkInput, ['非常长的关键词A', '非常长的关键词B'])
check('title 合规不强行改动', titleOk.keywordsUsed.length === 0 && titleOk.optimized === titleOkInput, titleOk.optimized)

// 7. 评论分析（词库规则）
const bad = analyzeReview('物流太慢了，包装都压坏了，客服还不回复')
check('review 差评', bad.sentiment === 'negative', JSON.stringify(bad))
check('review 问题聚类', bad.issues.includes('物流') && bad.issues.includes('客服') && bad.issues.includes('包装'), JSON.stringify(bad.issues))
const good = analyzeReview('质量很好，发货快，客服态度好，推荐购买！')
check('review 好评', good.sentiment === 'positive', JSON.stringify(good))

// 8. 选品评估（加权打分可复核）
const ev = evaluateProduct('家居日用', 39, 20, 1.2)
const expectedTotal = Math.round((ev.parts.demand * 30 + ev.parts.competition * 30 + ev.parts.margin * 25 + ev.parts.season * 15) / 100)
check('evaluate 总分自洽', ev.total === expectedTotal, `${ev.total} != ${expectedTotal}`)
check('evaluate 结论档位', ['推荐', '可做', '谨慎', '不建议'].includes(ev.verdict), ev.verdict)
check('evaluate 类目表一致', CATEGORY_DEMAND['家居日用'] === 78, String(CATEGORY_DEMAND['家居日用']))

// 9. 活动方案
const plan = buildCampaign('食品饮料', '双11', 0.4)
check('campaign 玩法', plan.plays.includes('预售定金') && plan.plays.includes('跨店满减'), JSON.stringify(plan.plays))
check('campaign 让利测算', plan.discount.includes('20%'), plan.discount)
check('campaign 节奏三段', plan.rhythm.length === 3, JSON.stringify(plan.rhythm))

// 10. 类目枚举覆盖
check('类目枚举 6 个', CATEGORIES.length === 6, CATEGORIES.join(','))

console.log(`\n${pass} 通过 / ${fail} 失败`)
process.exit(fail === 0 ? 0 : 1)
