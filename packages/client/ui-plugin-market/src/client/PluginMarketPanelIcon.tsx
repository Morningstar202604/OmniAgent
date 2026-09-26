/** 侧边栏「插件市场」入口图标；sidebar 负责按钮、label 与选中态。 */

import type { ReactNode } from 'react'
import { IconCordisPluginOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'

/**
 * 渲染市场 glyph。
 * @param props.size - sidebar 请求的图标边长。
 * @returns 图标元素。
 */
export function PluginMarketPanelIcon({ size }: PropsRuntime<'sidebar.panellist'>): ReactNode {
  return <IconCordisPluginOutlineRegular size={size} />
}
