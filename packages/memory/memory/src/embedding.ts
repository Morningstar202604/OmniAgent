/**
 * 可插拔的 Embedding 提供方抽象。
 *
 * 设计目标（轻量、离线优先、国产适配）：
 * - **默认离线零依赖**：`LocalTFEmbedding` 不做任何网络请求，直接复用词项表的
 *   (term, tf) 作为稀疏向量，保证开箱即用；
 * - **可插拔升级**：配置了国产平台（智谱 / 阿里 DashScope / 百度等）的
 *   OpenAI 兼容 `/v1/embeddings` 端点与 apiKey 后，自动切换为真稠密向量召回；
 * - **优雅降级**：未配置 apiKey、或网络不可用时，调用方自动回退到本地 TF 稀疏召回，
 *   不抛错、不阻断记忆写入与检索。
 *
 * @module @deepseek-ai/dsh-memory/embedding
 */

/** Embedding 提供方统一接口。 */
export interface EmbeddingProvider {
  /** 提供方名称（写入向量表 provider 列，用于启动时检测配置变更）。 */
  readonly name: string
  /** 向量维度；稀疏本地向量维度不固定，记为 0。 */
  dimensions: number
  /**
   * 是否为稀疏向量提供方。
   * - true：本地 TF 稀疏，store 直接基于词项表实时算余弦，不读/写向量表；
   * - false：稠密真向量，store 把 embed 结果存入向量表，查询时做稠密余弦。
   */
  readonly sparse: boolean
  /** 是否已配置可用（如已填 apiKey）。 */
  isAvailable(): boolean
  /**
   * 把一段文本转为稠密向量。
   * 稀疏提供方不使用此方法（保留空实现以满足接口）。
   */
  embed(text: string): Promise<number[]>
}

/**
 * 国内主流平台的 OpenAI 兼容 embedding 端点预置值。
 * 这些平台均兼容 `POST {baseURL}/embeddings` + Bearer 鉴权。
 */
export const EMBEDDING_ENDPOINTS = {
  /** 智谱 BigModel（ embedding-3 等）。 */
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  /** 阿里 DashScope 兼容模式（text-embedding-v3 等）。 */
  aliyun: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
} as const

/**
 * 本地 TF 稀疏向量化提供方（默认方案，零依赖、离线可用）。
 *
 * 注意：本类并不真的"生成向量"——它的存在是为了统一接口与配置探测。
 * 真正的稀疏余弦由 store 层基于 `memory_terms` 词项表实时计算（见 vector.ts），
 * 因此这里不产生任何存储或网络开销。
 */
export class LocalTFEmbedding implements EmbeddingProvider {
  readonly name = 'local-tf'
  dimensions = 0
  readonly sparse = true

  /** 本地方案恒可用。 */
  isAvailable(): boolean {
    return true
  }

  /** 稀疏方案不走此路径，返回空数组占位。 */
  embed(_text: string): Promise<number[]> {
    return Promise.resolve([])
  }
}

/** OpenAI 兼容 embedding 提供方的构造参数。 */
export interface OpenAICompatibleConfig {
  /** 接口基础地址（不含末尾 /embeddings），如智谱 https://open.bigmodel.cn/api/paas/v4。 */
  baseURL: string
  /** API Key；为空时 isAvailable()=false，自动降级到本地 TF。 */
  apiKey: string
  /** 模型名，如 embedding-3 / text-embedding-v3。 */
  model: string
  /** 请求超时毫秒（默认 15000）。 */
  timeoutMs?: number
  /**
   * 可注入的 fetch 实现（测试用：打桩返回固定向量 / 模拟网络失败）。
   * 默认使用 Node 22 全局 fetch。
   */
  fetchImpl?: typeof fetch
}

/**
 * OpenAI 兼容 `/v1/embeddings` 提供方。
 *
 * 兼容智谱、阿里 DashScope 兼容模式、百度千帆等任何遵循
 *   POST {baseURL}/embeddings
 *   Authorization: Bearer <apiKey>
 *   body: { model, input }
 *   resp: { data: [{ embedding: number[] }] }
 * 的端点。
 *
 * 未配置 apiKey 时 isAvailable()=false；调用方（store）据此自动降级到本地 TF。
 */
export class OpenAICompatibleEmbedding implements EmbeddingProvider {
  readonly name: string
  dimensions = 0
  readonly sparse = false

  private readonly baseURL: string
  private readonly apiKey: string
  private readonly model: string
  private readonly timeoutMs: number
  private readonly fetchImpl: typeof fetch

  constructor(cfg: OpenAICompatibleConfig) {
    this.baseURL = cfg.baseURL.replace(/\/+$/, '')
    this.apiKey = cfg.apiKey
    this.model = cfg.model
    this.timeoutMs = cfg.timeoutMs ?? 15_000
    this.fetchImpl = cfg.fetchImpl ?? globalThis.fetch
    // name 带上模型名，便于区分同端点不同模型的向量空间（换模型需重建向量）。
    this.name = `openai-compat:${cfg.model || 'unknown'}`
  }

  /** 只有配置了 apiKey 才视为可用。 */
  isAvailable(): boolean {
    return this.apiKey.length > 0
  }

  /**
   * 调用 /embeddings 把文本编码为稠密向量。
   * 网络失败 / 非 2xx / 响应结构异常都会抛错，由调用方捕获后降级。
   */
  async embed(text: string): Promise<number[]> {
    if (!this.isAvailable()) {
      throw new Error(`embedding 提供方 ${this.name} 未配置 apiKey`)
    }
    const controller = new AbortController()
    const timer = setTimeout(() => { controller.abort() }, this.timeoutMs)
    try {
      const res = await this.fetchImpl(`${this.baseURL}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ model: this.model, input: text }),
        signal: controller.signal,
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        throw new Error(`embedding HTTP ${res.status}: ${detail.slice(0, 200)}`)
      }
      const data = (await res.json()) as { data?: Array<{ embedding?: number[] }> }
      const vec = data.data?.[0]?.embedding
      if (!Array.isArray(vec) || vec.length === 0) {
        throw new Error('embedding 响应缺少 data[0].embedding')
      }
      // 首次成功后回填维度，供日志/调试。
      this.dimensions = vec.length
      return vec
    } finally {
      clearTimeout(timer)
    }
  }
}
