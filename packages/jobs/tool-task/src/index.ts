/**
 * 后台任务（任务队列增强）插件：在 dsh-jobs 之上提供模型可调用的
 * task_run / task_status / task_list / task_cancel 四个中文工具。
 *
 * 最小可用版：task_run 启动一个可取消、带进度的内置后台工作负载
 * （compute=确定性计算循环 / delay=定时等待），完整演示后台任务生命周期
 * （pending→running→completed/failed/cancelled）与进度上报、取消、完成通知。
 *
 * 后续路线：将 task_run 的工作负载从内置演示扩展为「后台执行 shell 命令 /
 * 任意已注册工具」，复用现有 bash / subagent producer 能力。
 *
 * @module @deepseek-ai/dsh-tool-task
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolExecution } from '@deepseek-ai/dsh-tools'
import { JobId } from '@deepseek-ai/dsh-jobs'
import type { JobHandle, JobHooks, JobOutcome, JobView } from '@deepseek-ai/dsh-jobs'

// 注册本插件的任务 kind（声明合并进 JobKindMap）。
declare module '@deepseek-ai/dsh-jobs' {
  interface JobKindMap {
    task: 'task'
  }
}

export const name = 'tool-task'
export const inject = ['tools', 'jobs']

/** 插件配置（预留）。 */
export interface Config {
  /** 单个内置计算任务最大步数上限，防止误启超长任务。 */
  maxSteps?: number
}

export const Config: z<Config> = z.object({
  maxSteps: z.number().min(1).default(200),
})

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** 任务状态对外展示（中文）。 */
function statusText(job: JobView): string {
  const map: Record<string, string> = {
    running: '运行中', stopping: '取消中', completed: '已完成', killed: '已取消', failed: '失败',
  }
  return map[job.status] ?? job.status
}

/** 把 JobView 投影成模型友好的视图。 */
function publicTask(job: JobView) {
  return {
    id: job.id,
    kind: job.kind,
    label: job.label,
    status: job.status,
    progress: job.progress ?? '',
    startedAt: job.startedAt,
    ...(job.finishedAt !== undefined ? { finishedAt: job.finishedAt } : {}),
  }
}

export function apply(ctx: Context, config: Config): void {
  const maxSteps = config.maxSteps ?? 200
  // 本插件作为 job producer，必须挂载一个 controller 才能 start。
  ctx.jobs.attachController('tool-task')

  // ── task_run：启动后台任务 ──
  ctx.tools.register(defineTool({
    name: 'task_run',
    description: '在后台启动一个长任务，立即返回任务 id，不阻塞当前对话。支持两种内置工作负载：compute（确定性计算循环，带进度，可取消）与 delay（定时等待，用于演示/测试取消）。用 task_status 查询进度，task_list 看全部，task_cancel 取消。任务完成时会自动通知你。',
    parameters: {
      label: { type: 'string', required: true, description: '任务的简短中文描述（显示用）' },
      task_type: { type: 'string', enum: ['compute', 'delay'], description: '工作负载类型：compute=计算循环，delay=定时等待，默认 compute' },
      steps: { type: 'number', description: 'compute 类型的步数（默认 10，最大 ' + String(maxSteps) + '）；每步约 200ms' },
      seconds: { type: 'number', description: 'delay 类型的等待秒数（默认 5）' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          jobId: { type: 'string', required: true },
          label: { type: 'string', required: true },
          status: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: `已启动后台任务 ${value.jobId}（${value.label}），状态 ${value.status}。用 task_status 查询进度。` }],
    },
    execute(args: { label: string; task_type?: string; steps?: number; seconds?: number }, exec: ToolExecution) {
      const label = args.label
      const taskType = args.task_type === 'delay' ? 'delay' : 'compute'
      const steps = Math.max(1, Math.min(Math.round(args.steps ?? 10), maxSteps))
      const seconds = Math.max(1, Math.round(args.seconds ?? 5))

      const owner = exec.agent?.id
      const id = ctx.jobs.start({
        kind: 'task',
        label,
        ...(owner !== undefined ? { owner } : {}),
        run(job: JobHandle): JobHooks {
          let cancelled = false
          const done = (async (): Promise<JobOutcome> => {
            try {
              if (taskType === 'delay') {
                for (let s = 1; s <= seconds; s++) {
                  if (cancelled) return { status: 'killed', detail: '任务被取消' }
                  job.updateProgress(`${s}/${seconds} 秒`)
                  job.append(`等待中 ${s}/${seconds}s\n`, { channel: 'stdout' })
                  await sleep(1000)
                }
                return { status: 'completed', detail: `等待 ${seconds} 秒完成`, result: `delay 任务「${label}」已完成` }
              }
              // compute：确定性求和循环（纯计算，可复核），逐步上报进度。
              let acc = 0
              for (let i = 1; i <= steps; i++) {
                if (cancelled) return { status: 'killed', detail: '任务被取消' }
                for (let k = 0; k < 200_000; k++) acc += (k * k) % 1000
                job.updateProgress(`${i}/${steps}（${Math.round(i / steps * 100)}%）`)
                job.append(`第 ${i}/${steps} 步完成，累计校验和=${acc}\n`, { channel: 'stdout' })
                await sleep(200)
              }
              return { status: 'completed', detail: `计算 ${steps} 步完成`, result: `compute 任务「${label}」完成，校验和=${acc}` }
            } catch (error) {
              return { status: 'failed', detail: String(error) }
            }
          })()
          return {
            cancel(reason?: string) { cancelled = true; job.append(`收到取消请求：${reason ?? ''}\n`, { channel: 'stderr' }) },
            done,
          }
        },
      })
      return Promise.resolve({ jobId: id, label, status: 'running' })
    },
  }))

  // ── task_status：查询单个任务状态（非阻塞） ──
  ctx.tools.register(defineTool({
    name: 'task_status',
    description: '查询一个后台任务的当前状态与最近输出（非阻塞）。返回状态、进度行与自上次读取以来的输出。',
    parameters: {
      job_id: { type: 'string', required: true, description: 'task_run 返回的任务 id' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          id: { type: 'string', required: true },
          label: { type: 'string', required: true },
          status: { type: 'string', required: true },
          progress: { type: 'string' },
          output: { type: 'string', required: true },
        },
      },
      render: (_args, v) => [{ type: 'text', text: `任务 ${v.id}（${v.label}）：${v.status} ${v.progress ? '· ' + v.progress : ''}\n${v.output}` }],
    },
    execute(args: { job_id: string }, exec: ToolExecution) {
      const id = JobId(args.job_id)
      const owner = exec.agent?.id
      const view = ctx.jobs.get(id, owner)
      const read = ctx.jobs.read(id, owner)
      const output = read.chunks.map((c) => c.text).join('') + (read.result !== undefined ? `\n结果：${read.result}` : '')
      return Promise.resolve({
        id: view.id, label: view.label, status: statusText(view),
        ...(view.progress !== undefined ? { progress: view.progress } : {}),
        output: output.length > 0 ? output : '(暂无输出)',
      })
    },
  }))

  // ── task_list：列出全部任务 ──
  ctx.tools.register(defineTool({
    name: 'task_list',
    description: '列出你的后台任务（运行中与已结束），含 id、状态、进度与描述。',
    parameters: {},
    output: {
      schema: { type: 'array', items: {
        type: 'object', additionalProperties: false,
        properties: {
          id: { type: 'string', required: true }, kind: { type: 'string', required: true },
          label: { type: 'string', required: true }, status: { type: 'string', required: true },
          progress: { type: 'string' }, startedAt: { type: 'integer', required: true },
        },
      } },
      render: (_args, jobs) => [{
        type: 'text',
        text: jobs.length === 0 ? '(暂无后台任务)' : jobs.map((t: { id: string; status: string; label: string; progress?: string }) =>
          `${t.id} [${t.status}] ${t.label}${t.progress ? ' · ' + t.progress : ''}`).join('\n'),
      }],
    },
    execute(_args, exec: ToolExecution) {
      return Promise.resolve(ctx.jobs.list(exec.agent?.id).map(publicTask))
    },
  }))

  // ── task_cancel：取消任务 ──
  ctx.tools.register(defineTool({
    name: 'task_cancel',
    description: '请求取消一个正在运行的后台任务。立即返回；任务进入「取消中」并最终变为「已取消」。',
    parameters: {
      job_id: { type: 'string', required: true, description: '要取消的任务 id' },
      reason: { type: 'string', description: '取消原因（可选）' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: { outcome: { type: 'string', required: true }, status: { type: 'string', required: true } },
      },
      render: (_args, v) => [{ type: 'text', text: v.outcome === 'already-finished' ? `任务已结束，无需取消（${v.status}）` : `已请求取消任务，当前状态 ${v.status}` }],
    },
    execute(args: { job_id: string; reason?: string }, exec: ToolExecution) {
      const id = JobId(args.job_id)
      const owner = exec.agent?.id
      const result = ctx.jobs.kill(id, owner, args.reason)
      const view = ctx.jobs.get(id, owner)
      return Promise.resolve({ outcome: result === 'already-finished' ? 'already-finished' : 'cancellation-requested', status: statusText(view) })
    },
  }))
}
