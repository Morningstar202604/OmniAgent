/**
 * 向量召回 + hybrid 融合 headless 验证脚本（不进入宿主，直接驱动 MemoryStore）。
 *
 * 运行方式（仓库根目录）：
 *   node --import tsx/esm packages/memory/memory/verify-hybrid.ts
 *
 * 覆盖任务要求的 8 个用例。说明：
 * - 默认（无 apiKey）走 LocalTFEmbedding 稀疏向量，离线可用；
 * - 用一个**可控的内存假稠密 provider** 端到端验证"向量补召回"管线
 *   （稠密写入 memory_vectors → 查询 embed → hybrid 融合 → 召回 BM25 漏掉的语义近邻）；
 *   这是对自研管线的测试，**不等于**验证了真实智谱/阿里 embedding 端点——
 *   后者需要真实 apiKey 才能端到端确认，本脚本不伪造该结论。
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MemoryStore, openMemoryDatabase } from './src/store.ts'
import { LocalTFEmbedding, OpenAICompatibleEmbedding, type EmbeddingProvider } from './src/embedding.ts'

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

/** 取出搜索结果的正文首行，便于打印。 */
function contents(rows: Array<{ content: string }>): string[] {
  return rows.map(r => r.content)
}

/**
 * 可控的内存假稠密 provider：按关键词把文本映射到固定"话题向量"。
 * - 命中开发类词 → 第 0 维为 1；
 * - 命中烹饪类词 → 第 1 维为 1。
 * 这样"写代码"与前端记忆在向量空间相近、与烹饪记忆正交，
 * 用于验证 hybrid 召回管线本身（而非真实模型语义）。
 */
class MockDenseEmbedding implements EmbeddingProvider {
  readonly name = 'mock-dense'
  dimensions = 4
  readonly sparse = false
  isAvailable(): boolean {
    return true
  }
  async embed(text: string): Promise<number[]> {
    const v = [0, 0, 0.05, 0]
    if (/前端|React|TypeScript|代码|开发|程序员|编码/i.test(text)) v[0] = 1
    if (/做饭|川菜|粤菜|烹饪|菜|厨房|好吃/.test(text)) v[1] = 1
    return v
  }
}

async function main(): Promise<void> {
  console.log('== 用例 1-2：写入两条主题记忆 ==')
  // 用例 3/5 的对照组：先看默认本地 TF（=纯 BM25 候选集）对"写代码"的表现。
  const localStore = new MemoryStore(openMemoryDatabase(':memory:'))
  const feLocal = await localStore.addMemory({
    content: '用户做前端开发，擅长 React 和 TypeScript',
    tags: ['职业'],
    importance: 0.8,
  })
  await localStore.addMemory({
    content: '用户喜欢做饭，擅长川菜和粤菜',
    tags: ['偏好'],
    importance: 0.4,
  })

  console.log('== 用例 5（对照）：纯 BM25 / 本地 TF 对无共同词查询漏召 ==')
  // "写代码" 与前端记忆无任何共享 bigram（前端记忆无"代码"二字）。
  const localMiss = await localStore.searchMemory('写代码')
  assert(!localMiss.some(e => e.id === feLocal.id), '用例5对照: 本地TF下"写代码"未命中前端记忆（BM25漏召）',
    JSON.stringify(contents(localMiss)))
  localStore.close()

  console.log('== 用例 3-5：稠密向量补召回（mock provider 端到端管线） ==')
  const denseStore = new MemoryStore(openMemoryDatabase(':memory:'), {
    embedding: new MockDenseEmbedding(),
    hybridAlpha: 0.5,
  })
  const fe = await denseStore.addMemory({
    content: '用户做前端开发，擅长 React 和 TypeScript',
    tags: ['职业'],
    importance: 0.8,
  })
  const cook = await denseStore.addMemory({
    content: '用户喜欢做饭，擅长川菜和粤菜',
    tags: ['偏好'],
    importance: 0.4,
  })

  // 用例 3："写代码" 与前端记忆无共同词项，但向量相近 → 应命中前端记忆。
  const r3 = await denseStore.searchMemory('写代码')
  assert(r3.some(e => e.id === fe.id), '用例3: 向量召回"写代码"命中前端记忆', JSON.stringify(contents(r3)))
  assert(r3[0]?.id === fe.id, '用例3: 前端记忆在融合结果中居首', `top=${r3[0]?.content}`)

  // 用例 4："烹饪" 与烹饪记忆无共同词项，但向量相近 → 应命中烹饪记忆。
  const r4 = await denseStore.searchMemory('烹饪')
  assert(r4.some(e => e.id === cook.id), '用例4: 向量召回"烹饪"命中做饭记忆', JSON.stringify(contents(r4)))
  assert(r4[0]?.id === cook.id, '用例4: 做饭记忆在融合结果中居首', `top=${r4[0]?.content}`)

  // 用例 5（正向）：同一条"写代码"，稠密向量命中了本地 TF 漏掉的前端记忆。
  const denseHit = await denseStore.searchMemory('写代码')
  assert(denseHit.some(e => e.id === fe.id) && localMiss.length >= 0,
    '用例5: BM25漏召的用例被向量召回命中（对比上方本地TF对照）', JSON.stringify(contents(denseHit)))

  console.log('== 用例 6：原有精确关键词搜索仍正常（BM25 路径） ==')
  const r6 = await denseStore.searchMemory('TypeScript')
  assert(r6.some(e => e.id === fe.id), '用例6: 精确关键词 "TypeScript" 仍命中前端记忆', JSON.stringify(contents(r6)))
  assert(r6[0]?.id === fe.id, '用例6: 精确关键词下前端记忆居首', `top=${r6[0]?.content}`)

  denseStore.close()

  console.log('== 用例 7：未配置 apiKey 时 LocalTFEmbedding 正常工作 ==')
  {
    // 默认构造（不传 embedding）即为 LocalTFEmbedding。
    const s = new MemoryStore(openMemoryDatabase(':memory:'))
    const e = await s.addMemory({ content: '用户偏好中文简洁回复', tags: ['偏好'] })
    const hit = await s.searchMemory('中文')
    assert(hit.some(x => x.id === e.id), '用例7: 无 key 默认本地 TF 可写入并召回', JSON.stringify(contents(hit)))
    // 本地 TF 稀疏向量不写向量表（零额外存储）。
    const vecCount = (s as unknown as { db: { prepare: (sql: string) => { get: () => { c: number } } } })
      .db.prepare('SELECT COUNT(*) AS c FROM memory_vectors').get().c
    assert(vecCount === 0, '用例7: 本地 TF 不落向量表', `memory_vectors=${vecCount}`)
    s.close()
  }

  console.log('== 用例 8：配置了 embedding 但网络不可用时优雅降级 ==')
  {
    // OpenAICompatibleEmbedding 配了 apiKey（isAvailable()=true），但 fetch 直接抛错（网络不通）。
    const failingFetch = (async () => { throw new Error('network down') }) as unknown as typeof fetch
    const provider = new OpenAICompatibleEmbedding({
      baseURL: 'https://open.bigmodel.cn/api/paas/v4',
      apiKey: 'fake-key',
      model: 'embedding-3',
      fetchImpl: failingFetch,
    })
    assert(provider.isAvailable(), '用例8: 配置 apiKey 后 provider 标记可用', provider.name)
    const s = new MemoryStore(openMemoryDatabase(':memory:'), { embedding: provider })
    // 写入不应因向量生成失败而抛错。
    let addOk = true
    let feId = ''
    try {
      const e = await s.addMemory({ content: '用户做前端开发，擅长 React 和 TypeScript' })
      feId = e.id
    } catch {
      addOk = false
    }
    assert(addOk, '用例8: 向量写失败不阻断记忆写入')
    // 查询：稠密 embed 失败 → 降级本地稀疏；共享词项查询仍能经 BM25 召回，不抛错。
    let searchOk = true
    let hit: Array<{ id: string }> = []
    try {
      hit = await s.searchMemory('React')
    } catch {
      searchOk = false
    }
    assert(searchOk, '用例8: 网络失败时检索不抛错（降级到本地 BM25/稀疏）')
    assert(hit.some(x => x.id === feId), '用例8: 降级后共享词项查询仍命中', JSON.stringify(hit.map(x => x.id)))
    s.close()
  }

  console.log('== 附加：OpenAICompatible 请求形态与 isAvailable ==')
  {
    // 未配置 key → 不可用。
    const noKey = new OpenAICompatibleEmbedding({ baseURL: '', apiKey: '', model: '' })
    assert(!noKey.isAvailable(), '附加: 无 apiKey 时 isAvailable()=false')
    // 配置 key → 校验请求 URL / body 正确。
    let captured: { url?: string; body?: string } = {}
    const okFetch = (async (url: string, init?: RequestInit) => {
      captured = { url, body: String(init?.body) }
      return {
        ok: true,
        status: 200,
        text: async () => '',
        json: async () => ({ data: [{ embedding: [0.1, 0.2, 0.3] }] }),
      } as unknown as Response
    }) as unknown as typeof fetch
    const p = new OpenAICompatibleEmbedding({
      baseURL: 'https://open.bigmodel.cn/api/paas/v4/', // 末尾多斜杠，应被规整
      apiKey: 'sk-test',
      model: 'embedding-3',
      fetchImpl: okFetch,
    })
    const vec = await p.embed('你好')
    assert(captured.url === 'https://open.bigmodel.cn/api/paas/v4/embeddings', '附加: 请求打到 /embeddings', captured.url)
    assert(captured.body?.includes('embedding-3') && captured.body.includes('你好'), '附加: body 带 model 与 input')
    assert(vec.length === 3, '附加: 正确解析 data[0].embedding', String(vec.length))
  }

  console.log('== 附加：重启后稠密向量持久化 ==')
  {
    const dir = mkdtempSync(join(tmpdir(), 'mem-hybrid-'))
    const dbPath = join(dir, 'memory.db')
    const w = new MemoryStore(openMemoryDatabase(dbPath), { embedding: new MockDenseEmbedding() })
    await w.addMemory({ content: '用户做前端开发，擅长 React 和 TypeScript' })
    w.close()
    // 重开：provider 名相同 → 不重建；向量表保留，查询仍可稠密召回。
    const r = new MemoryStore(openMemoryDatabase(dbPath), { embedding: new MockDenseEmbedding() })
    const hits = await r.searchMemory('写代码')
    assert(hits.some(x => x.content.includes('前端开发')), '附加: 重启后"写代码"仍经向量命中', JSON.stringify(contents(hits)))
    r.close()
  }

  console.log(`\n== 结果：${passed} 通过 / ${failed} 失败 ==`)
  process.exit(failed > 0 ? 1 : 0)
}

void main()
