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
 * - `memory_vectors` / `knowledge_vectors`：稠密向量存储（JSON 序列化的 number[]），
 *   仅当配置了真 embedding 提供方时写入；本地 TF 稀疏方案不落表、实时计算。
 * - `memory_meta`：键值元信息（记录当前向量空间对应的 provider 名，用于换 provider 时重建）。
 *
 * 检索：BM25 + 向量 hybrid 融合打分（final = alpha*bm25 + (1-alpha)*vector）。
 * - 默认离线：本地 TF 稀疏向量复用词项表，零网络、零额外存储；
 * - 配置国产 embedding API 后升级为稠密向量，可召回"无共同词但语义相近"的文档；
 * - 两路都未命中时退化为 LIKE 关键词匹配，保证旧有精确检索体验不丢。
 *
 * @module @deepseek-ai/dsh-memory/store
 */

import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { tokenize } from './tokenizer.ts'
import { Bm25Index } from './bm25.ts'
import {
  buildSparseVector,
  cosineDense,
  cosineSparse,
  fuseScores,
  type SparseVector,
} from './vector.ts'
import { LocalTFEmbedding, type EmbeddingProvider } from './embedding.ts'

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

/** 带 hybrid 融合分数的记忆条目（仅检索返回时填充）。 */
export interface ScoredMemoryEntry extends MemoryEntry {
  /** hybrid 融合分数（越大越相关）；列表/注入场景不填充。 */
  score?: number
}

/** MemoryStore 的构造选项。 */
export interface StoreOptions {
  /**
   * 向量提供方。默认 `LocalTFEmbedding`（离线、零依赖）。
   * 配置了国产 embedding API 时传入 OpenAICompatibleEmbedding 以启用真稠密向量召回。
   */
  embedding?: EmbeddingProvider
  /**
   * hybrid 融合中 BM25 的权重（0~1），向量权重为 1-alpha，默认 0.5。
   * alpha=1 等价纯 BM25；alpha=0 等价纯向量。
   */
  hybridAlpha?: number
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
  // 稠密向量存储：仅真 embedding 提供方写入。vector 为 JSON 序列化的 number[]
  // （任务要求 BLOB 列，这里用 TEXT 存 JSON 以规避 node:sqlite STRICT 的类型转换）。
  // provider 列记录生成该向量的提供方名，换 provider 时启动重建。
  db.exec(`
    CREATE TABLE IF NOT EXISTS memory_vectors (
      memory_id TEXT PRIMARY KEY,
      vector    TEXT NOT NULL,
      provider  TEXT NOT NULL
    ) STRICT
  `)
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_vectors (
      knowledge_id TEXT PRIMARY KEY,
      vector       TEXT NOT NULL,
      provider     TEXT NOT NULL
    ) STRICT
  `)
  // 键值元信息：记录当前向量空间对应的 provider 名等。
  db.exec(`
    CREATE TABLE IF NOT EXISTS memory_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) STRICT
  `)
  return db
}

/** 记忆/知识库存储：CRUD 为同步（DatabaseSync）；检索因可能调用 embedding 而返回 Promise。 */
export class MemoryStore {
  private readonly db: DatabaseSync
  private closed = false
  /** 记忆的 BM25 内存索引。 */
  private readonly memIndex = new Bm25Index()
  /** 知识库的 BM25 内存索引。 */
  private readonly knowIndex = new Bm25Index()
  /** 当前向量提供方（默认本地 TF 稀疏，离线可用）。 */
  private readonly provider: EmbeddingProvider
  /** hybrid 融合中 BM25 的权重。 */
  private readonly alpha: number

  constructor(db: DatabaseSync, options: StoreOptions = {}) {
    this.db = db
    this.provider = options.embedding ?? new LocalTFEmbedding()
    this.alpha = Math.max(0, Math.min(1, options.hybridAlpha ?? 0.5))
    // 启动时从 SQLite 词项表恢复内存索引；与主表不一致时（老库升级/异常退出）重建。
    this.loadIndexes()
    // 检测向量提供方是否变化，变化则让旧稠密向量失效（下次写入重建）。
    this.migrateVectorsIfProviderChanged()
  }

  /** 用文件路径直接打开一个存储实例（便捷工厂）。 */
  static open(path: string, options: StoreOptions = {}): MemoryStore {
    return new MemoryStore(openMemoryDatabase(path), options)
  }

  /** 关闭数据库。 */
  close(): void {
    if (this.closed) return
    this.closed = true
    this.db.close()
  }

  // ---- 向量索引维护 ---------------------------------------------------------

  /**
   * 启动时检测向量提供方是否变化。
   *
   * 向量空间与提供方强绑定（换模型/换端点后向量不再可比）：
   * 若当前提供方与向量表记录的不一致，清空旧稠密向量，后续写入时重建。
   * 本地 TF 稀疏方案不落向量表，无需迁移。
   */
  private migrateVectorsIfProviderChanged(): void {
    const meta = this.db.prepare("SELECT value FROM memory_meta WHERE key = 'embedding_provider'")
      .get() as { value: string } | undefined
    const current = this.provider.name
    if (meta?.value === current) return
    // 提供方变了（或首次记录）：清掉旧稠密向量，避免用错空间的向量参与打分。
    this.db.exec('DELETE FROM memory_vectors')
    this.db.exec('DELETE FROM knowledge_vectors')
    this.db.prepare("INSERT OR REPLACE INTO memory_meta (key, value) VALUES ('embedding_provider', ?)")
      .run(current)
  }

  /** 把一条稠密向量写入（或覆盖）指定向量表。 */
  private upsertVector(table: 'memory_vectors' | 'knowledge_vectors', id: string, vector: number[]): void {
    const idCol = table === 'memory_vectors' ? 'memory_id' : 'knowledge_id'
    this.db.prepare(
      `INSERT OR REPLACE INTO ${table} (${idCol}, vector, provider) VALUES (?, ?, ?)`,
    ).run(id, JSON.stringify(vector), this.provider.name)
  }

  /** 从指定向量表移除一条向量。 */
  private removeVector(table: 'memory_vectors' | 'knowledge_vectors', id: string): void {
    const idCol = table === 'memory_vectors' ? 'memory_id' : 'knowledge_id'
    this.db.prepare(`DELETE FROM ${table} WHERE ${idCol} = ?`).run(id)
  }

  /**
   * 为一条记忆生成并存入稠密向量（仅稠密提供方）。
   * 失败不阻断写入：记忆本身已落库 + BM25 索引已建，向量缺失只是退化为该路 0 分。
   */
  private async syncMemoryVector(id: string, content: string): Promise<void> {
    if (this.provider.sparse || !this.provider.isAvailable()) return
    try {
      const vec = await this.provider.embed(content)
      this.upsertVector('memory_vectors', id, vec)
    } catch (err) {
      console.warn('[memory] 记忆向量生成失败，已临时降级为 BM25：', err instanceof Error ? err.message : err)
    }
  }

  /** 为一个知识分块生成并存入稠密向量。 */
  private async syncKnowledgeVector(id: string, content: string): Promise<void> {
    if (this.provider.sparse || !this.provider.isAvailable()) return
    try {
      const vec = await this.provider.embed(content)
      this.upsertVector('knowledge_vectors', id, vec)
    } catch (err) {
      console.warn('[memory] 知识向量生成失败，已临时降级为 BM25：', err instanceof Error ? err.message : err)
    }
  }

  /**
   * 本地 TF 稀疏向量打分：用查询 token 稀疏向量，与每篇文档的词项向量算余弦。
   * 仅对"共享至少一个词项"的文档产生非零分（与 BM25 同一候选集，差别在排序）。
   */
  private localSparseScores(index: Bm25Index, tokens: string[]): Map<string, number> {
    const out = new Map<string, number>()
    const qv: SparseVector = buildSparseVector(tokens)
    if (qv.size === 0) return out
    for (const id of index.docIds()) {
      const dv = index.docTermsOf(id)
      if (dv === undefined) continue
      const s = cosineSparse(qv, dv)
      if (s > 0) out.set(id, s)
    }
    return out
  }

  /**
   * 稠密向量打分：embed 查询后与向量表中同 provider 的文档向量算余弦。
   * 网络失败时回退到本地 TF 稀疏打分（优雅降级）。
   */
  private async denseScores(
    table: 'memory_vectors' | 'knowledge_vectors',
    query: string,
    tokens: string[],
    index: Bm25Index,
  ): Promise<Map<string, number>> {
    // 未配置 key（理论上不会走到稠密分支）兜底本地稀疏。
    if (!this.provider.isAvailable()) return this.localSparseScores(index, tokens)
    try {
      const qv = await this.provider.embed(query)
      const idCol = table === 'memory_vectors' ? 'memory_id' : 'knowledge_id'
      const rows = this.db
        .prepare(`SELECT ${idCol} AS id, vector FROM ${table} WHERE provider = ?`)
        .all(this.provider.name) as Array<{ id: string; vector: string }>
      const out = new Map<string, number>()
      for (const row of rows) {
        const dv = JSON.parse(row.vector) as number[]
        const s = cosineDense(qv, dv)
        if (s > 0) out.set(row.id, s)
      }
      return out
    } catch (err) {
      console.warn('[memory] 查询向量失败，降级为本地 TF 稀疏召回：', err instanceof Error ? err.message : err)
      return this.localSparseScores(index, tokens)
    }
  }

  /** 计算某一路（稀疏/稠密）的向量分数。 */
  private async vectorScores(
    table: 'memory_vectors' | 'knowledge_vectors',
    query: string,
    tokens: string[],
    index: Bm25Index,
  ): Promise<Map<string, number>> {
    if (this.provider.sparse) return this.localSparseScores(index, tokens)
    return this.denseScores(table, query, tokens, index)
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

  /** 添加一条记忆，返回完整条目（稠密提供方下会异步生成并存入向量）。 */
  async addMemory(input: AddMemoryInput): Promise<MemoryEntry> {
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
    // 稠密提供方：生成并存入向量；本地 TF 为 no-op。失败不阻断写入。
    await this.syncMemoryVector(entry.id, entry.content)
    return entry
  }

  /**
   * 搜索记忆：BM25 + 向量 hybrid 融合打分（final = alpha*bm25 + (1-alpha)*vector）。
   * - 默认本地 TF：向量路复用词项表实时算余弦；
   * - 配置稠密 embedding 后：向量路可召回"无共同词但语义相近"的文档；
   * - 两路都未命中时退化为 LIKE 关键词匹配，保留旧有精确检索行为。
   * 命中后 access_count+1。
   */
  async searchMemory(query: string, options: { tags?: string; limit?: number } = {}): Promise<ScoredMemoryEntry[]> {
    const limit = Math.max(1, Math.min(50, options.limit ?? 10))
    const trimmed = query.trim()
    // 空 query：等价于列出（按重要度/新近）。
    if (trimmed.length === 0) {
      const rows = this.db.prepare(
        `SELECT * FROM memories ORDER BY importance DESC, updated_at DESC LIMIT ?`,
      ).all(limit)
      return this.finalizeMemory((rows as unknown[]).map(rowToMemory), options, limit)
    }

    // 1) BM25 分（只命中共享词项的文档）。
    const tokens = tokenize(trimmed)
    const bmScores = new Map<string, number>()
    for (const h of this.memIndex.score(tokens)) bmScores.set(h.id, h.score)

    // 2) 向量分（本地稀疏实时算 / 稠密 embed 后算余弦；网络失败自动降级稀疏）。
    const vecScores = await this.vectorScores('memory_vectors', trimmed, tokens, this.memIndex)

    // 3) hybrid 融合。
    const fused = fuseScores(bmScores, vecScores, this.alpha)

    let entries: ScoredMemoryEntry[]
    if (fused.size > 0) {
      // 按融合分降序取 id，再回表取完整条目，并附上融合分。
      const ranked = [...fused.entries()].sort((a, b) => b[1] - a[1])
      const stmt = this.db.prepare('SELECT * FROM memories WHERE id = ?')
      entries = []
      for (const [id, score] of ranked.slice(0, limit)) {
        const row = stmt.get(id)
        if (row !== undefined) entries.push({ ...rowToMemory(row), score })
      }
    } else {
      // 4) fallback：LIKE 关键词匹配（两路都未命中任何词项时）。
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
   * 抽出为私有方法，保证 hybrid 路径与 LIKE fallback 路径行为一致。
   */
  private finalizeMemory(entries: ScoredMemoryEntry[], options: { tags?: string }, limit: number): ScoredMemoryEntry[] {
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
  listMemory(options: { limit?: number; tags?: string } = {}): Promise<ScoredMemoryEntry[]> {
    return this.searchMemory('', { ...options })
  }

  /** 更新记忆（content/tags/importance 可选）；内容或标签变化时同步重建 BM25 索引与向量。 */
  async updateMemory(id: string, patch: { content?: string; tags?: string[]; importance?: number }): Promise<MemoryEntry> {
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
    // 内容变了才重算稠密向量（标签变化不影响向量文本）。
    if (patch.content !== undefined) await this.syncMemoryVector(id, content)
    const updated = this.getMemory(id)
    if (updated === undefined) throw new Error(`memory_update: 记忆 "${id}" 不存在`)
    return updated
  }

  /** 删除记忆（同时清理 BM25 索引词项与稠密向量）。 */
  deleteMemory(id: string): boolean {
    const res = this.db.prepare('DELETE FROM memories WHERE id = ?').run(id)
    if (res.changes > 0) {
      this.unindexMemoryDoc(id)
      this.removeVector('memory_vectors', id)
    }
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

  /** 导入一个文档的若干分块，返回写入的分块数；每个分块同时建立 BM25 索引与稠密向量。 */
  async importKnowledge(source: string, chunks: string[]): Promise<number> {
    const now = Date.now()
    const insert = this.db.prepare(
      'INSERT INTO knowledge (id, source, chunk_index, content, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    let n = 0
    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i]
      if (chunk === undefined) continue
      const text = chunk.trim()
      if (text.length === 0) continue
      const id = makeId('know')
      insert.run(id, source, i, text, now)
      this.indexKnowledgeDoc(id, text)
      // 稠密提供方：生成并存入向量；失败不阻断导入。
      await this.syncKnowledgeVector(id, text)
      n += 1
    }
    return n
  }

  /**
   * 搜索知识库分块：BM25 + 向量 hybrid 融合打分；两路都未命中时退化为 LIKE 匹配。
   */
  async searchKnowledge(query: string, limit = 10): Promise<KnowledgeChunk[]> {
    const lim = Math.max(1, Math.min(50, limit))
    const trimmed = query.trim()
    if (trimmed.length === 0) {
      const rows = this.db.prepare(
        'SELECT * FROM knowledge ORDER BY created_at DESC LIMIT ?',
      ).all(lim)
      return (rows as unknown[]).map(rowToKnowledge)
    }
    const tokens = tokenize(trimmed)
    const bmScores = new Map<string, number>()
    for (const h of this.knowIndex.score(tokens)) bmScores.set(h.id, h.score)
    const vecScores = await this.vectorScores('knowledge_vectors', trimmed, tokens, this.knowIndex)
    const fused = fuseScores(bmScores, vecScores, this.alpha)
    if (fused.size > 0) {
      const ranked = [...fused.entries()].sort((a, b) => b[1] - a[1])
      const stmt = this.db.prepare('SELECT * FROM knowledge WHERE id = ?')
      const out: KnowledgeChunk[] = []
      for (const [id] of ranked.slice(0, lim)) {
        const row = stmt.get(id)
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
