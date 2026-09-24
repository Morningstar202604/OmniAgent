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

/** 数据源统一接口：工具层只依赖本契约。 */
export interface FinanceDataSource {
  quote(symbol: string, market: FinanceMarket): Promise<FinanceQuote>
  financials(symbol: string, market: FinanceMarket, year?: number): Promise<FinanceFinancials>
  metrics(symbol: string, market: FinanceMarket): Promise<FinanceMetrics>
  screener(filter: ScreenerFilter): Promise<ScreenerRow[]>
  fx(pair: string): Promise<FinanceFxRate>
  rates(category: FinanceRateCategory): Promise<FinanceRateQuote[]>
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
