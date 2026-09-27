/** 顶部行情条：横向滚动展示主要指数与热门个股，红涨绿跌。 */
import { memo } from 'react'
import type { QuoteRow } from './mock.ts'
import { fmtChange, fmtPct, trendClass } from './format.ts'
import css from './QuoteBar.module.css'

interface QuoteBarProps {
  quotes: QuoteRow[]
  selected: string
  onSelect: (symbol: string) => void
}

/** 单个行情格：名称 + 最新价 + 涨跌幅。 */
export const QuoteBar = memo(function QuoteBar({ quotes, selected, onSelect }: QuoteBarProps) {
  return (
    <div className={css.bar} data-testid="finance-quote-bar">
      {quotes.map(q => {
        const trend = trendClass(q.changePct)
        return (
          <button
            key={q.symbol}
            type="button"
            className={`${css.cell}${q.symbol === selected ? ` ${css.cellActive}` : ''}`}
            onClick={() => { onSelect(q.symbol) }}
          >
            <span className={css.cellName}>{q.name}</span>
            <span className={`${css.cellPrice} ${css[trend]}`}>{q.price.toFixed(2)}</span>
            <span className={`${css.cellPct} ${css[trend]}`}>{fmtPct(q.changePct)}</span>
            <span className={`${css.cellChg} ${css[trend]}`}>{fmtChange(q.change)}</span>
          </button>
        )
      })}
    </div>
  )
})
