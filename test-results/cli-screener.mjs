/**
 * CLI 实测：直接调用 finance_screener 工具（经 buildFinanceTools 注册的工具实例），
 * 验证多条件筛选结果正确、公式可复核。运行：
 *   node test-results/cli-screener.mjs
 */
import { createSource } from '../packages/finance/finance-agent/lib/types/source.js'
import { buildFinanceTools } from '../packages/finance/finance-agent/lib/types/tools.js'

const source = createSource({ source: 'mock' })
const tools = buildFinanceTools(source)
const screener = tools.find((t) => t.name === 'finance_screener')
if (screener === undefined) throw new Error('未找到 finance_screener 工具')

// 工具 execute 的签名：(args) => Promise<value>，部分实现第二参为 context。
async function run(args) {
  const out = await screener.execute(args, {})
  return out
}

const fmtRow = (r) =>
  `  ${r.symbol.padEnd(7)} ${r.name.padEnd(10)} ${r.industry.padEnd(6)} ` +
  `价${String(r.price).padStart(9)} 涨跌${String(r.changePct).padStart(6)}% ` +
  `PE${String(r.pe).padStart(6)} PB${String(r.pb).padStart(6)} ROE${String(r.roe).padStart(6)}%`

const cases = [
  { name: '用例1：A股 + PE≤20 + ROE≥12%（价值成长）', args: { market: 'cn', maxPe: 20, minRoe: 12 } },
  { name: '用例2：低估值 破净/低PE（PB≤1.5 且 PE≤10）', args: { maxPb: 1.5, maxPe: 10 } },
  { name: '用例3：今日强势（涨幅≥2%）', args: { minChangePct: 2 } },
  { name: '用例4：半导体行业全部', args: { industry: '半导体' } },
  { name: '用例5：港股市值大于1万亿', args: { market: 'hk', minMarketCap: 1e12 } },
  { name: '用例6：空条件（全池）', args: {} },
]

let pass = 0, fail = 0
for (const c of cases) {
  const r = await run(c.args)
  console.log(`\n=== ${c.name} ===`)
  console.log(`  公式：${r.formula}`)
  console.log(`  命中 ${r.total} / 股票池 ${r.poolSize} 只`)
  console.log(r.items.length === 0 ? '  （无命中）' : r.items.map(fmtRow).join('\n'))
  // 断言
  const ok = r.items.every((it) => {
    if (c.args.market !== undefined && it.market !== c.args.market) return false
    if (c.args.industry !== undefined && it.industry !== c.args.industry) return false
    if (c.args.maxPe !== undefined && it.pe > c.args.maxPe) return false
    if (c.args.minRoe !== undefined && it.roe < c.args.minRoe) return false
    if (c.args.maxPb !== undefined && it.pb > c.args.maxPb) return false
    if (c.args.minChangePct !== undefined && it.changePct < c.args.minChangePct) return false
    if (c.args.minMarketCap !== undefined && it.marketCap < c.args.minMarketCap) return false
    return true
  })
  if (ok && r.total === r.items.length) { pass++; console.log('  ✅ 断言通过：所有命中行均满足条件') }
  else { fail++; console.log('  ❌ 断言失败') }
}
console.log(`\nCLI 实测结果：${pass} 通过 / ${fail} 失败`)
process.exit(fail === 0 ? 0 : 1)
