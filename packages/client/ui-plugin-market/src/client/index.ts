/**
 * 插件在线市场，browser 半边：侧边栏「插件市场」入口 + 主列市场页面。
 * 页面浏览内置精选目录、搜索/分类/排序、查看详情并记录本地安装状态。
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { PluginMarketPage } from './PluginMarketPage.tsx'
import { PluginMarketPanelIcon } from './PluginMarketPanelIcon.tsx'
import { en, NS, zh, type PluginMarketKey } from './locales.ts'

export type { PluginMarketPageProps } from './PluginMarketPage.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** 插件在线市场文案。 */
    pluginMarket: PluginMarketKey
  }
}

/** 侧边栏入口与主列面板共享的 id。 */
export const PANEL_ID = 'plugin-market' as MainPanelId

/** 访问 locale / slots 服务前必须声明的注入。 */
export const inject = ['locale', 'slots']

/**
 * 注册市场字典，并把市场页面挂到 main 槽位、把入口挂到侧边栏面板列表。
 * @param ctx - browser 插件上下文。
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-plugin-market: dictionaries')
  const t = ctx.locale.bind(NS)

  ctx.inject(['slots'], (scope: ClientContext) => {
    const slots = (scope as unknown as { slots: SlotRegistry }).slots
    slots.inject('main', () => slots.register({
      name: 'main',
      key: PANEL_ID,
      locale: NS,
    }, PluginMarketPage))
    slots.inject('sidebar.panellist', () => slots.register({
      name: 'sidebar.panellist',
      id: PANEL_ID,
      order: 10,
      label: () => t('panel'),
      locale: NS,
    }, PluginMarketPanelIcon))
  })
}
