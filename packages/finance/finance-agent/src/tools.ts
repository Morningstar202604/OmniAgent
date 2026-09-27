/**
 * 金融工具集：行情、财务、估值、选股四个模型可调用工具。
 * 所有工具只依赖 {@link FinanceDataSource} 契约，与具体数据源解耦。
 * @module @deepseek-ai/dsh-finance-agent/src/tools
 */

import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'
import type {
  FinanceDataSource,
  FinanceKlinePeriod,
  FinanceAnnouncementCategory,
  FinanceNewsCategory,
  FinanceMacroIndicator,
  FinanceSectorCategory,
} from './source.ts'
import { parseMarket } from './source.ts'
import { compoundFutureValue, compoundPresentValue, loanPayment, annualizedReturn, dividendDiscountValue, computeIndicator } from './calc.ts'
import { runBacktest, type BacktestResult } from './backtest.ts'
import { generateQuantCode } from './quant.ts'

/** 稳定的错误提示（数据源未配置/失败时给模型可行动的指引）。 */
function dataSourceError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error)
  return new Error(`finance 数据源调用失败：${message}。若使用 http 数据源，请确认已配置 baseURL 与 apiKeyEnv；未配置时可改用 source: mock 体验示例数据。`)
}

/** 数字字段的可选化处理（数据源可能缺字段）。 */
function num(value: number | null | undefined): number | undefined {
  return value === null || value === undefined ? undefined : value
}

/** 构建十七个金融工具定义。 */
export function buildFinanceTools(source: FinanceDataSource): ToolDefinition[] {
  const quote: ToolDefinition = defineTool({
    name: 'finance_quote',
    description: '查询股票/指数/ETF 的实时行情（最新价、涨跌幅、成交量、市值等）。市场：cn=沪深 A 股，hk=港股，us=美股。',
    parameters: {
      symbol: { type: 'string', required: true, description: '证券代码，如 600519（A 股）、0700（港股）、AAPL（美股）' },
      market: { type: 'string', enum: ['cn', 'hk', 'us'], description: '市场，默认 cn' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          symbol: { type: 'string', required: true },
          name: { type: 'string', required: true },
          market: { type: 'string', required: true },
          price: { type: 'number', required: true },
          change: { type: 'number', required: true },
          changePct: { type: 'number', required: true },
          open: { type: 'number', required: true },
          high: { type: 'number', required: true },
          low: { type: 'number', required: true },
          volume: { type: 'number', required: true },
          turnover: { type: 'number', required: true },
          marketCap: { type: 'number', required: true },
          currency: { type: 'string', required: true },
          updatedAt: { type: 'string', required: true },
          mock: { oneOf: [{ type: 'boolean' }, { type: 'null' }], required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: [
          `${value.symbol} ${value.name}（${value.market === 'cn' ? 'A股' : value.market === 'hk' ? '港股' : '美股'}）`,
          `最新价 ${value.price} ${value.currency}，涨跌 ${value.change}（${value.changePct}%），`,
          `今开 ${value.open}，最高 ${value.high}，最低 ${value.low}，成交量 ${value.volume}，成交额 ${value.turnover}，市值 ${value.marketCap}`,
          `更新时间 ${value.updatedAt}${value.mock === true ? '（示例数据）' : ''}`,
        ].join('\n'),
      }],
    },
    async execute(args: { symbol: string; market?: string }) {
      try {
        const market = parseMarket(args.market)
        const q = await source.quote(args.symbol, market); return { ...q, mock: q.mock === true ? true : null }
      } catch (error) {
        throw dataSourceError(error)
      }
    },
  })

  const financials: ToolDefinition = defineTool({
    name: 'finance_financials',
    description: '查询上市公司核心财务数据（营收、净利润、毛利率、净利率、ROE、资产负债率、EPS）。',
    parameters: {
      symbol: { type: 'string', required: true, description: '证券代码，如 600519、AAPL' },
      market: { type: 'string', enum: ['cn', 'hk', 'us'], description: '市场，默认 cn' },
      year: { type: 'number', description: '报告年份（如 2025），默认最近年度' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          symbol: { type: 'string', required: true },
          name: { type: 'string', required: true },
          market: { type: 'string', required: true },
          year: { type: 'number', required: true },
          revenue: { type: 'number', required: true },
          netProfit: { type: 'number', required: true },
          grossMargin: { type: 'number', required: true },
          netMargin: { type: 'number', required: true },
          roe: { type: 'number', required: true },
          debtRatio: { type: 'number', required: true },
          eps: { type: 'number', required: true },
          updatedAt: { type: 'string', required: true },
          mock: { oneOf: [{ type: 'boolean' }, { type: 'null' }], required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: [
          `${value.symbol} ${value.name}（${value.year} 年度）`,
          `营业收入 ${value.revenue}，净利润 ${value.netProfit}，`,
          `毛利率 ${value.grossMargin}%，净利率 ${value.netMargin}%，ROE ${value.roe}%，资产负债率 ${value.debtRatio}%，EPS ${value.eps}`,
          `更新时间 ${value.updatedAt}${value.mock === true ? '（示例数据）' : ''}`,
        ].join('\n'),
      }],
    },
    async execute(args: { symbol: string; market?: string; year?: number }) {
      try {
        const market = parseMarket(args.market)
        const f = await source.financials(args.symbol, market, args.year); return { ...f, mock: f.mock === true ? true : null }
      } catch (error) {
        throw dataSourceError(error)
      }
    },
  })

  const metrics: ToolDefinition = defineTool({
    name: 'finance_metrics',
    description: '查询估值与技术指标（PE、PB、PS、股息率、52 周高低、市值）。',
    parameters: {
      symbol: { type: 'string', required: true, description: '证券代码，如 600519、AAPL' },
      market: { type: 'string', enum: ['cn', 'hk', 'us'], description: '市场，默认 cn' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          symbol: { type: 'string', required: true },
          name: { type: 'string', required: true },
          market: { type: 'string', required: true },
          pe: { type: 'number', required: true },
          pb: { type: 'number', required: true },
          ps: { type: 'number', required: true },
          dividendYield: { type: 'number', required: true },
          week52High: { type: 'number', required: true },
          week52Low: { type: 'number', required: true },
          marketCap: { type: 'number', required: true },
          updatedAt: { type: 'string', required: true },
          mock: { oneOf: [{ type: 'boolean' }, { type: 'null' }], required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: [
          `${value.symbol} ${value.name}`,
          `PE ${value.pe}，PB ${value.pb}，PS ${value.ps}，股息率 ${value.dividendYield}%，`,
          `52 周区间 ${value.week52Low} ~ ${value.week52High}，市值 ${value.marketCap}`,
          `更新时间 ${value.updatedAt}${value.mock === true ? '（示例数据）' : ''}`,
        ].join('\n'),
      }],
    },
    async execute(args: { symbol: string; market?: string }) {
      try {
        const market = parseMarket(args.market)
        const m = await source.metrics(args.symbol, market); return { ...m, mock: m.mock === true ? true : null }
      } catch (error) {
        throw dataSourceError(error)
      }
    },
  })

  const screener: ToolDefinition = defineTool({
    name: 'finance_screener',
    description: '多因子选股：按市场/行业/市值/PE/PB/ROE/当日涨跌幅等条件确定性筛选股票，输出可复核表格（含筛选公式与命中数）。基于内置示例股票池（30 只）纯 TS 过滤，结果可逐只对照复核；接真实数据源后替换为全市场扫描。',
    parameters: {
      market: { type: 'string', enum: ['cn', 'hk', 'us'], description: '市场，默认全部市场（不限制）' },
      industry: { type: 'string', description: '行业名称，如 食品饮料、银行、新能源、半导体、互联网' },
      minMarketCap: { type: 'number', description: '最小市值（元），如 5e11=5000 亿' },
      maxMarketCap: { type: 'number', description: '最大市值（元）' },
      minPe: { type: 'number', description: 'PE(TTM) 下限' },
      maxPe: { type: 'number', description: 'PE(TTM) 上限' },
      minPb: { type: 'number', description: 'PB 下限' },
      maxPb: { type: 'number', description: 'PB 上限' },
      minRoe: { type: 'number', description: 'ROE(%) 下限，如 15 表示 ROE≥15%' },
      minChangePct: { type: 'number', description: '当日涨跌幅(%) 下限' },
      maxChangePct: { type: 'number', description: '当日涨跌幅(%) 上限' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          poolSize: { type: 'number', required: true },
          total: { type: 'number', required: true },
          criteria: { type: 'object', additionalProperties: true, required: true },
          formula: { type: 'string', required: true },
          items: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                symbol: { type: 'string', required: true },
                name: { type: 'string', required: true },
                market: { type: 'string', required: true },
                industry: { type: 'string', required: true },
                price: { type: 'number', required: true },
                changePct: { type: 'number', required: true },
                pe: { type: 'number', required: true },
                pb: { type: 'number', required: true },
                roe: { type: 'number', required: true },
                marketCap: { type: 'number', required: true },
              },
            },
            required: true,
          },
          mock: { oneOf: [{ type: 'boolean' }, { type: 'null' }], required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: [
          `选股结果：从 ${value.poolSize} 只示例股票池中筛出 ${value.total} 只`,
          `筛选公式：${value.formula}`,
          ...(value.items.length === 0
            ? ['（无命中股票，可放宽条件）']
            : value.items.map((row: { symbol: string; name: string; market: string; industry: string; price: number; changePct: number; pe: number; pb: number; roe: number; marketCap: number }) => {
              const mktCapYi = row.marketCap >= 1e12 ? `${(row.marketCap / 1e12).toFixed(2)}万亿` : `${(row.marketCap / 1e8).toFixed(0)}亿`
              const pct = row.changePct > 0 ? `+${row.changePct}%` : `${row.changePct}%`
              return `- ${row.symbol} ${row.name}｜${row.industry}｜价 ${row.price}｜涨跌 ${pct}｜PE ${row.pe}｜PB ${row.pb}｜ROE ${row.roe}%｜市值 ${mktCapYi}`
            })),
          value.mock === true ? '（示例股票池数据，真实行情待接 host 数据源）' : '',
        ].filter((l: string) => l.length > 0).join('\n'),
      }],
    },
    async execute(args: {
      market?: string
      industry?: string
      minMarketCap?: number
      maxMarketCap?: number
      minPe?: number
      maxPe?: number
      minPb?: number
      maxPb?: number
      minRoe?: number
      minChangePct?: number
      maxChangePct?: number
    }) {
      try {
        const criteria: Record<string, string | number> = {}
        if (args.market !== undefined) criteria.market = parseMarket(args.market)
        if (args.industry !== undefined) criteria.industry = args.industry
        if (num(args.minMarketCap) !== undefined) criteria.minMarketCap = num(args.minMarketCap) as number
        if (num(args.maxMarketCap) !== undefined) criteria.maxMarketCap = num(args.maxMarketCap) as number
        if (num(args.minPe) !== undefined) criteria.minPe = num(args.minPe) as number
        if (num(args.maxPe) !== undefined) criteria.maxPe = num(args.maxPe) as number
        if (num(args.minPb) !== undefined) criteria.minPb = num(args.minPb) as number
        if (num(args.maxPb) !== undefined) criteria.maxPb = num(args.maxPb) as number
        if (num(args.minRoe) !== undefined) criteria.minRoe = num(args.minRoe) as number
        if (num(args.minChangePct) !== undefined) criteria.minChangePct = num(args.minChangePct) as number
        if (num(args.maxChangePct) !== undefined) criteria.maxChangePct = num(args.maxChangePct) as number
        const result = await source.screener({
          ...(args.market === undefined ? {} : { market: parseMarket(args.market) }),
          ...(args.industry === undefined ? {} : { industry: args.industry }),
          ...(num(args.minMarketCap) === undefined ? {} : { minMarketCap: num(args.minMarketCap) as number }),
          ...(num(args.maxMarketCap) === undefined ? {} : { maxMarketCap: num(args.maxMarketCap) as number }),
          ...(num(args.minPe) === undefined ? {} : { minPe: num(args.minPe) as number }),
          ...(num(args.maxPe) === undefined ? {} : { maxPe: num(args.maxPe) as number }),
          ...(num(args.minPb) === undefined ? {} : { minPb: num(args.minPb) as number }),
          ...(num(args.maxPb) === undefined ? {} : { maxPb: num(args.maxPb) as number }),
          ...(num(args.minRoe) === undefined ? {} : { minRoe: num(args.minRoe) as number }),
          ...(num(args.minChangePct) === undefined ? {} : { minChangePct: num(args.minChangePct) as number }),
          ...(num(args.maxChangePct) === undefined ? {} : { maxChangePct: num(args.maxChangePct) as number }),
        })
        return { ...result, criteria, mock: result.mock === true ? true : null }
      } catch (error) {
        throw dataSourceError(error)
      }
    },
  })

  const calc: ToolDefinition = defineTool({
    name: 'finance_calc',
    description: '金融计算器：复利终值/现值、贷款等额本息月供、年化收益率、股利折现内在价值。所有结果可复核（返回公式与中间值）。',
    parameters: {
      mode: { type: 'string', enum: ['compound_fv', 'compound_pv', 'loan', 'annual_return', 'ddm'], required: true, description: '计算类型：compound_fv=复利终值，compound_pv=复利现值，loan=贷款月供，annual_return=年化收益率，ddm=股利折现内在价值' },
      principal: { type: 'number', description: '本金/现值/贷款总额（loan、compound_fv、compound_pv 必填）' },
      rate: { type: 'number', description: '年利率（%，compound_fv/pv、loan 必填）' },
      years: { type: 'number', description: '年数（compound_fv/pv、annual_return 必填）' },
      months: { type: 'number', description: '月数（loan 必填）' },
      futureValue: { type: 'number', description: '终值（compound_pv、annual_return 必填）' },
      startValue: { type: 'number', description: '期初价值（annual_return 必填）' },
      dividend: { type: 'number', description: '预期每股股利 D1（ddm 必填）' },
      requiredReturn: { type: 'number', description: '必要收益率 k %（ddm 必填）' },
      growth: { type: 'number', description: '股利增长率 g %（ddm 必填）' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          mode: { type: 'string', required: true },
          formula: { type: 'string', required: true },
          result: { type: 'number', required: true },
          detail: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: `【${value.mode}】${value.detail}\n公式：${value.formula}\n结果：${value.result}`,
      }],
    },
    // oxlint-disable-next-line typescript/require-await -- 工具 execute 接口要求返回 Promise
    async execute(args: {
      mode: string
      principal?: number
      rate?: number
      years?: number
      months?: number
      futureValue?: number
      startValue?: number
      dividend?: number
      requiredReturn?: number
      growth?: number
    }) {
      const p = num(args.principal)
      const r = num(args.rate)
      switch (args.mode) {
        case 'compound_fv': {
          const pv = p ?? 0
          const rate = r ?? 0
          const years = num(args.years) ?? 0
          const result = compoundFutureValue(pv, rate, years)
          return { mode: args.mode, formula: `FV = ${pv} × (1 + ${rate}%)^${years}`, result, detail: `本金 ${pv}，年利率 ${rate}%，${years} 年后的终值` }
        }
        case 'compound_pv': {
          const fv = num(args.futureValue) ?? 0
          const rate = r ?? 0
          const years = num(args.years) ?? 0
          const result = compoundPresentValue(fv, rate, years)
          return { mode: args.mode, formula: `PV = ${fv} / (1 + ${rate}%)^${years}`, result, detail: `${years} 年后 ${fv} 按年利率 ${rate}% 折算的现值` }
        }
        case 'loan': {
          const principal = p ?? 0
          const rate = r ?? 0
          const months = num(args.months) ?? 0
          const result = loanPayment(principal, rate, months)
          return { mode: args.mode, formula: `PMT = ${principal} × r×(1+r)^${months} / ((1+r)^${months}−1)，r=${(rate / 12 / 100).toFixed(5)}`, result, detail: `贷款 ${principal}，年利率 ${rate}%，${months} 期等额本息月供` }
        }
        case 'annual_return': {
          const sv = num(args.startValue) ?? 0
          const fv = num(args.futureValue) ?? 0
          const years = num(args.years) ?? 1
          const result = annualizedReturn(sv, fv, years)
          return { mode: args.mode, formula: `年化收益 = (${fv}/${sv})^(1/${years}) − 1`, result, detail: `${sv} 经 ${years} 年增值到 ${fv} 的年化收益率` }
        }
        case 'ddm': {
          const d1 = num(args.dividend) ?? 0
          const k = num(args.requiredReturn) ?? 0
          const g = num(args.growth) ?? 0
          const result = dividendDiscountValue(d1, k, g)
          return { mode: args.mode, formula: `V = ${d1} / (${k}% − ${g}%)`, result, detail: `每股股利 ${d1}，必要收益率 ${k}%，增长率 ${g}% 的内在价值` }
        }
        default:
          throw new Error(`finance_calc: 未知计算模式 ${args.mode}`)
      }
    },
  })

  const technical: ToolDefinition = defineTool({
    name: 'finance_technical',
    description: '技术指标计算：SMA/EMA 均线、RSI 相对强弱、MACD、BOLL 布林带。传入收盘价数组（按时间升序）即可计算，无需数据源。',
    parameters: {
      prices: { type: 'array', items: { type: 'number' }, required: true, description: '收盘价序列（按时间从早到晚，至少 26 个）' },
      indicator: { type: 'string', enum: ['sma', 'ema', 'rsi', 'macd', 'boll'], required: true, description: '指标类型' },
      period: { type: 'number', description: '周期（sma/ema/rsi/boll 用，默认：sma=20、ema=12、rsi=14、boll=20）' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          indicator: { type: 'string', required: true },
          period: { type: 'number', required: true },
          latest: { type: 'object', additionalProperties: true, properties: {}, required: true },
          series: { type: 'array', items: { oneOf: [{ type: 'number' }, { type: 'null' }] }, required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: `【${value.indicator.toUpperCase()}】周期 ${value.period}\n最新值：${JSON.stringify(value.latest)}\n近期序列（末 5 个）：${JSON.stringify(value.series.slice(-5))}`,
      }],
    },
    // oxlint-disable-next-line typescript/require-await -- 工具 execute 接口要求返回 Promise
    async execute(args: { prices: number[]; indicator: string; period?: number }) {
      const prices = args.prices
      if (!Array.isArray(prices) || prices.length < 5) throw new Error('finance_technical: 价格序列至少需要 5 个数据')
      if (args.indicator !== 'sma' && args.indicator !== 'ema' && args.indicator !== 'rsi' && args.indicator !== 'macd' && args.indicator !== 'boll') {
        throw new Error(`finance_technical: 未知指标 ${args.indicator}`)
      }
      return computeIndicator(args.indicator, prices, args.period)
    },
  })

  const fx: ToolDefinition = defineTool({
    name: 'finance_fx',
    description: '查询汇率（主要货币对，base 兑 quote）。mock 数据源内置 USD/CNY、EUR/CNY、HKD/CNY、JPY/CNY、GBP/CNY、CNY/USD 示例。',
    parameters: {
      pair: { type: 'string', required: true, description: '货币对，如 USD/CNY、EUR/CNY' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          pair: { type: 'string', required: true },
          base: { type: 'string', required: true },
          quote: { type: 'string', required: true },
          rate: { type: 'number', required: true },
          inverse: { type: 'number', required: true },
          updatedAt: { type: 'string', required: true },
          mock: { oneOf: [{ type: 'boolean' }, { type: 'null' }], required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: `1 ${value.base} = ${value.rate} ${value.quote}（反向 1 ${value.quote} = ${value.inverse} ${value.base}）${value.mock === true ? '（示例数据）' : ''}`,
      }],
    },
    async execute(args: { pair: string }) {
      try {
        const row = await source.fx(args.pair)
        return { ...row, mock: row.mock === true ? true : null }
      } catch (error) {
        throw dataSourceError(error)
      }
    },
  })

  const rates: ToolDefinition = defineTool({
    name: 'finance_rates',
    description: '查询人民币利率：存款利率（deposit）、LPR 贷款市场报价利率（lpr）、国债收益率（bond）。mock 数据源内置示例利率。',
    parameters: {
      category: { type: 'string', enum: ['deposit', 'lpr', 'bond'], required: true, description: '利率类别' },
    },
    output: {
      schema: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            category: { type: 'string', required: true },
            name: { type: 'string', required: true },
            rate: { type: 'number', required: true },
            updatedAt: { type: 'string', required: true },
            mock: { oneOf: [{ type: 'boolean' }, { type: 'null' }], required: true },
          },
        },
      },
      render: (_args, value) => {
        const first = value[0]
        return [{
          type: 'text',
          text: value.length === 0 || first === undefined
            ? '未获取到利率数据'
            : `【${first.category === 'deposit' ? '存款利率' : first.category === 'lpr' ? 'LPR' : '国债收益率'}】\n` +
              value.map((row: { name: string; rate: number; mock: boolean | null }) => `- ${row.name}：${row.rate}%${row.mock === true ? '（示例数据）' : ''}`).join('\n'),
        }]
      },
    },
    async execute(args: { category: 'deposit' | 'lpr' | 'bond' }) {
      try {
        const rows = await source.rates(args.category)
        return rows.map((row) => ({ ...row, mock: row.mock === true ? true : null }))
      } catch (error) {
        throw dataSourceError(error)
      }
    },
  })

  const kline: ToolDefinition = defineTool({
    name: 'finance_kline',
    description: '查询股票/指数的历史K线（日K/周K/月K）。返回开高低收量额序列，可取出 close 数组配合 finance_technical 做技术分析。',
    parameters: {
      symbol: { type: 'string', required: true, description: '证券代码，如 600519、AAPL' },
      market: { type: 'string', enum: ['cn', 'hk', 'us'], description: '市场，默认 cn' },
      period: { type: 'string', enum: ['day', 'week', 'month'], description: 'K线周期，默认 day' },
      limit: { type: 'number', description: '返回条数，默认 30，最大 120' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          symbol: { type: 'string', required: true },
          name: { type: 'string', required: true },
          market: { type: 'string', required: true },
          period: { type: 'string', required: true },
          bars: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                date: { type: 'string', required: true },
                open: { type: 'number', required: true },
                high: { type: 'number', required: true },
                low: { type: 'number', required: true },
                close: { type: 'number', required: true },
                volume: { type: 'number', required: true },
                turnover: { type: 'number', required: true },
              },
            },
            required: true,
          },
          updatedAt: { type: 'string', required: true },
          mock: { oneOf: [{ type: 'boolean' }, { type: 'null' }], required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: [
          `${value.symbol} ${value.name} ${value.period === 'day' ? '日K' : value.period === 'week' ? '周K' : '月K'}（共 ${value.bars.length} 根）`,
          ...value.bars.slice(-5).map((bar: { date: string; open: number; high: number; low: number; close: number; volume: number }) =>
            `- ${bar.date} 开${bar.open} 高${bar.high} 低${bar.low} 收${bar.close} 量${bar.volume}`),
          `更新时间 ${value.updatedAt}${value.mock === true ? '（示例数据）' : ''}`,
        ].join('\n'),
      }],
    },
    async execute(args: { symbol: string; market?: string; period?: string; limit?: number }) {
      try {
        const market = parseMarket(args.market)
        const period: FinanceKlinePeriod = args.period === 'week' || args.period === 'month' ? args.period : 'day'
        const limit = num(args.limit) ?? 30
        const r = await source.kline(args.symbol, market, period, limit)
        return { ...r, mock: r.mock === true ? true : null }
      } catch (error) {
        throw dataSourceError(error)
      }
    },
  })

  const moneyflow: ToolDefinition = defineTool({
    name: 'finance_moneyflow',
    description: '查询个股资金流向：主力净流入、超大单/大单/中单/小单净额及主力净占比。',
    parameters: {
      symbol: { type: 'string', required: true, description: '证券代码，如 600519、AAPL' },
      market: { type: 'string', enum: ['cn', 'hk', 'us'], description: '市场，默认 cn' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          symbol: { type: 'string', required: true },
          name: { type: 'string', required: true },
          market: { type: 'string', required: true },
          mainNetInflow: { type: 'number', required: true },
          superLargeNet: { type: 'number', required: true },
          largeNet: { type: 'number', required: true },
          mediumNet: { type: 'number', required: true },
          smallNet: { type: 'number', required: true },
          mainNetInflowPct: { type: 'number', required: true },
          updatedAt: { type: 'string', required: true },
          mock: { oneOf: [{ type: 'boolean' }, { type: 'null' }], required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: [
          `${value.symbol} ${value.name} 资金流向`,
          `主力净流入 ${value.mainNetInflow} 元（占比 ${value.mainNetInflowPct}%），`,
          `超大单 ${value.superLargeNet}，大单 ${value.largeNet}，中单 ${value.mediumNet}，小单 ${value.smallNet}`,
          `更新时间 ${value.updatedAt}${value.mock === true ? '（示例数据）' : ''}`,
        ].join('\n'),
      }],
    },
    async execute(args: { symbol: string; market?: string }) {
      try {
        const market = parseMarket(args.market)
        const r = await source.moneyflow(args.symbol, market)
        return { ...r, mock: r.mock === true ? true : null }
      } catch (error) {
        throw dataSourceError(error)
      }
    },
  })

  const announcements: ToolDefinition = defineTool({
    name: 'finance_announcements',
    description: '查询上市公司近期公告列表（年报/季报/分红/重大事项等）。',
    parameters: {
      symbol: { type: 'string', required: true, description: '证券代码，如 600519、000858' },
      market: { type: 'string', enum: ['cn', 'hk', 'us'], description: '市场，默认 cn' },
      category: { type: 'string', enum: ['annual_report', 'quarterly_report', 'dividend', 'ma_equity_change', 'other'], description: '公告类别，默认全部' },
      limit: { type: 'number', description: '返回条数，默认 10' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          symbol: { type: 'string', required: true },
          name: { type: 'string', required: true },
          market: { type: 'string', required: true },
          total: { type: 'number', required: true },
          items: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string', required: true },
                title: { type: 'string', required: true },
                category: { type: 'string', required: true },
                publishDate: { type: 'string', required: true },
                url: { type: 'string', required: true },
                summary: { type: 'string', required: true },
              },
            },
            required: true,
          },
          updatedAt: { type: 'string', required: true },
          mock: { oneOf: [{ type: 'boolean' }, { type: 'null' }], required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.items.length === 0
          ? `${value.symbol} ${value.name} 暂无符合条件的公告`
          : `${value.symbol} ${value.name} 近期公告（共 ${value.total} 条，列出 ${value.items.length} 条）：\n` +
            value.items.map((item: { publishDate: string; title: string; summary: string }) => `- [${item.publishDate}] ${item.title}：${item.summary}`).join('\n') +
            `\n更新时间 ${value.updatedAt}${value.mock === true ? '（示例数据）' : ''}`,
      }],
    },
    async execute(args: { symbol: string; market?: string; category?: string; limit?: number }) {
      try {
        const market = parseMarket(args.market)
        const category: FinanceAnnouncementCategory | undefined =
          args.category === 'annual_report' || args.category === 'quarterly_report' || args.category === 'dividend' || args.category === 'ma_equity_change' || args.category === 'other'
            ? args.category
            : undefined
        const limit = num(args.limit) ?? 10
        const r = await source.announcements(args.symbol, market, category, limit)
        return { ...r, mock: r.mock === true ? true : null }
      } catch (error) {
        throw dataSourceError(error)
      }
    },
  })

  const news: ToolDefinition = defineTool({
    name: 'finance_news',
    description: '查询财经新闻/市场快讯（市场、宏观、公司、行业、政策），可按类别或关联个股过滤。',
    parameters: {
      category: { type: 'string', enum: ['market', 'macro', 'company', 'industry', 'policy'], description: '资讯类别，默认 market' },
      limit: { type: 'number', description: '返回条数，默认 10' },
      symbol: { type: 'string', description: '关联个股代码，仅返回提及该个股的资讯' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          category: { type: 'string', required: true },
          total: { type: 'number', required: true },
          items: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string', required: true },
                title: { type: 'string', required: true },
                source: { type: 'string', required: true },
                publishTime: { type: 'string', required: true },
                summary: { type: 'string', required: true },
                url: { type: 'string', required: true },
                tags: { type: 'array', items: { type: 'string' }, required: true },
              },
            },
            required: true,
          },
          updatedAt: { type: 'string', required: true },
          mock: { oneOf: [{ type: 'boolean' }, { type: 'null' }], required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.items.length === 0
          ? '未查询到相关财经资讯'
          : `财经资讯【${value.category}】（共 ${value.total} 条，列出 ${value.items.length} 条）：\n` +
            value.items.map((item: { publishTime: string; source: string; title: string; summary: string }) => `- [${item.publishTime} ${item.source}] ${item.title}：${item.summary}`).join('\n') +
            `\n更新时间 ${value.updatedAt}${value.mock === true ? '（示例数据）' : ''}`,
      }],
    },
    async execute(args: { category?: string; limit?: number; symbol?: string }) {
      try {
        const category: FinanceNewsCategory | undefined =
          args.category === 'market' || args.category === 'macro' || args.category === 'company' || args.category === 'industry' || args.category === 'policy'
            ? args.category
            : undefined
        const limit = num(args.limit) ?? 10
        const r = await source.news(category, limit, args.symbol)
        return { ...r, mock: r.mock === true ? true : null }
      } catch (error) {
        throw dataSourceError(error)
      }
    },
  })

  const macro: ToolDefinition = defineTool({
    name: 'finance_macro',
    description: '查询宏观经济指标最新值：GDP/CPI/PPI/制造业与非制造业PMI/M2/社融/进出口/失业率。',
    parameters: {
      indicator: { type: 'string', enum: ['gdp', 'cpi', 'ppi', 'pmi_manufacturing', 'pmi_non_manufacturing', 'm2', 'social_financing', 'trade_balance', 'unemployment'], required: true, description: '宏观指标' },
      period: { type: 'string', description: '报告期，如 2026-08 或 2026Q2，默认最新一期' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          indicator: { type: 'string', required: true },
          name: { type: 'string', required: true },
          period: { type: 'string', required: true },
          value: { type: 'number', required: true },
          unit: { type: 'string', required: true },
          yoy: { type: 'number', required: true },
          mom: { type: 'number', required: true },
          previousValue: { type: 'number', required: true },
          updatedAt: { type: 'string', required: true },
          mock: { oneOf: [{ type: 'boolean' }, { type: 'null' }], required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: [
          `${value.name}（${value.indicator}）`,
          `${value.period}：${value.value} ${value.unit}，同比 ${value.yoy}%，环比 ${value.mom}%，上期 ${value.previousValue}`,
          `更新时间 ${value.updatedAt}${value.mock === true ? '（示例数据）' : ''}`,
        ].join('\n'),
      }],
    },
    async execute(args: { indicator: string; period?: string }) {
      try {
        const valid: FinanceMacroIndicator[] = ['gdp', 'cpi', 'ppi', 'pmi_manufacturing', 'pmi_non_manufacturing', 'm2', 'social_financing', 'trade_balance', 'unemployment']
        if (!valid.includes(args.indicator as FinanceMacroIndicator)) {
          throw new Error(`finance_macro: 未知指标 ${args.indicator}`)
        }
        const r = await source.macro(args.indicator as FinanceMacroIndicator, args.period)
        return { ...r, mock: r.mock === true ? true : null }
      } catch (error) {
        throw dataSourceError(error)
      }
    },
  })

  const sector: ToolDefinition = defineTool({
    name: 'finance_sector',
    description: '查询行业板块/概念板块行情：涨跌幅、领涨股、成交额、PE、涨跌家数。',
    parameters: {
      market: { type: 'string', enum: ['cn', 'hk', 'us'], description: '市场，默认 cn' },
      category: { type: 'string', enum: ['industry', 'concept'], description: '板块类别，默认 industry' },
      limit: { type: 'number', description: '返回条数，默认 20' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          market: { type: 'string', required: true },
          category: { type: 'string', required: true },
          total: { type: 'number', required: true },
          items: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                name: { type: 'string', required: true },
                changePct: { type: 'number', required: true },
                leadingStock: { type: 'string', required: true },
                leadingStockChangePct: { type: 'number', required: true },
                turnover: { type: 'number', required: true },
                pe: { type: 'number', required: true },
                upCount: { type: 'number', required: true },
                downCount: { type: 'number', required: true },
              },
            },
            required: true,
          },
          updatedAt: { type: 'string', required: true },
          mock: { oneOf: [{ type: 'boolean' }, { type: 'null' }], required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: `【${value.category === 'industry' ? '行业板块' : '概念板块'}】共 ${value.total} 个，列出 ${value.items.length} 个：\n` +
          value.items.map((row: { name: string; changePct: number; leadingStock: string; leadingStockChangePct: number; upCount: number; downCount: number }) =>
            `- ${row.name} ${row.changePct}%（领涨 ${row.leadingStock} ${row.leadingStockChangePct}%，涨${row.upCount}/跌${row.downCount}）`).join('\n') +
          `\n更新时间 ${value.updatedAt}${value.mock === true ? '（示例数据）' : ''}`,
      }],
    },
    async execute(args: { market?: string; category?: string; limit?: number }) {
      try {
        const market = parseMarket(args.market)
        const category: FinanceSectorCategory = args.category === 'concept' ? 'concept' : 'industry'
        const limit = num(args.limit) ?? 20
        const r = await source.sector(market, category, limit)
        return { ...r, mock: r.mock === true ? true : null }
      } catch (error) {
        throw dataSourceError(error)
      }
    },
  })

  const risk: ToolDefinition = defineTool({
    name: 'finance_risk',
    description: '计算个股风险指标：Beta（相对基准指数）、年化夏普比率、最大回撤、年化波动率、VaR(95%/99% 历史模拟法)。基于收盘价序列本地纯计算，返回公式与中间值，可复核。',
    parameters: {
      symbol: { type: 'string', required: true, description: '证券代码，如 600519、AAPL' },
      market: { type: 'string', enum: ['cn', 'hk', 'us'], description: '市场，默认 cn' },
      benchmark: { type: 'string', description: '基准指数代码，默认 000300（沪深300）；其他常用：000001 上证指数、399001 深证成指、HSI 恒生指数、SPX 标普500、IXIC 纳斯达克' },
      riskFreeRate: { type: 'number', description: '年化无风险利率（%），默认 2.0' },
      period: { type: 'number', description: '回溯交易日天数，默认 60，范围 20-250' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          symbol: { type: 'string', required: true },
          name: { type: 'string', required: true },
          market: { type: 'string', required: true },
          benchmark: { type: 'string', required: true },
          benchmarkName: { type: 'string', required: true },
          beta: { type: 'number', required: true },
          sharpe: { type: 'number', required: true },
          maxDrawdown: { type: 'number', required: true },
          annualVolatility: { type: 'number', required: true },
          var95: { type: 'number', required: true },
          var99: { type: 'number', required: true },
          formula: { type: 'string', required: true },
          details: {
            type: 'object',
            additionalProperties: false,
            properties: {
              avgDailyReturn: { type: 'number', required: true },
              dailyVolatility: { type: 'number', required: true },
              covStockBench: { type: 'number', required: true },
              varBench: { type: 'number', required: true },
              peakPrice: { type: 'number', required: true },
              troughPrice: { type: 'number', required: true },
              returnCount: { type: 'number', required: true },
            },
            required: true,
          },
          updatedAt: { type: 'string', required: true },
          mock: { oneOf: [{ type: 'boolean' }, { type: 'null' }], required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: [
          `${value.symbol} ${value.name} 风险指标（基准：${value.benchmarkName}，回溯${_args.period ?? 60}日）`,
          `Beta ${value.beta}，夏普 ${value.sharpe}，最大回撤 ${value.maxDrawdown}%`,
          `年化波动率 ${value.annualVolatility}%，VaR(95%) ${value.var95}%，VaR(99%) ${value.var99}%`,
          `公式：${value.formula}`,
          `更新时间 ${value.updatedAt}${value.mock === true ? '（示例数据）' : ''}`,
        ].join('\n'),
      }],
    },
    async execute(args: { symbol: string; market?: string; benchmark?: string; riskFreeRate?: number; period?: number }) {
      try {
        const market = parseMarket(args.market)
        const benchmark = args.benchmark ?? '000300'
        const riskFreeRate = num(args.riskFreeRate) ?? 2.0
        const period = num(args.period) ?? 60
        const r = await source.risk(args.symbol, market, benchmark, riskFreeRate, period)
        return { ...r, mock: r.mock === true ? true : null }
      } catch (error) {
        throw dataSourceError(error)
      }
    },
  })

  const fund: ToolDefinition = defineTool({
    name: 'finance_fund',
    description: '查询固收资产数据：公募基金（fund，净值/涨跌/规模/经理）、债券（bond，国债收益率曲线与企业债/城投债，票面利率/到期收益率/久期/评级）、可转债（convertible，正股/转股价/转股价值/溢价率/余额）。不填 symbol 返回该类别列表，填 symbol 返回单只资产。',
    parameters: {
      category: { type: 'string', enum: ['fund', 'bond', 'convertible'], required: true, description: '资产类别：fund=基金，bond=债券，convertible=可转债' },
      symbol: { type: 'string', description: '具体资产代码，如 510300（基金）、CNBOND10Y（国债）、110059（可转债）；不填则返回该类别列表' },
      limit: { type: 'number', description: '返回条数，默认 10，最大 50' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          category: { type: 'string', required: true },
          total: { type: 'number', required: true },
          items: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                code: { type: 'string', required: true },
                name: { type: 'string', required: true },
                category: { type: 'string', required: true },
                type: { type: 'string', required: true },
                fundType: { type: 'string' },
                nav: { type: 'number' },
                navAccumulated: { type: 'number' },
                dailyChangePct: { type: 'number' },
                change1m: { type: 'number' },
                change1y: { type: 'number' },
                scale: { type: 'number' },
                manager: { type: 'string' },
                couponRate: { type: 'number' },
                yieldToMaturity: { type: 'number' },
                duration: { type: 'number' },
                rating: { type: 'string' },
                maturityDate: { type: 'string' },
                issuer: { type: 'string' },
                underlyingStock: { type: 'string' },
                underlyingStockName: { type: 'string' },
                conversionPrice: { type: 'number' },
                conversionValue: { type: 'number' },
                premiumRate: { type: 'number' },
                outstandingBalance: { type: 'number' },
                updatedAt: { type: 'string', required: true },
              },
            },
            required: true,
          },
          updatedAt: { type: 'string', required: true },
          mock: { oneOf: [{ type: 'boolean' }, { type: 'null' }], required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: [
          `${value.category === 'fund' ? '公募基金' : value.category === 'bond' ? '债券' : '可转债'}数据（共 ${value.total} 条）`,
          ...value.items.map((item: {
            code: string; name: string; category: string; type: string
            nav?: number; dailyChangePct?: number; change1m?: number; change1y?: number; scale?: number; manager?: string
            couponRate?: number; yieldToMaturity?: number; duration?: number; rating?: string; issuer?: string; maturityDate?: string
            underlyingStockName?: string; conversionPrice?: number; conversionValue?: number; premiumRate?: number; outstandingBalance?: number
          }) => {
            if (item.category === 'fund') {
              return `- ${item.code} ${item.name}（${item.type}）净值 ${item.nav}，日涨跌 ${item.dailyChangePct}%，近1月 ${item.change1m}%，近1年 ${item.change1y}%，规模 ${item.scale}亿，经理 ${item.manager}`
            }
            if (item.category === 'convertible') {
              return `- ${item.code} ${item.name}（${item.type}）正股 ${item.underlyingStockName}，转股价 ${item.conversionPrice}，转股价值 ${item.conversionValue}，溢价率 ${item.premiumRate}%，余额 ${item.outstandingBalance}亿`
            }
            const coupon = typeof item.couponRate === 'number' ? `票面 ${item.couponRate}%，` : ''
            return `- ${item.code} ${item.name}（${item.type}）${coupon}YTM ${item.yieldToMaturity}%，久期 ${item.duration}年，评级 ${item.rating}，发行人 ${item.issuer}，到期 ${item.maturityDate}`
          }),
          `更新时间 ${value.updatedAt}${value.mock === true ? '（示例数据）' : ''}`,
        ].join('\n'),
      }],
    },
    async execute(args: { category: string; symbol?: string; limit?: number }) {
      try {
        if (args.category !== 'fund' && args.category !== 'bond' && args.category !== 'convertible') {
          throw new Error(`finance_fund: category 必须是 fund/bond/convertible 之一，收到 "${args.category}"`)
        }
        const category = args.category
        const limit = Math.min(num(args.limit) ?? 10, 50)
        const r = await source.fund(category, args.symbol, limit)
        return { ...r, mock: r.mock === true ? true : null }
      } catch (error) {
        throw dataSourceError(error)
      }
    },
  })

  const research: ToolDefinition = defineTool({
    name: 'finance_research',
    description: '查询个股券商研报摘要（标题、机构、分析师、评级、目标价、报告日期、核心观点）。摘要级输出，不提供全文，仅供参考、不构成投资建议。',
    parameters: {
      symbol: { type: 'string', required: true, description: '证券代码，如 600519、000858、AAPL、0700' },
      market: { type: 'string', enum: ['cn', 'hk', 'us'], description: '市场，默认 cn' },
      limit: { type: 'number', description: '返回条数，默认 5，最大 20' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          symbol: { type: 'string', required: true },
          name: { type: 'string', required: true },
          market: { type: 'string', required: true },
          total: { type: 'number', required: true },
          items: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string', required: true },
                title: { type: 'string', required: true },
                institution: { type: 'string', required: true },
                analyst: { type: 'string', required: true },
                rating: { type: 'string', required: true },
                targetPrice: { type: 'number', required: true },
                reportDate: { type: 'string', required: true },
                summary: { type: 'string', required: true },
                url: { type: 'string', required: true },
              },
            },
            required: true,
          },
          updatedAt: { type: 'string', required: true },
          mock: { oneOf: [{ type: 'boolean' }, { type: 'null' }], required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.items.length === 0
          ? `${value.symbol} ${value.name} 暂无券商研报摘要`
          : `${value.symbol} ${value.name} 券商研报（共 ${value.total} 条）\n` +
            value.items.map((item: { rating: string; title: string; institution: string; analyst: string; reportDate: string; targetPrice: number; summary: string }) =>
              `- [${item.rating}] ${item.title}（${item.institution}，${item.analyst}，${item.reportDate}）目标价 ${item.targetPrice}\n  摘要：${item.summary}`).join('\n') +
            `\n更新时间 ${value.updatedAt}${value.mock === true ? '（示例数据，摘要仅供参考，不构成投资建议）' : ''}`,
      }],
    },
    async execute(args: { symbol: string; market?: string; limit?: number }) {
      try {
        const market = parseMarket(args.market)
        const limit = Math.min(num(args.limit) ?? 5, 20)
        const r = await source.research(args.symbol, market, limit)
        return { ...r, mock: r.mock === true ? true : null }
      } catch (error) {
        throw dataSourceError(error)
      }
    },
  })

  // ─────────── 选股回测引擎 ───────────
  const backtest: ToolDefinition = defineTool({
    name: 'finance_backtest',
    description: '对股票/指数历史日K线执行策略回测，输出累计收益、年化收益、最大回撤、夏普比率、胜率、交易明细与净值曲线。支持双均线交叉（dual_ma）与定投（dca）两种策略。计算为纯本地确定性计算，公式透明可复核。数据为示例/mock 时会标注。',
    parameters: {
      symbols: { type: 'array', required: true, items: { type: 'string' }, description: '标的代码列表，如 ["600519","000858"]；多标的时资金等额分配、独立回测后汇总' },
      market: { type: 'string', enum: ['cn', 'hk', 'us'], description: '市场，默认 cn' },
      strategy: { type: 'string', enum: ['dual_ma', 'dca'], description: '策略：dual_ma=双均线交叉，dca=定期定额定投，默认 dual_ma' },
      shortWindow: { type: 'number', description: 'dual_ma 短期均线窗口（交易日），默认 5' },
      longWindow: { type: 'number', description: 'dual_ma 长期均线窗口（交易日），默认 20；dca 下作为回看窗口' },
      period: { type: 'number', description: '回测交易日数（约 250≈1年），默认 250，最大 280' },
      initialCash: { type: 'number', description: '初始资金（元），默认 1000000' },
      feeRatePct: { type: 'number', description: '单边手续费率（百分数，如 0.03=万三），默认 0.03，买卖双边各收一次' },
      positionPct: { type: 'number', description: 'dual_ma 每次开仓使用现金比例（0~1），默认 1.0 满仓' },
      dcaInterval: { type: 'number', description: 'dca 定投间隔（交易日），默认 20' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          strategy: { type: 'string', required: true },
          startDate: { type: 'string', required: true },
          endDate: { type: 'string', required: true },
          tradingDays: { type: 'number', required: true },
          initialCash: { type: 'number', required: true },
          finalEquity: { type: 'number', required: true },
          totalReturnPct: { type: 'number', required: true },
          annualizedReturnPct: { type: 'number', required: true },
          maxDrawdownPct: { type: 'number', required: true },
          sharpeRatio: { type: 'number', required: true },
          winRatePct: { oneOf: [{ type: 'number' }, { type: 'null' }], required: true },
          tradeCount: { type: 'number', required: true },
          profitFactor: { oneOf: [{ type: 'number' }, { type: 'null' }], required: true },
          perSymbol: {
            type: 'array', required: true,
            items: {
              type: 'object', additionalProperties: false,
              properties: {
                symbol: { type: 'string', required: true },
                name: { type: 'string', required: true },
                totalReturnPct: { type: 'number', required: true },
                finalEquity: { type: 'number', required: true },
                tradeCount: { type: 'number', required: true },
              },
            },
          },
          recentTrades: { type: 'array', required: true, items: { type: 'object', additionalProperties: false, properties: {
            symbol: { type: 'string', required: true }, date: { type: 'string', required: true }, action: { type: 'string', required: true },
            price: { type: 'number', required: true }, shares: { type: 'number', required: true }, amount: { type: 'number', required: true }, fee: { type: 'number', required: true },
          } } },
          formulas: { type: 'array', required: true, items: { type: 'string' } },
          mock: { oneOf: [{ type: 'boolean' }, { type: 'null' }], required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: [
          `回测结果（${value.strategy === 'dual_ma' ? '双均线交叉' : '定投'}）区间 ${value.startDate} ~ ${value.endDate}，共 ${value.tradingDays} 个交易日`,
          `累计收益率 ${value.totalReturnPct}%，年化 ${value.annualizedReturnPct}%，最大回撤 ${value.maxDrawdownPct}%，夏普 ${value.sharpeRatio}`,
          `胜率 ${value.winRatePct === null ? '—（无平仓回合）' : `${value.winRatePct}%`}，交易次数 ${value.tradeCount}，盈亏比 ${value.profitFactor === null ? '—' : value.profitFactor}`,
          `初始资金 ${value.initialCash} → 期末权益 ${value.finalEquity}`,
          ...value.perSymbol.map((s: { symbol: string; name: string; totalReturnPct: number; finalEquity: number; tradeCount: number }) =>
            `  ${s.symbol} ${s.name}：收益 ${s.totalReturnPct}%，期末 ${s.finalEquity}，交易 ${s.tradeCount} 笔`),
          ...(value.recentTrades.length > 0 ? ['最近成交：', ...value.recentTrades.slice(-8).map((t: { symbol: string; date: string; action: string; price: number; shares: number }) =>
            `  ${t.date} ${t.symbol} ${t.action === 'buy' ? '买入' : '卖出'} ${t.shares}股 @ ${t.price}`)] : []),
          '公式：', ...value.formulas.map((f: string) => `  - ${f}`),
          value.mock === true ? '（示例/mock 数据回测结果，不可用于真实投资决策）' : '',
        ].filter((l: string) => l.length > 0).join('\n'),
      }],
    },
    async execute(args: { symbols: string[]; market?: string; strategy?: string; shortWindow?: number; longWindow?: number; period?: number; initialCash?: number; feeRatePct?: number; positionPct?: number; dcaInterval?: number }) {
      try {
        const market = parseMarket(args.market)
        const symbols = args.symbols.map((s) => s.trim()).filter((s) => s.length > 0)
        if (symbols.length === 0) throw new Error('finance_backtest: symbols 至少需要 1 个标的代码')
        const strategy = args.strategy === 'dca' ? 'dca' as const : 'dual_ma' as const
        const longWindow = Math.max(2, Math.round(num(args.longWindow) ?? 20))
        const shortWindow = Math.max(1, Math.round(num(args.shortWindow) ?? 5))
        if (shortWindow >= longWindow) throw new Error(`短期窗口(${shortWindow})必须小于长期窗口(${longWindow})`)
        const period = Math.max(30, Math.min(Math.round(num(args.period) ?? 250), 280))
        const initialCash = num(args.initialCash) ?? 1_000_000
        const feeRate = (num(args.feeRatePct) ?? 0.03) / 100
        const positionPct = Math.min(1, Math.max(0.01, num(args.positionPct) ?? 1))
        const dcaInterval = Math.max(1, Math.round(num(args.dcaInterval) ?? 20))

        // 取数：period 个回测日 + longWindow 个指标预热日。
        const fetchLimit = period + longWindow + 10
        const subCash = initialCash / symbols.length

        const perSymbol: { symbol: string; name: string; totalReturnPct: number; finalEquity: number; tradeCount: number; result: BacktestResult }[] = []
        const allTrades: { symbol: string; date: string; action: string; price: number; shares: number; amount: number; fee: number }[] = []
        let anyMock = false
        // 汇总净值曲线（按交易日对齐求和）。
        const aggEquity: number[] = []
        let startDate = ''
        let endDate = ''

        for (const symbol of symbols) {
          const r = await source.kline(symbol, market, 'day', fetchLimit)
          if (r.mock === true) anyMock = true
          // 仅取最后 period 根作为回测窗口（前面为预热）。
          const window = r.bars.slice(-period)
          const result = runBacktest(window, {
            strategy,
            initialCash: subCash,
            feeRate,
            shortWindow,
            longWindow,
            positionPct,
            dcaInterval,
            dcaAmount: subCash / 12,
          })
          perSymbol.push({ symbol, name: r.name, totalReturnPct: result.totalReturnPct, finalEquity: result.finalEquity, tradeCount: result.tradeCount, result })
          for (const t of result.trades) allTrades.push({ symbol, ...t })
          // 汇总净值（按索引对齐）。
          result.equityCurve.forEach((p, i) => {
            aggEquity[i] = (aggEquity[i] ?? 0) + p.equity
          })
          if (startDate === '') startDate = result.startDate
          endDate = result.endDate
        }

        // 汇总指标基于合并净值曲线。
        const finalEquity = aggEquity[aggEquity.length - 1] as number
        const totalReturnPct = (finalEquity - initialCash) / initialCash * 100
        const tradingDays = aggEquity.length
        const years = tradingDays / 252
        const annualizedReturnPct = years > 0 ? (Math.pow(finalEquity / initialCash, 1 / years) - 1) * 100 : 0
        let peak = aggEquity[0] as number
        let mdd = 0
        for (const v of aggEquity) { if (v > peak) peak = v; const dd = (v - peak) / peak; if (dd < mdd) mdd = dd }
        // 夏普（基于合并净值日收益）。
        let sharpe = 0
        if (tradingDays >= 21) {
          const rets: number[] = []
          for (let i = 1; i < aggEquity.length; i++) {
            const prev = aggEquity[i - 1] as number
            const curr = aggEquity[i] as number
            rets.push((curr - prev) / prev)
          }
          const n = rets.length
          const mean = rets.reduce((a, b) => a + b, 0) / n
          const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)
          const vol = Math.sqrt(variance) * Math.sqrt(252)
          sharpe = vol > 0 ? (mean * 252 - 0.02) / vol : 0
        }

        const firstResult = perSymbol[0]?.result
        return {
          strategy,
          startDate,
          endDate,
          tradingDays,
          initialCash,
          finalEquity: Math.round(finalEquity * 100) / 100,
          totalReturnPct: Math.round(totalReturnPct * 100) / 100,
          annualizedReturnPct: Math.round(annualizedReturnPct * 100) / 100,
          maxDrawdownPct: Math.round(mdd * 10000) / 100,
          sharpeRatio: Math.round(sharpe * 100) / 100,
          winRatePct: firstResult?.winRatePct ?? null,
          tradeCount: allTrades.length,
          profitFactor: firstResult?.profitFactor ?? null,
          perSymbol: perSymbol.map(({ result: _r, ...rest }) => rest),
          recentTrades: allTrades.slice(-50),
          formulas: firstResult?.formulas ?? [],
          mock: anyMock ? true : null,
        }
      } catch (error) {
        throw dataSourceError(error)
      }
    },
  })

  // ─────────── 自然语言 → 量化策略代码 ───────────
  const quantCode: ToolDefinition = defineTool({
    name: 'finance_quant_code',
    description: '将用户自然语言描述的策略转换为可执行的量化策略代码（Python，backtrader 风格）+ 参数说明 + 风险提示。支持均线交叉、RSI 超买超卖、布林带突破、动量、定投五种模板。生成代码与 finance_backtest 口径一致，可对照复核。',
    parameters: {
      template: { type: 'string', required: true, enum: ['ma_cross', 'rsi', 'boll', 'momentum', 'dca'], description: '策略模板：ma_cross=均线交叉，rsi=超买超卖，boll=布林带突破，momentum=动量，dca=定投' },
      symbol: { type: 'string', description: '标的代码，用于代码注释，默认 600519' },
      shortWindow: { type: 'number', description: '短期/快速窗口，默认 5' },
      longWindow: { type: 'number', description: '长期/慢速窗口（RSI 周期/布林周期/动量回看），默认 20' },
      rsiOverbought: { type: 'number', description: 'RSI 超买阈值，默认 70' },
      rsiOversold: { type: 'number', description: 'RSI 超卖阈值，默认 30' },
      positionPct: { type: 'number', description: '单次开仓仓位比例（0~1），默认 1.0' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          template: { type: 'string', required: true },
          templateName: { type: 'string', required: true },
          code: { type: 'string', required: true },
          params: { type: 'array', required: true, items: { type: 'object', additionalProperties: false, properties: {
            name: { type: 'string', required: true }, value: { oneOf: [{ type: 'number' }, { type: 'string' }], required: true }, description: { type: 'string', required: true },
          } } },
          warnings: { type: 'array', required: true, items: { type: 'string' } },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: [
          `策略代码生成：${value.templateName}（${value.template}）`,
          '```python',
          value.code,
          '```',
          '参数：', ...value.params.map((p: { name: string; value: number | string; description: string }) => `  - ${p.name} = ${p.value}（${p.description}）`),
          '风险提示：', ...value.warnings.map((w: string) => `  - ${w}`),
        ].join('\n'),
      }],
    },
    // oxlint-disable-next-line typescript/require-await -- 工具 execute 接口要求返回 Promise
    async execute(args: { template: string; symbol?: string; shortWindow?: number; longWindow?: number; rsiOverbought?: number; rsiOversold?: number; positionPct?: number }) {
      const allowed = ['ma_cross', 'rsi', 'boll', 'momentum', 'dca']
      if (!allowed.includes(args.template)) {
        throw new Error(`finance_quant_code: template 必须是 ${allowed.join('/')} 之一，收到 "${args.template}"`)
      }
      return generateQuantCode({
        template: args.template as 'ma_cross' | 'rsi' | 'boll' | 'momentum' | 'dca',
        symbol: args.symbol ?? '600519',
        shortWindow: Math.max(1, Math.round(num(args.shortWindow) ?? 5)),
        longWindow: Math.max(2, Math.round(num(args.longWindow) ?? 20)),
        rsiOverbought: num(args.rsiOverbought) ?? 70,
        rsiOversold: num(args.rsiOversold) ?? 30,
        positionPct: Math.min(1, Math.max(0.01, num(args.positionPct) ?? 1)),
      })
    },
  })

  return [quote, financials, metrics, screener, calc, technical, fx, rates, kline, moneyflow, announcements, news, macro, sector, risk, fund, research, backtest, quantCode]
}
