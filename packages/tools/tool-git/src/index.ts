/**
 * git 工具包：让 agent 在任务收尾时能主动、受控地完成一次本地提交。
 *
 * 提供四个模型可见工具：
 * - `git_status`：查看工作区状态（已暂存 / 未暂存 / 未跟踪文件列表）。
 * - `git_diff`：查看未暂存或已暂存的差异（numstat 摘要 + 截断后的 diff 正文）。
 * - `git_add`：暂存指定文件，或全部暂存（paths 留空时等价于 git add -A）。
 * - `git_commit`：提交已暂存内容（message 必填且不允许为空；可选先 addAll 再提交）。
 *
 * 实现方式：直接用 node:child_process 的 execFileSync 调用系统 git，
 * 不引入 simple-git / isomorphic-git 等第三方依赖；工作目录固定为
 * process.cwd()（即 agent 工作区），不操作其他目录，也绝不自动 push。
 *
 * 权限分级（由 permission-rules 体系统一接管，本包不做任何绕过）：
 * - `git_status` / `git_diff`：只读操作，默认 allow（未命中规则时兜底放行）。
 * - `git_add` / `git_commit`：写操作，建议通过 permission-rules 配置为 ask
 *   （如 rules: [{ pattern: 'git_commit', level: 'ask' }, { pattern: 'git_add', level: 'ask' }]），
 *   或用通配符 `git.*` / `git_*` 整组管控；deny 可直接拦截。
 *
 * @module @deepseek-ai/dsh-tool-git
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { execFileSync, type ExecFileSyncOptionsWithStringEncoding } from 'node:child_process'

/** Cordis 插件名。 */
export const name = 'tool-git'

/** 只依赖 tools 服务（注册工具 + 自然接入 pre-execute 权限决策链）。 */
export const inject: readonly string[] = ['tools']

/** 插件配置。 */
export interface Config {
  /** diff 正文返回给模型的最大字符数（超出截断），默认 20000。 */
  maxDiffChars?: number
}

/** schemastery 校验器。 */
export const Config: z<Config> = z.object({
  maxDiffChars: z.number().min(1000).default(20000),
})

/** 一次 git 命令的执行结果。 */
interface GitResult {
  /** 退出码；0 表示成功。 */
  exitCode: number
  /** 标准输出（utf8 字符串）。 */
  stdout: string
  /** 标准错误（utf8 字符串）。 */
  stderr: string
}

/**
 * 同步执行一条 git 命令。
 *
 * 固定环境：关闭交互式凭据弹窗、统一 LC_ALL=C 保证输出可解析；
 * 失败（非零退出码或 spawn 失败）时抛出带中文说明与 stderr 尾部的 Error。
 *
 * @param args - git 子命令及参数（不经 shell 拼接，按数组传入）。
 * @param cwd - 工作目录（agent 工作区）。
 * @param input - 可选 stdin 输入（本包暂未使用，保留扩展）。
 * @returns 退出码与输出文本。
 */
function runGit(args: readonly string[], cwd: string, input?: string): GitResult {
  // 清洗环境：禁止 git 弹出交互式提示（如凭据输入），避免进程挂起。
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
    LC_ALL: 'C',
  }
  const options: ExecFileSyncOptionsWithStringEncoding = {
    cwd,
    encoding: 'utf8',
    env,
    // 防止异常仓库上 git 命令失控；本地 status/diff/add/commit 均为毫秒级。
    timeout: 30_000,
    maxBuffer: 4 * 1024 * 1024,
    input,
  }
  try {
    const stdout = execFileSync('git', args, options)
    return { exitCode: 0, stdout, stderr: '' }
  } catch (error) {
    const err = error as { status?: number | null; stdout?: unknown; stderr?: unknown; message?: string }
    const status = typeof err.status === 'number' ? err.status : null
    const stderr = typeof err.stderr === 'string' ? err.stderr : ''
    const stdout = typeof err.stdout === 'string' ? err.stdout : ''
    // 退出码 1 在 git 语义里常表示“有差异/有跳过项”，由调用方按命令语义判断，
    // 这里只对真正的失败（无法执行命令、或非 0/1 的异常码）抛错。
    if (status !== null && status !== 1) {
      const detail = stderr.trim() || err.message || '未知错误'
      throw new Error(`git ${args.join(' ')} 失败（退出码 ${status}）：${detail}`)
    }
    if (status === null) {
      // spawn 失败：git 可执行文件不存在或路径不可达。
      throw new Error(`无法执行 git 命令：${err.message ?? String(error)}。请确认系统已安装 git。`)
    }
    return { exitCode: status, stdout, stderr }
  }
}

/** 断言当前目录位于一个 git 仓库内，否则抛出中文错误。 */
function assertInsideRepo(cwd: string): void {
  let stdout = ''
  try {
    stdout = runGit(['rev-parse', '--is-inside-work-tree'], cwd).stdout
  } catch {
    // 退出码 128（非仓库）等都会在这里抛出，统一转成友好提示。
    throw new Error('当前目录不是 git 仓库（或工作树不可读）。请先在工作区内执行 git init 或进入仓库目录。')
  }
  if (!stdout.trim().startsWith('true')) {
    throw new Error('当前目录不是 git 仓库（或工作树不可读）。请先在工作区内执行 git init 或进入仓库目录。')
  }
}

/** porcelain 输出里单条文件变更的结构化描述。 */
interface PorcelainEntry {
  /** 两位状态码中的对应位（如 M/A/D/?? 的单字符）。 */
  status: string
  /** 文件路径（相对仓库根，rename 时取新路径）。 */
  path: string
}

/**
 * 解析 `git status --porcelain=v1` 输出。
 *
 * 每行形如 `XY path`：X 为暂存区状态、Y 为工作区状态；
 * `??` 表示未跟踪文件；rename 行为 `XY orig -> new`。
 */
function parsePorcelain(text: string): { staged: PorcelainEntry[]; unstaged: PorcelainEntry[]; untracked: string[] } {
  const staged: PorcelainEntry[] = []
  const unstaged: PorcelainEntry[] = []
  const untracked: string[] = []
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trimEnd()
    if (line.length < 4) continue
    const x = line[0] ?? ' '
    const y = line[1] ?? ' '
    const body = line.slice(3)
    // rename 条目形如 "orig -> new"，对外只暴露最终路径。
    const path = body.includes(' -> ') ? (body.split(' -> ').at(-1) ?? body) : body
    if (x === '?' && y === '?') {
      untracked.push(path)
      continue
    }
    if (x !== ' ' && x !== '?') staged.push({ status: x, path })
    if (y !== ' ' && y !== '?') unstaged.push({ status: y, path })
  }
  return { staged, unstaged, untracked }
}

/** numstat 一行的解析结果。 */
interface NumstatEntry {
  /** 新增行数；二进制文件为 null。 */
  added: number | null
  /** 删除行数；二进制文件为 null。 */
  deleted: number | null
  path: string
}

/** 解析 `git diff --numstat` 输出（二进制文件行首为 `-`）。 */
function parseNumstat(text: string): NumstatEntry[] {
  const out: NumstatEntry[] = []
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trimEnd()
    if (line.length === 0) continue
    const [addedRaw, deletedRaw, ...rest] = line.split('\t')
    const path = rest.join('\t')
    if (path.length === 0) continue
    // 二进制文件的 added/deleted 字段为 '-'，对外记为 null。
    const added: number | null = addedRaw === '-' ? null : Number(addedRaw)
    const deleted: number | null = deletedRaw === '-' ? null : Number(deletedRaw)
    out.push({
      added: added === null || Number.isFinite(added) ? added : null,
      deleted: deleted === null || Number.isFinite(deleted) ? deleted : null,
      path,
    })
  }
  return out
}

/** 把 numstat 条目渲染成模型友好的一行摘要。 */
function renderNumstat(entries: readonly { added?: number | null; deleted?: number | null; path: string }[]): string {
  if (entries.length === 0) return '(无差异文件)'
  return entries
    .map((e) => {
      const stat = e.added === undefined || e.added === null ? '二进制' : `+${e.added} -${e.deleted ?? 0}`
      return `  ${e.path}（${stat}）`
    })
    .join('\n')
}

/** 安装插件：注册四个 git 工具。 */
export function apply(ctx: Context, config: Config): void {
  const maxDiffChars = config.maxDiffChars ?? 20_000
  // git 命令都跑在 agent 工作区根，避免误操作仓库外目录。
  const cwd = process.cwd()

  // ── git_status：查看工作区状态（只读） ──
  ctx.tools.register(defineTool({
    name: 'git_status',
    description: '查看当前 git 工作区状态：当前分支、已暂存（待提交）文件、未暂存修改、未跟踪文件。只读，不改变任何内容。',
    parameters: {},
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          branch: { type: 'string', required: true },
          staged: { type: 'array', required: true, items: { type: 'object', additionalProperties: false, properties: { status: { type: 'string', required: true }, path: { type: 'string', required: true } } } },
          unstaged: { type: 'array', required: true, items: { type: 'object', additionalProperties: false, properties: { status: { type: 'string', required: true }, path: { type: 'string', required: true } } } },
          untracked: { type: 'array', required: true, items: { type: 'string' } },
        },
      },
      render: (_args, v) => [{
        type: 'text',
        text: [
          `分支：${v.branch}`,
          `已暂存（${v.staged.length}）：`,
          v.staged.length === 0 ? '  (无)' : v.staged.map((f: PorcelainEntry) => `  ${f.status} ${f.path}`).join('\n'),
          `未暂存（${v.unstaged.length}）：`,
          v.unstaged.length === 0 ? '  (无)' : v.unstaged.map((f: PorcelainEntry) => `  ${f.status} ${f.path}`).join('\n'),
          `未跟踪（${v.untracked.length}）：`,
          v.untracked.length === 0 ? '  (无)' : v.untracked.map((p: string) => `  ${p}`).join('\n'),
        ].join('\n'),
      }],
    },
    execute() {
      assertInsideRepo(cwd)
      const status = runGit(['status', '--porcelain=v1'], cwd)
      const parsed = parsePorcelain(status.stdout)
      // 新仓库尚无提交时分支可能为空，容错展示。
      const branch = (() => {
        try {
          return runGit(['branch', '--show-current'], cwd).stdout.trim() || '(未命名分支/尚无提交)'
        } catch {
          return '(未知分支)'
        }
      })()
      return Promise.resolve({ branch, staged: parsed.staged, unstaged: parsed.unstaged, untracked: parsed.untracked })
    },
  }))

  // ── git_diff：查看差异（只读） ──
  ctx.tools.register(defineTool({
    name: 'git_diff',
    description: '查看 git 差异：默认对比工作区与暂存区（未暂存修改）；传 staged=true 对比暂存区与 HEAD（即将提交的内容）。返回 numstat 文件摘要与截断后的 diff 正文。只读。',
    parameters: {
      staged: { type: 'boolean', description: 'true=查看已暂存差异（git diff --cached），默认 false=查看未暂存差异' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          staged: { type: 'boolean', required: true },
          files: { type: 'array', required: true, items: { type: 'object', additionalProperties: false, properties: { added: { oneOf: [{ type: 'integer' }, { type: 'null' }], description: '新增行数；二进制文件为 null' }, deleted: { oneOf: [{ type: 'integer' }, { type: 'null' }], description: '删除行数；二进制文件为 null' }, path: { type: 'string', required: true } } } },
          truncated: { type: 'boolean', required: true },
          diff: { type: 'string', required: true },
        },
      },
      render: (_args, v) => [{
        type: 'text',
        text: [
          v.staged ? '已暂存差异（相对于 HEAD）：' : '未暂存差异（工作区 vs 暂存区）：',
          renderNumstat(v.files),
          v.diff.trim().length === 0 ? '(无 diff 正文)' : `diff 正文（${v.truncated ? '已截断 ' : ''}）：\n${v.diff}`,
        ].join('\n'),
      }],
    },
    execute(args: { staged?: boolean }) {
      assertInsideRepo(cwd)
      const staged = args.staged === true
      const baseArgs = staged ? ['diff', '--cached'] : ['diff']
      const numstat = runGit([...baseArgs, '--numstat'], cwd)
      const entries = parseNumstat(numstat.stdout)
      const raw = runGit(baseArgs, cwd).stdout
      const truncated = raw.length > maxDiffChars
      const diff = truncated ? raw.slice(0, maxDiffChars) + `\n...（diff 过长，已截断，共 ${raw.length} 字符）` : raw
      return Promise.resolve({ staged, files: entries, truncated, diff })
    },
  }))

  // ── git_add：暂存文件（写操作） ──
  ctx.tools.register(defineTool({
    name: 'git_add',
    description: '把文件暂存到 git 索引（待提交区）。传入 paths 只暂存指定文件；不传或传空数组则暂存全部更改（等价 git add -A，含新增/修改/删除）。',
    parameters: {
      paths: { type: 'array', items: { type: 'string' }, description: '要暂存的文件路径列表（相对仓库根或当前目录）；留空表示暂存全部' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          stagedCount: { type: 'integer', required: true },
          staged: { type: 'array', required: true, items: { type: 'object', additionalProperties: false, properties: { status: { type: 'string', required: true }, path: { type: 'string', required: true } } } },
        },
      },
      render: (_args, v) => [{ type: 'text', text: `已暂存 ${v.stagedCount} 个文件。\n` + (v.stagedCount === 0 ? '(没有可暂存的更改)' : v.staged.map((f: PorcelainEntry) => `  ${f.status} ${f.path}`).join('\n')) }],
    },
    execute(args: { paths?: string[] }) {
      assertInsideRepo(cwd)
      const paths = Array.isArray(args.paths) ? args.paths.filter((p) => typeof p === 'string' && p.trim().length > 0) : []
      if (paths.length === 0) {
        // 等价 git add -A：覆盖工作区全部新增/修改/删除。
        runGit(['add', '-A'], cwd)
      } else {
        runGit(['add', '--', ...paths], cwd)
      }
      // 回读暂存区状态，作为执行结果反馈给模型。
      const status = runGit(['status', '--porcelain=v1'], cwd)
      const parsed = parsePorcelain(status.stdout)
      return Promise.resolve({ stagedCount: parsed.staged.length, staged: parsed.staged })
    },
  }))

  // ── git_commit：提交（写操作） ──
  ctx.tools.register(defineTool({
    name: 'git_commit',
    description: '把已暂存内容提交为一次本地 commit。message 必填（建议中文，简明概括本次改动）；addAll=true 时先暂存全部更改再提交。不允许空 message；没有暂存内容时会报错。绝不自动 push。',
    parameters: {
      message: { type: 'string', required: true, description: '提交信息（中文一句话概括改动），不能为空' },
      addAll: { type: 'boolean', description: 'true=提交前先 git add -A 暂存全部更改，默认 false（只提交已暂存内容）' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          committed: { type: 'boolean', required: true },
          commit: { type: 'string', required: true },
          message: { type: 'string', required: true },
          files: { type: 'integer', required: true },
        },
      },
      render: (_args, v) => [{ type: 'text', text: `已提交 ${v.commit}：${v.message}（${v.files} 个文件）。未 push。` }],
    },
    execute(args: { message: string; addAll?: boolean }) {
      assertInsideRepo(cwd)
      const message = typeof args.message === 'string' ? args.message.trim() : ''
      // 空 message 直接拒绝：不允许生成无意义提交。
      if (message.length === 0) {
        throw new Error('提交信息不能为空：请根据 diff 内容撰写一句中文概括。')
      }
      if (args.addAll === true) {
        runGit(['add', '-A'], cwd)
      }
      // 检查暂存区是否有内容：`git diff --cached --quiet` 退出码 1 表示有差异。
      const cached = runGit(['diff', '--cached', '--quiet'], cwd)
      if (cached.exitCode === 0) {
        throw new Error('没有可提交的更改：暂存区为空。可先用 git_add 暂存文件，或调用本工具时传 addAll=true。')
      }
      let commit: string
      try {
        runGit(['commit', '-m', message], cwd)
        // 提交成功后读取短 hash。
        commit = runGit(['rev-parse', '--short', 'HEAD'], cwd).stdout.trim()
      } catch (error) {
        // 常见原因：未配置 user.name/user.email，给出可操作的中文提示。
        const text = error instanceof Error ? error.message : String(error)
        if (/user\.name|user\.email/i.test(text)) {
          throw new Error(`提交失败：git 身份未配置。请在工作区执行：git config user.name "你的名字" 与 git config user.email "你的邮箱"。原始错误：${text}`)
        }
        throw error
      }
      // 本次提交涉及的文件数：HEAD 与上一提交的 numstat 行数。
      const stat = runGit(['show', '--no-color', '--format=', '--numstat', 'HEAD'], cwd)
      const files = parseNumstat(stat.stdout).length
      return Promise.resolve({ committed: true, commit, message, files })
    },
  }))
}
