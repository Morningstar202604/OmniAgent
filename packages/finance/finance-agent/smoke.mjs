/**
 * finance-agent 数据源冒烟测试：直接调用数据源契约，验证 mock 数据端到端。
 * （工具注册层由单包 tsc 类型检查验证；tsdown 打包产物在本沙箱无法生成）
 * 运行: node packages/finance/finance-agent/smoke.mjs
 */
import { createSource, parseMarket } from './lib/types/source.js'

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

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail === 0 ? 0 : 1)
