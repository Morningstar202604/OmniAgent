/**
 * 金融工具集：行情、财务、估值、选股四个模型可调用工具。
 * 所有工具只依赖 {@link FinanceDataSource} 契约，与具体数据源解耦。
 * @module @deepseek-ai/dsh-finance-agent/src/tools
 */

import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { FinanceDataSource, FinanceMarket } from './source.ts'
import { parseMarket } from './source.ts'

/** 稳定的错误提示（数据源未配置/失败时给模型可行动的指引）。 */
function dataSourceError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error)
  return new Error(`finance 数据源调用失败：${message}。若使用 http 数据源，请确认已配置 baseURL 与 apiKeyEnv；未配置时可改用 source: mock 体验示例数据。`)
}

/** 数字字段的可选化处理（数据源可能缺字段）。 */
function num(value: number | null | undefined): number | undefined {
  return value === null || value === undefined ? undefined : value
}

/** 构建四个金融工具定义。 */
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

  return [quote, financials, metrics, screener]
}
