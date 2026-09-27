/** 会话历史主面板：按时间分组（今天/昨天/7天内/更早）展示会话，支持切换、新建、重命名、分支与归档。 */
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import clsx from 'clsx'
import {
  IconArchiveOutlineRegular, IconBranchOutlineRegular, IconChevronRightOutlineRegular,
  IconEditOutlineRegular, IconFlatListOutlineRegular, IconPlusOutlineRegular, IconSearchOutlineRegular,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import css from './SessionHistoryPage.module.css'
import { SessionTimeline } from './SessionTimeline.tsx'

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

/** 会话历史面板内的两种视图：分组列表 / 分支时间线。 */
type HistoryView = 'list' | 'timeline'

const DAY = 86_400_000

/** 窗口化时上下各多渲染的条目数，避免快速滚动时露白。 */
const OVERSCAN = 6

/** 扁平化后的列表条目：分组标题或会话行（混合后便于按固定高度计算偏移）。 */
type FlatItem =
  | { readonly type: 'header'; readonly key: GroupKey; readonly title: string }
  | { readonly type: 'row'; readonly row: SessionSummary }

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

/** 列表行所需的稳定回调集合（父组件用 useCallback 包成同一引用后下发）。 */
interface SessionHistoryRowHandlers {
  onOpen: (id: SessionId) => void
  onFork: (id: SessionId) => void
  onArchive: (id: SessionId) => void
  onStartRename: (id: SessionId, title: string) => void
  onCancelRename: () => void
  onDraftChange: (text: string) => void
  onCommitRename: (id: SessionId, title: string) => void
}

/**
 * 单条会话行：memo 包裹后，搜索打字 / store 更新时，未变化的行（props 引用不变）跳过重渲染。
 * draft 仅在 editing 行传入，其余行恒为 undefined，避免输入草稿抖动触发全表重渲染。
 */
const SessionHistoryRow = memo(function SessionHistoryRow({
  row, active, now, editing, draft, t,
  onOpen, onFork, onArchive, onStartRename, onCancelRename, onDraftChange, onCommitRename,
}: {
  row: SessionSummary
  active: boolean
  now: number
  editing: boolean
  draft: string | undefined
  t: TranslateNS<'sessionHistory'>
} & SessionHistoryRowHandlers) {
  return (
    <div
      className={clsx(css.row, active && css.rowActive)}
      onClick={() => { if (!editing) onOpen(row.id) }}
    >
      <div className={css.rowMain}>
        {editing ? (
          <input
            className={css.renameInput}
            value={draft}
            autoFocus
            placeholder={t('renamePlaceholder')}
            onChange={e => { onDraftChange(e.target.value) }}
            onClick={e => { e.stopPropagation() }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCommitRename(row.id, draft ?? '')
              else if (e.key === 'Escape') onCancelRename()
            }}
            onBlur={() => { onCommitRename(row.id, draft ?? '') }}
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
      {!editing && (
        <span className={css.actions}>
          <button
            type="button"
            className={css.actionBtn}
            title={t('actionRename')}
            aria-label={t('actionRename')}
            onClick={(e) => { e.stopPropagation(); onStartRename(row.id, row.displayTitle) }}
          >
            <IconEditOutlineRegular size={13} />
          </button>
          <button
            type="button"
            className={css.actionBtn}
            title={t('actionFork')}
            aria-label={t('actionFork')}
            onClick={(e) => { e.stopPropagation(); onFork(row.id) }}
          >
            <IconFlatListOutlineRegular size={13} />
          </button>
          <button
            type="button"
            className={css.actionBtn}
            title={t('actionDelete')}
            aria-label={t('actionDelete')}
            onClick={(e) => { e.stopPropagation(); onArchive(row.id) }}
          >
            <IconArchiveOutlineRegular size={13} />
          </button>
          <IconChevronRightOutlineRegular size={13} className={css.muted} />
        </span>
      )}
    </div>
  )
})

/** 会话历史主面板组件。 */
export function SessionHistoryPage({
  useSessions, openSession, startSession, forkSession, renameSession, archiveSession, t,
}: SessionHistoryPageProps) {
  const list = useSessions(s => s)
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<SessionId | undefined>(undefined)
  const [draft, setDraft] = useState('')
  const [view, setView] = useState<HistoryView>('list')
  // now 在挂载期内保持稳定：行 memo 依赖它做 props 比对；跨天边界属可忽略的边缘情况。
  const [now] = useState(() => Date.now())

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

  const groupTitle = useCallback((key: GroupKey): string => {
    if (key === 'today') return t('groupToday')
    if (key === 'yesterday') return t('groupYesterday')
    if (key === 'week') return t('groupWeek')
    return t('groupEarlier')
  }, [t])

  // 下发给 memo 行的稳定回调：注入动作一旦变化才重建，否则保持同一引用。
  const handleOpen = useCallback((id: SessionId) => { openSession(id) }, [openSession])
  const handleFork = useCallback((id: SessionId) => { void forkSession(id) }, [forkSession])
  const handleArchive = useCallback((id: SessionId) => { archiveSession(id) }, [archiveSession])
  const handleStartRename = useCallback((id: SessionId, title: string) => {
    setEditingId(id)
    setDraft(title)
  }, [])
  const handleCancelRename = useCallback(() => { setEditingId(undefined) }, [])
  const handleDraftChange = useCallback((text: string) => { setDraft(text) }, [])
  const handleCommitRename = useCallback((id: SessionId, title: string) => {
    setEditingId(undefined)
    const trimmed = title.trim()
    if (trimmed === '') return
    renameSession(id, trimmed).catch((reason: unknown) => {
      console.warn('rename session rejected:', reason)
    })
  }, [renameSession])

  const handlers: SessionHistoryRowHandlers = {
    onOpen: handleOpen,
    onFork: handleFork,
    onArchive: handleArchive,
    onStartRename: handleStartRename,
    onCancelRename: handleCancelRename,
    onDraftChange: handleDraftChange,
    onCommitRename: handleCommitRename,
  }

  // ── 列表窗口化（虚拟滚动）──────────────────────────────────────────────
  // 非编辑态下标题恒为单行、meta 恒为单行，行高一致；分组标题高度也恒定。
  // 先离屏探针量出真实行高/标题高，再只渲染可视窗口 + overscan。
  const listRef = useRef<HTMLDivElement>(null)
  const probeRowRef = useRef<HTMLDivElement>(null)
  const probeHeaderRef = useRef<HTMLDivElement>(null)
  const [rowHeight, setRowHeight] = useState(0)
  const [headerHeight, setHeaderHeight] = useState(0)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportH, setViewportH] = useState(0)

  useLayoutEffect(() => {
    if (probeRowRef.current) setRowHeight(probeRowRef.current.offsetHeight)
    if (probeHeaderRef.current) setHeaderHeight(probeHeaderRef.current.offsetHeight)
  }, [])

  useLayoutEffect(() => {
    const el = listRef.current
    if (!el) return
    setViewportH(el.clientHeight)
    const ro = new ResizeObserver(() => { setViewportH(el.clientHeight) })
    ro.observe(el)
    return () => { ro.disconnect() }
  }, [])

  const onListScroll = useCallback(() => {
    const el = listRef.current
    if (el) setScrollTop(el.scrollTop)
  }, [])

  // 搜索词变化后回到列表顶部，避免窗口区间停留在已不存在的滚动位置。
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0
    setScrollTop(0)
  }, [query])

  // 扁平化为 [标题, 行, 行, 标题, 行, ...] 序列。
  const flatItems = useMemo<readonly FlatItem[]>(() => {
    const out: FlatItem[] = []
    for (const group of groups) {
      out.push({ type: 'header', key: group.key, title: groupTitle(group.key) })
      for (const row of group.rows) out.push({ type: 'row', row })
    }
    return out
  }, [groups, groupTitle])

  // 每条目起始 y 偏移与总高（末位为总高）。
  const offsets = useMemo(() => {
    const arr = new Array<number>(flatItems.length + 1).fill(0)
    let y = 0
    for (let i = 0; i < flatItems.length; i += 1) {
      arr[i] = y
      y += flatItems[i].type === 'header' ? headerHeight : rowHeight
    }
    arr[flatItems.length] = y
    return arr
  }, [flatItems, headerHeight, rowHeight])

  // 测量完成且非编辑态才启用窗口化；编辑态/首帧回退为全量渲染，避免单行高度差导致错位。
  const virtualized = rowHeight > 0 && headerHeight > 0 && viewportH > 0 && editingId === undefined

  // 二分查找可视窗口区间。
  const [startIdx, endIdx] = useMemo<readonly [number, number]>(() => {
    const n = flatItems.length
    if (n === 0 || !virtualized) return [0, Math.max(0, n - 1)]
    const bottom = scrollTop + viewportH
    // 第一条 bottom > scrollTop 的条目。
    let lo = 0
    let hi = n - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (offsets[mid + 1] <= scrollTop) lo = mid + 1
      else hi = mid
    }
    const first = Math.max(0, lo - OVERSCAN)
    // 最后一条 top < bottom 的条目。
    lo = 0
    hi = n - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (offsets[mid] < bottom) lo = mid
      else hi = mid - 1
    }
    const last = Math.min(n - 1, lo + OVERSCAN)
    return [first, last]
  }, [flatItems.length, offsets, scrollTop, viewportH, virtualized])

  const renderItem = useCallback((item: FlatItem): ReactNode => {
    if (item.type === 'header') {
      return (
        <div key={`h:${item.key}`} className={css.groupTitle}>{item.title}</div>
      )
    }
    const row = item.row
    return (
      <SessionHistoryRow
        key={row.id}
        row={row}
        active={row.id === currentId}
        now={now}
        editing={editingId === row.id}
        draft={editingId === row.id ? draft : undefined}
        t={t}
        {...handlers}
      />
    )
  }, [currentId, now, editingId, draft, t, handlers])

  return (
    <div className={css.page}>
      <div className={css.header}>
        <span className={css.title}>{t('panel')}</span>
        <div className={css.viewTabs} role="tablist" aria-label={t('panel')}>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'list'}
            className={clsx(css.viewTab, view === 'list' && css.viewTabActive)}
            onClick={() => { setView('list') }}
          >
            <IconFlatListOutlineRegular size={13} /> {t('viewList')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'timeline'}
            className={clsx(css.viewTab, view === 'timeline' && css.viewTabActive)}
            onClick={() => { setView('timeline') }}
          >
            <IconBranchOutlineRegular size={13} /> {t('viewTimeline')}
          </button>
        </div>
        <IconSearchOutlineRegular size={14} className={css.muted} />
        <input
          className={css.search}
          placeholder={t('search')}
          value={query}
          onChange={e => { setQuery(e.target.value) }}
        />
        <button type="button" className={css.newBtn} onClick={() => { startSession() }}>
          <IconPlusOutlineRegular size={13} /> {t('newSession')}
        </button>
      </div>

      {view === 'timeline' ? (
        <SessionTimeline
          rows={rows}
          currentId={currentId}
          now={now}
          openSession={openSession}
          forkSession={forkSession}
          t={t}
        />
      ) : (
      <div ref={listRef} className={css.list} onScroll={onListScroll}>
        {groups.length === 0 && (
          <div className={css.empty}>{query.trim() ? t('emptySearch') : t('empty')}</div>
        )}
        {virtualized ? (
          <div style={{ height: offsets[flatItems.length] }}>
            <div style={{ paddingTop: offsets[startIdx] }}>
              {flatItems.slice(startIdx, endIdx + 1).map(renderItem)}
            </div>
          </div>
        ) : (
          flatItems.map(renderItem)
        )}
      </div>
      )}

      {/* 离屏探针：量出恒定的行高与分组标题高，供窗口化偏移计算（不参与布局）。 */}
      <div aria-hidden style={{ position: 'absolute', left: -9999, top: 0, visibility: 'hidden' }}>
        <div ref={probeHeaderRef} className={css.groupTitle}>{t('groupToday')}</div>
        <div ref={probeRowRef} className={css.row}>
          <div className={css.rowMain}>
            <span className={css.rowTitle}>probe</span>
            <span className={css.rowMeta}><span>00:00</span></span>
          </div>
        </div>
      </div>
    </div>
  )
}

export type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
