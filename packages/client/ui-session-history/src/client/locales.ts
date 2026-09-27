/** `sessionHistory` namespace dictionaries. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'sessionHistory'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  panel: '会话历史',
  panelLabel: '历史',
  search: '搜索会话…',
  newSession: '新建会话',
  groupToday: '今天',
  groupYesterday: '昨天',
  groupWeek: '7 天内',
  groupEarlier: '更早',
  empty: '暂无会话，点击「新建会话」开始第一段对话。',
  emptySearch: '没有匹配的会话。',
  actionOpen: '打开',
  actionFork: '从这里分支',
  actionRename: '重命名',
  actionDelete: '归档',
  branchBadge: '分支',
  running: '运行中',
  renamePlaceholder: '输入会话标题…',
  viewList: '列表',
  viewTimeline: '时间线',
  timelineEmpty: '暂无会话分支，从任意会话「从这里分支」即可创建新分支。',
  timelineEmptySearch: '没有匹配的会话分支。',
  branchedFrom: '从「{title}」分叉',
} satisfies Record<string, string>

/** The sessionHistory namespace key union. */
export type SessionHistoryKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en: Record<SessionHistoryKey, string> = {
  panel: 'Session history',
  panelLabel: 'History',
  search: 'Search sessions…',
  newSession: 'New session',
  groupToday: 'Today',
  groupYesterday: 'Yesterday',
  groupWeek: 'Past 7 days',
  groupEarlier: 'Earlier',
  empty: 'No sessions yet. Click "New session" to start.',
  emptySearch: 'No matching sessions.',
  actionOpen: 'Open',
  actionFork: 'Branch from here',
  actionRename: 'Rename',
  actionDelete: 'Archive',
  branchBadge: 'Branch',
  running: 'Running',
  renamePlaceholder: 'Type a session title…',
  viewList: 'List',
  viewTimeline: 'Timeline',
  timelineEmpty: 'No session branches yet. Use "Branch from here" on any session to start one.',
  timelineEmptySearch: 'No matching branches.',
  branchedFrom: 'Branched from "{title}"',
}
