/** OmniAgent 顶部状态栏插件：注入到 ui-layout 的 shell.statusbar 顶部行槽位。 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ConnectionState, ConnectionStateSource } from '@deepseek-ai/dsh-client-connection/client'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { ModelDirectoryState, ModelDirectoryResolver } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { StatusBar, type StatusBarInjected } from './StatusBar.tsx'
import { en, NS, zh } from './locales.ts'
import type { StatusBarKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** OmniAgent 顶部状态栏文案。 */
    statusBar: StatusBarKey
  }
}

/** Required services: locale 字典、槽位、会话列表、模型目录、连接、主题、工作区导航。 */
export const inject = ['locale', 'slots', 'sessions', 'modelDirectories', 'connection', 'theme', 'uiWorkspace']

/**
 * 把当前主会话的模型选择投影成一个字符串 observable。
 * apply 侧负责解析主会话、订阅其模型目录 store；组件只读取 useModelLabel。
 * 解析失败（会话无 scope / 目录未就绪）时回退为空串，由组件展示占位文案。
 */
function createModelLabelSource(
  sessions: ISessions,
  modelDirectories: ModelDirectoryResolver,
): HostObservable<string> {
  let label = ''
  let listeners = new Set<() => void>()
  let boundSessionId: SessionId | undefined
  let unsubscribe: (() => void) | undefined

  const emit = (): void => {
    for (const listener of listeners) listener()
  }

  const labelOf = (state: ModelDirectoryState): string => {
    const current = state.current
    if (current === null) return ''
    for (const group of state.groups) {
      if (group.id !== current.provider) continue
      const model = group.models.find(m => m.id === current.model)
      if (model !== undefined) return model.name
    }
    return current.model
  }

  const rebind = (sessionId: SessionId | undefined): void => {
    unsubscribe?.()
    unsubscribe = undefined
    boundSessionId = sessionId
    if (sessionId === undefined) {
      label = ''
      emit()
      return
    }
    try {
      const directory = modelDirectories.directoryFor(sessionId)
      label = labelOf(directory.store.getSnapshot())
      unsubscribe = directory.store.subscribe(() => {
        label = labelOf(directory.store.getSnapshot())
        emit()
      })
      // 目录可能尚未加载完成，触发一次后台拉取后再投影。
      directory.load().then(() => {
        label = labelOf(directory.store.getSnapshot())
        emit()
      }).catch(() => { /* 目录加载失败由模型选择入口展示 */ })
    } catch {
      // 会话暂无 scope（例如空白新会话），保持空串占位。
      label = ''
    }
    emit()
  }

  const onList = (): void => {
    const list = sessions.list.getSnapshot()
    const mainId = Object.values(list.byId).find(s => (s.retainedBy.mainView ?? 0) > 0)?.id
    if (mainId !== boundSessionId) rebind(mainId)
  }

  sessions.list.subscribe(onList)
  onList()

  return {
    getSnapshot: () => label,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

/**
 * 注册顶部状态栏到 shell.statusbar 槽位。
 * @param ctx - client root context。
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-status-bar: dictionaries')

  ctx.inject(['slots', 'sessions', 'modelDirectories', 'connection', 'theme', 'uiWorkspace'], (scope: ClientContext) => {
    const sessions = scope.get('sessions') as ISessions
    const modelDirectories = scope.get('modelDirectories') as ModelDirectoryResolver
    const connection = scope.get('connection') as { state: ConnectionStateSource }
    const theme = scope.get('theme') as { getTheme: () => { preference: 'light' | 'dark' | 'system' }; setTheme: (id: string) => void }
    const uiWorkspace = scope.get('uiWorkspace') as { startSession: (workspaceId?: string) => void }

    const modelLabel = createModelLabelSource(sessions, modelDirectories)

    // 主题在 浅色 → 深色 → 跟随系统 之间循环。
    const cycleTheme = (): void => {
      const order = ['light', 'dark', 'system'] as const
      const current = theme.getTheme().preference
      const index = order.indexOf(current)
      const next: string = order[((index < 0 ? 0 : index) + 1) % order.length] ?? 'system'
      theme.setTheme(next)
    }

    const injected: StatusBarInjected = {
      hooks: {
        modelLabel,
        connectionState: connection.state as HostObservable<ConnectionState | undefined>,
      },
      startSession: () => { uiWorkspace.startSession() },
      cycleTheme,
    }

    scope.slots.inject('shell.statusbar', () => scope.slots.register({
      name: 'shell.statusbar',
      id: 'ui-status-bar',
      order: 100,
      locale: NS,
      inject: () => injected,
    }, StatusBar))
  })
}
