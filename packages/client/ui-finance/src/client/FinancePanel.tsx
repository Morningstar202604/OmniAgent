/**
 * 金融专业面板（main 槽位全局面板）：加载 dsh-finance 插件后由 ui-finance 客户端
 * 包自动选中，把中心对话区整体替换为金融终端观感。结构：
 *   顶部行情条（指数+热门股，每 15 秒模拟刷新一次，红涨绿跌）
 *   → 中部 标的详情+K线 / 研报公告资讯
 *   → 底部专业功能入口。点击「选股器」「产业链图谱」切换到对应全屏视图。
 * 无插件时此面板不注册、不选中，通用界面保持不变。
 */
import { useEffect, useMemo, useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { ANNOUNCEMENTS, buildKline, buildTechnical, NEWS, QUOTES, RESEARCH } from './mock.ts'
import type { QuoteRow } from './mock.ts'
import { QuoteBar } from './QuoteBar.tsx'
import { QuoteDetail } from './QuoteDetail.tsx'
import { ResearchTabs } from './ResearchTabs.tsx'
import { FunctionDock } from './FunctionDock.tsx'
import { ScreenerPanel } from './ScreenerPanel.tsx'
import { IndustryChain } from './IndustryChain.tsx'
import css from './FinancePanel.module.css'

/** 注入面：返回对话（layout.selectPanel(null)）。 */
export interface FinancePanelInjected {
  backToChat: () => void
}

export type FinancePanelProps =
  & PropsRuntime<'main'>
  & PropsLocale<'finance'>
  & FinancePanelInjected

/** 面板内视图：主终端 / 选股器 / 产业链图谱。 */
type PanelView = 'main' | 'screener' | 'chain'

/** 行情条轮询间隔（毫秒）：当前为前端模拟波动，待接 host RPC 后替换为真实快照。 */
const TICK_INTERVAL_MS = 15_000

/** 在昨收基础上对最新价做小幅随机漂移，并同步涨跌额/涨跌幅（红涨绿跌由配色决定）。 */
function tickQuotes(rows: QuoteRow[]): QuoteRow[] {
  return rows.map((q) => {
    // 确定性微小漂移：用价格与名称做种子，避免每次渲染抖动；区间 ±0.35%。
    const seed = (q.price * 10 + q.name.length) % 7
    const drift = ((seed - 3) / 1000) + (Math.random() - 0.5) * 0.004
    const price = Math.max(q.prevClose * 0.9, q.price * (1 + drift))
    const change = price - q.prevClose
    return { ...q, price, change, changePct: (change / q.prevClose) * 100 }
  })
}

export function FinancePanel({ t, backToChat }: FinancePanelProps) {
  const [view, setView] = useState<PanelView>('main')
  const [selected, setSelected] = useState<string>(QUOTES[0]?.symbol ?? '')
  const [liveQuotes, setLiveQuotes] = useState<QuoteRow[]>(QUOTES)

  // 行情条定时轮询刷新：在示例数据基础上模拟小幅波动（红涨绿跌）。
  useEffect(() => {
    const timer = setInterval(() => setLiveQuotes((prev) => tickQuotes(prev)), TICK_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])

  const quote = useMemo(() => liveQuotes.find(q => q.symbol === selected), [liveQuotes, selected])
  const bars = useMemo(() => buildKline(quote?.price ?? 100), [quote?.price])
  const technical = useMemo(() => buildTechnical(bars), [bars])

  const pickFunction = (id: string): void => {
    if (id === 'screener') setView('screener')
    else if (id === 'chain') setView('chain')
    // 其余功能（财务/风险/宏观/板块/资金流向）引导用户在对话框调用对应工具。
  }

  if (view === 'screener') {
    return (
      <div className={css.root} data-testid="finance-panel">
        <ScreenerPanel onBack={() => setView('main')} />
      </div>
    )
  }

  if (view === 'chain') {
    return (
      <div className={css.root} data-testid="finance-panel">
        <IndustryChain onBack={() => setView('main')} />
      </div>
    )
  }

  return (
    <div className={css.root} data-testid="finance-panel">
      <header className={css.header}>
        <div className={css.titleBlock}>
          <span className={css.title}>{t('panelTitle')}</span>
          <span className={css.subtitle}>{t('subtitle')}</span>
          <span className={css.badge}>{t('demoBadge')}</span>
          <span className={css.liveBadge} title={t('demoRefresh')}>● {t('liveTicking')}</span>
        </div>
        <button type="button" className={css.back} onClick={backToChat}>
          {t('backToChat')}
        </button>
      </header>

      <QuoteBar quotes={liveQuotes} selected={selected} onSelect={setSelected} />

      <div className={css.body}>
        <section className={css.detailPane}>
          <QuoteDetail quote={quote} bars={bars} technical={technical} t={t} />
        </section>
        <section className={css.researchPane}>
          <ResearchTabs research={RESEARCH} announcements={ANNOUNCEMENTS} news={NEWS} t={t} />
        </section>
      </div>

      <FunctionDock t={t} onPick={pickFunction} />
    </div>
  )
}
