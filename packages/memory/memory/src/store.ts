/**
 * 长期记忆 / 知识库存储层（基于 node:sqlite 的 DatabaseSync，同步 API）。
 *
 * 选同步 SQLite 的原因：记忆注入发生在 system-prompt 的同步 provider 里，
 * 同步查询可以直接拿到结果、无需把 provider 改成异步。
 *
 * 表结构：
 * - `memories`：长期记忆条目（用户偏好 / 项目知识 / 历史决策）
 * - `knowledge`：知识库文档分块（导入的 txt/md 按段落切分）
 * - `memory_terms` / `knowledge_terms`：BM25 倒排索引的持久化词项表
 *   （doc_id, term, tf），启动时加载进内存，CRUD 时同步维护。
 *
 * 检索：BM25 打分排序（中文 bigram + 英文单词分词），
 * BM25 无命中时退化为 LIKE 关键词匹配，保证旧有精确检索体验不丢。
 *
 * @module @deepseek-ai/dsh-memory/store
 */

import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { tokenize } from './tokenizer.ts'
import { Bm25Index } from './bm25.ts'

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
  // BM25 倒排索引词项表：(文档 id, 词项) 联合主键，tf 为该词在文档中的词频。
  db.exec(`
    CREATE TABLE IF NOT EXISTS memory_terms (
      memory_id TEXT NOT NULL,
      term      TEXT NOT NULL,
      tf        INTEGER NOT NULL,
      PRIMARY KEY (memory_id, term)
    ) STRICT
  `)
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_terms (
      knowledge_id TEXT NOT NULL,
      term         TEXT NOT NULL,
      tf           INTEGER NOT NULL,
      PRIMARY KEY (knowledge_id, term)
    ) STRICT
  `)
  return db
}

/** 记忆/知识库存储：所有方法均为同步（DatabaseSync）。 */
export class MemoryStore {
  private readonly db: DatabaseSync
  private closed = false
  /** 记忆的 BM25 内存索引。 */
  private readonly memIndex = new Bm25Index()
  /** 知识库的 BM25 内存索引。 */
  private readonly knowIndex = new Bm25Index()

  constructor(db: DatabaseSync) {
    this.db = db
    // 启动时从 SQLite 词项表恢复内存索引；与主表不一致时（老库升级/异常退出）重建。
    this.loadIndexes()
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

  // ---- 索引维护 -----------------------------------------------------------

  /**
   * 把一篇文档的词项写入 SQLite 词项表，并加入内存 BM25 索引。
   * @param id - 记忆 id。
   * @param content - 记忆正文。
   * @param tags - 标签列表（一并参与索引，保留原 LIKE 标签匹配能力）。
   */
  private indexMemoryDoc(id: string, content: string, tags: string[]): void {
    const tokens = tokenize([content, ...tags].join(' '))
    // 先清掉旧词项（更新场景），再写入新词项。
    this.db.prepare('DELETE FROM memory_terms WHERE memory_id = ?').run(id)
    const insert = this.db.prepare(
      'INSERT INTO memory_terms (memory_id, term, tf) VALUES (?, ?, ?)',
    )
    const tf = new Map<string, number>()
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1)
    for (const [term, freq] of tf) insert.run(id, term, freq)
    this.memIndex.addDoc(id, tokens)
  }

  /** 从内存索引与 SQLite 词项表中移除一篇记忆。 */
  private unindexMemoryDoc(id: string): void {
    this.db.prepare('DELETE FROM memory_terms WHERE memory_id = ?').run(id)
    this.memIndex.removeDoc(id)
  }

  /**
   * 把一个知识分块的词项写入 SQLite 词项表，并加入内存 BM25 索引。
   * @param id - 知识分块 id。
   * @param content - 分块正文。
   */
  private indexKnowledgeDoc(id: string, content: string): void {
    const tokens = tokenize(content)
    this.db.prepare('DELETE FROM knowledge_terms WHERE knowledge_id = ?').run(id)
    const insert = this.db.prepare(
      'INSERT INTO knowledge_terms (knowledge_id, term, tf) VALUES (?, ?, ?)',
    )
    const tf = new Map<string, number>()
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1)
    for (const [term, freq] of tf) insert.run(id, term, freq)
    this.knowIndex.addDoc(id, tokens)
  }

  /** 启动时从 SQLite 词项表重建内存索引；与主表数量不一致时全量重建。 */
  private loadIndexes(): void {
    // ---- 记忆索引 ----
    const memRows = this.db.prepare(
      'SELECT memory_id AS id, term, tf FROM memory_terms',
    ).all() as Array<{ id: string; term: string; tf: number }>
    const memDocTerms = new Map<string, Map<string, number>>()
    for (const row of memRows) {
      let m = memDocTerms.get(row.id)
      if (m === undefined) {
        m = new Map<string, number>()
        memDocTerms.set(row.id, m)
      }
      m.set(row.term, row.tf)
    }
    for (const [id, tf] of memDocTerms) this.memIndex.restoreDoc(id, tf)
    const memTotal = (this.db.prepare('SELECT COUNT(*) AS c FROM memories').get() as { c: number }).c
    if (memTotal !== this.memIndex.size) this.rebuildMemoryIndex()

    // ---- 知识库索引 ----
    const knowRows = this.db.prepare(
      'SELECT knowledge_id AS id, term, tf FROM knowledge_terms',
    ).all() as Array<{ id: string; term: string; tf: number }>
    const knowDocTerms = new Map<string, Map<string, number>>()
    for (const row of knowRows) {
      let m = knowDocTerms.get(row.id)
      if (m === undefined) {
        m = new Map<string, number>()
        knowDocTerms.set(row.id, m)
      }
      m.set(row.term, row.tf)
    }
    for (const [id, tf] of knowDocTerms) this.knowIndex.restoreDoc(id, tf)
    const knowTotal = (this.db.prepare('SELECT COUNT(*) AS c FROM knowledge').get() as { c: number }).c
    if (knowTotal !== this.knowIndex.size) this.rebuildKnowledgeIndex()
  }

  /** 全量重建记忆 BM25 索引（老库升级 / 词项表与主表不一致时使用）。 */
  private rebuildMemoryIndex(): void {
    this.db.exec('BEGIN')
    try {
      this.db.prepare('DELETE FROM memory_terms').run()
      for (const id of this.memIndex.docIds()) this.memIndex.removeDoc(id)
      const rows = this.db.prepare('SELECT id, content, tags FROM memories').all() as Array<{ id: string; content: string; tags: string }>
      for (const row of rows) {
        const tags = JSON.parse(row.tags) as string[]
        this.indexMemoryDoc(row.id, row.content, tags)
      }
      this.db.exec('COMMIT')
    } catch (err) {
      this.db.exec('ROLLBACK')
      throw err
    }
  }

  /** 全量重建知识库 BM25 索引。 */
  private rebuildKnowledgeIndex(): void {
    this.db.exec('BEGIN')
    try {
      this.db.prepare('DELETE FROM knowledge_terms').run()
      for (const id of this.knowIndex.docIds()) this.knowIndex.removeDoc(id)
      const rows = this.db.prepare('SELECT id, content FROM knowledge').all() as Array<{ id: string; content: string }>
      for (const row of rows) this.indexKnowledgeDoc(row.id, row.content)
      this.db.exec('COMMIT')
    } catch (err) {
      this.db.exec('ROLLBACK')
      throw err
    }
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
    // 写入 BM25 索引。
    this.indexMemoryDoc(entry.id, entry.content, entry.tags)
    return entry
  }

  /**
   * 搜索记忆：优先 BM25 打分排序（支持语义召回）；
   * BM25 无命中时退化为 LIKE 关键词匹配，保留旧有精确检索行为。
   * 命中后 access_count+1。
   */
  searchMemory(query: string, options: { tags?: string; limit?: number } = {}): MemoryEntry[] {
    const limit = Math.max(1, Math.min(50, options.limit ?? 10))
    const trimmed = query.trim()
    // 空 query：等价于列出（按重要度/新近）。
    if (trimmed.length === 0) {
      const rows = this.db.prepare(
        `SELECT * FROM memories ORDER BY importance DESC, updated_at DESC LIMIT ?`,
      ).all(limit)
      return this.finalizeMemory((rows as unknown[]).map(rowToMemory), options, limit)
    }

    // 1) 先尝试 BM25 语义打分。
    const tokens = tokenize(trimmed)
    const hits = this.memIndex.score(tokens)
    let entries: MemoryEntry[]
    if (hits.length > 0) {
      const stmt = this.db.prepare('SELECT * FROM memories WHERE id = ?')
      entries = []
      for (const hit of hits.slice(0, limit)) {
        const row = stmt.get(hit.id)
        if (row !== undefined) entries.push(rowToMemory(row))
      }
    } else {
      // 2) fallback：LIKE 关键词匹配（BM25 未命中任何词项时）。
      const like = `%${trimmed}%`
      const rows = this.db.prepare(
        `SELECT * FROM memories
         WHERE content LIKE ? OR tags LIKE ?
         ORDER BY importance DESC, updated_at DESC
         LIMIT ?`,
      ).all(like, like, limit)
      entries = (rows as unknown[]).map(rowToMemory)
    }
    return this.finalizeMemory(entries, options, limit)
  }

  /**
   * 对检索结果做后处理：标签过滤 + 访问次数累加。
   * 抽出为私有方法，保证 BM25 路径与 LIKE fallback 路径行为一致。
   */
  private finalizeMemory(entries: MemoryEntry[], options: { tags?: string }, limit: number): MemoryEntry[] {
    let out = entries
    if (options.tags) {
      const wanted = options.tags
      out = out.filter(e => e.tags.some(t => t === wanted))
    }
    out = out.slice(0, limit)
    // 命中后累加访问次数（用于"最近使用"排序的近似）。
    for (const e of out) {
      this.db.prepare('UPDATE memories SET access_count = access_count + 1, updated_at = ? WHERE id = ?')
        .run(Date.now(), e.id)
    }
    return out
  }

  /** 列出记忆（按重要度/新近）。 */
  listMemory(options: { limit?: number; tags?: string } = {}): MemoryEntry[] {
    return this.searchMemory('', { ...options })
  }

  /** 更新记忆（content/tags/importance 可选）；内容或标签变化时同步重建 BM25 索引。 */
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
    // 内容/标签变了就重建该文档的倒排词项。
    this.indexMemoryDoc(id, content, tags)
    return this.getMemory(id)!
  }

  /** 删除记忆（同时清理 BM25 索引词项）。 */
  deleteMemory(id: string): boolean {
    const res = this.db.prepare('DELETE FROM memories WHERE id = ?').run(id)
    if (res.changes > 0) this.unindexMemoryDoc(id)
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

  /** 导入一个文档的若干分块，返回写入的分块数；每个分块同时建立 BM25 索引。 */
  importKnowledge(source: string, chunks: string[]): number {
    const now = Date.now()
    const insert = this.db.prepare(
      'INSERT INTO knowledge (id, source, chunk_index, content, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    let n = 0
    for (let i = 0; i < chunks.length; i += 1) {
      const text = chunks[i]!.trim()
      if (text.length === 0) continue
      const id = makeId('know')
      insert.run(id, source, i, text, now)
      this.indexKnowledgeDoc(id, text)
      n += 1
    }
    return n
  }

  /**
   * 搜索知识库分块：BM25 打分排序优先；无命中时退化为 LIKE 匹配。
   */
  searchKnowledge(query: string, limit = 10): KnowledgeChunk[] {
    const lim = Math.max(1, Math.min(50, limit))
    const trimmed = query.trim()
    if (trimmed.length === 0) {
      const rows = this.db.prepare(
        'SELECT * FROM knowledge ORDER BY created_at DESC LIMIT ?',
      ).all(lim)
      return (rows as unknown[]).map(rowToKnowledge)
    }
    const tokens = tokenize(trimmed)
    const hits = this.knowIndex.score(tokens)
    if (hits.length > 0) {
      const stmt = this.db.prepare('SELECT * FROM knowledge WHERE id = ?')
      const out: KnowledgeChunk[] = []
      for (const hit of hits.slice(0, lim)) {
        const row = stmt.get(hit.id)
        if (row !== undefined) out.push(rowToKnowledge(row))
      }
      return out
    }
    // fallback：LIKE 关键词匹配。
    const like = `%${trimmed}%`
    const rows = this.db.prepare(
      'SELECT * FROM knowledge WHERE content LIKE ? ORDER BY created_at DESC LIMIT ?',
    ).all(like, lim)
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
