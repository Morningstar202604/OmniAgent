/** OmniAgent 顶部状态栏：模型 / 会话 / token / 连接状态 / 时钟 / 主题快捷操作。 */
import { useEffect, useState } from 'react'
import clsx from 'clsx'
import {
  IconDataOutlineRegular, IconFollowsystemOutlineRegular, IconNewChatOutlineMedium,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  HostObservable, PropsHooks, PropsLocale, PropsRuntime,
} from '@deepseek-ai/dsh-client-ui-slots'
import type { ConnectionState } from '@deepseek-ai/dsh-client-connection/client'
// 仅类型：token 用量投影的形状；运行时数据经 sessions 服务的 projection face 流入。
import type { TokenUsageProjection } from '@deepseek-ai/dsh-token-meter/client'
import css from './StatusBar.module.css'

/** 注入到组件的纯回调与 hooks compartment。 */
export interface StatusBarInjected {
  hooks: {
    /** 当前主会话的模型展示名（apply 侧投影，空串表示未知）。 */
    modelLabel: HostObservable<string>
    /** 连接生命周期状态。 */
    connectionState: HostObservable<ConnectionState | undefined>
    /** 当前主会话累计 token 用量投影；无任何计费记录时为 undefined。 */
    tokenUsage: HostObservable<TokenUsageProjection | undefined>
  }
  /** 新建会话（ui-workspace 服务）。 */
  startSession: () => void
  /** 在 浅色/深色/跟随系统 之间循环切换主题。 */
  cycleTheme: () => void
}

/** 组件全部 props：root 运行时份额 + hooks 份额 + 注入份额 + locale 座位。 */
export type StatusBarProps =
  PropsRuntime<'shell.statusbar'>
  & PropsHooks<StatusBarInjected['hooks']>
  & Omit<StatusBarInjected, 'hooks'>
  & PropsLocale<'statusBar'>

/** 连接状态 -> 圆点样式与文案。 */
function connectionVisual(state: ConnectionState | undefined, t: PropsLocale<'statusBar'>['t']) {
  if (state === 'connected') return { dot: css.dotConnected, text: t('connected') }
  if (state === 'connecting') return { dot: css.dotConnecting, text: t('connecting') }
  return { dot: css.dotDisconnected, text: t('disconnected') }
}

/** 紧凑 token 计数：517 / 1.2k / 3.4M，保持状态栏单行不撑高。 */
function formatCompactTokens(value: number): string {
  if (value < 1_000) return String(value)
  if (value < 1_000_000) {
    const k = value / 1_000
    return `${k >= 100 ? Math.round(k) : Math.round(k * 10) / 10}k`
  }
  const m = value / 1_000_000
  return `${m >= 100 ? Math.round(m) : Math.round(m * 10) / 10}M`
}

/** 四个互斥计费桶求和：prompt 侧三桶（未命中输入 + 缓存读 + 缓存写）+ 输出。 */
function totalTokensOf(usage: TokenUsageProjection): number {
  return usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens + usage.outputTokens
}

/** 顶部状态栏组件（注册进 shell.statusbar 槽位，由 ui-layout 渲染为顶部 grid 行）。 */
export function StatusBar({
  useSessions, useModelLabel, useConnectionState, useTokenUsage, startSession, cycleTheme, t,
}: StatusBarProps) {
  const list = useSessions(s => s)
  const modelLabel = useModelLabel(label => label)
  const connectionState = useConnectionState(state => state)
  const usage = useTokenUsage(value => value)

  // 时钟：每 30s 刷新一次即可，状态栏不需要秒级精度。
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => { setNow(new Date()) }, 30_000)
    return () => { window.clearInterval(timer) }
  }, [])

  // 当前主会话（mainView 持有的会话）。
  const current = Object.values(list.byId).find(s => (s.retainedBy.mainView ?? 0) > 0)
  const sessionTitle = current?.displayTitle ?? t('sessionFallback')
  // token 用量：取当前主会话的累计投影，无计费记录时回退占位 “—”。
  const tokenTotal = usage === undefined ? null : totalTokensOf(usage)
  const tokenText = tokenTotal === null ? '—' : formatCompactTokens(tokenTotal)
  const tokenTitle = usage === undefined
    ? t('tokenUsageTitle')
    : t('tokenUsageDetail', {
        total: String(tokenTotal),
        input: String(usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens),
        output: String(usage.outputTokens),
      })

  const visual = connectionVisual(connectionState, t)
  const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  return (
    <div className={css.bar}>
      <div className={css.left}>
        <span className={css.item} title={t('modelFallback')}>
          <IconDataOutlineRegular size={13} />
          <span className={css.muted}>{modelLabel || t('modelFallback')}</span>
        </span>
        <span className={css.sep} />
        <span className={clsx(css.item, css.sessionTitle)} title={sessionTitle}>
          {sessionTitle}
        </span>
      </div>

      <div className={css.right}>
        <span className={clsx(css.item, css.muted, css.tokenItem)} title={tokenTitle}>
          <span>{tokenText}</span>
          <span>{t('tokenLabel')}</span>
        </span>
        <span className={css.sep} data-token-sep />
        <span className={clsx(css.item, css.muted, css.connItem)}>
          <span className={clsx(css.dot, visual.dot)} />
          <span className={css.connText}>{visual.text}</span>
        </span>
        <span className={css.sep} data-conn-sep />
        <span className={clsx(css.item, css.clock)}>{clock}</span>
        <button
          type="button"
          className={css.iconBtn}
          title={t('newSession')}
          aria-label={t('newSession')}
          onClick={() => { startSession() }}
        >
          <IconNewChatOutlineMedium size={14} />
        </button>
        <button
          type="button"
          className={css.iconBtn}
          title={t('themeToggle')}
          aria-label={t('themeToggle')}
          onClick={() => { cycleTheme() }}
        >
          <IconFollowsystemOutlineRegular size={14} />
        </button>
      </div>
    </div>
  )
}

export type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
