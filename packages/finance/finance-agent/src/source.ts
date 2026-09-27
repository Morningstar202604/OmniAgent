/**
 * 金融数据源适配层：定义统一的数据契约，内置两种实现——
 *  - `mock`：内置示例数据（演示/无 key 验证，数据明确标注为示例）
 *  - `http`：可配置的 HTTP JSON 数据源（对接任意行情/财务接口服务）
 *
 * 产品化后可在同一接口下增加更多数据源（交易所直连、聚源/Wind 类终端、
 * 自建聚合服务等），对工具层完全透明。
 * @module @deepseek-ai/dsh-finance-agent/src/source
 */

import { dailyReturns, betaCoefficient, sharpeRatio, maxDrawdown, annualVolatility, historicalVaR } from './calc.ts'

/** 市场代码：cn=中国大陆 A 股，hk=香港，us=美股。 */
export type FinanceMarket = 'cn' | 'hk' | 'us'

/** 实时行情。 */
export interface FinanceQuote {
  symbol: string
  name: string
  market: FinanceMarket
  price: number
  change: number
  changePct: number
  open: number
  high: number
  low: number
  volume: number
  turnover: number
  marketCap: number
  currency: string
  updatedAt: string
  /** 示例数据标记（source=mock 时为 true）。 */
  mock?: boolean
}

/** 上市公司财务数据。 */
export interface FinanceFinancials {
  symbol: string
  name: string
  market: FinanceMarket
  year: number
  revenue: number
  netProfit: number
  grossMargin: number
  netMargin: number
  roe: number
  debtRatio: number
  eps: number
  updatedAt: string
  mock?: boolean
}

/** 估值与技术指标。 */
export interface FinanceMetrics {
  symbol: string
  name: string
  market: FinanceMarket
  pe: number
  pb: number
  ps: number
  dividendYield: number
  week52High: number
  week52Low: number
  marketCap: number
  updatedAt: string
  mock?: boolean
}

/** 选股筛选条件（全部可选，未传表示不限制；均为闭区间）。 */
export interface ScreenerFilter {
  market?: FinanceMarket
  industry?: string
  /** 最小市值（元）。 */
  minMarketCap?: number
  /** 最大市值（元）。 */
  maxMarketCap?: number
  /** PE(TTM) 下限。 */
  minPe?: number
  /** PE(TTM) 上限。 */
  maxPe?: number
  /** PB 下限。 */
  minPb?: number
  /** PB 上限。 */
  maxPb?: number
  /** ROE(%) 下限。 */
  minRoe?: number
  /** 当日涨跌幅(%) 下限。 */
  minChangePct?: number
  /** 当日涨跌幅(%) 上限。 */
  maxChangePct?: number
}

/** 选股结果行：每只入选股票的核心指标，可与示例股票池逐只复核。 */
export interface ScreenerRow {
  symbol: string
  name: string
  market: FinanceMarket
  industry: string
  price: number
  changePct: number
  pe: number
  pb: number
  roe: number
  marketCap: number
}

/**
 * 选股结果：回显筛选条件 + 可读公式 + 命中行。
 * poolSize 为本次扫描的股票池总数，total 为命中数，便于复核「从 N 只里筛出 M 只」。
 */
export interface ScreenerResult {
  /** 本次扫描的股票池总数。 */
  poolSize: number
  /** 命中条件的股票数。 */
  total: number
  /** 回显本次实际生效的筛选条件。 */
  criteria: ScreenerFilter
  /** 人类可读的筛选公式（闭区间描述），用于复核。 */
  formula: string
  /** 命中股票列表（按市值降序）。 */
  items: ScreenerRow[]
  mock?: boolean
}

/** 汇率。pair 形如 USD/CNY（base 兑 quote，rate=1 base 兑多少 quote）。 */
export interface FinanceFxRate {
  pair: string
  base: string
  quote: string
  rate: number
  /** 反向汇率（1 quote 兑多少 base）。 */
  inverse: number
  updatedAt: string
  mock?: boolean
}

/** 利率类别：deposit=存款利率，lpr=贷款市场报价利率，bond=国债收益率。 */
export type FinanceRateCategory = 'deposit' | 'lpr' | 'bond'

/** 利率报价。 */
export interface FinanceRateQuote {
  category: FinanceRateCategory
  /** 期限/品种名，如 活期、一年、5Y-LPR、10Y 国债。 */
  name: string
  /** 年化利率（百分数数值，如 0.35、3.45）。 */
  rate: number
  updatedAt: string
  mock?: boolean
}

/** K线单根 bar（开高低收量额）。 */
export interface FinanceKlineBar {
  /** 交易日期，如 2026-09-24。 */
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  turnover: number
}

/** K线周期：day=日K，week=周K，month=月K。 */
export type FinanceKlinePeriod = 'day' | 'week' | 'month'

/** 历史K线查询结果。 */
export interface FinanceKlineResult {
  symbol: string
  name: string
  market: FinanceMarket
  period: FinanceKlinePeriod
  bars: FinanceKlineBar[]
  updatedAt: string
  mock?: boolean
}

/** 个股资金流向（金额单位：元）。 */
export interface FinanceMoneyflow {
  symbol: string
  name: string
  market: FinanceMarket
  /** 主力净流入（超大单+大单，元）。 */
  mainNetInflow: number
  /** 超大单净额（元）。 */
  superLargeNet: number
  /** 大单净额（元）。 */
  largeNet: number
  /** 中单净额（元）。 */
  mediumNet: number
  /** 小单净额（元）。 */
  smallNet: number
  /** 主力净占比（%）。 */
  mainNetInflowPct: number
  updatedAt: string
  mock?: boolean
}

/** 公告类别：annual_report=年报，quarterly_report=季报，dividend=分红，ma_equity_change=重大事项/股权变动，other=其他。 */
export type FinanceAnnouncementCategory = 'annual_report' | 'quarterly_report' | 'dividend' | 'ma_equity_change' | 'other'

/** 单条公司公告。 */
export interface FinanceAnnouncementItem {
  id: string
  title: string
  category: FinanceAnnouncementCategory
  publishDate: string
  /** 公告原文链接（无则空串）。 */
  url: string
  summary: string
}

/** 公司公告列表结果。 */
export interface FinanceAnnouncementResult {
  symbol: string
  name: string
  market: FinanceMarket
  total: number
  items: FinanceAnnouncementItem[]
  updatedAt: string
  mock?: boolean
}

/** 资讯类别：market=市场快讯，macro=宏观，company=公司，industry=行业，policy=政策。 */
export type FinanceNewsCategory = 'market' | 'macro' | 'company' | 'industry' | 'policy'

/** 单条财经资讯。 */
export interface FinanceNewsItem {
  id: string
  title: string
  source: string
  publishTime: string
  summary: string
  url: string
  tags: string[]
}

/** 财经资讯列表结果。 */
export interface FinanceNewsResult {
  category: FinanceNewsCategory
  total: number
  items: FinanceNewsItem[]
  updatedAt: string
  mock?: boolean
}

/** 宏观经济指标枚举。 */
export type FinanceMacroIndicator =
  | 'gdp'
  | 'cpi'
  | 'ppi'
  | 'pmi_manufacturing'
  | 'pmi_non_manufacturing'
  | 'm2'
  | 'social_financing'
  | 'trade_balance'
  | 'unemployment'

/** 宏观经济指标最新值。 */
export interface FinanceMacro {
  indicator: FinanceMacroIndicator
  /** 指标中文名。 */
  name: string
  /** 报告期，如 2026-08 或 2026Q2。 */
  period: string
  value: number
  /** 单位，如 %、万亿元、亿美元。 */
  unit: string
  /** 同比（%，无则 0）。 */
  yoy: number
  /** 环比（%，无则 0）。 */
  mom: number
  /** 上期值。 */
  previousValue: number
  updatedAt: string
  mock?: boolean
}

/** 板块类别：industry=行业板块，concept=概念板块。 */
export type FinanceSectorCategory = 'industry' | 'concept'

/** 单个行业/概念板块行情。 */
export interface FinanceSectorItem {
  name: string
  /** 当日涨跌幅（%）。 */
  changePct: number
  /** 领涨股名称。 */
  leadingStock: string
  /** 领涨股涨跌幅（%）。 */
  leadingStockChangePct: number
  /** 板块成交额（元）。 */
  turnover: number
  /** 板块市盈率（TTM）。 */
  pe: number
  /** 上涨家数。 */
  upCount: number
  /** 下跌家数。 */
  downCount: number
}

/** 板块行情列表结果。 */
export interface FinanceSectorResult {
  market: FinanceMarket
  category: FinanceSectorCategory
  total: number
  items: FinanceSectorItem[]
  updatedAt: string
  mock?: boolean
}

/** 个股风险指标中间计算值。 */
export interface FinanceRiskDetails {
  /** 平均日收益率（小数）。 */
  avgDailyReturn: number
  /** 日收益率波动率（样本标准差，小数）。 */
  dailyVolatility: number
  /** 个股与基准日收益率样本协方差。 */
  covStockBench: number
  /** 基准日收益率样本方差。 */
  varBench: number
  /** 回溯区间内最高收盘价。 */
  peakPrice: number
  /** 回溯区间内最低收盘价。 */
  troughPrice: number
  /** 参与计算的日收益率个数。 */
  returnCount: number
}

/** 个股风险指标结果（Beta/夏普/最大回撤/年化波动率/VaR）。 */
export interface FinanceRiskResult {
  symbol: string
  name: string
  market: FinanceMarket
  /** 基准指数代码。 */
  benchmark: string
  /** 基准指数名称，如 沪深300。 */
  benchmarkName: string
  /** Beta 系数（相对基准）。 */
  beta: number
  /** 年化夏普比率。 */
  sharpe: number
  /** 最大回撤（负数百分比，如 -15.23）。 */
  maxDrawdown: number
  /** 年化波动率（%）。 */
  annualVolatility: number
  /** 95% 置信度单日 VaR（历史模拟法，负数百分比）。 */
  var95: number
  /** 99% 置信度单日 VaR（历史模拟法，负数百分比）。 */
  var99: number
  /** 各指标公式汇总（分号分隔）。 */
  formula: string
  /** 中间计算值。 */
  details: FinanceRiskDetails
  updatedAt: string
  mock?: boolean
}

/** 固收资产类别：fund=公募基金，bond=债券（国债收益率/信用债），convertible=可转债。 */
export type FinanceFundCategory = 'fund' | 'bond' | 'convertible'

/**
 * 固收资产统一条目：按 category 填充不同字段。
 * code/name/category/type/updatedAt 必填，其余字段随类别出现。
 */
export interface FinanceFundItem {
  /** 资产代码（如 510300、110059、CNBOND10Y）。 */
  code: string
  /** 资产名称。 */
  name: string
  /** 所属类别，同外层 category。 */
  category: FinanceFundCategory
  /** 子类型：fund=股票型/债券型/混合型/货币型/指数型/ETF；bond=国债收益率/企业债/城投债；convertible=可转债。 */
  type: string
  // —— 基金字段（category=fund 时填充）——
  /** 基金类型：股票型/债券型/混合型/货币型/指数型/ETF。 */
  fundType?: string
  /** 最新净值。 */
  nav?: number
  /** 累计净值。 */
  navAccumulated?: number
  /** 日涨跌（%）。 */
  dailyChangePct?: number
  /** 近1月涨跌（%）。 */
  change1m?: number
  /** 近1年涨跌（%）。 */
  change1y?: number
  /** 基金规模（亿元）。 */
  scale?: number
  /** 基金经理。 */
  manager?: string
  // —— 债券字段（category=bond/convertible 时填充）——
  /** 票面利率（%）。 */
  couponRate?: number
  /** 到期收益率（%）。 */
  yieldToMaturity?: number
  /** 久期（年）。 */
  duration?: number
  /** 信用评级（如 AAA/AA+/AA）。 */
  rating?: string
  /** 到期日（YYYY-MM-DD）。 */
  maturityDate?: string
  /** 发行人。 */
  issuer?: string
  // —— 可转债字段（category=convertible 时填充）——
  /** 正股代码。 */
  underlyingStock?: string
  /** 正股名称。 */
  underlyingStockName?: string
  /** 转股价。 */
  conversionPrice?: number
  /** 转股价值（=100/转股价×正股价）。 */
  conversionValue?: number
  /** 溢价率（%，=转债价/转股价值-1）。 */
  premiumRate?: number
  /** 余额（亿元）。 */
  outstandingBalance?: number
  /** 更新时间。 */
  updatedAt: string
}

/** 固收资产列表查询结果（基金/债券/可转债统一结构）。 */
export interface FinanceFundResult {
  category: FinanceFundCategory
  total: number
  items: FinanceFundItem[]
  updatedAt: string
  mock?: boolean
}

/** 券商研报评级。 */
export type FinanceResearchRating = '买入' | '增持' | '持有' | '卖出'

/** 单条券商研报摘要（版权敏感：仅摘要级，不提供全文）。 */
export interface FinanceResearchItem {
  /** 研报ID，如 R600519001。 */
  id: string
  title: string
  /** 券商机构名。 */
  institution: string
  analyst: string
  rating: FinanceResearchRating
  /** 目标价。 */
  targetPrice: number
  /** 报告日期 YYYY-MM-DD。 */
  reportDate: string
  /** 核心观点摘要（2-3 句）。 */
  summary: string
  /** 研报链接（无则空串）。 */
  url: string
}

/** 券商研报列表结果（摘要级）。 */
export interface FinanceResearchResult {
  symbol: string
  name: string
  market: FinanceMarket
  total: number
  items: FinanceResearchItem[]
  updatedAt: string
  mock?: boolean
}

/** 数据源统一接口：工具层只依赖本契约。 */
export interface FinanceDataSource {
  quote(symbol: string, market: FinanceMarket): Promise<FinanceQuote>
  financials(symbol: string, market: FinanceMarket, year?: number): Promise<FinanceFinancials>
  metrics(symbol: string, market: FinanceMarket): Promise<FinanceMetrics>
  screener(filter: ScreenerFilter): Promise<ScreenerResult>
  fx(pair: string): Promise<FinanceFxRate>
  rates(category: FinanceRateCategory): Promise<FinanceRateQuote[]>
  kline(symbol: string, market: FinanceMarket, period: FinanceKlinePeriod, limit: number): Promise<FinanceKlineResult>
  moneyflow(symbol: string, market: FinanceMarket): Promise<FinanceMoneyflow>
  announcements(symbol: string, market: FinanceMarket, category: FinanceAnnouncementCategory | undefined, limit: number): Promise<FinanceAnnouncementResult>
  news(category: FinanceNewsCategory | undefined, limit: number, symbol?: string): Promise<FinanceNewsResult>
  macro(indicator: FinanceMacroIndicator, period?: string): Promise<FinanceMacro>
  sector(market: FinanceMarket, category: FinanceSectorCategory, limit: number): Promise<FinanceSectorResult>
  risk(symbol: string, market: FinanceMarket, benchmark: string, riskFreeRate: number, period: number): Promise<FinanceRiskResult>
  fund(category: FinanceFundCategory, symbol?: string, limit?: number): Promise<FinanceFundResult>
  research(symbol: string, market: FinanceMarket, limit: number): Promise<FinanceResearchResult>
}

/** 校验市场参数合法性（工具层统一入口）。 */
export function parseMarket(value: string | undefined, fallback: FinanceMarket = 'cn'): FinanceMarket {
  const market = value ?? fallback
  if (market !== 'cn' && market !== 'hk' && market !== 'us') {
    throw new Error(`market 必须是 cn/hk/us 之一，收到 "${market}"`)
  }
  return market
}

/** 从模式串解析市场列表（用于 screener 的 market 多选）。 */
export function parseMarkets(value: string[] | undefined): FinanceMarket[] {
  if (value === undefined || value.length === 0) return ['cn']
  return value.map((item) => parseMarket(item))
}

/** 读取环境变量 key（跨实现复用）。 */
export function envKey(name: string): string | undefined {
  return process.env[name]
}

// ───────────────────────────── mock 实现 ─────────────────────────────

const MOCK_QUOTES: Record<string, Omit<FinanceQuote, 'mock'>> = {
  '600519': { symbol: '600519', name: '贵州茅台', market: 'cn', price: 1688.0, change: 12.5, changePct: 0.75, open: 1675.0, high: 1695.0, low: 1668.0, volume: 31200, turnover: 5.26e9, marketCap: 2.12e12, currency: 'CNY', updatedAt: '2026-09-24T15:00:00+08:00' },
  '000858': { symbol: '000858', name: '五粮液', market: 'cn', price: 128.6, change: -1.4, changePct: -1.08, open: 130.2, high: 130.8, low: 127.9, volume: 158400, turnover: 2.03e9, marketCap: 4.99e11, currency: 'CNY', updatedAt: '2026-09-24T15:00:00+08:00' },
  '601318': { symbol: '601318', name: '中国平安', market: 'cn', price: 52.3, change: 0.6, changePct: 1.16, open: 51.7, high: 52.6, low: 51.5, volume: 89200, turnover: 4.66e8, marketCap: 9.56e11, currency: 'CNY', updatedAt: '2026-09-24T15:00:00+08:00' },
  'AAPL': { symbol: 'AAPL', name: 'Apple Inc.', market: 'us', price: 232.5, change: 1.2, changePct: 0.52, open: 231.0, high: 233.8, low: 230.4, volume: 45210000, turnover: 1.05e10, marketCap: 3.54e12, currency: 'USD', updatedAt: '2026-09-23T20:00:00+00:00' },
  '0700': { symbol: '0700', name: '腾讯控股', market: 'hk', price: 468.2, change: -3.8, changePct: -0.81, open: 472.0, high: 473.5, low: 466.0, volume: 12100000, turnover: 5.67e9, marketCap: 4.31e12, currency: 'HKD', updatedAt: '2026-09-24T16:00:00+08:00' },
  // —— 市场指数（price=点位，volume=亿手/亿股，turnover=亿元，marketCap=万亿元）——
  '000001': { symbol: '000001', name: '上证指数', market: 'cn', price: 3125.60, change: 15.20, changePct: 0.49, open: 3110.00, high: 3132.50, low: 3105.20, volume: 4.5, turnover: 4500, marketCap: 48.5, currency: 'CNY', updatedAt: '2026-09-24T15:00:00+08:00' },
  '399001': { symbol: '399001', name: '深证成指', market: 'cn', price: 9856.30, change: 45.60, changePct: 0.46, open: 9810.00, high: 9880.50, low: 9795.20, volume: 5.8, turnover: 5800, marketCap: 35.2, currency: 'CNY', updatedAt: '2026-09-24T15:00:00+08:00' },
  '000300': { symbol: '000300', name: '沪深300', market: 'cn', price: 3680.50, change: 18.30, changePct: 0.50, open: 3662.00, high: 3695.80, low: 3658.20, volume: 3.2, turnover: 3200, marketCap: 42.8, currency: 'CNY', updatedAt: '2026-09-24T15:00:00+08:00' },
  '399006': { symbol: '399006', name: '创业板指', market: 'cn', price: 1985.20, change: -12.50, changePct: -0.63, open: 1998.00, high: 2005.50, low: 1978.30, volume: 2.1, turnover: 2100, marketCap: 12.6, currency: 'CNY', updatedAt: '2026-09-24T15:00:00+08:00' },
  'HSI': { symbol: 'HSI', name: '恒生指数', market: 'hk', price: 17856.30, change: 125.60, changePct: 0.71, open: 17730.00, high: 17920.50, low: 17700.20, volume: 1.28, turnover: 1280, marketCap: 28.5, currency: 'HKD', updatedAt: '2026-09-24T15:00:00+08:00' },
  'IXIC': { symbol: 'IXIC', name: '纳斯达克', market: 'us', price: 16850.20, change: 185.30, changePct: 1.11, open: 16665.00, high: 16890.50, low: 16650.20, volume: 5.2, turnover: 5200, marketCap: 45.8, currency: 'USD', updatedAt: '2026-09-23T20:00:00+00:00' },
  'SPX': { symbol: 'SPX', name: '标普500', market: 'us', price: 5420.80, change: 28.50, changePct: 0.53, open: 5392.00, high: 5435.50, low: 5385.20, volume: 3.8, turnover: 3800, marketCap: 52.3, currency: 'USD', updatedAt: '2026-09-23T20:00:00+00:00' },
  'DJI': { symbol: 'DJI', name: '道琼斯', market: 'us', price: 39850.60, change: 156.20, changePct: 0.39, open: 39694.00, high: 39920.50, low: 39650.20, volume: 2.8, turnover: 2800, marketCap: 48.6, currency: 'USD', updatedAt: '2026-09-23T20:00:00+00:00' },
}

const MOCK_FINANCIALS: Record<string, Omit<FinanceFinancials, 'mock'>> = {
  '600519': { symbol: '600519', name: '贵州茅台', market: 'cn', year: 2025, revenue: 1.74e11, netProfit: 8.62e10, grossMargin: 91.2, netMargin: 49.6, roe: 33.8, debtRatio: 19.5, eps: 68.6, updatedAt: '2026-04-01T00:00:00+08:00' },
  '000858': { symbol: '000858', name: '五粮液', market: 'cn', year: 2025, revenue: 8.91e10, netProfit: 3.01e10, grossMargin: 75.4, netMargin: 33.8, roe: 24.1, debtRatio: 22.8, eps: 7.76, updatedAt: '2026-04-01T00:00:00+08:00' },
  '601318': { symbol: '601318', name: '中国平安', market: 'cn', year: 2025, revenue: 1.03e12, netProfit: 1.18e11, grossMargin: 12.6, netMargin: 11.4, roe: 13.5, debtRatio: 88.7, eps: 6.5, updatedAt: '2026-04-01T00:00:00+08:00' },
  '0700': { symbol: '0700', name: '腾讯控股', market: 'hk', year: 2025, revenue: 7.52e11, netProfit: 1.62e11, grossMargin: 50.8, netMargin: 21.5, roe: 28.4, debtRatio: 41.2, eps: 17.4, updatedAt: '2026-04-01T00:00:00+08:00' },
  'AAPL': { symbol: 'AAPL', name: 'Apple Inc.', market: 'us', year: 2025, revenue: 4.16e11, netProfit: 1.03e11, grossMargin: 46.2, netMargin: 24.8, roe: 156.3, debtRatio: 82.4, eps: 6.68, updatedAt: '2025-10-30T00:00:00+00:00' },
}

const MOCK_METRICS: Record<string, Omit<FinanceMetrics, 'mock'>> = {
  '600519': { symbol: '600519', name: '贵州茅台', market: 'cn', pe: 24.6, pb: 8.3, ps: 12.2, dividendYield: 2.9, week52High: 1742.0, week52Low: 1285.0, marketCap: 2.12e12, updatedAt: '2026-09-24T15:00:00+08:00' },
  '000858': { symbol: '000858', name: '五粮液', market: 'cn', pe: 16.6, pb: 4.0, ps: 5.6, dividendYield: 3.4, week52High: 158.0, week52Low: 105.0, marketCap: 4.99e11, updatedAt: '2026-09-24T15:00:00+08:00' },
  '601318': { symbol: '601318', name: '中国平安', market: 'cn', pe: 8.0, pb: 1.1, ps: 0.9, dividendYield: 4.8, week52High: 62.0, week52Low: 41.5, marketCap: 9.56e11, updatedAt: '2026-09-24T15:00:00+08:00' },
  '0700': { symbol: '0700', name: '腾讯控股', market: 'hk', pe: 27.3, pb: 4.5, ps: 5.8, dividendYield: 0.8, week52High: 521.0, week52Low: 348.0, marketCap: 4.31e12, updatedAt: '2026-09-24T16:00:00+08:00' },
  'AAPL': { symbol: 'AAPL', name: 'Apple Inc.', market: 'us', pe: 34.8, pb: 54.0, ps: 8.5, dividendYield: 0.4, week52High: 241.2, week52Low: 164.0, marketCap: 3.54e12, updatedAt: '2026-09-23T20:00:00+00:00' },
}

/**
 * 选股示例股票池（30 只，覆盖 A 股 / 港股 / 美股，跨行业）。
 * PE/PB/ROE/涨跌幅/市值均为演示用确定性数值，分布刻意拉开，便于多条件筛选复核。
 * 后续接真实数据源后，本池由 source.screener 实时结果替代。
 */
const MOCK_SCREENER_UNIVERSE: ScreenerRow[] = [
  // —— A 股 ——
  { symbol: '600519', name: '贵州茅台', market: 'cn', industry: '食品饮料', price: 1688.0, changePct: 0.75, pe: 24.6, pb: 8.3, roe: 33.8, marketCap: 2.12e12 },
  { symbol: '000858', name: '五粮液', market: 'cn', industry: '食品饮料', price: 128.6, changePct: -1.08, pe: 16.6, pb: 4.0, roe: 24.1, marketCap: 4.99e11 },
  { symbol: '601318', name: '中国平安', market: 'cn', industry: '非银金融', price: 52.3, changePct: 1.16, pe: 8.0, pb: 1.1, roe: 13.5, marketCap: 9.56e11 },
  { symbol: '600036', name: '招商银行', market: 'cn', industry: '银行', price: 38.4, changePct: 1.48, pe: 6.5, pb: 0.95, roe: 16.2, marketCap: 8.90e11 },
  { symbol: '600900', name: '长江电力', market: 'cn', industry: '公用事业', price: 27.8, changePct: 0.62, pe: 20.5, pb: 2.8, roe: 15.8, marketCap: 7.80e11 },
  { symbol: '600276', name: '恒瑞医药', market: 'cn', industry: '医药生物', price: 46.5, changePct: 1.22, pe: 42.3, pb: 6.1, roe: 12.4, marketCap: 2.90e11 },
  { symbol: '300750', name: '宁德时代', market: 'cn', industry: '新能源', price: 187.45, changePct: -1.68, pe: 21.3, pb: 4.2, roe: 18.6, marketCap: 8.26e11 },
  { symbol: '002594', name: '比亚迪', market: 'cn', industry: '汽车', price: 246.8, changePct: 1.95, pe: 23.5, pb: 3.6, roe: 20.1, marketCap: 6.80e11 },
  { symbol: '600030', name: '中信证券', market: 'cn', industry: '非银金融', price: 25.4, changePct: 2.10, pe: 15.2, pb: 1.3, roe: 9.8, marketCap: 3.40e11 },
  { symbol: '601899', name: '紫金矿业', market: 'cn', industry: '有色金属', price: 17.9, changePct: 3.42, pe: 11.8, pb: 3.2, roe: 22.5, marketCap: 5.20e11 },
  { symbol: '601012', name: '隆基绿能', market: 'cn', industry: '新能源', price: 18.6, changePct: -2.35, pe: 18.9, pb: 1.8, roe: 8.5, marketCap: 1.70e11 },
  { symbol: '000333', name: '美的集团', market: 'cn', industry: '家用电器', price: 68.2, changePct: 0.92, pe: 13.6, pb: 2.9, roe: 22.8, marketCap: 4.10e11 },
  { symbol: '002415', name: '海康威视', market: 'cn', industry: '电子', price: 31.5, changePct: -0.58, pe: 20.1, pb: 3.4, roe: 17.2, marketCap: 2.90e11 },
  { symbol: '600031', name: '三一重工', market: 'cn', industry: '机械设备', price: 17.3, changePct: 2.05, pe: 14.2, pb: 1.7, roe: 11.3, marketCap: 2.30e11 },
  { symbol: '601888', name: '中国中免', market: 'cn', industry: '商贸零售', price: 68.9, changePct: -1.82, pe: 22.4, pb: 4.1, roe: 16.8, marketCap: 2.60e11 },
  { symbol: '600309', name: '万华化学', market: 'cn', industry: '基础化工', price: 71.4, changePct: 1.33, pe: 10.9, pb: 1.9, roe: 14.6, marketCap: 2.80e11 },
  { symbol: '601088', name: '中国神华', market: 'cn', industry: '煤炭', price: 39.6, changePct: 0.45, pe: 9.2, pb: 1.5, roe: 13.9, marketCap: 7.60e11 },
  { symbol: '600585', name: '海螺水泥', market: 'cn', industry: '建筑材料', price: 26.8, changePct: -0.92, pe: 7.8, pb: 0.75, roe: 6.2, marketCap: 1.50e11 },
  { symbol: '000063', name: '中兴通讯', market: 'cn', industry: '通信', price: 34.2, changePct: 2.76, pe: 16.8, pb: 1.6, roe: 10.5, marketCap: 1.60e11 },
  { symbol: '688981', name: '中芯国际', market: 'cn', industry: '半导体', price: 88.5, changePct: 4.05, pe: 58.4, pb: 3.9, roe: 6.8, marketCap: 4.60e11 },
  // —— 港股 ——
  { symbol: '0700', name: '腾讯控股', market: 'hk', industry: '互联网', price: 378.6, changePct: 1.12, pe: 18.4, pb: 3.6, roe: 28.4, marketCap: 3.52e12 },
  { symbol: '9988', name: '阿里巴巴-W', market: 'hk', industry: '互联网', price: 78.4, changePct: -0.95, pe: 12.6, pb: 1.9, roe: 11.2, marketCap: 2.30e12 },
  { symbol: '3690', name: '美团-W', market: 'hk', industry: '互联网', price: 118.2, changePct: 2.31, pe: 22.8, pb: 3.1, roe: 15.4, marketCap: 7.80e11 },
  // —— 美股 ——
  { symbol: 'AAPL', name: '苹果', market: 'us', industry: '科技硬件', price: 227.73, changePct: 1.39, pe: 33.1, pb: 58.2, roe: 156.3, marketCap: 3.47e12 },
  { symbol: 'MSFT', name: '微软', market: 'us', industry: '软件', price: 442.5, changePct: 0.85, pe: 36.5, pb: 12.8, roe: 38.2, marketCap: 3.10e12 },
  { symbol: 'NVDA', name: '英伟达', market: 'us', industry: '半导体', price: 138.4, changePct: 3.25, pe: 52.4, pb: 42.5, roe: 112.6, marketCap: 3.80e12 },
  { symbol: 'JPM', name: '摩根大通', market: 'us', industry: '银行', price: 224.6, changePct: 0.42, pe: 13.2, pb: 1.8, roe: 16.5, marketCap: 6.20e11 },
  { symbol: 'BRK-B', name: '伯克希尔B', market: 'us', industry: '综合金融', price: 472.8, changePct: 0.28, pe: 9.8, pb: 1.3, roe: 9.5, marketCap: 1.00e12 },
  // —— 补充：大行与港股消费电子，凑足 30 只并覆盖更多行业 ——
  { symbol: '601988', name: '中国银行', market: 'cn', industry: '银行', price: 4.92, changePct: 0.38, pe: 5.8, pb: 0.6, roe: 9.2, marketCap: 1.70e12 },
  { symbol: '1810', name: '小米集团-W', market: 'hk', industry: '消费电子', price: 23.5, changePct: 2.08, pe: 25.6, pb: 3.8, roe: 19.5, marketCap: 8.90e11 },
]

/** 主要货币对示例汇率（1 base 兑多少 quote）。 */
const MOCK_FX: Record<string, Omit<FinanceFxRate, 'mock'>> = {
  'USD/CNY': { pair: 'USD/CNY', base: 'USD', quote: 'CNY', rate: 7.12, inverse: 0.1404, updatedAt: '2026-09-24T16:00:00+08:00' },
  'EUR/CNY': { pair: 'EUR/CNY', base: 'EUR', quote: 'CNY', rate: 7.93, inverse: 0.1261, updatedAt: '2026-09-24T16:00:00+08:00' },
  'HKD/CNY': { pair: 'HKD/CNY', base: 'HKD', quote: 'CNY', rate: 0.91, inverse: 1.0989, updatedAt: '2026-09-24T16:00:00+08:00' },
  'JPY/CNY': { pair: 'JPY/CNY', base: 'JPY', quote: 'CNY', rate: 0.0486, inverse: 20.5761, updatedAt: '2026-09-24T16:00:00+08:00' },
  'GBP/CNY': { pair: 'GBP/CNY', base: 'GBP', quote: 'CNY', rate: 9.46, inverse: 0.1057, updatedAt: '2026-09-24T16:00:00+08:00' },
  'CNY/USD': { pair: 'CNY/USD', base: 'CNY', quote: 'USD', rate: 0.1404, inverse: 7.12, updatedAt: '2026-09-24T16:00:00+08:00' },
}

/** 人民币利率示例（%）：存款 / LPR / 国债收益率。 */
const MOCK_RATES: Record<FinanceRateCategory, Omit<FinanceRateQuote, 'mock'>[]> = {
  deposit: [
    { category: 'deposit', name: '活期存款', rate: 0.2, updatedAt: '2026-09-01T00:00:00+08:00' },
    { category: 'deposit', name: '三个月整存整取', rate: 1.15, updatedAt: '2026-09-01T00:00:00+08:00' },
    { category: 'deposit', name: '一年整存整取', rate: 1.45, updatedAt: '2026-09-01T00:00:00+08:00' },
    { category: 'deposit', name: '三年整存整取', rate: 1.95, updatedAt: '2026-09-01T00:00:00+08:00' },
    { category: 'deposit', name: '五年整存整取', rate: 2.0, updatedAt: '2026-09-01T00:00:00+08:00' },
  ],
  lpr: [
    { category: 'lpr', name: '1年期 LPR', rate: 3.1, updatedAt: '2026-09-21T00:00:00+08:00' },
    { category: 'lpr', name: '5年期以上 LPR', rate: 3.6, updatedAt: '2026-09-21T00:00:00+08:00' },
  ],
  bond: [
    { category: 'bond', name: '1年期国债', rate: 1.42, updatedAt: '2026-09-23T00:00:00+08:00' },
    { category: 'bond', name: '10年期国债', rate: 2.08, updatedAt: '2026-09-23T00:00:00+08:00' },
    { category: 'bond', name: '30年期国债', rate: 2.35, updatedAt: '2026-09-23T00:00:00+08:00' },
  ],
}

// ───────────────────── mock 数据生成辅助（确定性伪随机） ─────────────────────

/** 资讯条目到类别的内部映射（FinanceNewsResult.category 为查询类别，不存于条目内）。 */
const NEWS_CATEGORY: Record<string, FinanceNewsCategory> = {
  'news-001': 'market',
  'news-002': 'policy',
  'news-003': 'policy',
  'news-004': 'company',
  'news-005': 'industry',
  'news-006': 'macro',
  'news-007': 'company',
  'news-008': 'industry',
  'news-009': 'policy',
  'news-010': 'industry',
  'news-011': 'macro',
  'news-012': 'company',
  'news-013': 'macro',
  'news-014': 'industry',
  'news-015': 'macro',
}

/** 取资讯条目所属类别。 */
function newsCategoryOf(item: FinanceNewsItem): FinanceNewsCategory {
  return NEWS_CATEGORY[item.id] ?? 'market'
}

/** symbol → 中文名（用于资讯关联个股过滤）。 */
function symbolName(symbol: string): string {
  return MOCK_QUOTES[symbol]?.name ?? ''
}

/** 字符串哈希（FNV-1a）：为同一 symbol 生成稳定种子，保证每次运行结果一致。 */
function hashSeed(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** mulberry32 确定性 PRNG：返回 [0,1) 的伪随机序列。 */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 保留两位小数。 */
function r2(n: number): number {
  return Math.round(n * 100) / 100
}

/** 保留四位小数。 */
function r4(n: number): number {
  return Math.round(n * 10000) / 10000
}

/** 保留六位小数（中间统计量）。 */
function r6(n: number): number {
  return Math.round(n * 1e6) / 1e6
}

/** 基准指数代码 → 中文名映射。 */
const BENCHMARK_NAMES: Record<string, string> = {
  '000300': '沪深300',
  '000001': '上证指数',
  '399001': '深证成指',
  HSI: '恒生指数',
  SPX: '标普500',
  IXIC: '纳斯达克',
}

/** 取基准指数中文名（未收录时回退为代码本身）。 */
function benchmarkNameOf(benchmark: string): string {
  return BENCHMARK_NAMES[benchmark] ?? benchmark
}

/** 个股资金流向示例（金额：元）。主力≈超大单+大单，中单+小单反向对冲。 */
const MOCK_MONEYFLOW: Record<string, Omit<FinanceMoneyflow, 'mock'>> = {
  '600519': { symbol: '600519', name: '贵州茅台', market: 'cn', mainNetInflow: 3.24e8, superLargeNet: 2.10e8, largeNet: 1.14e8, mediumNet: -0.82e8, smallNet: -2.42e8, mainNetInflowPct: 6.15, updatedAt: '2026-09-24T15:00:00+08:00' },
  '000858': { symbol: '000858', name: '五粮液', market: 'cn', mainNetInflow: -1.56e8, superLargeNet: -0.98e8, largeNet: -0.58e8, mediumNet: 0.41e8, smallNet: 1.15e8, mainNetInflowPct: -4.82, updatedAt: '2026-09-24T15:00:00+08:00' },
  '601318': { symbol: '601318', name: '中国平安', market: 'cn', mainNetInflow: 1.08e8, superLargeNet: 0.72e8, largeNet: 0.36e8, mediumNet: -0.20e8, smallNet: -0.88e8, mainNetInflowPct: 2.32, updatedAt: '2026-09-24T15:00:00+08:00' },
  'AAPL': { symbol: 'AAPL', name: 'Apple Inc.', market: 'us', mainNetInflow: 8.45e7, superLargeNet: 5.20e7, largeNet: 3.25e7, mediumNet: -2.10e7, smallNet: -6.35e7, mainNetInflowPct: 0.81, updatedAt: '2026-09-23T20:00:00+00:00' },
  '0700': { symbol: '0700', name: '腾讯控股', market: 'hk', mainNetInflow: -4.20e8, superLargeNet: -2.60e8, largeNet: -1.60e8, mediumNet: 1.10e8, smallNet: 3.10e8, mainNetInflowPct: -1.08, updatedAt: '2026-09-24T16:00:00+08:00' },
}

/** 公司公告示例（按 symbol 索引）。 */
const MOCK_ANNOUNCEMENTS: Record<string, { name: string; market: FinanceMarket; items: FinanceAnnouncementItem[] }> = {
  '600519': {
    name: '贵州茅台', market: 'cn',
    items: [
      { id: '600519-2026-0401', title: '贵州茅台：2025年年度报告摘要', category: 'annual_report', publishDate: '2026-04-01', url: '', summary: '2025年实现营业收入1740亿元，同比增长15.7%；归母净利润862亿元，同比增长14.9%，拟每10股派发现金红利276元。' },
      { id: '600519-2026-0828', title: '贵州茅台：2026年半年度报告', category: 'quarterly_report', publishDate: '2026-08-28', url: '', summary: '上半年营收932亿元，同比增长14.2%；净利润451亿元，同比增长13.8%，主要系茅台酒量价齐升、系列酒表现稳健。' },
      { id: '600519-2026-0618', title: '贵州茅台：2025年年度权益分派实施公告', category: 'dividend', publishDate: '2026-06-18', url: '', summary: '每股派发现金红利27.6元（含税），股权登记日2026年6月25日，除权除息日2026年6月26日。' },
      { id: '600519-2026-0715', title: '贵州茅台：关于董事、高级管理人员变动的公告', category: 'ma_equity_change', publishDate: '2026-07-15', url: '', summary: '董事会于近日收到公司董事提交的书面辞职报告，辞职后不再担任公司任何职务，公司已完成补选程序。' },
      { id: '600519-2026-0910', title: '贵州茅台：关于投资建设茅台技术开发公司技改项目的公告', category: 'other', publishDate: '2026-09-10', url: '', summary: '公司拟投资约35亿元实施智能化技改项目，进一步扩产提质，预计建设周期3年。' },
      { id: '600519-2026-0430', title: '贵州茅台：2026年第一季度报告', category: 'quarterly_report', publishDate: '2026-04-30', url: '', summary: '一季度营收368亿元，同比增长16.1%；净利润181亿元，同比增长15.3%，经营活动现金流保持稳健。' },
    ],
  },
  '000858': {
    name: '五粮液', market: 'cn',
    items: [
      { id: '000858-2026-0402', title: '五粮液：2025年年度报告摘要', category: 'annual_report', publishDate: '2026-04-02', url: '', summary: '2025年营业收入891亿元，同比增长9.3%；归母净利润301亿元，同比增长8.7%，拟每10股派发现金红利42元。' },
      { id: '000858-2026-0826', title: '五粮液：2026年半年度报告', category: 'quarterly_report', publishDate: '2026-08-26', url: '', summary: '上半年营收462亿元，同比增长7.1%；净利润152亿元，同比增长6.4%，高端产品占比持续提升。' },
      { id: '000858-2026-0620', title: '五粮液：2025年度分红派息实施公告', category: 'dividend', publishDate: '2026-06-20', url: '', summary: '每股派发现金红利4.2元（含税），股权登记日2026年6月27日，除权除息日2026年6月30日。' },
      { id: '000858-2026-0520', title: '五粮液：关于回购公司股份方案的公告', category: 'ma_equity_change', publishDate: '2026-05-20', url: '', summary: '拟以集中竞价交易方式回购公司股份，回购金额不低于10亿元且不超过20亿元，用于后续股权激励。' },
      { id: '000858-2026-0905', title: '五粮液：关于召开2026年第二次临时股东大会的通知', category: 'other', publishDate: '2026-09-05', url: '', summary: '会议将于2026年9月22日召开，审议《关于修订公司章程的议案》等事项。' },
      { id: '000858-2026-0430', title: '五粮液：2026年第一季度报告', category: 'quarterly_report', publishDate: '2026-04-30', url: '', summary: '一季度营收187亿元，同比增长8.2%；净利润61亿元，同比增长7.9%。' },
      { id: '000858-2026-0728', title: '五粮液：关于董事长辞职及提名新任候选人的公告', category: 'ma_equity_change', publishDate: '2026-07-28', url: '', summary: '原董事长因工作调整申请辞职，董事会提名新候选人并将提交股东大会选举。' },
    ],
  },
  '601318': {
    name: '中国平安', market: 'cn',
    items: [
      { id: '601318-2026-0319', title: '中国平安：2025年年度报告', category: 'annual_report', publishDate: '2026-03-19', url: '', summary: '2025年集团营业收入1.03万亿元，归母营运利润1180亿元；寿险新业务价值同比增长12.6%，拟派发年末股息每股2.55元。' },
      { id: '601318-2026-0820', title: '中国平安：2026年半年度报告', category: 'quarterly_report', publishDate: '2026-08-20', url: '', summary: '上半年归母营运利润598亿元，同比增长5.2%；保险资金投资组合年化投资收益率4.1%。' },
      { id: '601318-2026-0715', title: '中国平安：2026年中期分红派息实施公告', category: 'dividend', publishDate: '2026-07-15', url: '', summary: '派发2026年中期股息每股1.02元（含税），股权登记日2026年7月22日。' },
      { id: '601318-2026-0610', title: '中国平安：关于子公司平安银行涉及诉讼进展的公告', category: 'other', publishDate: '2026-06-10', url: '', summary: '公告披露某诉讼案件最新进展，涉案金额占公司最近一期经审计净资产比例较低，不构成重大影响。' },
      { id: '601318-2026-0902', title: '中国平安：关于回购注销限制性股票的公告', category: 'ma_equity_change', publishDate: '2026-09-02', url: '', summary: '因部分激励对象离职，公司回购注销已授予但尚未归属的限制性股票共计约860万股。' },
      { id: '601318-2026-0430', title: '中国平安：2026年第一季度报告', category: 'quarterly_report', publishDate: '2026-04-30', url: '', summary: '一季度归母营运利润296亿元，同比增长4.8%，剩余边际余额保持稳定增长。' },
    ],
  },
}

/** 财经资讯示例（覆盖市场/宏观/公司/行业/政策）。 */
const MOCK_NEWS: FinanceNewsItem[] = [
  { id: 'news-001', title: 'A股三大指数集体收涨，沪指收复3700点关口', source: '上海证券报', publishTime: '2026-09-24T15:05:00+08:00', summary: '沪深两市成交额突破1.2万亿元，北向资金净流入86亿元，大金融与消费板块领涨。', url: '', tags: ['A股', '北向资金'] },
  { id: 'news-002', title: '央行开展8000亿元中期借贷便利操作，中标利率持平', source: '中国人民银行', publishTime: '2026-09-24T09:20:00+08:00', summary: '为维护银行体系流动性合理充裕，央行开展中期借贷便利操作，利率维持不变，释放稳增长信号。', url: '', tags: ['货币政策', 'MLF'] },
  { id: 'news-003', title: '国务院常务会议：部署进一步提振消费专项行动', source: '新华社', publishTime: '2026-09-23T19:40:00+08:00', summary: '会议研究推动服务消费、以旧换新等举措，强调更好发挥财政资金撬动作用，释放居民消费潜力。', url: '', tags: ['政策', '消费'] },
  { id: 'news-004', title: '贵州茅台披露半年报：上半年净利451亿元，同比增长13.8%', source: '证券时报', publishTime: '2026-09-24T07:30:00+08:00', summary: '公司上半年营收与净利双双双位数增长，直销渠道占比提升至48%，市场反应积极。', url: '', tags: ['公司', '白酒'] },
  { id: 'news-005', title: '半导体板块午后走强，多只个股创阶段新高', source: '财联社', publishTime: '2026-09-24T13:50:00+08:00', summary: '受国产替代加速及行业景气度回升预期推动，半导体设备、材料方向集体走强。', url: '', tags: ['行业', '半导体'] },
  { id: 'news-006', title: '8月CPI同比上涨0.5%，PPI同比下降1.8%', source: '国家统计局', publishTime: '2026-09-09T10:00:00+08:00', summary: '物价总体温和，食品价格环比回落，工业品出厂价格降幅收窄，核心CPI保持稳定。', url: '', tags: ['宏观', 'CPI'] },
  { id: 'news-007', title: 'Apple发布新款智能手表，服务业务收入持续超预期', source: '彭博社', publishTime: '2026-09-16T01:00:00+00:00', summary: '公司秋季发布会推出多款硬件新品，分析师上调服务业务收入预期，盘后股价上涨。', url: '', tags: ['公司', '美股'] },
  { id: 'news-008', title: '新能源汽车8月产销同比增长，出口表现亮眼', source: '中国汽车工业协会', publishTime: '2026-09-11T09:30:00+08:00', summary: '8月新能源汽车渗透率突破52%，出口同比增长38%，产业链景气度延续。', url: '', tags: ['行业', '新能源车'] },
  { id: 'news-009', title: '证监会：深化科创板改革，支持硬科技企业上市融资', source: '中国证券报', publishTime: '2026-09-18T15:30:00+08:00', summary: '证监会就改革措施公开征求意见，进一步畅通科技、资本和实体经济高水平循环。', url: '', tags: ['政策', '资本市场'] },
  { id: 'news-010', title: '银行板块估值修复，高股息策略持续受青睐', source: '第一财经', publishTime: '2026-09-24T14:10:00+08:00', summary: '在无风险利率下行背景下，银行股股息率优势凸显，保险与长线资金持续增配。', url: '', tags: ['行业', '银行'] },
  { id: 'news-011', title: '8月社会融资规模增量3.1万亿元，M2同比增长8.2%', source: '中国人民银行', publishTime: '2026-09-13T16:00:00+08:00', summary: '社融存量同比增长8.5%，企业中长期贷款多增，金融对实体经济支持力度稳固。', url: '', tags: ['宏观', '社融'] },
  { id: 'news-012', title: '腾讯控股二季度营收超预期，游戏与广告业务双增', source: '界面新闻', publishTime: '2026-08-13T12:00:00+08:00', summary: '公司二季度营收2180亿元，本土游戏收入同比增长11%，视频号广告放量带动整体利润超预期。', url: '', tags: ['公司', '港股'] },
  { id: 'news-013', title: '制造业PMI连续三月处于荣枯线附近，结构有待改善', source: '国家统计局', publishTime: '2026-08-31T09:30:00+08:00', summary: '8月制造业PMI录得49.5%，新订单指数回升，中小企业景气度仍需政策呵护。', url: '', tags: ['宏观', 'PMI'] },
  { id: 'news-014', title: '创新药板块迎来政策利好，医保目录调整预期升温', source: '医药经济报', publishTime: '2026-09-22T10:45:00+08:00', summary: '市场关注新版医保目录谈判进展，创新药出海授权交易增多，板块情绪回暖。', url: '', tags: ['行业', '医药'] },
  { id: 'news-015', title: '离岸人民币兑美元走强，市场预期汇率保持基本稳定', source: '外汇交易中心', publishTime: '2026-09-24T16:30:00+08:00', summary: '受美元指数回落及结汇需求推动，离岸人民币小幅升值，双向波动格局延续。', url: '', tags: ['宏观', '汇率'] },
]

/** 宏观经济指标示例（最新一期，2026年8月或Q2）。 */
const MOCK_MACRO: Record<FinanceMacroIndicator, Omit<FinanceMacro, 'mock'>> = {
  gdp: { indicator: 'gdp', name: '国内生产总值(GDP)', period: '2026Q2', value: 34.2, unit: '万亿元(当季)', yoy: 5.0, mom: 1.1, previousValue: 33.6, updatedAt: '2026-07-15T10:00:00+08:00' },
  cpi: { indicator: 'cpi', name: '居民消费价格指数(CPI)', period: '2026-08', value: 0.5, unit: '%(同比)', yoy: 0.5, mom: 0.1, previousValue: 0.3, updatedAt: '2026-09-09T10:00:00+08:00' },
  ppi: { indicator: 'ppi', name: '工业生产者出厂价格指数(PPI)', period: '2026-08', value: -1.8, unit: '%(同比)', yoy: -1.8, mom: -0.2, previousValue: -2.1, updatedAt: '2026-09-09T10:00:00+08:00' },
  pmi_manufacturing: { indicator: 'pmi_manufacturing', name: '制造业采购经理指数(PMI)', period: '2026-08', value: 49.5, unit: '%', yoy: -0.6, mom: -0.3, previousValue: 49.8, updatedAt: '2026-08-31T09:30:00+08:00' },
  pmi_non_manufacturing: { indicator: 'pmi_non_manufacturing', name: '非制造业商务活动指数', period: '2026-08', value: 50.8, unit: '%', yoy: 0.2, mom: 0.1, previousValue: 50.7, updatedAt: '2026-08-31T09:30:00+08:00' },
  m2: { indicator: 'm2', name: '广义货币供应量(M2)', period: '2026-08', value: 8.2, unit: '%(同比余额)', yoy: 8.2, mom: 0.1, previousValue: 8.1, updatedAt: '2026-09-13T16:00:00+08:00' },
  social_financing: { indicator: 'social_financing', name: '社会融资规模存量', period: '2026-08', value: 8.5, unit: '%(同比增速)', yoy: 8.5, mom: 0.2, previousValue: 8.3, updatedAt: '2026-09-13T16:00:00+08:00' },
  trade_balance: { indicator: 'trade_balance', name: '进出口贸易差额(顺差)', period: '2026-08', value: 782, unit: '亿美元', yoy: 12.4, mom: 5.6, previousValue: 740, updatedAt: '2026-09-08T10:00:00+08:00' },
  unemployment: { indicator: 'unemployment', name: '城镇调查失业率', period: '2026-08', value: 5.1, unit: '%', yoy: -0.1, mom: 0.0, previousValue: 5.1, updatedAt: '2026-09-09T10:00:00+08:00' },
}

/** 行业板块示例（A股，15 个）。 */
const MOCK_SECTORS: FinanceSectorItem[] = [
  { name: '食品饮料', changePct: 1.82, leadingStock: '贵州茅台', leadingStockChangePct: 0.75, turnover: 3.28e10, pe: 23.5, upCount: 42, downCount: 8 },
  { name: '新能源', changePct: 2.45, leadingStock: '宁德时代', leadingStockChangePct: 3.12, turnover: 4.15e10, pe: 19.8, upCount: 68, downCount: 15 },
  { name: '半导体', changePct: 3.18, leadingStock: '中芯国际', leadingStockChangePct: 4.05, turnover: 5.62e10, pe: 48.2, upCount: 85, downCount: 12 },
  { name: '医药生物', changePct: -0.64, leadingStock: '恒瑞医药', leadingStockChangePct: 1.22, turnover: 2.89e10, pe: 27.6, upCount: 55, downCount: 62 },
  { name: '银行', changePct: 0.96, leadingStock: '招商银行', leadingStockChangePct: 1.48, turnover: 2.14e10, pe: 6.2, upCount: 32, downCount: 4 },
  { name: '非银金融', changePct: 1.55, leadingStock: '中国平安', leadingStockChangePct: 1.16, turnover: 3.76e10, pe: 9.8, upCount: 48, downCount: 11 },
  { name: '房地产', changePct: -1.28, leadingStock: '保利发展', leadingStockChangePct: 0.86, turnover: 1.58e10, pe: 12.4, upCount: 18, downCount: 65 },
  { name: '汽车', changePct: 0.72, leadingStock: '比亚迪', leadingStockChangePct: 1.95, turnover: 2.67e10, pe: 21.3, upCount: 46, downCount: 28 },
  { name: '家用电器', changePct: 0.45, leadingStock: '美的集团', leadingStockChangePct: 0.92, turnover: 1.42e10, pe: 13.6, upCount: 35, downCount: 19 },
  { name: '计算机', changePct: 2.08, leadingStock: '金山办公', leadingStockChangePct: 3.66, turnover: 3.05e10, pe: 55.1, upCount: 92, downCount: 23 },
  { name: '传媒', changePct: 1.34, leadingStock: '分众传媒', leadingStockChangePct: 2.41, turnover: 1.28e10, pe: 18.9, upCount: 41, downCount: 17 },
  { name: '国防军工', changePct: -0.32, leadingStock: '中航沈飞', leadingStockChangePct: 0.58, turnover: 1.96e10, pe: 35.7, upCount: 38, downCount: 44 },
  { name: '基础化工', changePct: 0.58, leadingStock: '万华化学', leadingStockChangePct: 1.33, turnover: 2.21e10, pe: 15.2, upCount: 52, downCount: 47 },
  { name: '农林牧渔', changePct: -0.86, leadingStock: '牧原股份', leadingStockChangePct: 0.42, turnover: 1.08e10, pe: 14.8, upCount: 22, downCount: 39 },
  { name: '消费电子', changePct: 2.76, leadingStock: '立讯精密', leadingStockChangePct: 3.88, turnover: 3.44e10, pe: 26.4, upCount: 61, downCount: 14 },
]

/** 固收资产示例数据统一时间戳。 */
const FUND_UPDATED_AT = '2026-09-24T15:00:00+08:00'

/** 公募基金示例（5 只）。category/updatedAt 由 fund() 统一加盖。 */
const MOCK_FUNDS: Array<Omit<FinanceFundItem, 'category' | 'updatedAt'>> = [
  { code: '510300', name: '华泰柏瑞沪深300ETF', type: 'ETF', fundType: 'ETF', nav: 4.1256, navAccumulated: 1.8523, dailyChangePct: 0.85, change1m: 3.2, change1y: 12.5, scale: 1850.5, manager: '柳军' },
  { code: '005827', name: '易方达蓝筹精选混合', type: '混合型', fundType: '混合型', nav: 2.3456, navAccumulated: 2.3456, dailyChangePct: -0.62, change1m: -2.1, change1y: -8.3, scale: 420.8, manager: '张坤' },
  { code: '000198', name: '天弘余额宝货币', type: '货币型', fundType: '货币型', nav: 1.0000, navAccumulated: 1.0000, dailyChangePct: 0.001, change1m: 0.18, change1y: 2.15, scale: 7200.0, manager: '王登峰' },
  { code: '110007', name: '易方达稳健收益债券A', type: '债券型', fundType: '债券型', nav: 1.5678, navAccumulated: 2.1034, dailyChangePct: 0.12, change1m: 0.85, change1y: 5.62, scale: 180.3, manager: '胡剑' },
  { code: '000001', name: '华夏成长混合', type: '股票型', fundType: '股票型', nav: 1.2345, navAccumulated: 3.4567, dailyChangePct: 1.25, change1m: 4.5, change1y: 15.8, scale: 85.6, manager: '王亚伟' },
]

/** 债券示例（4 条国债收益率曲线 + 3 条信用债）。 */
const MOCK_BONDS: Array<Omit<FinanceFundItem, 'category' | 'updatedAt'>> = [
  { code: 'CNBOND1Y', name: '1年期国债', type: '国债收益率', yieldToMaturity: 1.42, duration: 1.0, rating: 'AAA', issuer: '财政部', maturityDate: '2027-09-24' },
  { code: 'CNBOND5Y', name: '5年期国债', type: '国债收益率', yieldToMaturity: 1.85, duration: 5.0, rating: 'AAA', issuer: '财政部', maturityDate: '2031-09-24' },
  { code: 'CNBOND10Y', name: '10年期国债', type: '国债收益率', yieldToMaturity: 2.08, duration: 10.0, rating: 'AAA', issuer: '财政部', maturityDate: '2036-09-24' },
  { code: 'CNBOND30Y', name: '30年期国债', type: '国债收益率', yieldToMaturity: 2.35, duration: 30.0, rating: 'AAA', issuer: '财政部', maturityDate: '2056-09-24' },
  { code: '220220', name: '22国电01', type: '企业债', couponRate: 3.25, yieldToMaturity: 2.98, duration: 4.5, rating: 'AAA', issuer: '国家能源集团', maturityDate: '2027-03-15' },
  { code: '230001', name: '23沪城投01', type: '城投债', couponRate: 3.55, yieldToMaturity: 3.22, duration: 3.2, rating: 'AA+', issuer: '上海城投控股', maturityDate: '2026-12-20' },
  { code: '2280123', name: '22万科02', type: '企业债', couponRate: 3.95, yieldToMaturity: 4.85, duration: 2.8, rating: 'AAA', issuer: '万科企业', maturityDate: '2027-06-30' },
]

/** 可转债示例（3 只）。转股价值=100/转股价×正股价，溢价率=转债价/转股价值-1。 */
const MOCK_CONVERTIBLES: Array<Omit<FinanceFundItem, 'category' | 'updatedAt'>> = [
  { code: '110059', name: '浦发转债', type: '可转债', underlyingStock: '600000', underlyingStockName: '浦发银行', conversionPrice: 14.20, conversionValue: 70.42, premiumRate: 42.0, outstandingBalance: 200.0, maturityDate: '2025-10-28' },
  { code: '113021', name: '中信转债', type: '可转债', underlyingStock: '601998', underlyingStockName: '中信银行', conversionPrice: 7.28, conversionValue: 85.16, premiumRate: 17.4, outstandingBalance: 400.0, maturityDate: '2025-03-04' },
  { code: '128028', name: '赣锋转债', type: '可转债', underlyingStock: '002460', underlyingStockName: '赣锋锂业', conversionPrice: 35.50, conversionValue: 112.68, premiumRate: -11.3, outstandingBalance: 8.5, maturityDate: '2026-08-26' },
]

/** 券商研报示例（按 symbol 索引，摘要级；目标价与 mock 现价逻辑自洽）。 */
const MOCK_RESEARCH: Record<string, FinanceResearchItem[]> = {
  '600519': [
    { id: 'R600519001', title: '贵州茅台2026年中报点评：量价齐升，龙头稳健', institution: '中金公司', analyst: '邢庭志', rating: '买入', targetPrice: 2000, reportDate: '2026-08-28', summary: '公司2026H1营收同比+15.2%，净利润+16.8%，直销占比持续提升。茅台酒批价企稳回升，系列酒高速增长。维持买入评级。', url: '' },
    { id: 'R600519002', title: '贵州茅台深度报告：护城河加深，长期价值凸显', institution: '中信证券', analyst: '薛缘', rating: '买入', targetPrice: 1950, reportDate: '2026-09-10', summary: '茅台品牌力与渠道掌控力行业第一，i茅台数字化转型成效显著。预计2026-2028年EPS分别为72.5/82.3/93.1元，对应PE 23/20/18倍。', url: '' },
    { id: 'R600519003', title: '贵州茅台跟踪报告：中秋国庆旺季前瞻', institution: '华泰证券', analyst: '龚源月', rating: '增持', targetPrice: 1880, reportDate: '2026-09-15', summary: '中秋国庆双节临近，茅台动销加速，批价有望回升至2700元以上。渠道库存处于健康水平，全年业绩确定性强。', url: '' },
  ],
  '000858': [
    { id: 'R000858001', title: '五粮液2026中报点评：改革深化，增长提速', institution: '国泰君安', analyst: '訾猛', rating: '买入', targetPrice: 160, reportDate: '2026-08-30', summary: '公司2026H1营收+12.5%，净利润+14.2%，八代五粮液量价稳健。渠道改革持续推进，经销商利润改善。维持买入评级。', url: '' },
    { id: 'R000858002', title: '五粮液行业报告：白酒板块估值修复进行时', institution: '招商证券', analyst: '于佳琦', rating: '增持', targetPrice: 150, reportDate: '2026-09-05', summary: '白酒板块当前估值处于历史低位，五粮液作为浓香龙头受益于消费复苏。公司分红率提升至60%，股息率吸引力增强。', url: '' },
  ],
  '601318': [
    { id: 'R601318001', title: '中国平安2026中报点评：寿险改革成效显现', institution: '中金公司', analyst: '姚泽宇', rating: '买入', targetPrice: 65, reportDate: '2026-08-27', summary: '公司2026H1归母净利润+18.5%，寿险NBV同比+22.3%，代理人产能持续提升。产险综合成本率优化至96.2%。维持买入评级。', url: '' },
    { id: 'R601318002', title: '中国平安跟踪报告：综合金融协同加速', institution: '中信证券', analyst: '邵子钦', rating: '增持', targetPrice: 60, reportDate: '2026-09-08', summary: '平安银行与寿险交叉销售成效显著，信用卡新发卡量同比+15%。陆金所控股扭亏为盈，金融科技板块估值有望重估。', url: '' },
    { id: 'R601318003', title: '中国平安：股息率超5%，配置价值凸显', institution: '华泰证券', analyst: '沈娟', rating: '持有', targetPrice: 58, reportDate: '2026-09-12', summary: '公司当前PEV仅0.55倍，处于历史底部。2025年分红率提升至35%，股息率超5%。但寿险新单增长仍面临压力，维持持有评级。', url: '' },
  ],
  'AAPL': [
    { id: 'RAAPL001', title: 'Apple iPhone 18 系列前瞻：AI 驱动换机周期', institution: '摩根士丹利', analyst: 'Erik Woodring', rating: '买入', targetPrice: 260, reportDate: '2026-09-10', summary: 'iPhone 18 系列将搭载 Apple Intelligence 2.0，AI 功能有望驱动换机周期。预计2026财年iPhone销量同比+8%，服务收入+12%。', url: '' },
    { id: 'RAAPL002', title: 'Apple 服务业务深度分析：高增长引擎', institution: '高盛', analyst: 'Michael Ng', rating: '买入', targetPrice: 250, reportDate: '2026-09-05', summary: 'Apple 服务业务毛利率超70%，App Store/Apple Music/iCloud 持续高增长。服务收入占比已达28%，估值体系有望从硬件向服务切换。', url: '' },
  ],
  '0700': [
    { id: 'R0700001', title: '腾讯控股2026Q2点评：游戏复苏+广告高增', institution: '中金公司', analyst: '白洋', rating: '买入', targetPrice: 520, reportDate: '2026-08-18', summary: '公司2026Q2营收+12%，净利润+18%。本土游戏收入+15%（DNF手游+王者贡献），广告收入+22%（视频号商业化加速）。维持买入评级。', url: '' },
    { id: 'R0700002', title: '腾讯控股：视频号电商闭环加速', institution: '华泰证券', analyst: '朱珺', rating: '增持', targetPrice: 500, reportDate: '2026-09-02', summary: '视频号GMV同比+80%，直播电商闭环逐步完善。微信小店与小程序生态打通，腾讯电商货币化空间广阔。', url: '' },
  ],
}

/** 内置示例数据源：开箱即用，所有数据带 mock 标记。 */
export class MockFinanceSource implements FinanceDataSource {
  // oxlint-disable-next-line typescript/require-await -- FinanceDataSource 接口要求返回 Promise
  async quote(symbol: string, market: FinanceMarket): Promise<FinanceQuote> {
    const row = MOCK_QUOTES[symbol]
    if (row === undefined || row.market !== market) {
      throw new Error(`mock 数据源未收录 ${market}:${symbol}（内置示例：600519/000858/601318/AAPL/0700）`)
    }
    return { ...row, mock: true }
  }

  // oxlint-disable-next-line typescript/require-await -- FinanceDataSource 接口要求返回 Promise
  async financials(symbol: string, market: FinanceMarket, year = 2025): Promise<FinanceFinancials> {
    const row = MOCK_FINANCIALS[symbol]
    if (row === undefined || row.market !== market) {
      throw new Error(`mock 数据源未收录 ${market}:${symbol} 的财务数据`)
    }
    if (row.year !== year) {
      return { ...row, year, revenue: 0, netProfit: 0, grossMargin: 0, netMargin: 0, roe: 0, debtRatio: 0, eps: 0, mock: true }
    }
    return { ...row, mock: true }
  }

  // oxlint-disable-next-line typescript/require-await -- FinanceDataSource 接口要求返回 Promise
  async metrics(symbol: string, market: FinanceMarket): Promise<FinanceMetrics> {
    const row = MOCK_METRICS[symbol]
    if (row === undefined || row.market !== market) {
      throw new Error(`mock 数据源未收录 ${market}:${symbol} 的估值数据`)
    }
    return { ...row, mock: true }
  }

  // oxlint-disable-next-line typescript/require-await -- FinanceDataSource 接口要求返回 Promise
  async fx(pair: string): Promise<FinanceFxRate> {
    const row = MOCK_FX[pair.toUpperCase()]
    if (row === undefined) {
      throw new Error(`mock 数据源未收录汇率 ${pair}（内置示例：${Object.keys(MOCK_FX).join('/')}）`)
    }
    return { ...row, mock: true }
  }

  // oxlint-disable-next-line typescript/require-await -- FinanceDataSource 接口要求返回 Promise
  async rates(category: FinanceRateCategory): Promise<FinanceRateQuote[]> {
    const rows = MOCK_RATES[category]
    return rows.map((row) => ({ ...row, mock: true }))
  }

  // oxlint-disable-next-line typescript/require-await -- FinanceDataSource 接口要求返回 Promise
  async screener(filter: ScreenerFilter): Promise<ScreenerResult> {
    const poolSize = MOCK_SCREENER_UNIVERSE.length
    const parts: string[] = []
    if (filter.market !== undefined) parts.push(`市场=${filter.market.toUpperCase()}`)
    if (filter.industry !== undefined) parts.push(`行业=${filter.industry}`)
    if (filter.minMarketCap !== undefined || filter.maxMarketCap !== undefined) {
      const lo = filter.minMarketCap === undefined ? '—' : `${(filter.minMarketCap / 1e8).toFixed(0)}亿`
      const hi = filter.maxMarketCap === undefined ? '—' : `${(filter.maxMarketCap / 1e8).toFixed(0)}亿`
      parts.push(`市值∈[${lo}, ${hi}]`)
    }
    if (filter.minPe !== undefined || filter.maxPe !== undefined) {
      parts.push(`PE∈[${filter.minPe ?? '—'}, ${filter.maxPe ?? '—'}]`)
    }
    if (filter.minPb !== undefined || filter.maxPb !== undefined) {
      parts.push(`PB∈[${filter.minPb ?? '—'}, ${filter.maxPb ?? '—'}]`)
    }
    if (filter.minRoe !== undefined) parts.push(`ROE≥${filter.minRoe}%`)
    if (filter.minChangePct !== undefined || filter.maxChangePct !== undefined) {
      parts.push(`当日涨跌∈[${filter.minChangePct ?? '—'}%, ${filter.maxChangePct ?? '—'}%]`)
    }
    const formula = parts.length === 0 ? '无过滤条件（返回全部股票池，按市值降序）' : parts.join(' 且 ')

    const items = MOCK_SCREENER_UNIVERSE
      .filter((r) => filter.market === undefined || r.market === filter.market)
      .filter((r) => filter.industry === undefined || r.industry === filter.industry)
      .filter((r) => filter.minMarketCap === undefined || r.marketCap >= filter.minMarketCap)
      .filter((r) => filter.maxMarketCap === undefined || r.marketCap <= filter.maxMarketCap)
      .filter((r) => filter.minPe === undefined || r.pe >= filter.minPe)
      .filter((r) => filter.maxPe === undefined || r.pe <= filter.maxPe)
      .filter((r) => filter.minPb === undefined || r.pb >= filter.minPb)
      .filter((r) => filter.maxPb === undefined || r.pb <= filter.maxPb)
      .filter((r) => filter.minRoe === undefined || r.roe >= filter.minRoe)
      .filter((r) => filter.minChangePct === undefined || r.changePct >= filter.minChangePct)
      .filter((r) => filter.maxChangePct === undefined || r.changePct <= filter.maxChangePct)
      .slice()
      .sort((a, b) => b.marketCap - a.marketCap)

    return { poolSize, total: items.length, criteria: { ...filter }, formula, items, mock: true }
  }

  // oxlint-disable-next-line typescript/require-await -- FinanceDataSource 接口要求返回 Promise
  async kline(symbol: string, market: FinanceMarket, period: FinanceKlinePeriod, limit: number): Promise<FinanceKlineResult> {
    const quote = MOCK_QUOTES[symbol]
    if (quote === undefined || quote.market !== market) {
      throw new Error(`mock 数据源未收录 ${market}:${symbol} 的K线数据（内置示例：600519/000858/601318/AAPL/0700）`)
    }
    // 上限 300 根（约 1 年交易日），兼顾 finance_kline 常规查询与 finance_backtest 回测取数。
    const count = Math.max(1, Math.min(limit, 300))
    const step = period === 'day' ? 1 : period === 'week' ? 7 : 30
    // 周K/月K 基于日K节奏放大步长，收盘仍锚定当前价
    const rand = mulberry32(hashSeed(symbol + ':' + period))
    const rets: number[] = []
    for (let i = 0; i < count; i++) rets.push((rand() - 0.485) * (period === 'day' ? 0.04 : period === 'week' ? 0.08 : 0.15))
    const closes = new Array<number>(count)
    closes[count - 1] = quote.price
    for (let i = count - 2; i >= 0; i--) closes[i] = (closes[i + 1] as number) / (1 + (rets[i + 1] as number))
    const dates: string[] = []
    const cursor = new Date('2026-09-24T00:00:00+08:00')
    while (dates.length < count) {
      dates.unshift(cursor.toISOString().slice(0, 10))
      cursor.setDate(cursor.getDate() - step)
    }
    const bars: FinanceKlineBar[] = []
    for (let i = 0; i < count; i++) {
      const c = closes[i] as number
      const o = c * (1 + (rand() - 0.5) * 0.015)
      const h = Math.max(o, c) * (1 + rand() * 0.015)
      const l = Math.min(o, c) * (1 - rand() * 0.015)
      const volume = Math.round(quote.volume * (0.6 + rand() * 0.8) * (period === 'day' ? 1 : period === 'week' ? 5 : 20))
      bars.push({ date: dates[i] as string, open: r2(o), high: r2(h), low: r2(l), close: r2(c), volume, turnover: Math.round(c * volume * 100) })
    }
    return { symbol, name: quote.name, market, period, bars, updatedAt: quote.updatedAt, mock: true }
  }

  // oxlint-disable-next-line typescript/require-await -- FinanceDataSource 接口要求返回 Promise
  async moneyflow(symbol: string, market: FinanceMarket): Promise<FinanceMoneyflow> {
    const row = MOCK_MONEYFLOW[symbol]
    if (row === undefined || row.market !== market) {
      throw new Error(`mock 数据源未收录 ${market}:${symbol} 的资金流向数据`)
    }
    return { ...row, mock: true }
  }

  // oxlint-disable-next-line typescript/require-await -- FinanceDataSource 接口要求返回 Promise
  async announcements(symbol: string, market: FinanceMarket, category: FinanceAnnouncementCategory | undefined, limit: number): Promise<FinanceAnnouncementResult> {
    const group = MOCK_ANNOUNCEMENTS[symbol]
    if (group === undefined || group.market !== market) {
      throw new Error(`mock 数据源未收录 ${market}:${symbol} 的公告（内置示例：600519/000858/601318）`)
    }
    const filtered = category === undefined ? group.items : group.items.filter((item) => item.category === category)
    const items = filtered.slice(0, Math.max(1, limit))
    return { symbol, name: group.name, market, total: filtered.length, items, updatedAt: '2026-09-24T16:00:00+08:00', mock: true }
  }

  // oxlint-disable-next-line typescript/require-await -- FinanceDataSource 接口要求返回 Promise
  async news(category: FinanceNewsCategory | undefined, limit: number, symbol?: string): Promise<FinanceNewsResult> {
    let items = category === undefined ? MOCK_NEWS.slice() : MOCK_NEWS.filter((item) => newsCategoryOf(item) === category)
    if (symbol !== undefined && symbol.length > 0) {
      const name = symbolName(symbol)
      items = items.filter((item) => item.title.includes(symbol) || item.summary.includes(symbol) || (name.length > 0 && (item.title.includes(name) || item.summary.includes(name))))
    }
    const total = items.length
    return { category: category ?? 'market', total, items: items.slice(0, Math.max(1, limit)), updatedAt: '2026-09-24T16:30:00+08:00', mock: true }
  }

  // oxlint-disable-next-line typescript/require-await -- FinanceDataSource 接口要求返回 Promise
  async macro(indicator: FinanceMacroIndicator, period?: string): Promise<FinanceMacro> {
    const row = MOCK_MACRO[indicator]
    return period === undefined ? { ...row, mock: true } : { ...row, period, mock: true }
  }

  // oxlint-disable-next-line typescript/require-await -- FinanceDataSource 接口要求返回 Promise
  async sector(market: FinanceMarket, category: FinanceSectorCategory, limit: number): Promise<FinanceSectorResult> {
    void market
    void category
    const items = MOCK_SECTORS.slice(0, Math.max(1, Math.min(limit, MOCK_SECTORS.length)))
    return { market: 'cn', category, total: MOCK_SECTORS.length, items, updatedAt: '2026-09-24T15:00:00+08:00', mock: true }
  }

  // oxlint-disable-next-line typescript/require-await -- FinanceDataSource 接口要求返回 Promise
  async risk(symbol: string, market: FinanceMarket, benchmark: string, riskFreeRate: number, period: number): Promise<FinanceRiskResult> {
    const quote = MOCK_QUOTES[symbol]
    if (quote === undefined || quote.market !== market) {
      throw new Error(`mock 数据源未收录 ${market}:${symbol} 的风险指标（内置示例：600519/000858/601318/AAPL/0700）`)
    }
    // 收盘价点数：period 回溯交易日，至少 21 个点以保证日收益率 >= 20 个
    const count = Math.max(21, Math.min(Math.round(period), 250))
    // 基准指数日收益序列（确定性 PRNG，波动锚定 ~3800 点）
    const benchRand = mulberry32(hashSeed('risk:bench:' + benchmark))
    const benchRets: number[] = []
    for (let i = 0; i < count - 1; i++) benchRets.push((benchRand() - 0.5) * 0.012)
    // 个股日收益：与基准相关（β≈1.15）+ 特质噪声，保证 Beta 落在合理区间
    const stockRand = mulberry32(hashSeed('risk:stock:' + symbol + ':' + market))
    const stockRets = benchRets.map((br) => 1.15 * br + (stockRand() - 0.5) * 0.014)
    // 收盘价序列：末根锚定个股现价，末根基准锚定 3800，向前递推
    // stockRets[k] 为第 k-1→k 日的收益，故 prices[k-1] = prices[k] / (1 + stockRets[k-1])
    const stockCloses = new Array<number>(count)
    stockCloses[count - 1] = quote.price
    for (let i = count - 1; i >= 1; i--) stockCloses[i - 1] = (stockCloses[i] as number) / (1 + (stockRets[i - 1] as number))
    const benchCloses = new Array<number>(count)
    benchCloses[count - 1] = 3800
    for (let i = count - 1; i >= 1; i--) benchCloses[i - 1] = (benchCloses[i] as number) / (1 + (benchRets[i - 1] as number))

    const sRets = dailyReturns(stockCloses)
    const bRets = dailyReturns(benchCloses)
    const n = sRets.length
    const meanS = sRets.reduce((a, b) => a + b, 0) / n
    const meanB = bRets.reduce((a, b) => a + b, 0) / n
    let cov = 0
    let varB = 0
    for (let i = 0; i < n; i++) {
      const ds = (sRets[i] as number) - meanS
      const db = (bRets[i] as number) - meanB
      cov += ds * db
      varB += db * db
    }
    cov /= n - 1
    varB /= n - 1

    return {
      symbol,
      name: quote.name,
      market,
      benchmark,
      benchmarkName: benchmarkNameOf(benchmark),
      beta: r4(betaCoefficient(sRets, bRets)),
      sharpe: r4(sharpeRatio(sRets, riskFreeRate)),
      maxDrawdown: r2(maxDrawdown(stockCloses)),
      annualVolatility: r2(annualVolatility(sRets)),
      var95: r2(historicalVaR(sRets, 0.95)),
      var99: r2(historicalVaR(sRets, 0.99)),
      formula: 'Beta=Cov(Ri,Rm)/Var(Rm)；Sharpe=(年化收益-无风险)/年化波动；MDD=max((峰-谷)/峰)；Vol=σ日×√252；VaR=历史收益率分位数',
      details: {
        avgDailyReturn: r6(meanS),
        dailyVolatility: r6(Math.sqrt(sRets.reduce((a, b) => a + (b - meanS) ** 2, 0) / (n - 1))),
        covStockBench: r6(cov),
        varBench: r6(varB),
        peakPrice: r2(Math.max(...stockCloses)),
        troughPrice: r2(Math.min(...stockCloses)),
        returnCount: n,
      },
      updatedAt: quote.updatedAt,
      mock: true,
    }
  }

  // oxlint-disable-next-line typescript/require-await -- FinanceDataSource 接口要求返回 Promise
  async fund(category: FinanceFundCategory, symbol?: string, limit?: number): Promise<FinanceFundResult> {
    const table: Record<FinanceFundCategory, Array<Omit<FinanceFundItem, 'category' | 'updatedAt'>>> = {
      fund: MOCK_FUNDS,
      bond: MOCK_BONDS,
      convertible: MOCK_CONVERTIBLES,
    }
    const rows = table[category]
    let items: FinanceFundItem[] = rows.map((row) => ({ ...row, category, updatedAt: FUND_UPDATED_AT }))
    if (symbol !== undefined && symbol.length > 0) {
      items = items.filter((item) => item.code === symbol)
    }
    const total = items.length
    const cap = Math.max(1, Math.min(limit ?? 10, 50))
    return { category, total, items: items.slice(0, cap), updatedAt: FUND_UPDATED_AT, mock: true }
  }

  // oxlint-disable-next-line typescript/require-await -- FinanceDataSource 接口要求返回 Promise
  async research(symbol: string, market: FinanceMarket, limit: number): Promise<FinanceResearchResult> {
    const rows = MOCK_RESEARCH[symbol] ?? []
    const name = MOCK_QUOTES[symbol]?.name ?? symbol
    const total = rows.length
    const items = rows.slice(0, Math.max(1, Math.min(limit, 20)))
    return { symbol, name, market, total, items, updatedAt: '2026-09-24T16:00:00+08:00', mock: true }
  }
}

// ───────────────────────────── HTTP 实现 ─────────────────────────────

/**
 * 配置式 HTTP 数据源：GET `{baseURL}/{endpoint}`，Bearer 认证（apiKey），
 * 响应体按本包文档约定的 JSON 契约返回。适配任意自建行情服务或第三方
 * 网关（如聚宽/东财/新浪公开接口的合规封装服务）。
 */
export class HttpFinanceSource implements FinanceDataSource {
  constructor(
    private readonly baseURL: string,
    private readonly apiKey: string | undefined,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    if (baseURL.length === 0) throw new Error('finance-agent: baseURL 不能为空（source=http 时必填）')
  }

  private async get<T>(endpoint: string, params: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(endpoint, this.baseURL.endsWith('/') ? this.baseURL : this.baseURL + '/')
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }
    const headers: Record<string, string> = { accept: 'application/json' }
    if (this.apiKey !== undefined) headers.authorization = `Bearer ${this.apiKey}`
    const response = await this.fetchImpl(url.toString(), { headers, signal: AbortSignal.timeout(10_000) })
    if (!response.ok) {
      throw new Error(`finance-agent: 数据源请求失败 HTTP ${response.status} ${url.toString()}`)
    }
    return (await response.json()) as T
  }

  async quote(symbol: string, market: FinanceMarket): Promise<FinanceQuote> {
    return this.get<FinanceQuote>('quote', { symbol, market })
  }

  async financials(symbol: string, market: FinanceMarket, year?: number): Promise<FinanceFinancials> {
    return this.get<FinanceFinancials>('financials', { symbol, market, year })
  }

  async metrics(symbol: string, market: FinanceMarket): Promise<FinanceMetrics> {
    return this.get<FinanceMetrics>('metrics', { symbol, market })
  }

  async fx(pair: string): Promise<FinanceFxRate> {
    return this.get<FinanceFxRate>('fx', { pair })
  }

  async rates(category: FinanceRateCategory): Promise<FinanceRateQuote[]> {
    return this.get<FinanceRateQuote[]>('rates', { category })
  }

  async screener(filter: ScreenerFilter): Promise<ScreenerResult> {
    return this.get<ScreenerResult>('screener', {
      market: filter.market,
      industry: filter.industry,
      minMarketCap: filter.minMarketCap,
      maxMarketCap: filter.maxMarketCap,
      minPe: filter.minPe,
      maxPe: filter.maxPe,
      minPb: filter.minPb,
      maxPb: filter.maxPb,
      minRoe: filter.minRoe,
      minChangePct: filter.minChangePct,
      maxChangePct: filter.maxChangePct,
    })
  }

  async kline(symbol: string, market: FinanceMarket, period: FinanceKlinePeriod, limit: number): Promise<FinanceKlineResult> {
    return this.get<FinanceKlineResult>('kline', { symbol, market, period, limit })
  }

  async moneyflow(symbol: string, market: FinanceMarket): Promise<FinanceMoneyflow> {
    return this.get<FinanceMoneyflow>('moneyflow', { symbol, market })
  }

  async announcements(symbol: string, market: FinanceMarket, category: FinanceAnnouncementCategory | undefined, limit: number): Promise<FinanceAnnouncementResult> {
    return this.get<FinanceAnnouncementResult>('announcements', { symbol, market, category, limit })
  }

  async news(category: FinanceNewsCategory | undefined, limit: number, symbol?: string): Promise<FinanceNewsResult> {
    return this.get<FinanceNewsResult>('news', { category, limit, symbol })
  }

  async macro(indicator: FinanceMacroIndicator, period?: string): Promise<FinanceMacro> {
    return this.get<FinanceMacro>('macro', { indicator, period })
  }

  async sector(market: FinanceMarket, category: FinanceSectorCategory, limit: number): Promise<FinanceSectorResult> {
    return this.get<FinanceSectorResult>('sector', { market, category, limit })
  }

  async risk(symbol: string, market: FinanceMarket, benchmark: string, riskFreeRate: number, period: number): Promise<FinanceRiskResult> {
    return this.get<FinanceRiskResult>('risk', { symbol, market, benchmark, riskFreeRate, period })
  }

  async fund(category: FinanceFundCategory, symbol?: string, limit?: number): Promise<FinanceFundResult> {
    return this.get<FinanceFundResult>('fund', { category, symbol, limit })
  }

  async research(symbol: string, market: FinanceMarket, limit: number): Promise<FinanceResearchResult> {
    return this.get<FinanceResearchResult>('research', { symbol, market, limit })
  }
}

/** 按配置创建数据源实例。 */
export function createSource(config: {
  source: 'mock' | 'http'
  baseURL?: string
  apiKeyEnv?: string
}): FinanceDataSource {
  if (config.source === 'http') {
    return new HttpFinanceSource(config.baseURL ?? '', envKey(config.apiKeyEnv ?? 'FINANCE_API_KEY'))
  }
  return new MockFinanceSource()
}
