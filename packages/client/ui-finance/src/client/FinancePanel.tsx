/**
 * 金融专业面板（main 槽位全局面板）：加载 dsh-finance 插件后由 ui-finance 客户端
 * 包自动选中，把中心对话区整体替换为金融终端观感。结构：
 *   顶部行情条（指数+热门股，横向滚动）→ 中部 标的详情+K线 / 研报公告资讯
 *   → 底部专业功能入口。无插件时此面板不注册、不选中，通用界面保持不变。
 */
import { useMemo, useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { ANNOUNCEMENTS, buildKline, buildTechnical, NEWS, QUOTES, RESEARCH } from './mock.ts'
import { QuoteBar } from './QuoteBar.tsx'
import { QuoteDetail } from './QuoteDetail.tsx'
import { ResearchTabs } from './ResearchTabs.tsx'
import { FunctionDock } from './FunctionDock.tsx'
import css from './FinancePanel.module.css'

/** 注入面：返回对话（layout.selectPanel(null)）。 */
export interface FinancePanelInjected {
  backToChat: () => void
}

export type FinancePanelProps =
  & PropsRuntime<'main'>
  & PropsLocale<'finance'>
  & FinancePanelInjected

export function FinancePanel({ t, backToChat }: FinancePanelProps) {
  const [selected, setSelected] = useState<string>(QUOTES[0]?.symbol ?? '')
  const quote = useMemo(() => QUOTES.find(q => q.symbol === selected), [selected])
  const bars = useMemo(() => buildKline(quote?.price ?? 100), [quote?.price])
  const technical = useMemo(() => buildTechnical(bars), [bars])

  return (
    <div className={css.root} data-testid="finance-panel">
      <header className={css.header}>
        <div className={css.titleBlock}>
          <span className={css.title}>{t('panelTitle')}</span>
          <span className={css.subtitle}>{t('subtitle')}</span>
          <span className={css.badge}>{t('demoBadge')}</span>
        </div>
        <button type="button" className={css.back} onClick={backToChat}>
          {t('backToChat')}
        </button>
      </header>

      <QuoteBar quotes={QUOTES} selected={selected} onSelect={setSelected} />

      <div className={css.body}>
        <section className={css.detailPane}>
          <QuoteDetail quote={quote} bars={bars} technical={technical} t={t} />
        </section>
        <section className={css.researchPane}>
          <ResearchTabs research={RESEARCH} announcements={ANNOUNCEMENTS} news={NEWS} t={t} />
        </section>
      </div>

      <FunctionDock t={t} />
    </div>
  )
}
