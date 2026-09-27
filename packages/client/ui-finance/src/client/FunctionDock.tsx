/** 专业功能区：选股器/产业链/财务/风险/宏观/板块/资金流向入口卡片。 */
import { memo } from 'react'
import { FUNCTIONS } from './mock.ts'
import type { FinanceKey } from './locales.ts'
import css from './FunctionDock.module.css'

type T = (key: FinanceKey) => string

interface FunctionDockProps {
  t: T
  /** 点击功能卡片：id 为 screener/chain/financials/... */
  onPick: (id: string) => void
}

export const FunctionDock = memo(function FunctionDock({ t, onPick }: FunctionDockProps) {
  return (
    <div className={css.root}>
      <div className={css.title}>{t('functionsTitle')}</div>
      <div className={css.grid}>
        {FUNCTIONS.map(f => (
          <button key={f.id} type="button" className={css.card} onClick={() => onPick(f.id)}>
            <span className={css.cardTitle}>{t(f.titleKey)}</span>
            <span className={css.cardDesc}>{t(f.descKey)}</span>
          </button>
        ))}
      </div>
      <div className={css.hint}>{t('hintTools')}</div>
    </div>
  )
})
