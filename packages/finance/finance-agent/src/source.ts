/**
 * 金融数据源适配层：定义统一的数据契约，内置两种实现——
 *  - `mock`：内置示例数据（演示/无 key 验证，数据明确标注为示例）
 *  - `http`：可配置的 HTTP JSON 数据源（对接任意行情/财务接口服务）
 *
 * 产品化后可在同一接口下增加更多数据源（交易所直连、聚源/Wind 类终端、
 * 自建聚合服务等），对工具层完全透明。
 * @module @deepseek-ai/dsh-finance-agent/src/source
 */

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

/** 选股筛选项。 */
export interface ScreenerFilter {
  market?: FinanceMarket
  industry?: string
  minMarketCap?: number
  maxMarketCap?: number
  maxPe?: number
  minChangePct?: number
}

/** 选股结果行。 */
export interface ScreenerRow {
  symbol: string
  name: string
  market: FinanceMarket
  industry: string
  price: number
  changePct: number
  pe: number
  marketCap: number
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

/** 数据源统一接口：工具层只依赖本契约。 */
export interface FinanceDataSource {
  quote(symbol: string, market: FinanceMarket): Promise<FinanceQuote>
  financials(symbol: string, market: FinanceMarket, year?: number): Promise<FinanceFinancials>
  metrics(symbol: string, market: FinanceMarket): Promise<FinanceMetrics>
  screener(filter: ScreenerFilter): Promise<ScreenerRow[]>
  fx(pair: string): Promise<FinanceFxRate>
  rates(category: FinanceRateCategory): Promise<FinanceRateQuote[]>
  kline(symbol: string, market: FinanceMarket, period: FinanceKlinePeriod, limit: number): Promise<FinanceKlineResult>
  moneyflow(symbol: string, market: FinanceMarket): Promise<FinanceMoneyflow>
  announcements(symbol: string, market: FinanceMarket, category: FinanceAnnouncementCategory | undefined, limit: number): Promise<FinanceAnnouncementResult>
  news(category: FinanceNewsCategory | undefined, limit: number, symbol?: string): Promise<FinanceNewsResult>
  macro(indicator: FinanceMacroIndicator, period?: string): Promise<FinanceMacro>
  sector(market: FinanceMarket, category: FinanceSectorCategory, limit: number): Promise<FinanceSectorResult>
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

/** 内置示例数据源：开箱即用，所有数据带 mock 标记。 */
export class MockFinanceSource implements FinanceDataSource {
  async quote(symbol: string, market: FinanceMarket): Promise<FinanceQuote> {
    const row = MOCK_QUOTES[symbol]
    if (row === undefined || row.market !== market) {
      throw new Error(`mock 数据源未收录 ${market}:${symbol}（内置示例：600519/000858/601318/AAPL/0700）`)
    }
    return { ...row, mock: true }
  }

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

  async metrics(symbol: string, market: FinanceMarket): Promise<FinanceMetrics> {
    const row = MOCK_METRICS[symbol]
    if (row === undefined || row.market !== market) {
      throw new Error(`mock 数据源未收录 ${market}:${symbol} 的估值数据`)
    }
    return { ...row, mock: true }
  }

  async fx(pair: string): Promise<FinanceFxRate> {
    const row = MOCK_FX[pair.toUpperCase()]
    if (row === undefined) {
      throw new Error(`mock 数据源未收录汇率 ${pair}（内置示例：${Object.keys(MOCK_FX).join('/')}）`)
    }
    return { ...row, mock: true }
  }

  async rates(category: FinanceRateCategory): Promise<FinanceRateQuote[]> {
    const rows = MOCK_RATES[category]
    if (rows === undefined) {
      throw new Error(`mock 数据源未收录利率类别 ${category}（可选 deposit/lpr/bond）`)
    }
    return rows.map((row) => ({ ...row, mock: true }))
  }

  async screener(filter: ScreenerFilter): Promise<ScreenerRow[]> {
    const rows: ScreenerRow[] = Object.values(MOCK_QUOTES)
      .filter((q) => filter.market === undefined || q.market === filter.market)
      .map((q) => ({
        symbol: q.symbol,
        name: q.name,
        market: q.market,
        industry: q.symbol === '600519' || q.symbol === '000858' ? '食品饮料' : q.symbol === '601318' ? '非银金融' : q.market === 'us' ? '科技硬件' : '互联网',
        price: q.price,
        changePct: q.changePct,
        pe: MOCK_METRICS[q.symbol]?.pe ?? 0,
        marketCap: q.marketCap,
      }))
      .filter((r) => filter.industry === undefined || r.industry === filter.industry)
      .filter((r) => filter.minMarketCap === undefined || r.marketCap >= filter.minMarketCap)
      .filter((r) => filter.maxMarketCap === undefined || r.marketCap <= filter.maxMarketCap)
      .filter((r) => filter.maxPe === undefined || r.pe <= filter.maxPe)
      .filter((r) => filter.minChangePct === undefined || r.changePct >= filter.minChangePct)
    return rows
  }

  async kline(symbol: string, market: FinanceMarket, period: FinanceKlinePeriod, limit: number): Promise<FinanceKlineResult> {
    const quote = MOCK_QUOTES[symbol]
    if (quote === undefined || quote.market !== market) {
      throw new Error(`mock 数据源未收录 ${market}:${symbol} 的K线数据（内置示例：600519/000858/601318/AAPL/0700）`)
    }
    const count = Math.max(1, Math.min(limit, 120))
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

  async moneyflow(symbol: string, market: FinanceMarket): Promise<FinanceMoneyflow> {
    const row = MOCK_MONEYFLOW[symbol]
    if (row === undefined || row.market !== market) {
      throw new Error(`mock 数据源未收录 ${market}:${symbol} 的资金流向数据`)
    }
    return { ...row, mock: true }
  }

  async announcements(symbol: string, market: FinanceMarket, category: FinanceAnnouncementCategory | undefined, limit: number): Promise<FinanceAnnouncementResult> {
    const group = MOCK_ANNOUNCEMENTS[symbol]
    if (group === undefined || group.market !== market) {
      throw new Error(`mock 数据源未收录 ${market}:${symbol} 的公告（内置示例：600519/000858/601318）`)
    }
    const filtered = category === undefined ? group.items : group.items.filter((item) => item.category === category)
    const items = filtered.slice(0, Math.max(1, limit))
    return { symbol, name: group.name, market, total: filtered.length, items, updatedAt: '2026-09-24T16:00:00+08:00', mock: true }
  }

  async news(category: FinanceNewsCategory | undefined, limit: number, symbol?: string): Promise<FinanceNewsResult> {
    let items = category === undefined ? MOCK_NEWS.slice() : MOCK_NEWS.filter((item) => newsCategoryOf(item) === category)
    if (symbol !== undefined && symbol.length > 0) {
      const name = symbolName(symbol)
      items = items.filter((item) => item.title.includes(symbol) || item.summary.includes(symbol) || (name.length > 0 && (item.title.includes(name) || item.summary.includes(name))))
    }
    const total = items.length
    return { category: category ?? 'market', total, items: items.slice(0, Math.max(1, limit)), updatedAt: '2026-09-24T16:30:00+08:00', mock: true }
  }

  async macro(indicator: FinanceMacroIndicator, period?: string): Promise<FinanceMacro> {
    const row = MOCK_MACRO[indicator]
    if (row === undefined) {
      throw new Error(`mock 数据源未收录宏观指标 ${indicator}`)
    }
    return period === undefined ? { ...row, mock: true } : { ...row, period, mock: true }
  }

  async sector(market: FinanceMarket, category: FinanceSectorCategory, limit: number): Promise<FinanceSectorResult> {
    void market
    void category
    const items = MOCK_SECTORS.slice(0, Math.max(1, Math.min(limit, MOCK_SECTORS.length)))
    return { market: 'cn', category, total: MOCK_SECTORS.length, items, updatedAt: '2026-09-24T15:00:00+08:00', mock: true }
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

  async screener(filter: ScreenerFilter): Promise<ScreenerRow[]> {
    return this.get<ScreenerRow[]>('screener', {
      market: filter.market,
      industry: filter.industry,
      minMarketCap: filter.minMarketCap,
      maxMarketCap: filter.maxMarketCap,
      maxPe: filter.maxPe,
      minChangePct: filter.minChangePct,
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
