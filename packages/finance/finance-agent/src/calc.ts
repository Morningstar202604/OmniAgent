/**
 * 金融纯计算模块：与数据源、工具框架完全解耦，可直接单测。
 * 所有结果可通过公式手工复核。
 * @module @deepseek-ai/dsh-finance-agent/src/calc
 */

// ─────────── 金融计算 ───────────

/** 复利终值：FV = PV × (1+r)^n */
export function compoundFutureValue(pv: number, annualRatePct: number, years: number): number {
  return pv * Math.pow(1 + annualRatePct / 100, years)
}

/** 复利现值：PV = FV / (1+r)^n */
export function compoundPresentValue(fv: number, annualRatePct: number, years: number): number {
  return fv / Math.pow(1 + annualRatePct / 100, years)
}

/** 等额本息月供：PMT = P·r·(1+r)^n / ((1+r)^n − 1)，r=月利率，n=月数 */
export function loanPayment(principal: number, annualRatePct: number, months: number): number {
  const r = annualRatePct / 100 / 12
  if (r === 0) return principal / months
  const factor = Math.pow(1 + r, months)
  return principal * r * factor / (factor - 1)
}

/** 年化收益率：((FV/PV)^(1/years) − 1) × 100% */
export function annualizedReturn(startValue: number, endValue: number, years: number): number {
  return (Math.pow(endValue / startValue, 1 / years) - 1) * 100
}

/** Gordon 股利折现内在价值：D1 / (k − g) */
export function dividendDiscountValue(dividendPerShare: number, requiredReturnPct: number, growthRatePct: number): number {
  const k = requiredReturnPct / 100
  const g = growthRatePct / 100
  if (k <= g) throw new Error('必要收益率必须大于股利增长率（k > g），否则模型发散')
  return dividendPerShare / (k - g)
}

// ─────────── 技术指标 ───────────

function emaValues(values: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const out: number[] = []
  const first = values[0]
  if (first === undefined) return out
  let prev = first
  out.push(prev)
  for (let i = 1; i < values.length; i++) {
    const v = values[i]
    if (v === undefined) break
    prev = v * k + prev * (1 - k)
    out.push(prev)
  }
  return out
}

function smaAt(values: number[], period: number, index: number): number {
  if (index + 1 < period) return Number.NaN
  let sum = 0
  for (let i = index - period + 1; i <= index; i++) {
    const v = values[i]
    if (v === undefined) return Number.NaN
    sum += v
  }
  return sum / period
}

/** RSI（Wilder 平滑）。 */
function rsiAt(values: number[], period: number, index: number): number {
  if (index < period) return Number.NaN
  let gain = 0
  let loss = 0
  for (let i = index - period + 1; i <= index; i++) {
    const curr = values[i]
    const prev = values[i - 1]
    if (curr === undefined || prev === undefined) return Number.NaN
    const diff = curr - prev
    if (diff > 0) gain += diff
    else loss -= diff
  }
  if (loss === 0) return 100
  const rs = gain / period / (loss / period)
  return 100 - 100 / (1 + rs)
}

/** MACD：DIF=EMA12−EMA26，DEA=EMA(DIF,9)，柱=(DIF−DEA)×2。 */
export function macdValues(values: number[]): { dif: number[]; dea: number[]; hist: number[] } {
  const e12 = emaValues(values, 12)
  const e26 = emaValues(values, 26)
  const dif = e12.map((v, i) => v - (e26[i] ?? 0))
  const dea = emaValues(dif, 9)
  const hist = dif.map((v, i) => (v - (dea[i] ?? 0)) * 2)
  return { dif, dea, hist }
}

/** 布林带（SMA ± k×σ）。 */
export function bollAt(values: number[], period: number, k: number, index: number): { mid: number; upper: number; lower: number } | null {
  if (index + 1 < period) return null
  const slice = values.slice(index - period + 1, index + 1)
  const mean = slice.reduce((a, b) => a + b, 0) / period
  const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period
  const sd = Math.sqrt(variance)
  return { mid: mean, upper: mean + k * sd, lower: mean - k * sd }
}

/** JSON 不兼容 NaN：技术指标早期窗口为 null。 */
export function clean(n: number): number | null {
  return Number.isNaN(n) ? null : n
}

/** 指标序列聚合计算（工具层调用入口）。 */
export function computeIndicator(indicator: 'sma' | 'ema' | 'rsi' | 'macd' | 'boll', prices: number[], period?: number): { indicator: string; period: number; latest: Record<string, number | null>; series: (number | null)[] } {
  const idx = prices.length - 1
  switch (indicator) {
    case 'sma': {
      const p = period ?? 20
      const series = prices.map((_, i) => clean(smaAt(prices, p, i)))
      return { indicator: 'sma', period: p, latest: { sma: series[idx] ?? null }, series }
    }
    case 'ema': {
      const p = period ?? 12
      const series = emaValues(prices, p).map(clean)
      return { indicator: 'ema', period: p, latest: { ema: series[idx] ?? null }, series }
    }
    case 'rsi': {
      const p = period ?? 14
      const series = prices.map((_, i) => clean(rsiAt(prices, p, i)))
      return { indicator: 'rsi', period: p, latest: { rsi: series[idx] ?? null }, series }
    }
    case 'macd': {
      const { dif, dea, hist } = macdValues(prices)
      return { indicator: 'macd', period: 26, latest: { dif: clean(dif[idx] ?? Number.NaN), dea: clean(dea[idx] ?? Number.NaN), hist: clean(hist[idx] ?? Number.NaN) }, series: hist.map(clean) }
    }
    case 'boll': {
      const p = period ?? 20
      const k = 2
      const series = prices.map((_, i) => {
        const band = bollAt(prices, p, k, i)
        return band === null ? null : clean(band.mid)
      })
      const band = bollAt(prices, p, k, idx)
      return { indicator: 'boll', period: p, latest: band === null ? { mid: null, upper: null, lower: null } : { mid: clean(band.mid), upper: clean(band.upper), lower: clean(band.lower) }, series }
    }
  }
}

// ─────────── 风险指标（基于收盘价序列本地纯计算，全部可复核） ───────────

/** 校验收益率序列长度（>=20 个日收益率，对应至少 21 个收盘价）。 */
function ensureReturns(returns: number[]): void {
  if (returns.length < 20) throw new Error(`收益率序列长度必须 >= 20，当前 ${returns.length}（需至少 21 个收盘价）`)
}

/** 日收益率序列: returns[i] = (prices[i+1] - prices[i]) / prices[i] */
export function dailyReturns(prices: number[]): number[] {
  if (!Array.isArray(prices) || prices.length < 2) return []
  const out: number[] = []
  for (let i = 0; i < prices.length - 1; i++) {
    const curr = prices[i + 1] as number
    const prev = prices[i] as number
    if (prev === 0) throw new Error('收盘价序列中出现 0，无法计算日收益率')
    out.push((curr - prev) / prev)
  }
  return out
}

/** Beta = Cov(stockReturns, benchReturns) / Var(benchReturns)
 *  Cov 与 Var 均按样本估计（除以 n-1），比值中 n-1 约掉。 */
export function betaCoefficient(stockReturns: number[], benchReturns: number[]): number {
  ensureReturns(stockReturns)
  const n = stockReturns.length
  if (benchReturns.length !== n) throw new Error(`个股与基准收益率序列长度必须一致（个股 ${n}，基准 ${benchReturns.length}）`)
  const meanS = stockReturns.reduce((a, b) => a + b, 0) / n
  const meanB = benchReturns.reduce((a, b) => a + b, 0) / n
  let cov = 0
  let varB = 0
  for (let i = 0; i < n; i++) {
    const ds = (stockReturns[i] as number) - meanS
    const db = (benchReturns[i] as number) - meanB
    cov += ds * db
    varB += db * db
  }
  if (varB === 0) throw new Error('基准收益率方差为 0，无法计算 Beta')
  return cov / varB
}

/** 年化夏普比率 = (年化收益率 - 无风险利率) / 年化波动率
 *  年化收益率 = mean(dailyReturns) * 252（小数）
 *  年化波动率 = std(dailyReturns) * sqrt(252)（样本标准差）
 *  riskFreeRatePct 为百分数（如 2.0 表示 2%）。 */
export function sharpeRatio(returns: number[], riskFreeRatePct: number): number {
  ensureReturns(returns)
  const n = returns.length
  const mean = returns.reduce((a, b) => a + b, 0) / n
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)
  const dailyVol = Math.sqrt(variance)
  const annualReturn = mean * 252
  const annualVol = dailyVol * Math.sqrt(252)
  if (annualVol === 0) throw new Error('年化波动率为 0，无法计算夏普比率')
  return (annualReturn - riskFreeRatePct / 100) / annualVol
}

/** 最大回撤 = max((peak - trough) / peak) * 100, 返回负数百分比
 *  遍历价格序列，记录历史峰值 peak，取相对 peak 最差回撤。 */
export function maxDrawdown(prices: number[]): number {
  if (!Array.isArray(prices) || prices.length < 2) throw new Error('价格序列至少需要 2 个数据点')
  let peak = prices[0] as number
  let worst = 0
  for (const p of prices) {
    if (p > peak) peak = p
    const dd = (p - peak) / peak // <= 0
    if (dd < worst) worst = dd
  }
  return worst * 100
}

/** 年化波动率 = std(dailyReturns) * sqrt(252) * 100（样本标准差）。 */
export function annualVolatility(returns: number[]): number {
  ensureReturns(returns)
  const n = returns.length
  const mean = returns.reduce((a, b) => a + b, 0) / n
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)
  return Math.sqrt(variance) * Math.sqrt(252) * 100
}

/** 历史模拟法 VaR: 将日收益率升序排序, 取 (1-confidence) 分位数 * 100
 *  confidence=0.95 → 取第 5% 分位数; confidence=0.99 → 取第 1% 分位数
 *  返回负数百分比（最坏损失）。 */
export function historicalVaR(returns: number[], confidence: number): number {
  ensureReturns(returns)
  const sorted = returns.slice().sort((a, b) => a - b)
  const n = sorted.length
  const idx = Math.max(0, Math.min(n - 1, Math.floor((1 - confidence) * n)))
  return (sorted[idx] as number) * 100
}
