/** 会话历史面板插件：侧栏「历史」入口 + 主栏按时间分组的会话列表页。 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {
  ISessions, SessionReference,
} from '@deepseek-ai/dsh-api-session-controller/client'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type { UiWorkspace } from '@deepseek-ai/dsh-client-ui-workspace/client'
import { HistoryPanelIcon } from './HistoryPanelIcon.tsx'
import { SessionHistoryPage, type SessionHistoryInjected } from './SessionHistoryPage.tsx'
import { en, NS, zh } from './locales.ts'
import type { SessionHistoryKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** 会话历史面板文案。 */
    sessionHistory: SessionHistoryKey
  }
}

declare module '@deepseek-ai/dsh-api-session-controller/client' {
  interface SessionReferenceSourceMap {
    /** 会话历史面板重命名时持有的临时引用。 */
    sessionHistory: unknown
  }
}

/** 侧栏入口与主面板共用的 id。 */
export const PANEL_ID = 'session-history' as MainPanelId

/** 所需服务：locale、槽位、会话控制器、工作区导航。 */
export const inject = ['locale', 'slots', 'sessions', 'uiWorkspace']

/**
 * 注册会话历史主面板与侧栏入口。
 * @param ctx - client root context。
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-session-history: dictionaries')
  const t = ctx.locale.bind(NS)

  ctx.inject(['slots', 'sessions', 'uiWorkspace'], (scope: ClientContext) => {
    const sessions = scope.get('sessions') as ISessions
    const uiWorkspace = scope.get('uiWorkspace') as UiWorkspace

    const injected: SessionHistoryInjected = {
      openSession: (sessionId) => { uiWorkspace.openSession(sessionId) },
      startSession: () => { uiWorkspace.startSession() },
      // 分支：fork 出子会话后立即打开（最小可用分支能力）。
      forkSession: async (sessionId) => {
        const childId = await sessions.fork({ sessionId, increaseTitle: true })
        uiWorkspace.openSession(childId)
      },
      // 重命名：临时持有会话引用并提交标题。
      renameSession: async (sessionId, title) => {
        const result = await sessions.using(
          sessionId,
          { source: 'sessionHistory' },
          (reference: SessionReference) => reference.binding.session.rename(title),
        )
        if (!result.ok) throw new Error(result.error.message)
      },
      // 归档（软删除）：与侧边栏浏览区一致的删除语义。
      archiveSession: (sessionId) => {
        uiWorkspace.archiveSession(sessionId).catch((reason: unknown) => {
          console.warn('session archive rejected:', reason)
        })
      },
    }

    scope.slots.inject('main', () => scope.slots.register({
      name: 'main',
      key: PANEL_ID,
      locale: NS,
      inject: () => injected,
    }, SessionHistoryPage))

    scope.slots.inject('sidebar.panellist', () => scope.slots.register({
      name: 'sidebar.panellist',
      id: PANEL_ID,
      order: 50,
      label: () => t('panelLabel'),
      locale: NS,
    }, HistoryPanelIcon))
  })
}
