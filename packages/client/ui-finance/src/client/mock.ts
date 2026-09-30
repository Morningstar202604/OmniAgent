/**
 * 金融专业面板的前端示例数据。
 *
 * 后端 finance-agent 已注册 17 个金融工具（finance_quote / finance_kline /
 * finance_research …），但它们是 Agent 侧工具（由大模型调用），尚未对浏览器暴露
 * RPC。本面板先用与后端 source.ts 对齐形状的内置示例数据呈现完整终端结构，
 * 并打「演示数据」角标；后续接通 ctx.remote / host RPC 后替换为真实工具调用。
 */

/** 行情条目（对齐 FinanceQuote）。 */
export interface QuoteRow {
  symbol: string
  name: string
  market: 'cn' | 'hk' | 'us'
  price: number
  change: number
  changePct: number
  open: number
  high: number
  low: number
  prevClose: number
  volume: number
  turnover: number
  marketCap: number
  pe: number
  pb: number
  currency: string
}

/** K线单根（对齐 FinanceKlineBar）。 */
export interface KlineBar {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/** 券商研报条目（对齐 FinanceResearchItem）。 */
export interface ResearchRow {
  id: string
  title: string
  institution: string
  analyst: string
  rating: '买入' | '增持' | '持有' | '卖出'
  targetPrice: number
  reportDate: string
  summary: string
}

/** 公司公告条目（对齐 FinanceAnnouncementItem）。 */
export interface AnnouncementRow {
  id: string
  title: string
  category: string
  publishDate: string
  summary: string
}

/** 财经资讯条目（对齐 FinanceNewsItem）。 */
export interface NewsRow {
  id: string
  title: string
  source: string
  publishTime: string
  summary: string
  tags: string[]
}

/** 顶部行情条：主要指数 + 热门个股。 */
export const QUOTES: QuoteRow[] = [
  { symbol: '000001', name: '上证指数', market: 'cn', price: 3247.58, change: 18.42, changePct: 0.57, open: 3226.1, high: 3255.9, low: 3218.4, prevClose: 3229.16, volume: 3.82e8, turnover: 4.12e11, marketCap: 4.62e13, pe: 12.4, pb: 1.35, currency: 'CNY' },
  { symbol: '399001', name: '深证成指', market: 'cn', price: 10582.31, change: -42.15, changePct: -0.40, open: 10630.2, high: 10665.0, low: 10540.8, prevClose: 10624.46, volume: 4.21e8, turnover: 5.03e11, marketCap: 6.18e13, pe: 23.1, pb: 2.62, currency: 'CNY' },
  { symbol: '399006', name: '创业板指', market: 'cn', price: 2145.72, change: 12.08, changePct: 0.57, open: 2130.5, high: 2155.2, low: 2128.1, prevClose: 2133.64, volume: 1.21e8, turnover: 2.08e11, marketCap: 1.31e13, pe: 38.6, pb: 4.10, currency: 'CNY' },
  { symbol: 'HSI', name: '恒生指数', market: 'hk', price: 20876.4, change: -156.3, changePct: -0.74, open: 21040.0, high: 21098.5, low: 20820.1, prevClose: 21032.7, volume: 1.86e8, turnover: 1.92e11, marketCap: 3.88e13, pe: 9.8, pb: 1.02, currency: 'HKD' },
  { symbol: 'IXIC', name: '纳斯达克', market: 'us', price: 17862.9, change: 214.5, changePct: 1.21, open: 17655.0, high: 17901.2, low: 17620.4, prevClose: 17648.4, volume: 4.05e8, turnover: 2.41e12, marketCap: 2.12e14, pe: 32.4, pb: 5.20, currency: 'USD' },
  { symbol: '600519', name: '贵州茅台', market: 'cn', price: 1688.0, change: 12.0, changePct: 0.72, open: 1676.0, high: 1695.5, low: 1670.2, prevClose: 1676.0, volume: 2.84e6, turnover: 4.78e9, marketCap: 2.12e12, pe: 28.6, pb: 8.9, currency: 'CNY' },
  { symbol: '300750', name: '宁德时代', market: 'cn', price: 187.45, change: -3.20, changePct: -1.68, open: 190.2, high: 191.0, low: 186.3, prevClose: 190.65, volume: 4.12e7, turnover: 7.76e9, marketCap: 8.26e11, pe: 21.3, pb: 4.2, currency: 'CNY' },
  { symbol: '601318', name: '中国平安', market: 'cn', price: 48.62, change: 0.88, changePct: 1.84, open: 47.9, high: 49.05, low: 47.75, prevClose: 47.74, volume: 6.84e7, turnover: 3.33e9, marketCap: 8.86e11, pe: 9.2, pb: 0.98, currency: 'CNY' },
  { symbol: '0700', name: '腾讯控股', market: 'hk', price: 378.6, change: 4.2, changePct: 1.12, open: 374.0, high: 380.5, low: 373.2, prevClose: 374.4, volume: 2.04e7, turnover: 7.72e9, marketCap: 3.52e12, pe: 18.4, pb: 3.6, currency: 'HKD' },
  { symbol: 'AAPL', name: '苹果', market: 'us', price: 227.73, change: 3.12, changePct: 1.39, open: 225.0, high: 228.4, low: 224.6, prevClose: 224.61, volume: 5.12e7, turnover: 1.16e10, marketCap: 3.47e12, pe: 33.1, pb: 58.2, currency: 'USD' },
]

/** 由基准价生成一段确定性的日K（收盘价折线），供最小可用 K 线图。 */
export function buildKline(basePrice: number, points = 48): KlineBar[] {
  const bars: KlineBar[] = []
  let close = basePrice * 0.92
  const today = new Date('2026-09-25T15:00:00+08:00')
  for (let i = points - 1; i >= 0; i--) {
    const wave = Math.sin(i / 4.5) * 0.012 + Math.sin(i / 1.7) * 0.006
    const drift = (points - i) / points * (basePrice * 0.08)
    close = basePrice * 0.92 + drift + basePrice * wave
    const open = close * (1 + (Math.sin(i * 1.3) * 0.004))
    const high = Math.max(open, close) * (1 + 0.006 + Math.abs(Math.sin(i)) * 0.004)
    const low = Math.min(open, close) * (1 - 0.006 - Math.abs(Math.cos(i)) * 0.004)
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    bars.push({
      date: date.toISOString().slice(0, 10),
      open: round2(open),
      high: round2(high),
      low: round2(low),
      close: round2(close),
      volume: Math.round((2 + Math.abs(Math.sin(i * 0.9)) * 6) * 1e6),
    })
  }
  return bars
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** 技术指标（对齐 finance_technical 的演示值）。 */
export function buildTechnical(bars: KlineBar[]): { sma5: number; sma20: number; rsi: number; macd: number } {
  const last = bars[bars.length - 1]?.close ?? 100
  const avg = (n: number): number => {
    const slice = bars.slice(-n)
    return slice.reduce((sum, b) => sum + b.close, 0) / Math.max(1, slice.length)
  }
  return {
    sma5: round2(avg(5)),
    sma20: round2(avg(20)),
    rsi: round2(48 + Math.sin(last) * 18),
    macd: round2(last * 0.0012 * Math.sin(last / 7)),
  }
}

/** 券商研报（对齐 finance_research）。 */
export const RESEARCH: ResearchRow[] = [
  { id: 'R600519001', title: '高端白酒动销稳健，三季度业绩前瞻超预期', institution: '中信证券', analyst: '研究员 A', rating: '买入', targetPrice: 1850, reportDate: '2026-09-22', summary: '中秋国庆双节动销同比改善，渠道库存回落至健康水平，维持买入评级。' },
  { id: 'R300750002', title: '储能业务高增，海外出货占比提升', institution: '国泰君安', analyst: '研究员 B', rating: '增持', targetPrice: 210, reportDate: '2026-09-20', summary: '欧洲储能订单饱满，毛利率环比改善，看好全年出货量。' },
  { id: 'R601318003', title: '寿险新单保费转正，投资端弹性可期', institution: '华泰证券', analyst: '研究员 C', rating: '买入', targetPrice: 55, reportDate: '2026-09-18', summary: '代理人队伍企稳，NbV 同比转正，利率中枢回落压制估值修复空间。' },
  { id: 'R07000004', title: '视频号广告与游戏双轮驱动，利润率持续扩张', institution: '中金公司', analyst: '研究员 D', rating: '买入', targetPrice: 430, reportDate: '2026-09-15', summary: '微信生态商业化深化，AI 降本增效推动经调整利润率上行。' },
]

/** 公司公告（对齐 finance_announcements）。 */
export const ANNOUNCEMENTS: AnnouncementRow[] = [
  { id: 'A001', title: '2026 年半年度报告摘要', category: 'quarterly_report', publishDate: '2026-08-28', summary: '上半年营收同比 +12.3%，归母净利润同比 +9.7%。' },
  { id: 'A002', title: '2026 年中期利润分配预案公告', category: 'dividend', publishDate: '2026-08-28', summary: '拟每 10 股派发现金红利 25.91 元（含税）。' },
  { id: 'A003', title: '关于回购公司股份方案的公告', category: 'ma_equity_change', publishDate: '2026-09-10', summary: '拟以集中竞价方式回购不超过 10 亿元公司股份。' },
  { id: 'A004', title: '关于召开 2026 年第三次临时股东大会的通知', category: 'other', publishDate: '2026-09-18', summary: '会议将于 10 月上旬召开，审议相关议案。' },
]

/** 财经资讯（对齐 finance_news）。 */
export const NEWS: NewsRow[] = [
  { id: 'N001', title: '央行开展 8000 亿元中期借贷便利操作，利率持平', source: '新华财经', publishTime: '2026-09-25 09:20', summary: '为维护银行体系流动性合理充裕，央行开展 MLF 操作，中标利率维持不变。', tags: ['macro', 'policy'] },
  { id: 'N002', title: 'A股三大指数集体收涨，新能源板块领涨', source: '证券时报', publishTime: '2026-09-25 15:10', summary: '沪指涨 0.57%，创业板指涨 0.57%，动力电池板块资金净流入居前。', tags: ['market'] },
  { id: 'N003', title: '国常会：部署进一步扩消费稳投资政策举措', source: '中国政府网', publishTime: '2026-09-24 18:00', summary: '围绕服务消费、数字消费等领域推出一揽子接续政策。', tags: ['policy', 'macro'] },
  { id: 'N004', title: '半导体设备国产替代加速，多家公司订单饱满', source: '上海证券报', publishTime: '2026-09-24 11:30', summary: '下游晶圆厂扩产带动前道设备需求，国产厂商份额持续提升。', tags: ['industry', 'company'] },
  { id: 'N005', title: '美联储会议纪要显示降息路径存在分歧', source: '华尔街见闻', publishTime: '2026-09-24 02:00', summary: '官员对通胀回落节奏看法不一，市场预计 12 月降息概率上升。', tags: ['macro', 'market'] },
]

/** 专业功能入口卡片。 */
export interface FunctionEntry {
  id: string
  titleKey: 'fnScreener' | 'fnChain' | 'fnFinancials' | 'fnRisk' | 'fnMacro' | 'fnSector' | 'fnMoneyflow'
  descKey: 'fnScreenerDesc' | 'fnChainDesc' | 'fnFinancialsDesc' | 'fnRiskDesc' | 'fnMacroDesc' | 'fnSectorDesc' | 'fnMoneyflowDesc'
}

export const FUNCTIONS: FunctionEntry[] = [
  { id: 'screener', titleKey: 'fnScreener', descKey: 'fnScreenerDesc' },
  { id: 'chain', titleKey: 'fnChain', descKey: 'fnChainDesc' },
  { id: 'financials', titleKey: 'fnFinancials', descKey: 'fnFinancialsDesc' },
  { id: 'risk', titleKey: 'fnRisk', descKey: 'fnRiskDesc' },
  { id: 'macro', titleKey: 'fnMacro', descKey: 'fnMacroDesc' },
  { id: 'sector', titleKey: 'fnSector', descKey: 'fnSectorDesc' },
  { id: 'moneyflow', titleKey: 'fnMoneyflow', descKey: 'fnMoneyflowDesc' },
]

/** 类别中文映射。 */
export const ANNOUNCEMENT_CATEGORY_ZH: Record<string, string> = {
  annual_report: '年报',
  quarterly_report: '季报',
  dividend: '分红',
  ma_equity_change: '重大事项',
  other: '其他',
}

// ───────────────────────────── 选股器（前端确定性筛选） ─────────────────────────────

/** 选股结果行（对齐后端 finance_screener 的 ScreenerRow）。 */
export interface ScreenerRow {
  symbol: string
  name: string
  market: 'cn' | 'hk' | 'us'
  industry: string
  price: number
  changePct: number
  pe: number
  pb: number
  roe: number
  marketCap: number
}

/**
 * 选股示例股票池（30 只，与后端 source.ts MOCK_SCREENER_UNIVERSE 同口径）。
 * 前端暂无 host RPC，先在浏览器内做同样的确定性过滤，结果可与后端逐只对照复核。
 */
export const SCREENER_UNIVERSE: ScreenerRow[] = [
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
  { symbol: '0700', name: '腾讯控股', market: 'hk', industry: '互联网', price: 378.6, changePct: 1.12, pe: 18.4, pb: 3.6, roe: 28.4, marketCap: 3.52e12 },
  { symbol: '9988', name: '阿里巴巴-W', market: 'hk', industry: '互联网', price: 78.4, changePct: -0.95, pe: 12.6, pb: 1.9, roe: 11.2, marketCap: 2.30e12 },
  { symbol: '3690', name: '美团-W', market: 'hk', industry: '互联网', price: 118.2, changePct: 2.31, pe: 22.8, pb: 3.1, roe: 15.4, marketCap: 7.80e11 },
  { symbol: 'AAPL', name: '苹果', market: 'us', industry: '科技硬件', price: 227.73, changePct: 1.39, pe: 33.1, pb: 58.2, roe: 156.3, marketCap: 3.47e12 },
  { symbol: 'MSFT', name: '微软', market: 'us', industry: '软件', price: 442.5, changePct: 0.85, pe: 36.5, pb: 12.8, roe: 38.2, marketCap: 3.10e12 },
  { symbol: 'NVDA', name: '英伟达', market: 'us', industry: '半导体', price: 138.4, changePct: 3.25, pe: 52.4, pb: 42.5, roe: 112.6, marketCap: 3.80e12 },
  { symbol: 'JPM', name: '摩根大通', market: 'us', industry: '银行', price: 224.6, changePct: 0.42, pe: 13.2, pb: 1.8, roe: 16.5, marketCap: 6.20e11 },
  { symbol: 'BRK-B', name: '伯克希尔B', market: 'us', industry: '综合金融', price: 472.8, changePct: 0.28, pe: 9.8, pb: 1.3, roe: 9.5, marketCap: 1.00e12 },
  { symbol: '601988', name: '中国银行', market: 'cn', industry: '银行', price: 4.92, changePct: 0.38, pe: 5.8, pb: 0.6, roe: 9.2, marketCap: 1.70e12 },
  { symbol: '1810', name: '小米集团-W', market: 'hk', industry: '消费电子', price: 23.5, changePct: 2.08, pe: 25.6, pb: 3.8, roe: 19.5, marketCap: 8.90e11 },
]

/** 选股筛选条件（全部可选，空串/undefined 表示不限制）。 */
export interface ScreenerCriteria {
  market: '' | 'cn' | 'hk' | 'us'
  industry: string
  minPe: string
  maxPe: string
  minPb: string
  maxPb: string
  minRoe: string
  minChangePct: string
  maxChangePct: string
}

/** 空筛选条件默认值。 */
export const EMPTY_SCREENER: ScreenerCriteria = {
  market: '', industry: '', minPe: '', maxPe: '', minPb: '', maxPb: '', minRoe: '', minChangePct: '', maxChangePct: '',
}

/** 行业下拉选项（来自股票池去重）。 */
export const SCREENER_INDUSTRIES: string[] = Array.from(new Set(SCREENER_UNIVERSE.map((r) => r.industry))).sort()

/** 确定性前端筛选：与后端同口径闭区间过滤，按市值降序返回。 */
export function runScreener(c: ScreenerCriteria): { items: ScreenerRow[]; formula: string } {
  const num = (s: string): number | undefined => (s.trim() === '' ? undefined : Number(s))
  const minPe = num(c.minPe); const maxPe = num(c.maxPe)
  const minPb = num(c.minPb); const maxPb = num(c.maxPb)
  const minRoe = num(c.minRoe)
  const minChg = num(c.minChangePct); const maxChg = num(c.maxChangePct)

  const items = SCREENER_UNIVERSE
    .filter((r) => c.market === '' || r.market === c.market)
    .filter((r) => c.industry === '' || r.industry === c.industry)
    .filter((r) => minPe === undefined || r.pe >= minPe)
    .filter((r) => maxPe === undefined || r.pe <= maxPe)
    .filter((r) => minPb === undefined || r.pb >= minPb)
    .filter((r) => maxPb === undefined || r.pb <= maxPb)
    .filter((r) => minRoe === undefined || r.roe >= minRoe)
    .filter((r) => minChg === undefined || r.changePct >= minChg)
    .filter((r) => maxChg === undefined || r.changePct <= maxChg)
    .slice()
    .sort((a, b) => b.marketCap - a.marketCap)

  const parts: string[] = []
  if (c.market !== '') parts.push(`市场=${c.market.toUpperCase()}`)
  if (c.industry !== '') parts.push(`行业=${c.industry}`)
  if (minPe !== undefined || maxPe !== undefined) parts.push(`PE∈[${minPe ?? '—'}, ${maxPe ?? '—'}]`)
  if (minPb !== undefined || maxPb !== undefined) parts.push(`PB∈[${minPb ?? '—'}, ${maxPb ?? '—'}]`)
  if (minRoe !== undefined) parts.push(`ROE≥${minRoe}%`)
  if (minChg !== undefined || maxChg !== undefined) parts.push(`当日涨跌∈[${minChg ?? '—'}%, ${maxChg ?? '—'}%]`)
  const formula = parts.length === 0 ? '无过滤条件（全池展示，按市值降序）' : parts.join(' 且 ')
  return { items, formula }
}

// ───────────────────────────── 产业链图谱 ─────────────────────────────

/** 产业链环节：上游 / 中游 / 下游。 */
export type ChainStage = 'upstream' | 'midstream' | 'downstream'

/** 产业链节点卡片数据。 */
export interface ChainNode {
  id: string
  /** 环节名，如 锂矿 / 正极材料 / 动力电池 / 整车。 */
  name: string
  /** 环节简述。 */
  desc: string
  /** 代表公司。 */
  companies: string[]
  /** 该环节在产业链中的权重（占比 %，仅示意）。 */
  weight: number
}

/** 一条产业链：按上中下游组织节点。 */
export interface IndustryChain {
  id: string
  name: string
  upstream: ChainNode[]
  midstream: ChainNode[]
  downstream: ChainNode[]
}

/** 示例：新能源汽车产业链（上下游结构，纯前端示意数据）。 */
export const EV_CHAIN: IndustryChain = {
  id: 'ev',
  name: '新能源汽车产业链',
  upstream: [
    { id: 'u1', name: '锂矿资源', desc: '碳酸锂/氢氧化锂上游，价格周期波动大', companies: ['天齐锂业', '赣锋锂业', '盐湖股份'], weight: 18 },
    { id: 'u2', name: '钴/镍资源', desc: '三元正极金属原料', companies: ['华友钴业', '洛阳钼业', '格林美'], weight: 10 },
    { id: 'u3', name: '正极材料', desc: '三元/磷酸铁锂正极', companies: ['容百科技', '湖南裕能', '德方纳米'], weight: 16 },
    { id: 'u4', name: '负极材料', desc: '人造石墨/硅基负极', companies: ['贝特瑞', '璞泰来', '杉杉股份'], weight: 9 },
    { id: 'u5', name: '隔膜/电解液', desc: '湿法隔膜、六氟磷酸锂电解液', companies: ['恩捷股份', '天赐材料', '新宙邦'], weight: 11 },
  ],
  midstream: [
    { id: 'm1', name: '动力电池', desc: '电芯/电池包，产业链价值量核心', companies: ['宁德时代', '比亚迪', '中创新航'], weight: 22 },
    { id: 'm2', name: '电机电控', desc: '驱动电机与电机控制器', companies: ['汇川技术', '精进电动', '比亚迪'], weight: 7 },
    { id: 'm3', name: '整车制造', desc: '乘用车/商用车整车集成', companies: ['比亚迪', '特斯拉', '蔚小理'], weight: 4 },
  ],
  downstream: [
    { id: 'd1', name: '充电桩/换电', desc: '补能基础设施运营', companies: ['特锐德', '星星充电', '宁德时代'], weight: 8 },
    { id: 'd2', name: '整车回收', desc: '退役电池梯次利用与再生', companies: ['格林美', '邦普循环', '天奇股份'], weight: 4 },
    { id: 'd3', name: '智能驾驶', desc: '智驾方案/车载芯片/座舱', companies: ['华为车BU', '地平线', '德赛西威'], weight: 12 },
  ],
}
