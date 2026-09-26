/** 会话历史主面板：按时间分组（今天/昨天/7天内/更早）展示会话，支持切换、新建、重命名、分支与归档。 */
import { useMemo, useState } from 'react'
import clsx from 'clsx'
import {
  IconArchiveOutlineRegular, IconChevronRightOutlineRegular, IconEditOutlineRegular,
  IconFlatListOutlineRegular, IconPlusOutlineRegular, IconSearchOutlineRegular,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './SessionHistoryPage.module.css'

/** 注入到组件的纯动作回调（apply 闭包内通过 uiWorkspace / sessions 服务实现）。 */
export interface SessionHistoryInjected {
  /** 打开并切换到指定会话。 */
  openSession: (sessionId: SessionId) => void
  /** 新建会话。 */
  startSession: () => void
  /** 从指定会话创建分支（fork）并打开子会话。 */
  forkSession: (sessionId: SessionId) => Promise<void>
  /** 重命名会话。 */
  renameSession: (sessionId: SessionId, title: string) => Promise<void>
  /** 归档（软删除）会话。 */
  archiveSession: (sessionId: SessionId) => void
}

/** 组件全部 props：main 运行时份额 + 注入动作 + locale 座位。 */
export type SessionHistoryPageProps =
  PropsRuntime<'main'>
  & SessionHistoryInjected
  & PropsLocale<'sessionHistory'>

type GroupKey = 'today' | 'yesterday' | 'week' | 'earlier'

const DAY = 86_400_000

function dayStart(t: number): number {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** 按更新时间归入 今天 / 昨天 / 7天内 / 更早。 */
function groupOf(updatedAt: number, now: number): GroupKey {
  const today = dayStart(now)
  if (updatedAt >= today) return 'today'
  if (updatedAt >= today - DAY) return 'yesterday'
  if (updatedAt >= today - 7 * DAY) return 'week'
  return 'earlier'
}

/** 行内相对时间文案。 */
function relativeTime(updatedAt: number, now: number): string {
  if (!updatedAt) return ''
  const d = new Date(updatedAt)
  const today = dayStart(now)
  if (updatedAt >= today) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  if (updatedAt >= today - DAY) return '昨天'
  if (updatedAt >= today - 7 * DAY) {
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()] ?? ''
  }
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 会话历史主面板组件。 */
export function SessionHistoryPage({
  useSessions, openSession, startSession, forkSession, renameSession, archiveSession, t,
}: SessionHistoryPageProps) {
  const list = useSessions(s => s)
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<SessionId | undefined>(undefined)
  const [draft, setDraft] = useState('')
  const now = Date.now()

  const currentId = Object.values(list.byId).find(s => (s.retainedBy.mainView ?? 0) > 0)?.id

  // 非子代理、非空白会话，按更新时间倒序。
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return Object.values(list.byId)
      .filter((s) => {
        if (s.origin === 'subagent' || s.blank) return false
        if (q !== '' && !s.displayTitle.toLowerCase().includes(q)) return false
        return true
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }, [list.byId, query])

  const groups = useMemo(() => {
    const order: GroupKey[] = ['today', 'yesterday', 'week', 'earlier']
    const buckets: Record<GroupKey, SessionSummary[]> = { today: [], yesterday: [], week: [], earlier: [] }
    for (const row of rows) buckets[groupOf(row.updatedAt, now)].push(row)
    return order.map(key => ({ key, rows: buckets[key] })).filter(g => g.rows.length > 0)
  }, [rows, now])

  const groupTitle = (key: GroupKey): string => {
    if (key === 'today') return t('groupToday')
    if (key === 'yesterday') return t('groupYesterday')
    if (key === 'week') return t('groupWeek')
    return t('groupEarlier')
  }

  const commitRename = (sessionId: SessionId): void => {
    const title = draft.trim()
    setEditingId(undefined)
    if (title === '') return
    renameSession(sessionId, title).catch((reason: unknown) => {
      console.warn('rename session rejected:', reason)
    })
  }

  return (
    <div className={css.page}>
      <div className={css.header}>
        <span className={css.title}>{t('panel')}</span>
        <IconSearchOutlineRegular size={14} className={css.muted} />
        <input
          className={css.search}
          placeholder={t('search')}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <button type="button" className={css.newBtn} onClick={() => { startSession() }}>
          <IconPlusOutlineRegular size={13} /> {t('newSession')}
        </button>
      </div>

      <div className={css.list}>
        {groups.length === 0 && (
          <div className={css.empty}>{query.trim() ? t('emptySearch') : t('empty')}</div>
        )}
        {groups.map(group => (
          <div key={group.key}>
            <div className={css.groupTitle}>{groupTitle(group.key)}</div>
            {group.rows.map(row => (
              <div
                key={row.id}
                className={clsx(css.row, row.id === currentId && css.rowActive)}
                onClick={() => { if (editingId !== row.id) openSession(row.id) }}
              >
                <div className={css.rowMain}>
                  {editingId === row.id ? (
                    <input
                      className={css.renameInput}
                      value={draft}
                      autoFocus
                      placeholder={t('renamePlaceholder')}
                      onChange={e => setDraft(e.target.value)}
                      onClick={e => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename(row.id)
                        else if (e.key === 'Escape') setEditingId(undefined)
                      }}
                      onBlur={() => commitRename(row.id)}
                    />
                  ) : (
                    <>
                      <span className={css.rowTitle}>{row.displayTitle}</span>
                      <span className={css.rowMeta}>
                        <span>{relativeTime(row.updatedAt, now)}</span>
                        {row.parentId !== undefined && <span className={css.badge}>{t('branchBadge')}</span>}
                        {row.running && <span className={css.badge}>{t('running')}</span>}
                      </span>
                    </>
                  )}
                </div>
                {editingId !== row.id && (
                  <span className={css.actions}>
                    <button
                      type="button"
                      className={css.actionBtn}
                      title={t('actionRename')}
                      aria-label={t('actionRename')}
                      onClick={(e) => { e.stopPropagation(); setEditingId(row.id); setDraft(row.displayTitle) }}
                    >
                      <IconEditOutlineRegular size={13} />
                    </button>
                    <button
                      type="button"
                      className={css.actionBtn}
                      title={t('actionFork')}
                      aria-label={t('actionFork')}
                      onClick={(e) => { e.stopPropagation(); void forkSession(row.id) }}
                    >
                      <IconFlatListOutlineRegular size={13} />
                    </button>
                    <button
                      type="button"
                      className={css.actionBtn}
                      title={t('actionDelete')}
                      aria-label={t('actionDelete')}
                      onClick={(e) => { e.stopPropagation(); archiveSession(row.id) }}
                    >
                      <IconArchiveOutlineRegular size={13} />
                    </button>
                    <IconChevronRightOutlineRegular size={13} className={css.muted} />
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// eslint-disable-next-line -- 类型仅为编译期契约
export type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
