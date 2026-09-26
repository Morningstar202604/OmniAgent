/**
 * 纯 TypeScript 实现的 BM25 内存索引（无任何外部依赖）。
 *
 * BM25 公式（标准参数 k1=1.5, b=0.75）：
 *
 *   score(D, Q) = Σ IDF(qi) * f(qi,D) * (k1+1) / ( f(qi,D) + k1*(1-b + b*|D|/avgdl) )
 *
 *   IDF(qi) = ln( (N - n(qi) + 0.5) / (n(qi) + 0.5) + 1 )
 *
 * 其中：
 * - N       = 索引中的文档总数
 * - n(qi)   = 包含词项 qi 的文档数（文档频率 DF）
 * - f(qi,D) = 词项 qi 在文档 D 中的词频（TF）
 * - |D|     = 文档 D 的长度（token 数）
 * - avgdl   = 全部文档的平均长度
 *
 * 本类只维护内存结构；持久化（词项表）由 store 层负责，
 * 启动时把 SQLite 中的词项行喂回本类重建索引。
 *
 * @module @deepseek-ai/dsh-memory/bm25
 */

/** 一条 BM25 命中结果。 */
export interface Bm25Hit {
  /** 文档 id（记忆 id 或知识分块 id）。 */
  id: string
  /** BM25 分数（越大越相关）。 */
  score: number
}

/** BM25 标准参数 k1：词频饱和度。 */
const K1 = 1.5
/** BM25 标准参数 b：文档长度归一化强度（0=不归一化，1=完全归一化）。 */
const B = 0.75

/**
 * BM25 内存倒排索引。
 *
 * 同时维护两份结构：
 * - `docTerms`：docId -> (term -> tf)，便于按文档整体移除/重建；
 * - `postings`：term  -> (docId -> tf)，便于查询时只遍历命中词的倒排链。
 */
export class Bm25Index {
  /** 倒排链：词项 -> (文档 id -> 词频)。 */
  private readonly postings = new Map<string, Map<string, number>>()
  /** 文档词典：文档 id -> (词项 -> 词频)。 */
  private readonly docTerms = new Map<string, Map<string, number>>()
  /** 文档总数 N。 */
  private docCount = 0
  /** 全部文档 token 总数（用于算 avgdl）。 */
  private totalTokens = 0

  /**
   * 新增（或覆盖）一篇文档。同一 id 重复加入时先清除旧词项，保证幂等。
   * @param id - 文档 id。
   * @param tokens - 分词后的词项数组。
   */
  addDoc(id: string, tokens: string[]): void {
    this.removeDoc(id)
    // 统计该文档的词频 TF。
    const tf = new Map<string, number>()
    for (const t of tokens) {
      tf.set(t, (tf.get(t) ?? 0) + 1)
    }
    this.docTerms.set(id, tf)
    if (tf.size === 0) return
    // 写入倒排链并累计全局统计量。
    let length = 0
    for (const [term, freq] of tf) {
      length += freq
      let post = this.postings.get(term)
      if (post === undefined) {
        post = new Map<string, number>()
        this.postings.set(term, post)
      }
      post.set(id, freq)
    }
    this.docCount += 1
    this.totalTokens += length
  }

  /**
   * 移除一篇文档（同步从倒排链中摘除其词项）。
   * @param id - 文档 id。
   */
  removeDoc(id: string): void {
    const tf = this.docTerms.get(id)
    if (tf === undefined) return
    let length = 0
    for (const [term, freq] of tf) {
      length += freq
      const post = this.postings.get(term)
      if (post !== undefined) {
        post.delete(id)
        if (post.size === 0) this.postings.delete(term)
      }
    }
    this.docTerms.delete(id)
    this.docCount -= 1
    this.totalTokens -= length
  }

  /**
   * 用已持久化的词项行重建索引（启动恢复用）。
   * @param id - 文档 id。
   * @param termFrequencies - 该文档已有的 (term, tf) 映射。
   */
  restoreDoc(id: string, termFrequencies: Map<string, number>): void {
    if (termFrequencies.size === 0) return
    this.docTerms.set(id, termFrequencies)
    let length = 0
    for (const [term, freq] of termFrequencies) {
      length += freq
      let post = this.postings.get(term)
      if (post === undefined) {
        post = new Map<string, number>()
        this.postings.set(term, post)
      }
      post.set(id, freq)
    }
    this.docCount += 1
    this.totalTokens += length
  }

  /**
   * 对查询词项打分，返回所有得分 > 0 的文档，按分数降序。
   * @param queryTokens - 查询分词后的词项数组。
   * @returns 命中列表（已排序）。
   */
  score(queryTokens: string[]): Bm25Hit[] {
    if (queryTokens.length === 0 || this.docCount === 0 || this.totalTokens === 0) {
      return []
    }
    const avgdl = this.totalTokens / this.docCount
    // 查询词去重，避免同一词重复计分。
    const uniqueTerms = [...new Set(queryTokens)]
    const scores = new Map<string, number>()
    for (const term of uniqueTerms) {
      const post = this.postings.get(term)
      if (post === undefined || post.size === 0) continue
      const n = post.size
      // 带平滑的 IDF：恒 >= 0，常见词权重趋近于 0。
      const idf = Math.log((this.docCount - n + 0.5) / (n + 0.5) + 1)
      for (const [docId, tf] of post) {
        const docLen = this.docLength(docId)
        const norm = tf + K1 * (1 - B + (B * docLen) / avgdl)
        const contribution = idf * ((tf * (K1 + 1)) / norm)
        scores.set(docId, (scores.get(docId) ?? 0) + contribution)
      }
    }
    const hits: Bm25Hit[] = []
    for (const [id, score] of scores) {
      // 分数阈值：<= 0 视为不相关，直接丢弃。
      if (score > 0) hits.push({ id, score })
    }
    hits.sort((a, b) => b.score - a.score)
    return hits
  }

  /** 索引中文档数量。 */
  get size(): number {
    return this.docCount
  }

  /** 判断某文档是否已在索引中。 */
  hasDoc(id: string): boolean {
    return this.docTerms.has(id)
  }

  /** 列出所有已索引文档 id（重建索引用）。 */
  docIds(): string[] {
    return [...this.docTerms.keys()]
  }

  /** 计算某文档的 token 总数 |D|。 */
  private docLength(id: string): number {
    const tf = this.docTerms.get(id)
    if (tf === undefined) return 0
    let length = 0
    for (const freq of tf.values()) length += freq
    return length
  }
}
