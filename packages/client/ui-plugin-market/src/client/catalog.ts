/**
 * 内置精选插件目录（curated catalog）。
 *
 * 最小可用版：尚无在线插件市场后端，这里维护一份前端可读的目录数据。官方条目
 * 指向仓库内真实存在的组合包（@deepseek-ai/dsh-*），社区条目为描述性占位，
 * 标注「即将上线」。安装动作在 store 中以本地状态记录并提示重启生效；
 * 真实热加载/远程安装接后续路线（复用 ui-plugin-manager 的 pluginManager Remote）。
 */

/** 插件分类 id，与 locales 中的 cat* 文案一一对应。 */
export type PluginCategory =
  | 'finance'
  | 'ecommerce'
  | 'programming'
  | 'writing'
  | 'data'
  | 'tools'

/** 一个目录条目。 */
export interface CatalogEntry {
  /** 稳定 id（与安装状态存储的 key 对应）。 */
  readonly id: string
  /** 展示名称。 */
  readonly name: string
  /** 对应的插件包名（官方条目为真实 bundle；社区条目为占位）。 */
  readonly packageName: string
  /** 一句话描述。 */
  readonly description: string
  readonly category: PluginCategory
  readonly tags: readonly string[]
  readonly version: string
  readonly author: string
  /** 卡片图标（emoji，零依赖、深浅色自适应）。 */
  readonly icon: string
  /** 图标底色渐变的色相，用于生成深浅色自适应的强调色。 */
  readonly hue: number
  /** 功能特性列表。 */
  readonly features: readonly string[]
  /** 是否官方出品。 */
  readonly official: boolean
  /** 社区占位条目：不可安装，仅展示。 */
  readonly comingSoon: boolean
  /** 是否在精选横幅区展示。 */
  readonly featured: boolean
  /** 模拟安装量（用于「安装最多」排序）。 */
  readonly installs: number
  /** 最近更新时间（ISO，用于「最新」排序）。 */
  readonly updatedAt: string
}

/** 全部插件目录。 */
export const CATALOG: readonly CatalogEntry[] = [
  {
    id: 'dsh-finance',
    name: '金融专业插件包',
    packageName: '@deepseek-ai/dsh-finance',
    description: '行情、财务、估值、选股、研报与风险测算，启用即把界面变成金融终端。',
    category: 'finance',
    tags: ['行情', '财务', '估值', '选股'],
    version: '0.1.7',
    author: 'DeepSeek',
    icon: '📈',
    hue: 222,
    features: ['实时行情与 K 线面板', '财务报表与估值模型', '选股策略与筛选', '研报摘要与风险测算'],
    official: true,
    comingSoon: false,
    featured: true,
    installs: 12840,
    updatedAt: '2026-09-20',
  },
  {
    id: 'dsh-ecommerce',
    name: '电商运营插件包',
    packageName: '@deepseek-ai/dsh-ecommerce',
    description: '商品、订单、库存与营销分析，面向电商卖家的一站式运营助手。',
    category: 'ecommerce',
    tags: ['商品', '订单', '库存', '营销'],
    version: '0.1.7',
    author: 'DeepSeek',
    icon: '🛒',
    hue: 262,
    features: ['商品与库存管理', '订单履约跟踪', '营销活动分析', '经营看板'],
    official: true,
    comingSoon: false,
    featured: true,
    installs: 8620,
    updatedAt: '2026-09-18',
  },
  {
    id: 'dsh-general-full',
    name: '通用全能增强包',
    packageName: '@deepseek-ai/dsh-general-full',
    description: '2026 通用 Agent 能力拉满：工具集、子代理、记忆与工作流一体启用。',
    category: 'tools',
    tags: ['全能', '工具集', '子代理', '工作流'],
    version: '0.1.7',
    author: 'DeepSeek',
    icon: '🚀',
    hue: 168,
    features: ['扩展工具集与权限预设', '多子代理协作', '持久记忆与上下文', '可编排工作流'],
    official: true,
    comingSoon: false,
    featured: true,
    installs: 20310,
    updatedAt: '2026-09-22',
  },
  {
    id: 'voice-input',
    name: '语音输入',
    packageName: '@deepseek-ai/dsh-client-ui-voice-input',
    description: '在输入栏直接语音转文字，支持长段口述与实时标点。',
    category: 'tools',
    tags: ['语音', '听写', '无障碍'],
    version: '0.1.6',
    author: 'DeepSeek',
    icon: '🎙️',
    hue: 200,
    features: ['一键语音听写', '长段连续识别', '实时标点与断句'],
    official: true,
    comingSoon: false,
    featured: false,
    installs: 6450,
    updatedAt: '2026-09-10',
  },
  {
    id: 'agent-team',
    name: '多智能体团队',
    packageName: '@deepseek-ai/dsh-client-ui-agent-team',
    description: '编排多个专职子代理分工协作，把复杂任务拆给团队完成。',
    category: 'programming',
    tags: ['子代理', '协作', '编排'],
    version: '0.1.6',
    author: 'DeepSeek',
    icon: '🤖',
    hue: 288,
    features: ['角色化子代理', '任务自动分派', '过程可观测'],
    official: true,
    comingSoon: false,
    featured: false,
    installs: 5120,
    updatedAt: '2026-09-08',
  },
  {
    id: 'smart-writing',
    name: '智能写作助手',
    packageName: '@deepseek-ai/dsh-plugin-smart-writing',
    description: '大纲、润色、改写与多风格文案，面向内容创作者的写作工作台。',
    category: 'writing',
    tags: ['写作', '润色', '文案'],
    version: '0.1.0',
    author: '社区作者 · 林深',
    icon: '✍️',
    hue: 24,
    features: ['一键大纲生成', '语气与风格润色', '多版本对比改写'],
    official: false,
    comingSoon: true,
    featured: false,
    installs: 0,
    updatedAt: '2026-09-25',
  },
  {
    id: 'data-insight',
    name: '数据分析与可视化',
    packageName: '@deepseek-ai/dsh-plugin-data-insight',
    description: '上传表格即可提问、出图、生成洞察报告，无需写 SQL。',
    category: 'data',
    tags: ['数据', '图表', 'BI'],
    version: '0.1.0',
    author: '社区作者 · 数据熊',
    icon: '📊',
    hue: 150,
    features: ['自然语言查数', '自动图表推荐', '洞察报告导出'],
    official: false,
    comingSoon: true,
    featured: false,
    installs: 0,
    updatedAt: '2026-09-24',
  },
  {
    id: 'code-review',
    name: '代码评审助手',
    packageName: '@deepseek-ai/dsh-plugin-code-review',
    description: '针对 Pull Request 给出缺陷、安全与可维护性评审意见。',
    category: 'programming',
    tags: ['代码', '评审', '质量'],
    version: '0.1.0',
    author: '社区作者 · DevPanda',
    icon: '🔍',
    hue: 210,
    features: ['变更逐行评审', '安全风险提示', '可维护性建议'],
    official: false,
    comingSoon: true,
    featured: false,
    installs: 0,
    updatedAt: '2026-09-23',
  },
  {
    id: 'web-search-pro',
    name: '增强联网搜索',
    packageName: '@deepseek-ai/dsh-plugin-web-search-pro',
    description: '多引擎聚合检索与网页精读，带来源引用的实时问答。',
    category: 'tools',
    tags: ['搜索', '联网', '引用'],
    version: '0.1.0',
    author: '社区作者 · SearchLab',
    icon: '🌐',
    hue: 180,
    features: ['多引擎聚合', '网页正文精读', '答案附来源引用'],
    official: false,
    comingSoon: true,
    featured: false,
    installs: 0,
    updatedAt: '2026-09-21',
  },
  {
    id: 'spreadsheet',
    name: '电子表格处理',
    packageName: '@deepseek-ai/dsh-plugin-spreadsheet',
    description: '读写 Excel / CSV，公式、透视与批量清洗一键完成。',
    category: 'data',
    tags: ['Excel', '表格', '清洗'],
    version: '0.1.0',
    author: '社区作者 · 表表哥',
    icon: '📗',
    hue: 120,
    features: ['Excel/CSV 读写', '公式与透视表', '批量数据清洗'],
    official: false,
    comingSoon: true,
    featured: false,
    installs: 0,
    updatedAt: '2026-09-19',
  },
  {
    id: 'design-to-code',
    name: '设计转代码',
    packageName: '@deepseek-ai/dsh-plugin-design-to-code',
    description: '粘贴设计稿截图，生成结构清晰的前端组件与样式。',
    category: 'programming',
    tags: ['设计', '前端', 'UI'],
    version: '0.1.0',
    author: '社区作者 · Pixel',
    icon: '🎨',
    hue: 320,
    features: ['截图转组件', '样式 token 对齐', '响应式输出'],
    official: false,
    comingSoon: true,
    featured: false,
    installs: 0,
    updatedAt: '2026-09-15',
  },
  {
    id: 'notes-doc',
    name: '笔记与文档',
    packageName: '@deepseek-ai/dsh-plugin-notes-doc',
    description: '会话沉淀为结构化笔记，支持双链、标签与全文检索。',
    category: 'writing',
    tags: ['笔记', '文档', '知识库'],
    version: '0.1.0',
    author: '社区作者 · 墨斗',
    icon: '📝',
    hue: 45,
    features: ['会话一键存笔记', '双链与标签', '本地全文检索'],
    official: false,
    comingSoon: true,
    featured: false,
    installs: 0,
    updatedAt: '2026-09-12',
  },
]

/** 分类顺序（与顶部标签栏一致）。 */
export const CATEGORY_ORDER: readonly PluginCategory[] = [
  'finance',
  'ecommerce',
  'programming',
  'writing',
  'data',
  'tools',
]

/** 排序方式。 */
export type SortMode = 'recommended' | 'newest' | 'installs'

/**
 * 按关键词、分类、排序过滤目录。
 * @param entries - 全量目录。
 * @param query - 名称/描述/标签关键词（小写）。
 * @param category - 选中分类，'all' 表示全部。
 * @param sort - 排序方式。
 * @returns 过滤后的条目。
 */
export function filterCatalog(
  entries: readonly CatalogEntry[],
  query: string,
  category: PluginCategory | 'all',
  sort: SortMode,
): readonly CatalogEntry[] {
  const q = query.trim().toLowerCase()
  let result = entries.filter(entry =>
    category === 'all' || entry.category === category,
  )
  if (q !== '') {
    result = result.filter(entry =>
      entry.name.toLowerCase().includes(q)
      || entry.description.toLowerCase().includes(q)
      || entry.tags.some(tag => tag.toLowerCase().includes(q)),
    )
  }
  const sorted = [...result]
  switch (sort) {
    case 'newest':
      sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      break
    case 'installs':
      sorted.sort((a, b) => b.installs - a.installs)
      break
    case 'recommended':
    default:
      // 官方且精选优先，其次安装量。
      sorted.sort((a, b) => {
        const score = (e: CatalogEntry): number =>
          (e.featured ? 2 : 0) + (e.official ? 1 : 0) + e.installs / 10000
        return score(b) - score(a)
      })
  }
  return sorted
}
