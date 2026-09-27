/**
 * 插件市场的本地安装状态。
 *
 * 最小可用版：把「已安装 / 已启用」记录在浏览器 localStorage，安装即标记并提示
 * 下次启动生效。真实的组合包安装/启停走 ui-plugin-manager 的 pluginManager
 * Remote（接后续热加载路线），本模块只负责市场页自身的可见状态。
 */

/** 单个插件的安装状态。 */
export interface InstallState {
  readonly installed: boolean
  readonly enabled: boolean
}

/** 全部状态：pluginId → 安装状态。 */
export type InstallMap = Readonly<Record<string, InstallState>>

const STORAGE_KEY = 'dsh:plugin-market:installs:v1'

/** 读取本地状态（容错：损坏时回退为空）。 */
export function loadInstallMap(): InstallMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return {}
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) return {}
    const out: Record<string, InstallState> = {}
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (
        typeof value === 'object' && value !== null
        && typeof (value as { installed?: unknown }).installed === 'boolean'
        && typeof (value as { enabled?: unknown }).enabled === 'boolean'
      ) {
        out[id] = {
          installed: (value as { installed: boolean }).installed,
          enabled: (value as { enabled: boolean }).enabled,
        }
      }
    }
    return out
  }
  catch {
    return {}
  }
}

/** 持久化状态。 */
export function saveInstallMap(map: InstallMap): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  }
  catch {
    // 存储不可用（隐私模式等）时静默降级为内存态。
  }
}

/** 标记为已安装并启用，返回新的状态表。 */
export function installPlugin(map: InstallMap, id: string): InstallMap {
  return { ...map, [id]: { installed: true, enabled: true } }
}

/** 切换已安装插件的启用状态，返回新的状态表。 */
export function setPluginEnabled(map: InstallMap, id: string, enabled: boolean): InstallMap {
  const current = map[id] ?? { installed: true, enabled: false }
  return { ...map, [id]: { ...current, enabled } }
}

/** 卸载插件（移除状态记录），返回新的状态表。 */
export function uninstallPlugin(map: InstallMap, id: string): InstallMap {
  const next = { ...map }
  delete next[id]
  return next
}
