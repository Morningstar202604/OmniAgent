/**
 * BM25 记忆检索 headless 验证脚本（不进入宿主，直接驱动 MemoryStore）。
 *
 * 运行方式（仓库根目录）：
 *   node --import tsx/esm packages/memory/memory/verify-bm25.ts
 *
 * 覆盖任务要求的 9 个用例 + 知识库 BM25。
 * 注意：检索/写入接口现已为 async（为支持可选稠密向量），脚本整体 await。
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MemoryStore, openMemoryDatabase } from './src/store.ts'

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

async function main(): Promise<void> {
  console.log('== 用例 1-6：内存库基础语义检索 ==')
  {
    const store = new MemoryStore(openMemoryDatabase(':memory:'))

    // 用例 1：添加基准记忆
    const fe = await store.addMemory({
      content: '用户做前端开发，擅长 React 和 TypeScript',
      tags: ['职业'],
      importance: 0.8,
    })
    await store.addMemory({ content: '用户喜欢吃川菜，每周都点外卖', tags: ['偏好'], importance: 0.4 })
    await store.addMemory({ content: '项目使用 pnpm monorepo，Node 22 环境', tags: ['项目'], importance: 0.6 })

    // 用例 2："用户职业" 与基准记忆共享 bigram "用户"，应命中
    const r2 = await store.searchMemory('用户职业')
    assert(r2.some(e => e.id === fe.id), '用例2: 搜索"用户职业"命中前端记忆', JSON.stringify(contents(r2)))
    assert(r2[0]?.id === fe.id, '用例2: 前端记忆排在首位', `top=${r2[0]?.content}`)

    // 用例 3："前端工程师" 共享 bigram "前端"，应命中
    const r3 = await store.searchMemory('前端工程师')
    assert(r3.some(e => e.id === fe.id), '用例3: 搜索"前端工程师"命中', JSON.stringify(contents(r3)))

    // 用例 4："做饭" 与前端记忆无任何共享 bigram，不应命中
    const r4 = await store.searchMemory('做饭')
    assert(!r4.some(e => e.id === fe.id), '用例4: 搜索"做饭"不命中前端记忆', JSON.stringify(contents(r4)))

    // 用例 5：多条记忆时按相关性排序——"React 框架" 应把前端记忆排最前
    const r5 = await store.searchMemory('React 框架 开发')
    assert(r5[0]?.id === fe.id, '用例5: 相关记忆按 BM25 分数排序居首', `top=${r5[0]?.content}`)

    // 用例 6：原有精确关键词搜索仍正常
    const r6 = await store.searchMemory('TypeScript')
    assert(r6.some(e => e.id === fe.id), '用例6: 精确关键词 "TypeScript" 仍命中', JSON.stringify(contents(r6)))

    store.close()
  }

  console.log('== 用例 7-8：更新 / 删除后索引同步 ==')
  {
    const store = new MemoryStore(openMemoryDatabase(':memory:'))
    const fe = await store.addMemory({ content: '用户做前端开发，擅长 React 和 TypeScript' })

    // 用例 7：更新为后端内容后，旧语义词不再命中，新词命中
    await store.updateMemory(fe.id, { content: '用户做后端开发，擅长 Go 和 Python' })
    const afterUpdate1 = await store.searchMemory('前端工程师')
    const afterUpdate2 = await store.searchMemory('Go 后端 服务')
    assert(!afterUpdate1.some(e => e.id === fe.id), '用例7: 更新后"前端工程师"不再命中', JSON.stringify(contents(afterUpdate1)))
    assert(afterUpdate2.some(e => e.id === fe.id), '用例7: 更新后"Go 后端"命中新内容', JSON.stringify(contents(afterUpdate2)))

    // 用例 8：删除后索引同步移除
    store.deleteMemory(fe.id)
    const afterDelete = await store.searchMemory('Go 后端')
    assert(!afterDelete.some(e => e.id === fe.id), '用例8: 删除后不再命中', JSON.stringify(contents(afterDelete)))

    store.close()
  }

  console.log('== 用例 9：文件库重启后索引持久化 ==')
  {
    const dir = mkdtempSync(join(tmpdir(), 'mem-bm25-'))
    const dbPath = join(dir, 'memory.db')
    const feContent = '用户做前端开发，擅长 React 和 TypeScript'

    const w = MemoryStore.open(dbPath)
    await w.addMemory({ content: feContent, tags: ['职业'] })
    w.close()

    // 重新打开：索引从 memory_terms 表恢复，语义检索应仍然可用。
    const r = MemoryStore.open(dbPath)
    const hits = await r.searchMemory('前端工程师')
    assert(hits.some(e => e.content === feContent), '用例9: 重启后"前端工程师"仍命中', JSON.stringify(contents(hits)))
    r.close()
  }

  console.log('== 知识库 BM25 ==')
  {
    const store = new MemoryStore(openMemoryDatabase(':memory:'))
    await store.importKnowledge('note.md', [
      '本项目采用 pnpm monorepo 管理多个子包，构建使用 tsdown。',
      '用户偏好清淡饮食，每周跑步三次，注重睡眠规律。',
    ])
    const h1 = await store.searchKnowledge('包管理工具 monorepo 怎么组织')
    assert(h1.some(c => c.content.includes('pnpm monorepo')), '知识库: 语义召回 monorepo 段落', JSON.stringify(h1.map(c => c.content)))
    const h2 = await store.searchKnowledge('篮球 NBA 赛季')
    assert(!h2.some(c => c.content.includes('monorepo')), '知识库: 不相关查询不误召', JSON.stringify(h2.map(c => c.content)))
    store.close()
  }

  console.log(`\n== 结果：${passed} 通过 / ${failed} 失败 ==`)
  process.exit(failed > 0 ? 1 : 0)
}

void main()
