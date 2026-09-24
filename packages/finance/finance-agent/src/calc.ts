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
