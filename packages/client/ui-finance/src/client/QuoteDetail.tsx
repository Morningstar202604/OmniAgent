/** 标的详情：实时行情快照 + 最小可用 SVG 日K走势 + 技术指标。 */
import { memo, useMemo } from 'react'
import type { KlineBar, QuoteRow } from './mock.ts'
import type { FinanceKey } from './locales.ts'
import { fmtAmount, fmtPct, fmtVolume, trendClass } from './format.ts'
import css from './QuoteDetail.module.css'

type T = (key: FinanceKey) => string

interface QuoteDetailProps {
  quote: QuoteRow | undefined
  bars: KlineBar[]
  technical: { sma5: number; sma20: number; rsi: number; macd: number }
  t: T
}

/** 行内行情快照小格子。 */
function Stat({ label, value, trend }: { label: string; value: string; trend?: 'up' | 'down' | 'flat' }) {
  return (
    <div className={css.stat}>
      <span className={css.statLabel}>{label}</span>
      <span className={`${css.statValue}${trend ? ` ${css[trend]}` : ''}`}>{value}</span>
    </div>
  )
}

/** 最小可用 K 线：收盘价折线 + 底部成交量柱，纯 SVG 无图表库。 */
function SparkChart({ bars, up }: { bars: KlineBar[]; up: boolean }) {
  const { line, area, bars: volBars, min, max } = useMemo(() => {
    const W = 560
    const H = 160
    const PAD = 4
    const closes = bars.map(b => b.close)
    const lo = Math.min(...closes)
    const hi = Math.max(...closes)
    const span = hi - lo || 1
    const x = (i: number) => PAD + (i / Math.max(1, bars.length - 1)) * (W - PAD * 2)
    const y = (v: number) => PAD + (1 - (v - lo) / span) * (H - PAD * 2 - 18)
    const linePath = bars.map((b, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(b.close).toFixed(1)}`).join(' ')
    const areaPath = `${linePath} L${x(bars.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`
    const maxVol = Math.max(...bars.map(b => b.volume)) || 1
    const volH = 16
    const vb = bars.map((b, i) => ({
      x: x(i),
      h: Math.max(1, (b.volume / maxVol) * volH),
    }))
    return { line: linePath, area: areaPath, bars: vb, min: lo, max: hi }
  }, [bars])

  const color = up ? '#ef4444' : '#22c55e'
  return (
    <svg className={css.chart} viewBox="0 0 560 160" preserveAspectRatio="none" role="img" aria-label="kline">
      <path d={area} fill={color} opacity={0.12} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} />
      {volBars.map((b, i) => (
        <rect key={i} x={b.x - 1.5} y={160 - b.h} width={3} height={b.h} fill={color} opacity={0.35} />
      ))}
      <text x={4} y={12} className={css.chartAxis}>{max.toFixed(2)}</text>
      <text x={4} y={156} className={css.chartAxis}>{min.toFixed(2)}</text>
    </svg>
  )
}

export const QuoteDetail = memo(function QuoteDetail({ quote, bars, technical, t }: QuoteDetailProps) {
  if (!quote) {
    return <div className={css.empty}>{t('detailNoSelect')}</div>
  }
  const trend = trendClass(quote.changePct)
  return (
    <div className={css.root}>
      <div className={css.head}>
        <div className={css.identity}>
          <span className={css.symbol}>{quote.name}</span>
          <span className={css.code}>{quote.symbol} · {quote.market.toUpperCase()}</span>
        </div>
        <div className={css.priceBlock}>
          <span className={`${css.price} ${css[trend]}`}>{quote.price.toFixed(2)}</span>
          <span className={`${css.changePct} ${css[trend]}`}>{fmtPct(quote.changePct)}</span>
          <span className={`${css.changeAmt} ${css[trend]}`}>{quote.change.toFixed(2)}</span>
        </div>
      </div>

      <div className={css.stats}>
        <Stat label={t('open')} value={quote.open.toFixed(2)} />
        <Stat label={t('high')} value={quote.high.toFixed(2)} trend="up" />
        <Stat label={t('low')} value={quote.low.toFixed(2)} trend="down" />
        <Stat label={t('prevClose')} value={quote.prevClose.toFixed(2)} />
        <Stat label={t('volume')} value={fmtVolume(quote.volume)} />
        <Stat label={t('turnover')} value={fmtAmount(quote.turnover, quote.currency)} />
        <Stat label={t('marketCap')} value={fmtAmount(quote.marketCap, quote.currency)} />
        <Stat label={t('pe')} value={quote.pe.toFixed(1)} />
        <Stat label={t('pb')} value={quote.pb.toFixed(2)} />
      </div>

      <div className={css.chartBlock}>
        <div className={css.chartTitle}>
          <span>{t('klineTitle')}</span>
          <span className={css.tech}>
            {t('sma5')} <em className={css.techNum}>{technical.sma5.toFixed(2)}</em>
            {t('sma20')} <em className={css.techNum}>{technical.sma20.toFixed(2)}</em>
            {t('rsi')} <em className={css.techNum}>{technical.rsi.toFixed(1)}</em>
            {t('macd')} <em className={css.techNum}>{technical.macd.toFixed(3)}</em>
          </span>
        </div>
        <SparkChart bars={bars} up={quote.changePct >= 0} />
      </div>
    </div>
  )
})
