#!/usr/bin/env node
/**
 * 产品品牌改名脚本（安全版 · v2：自保护）
 *
 * 用法:
 *   node scripts/rebrand.mjs --name "产品名" --command "命令名"            # dry-run 预览
 *   node scripts/rebrand.mjs --name "产品名" --command "命令名" --apply    # 实际执行
 *
 * 策略:
 *   - 只替换「用户可见品牌层」: DeepSeek Harness / deepseek-harness / DSH / dsh(命令)
 *   - 保留内部 @deepseek-ai 包名与 vendor(实现细节, 全量替换风险高)
 *   - 自动在 README 顶部注入合规声明 "基于 DeepSeek Harness(DSH) 构建"(官方品牌指南要求)
 *   - 自保护: 本脚本文件不参与替换; 合规声明行(以 "> 本产品" 开头)与官方仓库链接 URL 不被替换
 *
 * 替换范围:
 *   - 全仓 *.md / *.yml 文档: "DeepSeek Harness" -> 产品名
 *   - apps/cli: bin 命令名(dsh -> 命令名)、帮助文本中的命令标识
 *   - apps/web: index.html / manifest.webmanifest / 品牌文案
 *   - 根 package.json 与 apps 下各包的 name/description(仅顶层, 不动 @deepseek-ai scope)
 */
import { readFile, writeFile, readdir, access } from 'node:fs/promises'
import { join, extname, basename } from 'node:path'

const args = process.argv.slice(2)
const opt = (flag) => args[args.indexOf(flag) + 1]
const NAME = opt('--name')
const COMMAND = opt('--command')
const APPLY = args.includes('--apply')
const ROOT = process.cwd()

if (!NAME || !COMMAND) {
  console.error('用法: node scripts/rebrand.mjs --name "产品名" --command "命令名" [--apply]')
  process.exit(1)
}
if (!/^[a-z][a-z0-9-]*$/.test(COMMAND)) {
  console.error('命令名必须是 [a-z][a-z0-9-]* (小写字母数字连字符)')
  process.exit(1)
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'lib', 'dist', 'vendor', '.turbo', 'coverage', '.agents', 'tests', 'scripts'])
const SKIP_EXT = new Set(['.map', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.zst', '.lock'])

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(full)
    } else if (!SKIP_EXT.has(extname(entry.name))) {
      yield full
    }
  }
}

// 品牌串替换规则:
// A) 全仓安全替换：DeepSeek Harness / deepseek-harness / DeepSeek-Harness（跳过合规声明行与官方链接 URL）
// B) dsh 命令标识：只处理明确是"命令"的上下文（帮助文本、bin 键、文档代码块中的 `dsh`）
const BRAND_PATTERNS = [
  [/DeepSeek Harness/g, NAME],
  [/deepseek-harness/g, NAME.toLowerCase().replace(/[^a-z0-9-]/g, '-')],
  [/DeepSeek-Harness/g, NAME],
]

const CMD_INLINE = new RegExp('`dsh(?=[`\\s])', 'g')       // `dsh ...`
const CMD_STANDALONE = new RegExp('(^|[\\s(])(dsh)(?=[\\s)])', 'g') // 独立 dsh 单词

function replaceBrand(text) {
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // 保护: 合规声明行 与 官方仓库链接 URL（github.com/deepseek-ai/deepseek-harness）
    if (/^> 本产品/.test(line)) continue
    if (line.includes('github.com/deepseek-ai/deepseek-harness')) continue
    for (const [re, rep] of BRAND_PATTERNS) lines[i] = line.replace(re, rep)
  }
  return lines.join('\n')
}

function replaceCommand(text) {
  text = text.replace(CMD_INLINE, '`' + COMMAND)
  text = text.replace(CMD_STANDALONE, '$1' + COMMAND)
  return text
}

let changed = 0
const files = []
for await (const file of walk(ROOT)) {
  const name = basename(file)
  if (!/\.(md|yml|yaml|json|ts|tsx|js|mjs|html|txt)$/.test(name)) continue
  let text
  try {
    text = await readFile(file, 'utf8')
  } catch { continue }
  const isDoc = /\.(md|yml|yaml|txt)$/.test(name)
  const isCliOrWeb = file.includes('/apps/cli/') || file.includes('/apps/web/')
  const isPkgJson = name === 'package.json'
  const isRootPkg = file.endsWith('/package.json') && !file.includes('/packages/') && !file.includes('/apps/')

  let next = text
  if (isDoc || /DeepSeek Harness|deepseek-harness/.test(text)) {
    next = replaceBrand(next)
  }
  if (isDoc || isCliOrWeb || isRootPkg) {
    next = replaceCommand(next)
  }
  if (isPkgJson && (isRootPkg || isCliOrWeb)) {
    try {
      const p = JSON.parse(text)
      if (p.description && /DeepSeek/i.test(p.description)) {
        p.description = p.description.replace(/DeepSeek Harness/g, NAME)
        next = JSON.stringify(p, null, 2) + '\n'
      }
    } catch { /* 保持原样 */ }
  }
  if (next !== text) {
    files.push(file)
    changed++
    if (APPLY) await writeFile(file, next)
  }
}

// 合规声明注入（README 顶部；仅当缺少时注入一次，幂等）
for (const readme of ['README.md', 'README.zh.md']) {
  const path = join(ROOT, readme)
  try {
    await access(path)
    const text = await readFile(path, 'utf8')
    if (/基于 .*DSH.*构建/.test(text)) continue
    const line = `> 本产品 **${NAME}** 基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）构建，兼容其生态。\n\n`
    if (APPLY) await writeFile(path, line + text)
    files.push(path)
    changed++
  } catch { /* 无该 README */ }
}

// bin 键改名: apps/cli/package.json
const cliPkg = join(ROOT, 'apps/cli/package.json')
try {
  const p = JSON.parse(await readFile(cliPkg, 'utf8'))
  if (p.bin?.dsh) {
    p.bin = { [COMMAND]: p.bin.dsh }
    if (APPLY) await writeFile(cliPkg, JSON.stringify(p, null, 2) + '\n')
    files.push(cliPkg)
    changed++
  }
} catch { /* 忽略 */ }

console.log(`品牌改名: "${NAME}" (命令 ${COMMAND})`)
console.log(`模式: ${APPLY ? 'APPLY（已写入）' : 'DRY-RUN（预览）'}`)
console.log(`将改动 ${changed} 个文件:`)
for (const f of files.slice(0, 60)) console.log('  - ' + f.replace(ROOT + '/', ''))
if (files.length > 60) console.log(`  ... 共 ${files.length} 个`)
console.log('\n提示: 内部 @deepseek-ai 包名与 vendor 保留不动（实现细节）。')
