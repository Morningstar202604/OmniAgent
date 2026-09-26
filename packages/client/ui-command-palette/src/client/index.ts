/** OmniAgent 全局命令面板插件：Ctrl/Cmd+K 打开，挂 shell.overlay 根级槽位。 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { CommandPalette, PALETTE_TOGGLE_EVENT } from './CommandPalette.tsx'
import { en, NS, zh } from './locales.ts'
import type { CommandPaletteKey } from './locales.ts'

export { PALETTE_TOGGLE_EVENT } from './CommandPalette.tsx'
export type { CommandPaletteProps } from './CommandPalette.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** OmniAgent 全局命令面板文案。 */
    commandPalette: CommandPaletteKey
  }
}

/** Required services: locale 字典注册与面板动作的服务面。 */
export const inject = ['locale', 'slots', 'layout', 'theme', 'uiWorkspace']

/**
 * 注册命令面板到 shell.overlay：始终挂载（组件内部按需显隐），
 * 全局 Ctrl/Cmd+K 或 PALETTE_TOGGLE_EVENT 事件开关。
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-command-palette: dictionaries')
  ctx.inject(['slots', 'layout', 'theme', 'uiWorkspace'], (scope: ClientContext) => {
    const slots = (scope as unknown as { slots: SlotRegistry }).slots
    const layout = scope.get('layout') as { selectPanel: (id: string | null) => void }
    const theme = scope.get('theme') as { setTheme: (id: string) => void }
    const workspace = scope.get('uiWorkspace') as { startSession: (id?: string) => void }
    slots.inject('shell.overlay', () => slots.register({
      name: 'shell.overlay',
      id: 'ui-command-palette',
      order: 1000,
      locale: NS,
      inject: () => ({
        startSession: (): void => { workspace.startSession() },
        selectPanel: (panelId: string | null): void => { layout.selectPanel(panelId as never) },
        setTheme: (id: 'light' | 'dark' | 'system'): void => { theme.setTheme(id) },
      }),
    }, CommandPalette))
  })
}

/** 供首页等入口 dispatch 的开关事件。 */
export function togglePalette(): void {
  window.dispatchEvent(new Event(PALETTE_TOGGLE_EVENT))
}
