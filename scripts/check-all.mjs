#!/usr/bin/env node
/**
 * OmniAgent 一站式验证脚本 —— `pnpm run check:all`
 *
 * 顺序依赖（务必保持，否则干净 checkout 必挂）：
 *  1. build:lib:host 先行：先 `tsc -b tsconfig.host.json` 产出各 host 包的 lib/types
 *     （含 typert 生成器自身，tsdown.config.ts 会 import 它编译出的 tsdown-plugin.js），
 *     再由 `tsdown --env.DSH_BUILD_FACE host` 跑 typert plugin，产出各 api 包的
 *     typert.remote-client 类型文件。二者顺序不可颠倒：tsdown 先行会加载不到自身配置，
 *     而干净的 `tsc -b` 先行又缺少 remote-client 声明。
 *  2. tsc -b 全量类型检查（此时 remote 类型已齐，host + client）。
 *  3. lint（oxlint typeAware 同样依赖 lib 类型产物）。
 *  4. build client / web。
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// 前置校验：workflow YAML 必须可解析（GitHub Actions 解析层失败会静默 0 jobs，极难排查）
let wfFailed = false
for (const f of ['.github/workflows/ci.yml', '.github/workflows/mirror.yml']) {
  const r = spawnSync('python3', ['-c', `
import sys, yaml
try:
    yaml.safe_load(open(sys.argv[1]))
except Exception as e:
    print(str(e)); sys.exit(1)
`, f], { encoding: 'utf8' })
  if (r.status !== 0) {
    wfFailed = true
    console.error(`[workflow-yaml] FAIL ${f}: ${r.stderr.trim() || r.stdout.trim()}`)
  }
}
if (wfFailed) process.exit(1)

const steps = [
  ['build:host',                ['pnpm', 'run', 'build:lib:host']],
  ['typecheck (tsc -b)',        ['npx', 'tsc', '-b']],
  ['lint (oxlint)',             ['pnpm', 'exec', 'oxlint', '--threads', '1', '.']],
  ['build:client',              ['pnpm', 'run', 'build:lib:client']],
  ['build:web',                 ['pnpm', 'run', 'build:web']],
]

let failed = 0
const results = []
for (const [name, cmd] of steps) {
  process.stdout.write(`\n==> [${name}] ${cmd.join(' ')}\n`)
  const t0 = Date.now()
  const r = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit', shell: false, timeout: 0 })
  const sec = ((Date.now() - t0) / 1000).toFixed(1)
  if (r.status === 0) {
    results.push(`PASS  ${name.padEnd(22)} ${sec}s`)
  } else {
    failed++
    results.push(`FAIL  ${name.padEnd(22)} ${sec}s  (exit ${r.status})`)
  }
}

process.stdout.write('\n========== check:all 汇总 ==========\n')
for (const line of results) process.stdout.write(`  ${line}\n`)
process.stdout.write(`====================================\n${failed === 0 ? 'ALL GREEN' : `${failed} STEP(S) FAILED`}\n`)
process.exit(failed === 0 ? 0 : 1)
