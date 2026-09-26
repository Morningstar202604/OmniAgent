/**
 * 长期记忆 / 知识库存储层（基于 node:sqlite 的 DatabaseSync，同步 API）。
 *
 * 选同步 SQLite 的原因：记忆注入发生在 system-prompt 的同步 provider 里，
 * 同步查询可以直接拿到结果、无需把 provider 改成异步。
 *
 * 表结构：
 * - `memories`：长期记忆条目（用户偏好 / 项目知识 / 历史决策）
 * - `knowledge`：知识库文档分块（导入的 txt/md 按段落切分）
 *
 * 检索为最小可用版：内容/标签的 LIKE 关键词匹配 + 重要度与最近使用排序。
 * 后续路线：接入 embedding 向量检索（见包 README）。
 *
 * @module @deepseek-ai/dsh-memory/store
 */

import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

/** 一条长期记忆。 */
export interface MemoryEntry {
  /** 主键。 */
  id: string
  /** 记忆正文。 */
  content: string
  /** 标签列表。 */
  tags: string[]
  /** 来源：用户明示 / 对话提取 / 文件导入。 */
  source: string
  /** 重要性 0~1。 */
  importance: number
  /** 被召回次数。 */
  accessCount: number
  /** 创建时间（ms）。 */
  createdAt: number
  /** 更新时间（ms）。 */
  updatedAt: number
}

/** 一条知识库分块。 */
export interface KnowledgeChunk {
  /** 主键。 */
  id: string
  /** 来源文件路径或名称。 */
  source: string
  /** 分块序号。 */
  chunkIndex: number
  /** 分块正文。 */
  content: string
  /** 创建时间（ms）。 */
  createdAt: number
}

/** 一条记忆的写入参数。 */
export interface AddMemoryInput {
  content: string
  tags?: string[]
  source?: string
  importance?: number
}

/** 生成一个简短唯一 id（足够本地记忆使用，无需 UUID 依赖）。 */
function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 打开（必要时创建）记忆数据库并建表。
 * @param path - 数据库文件路径；`:memory:` 用于测试。
 * @returns 打开的 DatabaseSync 连接。
 */
export function openMemoryDatabase(path: string): DatabaseSync {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  }
  const db = new DatabaseSync(path)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id           TEXT PRIMARY KEY,
      content      TEXT NOT NULL,
      tags         TEXT NOT NULL,
      source       TEXT NOT NULL,
      importance   REAL NOT NULL,
      access_count INTEGER NOT NULL,
      created_at   INTEGER NOT NULL,
      updated_at   INTEGER NOT NULL
    ) STRICT
  `)
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge (
      id          TEXT PRIMARY KEY,
      source      TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content     TEXT NOT NULL,
      created_at  INTEGER NOT NULL
    ) STRICT
  `)
  return db
}

/** 记忆/知识库存储：所有方法均为同步（DatabaseSync）。 */
export class MemoryStore {
  private readonly db: DatabaseSync
  private closed = false

  constructor(db: DatabaseSync) {
    this.db = db
  }

  /** 用文件路径直接打开一个存储实例（便捷工厂）。 */
  static open(path: string): MemoryStore {
    return new MemoryStore(openMemoryDatabase(path))
  }

  /** 关闭数据库。 */
  close(): void {
    if (this.closed) return
    this.closed = true
    this.db.close()
  }

  // ---- 记忆 CRUD ---------------------------------------------------------

  /** 添加一条记忆，返回完整条目。 */
  addMemory(input: AddMemoryInput): MemoryEntry {
    const now = Date.now()
    const importance = Math.max(0, Math.min(1, input.importance ?? 0.5))
    const tags = input.tags ?? []
    const entry: MemoryEntry = {
      id: makeId('mem'),
      content: input.content,
      tags,
      source: input.source ?? '对话提取',
      importance,
      accessCount: 0,
      createdAt: now,
      updatedAt: now,
    }
    this.db.prepare(
      'INSERT INTO memories (id, content, tags, source, importance, access_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(entry.id, entry.content, JSON.stringify(entry.tags), entry.source, entry.importance, 0, now, now)
    return entry
  }

  /**
   * 关键词搜索记忆。LIKE 匹配 content 与 tags；
   * 排序：相关关键词命中 + 重要度 + 最近更新/使用。命中后 access_count+1。
   */
  searchMemory(query: string, options: { tags?: string; limit?: number } = {}): MemoryEntry[] {
    const limit = Math.max(1, Math.min(50, options.limit ?? 10))
    const like = `%${query.trim()}%`
    // 关键词命中 content 或 tags 即视为匹配；空 query 等价于列出（按重要度/新近）。
    const hasQuery = query.trim().length > 0
    const rows = hasQuery
      ? this.db.prepare(
          `SELECT * FROM memories
           WHERE content LIKE ? OR tags LIKE ?
           ORDER BY importance DESC, updated_at DESC
           LIMIT ?`,
        ).all(like, like, limit)
      : this.db.prepare(
          `SELECT * FROM memories
           ORDER BY importance DESC, updated_at DESC
           LIMIT ?`,
        ).all(limit)
    const entries = (rows as unknown[]).map(rowToMemory)
    if (options.tags) {
      const wanted = options.tags
      return entries.filter(e => e.tags.some(t => t === wanted)).slice(0, limit)
    }
    // 命中后累加访问次数（用于"最近使用"排序的近似）。
    for (const e of entries) {
      this.db.prepare('UPDATE memories SET access_count = access_count + 1, updated_at = ? WHERE id = ?')
        .run(Date.now(), e.id)
    }
    return entries
  }

  /** 列出记忆（按重要度/新近）。 */
  listMemory(options: { limit?: number; tags?: string } = {}): MemoryEntry[] {
    return this.searchMemory('', { ...options })
  }

  /** 更新记忆（content/tags/importance 可选）。 */
  updateMemory(id: string, patch: { content?: string; tags?: string[]; importance?: number }): MemoryEntry {
    const existing = this.getMemory(id)
    if (existing === undefined) throw new Error(`memory_update: 记忆 "${id}" 不存在`)
    const content = patch.content ?? existing.content
    const tags = patch.tags ?? existing.tags
    const importance = patch.importance !== undefined
      ? Math.max(0, Math.min(1, patch.importance))
      : existing.importance
    const now = Date.now()
    this.db.prepare('UPDATE memories SET content = ?, tags = ?, importance = ?, updated_at = ? WHERE id = ?')
      .run(content, JSON.stringify(tags), importance, now, id)
    return this.getMemory(id)!
  }

  /** 删除记忆。 */
  deleteMemory(id: string): boolean {
    const res = this.db.prepare('DELETE FROM memories WHERE id = ?').run(id)
    return res.changes > 0
  }

  /** 按 id 取一条记忆。 */
  getMemory(id: string): MemoryEntry | undefined {
    const row = this.db.prepare('SELECT * FROM memories WHERE id = ?').get(id)
    return row === undefined ? undefined : rowToMemory(row)
  }

  /**
   * 供系统提示词注入使用：取"最重要且最近使用"的一批记忆（同步）。
   * 不要求 query，因为同步 provider 拿不到当前用户消息——这是 MVP 的已知边界。
   */
  topMemories(limit: number): MemoryEntry[] {
    const rows = this.db.prepare(
      `SELECT * FROM memories
       ORDER BY importance DESC, access_count DESC, updated_at DESC
       LIMIT ?`,
    ).all(limit)
    return (rows as unknown[]).map(rowToMemory)
  }

  // ---- 知识库 ------------------------------------------------------------

  /** 导入一个文档的若干分块，返回写入的分块数。 */
  importKnowledge(source: string, chunks: string[]): number {
    const now = Date.now()
    const insert = this.db.prepare(
      'INSERT INTO knowledge (id, source, chunk_index, content, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    let n = 0
    for (let i = 0; i < chunks.length; i += 1) {
      const text = chunks[i]!.trim()
      if (text.length === 0) continue
      insert.run(makeId('know'), source, i, text, now)
      n += 1
    }
    return n
  }

  /** 关键词搜索知识库分块。 */
  searchKnowledge(query: string, limit = 10): KnowledgeChunk[] {
    const like = `%${query.trim()}%`
    const rows = this.db.prepare(
      `SELECT * FROM knowledge WHERE content LIKE ? ORDER BY created_at DESC LIMIT ?`,
    ).all(like, Math.max(1, Math.min(50, limit)))
    return (rows as unknown[]).map(rowToKnowledge)
  }
}

/** 把数据库行映射为 MemoryEntry。 */
function rowToMemory(row: unknown): MemoryEntry {
  const r = row as Record<string, unknown>
  return {
    id: r.id as string,
    content: r.content as string,
    tags: JSON.parse(r.tags as string) as string[],
    source: r.source as string,
    importance: r.importance as number,
    accessCount: r.access_count as number,
    createdAt: r.created_at as number,
    updatedAt: r.updated_at as number,
  }
}

/** 把数据库行映射为 KnowledgeChunk。 */
function rowToKnowledge(row: unknown): KnowledgeChunk {
  const r = row as Record<string, unknown>
  return {
    id: r.id as string,
    source: r.source as string,
    chunkIndex: r.chunk_index as number,
    content: r.content as string,
    createdAt: r.created_at as number,
  }
}
