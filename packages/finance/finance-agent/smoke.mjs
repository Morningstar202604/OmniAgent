/**
 * finance-agent 数据源冒烟测试：直接调用数据源契约，验证 mock 数据端到端。
 * （工具注册层由单包 tsc 类型检查验证；tsdown 打包产物在本沙箱无法生成）
 * 运行: node packages/finance/finance-agent/smoke.mjs
 */
import { createSource, parseMarket } from './lib/types/source.js'
import { compoundFutureValue, loanPayment, annualizedReturn, dividendDiscountValue } from './lib/types/calc.js'

const source = createSource({ source: 'mock' })

let pass = 0
let fail = 0
const check = (name, ok, detail) => {
  if (ok) { pass++; console.log(`✅ ${name}`) }
  else { fail++; console.log(`❌ ${name}: ${detail}`) }
}

// 1. 行情
const q = await source.quote('600519', 'cn')
check('quote 600519', q.symbol === '600519' && q.price === 1688 && q.mock === true, JSON.stringify(q))
check('quote 币种', q.currency === 'CNY', q.currency)

// 2. 财务
const f = await source.financials('600519', 'cn', 2025)
check('financials 600519', f.revenue === 1.74e11 && f.roe === 33.8 && f.mock === true, JSON.stringify(f))
const fOther = await source.financials('600519', 'cn', 2024)
check('financials 缺年数据置零', fOther.year === 2024 && fOther.revenue === 0, JSON.stringify(fOther))

// 3. 估值
const m = await source.metrics('AAPL', 'us')
check('metrics AAPL', m.pe === 34.8 && m.market === 'us', JSON.stringify(m))

// 4. 选股（过滤：A股 + PE<=20）
const rows = await source.screener({ market: 'cn', maxPe: 20 })
check('screener cn PE<=20', Array.isArray(rows) && rows.length >= 1 && rows.every(r => r.pe <= 20), JSON.stringify(rows))

// 5. 非法市场参数
try {
  parseMarket('xx')
  check('非法 market 拒绝', false, '未被拒绝')
} catch (e) {
  check('非法 market 拒绝', /market/.test(String(e.message)), String(e.message))
}

// 6. 未知标的提示
try {
  await source.quote('999999', 'cn')
  check('未知标的提示', false, '未报错')
} catch (e) {
  check('未知标的提示', /未收录/.test(String(e.message)), String(e.message))
}

// 7. 空结果
const none = await source.screener({ market: 'cn', minMarketCap: 1e15 })
check('screener 空结果', Array.isArray(none) && none.length === 0, JSON.stringify(none))

// 8. Http 数据源缺 baseURL 拒绝
try {
  createSource({ source: 'http' })
  check('http 缺 baseURL 拒绝', false, '未拒绝')
} catch (e) {
  check('http 缺 baseURL 拒绝', /baseURL/.test(String(e.message)), String(e.message))
}

// 9. 汇率（新增）
const fx = await source.fx('USD/CNY')
check('fx USD/CNY', fx.base === 'USD' && fx.quote === 'CNY' && fx.rate === 7.12 && fx.mock === true, JSON.stringify(fx))
try {
  await source.fx('XXX/YYY')
  check('fx 未知货币对拒绝', false, '未拒绝')
} catch (e) {
  check('fx 未知货币对拒绝', /未收录/.test(String(e.message)), String(e.message))
}

// 10. 利率（新增）
const lpr = await source.rates('lpr')
check('rates lpr', Array.isArray(lpr) && lpr.some(r => r.name.includes('LPR') && r.rate > 0), JSON.stringify(lpr))
const bond = await source.rates('bond')
check('rates bond', Array.isArray(bond) && bond.some(r => r.name.includes('国债')), JSON.stringify(bond))

// 11. 金融计算（纯函数）
const fv = compoundFutureValue(1_000_000, 3, 5)
check('calc 复利终值 100万×1.03^5', Math.abs(fv - 1_159_274.07) < 0.01, String(fv))
const pmt = loanPayment(1_000_000, 3.6, 360)
check('calc 房贷月供 100万/3.6%/30年', Math.abs(pmt - 4546.5) < 1, String(pmt))
const ret = annualizedReturn(100, 200, 5)
check('calc 年化收益 (2)^(1/5)-1', Math.abs(ret - 14.869) < 0.01, String(ret))
const ddm = dividendDiscountValue(2, 8, 3)
check('calc DDM 2/(8%-3%)', Math.abs(ddm - 40) < 0.01, String(ddm))

// 12. K线（新增）
const kl = await source.kline('600519', 'cn', 'day', 30)
check('kline 600519 30根', kl.bars.length === 30 && kl.mock === true, `bars=${kl.bars.length}`)
check('kline 末根收盘锚定现价', kl.bars[kl.bars.length - 1].close === 1688.0, String(kl.bars[kl.bars.length - 1].close))
const klAgain = await source.kline('600519', 'cn', 'day', 30)
check('kline 确定性可复现', JSON.stringify(kl.bars) === JSON.stringify(klAgain.bars), '两次结果不一致')
const klUs = await source.kline('AAPL', 'us', 'week', 10)
check('kline AAPL 周K', klUs.market === 'us' && klUs.period === 'week' && klUs.bars.length === 10, JSON.stringify(klUs.bars.length))
try {
  await source.kline('999999', 'cn', 'day', 30)
  check('kline 未知标的拒绝', false, '未报错')
} catch (e) {
  check('kline 未知标的拒绝', /未收录/.test(String(e.message)), String(e.message))
}

// 13. 资金流向（新增）
const mf = await source.moneyflow('600519', 'cn')
check('moneyflow 600519 主力净流入', mf.mainNetInflow === 3.24e8 && mf.mock === true, JSON.stringify(mf))
check('moneyflow 主力≈超大+大单', Math.abs(mf.mainNetInflow - (mf.superLargeNet + mf.largeNet)) < 1e3, String(mf.mainNetInflow))
const mf2 = await source.moneyflow('000858', 'cn')
check('moneyflow 000858 主力为负', mf2.mainNetInflow < 0, String(mf2.mainNetInflow))

// 14. 公司公告（新增）
const ann = await source.announcements('600519', 'cn', undefined, 10)
check('announcements 600519', ann.items.length >= 5 && ann.total >= 5 && ann.mock === true, `total=${ann.total} items=${ann.items.length}`)
const annDiv = await source.announcements('600519', 'cn', 'dividend', 10)
check('announcements 分红过滤', annDiv.total >= 1 && annDiv.items.every(i => i.category === 'dividend'), JSON.stringify(annDiv.items.map(i => i.category)))

// 15. 财经资讯（新增）
const allNews = await source.news(undefined, 20)
check('news 默认全部', allNews.total === 15 && allNews.items.length === 15 && allNews.mock === true, `total=${allNews.total}`)
const macroNews = await source.news('macro', 20)
check('news 宏观过滤', macroNews.category === 'macro' && macroNews.total === 4, `total=${macroNews.total}`)
const relatedNews = await source.news(undefined, 20, '600519')
check('news 关联个股 600519', relatedNews.items.some(i => i.title.includes('贵州茅台')), JSON.stringify(relatedNews.items.map(i => i.title)))

// 16. 宏观经济指标（新增）
const cpi = await source.macro('cpi')
check('macro CPI', cpi.value === 0.5 && cpi.unit.includes('%') && cpi.mock === true, JSON.stringify(cpi))
const pmi = await source.macro('pmi_manufacturing')
check('macro 制造业PMI', pmi.value === 49.5 && pmi.name.includes('PMI'), JSON.stringify(pmi))
const gdp = await source.macro('gdp', '2026Q2')
check('macro GDP 自定义期', gdp.indicator === 'gdp' && gdp.period === '2026Q2' && gdp.yoy === 5.0, JSON.stringify(gdp))

// 17. 行业板块（新增）
const sec = await source.sector('cn', 'industry', 20)
check('sector 行业板块', sec.total === 15 && sec.items.length === 15 && sec.mock === true, `total=${sec.total}`)
const secTop = await source.sector('cn', 'industry', 5)
check('sector limit=5', secTop.items.length === 5, `len=${secTop.items.length}`)
check('sector 字段完整', sec.items.every(i => typeof i.changePct === 'number' && typeof i.leadingStock === 'string' && i.upCount >= 0), JSON.stringify(sec.items[0]))

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail === 0 ? 0 : 1)
