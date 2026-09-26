/** `statusBar` namespace dictionaries. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'statusBar'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  modelFallback: '默认模型',
  sessionFallback: '未选择会话',
  tokenLabel: 'tokens',
  tokenPending: '统计待接入',
  connected: '已连接',
  connecting: '连接中…',
  disconnected: '离线',
  themeToggle: '切换主题',
  newSession: '新建会话',
  sessionIdLabel: '会话',
} satisfies Record<string, string>

/** The statusBar namespace key union. */
export type StatusBarKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en: Record<StatusBarKey, string> = {
  modelFallback: 'Default model',
  sessionFallback: 'No session',
  tokenLabel: 'tokens',
  tokenPending: 'stats pending',
  connected: 'Connected',
  connecting: 'Connecting…',
  disconnected: 'Offline',
  themeToggle: 'Toggle theme',
  newSession: 'New session',
  sessionIdLabel: 'Session',
}
