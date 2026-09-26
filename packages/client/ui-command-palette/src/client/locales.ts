/** `commandPalette` namespace dictionaries. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'commandPalette'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  placeholder: '输入命令或搜索动作…',
  groups: '快速动作',
  open: '命令面板',
  openHint: '命令面板',
  newSession: '新建会话',
  newSessionDesc: '开始一段全新的对话',
  plugins: '插件专区',
  pluginsDesc: '启用领域插件，界面瞬变专业应用',
  backToChat: '回到对话',
  backToChatDesc: '返回当前会话',
  themeLight: '浅色主题',
  themeDark: '深色主题',
  themeSystem: '跟随系统',
  themeDesc: '切换外观模式',
  hint: '↑↓ 选择 · Enter 执行 · Esc 关闭',
  kbd: '⌘K',
} satisfies Record<string, string>

/** The commandPalette namespace key union. */
export type CommandPaletteKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en: Record<CommandPaletteKey, string> = {
  placeholder: 'Type a command or search…',
  groups: 'Quick actions',
  open: 'Command palette',
  openHint: 'Command palette',
  newSession: 'New session',
  newSessionDesc: 'Start a fresh conversation',
  plugins: 'Plugin hub',
  pluginsDesc: 'Enable domain plugins and turn the UI into a pro app',
  backToChat: 'Back to chat',
  backToChatDesc: 'Return to the current conversation',
  themeLight: 'Light theme',
  themeDark: 'Dark theme',
  themeSystem: 'Follow system',
  themeDesc: 'Switch appearance',
  hint: '↑↓ navigate · Enter run · Esc close',
  kbd: '⌘K',
}
