/** 研究区：券商研报 / 公司公告 / 财经资讯 三个标签页切换。 */
import { memo, useState } from 'react'
import type { AnnouncementRow, NewsRow, ResearchRow } from './mock.ts'
import { ANNOUNCEMENT_CATEGORY_ZH } from './mock.ts'
import type { FinanceKey } from './locales.ts'
import css from './ResearchTabs.module.css'

type T = (key: FinanceKey) => string

type TabId = 'research' | 'announcements' | 'news'

interface ResearchTabsProps {
  research: ResearchRow[]
  announcements: AnnouncementRow[]
  news: NewsRow[]
  t: T
}

const RATING_COLOR: Record<string, string> = {
  '买入': '#ef4444',
  '增持': '#f97316',
  '持有': 'var(--dsw-alias-label-secondary)',
  '卖出': '#22c55e',
}

export const ResearchTabs = memo(function ResearchTabs({ research, announcements, news, t }: ResearchTabsProps) {
  const [tab, setTab] = useState<TabId>('research')
  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'research', label: t('tabResearch') },
    { id: 'announcements', label: t('tabAnnouncements') },
    { id: 'news', label: t('tabNews') },
  ]

  return (
    <div className={css.root}>
      <div className={css.tabBar} role="tablist">
        {tabs.map(item => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`${css.tab}${tab === item.id ? ` ${css.tabActive}` : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className={css.list} data-tab={tab}>
        {tab === 'research' && research.map(r => (
          <div key={r.id} className={css.row}>
            <div className={css.rowHead}>
              <span className={css.rowTitle}>{r.title}</span>
              <span className={css.rating} style={{ color: RATING_COLOR[r.rating] ?? undefined }}>{r.rating}</span>
            </div>
            <div className={css.rowMeta}>
              <span>{r.institution} · {r.analyst}</span>
              <span>{t('targetPrice')} {r.targetPrice}</span>
              <span>{r.reportDate}</span>
            </div>
            <div className={css.rowSummary}>{r.summary}</div>
          </div>
        ))}

        {tab === 'announcements' && announcements.map(a => (
          <div key={a.id} className={css.row}>
            <div className={css.rowHead}>
              <span className={css.rowTitle}>{a.title}</span>
              <span className={css.tag}>{ANNOUNCEMENT_CATEGORY_ZH[a.category] ?? a.category}</span>
            </div>
            <div className={css.rowMeta}>
              <span>{t('announcementCategory')}</span>
              <span>{a.publishDate}</span>
            </div>
            <div className={css.rowSummary}>{a.summary}</div>
          </div>
        ))}

        {tab === 'news' && news.map(n => (
          <div key={n.id} className={css.row}>
            <div className={css.rowHead}>
              <span className={css.rowTitle}>{n.title}</span>
            </div>
            <div className={css.rowMeta}>
              <span>{n.source}</span>
              <span>{n.publishTime}</span>
            </div>
            <div className={css.rowSummary}>{n.summary}</div>
          </div>
        ))}
      </div>
    </div>
  )
})
