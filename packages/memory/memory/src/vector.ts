/**
 * 向量召回与 hybrid 融合的纯函数工具（零依赖）。
 *
 * 提供两类余弦相似度与一种归一化融合：
 * - 稀疏向量（本地 TF 默认方案）：用 Map<term, tf> 表示，维度随词表增长、不固定，
 *   因此**不**使用 Float32Array，而是基于已有词项表（memory_terms）实时计算；
 * - 稠密向量（配置国产 embedding API 后）：number[]，与 /v1/embeddings 返回对齐。
 *
 * 融合策略：
 *   final_score = alpha * bm25_norm + (1 - alpha) * vector_norm
 * 其中两路分数先各自 min-max 归一化到 [0,1]，未命中某一路的文档该路分数按 0 计，
 * 从而让"只被向量召回"的文档也能进入候选集（这是相对纯 BM25 的关键召回增强）。
 *
 * @module @deepseek-ai/dsh-memory/vector
 */

/** 稀疏向量：词项 -> 词频（维度不固定，用 Map 表示）。 */
export type SparseVector = Map<string, number>

/**
 * 由分词后的 token 数组构建稀疏词频向量。
 * @param tokens - 分词结果。
 * @returns 词项 -> 词频。
 */
export function buildSparseVector(tokens: string[]): SparseVector {
  const v = new Map<string, number>()
  for (const t of tokens) v.set(t, (v.get(t) ?? 0) + 1)
  return v
}

/** 计算稀疏向量的 L2 模长（sqrt(sum w^2)）。 */
function normSparse(v: SparseVector): number {
  let s = 0
  for (const w of v.values()) s += w * w
  return Math.sqrt(s)
}

/**
 * 稀疏余弦相似度：dot(a,b) / (||a|| * ||b||)。
 *
 * 零向量保护：任一向量为空或模长为 0 时返回 0，避免除零。
 * 性能：遍历词项较少的那个向量，在另一个里查交集。
 *
 * @param a - 稀疏向量 A（通常是查询向量）。
 * @param b - 稀疏向量 B（通常是文档向量）。
 * @returns 余弦相似度 [0,1]（词频非负，故结果非负）。
 */
export function cosineSparse(a: SparseVector, b: SparseVector): number {
  if (a.size === 0 || b.size === 0) return 0
  // 让 smaller 指向词项较少的一方，减少哈希查询次数。
  const smaller = a.size <= b.size ? a : b
  const larger = smaller === a ? b : a
  let dot = 0
  for (const [term, w] of smaller) {
    const w2 = larger.get(term)
    if (w2 !== undefined) dot += w * w2
  }
  if (dot === 0) return 0
  const na = normSparse(a)
  const nb = normSparse(b)
  if (na === 0 || nb === 0) return 0
  return dot / (na * nb)
}

/**
 * 稠密余弦相似度（真 embedding 向量）。
 * 长度不一致时按较短者对齐；零向量保护。
 *
 * @param a - 查询向量。
 * @param b - 文档向量。
 * @returns 余弦相似度（embedding 各维有正有负，范围 [-1,1]）。
 */
export function cosineDense(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  if (n === 0) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < n; i += 1) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    dot += x * y
    na += x * x
    nb += y * y
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

/**
 * 把一组分数 min-max 归一化到 [0,1]。
 *
 * 退化保护：当所有分数相同（max <= min）时，视为"全部同等相关"，
 * 已出现的 id 统一归一为 1（而不是 0），避免单命中时被另一路信号压死。
 *
 * @param scores - id -> 原始分数。
 * @returns id -> 归一化分数；输入中未出现的 id 不在此 map 中（调用方按 0 处理）。
 */
export function normalizeScores(scores: Map<string, number>): Map<string, number> {
  const out = new Map<string, number>()
  if (scores.size === 0) return out
  let max = -Infinity
  let min = Infinity
  for (const s of scores.values()) {
    if (s > max) max = s
    if (s < min) min = s
  }
  if (max <= min) {
    for (const id of scores.keys()) out.set(id, 1)
    return out
  }
  const range = max - min
  for (const [id, s] of scores) out.set(id, (s - min) / range)
  return out
}

/**
 * hybrid 融合：把 BM25 分数与向量余弦分数加权合并。
 *
 * @param bmScores - id -> BM25 原始分。
 * @param vecScores - id -> 向量余弦分。
 * @param alpha - BM25 权重（0~1）；向量权重为 1-alpha。
 * @returns id -> 融合后分数（越大越相关）。
 */
export function fuseScores(
  bmScores: Map<string, number>,
  vecScores: Map<string, number>,
  alpha: number,
): Map<string, number> {
  const bmNorm = normalizeScores(bmScores)
  const vecNorm = normalizeScores(vecScores)
  const ids = new Set<string>([...bmNorm.keys(), ...vecNorm.keys()])
  const final = new Map<string, number>()
  for (const id of ids) {
    // 某一路未命中的文档，该路归一分按 0 计——这正是向量能"补召回"的关键。
    const b = bmNorm.get(id) ?? 0
    const v = vecNorm.get(id) ?? 0
    final.set(id, alpha * b + (1 - alpha) * v)
  }
  return final
}
