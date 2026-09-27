/** OmniAgent 顶部状态栏插件：注入到 ui-layout 的 shell.statusbar 顶部行槽位。 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ConnectionStateSource } from '@deepseek-ai/dsh-client-connection/client'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { ModelDirectoryState, ModelDirectoryResolver } from '@deepseek-ai/dsh-client-ui-model-selection/client'
// 仅类型：token 用量投影形状；运行时经 sessions.binding().session.projections.faceOf('tokenUsage') 读取。
import type { TokenUsageProjection } from '@deepseek-ai/dsh-token-meter/client'
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
 * 把当前主会话累计 token 用量投影成一个 observable。
 * 数据来自 Host 计算并推送的 `tokenUsage` 会话投影（整条日志去重累加，跨分页/压缩稳定），
 * apply 侧只负责跟随主会话切换并转发该投影 face；组件只读取 useTokenUsage。
 * 会话无计费记录或投影尚未就绪时为 undefined，由组件回退占位 “—”。
 */
function createTokenUsageSource(sessions: ISessions): HostObservable<TokenUsageProjection | undefined> {
  let value: TokenUsageProjection | undefined
  const listeners = new Set<() => void>()
  let boundSessionId: SessionId | undefined
  let unsubscribe: (() => void) | undefined

  const emit = (): void => {
    for (const listener of listeners) listener()
  }

  const rebind = (sessionId: SessionId | undefined): void => {
    unsubscribe?.()
    unsubscribe = undefined
    boundSessionId = sessionId
    if (sessionId === undefined) {
      value = undefined
      emit()
      return
    }
    try {
      // 主会话由 mainView 持有，binding 必然存在；其 projection store 按 sessionId 常驻，
      // 重连后由 baseline 重新播种并通知旧订阅者，无需在此重绑。
      const binding = sessions.binding(sessionId)
      const face = binding?.session.projections.faceOf('tokenUsage')
      if (face === undefined) {
        value = undefined
        emit()
        return
      }
      value = face.getSnapshot() as TokenUsageProjection | undefined
      unsubscribe = face.subscribe(() => {
        value = face.getSnapshot() as TokenUsageProjection | undefined
        emit()
      })
    } catch {
      value = undefined
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
    getSnapshot: () => value,
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
    const tokenUsage = createTokenUsageSource(sessions)

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
        connectionState: connection.state,
        tokenUsage,
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
