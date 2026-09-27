#!/usr/bin/env node
/**
 * OmniAgent 一站式验证脚本 —— `pnpm run check:all`
 *
 * 一次跑完五步验证链：lint → 全量类型检查 → host 构建 → client 构建 → web 构建。
 * 任何一步失败即退出非零码，输出简明的 PASS/FAIL 汇总。
 * 用于本地交付前自检，与 .github/workflows/ci.yml 保持同一套命令（单线程模式兼容低内存环境）。
 */
import { spawnSync } from 'node:child_process'

const steps = [
  ['lint',        ['pnpm', 'exec', 'oxlint', '--threads', '1', '.']],
  ['typecheck',   ['npx', 'tsc', '-b']],
  ['build:host',  ['pnpm', 'run', 'build:lib:host']],
  ['build:client',['pnpm', 'run', 'build:lib:client']],
  ['build:web',   ['pnpm', 'run', 'build:web']],
]

let failed = 0
const results = []
for (const [name, cmd] of steps) {
  process.stdout.write(`\n==> [${name}] ${cmd.join(' ')}\n`)
  const t0 = Date.now()
  const r = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit', shell: false, timeout: 0 })
  const sec = ((Date.now() - t0) / 1000).toFixed(1)
  if (r.status === 0) {
    results.push(`PASS  ${name.padEnd(14)} ${sec}s`)
  } else {
    failed++
    results.push(`FAIL  ${name.padEnd(14)} ${sec}s  (exit ${r.status})`)
  }
}

process.stdout.write('\n========== check:all 汇总 ==========\n')
for (const line of results) process.stdout.write(`  ${line}\n`)
process.stdout.write(`====================================\n${failed === 0 ? 'ALL GREEN' : `${failed} STEP(S) FAILED`}\n`)
process.exit(failed === 0 ? 0 : 1)
