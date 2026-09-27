/** `settings.rules` namespace dictionaries (the fine-grained rule editor). */

/** Locale namespace for the rule editor page. */
export const RULES_NS = 'settings.rules'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const rulesZh = {
  'nav': '权限规则',
  'title': '细粒度权限规则',
  'description': '按工具名通配符设置权限等级。优先级：deny > ask > allow > auto；更具体的模式优先。未命中的工具走兜底（默认放行）。',
  'loading': '加载中…',
  'error': '加载失败',
  'retry': '重试',
  'empty': '暂无自定义规则。添加一条规则来拦截或放行特定工具。',
  'add': '添加规则',
  'add.pattern.placeholder': '工具名模式，如 memory_* 或 shell.*',
  'add.level': '动作',
  'save': '保存',
  'saving': '保存中…',
  'delete': '删除',
  'delete.confirm': '确认删除这条规则？',
  'cancel': '取消',
  'confirm': '确认',
  'level.allow': '允许',
  'level.auto': '自动',
  'level.ask': '询问',
  'level.deny': '拒绝',
  'presets.title': '快速预设',
  'preset.strict': '严格模式',
  'preset.strict.desc': '拒绝 shell 命令，git 写操作前询问。',
  'preset.relaxed': '宽松模式',
  'preset.relaxed.desc': '全部工具自动放行。',
  'preset.apply': '应用',
  'current': '当前预设：{name}',
  'pattern.empty': '模式不能为空',
} satisfies Record<string, string>

/** The settings.rules namespace key union. */
export type RulesKey = keyof typeof rulesZh

/** English dictionary, checked complete against the zh key set. */
export const rulesEn = {
  'nav': 'Permission Rules',
  'title': 'Fine-grained Permission Rules',
  'description': 'Set a permission level per tool-name wildcard. Priority: deny > ask > allow > auto; more specific patterns win. Unmatched tools use the fallback (allow).',
  'loading': 'Loading…',
  'error': 'Failed to load',
  'retry': 'Retry',
  'empty': 'No custom rules yet. Add a rule to block or allow specific tools.',
  'add': 'Add rule',
  'add.pattern.placeholder': 'Tool-name pattern, e.g. memory_* or shell.*',
  'add.level': 'Action',
  'save': 'Save',
  'saving': 'Saving…',
  'delete': 'Delete',
  'delete.confirm': 'Delete this rule?',
  'cancel': 'Cancel',
  'confirm': 'Confirm',
  'level.allow': 'Allow',
  'level.auto': 'Auto',
  'level.ask': 'Ask',
  'level.deny': 'Deny',
  'presets.title': 'Quick presets',
  'preset.strict': 'Strict mode',
  'preset.strict.desc': 'Deny shell commands; ask before git writes.',
  'preset.relaxed': 'Relaxed mode',
  'preset.relaxed.desc': 'Allow every tool automatically.',
  'preset.apply': 'Apply',
  'current': 'Current preset: {name}',
  'pattern.empty': 'Pattern must not be empty',
} satisfies Record<RulesKey, string>
