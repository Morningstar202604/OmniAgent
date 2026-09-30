/** 会话分支时间线视图：以父子会话（parentId）为节点的垂直分支树，可切换、可就地分支。 */
import clsx from 'clsx'
import { IconBranchOutlineRegular, IconChevronRightOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import css from './SessionTimeline.module.css'

/** 时间线视图所需注入动作与文案。 */
export interface SessionTimelineInjected {
  /** 打开并切换到指定会话。 */
  openSession: (sessionId: SessionId) => void
  /** 从指定会话创建分支（fork）并打开子会话。 */
  forkSession: (sessionId: SessionId) => Promise<void>
}

/** 时间线视图 props：外部已过滤的会话行 + 当前会话 + 文案。 */
export interface SessionTimelineProps extends SessionTimelineInjected {
  /** 已过滤（非子代理、非空白、命中搜索）的会话行。 */
  rows: SessionSummary[]
  /** 当前主视图会话 id（用于高亮）。 */
  currentId: SessionId | undefined
  /** 当前时间戳（用于相对时间展示）。 */
  now: number
  /** 文案函数。 */
  t: TranslateNS<'sessionHistory'>
}

/** 行内相对时间文案（与列表视图保持一致）。 */
function relativeTime(updatedAt: number, now: number): string {
  if (!updatedAt) return ''
  const d = new Date(updatedAt)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const todayStart = today.getTime()
  const day = 86_400_000
  if (updatedAt >= todayStart) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  if (updatedAt >= todayStart - day) return '昨天'
  if (updatedAt >= todayStart - 7 * day) {
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()] ?? ''
  }
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 递归渲染一个分支节点及其子节点。 */
function BranchNode({
  row, parent, childrenOf, currentId, now, openSession, forkSession, t,
}: {
  row: SessionSummary
  parent: SessionSummary | undefined
  childrenOf: Map<SessionId, SessionSummary[]>
  currentId: SessionId | undefined
  now: number
  openSession: (sessionId: SessionId) => void
  forkSession: (sessionId: SessionId) => Promise<void>
  t: TranslateNS<'sessionHistory'>
}) {
  const kids = childrenOf.get(row.id) ?? []
  return (
    <div className={css.branchNode}>
      <div
        className={clsx(css.nodeRow, row.id === currentId && css.nodeActive)}
        onClick={() => { openSession(row.id) }}
      >
        <span className={css.nodeDot} />
        <div className={css.nodeBody}>
          <span className={css.nodeTitle}>{row.displayTitle}</span>
          <span className={css.nodeMeta}>
            <span>{relativeTime(row.updatedAt, now)}</span>
            {row.parentId !== undefined && <span className={css.badge}>{t('branchBadge')}</span>}
            {row.running && <span className={css.badge}>{t('running')}</span>}
          </span>
          {row.parentId !== undefined && parent !== undefined && (
            <span className={css.forkFrom}>{t('branchedFrom', { title: parent.displayTitle })}</span>
          )}
        </div>
        <span className={css.nodeActions}>
          <button
            type="button"
            className={css.nodeActionBtn}
            title={t('actionFork')}
            aria-label={t('actionFork')}
            onClick={(e) => { e.stopPropagation(); void forkSession(row.id) }}
          >
            <IconBranchOutlineRegular size={13} />
          </button>
          <IconChevronRightOutlineRegular size={13} className={css.muted} />
        </span>
      </div>
      {kids.length > 0 && (
        <div className={css.branchChildren}>
          {kids.map(kid => (
            <BranchNode
              key={kid.id}
              row={kid}
              parent={row}
              childrenOf={childrenOf}
              currentId={currentId}
              now={now}
              openSession={openSession}
              forkSession={forkSession}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** 会话分支时间线面板组件。 */
export function SessionTimeline({
  rows, currentId, now, openSession, forkSession, t,
}: SessionTimelineProps) {
  // 以 id 建索引，仅保留可见行，用于父子关系解析。
  const byId = new Map<SessionId, SessionSummary>()
  for (const row of rows) byId.set(row.id, row)

  const childrenOf = new Map<SessionId, SessionSummary[]>()
  for (const row of rows) {
    if (row.parentId === undefined) continue
    // 父节点不可见（被搜索过滤或为子代理）时，该分支在时间线中自成根。
    if (!byId.has(row.parentId)) continue
    const list = childrenOf.get(row.parentId)
    if (list === undefined) childrenOf.set(row.parentId, [row])
    else list.push(row)
  }
  for (const list of childrenOf.values()) list.sort((a, b) => b.updatedAt - a.updatedAt)

  // 根节点：无 parentId，或 parentId 不在可见集合中。
  const roots = rows
    .filter(row => row.parentId === undefined || !byId.has(row.parentId))
    .sort((a, b) => b.updatedAt - a.updatedAt)

  if (roots.length === 0) {
    return <div className={css.empty}>{rows.length === 0 ? t('timelineEmptySearch') : t('timelineEmpty')}</div>
  }

  return (
    <div className={css.timeline}>
      {roots.map(root => (
        <BranchNode
          key={root.id}
          row={root}
          parent={root.parentId !== undefined ? byId.get(root.parentId) : undefined}
          childrenOf={childrenOf}
          currentId={currentId}
          now={now}
          openSession={openSession}
          forkSession={forkSession}
          t={t}
        />
      ))}
    </div>
  )
}
