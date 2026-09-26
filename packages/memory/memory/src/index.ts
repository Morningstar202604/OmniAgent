/**
 * 长期记忆 / 知识库宿主插件（对标 Claude Memory / Kimi 知识库的最小可用版）。
 *
 * 能力：
 * - 跨会话持久化记忆（SQLite），模型可主动调用 `memory_add` 记录用户偏好/项目知识/历史决策；
 * - `memory_search` / `memory_list` / `memory_update` / `memory_delete` 管理记忆；
 * - `knowledge_import` 导入 txt/md 文档（按段落切分），`knowledge_search` 关键词检索；
 * - 每次拼装系统提示词时，把"最重要 + 最近使用"的若干条记忆注入 system prompt，
 *   受 token（字符）预算约束，避免系统提示词过长。
 *
 * 设计取舍与后续路线：
 * - 检索为关键词 LIKE 匹配 + 重要度/新近排序，未引入向量数据库；
 *   语义召回（embedding + 向量索引）列为后续路线，不做静默降级。
 * - 注入发生在同步 system-prompt provider 中，无法拿到当前用户消息，
 *   因此注入的是全局重要记忆而非"按当前问题召回"；按轮次语义召回待后续接入。
 *
 * @module @deepseek-ai/dsh-memory
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { MemoryStore } from './store.ts'

/** Cordis 插件名。 */
export const name = 'memory'

/** 访问 tools（注册记忆/知识库工具）与 systemPrompt（注入记忆段落），必须声明 inject。 */
export const inject: readonly string[] = ['tools', 'systemPrompt']

/** 插件配置。 */
export interface Config {
  /** 数据库文件路径。默认 `~/.omniagent/memory.db`；可用环境变量 DSH_MEMORY_DB_PATH 覆盖。 */
  path?: string
  /** 注入系统提示词的最大记忆条数（默认 6）。 */
  injectMaxEntries?: number
  /** 注入记忆的字符预算上限（默认 1500，约 1k token 内）。 */
  injectMaxChars?: number
}

/** schemastery 校验器。 */
export const Config: z<Config> = z.object({
  path: z.string(),
  injectMaxEntries: z.number().default(6),
  injectMaxChars: z.number().default(1500),
})

/** 系统提示词中记忆段落的 order（位于交付物引用之后、结构化输出之前）。 */
const MEMORY_SECTION_ORDER = 9500

/** 一条记忆结果（工具输出用）。 */
interface MemoryResult {
  id: string
  content: string
  tags: string[]
  importance: number
}

/** 把 MemoryEntry 映射为工具输出条目。 */
function toResult(e: { id: string; content: string; tags: string[]; importance: number }): MemoryResult {
  return { id: e.id, content: e.content, tags: e.tags, importance: e.importance }
}

/** 按段落切分文档，并把过长段落按字符再切分，返回非空分块。 */
function splitIntoChunks(text: string, maxChars = 800): string[] {
  const paragraphs = text.split(/\n\s*\n/)
  const chunks: string[] = []
  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (trimmed.length === 0) continue
    if (trimmed.length <= maxChars) {
      chunks.push(trimmed)
    } else {
      for (let i = 0; i < trimmed.length; i += maxChars) {
        chunks.push(trimmed.slice(i, i + maxChars))
      }
    }
  }
  return chunks
}

/**
 * 安装记忆插件。
 * @param ctx - 宿主上下文。
 * @param config - 校验后的配置。
 */
export function apply(ctx: Context, config: Config): void {
  const path = process.env.DSH_MEMORY_DB_PATH
    ?? config.path
    ?? join(homedir(), '.omniagent', 'memory.db')
  const store = MemoryStore.open(path)
  // 宿主停止时关闭数据库。
  ctx.effect(() => () => store.close(), 'memory.close')

  const injectMaxEntries = config.injectMaxEntries as number
  const injectMaxChars = config.injectMaxChars as number

  // ---- 系统提示词注入：同步 provider，每次拼装时取最重要的记忆 ----------------
  ctx.systemPrompt.section({
    name: 'memory:long-term',
    order: MEMORY_SECTION_ORDER,
    text: () => {
      const entries = store.topMemories(injectMaxEntries)
      if (entries.length === 0) return ''
      const lines: string[] = ['## 长期记忆（跨会话，用户偏好 / 项目知识 / 历史决策；请遵循）']
      let used = 0
      for (const e of entries) {
        const line = `- ${e.content}`
        if (used + line.length > injectMaxChars) break
        lines.push(line)
        used += line.length
      }
      return lines.join('\n')
    },
  })

  // ---- 记忆工具 -----------------------------------------------------------

  ctx.tools.register(defineTool({
    name: 'memory_add',
    description: '向长期记忆添加一条事实。用于保存跨会话需要记住的信息：用户偏好（如"喜欢中文简洁回复"）、项目知识（如"用 pnpm monorepo，构建命令 pnpm run build:web"）、历史决策（如"不推送 gitcode，commit 本地保留"）。当用户明确要求记住某事，或对话中出现稳定的偏好/约定时调用。',
    parameters: {
      content: { type: 'string', required: true, description: '要记住的事实内容，一句话陈述。' },
      tags: { type: 'array', items: { type: 'string' }, description: '可选标签，如 ["偏好","项目","决策"]。' },
      importance: { type: 'number', description: '重要性 0~1，越高越优先注入系统提示词（默认 0.5）。' },
      source: { type: 'string', description: '来源标注，默认"对话提取"。' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          id: { type: 'string', required: true },
          content: { type: 'string', required: true },
        },
      },
      render: (_a, v) => [{ type: 'text', text: `已记住：${v.content}` }],
    },
    async execute(args: { content: string; tags?: string[]; importance?: number; source?: string }) {
      if (typeof args.content !== 'string' || args.content.trim().length === 0) {
        throw new Error('memory_add: content 不能为空')
      }
      const entry = store.addMemory({
        content: args.content.trim(),
        ...(args.tags !== undefined ? { tags: args.tags } : {}),
        ...(args.importance !== undefined ? { importance: args.importance } : {}),
        ...(args.source !== undefined ? { source: args.source } : {}),
      })
      return { id: entry.id, content: entry.content }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'memory_search',
    description: '按关键词搜索长期记忆。根据当前任务或用户问题检索相关的历史记忆（用户偏好/项目知识/历史决策）。',
    parameters: {
      query: { type: 'string', required: true, description: '关键词或短语，匹配记忆内容或标签。' },
      tags: { type: 'string', description: '可选，只返回带该标签的记忆。' },
      limit: { type: 'number', description: '返回条数上限，默认 10。' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          results: {
            type: 'array', required: true,
            items: {
              type: 'object', additionalProperties: false,
              properties: {
                id: { type: 'string', required: true },
                content: { type: 'string', required: true },
                tags: { type: 'array', required: true, items: { type: 'string' } },
                importance: { type: 'number', required: true },
              },
            },
          },
        },
      },
      render: (_a, v) => {
        if (v.results.length === 0) return [{ type: 'text', text: '未找到相关记忆。' }]
        return [{ type: 'text', text: v.results.map(x => `- ${x.content}${x.tags.length > 0 ? ` [${x.tags.join(',')}]` : ''}`).join('\n') }]
      },
    },
    async execute(args: { query: string; tags?: string; limit?: number }) {
      const results = store.searchMemory(args.query, {
        ...(args.tags !== undefined ? { tags: args.tags } : {}),
        ...(args.limit !== undefined ? { limit: args.limit } : {}),
      })
      return { results: results.map(toResult) }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'memory_update',
    description: '更新一条已有记忆的内容、标签或重要性。',
    parameters: {
      id: { type: 'string', required: true, description: '要更新的记忆 id。' },
      content: { type: 'string', description: '新的内容。' },
      tags: { type: 'array', items: { type: 'string' }, description: '新的标签列表（整体替换）。' },
      importance: { type: 'number', description: '新的重要性 0~1。' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          id: { type: 'string', required: true },
          content: { type: 'string', required: true },
        },
      },
      render: (_a, v) => [{ type: 'text', text: `已更新记忆：${v.content}` }],
    },
    async execute(args: { id: string; content?: string; tags?: string[]; importance?: number }) {
      const entry = store.updateMemory(args.id, {
        ...(args.content !== undefined ? { content: args.content } : {}),
        ...(args.tags !== undefined ? { tags: args.tags } : {}),
        ...(args.importance !== undefined ? { importance: args.importance } : {}),
      })
      return { id: entry.id, content: entry.content }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'memory_delete',
    description: '删除一条长期记忆。',
    parameters: {
      id: { type: 'string', required: true, description: '要删除的记忆 id。' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: { ok: { type: 'boolean', required: true } },
      },
      render: (_a, v) => [{ type: 'text', text: v.ok ? '已删除该记忆。' : '未找到该记忆。' }],
    },
    async execute(args: { id: string }) {
      return { ok: store.deleteMemory(args.id) }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'memory_list',
    description: '列出长期记忆（按重要性与新近程度排序），可按标签过滤。',
    parameters: {
      limit: { type: 'number', description: '返回条数上限，默认 20。' },
      tags: { type: 'string', description: '可选，只列带该标签的记忆。' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          results: {
            type: 'array', required: true,
            items: {
              type: 'object', additionalProperties: false,
              properties: {
                id: { type: 'string', required: true },
                content: { type: 'string', required: true },
                tags: { type: 'array', required: true, items: { type: 'string' } },
                importance: { type: 'number', required: true },
              },
            },
          },
        },
      },
      render: (_a, v) => {
        if (v.results.length === 0) return [{ type: 'text', text: '暂无记忆。' }]
        return [{ type: 'text', text: v.results.map(x => `- [${x.id}] ${x.content}`).join('\n') }]
      },
    },
    async execute(args: { limit?: number; tags?: string }) {
      const results = store.listMemory({
        limit: args.limit ?? 20,
        ...(args.tags !== undefined ? { tags: args.tags } : {}),
      })
      return { results: results.map(toResult) }
    },
  }))

  // ---- 知识库工具 ----------------------------------------------------------

  ctx.tools.register(defineTool({
    name: 'knowledge_import',
    description: '把一个本地文本文档（.txt / .md）导入知识库。文档按段落切分后存储，供后续 knowledge_search 检索。',
    parameters: {
      path: { type: 'string', required: true, description: '要导入的本地文件绝对路径（.txt 或 .md）。' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          source: { type: 'string', required: true },
          chunks: { type: 'number', required: true },
        },
      },
      render: (_a, v) => [{ type: 'text', text: `已导入 ${v.chunks} 个分块。` }],
    },
    async execute(args: { path: string }) {
      const text = readFileSync(args.path, 'utf-8')
      const chunks = splitIntoChunks(text)
      const n = store.importKnowledge(args.path, chunks)
      return { source: args.path, chunks: n }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'knowledge_search',
    description: '在已导入的知识库文档中按关键词检索相关段落。',
    parameters: {
      query: { type: 'string', required: true, description: '关键词或问题短语。' },
      limit: { type: 'number', description: '返回分块上限，默认 10。' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          results: {
            type: 'array', required: true,
            items: {
              type: 'object', additionalProperties: false,
              properties: {
                source: { type: 'string', required: true },
                content: { type: 'string', required: true },
              },
            },
          },
        },
      },
      render: (_a, v) => {
        if (v.results.length === 0) return [{ type: 'text', text: '知识库中未找到相关内容。' }]
        return [{ type: 'text', text: v.results.map(x => `【${x.source}】\n${x.content}`).join('\n\n---\n\n') }]
      },
    },
    async execute(args: { query: string; limit?: number }) {
      const chunks = store.searchKnowledge(args.query, args.limit ?? 10)
      return { results: chunks.map(c => ({ source: c.source, content: c.content })) }
    },
  }))
}
