/**
 * ─────────────────────────────────────────────────────────────────────────
 *  最小垂直插件模板 · client 半边（跑在浏览器：Web UI）
 * ─────────────────────────────────────────────────────────────────────────
 *
 * client 插件同样是 cordis 插件，但跑在浏览器端。它的职责是：向 UI 槽位注册
 * 一个面板 / 控件，让插件在 Web 界面里「看得见」。
 *
 * 本模板演示最小动作：往顶栏槽位 shell.statusbar 里挂一个小标记
 * 「模板插件已加载」。复制后可换成你自己的领域面板。
 *
 * 两条铁律（见 plugin-dev.md 第 4 节）：
 *   1) 这里禁止 `import { 运行时值 }` 自别的 UI 包；跨包只准 type-only import
 *      或走 cordis 服务（ctx.slots / ctx.locale / ctx.sessions ...）。
 *   2) inject 顶层声明的服务名，必须和 apply 里真正用到的一致。
 *
 * @module @deepseek-ai/dsh-plugin-template/client
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { createElement } from 'react'
// side-effect type import：把 'slots' 等 cordis 服务的类型合并进全局 Context，
// 这样 ctx.slots / ctx.inject(['slots']) 才有类型。运行时会被擦除，不进 bundle。
// 注意：'slots' 服务本身是 ui-renderer 声明的，所以必须从它的 /client 子路径引入。
import type { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'

/**
 * 浏览器端需要的 cordis 服务。这里我们只用 slots（槽位注册表）。
 * 比 ui-status-bar 少得多——它还要 sessions / theme / connection 等。
 */
export const inject: readonly string[] = ['slots']

/**
 * 要渲染的小标记组件。
 *
 * 注意：本文件是 .ts（不是 .tsx），所以用 createElement 而不是 JSX 语法。
 * 组件 props：register 时 inject: () => ({}) 没传任何注入面，组件也不需要任何 props，
 * 直接渲染一个写死的 span。真实插件里这里会接收 inject 传入的服务/数据。
 *
 * 样式一律用主题别名变量（--dsw-alias-*），不要写死颜色——这样浅/深色主题自动适配。
 */
function TemplateBadge() {
  return createElement(
    'span',
    {
      style: {
        marginLeft: 8,
        padding: '0 8px',
        fontSize: 12,
        lineHeight: '24px',
        borderRadius: 4,
        color: 'var(--dsw-alias-label-tertiary)',
        background: 'var(--dsw-alias-bg-layer-1)',
        border: '0.5px solid var(--dsw-alias-border-l1)',
      },
    },
    '模板插件已加载',
  )
}

/**
 * 浏览器插件主入口：把 TemplateBadge 挂进 shell.statusbar 槽位。
 * @param ctx client 根 cordis 上下文。
 */
export function apply(ctx: ClientContext): void {
  // ctx.inject(['slots'], scope => {...})：在子作用域里取 slots 服务。
  // 用 scope 包裹而不是直接用 ctx.slots，是为了在作用域销毁时自动回收注册。
  ctx.inject(['slots'], (scope: ClientContext) => {
    // inject 回调的 scope 已挂入 slots 服务；cordis 的 Context 类型未窄化到
    // 注入后的形状，这里与其他 UI 包（ui-plugin-market 等）一致做最小断言。
    const slots = (scope as unknown as { slots: SlotRegistry }).slots

    // slots.inject(槽位名, 注册函数)：
    //   - 槽位名 'shell.statusbar'：顶栏状态栏，多个插件可并列挂入，用 order 排序。
    //   - slots.register(选项, 组件)：把组件登记进该槽位。
    // 选项字段：
    //   - name   ：槽位名（与上面一致）；
    //   - id     ：本插件在该槽位内的唯一 id；
    //   - order  ：同槽位内排序（数字小的在前）；ui-status-bar 用 100，这里用 50 让它靠左；
    //   - inject : () => ({...}) 返回的对象会作为 props 传给组件（这里没有就给空对象）。
    slots.inject('shell.statusbar', () => slots.register({
      name: 'shell.statusbar',
      id: 'plugin-template-badge',
      order: 50,
      inject: () => ({}),
    }, TemplateBadge))
  })
}
