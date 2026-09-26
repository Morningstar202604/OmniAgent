/**
 * OmniAgent 金融专业面板插件：仅随 dsh-finance 组合包挂载。
 *
 * 注册一个 key 为 `finance` 的 main 全局面板，并在挂载后自动选中它——中心对话区
 * 整体替换为金融终端（行情条 / 标的详情+K线 / 研报公告资讯 / 专业功能）。
 * 通用 web profile 不挂载本包，main 槽位没有 `finance` key，界面保持通用对话。
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { ILayout, MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { FinancePanel } from './FinancePanel.tsx'
import { en, NS, zh } from './locales.ts'
import type { FinanceKey } from './locales.ts'

export { FinancePanel } from './FinancePanel.tsx'
export type { FinancePanelProps, FinancePanelInjected } from './FinancePanel.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** OmniAgent 金融专业面板文案。 */
    finance: FinanceKey
  }
}

/** 金融面板在 main 槽位的注册 key，也是 layout.selectPanel 的目标 id。 */
export const PANEL_ID = 'finance' as MainPanelId

/** Required services: locale 字典、槽位注册、主面板导航。 */
export const inject = ['locale', 'slots', 'layout']

/**
 * 注册金融专业面板到 main 槽位，并在挂载后自动选中，使界面瞬变金融终端。
 * @param ctx - 客户端根上下文。
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-finance: dictionaries')

  const slots = (ctx as unknown as { slots: SlotRegistry }).slots
  const layout = ctx.layout as ILayout

  slots.inject('main', () => slots.register({
    name: 'main',
    key: PANEL_ID,
    locale: NS,
    inject: () => ({
      backToChat: (): void => { layout.selectPanel(null) },
    }),
  }, FinancePanel))

  // 插件加载即「瞬变金融终端」：挂载后自动选中金融面板。
  ctx.effect(() => {
    const timer = setTimeout(() => {
      try { layout.selectPanel(PANEL_ID) } catch { /* 面板尚未就绪时静默，用户可手动从侧栏进入 */ }
    }, 0)
    return () => { clearTimeout(timer) }
  }, 'ui-finance: auto-select panel')
}
