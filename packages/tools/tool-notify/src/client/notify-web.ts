/**
 * 浏览器原生 Notification API 封装：负责权限管理、发通知、点击聚焦，
 * 以及不可用时的静默降级（页面内 Toast / 控制台）。
 *
 * 设计原则与 host 端 notify() 对齐：任何失败都静默兜底，绝不抛错、不阻断主流程。
 *
 * 通道降级顺序（Web 端）：
 *   1. 浏览器原生 Notification：权限已授权时 `new Notification(title, { body, tag })`，
 *      点击后 `window.focus()` 把标签页拉到前台；
 *   2. 页面内 Toast：Notification 不可用（非安全上下文等）或权限被拒绝时，
 *      在页面底部浮一条 4 秒后自动消失的提示；
 *   3. 控制台兜底：连 Toast 都无法渲染时 `console.info` 打印。
 *
 * 页面在前台（document.hasFocus() === true）时不发任何通知——用户正在看应用本身，
 * 系统通知属于打扰。
 *
 * 不引入任何第三方依赖，全程只用浏览器原生 API。
 *
 * @module @deepseek-ai/dsh-tool-notify/client
 */

/** 通知投递结果（用于控制台/调试）。 */
type WebNotifyChannel = 'notification' | 'toast' | 'console' | 'skipped'

/** showWebNotify 的可选项。 */
export interface WebNotifyOptions {
  /** 通知 tag：同 tag 的新通知会替换旧通知，避免堆叠。 */
  tag?: string
  /** 用户点击通知后的额外回调（window.focus() 已内置）。 */
  onClick?: () => void
}

/** 运行时是否支持 Notification API。结果缓存，浏览器环境内恒定。 */
let supportCache: boolean | undefined
function isSupported(): boolean {
  if (supportCache !== undefined) return supportCache
  try {
    supportCache = typeof window !== 'undefined'
      && 'Notification' in window
      && typeof Notification === 'function'
  } catch {
    supportCache = false
  }
  return supportCache
}

/** 当前权限状态；不支持时返回 'unsupported'。 */
function permissionNow(): NotificationPermission | 'unsupported' {
  if (!isSupported()) return 'unsupported'
  try {
    return Notification.permission
  } catch {
    return 'unsupported'
  }
}

/**
 * 在首次用户手势后请求通知权限。浏览器要求 Notification.requestPermission()
 * 必须由用户手势触发，否则会被忽略/拒绝。因此只在权限仍为 default 时，
 * 监听一次 pointerdown / keydown，触发后即移除监听。
 *
 * 幂等：权限已是 granted/denied 或环境不支持时直接返回，不重复弹窗。
 */
export function installPermissionGestureRequest(): void {
  if (!isSupported()) return
  if (permissionNow() !== 'default') return

  const onGesture = (): void => {
    try {
      // 现代浏览器返回 Promise；旧版回调式已淘汰，这里 await 即可。
      void Notification.requestPermission().catch(() => { /* 用户拒绝/异常，静默 */ })
    } catch {
      /* 请求本身抛错也吞掉 */
    }
    window.removeEventListener('pointerdown', onGesture)
    window.removeEventListener('keydown', onGesture)
  }
  window.addEventListener('pointerdown', onGesture)
  window.addEventListener('keydown', onGesture)
}

/** 页面内 Toast：底部居中浮一条，约 4 秒后自动消失。任何异常都静默。 */
function showToast(message: string): void {
  if (typeof document === 'undefined') return
  try {
    const el = document.createElement('div')
    el.textContent = message
    el.setAttribute('role', 'status')
    el.style.cssText = [
      'position:fixed',
      'bottom:28px',
      'left:50%',
      'transform:translateX(-50%)',
      'background:rgba(28,28,30,.95)',
      'color:#fff',
      'padding:10px 16px',
      'border-radius:10px',
      'font:13px/1.5 system-ui,-apple-system,sans-serif',
      'z-index:2147483647',
      'box-shadow:0 6px 20px rgba(0,0,0,.25)',
      'max-width:80vw',
      'transition:opacity .4s ease',
      'pointer-events:none',
    ].join(';')
    document.body.appendChild(el)
    // 3.6s 开始淡出，4.1s 后移除。
    window.setTimeout(() => { el.style.opacity = '0' }, 3600)
    window.setTimeout(() => { el.remove() }, 4100)
  } catch {
    /* 连 Toast 都渲染不了，走控制台兜底 */
    console.info(`[通知] ${message}`)
  }
}

/**
 * 发送一条 Web 端通知。永不抛错。
 *
 * - 页面在前台时直接跳过（skipped），不打扰正在看应用的用户；
 * - Notification 不可用 / 权限被拒 / 权限尚未授予时，降级为页面内 Toast；
 * - 权限已授予时弹出系统通知，点击后聚焦窗口并触发 onClick。
 *
 * @param title 通知标题。
 * @param body 通知正文。
 * @param options tag / 点击回调。
 */
export async function showWebNotify(title: string, body: string, options: WebNotifyOptions = {}): Promise<WebNotifyChannel> {
  // 前台不打扰。
  try {
    if (typeof document !== 'undefined' && document.hasFocus()) return 'skipped'
  } catch {
    /* hasFocus 异常时不阻断后续通知 */
  }

  // 通道一：浏览器原生 Notification。
  if (isSupported()) {
    let permission = permissionNow()
    // default：尝试再请求一次（极少数情况下手势外的请求会失败，失败则降级）。
    if (permission === 'default') {
      try {
        permission = await Notification.requestPermission()
      } catch {
        permission = permissionNow()
      }
    }
    if (permission === 'granted') {
      try {
        const notificationOptions: NotificationOptions = { body }
        if (options.tag !== undefined) notificationOptions.tag = options.tag
        const notification = new Notification(title, notificationOptions)
        notification.onclick = () => {
          try { window.focus() } catch { /* 某些浏览器限制 focus，忽略 */ }
          notification.close()
          options.onClick?.()
        }
        return 'notification'
      } catch {
        // 构造通知异常（如无头/隐身），落到 Toast。
      }
    }
    // denied 或 granted 但构造失败：继续降级。
  }

  // 通道二：页面内 Toast。
  showToast(body || title)
  return 'toast'
}
