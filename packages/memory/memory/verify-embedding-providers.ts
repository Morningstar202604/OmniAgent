/**
 * 真实 embedding 端点端到端验证（Agnes 探测 + 国产替代接入形态 + 本地 TF 召回基线）。
 *
 * 运行方式（仓库根目录）：
 *   AGNES_API_KEY=sk-xxx node --import tsx/esm packages/memory/memory/verify-embedding-providers.ts
 *
 * 本脚本区分两类结论，绝不混为一谈：
 * 1. **Agnes 实探**：若提供 AGNES_API_KEY，真打 https://apihub.agnes-ai.com/v1/embeddings，
 *    记录 HTTP 状态与上游报文；否则打印上次实探的固化结论。
 * 2. **国产替代接入形态（离线打桩）**：智谱 / 阿里 / 百度均为 OpenAI 兼容
 *    `POST {baseURL}/embeddings` + Bearer + `{model,input}` + `data[0].embedding`。
 *    这里用打桩 fetch 按**每家真实 baseURL/model** 校验 OpenAICompatibleEmbedding
 *    的请求 URL / body / 鉴权头 / 响应解析，并端到端验证稠密召回能补上本地 TF 的语义漏召。
 *    —— 这验证的是「适配管线」，**不等于**已用真实 key 跑通三家线上向量。
 *      要真端到端，需用户提供对应平台 key 后，把下列 PROVIDERS 表换成真实 fetch 再跑。
 */
import { MemoryStore, openMemoryDatabase } from './src/store.ts'
import {
  OpenAICompatibleEmbedding,
  type EmbeddingProvider,
} from './src/embedding.ts'

let passed = 0
let failed = 0

/** 断言助手。 */
function assert(cond: boolean, name: string, detail?: string): void {
  if (cond) {
    passed += 1
    console.log(`  ✅ ${name}`)
  } else {
    failed += 1
    console.log(`  ❌ ${name}${detail ? `  —— ${detail}` : ''}`)
  }
}

/** 检索结果正文（便于打印）。 */
function contents(rows: Array<{ content: string }>): string[] {
  return rows.map(r => r.content)
}

/**
 * 按语义话题给一段文本打一个 4 维稠密向量（离线可控）。
 * 维度含义：[职业/代码, 烹饪/吃饭, 地域/潮州, 杂项]。
 * 用于证明「稠密召回能命中与本地 TF 无共同词但语义相近」的记忆。
 */
class TopicDenseEmbedding implements EmbeddingProvider {
  readonly name = `topic-dense:${this.model}`
  dimensions = 4
  readonly sparse = false
  constructor(private readonly model: string) {}
  isAvailable(): boolean {
    return true
  }
  async embed(text: string): Promise<number[]> {
    const v = [0.02, 0.02, 0.02, 0.05]
    if (/前端|开发|React|TypeScript|代码|职业|程序员/.test(text)) v[0] = 1
    if (/做饭|烹饪|菜|厨房|好吃|粤菜/.test(text)) v[1] = 1
    if (/潮州|汕头|广东|所在地|家乡/.test(text)) v[2] = 1
    return v
  }
}

/** 一条待验证的国产替代端点接入形态。 */
interface ProviderSpec {
  name: string
  baseURL: string
  model: string
  /** 实探（无 key）时观察到的鉴权错误，作为端点可达性证据。 */
  observedUnauthorized: string
}

/**
 * 国产替代 OpenAI 兼容 embedding 端点接入形态（来自 2026-09-27 无 key 实探）。
 * 三家均 401（缺 Bearer），证明端点存在且接受 OpenAI 兼容请求形态。
 */
const PROVIDERS: ProviderSpec[] = [
  {
    name: '智谱 BigModel',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'embedding-3',
    observedUnauthorized: 'HTTP 401: Header中未收到Authorization参数',
  },
  {
    name: '阿里 DashScope 兼容模式',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'text-embedding-v3',
    observedUnauthorized: 'HTTP 401: You need to provide your API key in Authorization header using Bearer auth',
  },
  {
    name: '百度千帆 v2',
    baseURL: 'https://qianfan.baidubce.com/v2',
    model: 'embedding-async-v1',
    observedUnauthorized: 'HTTP 401: invalid_iam_token（Bearer IAM access token）',
  },
]

/**
 * 打桩 fetch：按真实 OpenAI 兼容响应包络返回向量，并捕获请求参数用于断言。
 * 模拟线上 `{ data: [{ embedding: number[] }] }`。
 */
function makeStubFetch(captured: { url?: string; auth?: string; body?: string }) {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    captured.url = String(url)
    const headers = new Headers(init?.headers)
    captured.auth = headers.get('Authorization') ?? ''
    captured.body = String(init?.body ?? '')
    return {
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({
        object: 'list',
        data: [{ object: 'embedding', index: 0, embedding: [0.1, 0.2, 0.3, 0.4] }],
        model: 'stub',
        usage: { prompt_tokens: 3, total_tokens: 3 },
      }),
    } as unknown as Response
  }) as unknown as typeof fetch
}

/** Agnes 实探（仅当 AGNES_API_KEY 存在时真打网络）。 */
async function probeAgnesLive(): Promise<void> {
  const key = process.env.AGNES_API_KEY ?? ''
  console.log('== 0) Agnes /v1/embeddings 探测 ==')
  console.log('  固化结论（2026-09-27 实探）：')
  console.log('   - POST https://apihub.agnes-ai.com/v1/embeddings {model:agnes-3.0-flash}')
  console.log('     → HTTP 400: "This model does not appear to be an embedding model by default ... try another model."')
  console.log('   - POST {model:text-embedding-3-small} / {model:embedding-3}')
  console.log('     → model_not_found: No available channel for model ... under group default')
  console.log('   - GET /v1/models 仅列出 chat/video/image，无 embedding 模型。')
  console.log('   结论：Agnes 当前分组未提供 embedding 渠道，memory 不可接入 Agnes 稠密向量。')

  if (!key) {
    console.log('  （未提供 AGNES_API_KEY，跳过实时复探；以上为固化实探结论。）')
    return
  }
  // 有 key 则实时复核一次，确认结论未变。
  for (const model of ['agnes-3.0-flash', 'text-embedding-3-small']) {
    try {
      const res = await fetch('https://apihub.agnes-ai.com/v1/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, input: '测试文本' }),
        signal: AbortSignal.timeout(20_000),
      })
      const text = await res.text()
      const looksLikeEmbedding = res.ok && text.includes('"embedding"') && !text.includes('"error"')
      console.log(`  实时复核 model=${model} → HTTP ${res.status}${looksLikeEmbedding ? '（返回 embedding 向量！）' : `: ${text.slice(0, 160)}`}`)
      assert(!looksLikeEmbedding, `实时复核: Agnes model=${model} 仍不返回 embedding 向量`)
    } catch (err) {
      console.log(`  实时复核 model=${model} 请求失败：${err instanceof Error ? err.message : err}`)
    }
  }
}

/** 本地 TF（默认）召回基线：展示哪些语义改写查询会漏召。 */
async function localTfBaseline(): Promise<void> {
  console.log('\n== 1) 本地 TF（LocalTFEmbedding）召回基线 ==')
  const store = new MemoryStore(openMemoryDatabase(':memory:'))
  const fe = await store.addMemory({ content: '用户做前端开发，擅长 React 和 TypeScript', tags: ['职业'], importance: 0.8 })
  await store.addMemory({ content: '用户喜欢做饭，擅长川菜和粤菜', tags: ['偏好'], importance: 0.4 })
  await store.addMemory({ content: '用户住在广东潮州', tags: ['地域'], importance: 0.5 })

  // 这些改写与原始记忆无共同词项（纯同义词/上位词），BM25/本地 TF 应漏召。
  const queries = ['写代码的工作', '烹饪爱好', '人在哪个城市']
  for (const q of queries) {
    const rows = await store.searchMemory(q, { limit: 5 })
    console.log(`  查询「${q}」命中：${JSON.stringify(contents(rows))}`)
  }
  const missCode = await store.searchMemory('写代码的工作', { limit: 5 })
  assert(!missCode.some(e => e.id === fe.id), '基线: 本地 TF 对「写代码的工作」漏召前端记忆', JSON.stringify(contents(missCode)))
  store.close()
}

/** 按三家真实 baseURL/model 校验 OpenAICompatibleEmbedding 的请求适配。 */
async function adapterConformance(): Promise<void> {
  console.log('\n== 2) OpenAICompatibleEmbedding 适配三家真实端点形状（打桩 fetch） ==')
  for (const p of PROVIDERS) {
    console.log(`  -- ${p.name} --`)
    const captured: { url?: string; auth?: string; body?: string } = {}
    const stub = makeStubFetch(captured)
    const provider = new OpenAICompatibleEmbedding({
      baseURL: p.baseURL + '/', // 故意末尾带斜杠，验证规整
      apiKey: 'stub-key',
      model: p.model,
      fetchImpl: stub,
    })
    const vec = await provider.embed('测试文本')
    assert(captured.url === `${p.baseURL}/embeddings`, `[${p.name}] 请求 URL 规整到 /embeddings`, captured.url)
    assert(captured.auth === 'Bearer stub-key', `[${p.name}] 带 Bearer 鉴权头`, captured.auth)
    assert(captured.body?.includes(`"model":"${p.model}"`), `[${p.name}] body 携带 model=${p.model}`, captured.body)
    assert(captured.body?.includes('测试文本'), `[${p.name}] body 携带 input`)
    assert(vec.length === 4 && provider.dimensions === 4, `[${p.name}] 正确解析 data[0].embedding 并回填维度`, String(vec.length))
    console.log(`     实探可达性证据：${p.observedUnauthorized}`)
  }
}

/** 端到端：稠密召回补上本地 TF 漏召（用 TopicDenseEmbedding 驱动 MemoryStore）。 */
async function denseRecallFillsGap(): Promise<void> {
  console.log('\n== 3) 端到端：稠密向量召回补上本地 TF 的语义漏召 ==')
  const store = new MemoryStore(openMemoryDatabase(':memory:'), {
    embedding: new TopicDenseEmbedding('embedding-3'),
    hybridAlpha: 0.5,
  })
  const fe = await store.addMemory({ content: '用户做前端开发，擅长 React 和 TypeScript', tags: ['职业'], importance: 0.8 })
  const cook = await store.addMemory({ content: '用户喜欢做饭，擅长川菜和粤菜', tags: ['偏好'], importance: 0.4 })

  const rCode = await store.searchMemory('写代码的工作', { limit: 5 })
  assert(rCode.some(e => e.id === fe.id), '稠密:「写代码的工作」召回前端记忆', JSON.stringify(contents(rCode)))
  const rCook = await store.searchMemory('烹饪爱好', { limit: 5 })
  assert(rCook.some(e => e.id === cook.id), '稠密:「烹饪爱好」召回做饭记忆', JSON.stringify(contents(rCook)))

  // 向量落库 + 重启后 provider 名一致则复用，不重建。
  const vecCount = (store as unknown as { db: { prepare: (s: string) => { get: () => { c: number } } } })
    .db.prepare('SELECT COUNT(*) AS c FROM memory_vectors').get().c
  assert(vecCount === 2, '稠密: 两条记忆向量已落 memory_vectors', `count=${vecCount}`)
  store.close()
}

async function main(): Promise<void> {
  await probeAgnesLive()
  await localTfBaseline()
  await adapterConformance()
  await denseRecallFillsGap()
  console.log(`\n== 结果：${passed} 通过 / ${failed} 失败 ==`)
  process.exit(failed > 0 ? 1 : 0)
}

void main()
