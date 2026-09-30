/** 金融数字格式化：A股红涨绿跌、等宽数字、紧凑单位。 */

/** 涨跌幅配色：红涨（#ef4444）绿跌（#22c55e）平为中性色。 */
export function trendClass(changePct: number): 'up' | 'down' | 'flat' {
  if (changePct > 0) return 'up'
  if (changePct < 0) return 'down'
  return 'flat'
}

/** 带符号的涨跌百分比，如 +0.57% / -1.68%。 */
export function fmtPct(pct: number): string {
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(2)}%`
}

/** 带符号的涨跌额，如 +18.42 / -3.20。 */
export function fmtChange(change: number): string {
  const sign = change > 0 ? '+' : ''
  return `${sign}${change.toFixed(2)}`
}

/** 紧凑金额：亿 / 万亿。 */
export function fmtAmount(value: number, currency = 'CNY'): string {
  const unit = currency === 'CNY' ? '元' : currency
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)} 万亿${unit === '元' ? '元' : ''}`
  if (value >= 1e8) return `${(value / 1e8).toFixed(2)} 亿`
  if (value >= 1e4) return `${(value / 1e4).toFixed(1)} 万`
  return value.toFixed(0)
}

/** 成交量紧凑格式。 */
export function fmtVolume(volume: number): string {
  if (volume >= 1e8) return `${(volume / 1e8).toFixed(2)} 亿手`
  if (volume >= 1e4) return `${(volume / 1e4).toFixed(1)} 万手`
  return volume.toFixed(0)
}
