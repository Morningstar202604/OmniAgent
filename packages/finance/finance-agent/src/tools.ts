/**
 * 金融工具集：行情、财务、估值、选股四个模型可调用工具。
 * 所有工具只依赖 {@link FinanceDataSource} 契约，与具体数据源解耦。
 * @module @deepseek-ai/dsh-finance-agent/src/tools
 */

import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { FinanceDataSource, FinanceMarket } from './source.ts'
import { parseMarket } from './source.ts'
import { compoundFutureValue, compoundPresentValue, loanPayment, annualizedReturn, dividendDiscountValue, computeIndicator } from './calc.ts'

/** 稳定的错误提示（数据源未配置/失败时给模型可行动的指引）。 */
function dataSourceError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error)
  return new Error(`finance 数据源调用失败：${message}。若使用 http 数据源，请确认已配置 baseURL 与 apiKeyEnv；未配置时可改用 source: mock 体验示例数据。`)
}

/** 数字字段的可选化处理（数据源可能缺字段）。 */
function num(value: number | null | undefined): number | undefined {
  return value === null || value === undefined ? undefined : value
}

/** 构建八个金融工具定义。 */
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
    description: '按条件筛选股票（市场、行业、市值区间、PE 上限、当日涨幅下限）。',
    parameters: {
      market: { type: 'string', enum: ['cn', 'hk', 'us'], description: '市场，默认 cn' },
      industry: { type: 'string', description: '行业名称，如 食品饮料、科技硬件' },
      minMarketCap: { type: 'number', description: '最小市值（元）' },
      maxMarketCap: { type: 'number', description: '最大市值（元）' },
      maxPe: { type: 'number', description: 'PE 上限' },
      minChangePct: { type: 'number', description: '当日涨幅下限（%）' },
    },
    output: {
      schema: {
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
            marketCap: { type: 'number', required: true },
          },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.length === 0
          ? '未找到符合筛选条件的股票'
          : `筛选到 ${value.length} 只股票：\n` + value.map((row: { symbol: string; name: string; market: string; industry: string; price: number; changePct: number; pe: number }) =>
            `- ${row.symbol} ${row.name}（${row.market}）行业:${row.industry} 价:${row.price} 涨跌:${row.changePct}% PE:${row.pe}`).join('\n'),
      }],
    },
    async execute(args: {
      market?: string
      industry?: string
      minMarketCap?: number
      maxMarketCap?: number
      maxPe?: number
      minChangePct?: number
    }) {
      try {
        return await source.screener({
          market: parseMarket(args.market) as FinanceMarket,
          ...(args.industry === undefined ? {} : { industry: args.industry }),
          ...(num(args.minMarketCap) === undefined ? {} : { minMarketCap: num(args.minMarketCap) as number }),
          ...(num(args.maxMarketCap) === undefined ? {} : { maxMarketCap: num(args.maxMarketCap) as number }),
          ...(num(args.maxPe) === undefined ? {} : { maxPe: num(args.maxPe) as number }),
          ...(num(args.minChangePct) === undefined ? {} : { minChangePct: num(args.minChangePct) as number }),
        })
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

  return [quote, financials, metrics, screener, calc, technical, fx, rates]
}
