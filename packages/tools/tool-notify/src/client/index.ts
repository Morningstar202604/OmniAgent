/**
 * tool-notify 的浏览器半边：在 Web 端把"任务完成 / 审批请求"转成浏览器通知。
 *
 * 触发源统一读 `uiSession.sessionStatus` 这个已聚合的状态快照（它已经把
 * sessions.list 的运行态与各域 pendingInteraction 合并成每会话一条），
 * 因此不需要侵入审批 Remote Event 瀑布流——审批面板仍由 ui-approval 全权处理，
 * 这里只旁路观察 pendingInteraction 的出现。
 *
 * 行为：
 *   1. 首次用户手势时请求 Notification 权限（浏览器要求手势触发）；
 *   2. 某会话 running 由 true→false（任务结束）时，若页面不在前台则弹通知；
 *   3. 某会话出现审批类 pendingInteraction 时，若页面不在前台则弹通知；
 *   4. 页面在前台 / Notification 不可用 / 权限被拒时静默降级（Toast 或控制台）。
 *
 * @module @deepseek-ai/dsh-tool-notify/client
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { PendingApproval } from '@deepseek-ai/dsh-client-ui-approval/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { installPermissionGestureRequest, showWebNotify } from './notify-web.ts'

/** 需要注入的服务：会话列表（取标题）、uiSession（聚合状态快照）。 */
export const inject = ['sessions', 'uiSession']

/** 每个会话上一次观察到的运行/审批边，用于只在 true→false、审批新出现时通知。 */
interface PrevEdge {
  running: boolean | undefined
  approvalKey: string | undefined
}

interface UiSessionLike {
  sessionStatus: {
    getSnapshot(): ReadonlyMap<SessionId, {
      running: boolean | undefined
      pendingInteraction: { kind: string; key: string; toolName: string; reason?: string } | undefined
    }>
    subscribe(listener: () => void): () => void
  }
}

/**
 * 安装浏览器通知客户端。
 * @param ctx - Client root context。
 */
export function apply(ctx: ClientContext): void {
  // 首次点击/按键时请求通知权限，之后不再打扰。
  installPermissionGestureRequest()

  ctx.inject(['sessions', 'uiSession'], (scope: ClientContext) => {
    const sessions = scope.get('sessions') as unknown as ISessions
    const uiSession = scope.get('uiSession') as unknown as UiSessionLike

    const prev = new Map<SessionId, PrevEdge>()

    const displayTitleOf = (sessionId: SessionId): string => {
      const row = sessions.list.getSnapshot().byId[sessionId]
      return row?.displayTitle ?? sessionId
    }

    const onStatus = (): void => {
      const snapshot = uiSession.sessionStatus.getSnapshot()
      for (const [sessionId, status] of snapshot) {
        const before = prev.get(sessionId)
        const approval = status.pendingInteraction
        const approvalKey = approval !== undefined && approval.kind === 'approval'
          ? approval.key
          : undefined
        prev.set(sessionId, { running: status.running, approvalKey })

        // 边一：任务结束（running true→false）。初次见到（before 为空）不通知。
        if (before?.running === true && status.running === false) {
          void showWebNotify('任务完成', `会话「${displayTitleOf(sessionId)}」已完成`, {
            tag: `tool-notify:done:${sessionId}`,
          })
        }

        // 边二：审批请求新出现（审批 key 从无到有）。
        if (approval !== undefined && approval.kind === 'approval') {
          const pending = approval as PendingApproval
          if (before?.approvalKey !== pending.key) {
            const reason = pending.reason ? `：${pending.reason}` : ''
            void showWebNotify('需要审批', `工具 ${pending.toolName} 请求审批${reason}`, {
              tag: `tool-notify:approval:${pending.key}`,
            })
          }
        }
      }
    }

    const unsubscribe = uiSession.sessionStatus.subscribe(onStatus)
    onStatus()
    return unsubscribe
  })
}
