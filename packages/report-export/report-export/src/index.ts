/**
 * 报告导出 host 插件：将分析/会议/研究内容导出为 Markdown 或 HTML 专业报告。
 *
 * - Markdown：直接落盘 .md 文件。
 * - HTML：内置轻量 Markdown→HTML 转换（无第三方依赖），套用专业报告样式模板。
 * - PDF：最小可用版暂不接入真实 PDF 渲染引擎；选择 pdf 时输出「打印友好」的 HTML
 *   （含 @media print 样式），后续路线：接入 headless Chromium / wkhtmltopdf 出真正 PDF。
 *
 * 输出目录：优先 $DSH_HOME/reports，其次 cwd/reports。
 *
 * @module @deepseek-ai/dsh-report-export
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'
import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join, resolve } from 'node:path'

export const name = 'report-export'
export const inject = ['tools']

/** 插件配置：自定义输出目录（默认 $DSH_HOME/reports 或 cwd/reports）。 */
export interface Config {
  /** 报告输出目录（绝对路径）；留空则自动选择。 */
  outputDir?: string
}

export const Config: z<Config> = z.object({
  outputDir: z.string().default(''),
})

/** 报告模板。 */
type ReportTemplate = 'analysis' | 'meeting' | 'research'

/** 导出格式。 */
type ReportFormat = 'md' | 'html' | 'pdf'

/** 模板元信息：中文名与主题色。 */
const TEMPLATE_META: Record<ReportTemplate, { label: string; accent: string }> = {
  analysis: { label: '分析报告', accent: '#2563eb' },
  meeting: { label: '会议纪要', accent: '#0f766e' },
  research: { label: '研究报告', accent: '#7c3aed' },
}

/** 文件名安全化：去除路径分隔符与空白，保留中文/字母数字。 */
function safeName(title: string): string {
  const cleaned = title.replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '')
  return cleaned.length > 0 ? cleaned.slice(0, 60) : 'report'
}

/** 解析输出目录。 */
async function resolveOutputDir(cfgDir: string): Promise<string> {
  const base = cfgDir.length > 0
    ? cfgDir
    : process.env.DSH_HOME !== undefined && process.env.DSH_HOME.length > 0
      ? join(process.env.DSH_HOME, 'reports')
      : join(process.cwd(), 'reports')
  const dir = resolve(base)
  await mkdir(dir, { recursive: true })
  return dir
}

// ─────────── 极简 Markdown → HTML（标题/加粗/行内代码/代码块/列表/表格/段落） ───────────

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 行内样式：加粗、行内代码。 */
function inlineMd(text: string): string {
  let out = escapeHtml(text)
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>')
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  return out
}

/** 把 Markdown 正文转成 HTML 片段（无外层 <html>）。 */
export function markdownToHtml(md: string): string {
  const lines = md.split(/\r?\n/)
  const html: string[] = []
  let inCode = false
  let codeBuf: string[] = []
  let inList = false
  let tableBuf: string[] = []

  const flushList = () => { if (inList) { html.push('</ul>'); inList = false } }
  const flushTable = () => {
    if (tableBuf.length === 0) return
    const rows = tableBuf.map((l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()))
    if (rows.length >= 2) {
      const head = rows[0] as string[]
      const body = rows.slice(2)
      html.push('<table><thead><tr>' + head.map((c) => `<th>${inlineMd(c)}</th>`).join('') + '</tr></thead><tbody>')
      for (const r of body) html.push('<tr>' + r.map((c) => `<td>${inlineMd(c)}</td>`).join('') + '</tr>')
      html.push('</tbody></table>')
    }
    tableBuf = []
  }

  for (const raw of lines) {
    const line = raw
    if (line.trim().startsWith('```')) {
      if (inCode) { html.push('<pre><code>' + escapeHtml(codeBuf.join('\n')) + '</code></pre>'); codeBuf = []; inCode = false }
      else { flushList(); flushTable(); inCode = true }
      continue
    }
    if (inCode) { codeBuf.push(line); continue }

    if (/^\s*\|.*\|\s*$/.test(line)) { flushList(); tableBuf.push(line); continue }
    flushTable()

    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading !== null) {
      flushList()
      const level = heading[1]?.length ?? 1
      html.push(`<h${level}>${inlineMd(heading[2] ?? '')}</h${level}>`)
      continue
    }
    if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) { html.push('<ul>'); inList = true }
      html.push('<li>' + inlineMd(line.replace(/^\s*[-*]\s+/, '')) + '</li>')
      continue
    }
    if (line.trim() === '') { flushList(); continue }
    flushList()
    html.push('<p>' + inlineMd(line) + '</p>')
  }
  flushList(); flushTable()
  if (inCode) html.push('<pre><code>' + escapeHtml(codeBuf.join('\n')) + '</code></pre>')
  return html.join('\n')
}

/** 套专业报告 HTML 模板。 */
function wrapHtml(title: string, template: ReportTemplate, bodyHtml: string): string {
  const meta = TEMPLATE_META[template]
  const stamp = new Date().toISOString()
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root { --accent: ${meta.accent}; }
  body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", Segoe UI, sans-serif; color: #1f2937; max-width: 860px; margin: 0 auto; padding: 40px 28px; line-height: 1.75; }
  .banner { border-left: 6px solid var(--accent); padding: 12px 18px; background: #f8fafc; margin-bottom: 28px; }
  .banner .kind { color: var(--accent); font-size: 13px; letter-spacing: 2px; }
  .banner h1 { margin: 6px 0 4px; font-size: 26px; }
  .banner .meta { color: #6b7280; font-size: 13px; }
  h1,h2,h3 { color: #111827; }
  h2 { border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin-top: 32px; }
  code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 90%; }
  pre { background: #0f172a; color: #e2e8f0; padding: 16px; border-radius: 8px; overflow-x: auto; }
  pre code { background: transparent; color: inherit; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 14px; }
  th, td { border: 1px solid #e5e7eb; padding: 8px 12px; text-align: left; }
  th { background: #f8fafc; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px; }
  @media print { body { padding: 0; } .banner { background: none; } }
</style>
</head>
<body>
  <div class="banner">
    <div class="kind">${meta.label}</div>
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">导出时间 ${stamp} · 由 OmniAgent report_export 生成</div>
  </div>
  ${bodyHtml}
  <div class="footer">本报告由 OmniAgent 自动生成，内容仅供参考，不构成投资建议。</div>
</body>
</html>`
}

/** 注册 report_export 工具。 */
export function apply(ctx: Context, config: Config): void {
  const cfgDir = config.outputDir ?? ''

  const tool: ToolDefinition = defineTool({
    name: 'report_export',
    description: '把一段 Markdown 内容导出为报告文件，支持 Markdown(.md)、HTML(.html) 两种格式。模板可选分析报告/会议纪要/研究报告。选择 pdf 时会输出打印友好的 HTML（真正的 PDF 渲染为后续路线）。返回生成文件的绝对路径。',
    parameters: {
      title: { type: 'string', required: true, description: '报告标题' },
      content: { type: 'string', required: true, description: '报告正文（Markdown 格式，支持标题/列表/表格/代码块）' },
      format: { type: 'string', enum: ['md', 'html', 'pdf'], description: '导出格式：md=纯 Markdown，html=带样式网页报告，pdf=打印友好 HTML（PDF 渲染待接入），默认 html' },
      template: { type: 'string', enum: ['analysis', 'meeting', 'research'], description: '报告模板：analysis=分析报告，meeting=会议纪要，research=研究报告，默认 analysis' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          filePath: { type: 'string', required: true },
          format: { type: 'string', required: true },
          template: { type: 'string', required: true },
          bytes: { type: 'number', required: true },
          pdfNote: { type: 'string' },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: [
          `已导出报告（${TEMPLATE_META[value.template as ReportTemplate]?.label ?? value.template}，${value.format}）`,
          `文件：${value.filePath}（${value.bytes} 字节）`,
          ...(value.pdfNote !== undefined ? [`说明：${value.pdfNote}`] : []),
        ].join('\n'),
      }],
    },
    async execute(args: { title: string; content: string; format?: string; template?: string }) {
      const title = args.title.trim() || '未命名报告'
      const md = args.content
      const format: ReportFormat = args.format === 'md' ? 'md' : args.format === 'pdf' ? 'pdf' : 'html'
      const template: ReportTemplate = args.template === 'meeting' ? 'meeting' : args.template === 'research' ? 'research' : 'analysis'
      const dir = await resolveOutputDir(cfgDir)

      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const tag = createHash('md5').update(title + stamp).digest('hex').slice(0, 6)

      let filePath: string
      let body: string
      let pdfNote: string | undefined

      if (format === 'md') {
        filePath = join(dir, `${safeName(title)}-${stamp}-${tag}.md`)
        body = `# ${title}\n\n> 模板：${TEMPLATE_META[template].label} · 导出时间 ${stamp}\n\n${md}\n`
        await writeFile(filePath, body, 'utf8')
      } else {
        // html 与 pdf 都输出 .html（pdf 为打印友好版本）。
        filePath = join(dir, `${safeName(title)}-${stamp}-${tag}.html`)
        body = wrapHtml(title, template, markdownToHtml(md))
        await writeFile(filePath, body, 'utf8')
        if (format === 'pdf') {
          pdfNote = 'PDF 渲染引擎尚未接入（最小可用版）：当前输出为打印友好 HTML，可在浏览器中「打印→另存为 PDF」。后续路线：接入 headless Chromium 直接出 PDF。'
        }
      }

      const { stat } = await import('node:fs/promises')
      const bytes = (await stat(filePath)).size
      return { filePath, format, template, bytes, ...(pdfNote !== undefined ? { pdfNote } : {}) }
    },
  })

  ctx.tools.register(tool)
}
