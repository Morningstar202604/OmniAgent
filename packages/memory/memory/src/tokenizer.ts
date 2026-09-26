/**
 * 轻量分词器：面向中文 bigram + 英文/数字单词的混合分词。
 *
 * 设计目标（无外部依赖、离线可用）：
 * - 中文不引入 jieba 等词典分词，而是按字符二元组（bigram）切分，
 *   这样"前端开发"会被切成 {前端, 端开, 开发}，
 *   与"前端工程师"的 {前端, 端工, 工程, 程师} 共享 "前端"，
 *   从而在 BM25 下实现"同一语义、不同措辞"的召回。
 * - 英文/数字按连续字母数字串切词并转小写，如 React -> react。
 * - 标点与空白天然作为分段边界，无需额外处理。
 * - 过滤常见中英文停用词，避免无意义词项拉低召回精度。
 *
 * @module @deepseek-ai/dsh-memory/tokenizer
 */

/**
 * 停用词表：中英文高频虚词/代词，对区分文档几乎无贡献。
 * 注意：此处只对"单词"级 token 过滤；中文 bigram 基本不会命中本表。
 */
const STOPWORDS = new Set<string>([
  // ---- 中文停用词 ----
  '的', '了', '是', '在', '有', '和', '与', '及', '或', '也', '就', '都',
  '而', '等', '被', '把', '让', '向', '从', '对', '为', '以', '于',
  '我', '你', '他', '她', '它', '我们', '你们', '他们', '她们', '它们',
  '这', '那', '这个', '那个', '这些', '那些', '吗', '呢', '吧', '啊', '呀',
  '么', '什么', '怎么', '怎样', '如何', '可以', '能', '会', '要', '去', '来',
  '说', '看', '想', '知道', '因为', '所以', '但是', '如果', '虽然', '然后',
  // ---- 英文停用词 ----
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'and', 'or', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'as', 'by',
  'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she',
  'we', 'they', 'them', 'his', 'her', 'my', 'your', 'our', 'their',
  'not', 'no', 'but', 'if', 'then', 'than', 'so', 'such', 'can', 'will',
  'would', 'should', 'could', 'do', 'does', 'did', 'have', 'has', 'had',
  'what', 'when', 'where', 'which', 'who', 'whom', 'how',
])

/**
 * 匹配一段"连续 CJK 表意文字"或"连续英文/数字"。
 * - 第 1 捕获组：CJK 段（用于 bigram）
 * - 第 2 捕获组：英文/数字段（按单词整体作为一个 token）
 */
const TOKEN_RE = /([一-鿿]+)|([a-z0-9]+)/g

/**
 * 把一段文本切分为词项数组。
 * @param text - 原始文本（记忆正文 / 标签 / 查询串）。
 * @returns 词项列表（可能为空）。
 */
export function tokenize(text: string): string[] {
  // 英文统一转小写，保证 React 与 react 命中同一词项。
  const lower = text.toLowerCase()
  const tokens: string[] = []
  TOKEN_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = TOKEN_RE.exec(lower)) !== null) {
    const cjkSeg = match[1]
    const word = match[2]
    if (cjkSeg !== undefined) {
      // 中文段：滑窗切 bigram；长度为 1 的单字无法成词，直接跳过（避免噪声）。
      for (let i = 0; i < cjkSeg.length - 1; i += 1) {
        tokens.push(cjkSeg.slice(i, i + 2))
      }
    } else if (word !== undefined) {
      // 英文/数字段：停用词过滤后整体入列。
      if (!STOPWORDS.has(word)) tokens.push(word)
    }
  }
  return tokens
}
