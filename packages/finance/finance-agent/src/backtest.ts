/**
 * 选股回测引擎（最小可用版，纯 TypeScript 确定性计算，可手工复核）。
 *
 * 设计原则：
 *  - 纯函数、零副作用：给定相同的 K 线序列与参数，结果逐位一致。
 *  - 公式透明：输出中附带指标计算公式与中间过程，便于人工复核。
 *  - 不引入 pandas/numpy 等重型依赖，全部为本地数值循环。
 *
 * 支持策略：
 *  - dual_ma：双均线交叉。短期均线上穿长期均线（金叉）买入，下穿（死叉）卖出。
 *  - dca：定投。每隔固定交易日用固定金额买入，不止盈不止损。
 *
 * @module @deepseek-ai/dsh-finance-agent/src/backtest
 */

import type { FinanceKlineBar } from './source.ts'
import { dailyReturns, sharpeRatio, maxDrawdown } from './calc.ts'

/** 策略类型。 */
export type BacktestStrategy = 'dual_ma' | 'dca'

/** 回测入参（单标的）。 */
export interface BacktestParams {
  /** 策略类型。 */
  strategy: BacktestStrategy
  /** 初始资金（元）。 */
  initialCash: number
  /** 单边手续费率（小数，如 0.0003 = 万三），买入与卖出各收一次。 */
  feeRate: number
  /** dual_ma：短期均线窗口（交易日）。 */
  shortWindow: number
  /** dual_ma：长期均线窗口（交易日）。 */
  longWindow: number
  /** dual_ma：每次开仓使用的现金比例（0~1），1=满仓。 */
  positionPct: number
  /** dca：定投间隔（交易日）。 */
  dcaInterval: number
  /** dca：每期投入金额（元）。 */
  dcaAmount: number
}

/** 一笔交易记录。 */
export interface BacktestTrade {
  /** 交易日期 YYYY-MM-DD。 */
  date: string
  /** 买入 / 卖出。 */
  action: 'buy' | 'sell'
  /** 成交价（当日收盘）。 */
  price: number
  /** 成交股数。 */
  shares: number
  /** 成交金额（不含手续费）。 */
  amount: number
  /** 手续费。 */
  fee: number
}

/** 净值曲线单点。 */
export interface EquityPoint {
  date: string
  /** 当日收盘后的总权益 = 现金 + 持仓市值。 */
  equity: number
}

/** 一次完整的买卖回合（用于胜率/盈亏比统计）。 */
interface RoundTrip {
  entryPrice: number
  entryDate: string
  exitPrice: number
  exitDate: string
  shares: number
  /** 该回合净盈亏（已扣除双边手续费）。 */
  pnl: number
}

/** 回测结果。 */
export interface BacktestResult {
  strategy: BacktestStrategy
  /** 回测区间首日（含）。 */
  startDate: string
  /** 回测区间末日（含）。 */
  endDate: string
  /** 实际参与回测的交易日数。 */
  tradingDays: number
  initialCash: number
  /** 期末总权益。 */
  finalEquity: number
  /** 累计收益率（%）。公式：(期末权益 − 初始资金) / 初始资金 × 100%。 */
  totalReturnPct: number
  /** 年化收益率（%）。公式：((期末/初始)^(252/交易日数) − 1) × 100%。 */
  annualizedReturnPct: number
  /** 最大回撤（%，负数）。公式：max((峰值−谷值)/峰值)，作用于净值曲线。 */
  maxDrawdownPct: number
  /** 夏普比率（无风险利率取 2%）。公式：(年化收益 − 无风险利率) / 年化波动。 */
  sharpeRatio: number
  /** 胜率（%）。公式：盈利回合数 / 已平仓回合数 × 100%；无平仓回合为 null。 */
  winRatePct: number | null
  /** 完成的买卖回合数（= 交易次数 / 2，近似）。 */
  tradeCount: number
  /** 盈亏比：总盈利 / 总亏损（绝对值）；无亏损回合为 null。 */
  profitFactor: number | null
  /** 期末现金。 */
  endingCash: number
  /** 期末持股数。 */
  endingShares: number
  trades: BacktestTrade[]
  equityCurve: EquityPoint[]
  /** 可复核的公式说明文本。 */
  formulas: string[]
}

/** 简单移动平均（SMA）：返回从第 period-1 个点开始的值序列（前面为 null）。 */
function smaSeries(closes: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array<number | null>(closes.length).fill(null)
  let sum = 0
  for (let i = 0; i < closes.length; i++) {
    sum += closes[i] as number
    if (i >= period) sum -= closes[i - period] as number
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

/** 四舍五入到分（金额）。 */
function r2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * 对单标的 K 线序列执行回测（纯函数）。
 * @param bars 按时间升序的日 K 线（至少需覆盖 longWindow + 回测天数）。
 * @param params 回测参数。
 * @returns 回测结果（确定性）。
 */
export function runBacktest(bars: FinanceKlineBar[], params: BacktestParams): BacktestResult {
  if (bars.length < params.longWindow + 5) {
    throw new Error(`K线数据不足：至少需要 ${params.longWindow + 5} 根，实际 ${bars.length} 根`)
  }

  const closes = bars.map((b) => b.close)
  const fees = params.feeRate

  // —— 策略状态 ——
  let cash = params.initialCash
  let shares = 0
  const trades: BacktestTrade[] = []
  const roundTrips: RoundTrip[] = []
  let openEntryPrice = 0
  let openEntryDate = ''
  const equityCurve: EquityPoint[] = []

  const smaShort = smaSeries(closes, params.shortWindow)
  const smaLong = smaSeries(closes, params.longWindow)

  // 从长期均线首次有值的位置开始回测（前面是指标预热期）。
  const startIdx = params.longWindow - 1
  let nextDcaIdx = startIdx

  for (let i = startIdx; i < bars.length; i++) {
    const bar = bars[i] as FinanceKlineBar
    const price = bar.close

    if (params.strategy === 'dual_ma') {
      const sNow = smaShort[i] as number
      const lNow = smaLong[i] as number
      const sPrev = smaShort[i - 1]
      const lPrev = smaLong[i - 1]
      // 仅当两根均线前一日都有效时才判断交叉（避免预热边界误判）。
      if (sPrev !== null && sPrev !== undefined && lPrev !== null && lPrev !== undefined && Number.isFinite(sNow) && Number.isFinite(lNow)) {
        const goldenCross = sPrev <= lPrev && sNow > lNow
        const deathCross = sPrev >= lPrev && sNow < lNow
        if (goldenCross && shares === 0) {
          // 金叉买入：用 positionPct 比例的现金买入整手（100 股）。
          const budget = cash * params.positionPct
          const fee = budget * fees
          const investable = budget - fee
          const buyShares = Math.floor(investable / price / 100) * 100
          if (buyShares > 0) {
            const amount = buyShares * price
            const actualFee = amount * fees
            cash -= amount + actualFee
            shares += buyShares
            openEntryPrice = price
            openEntryDate = bar.date
            trades.push({ date: bar.date, action: 'buy', price, shares: buyShares, amount: r2(amount), fee: r2(actualFee) })
          }
        } else if (deathCross && shares > 0) {
          // 死叉卖出：全部清仓。
          const amount = shares * price
          const actualFee = amount * fees
          cash += amount - actualFee
          // 回合净盈亏 = (卖出价 − 买入价) × 股数 − 卖出手续费 − 买入手续费
          roundTrips.push({
            entryPrice: openEntryPrice,
            entryDate: openEntryDate,
            exitPrice: price,
            exitDate: bar.date,
            shares,
            pnl: (price - openEntryPrice) * shares - actualFee - lastBuyFee(trades),
          })
          trades.push({ date: bar.date, action: 'sell', price, shares, amount: r2(amount), fee: r2(actualFee) })
          shares = 0
          openEntryPrice = 0
          openEntryDate = ''
        }
      }
    } else {
      // dca 定投：每隔 dcaInterval 个交易日买入 dcaAmount 元。
      if (i >= nextDcaIdx) {
        const budget = params.dcaAmount
        const fee = budget * fees
        const investable = budget - fee
        const buyShares = Math.floor(investable / price / 100) * 100
        if (buyShares > 0 && cash >= budget) {
          const amount = buyShares * price
          const actualFee = amount * fees
          cash -= amount + actualFee
          shares += buyShares
          trades.push({ date: bar.date, action: 'buy', price, shares: buyShares, amount: r2(amount), fee: r2(actualFee) })
        }
        nextDcaIdx = i + params.dcaInterval
      }
    }

    // 当日收盘后权益。
    equityCurve.push({ date: bar.date, equity: r2(cash + shares * price) })
  }

  const first = bars[startIdx] as FinanceKlineBar
  const lastBar = bars[bars.length - 1] as FinanceKlineBar
  const finalEquity = cash + shares * lastBar.close
  const tradingDays = equityCurve.length

  // —— 绩效指标（全部基于净值曲线，公式透明可复核）——
  const totalReturnPct = (finalEquity - params.initialCash) / params.initialCash * 100
  const years = tradingDays / 252
  const annualizedReturnPct = years > 0 ? (Math.pow(finalEquity / params.initialCash, 1 / years) - 1) * 100 : 0
  const equitySeries = equityCurve.map((p) => p.equity)
  const mdd = maxDrawdown(equitySeries)
  const eqReturns = dailyReturns(equitySeries)
  // 夏普：样本不足或零波动（退化数据）时置 null，不抛错。
  let sharpe: number | null = null
  if (eqReturns.length >= 20) {
    try { sharpe = sharpeRatio(eqReturns, 2) } catch { sharpe = null }
  }

  // 胜率 / 盈亏比：基于已平仓回合。
  let winRatePct: number | null = null
  let profitFactor: number | null = null
  if (roundTrips.length > 0) {
    const wins = roundTrips.filter((r) => r.pnl > 0)
    winRatePct = wins.length / roundTrips.length * 100
    let grossProfit = 0
    let grossLoss = 0
    for (const r of roundTrips) {
      if (r.pnl > 0) grossProfit += r.pnl
      else grossLoss += -r.pnl
    }
    profitFactor = grossLoss > 0 ? grossProfit / grossLoss : null
  }

  const formulas = params.strategy === 'dual_ma'
    ? [
        `信号：SMA${params.shortWindow} 上穿 SMA${params.longWindow}（金叉）满仓买入；下穿（死叉）全部卖出。成交价=当日收盘价。`,
        `手续费：每笔成交金额 × ${(fees * 100).toFixed(3)}%，买卖双边各收一次。`,
        `累计收益率 = (期末权益 ${r2(finalEquity)} − 初始资金 ${params.initialCash}) / ${params.initialCash} × 100% = ${totalReturnPct.toFixed(2)}%`,
        `年化收益率 = ((期末/初始)^(252/${tradingDays}) − 1) × 100% = ${annualizedReturnPct.toFixed(2)}%`,
        `最大回撤 = min((当日净值 − 历史峰值)/历史峰值) × 100% = ${mdd.toFixed(2)}%`,
        `夏普比率 = (年化收益 − 无风险利率2%) / 年化波动(日收益标准差×√252) = ${sharpe === null ? '样本不足' : sharpe.toFixed(3)}`,
        `胜率 = 盈利回合数 / 平仓回合数 × 100%${winRatePct === null ? '（无平仓回合）' : ' = ' + winRatePct.toFixed(1) + '%'}`,
      ]
    : [
        `定投：每 ${params.dcaInterval} 个交易日投入 ${params.dcaAmount} 元（含手续费 ${(fees * 100).toFixed(3)}%），按收盘价买整手（100股），不卖出。`,
        `累计收益率 = (期末权益 ${r2(finalEquity)} − 初始资金 ${params.initialCash}) / ${params.initialCash} × 100% = ${totalReturnPct.toFixed(2)}%`,
        `年化收益率 = ((期末/初始)^(252/${tradingDays}) − 1) × 100% = ${annualizedReturnPct.toFixed(2)}%`,
        `最大回撤 = min((当日净值 − 历史峰值)/历史峰值) × 100% = ${mdd.toFixed(2)}%`,
        `夏普比率 = (年化收益 − 无风险利率2%) / 年化波动 = ${sharpe === null ? '样本不足' : sharpe.toFixed(3)}`,
      ]

  return {
    strategy: params.strategy,
    startDate: first.date,
    endDate: lastBar.date,
    tradingDays,
    initialCash: params.initialCash,
    finalEquity: r2(finalEquity),
    totalReturnPct: r2(totalReturnPct),
    annualizedReturnPct: r2(annualizedReturnPct),
    maxDrawdownPct: r2(mdd),
    sharpeRatio: sharpe === null ? 0 : r2(sharpe),
    winRatePct: winRatePct === null ? null : r2(winRatePct),
    tradeCount: trades.length,
    profitFactor: profitFactor === null ? null : r2(profitFactor),
    endingCash: r2(cash),
    endingShares: shares,
    trades,
    equityCurve,
    formulas,
  }
}

/** 取最近一次买入手续费（用于回合盈亏核算）。 */
function lastBuyFee(trades: BacktestTrade[]): number {
  for (let i = trades.length - 1; i >= 0; i--) {
    if ((trades[i] as BacktestTrade).action === 'buy') return (trades[i] as BacktestTrade).fee
  }
  return 0
}
