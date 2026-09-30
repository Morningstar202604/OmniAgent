/**
 * Markdown → 真实 PDF 渲染（基于 pdfkit + fontkit，纯 JS，无原生依赖）。
 *
 * 设计要点：
 * - 不引入 puppeteer / chromium，仅用 pdfkit（约 500KB）绘制。
 * - 中文：用 fontkit 打开系统中文字体集合（.ttc），取出简中（SC）子字体对象，
 *   直接交给 pdfkit 嵌入；pdfkit 自动子集化，仅嵌入用到的字形，PDF 体积很小。
 *   （pdfkit 无法直接打开 .ttc，故借助 fontkit 选子字体。）
 * - 样式与 HTML 模板对齐：模板横幅（主题色左边条 + 标题 + 时间戳）、
 *   标题分割线、表格边框、深色代码块、页脚页码。
 * - 若系统找不到可用中文字体，则降级为 PDF 标准 Helvetica（仅拉丁字符），
 *   并在首页顶部写入降级说明。
 *
 * @module report-export/pdf
 */

import PDFDocument from 'pdfkit'
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, isAbsolute } from 'node:path'

// fontkit 为 CJS 模块，用 createRequire 显式加载以保证 ESM 构建后可用。
const fontkit = createRequire(import.meta.url)('fontkit') as typeof import('fontkit')

/** A4 尺寸（pt）。 */
const PAGE_W = 595.28
const PAGE_H = 841.89
/** 页边距（pt）。 */
const MARGIN_X = 56
const MARGIN_TOP = 60
const MARGIN_BOTTOM = 60
const CONTENT_W = PAGE_W - MARGIN_X * 2

/** 注册到 pdfkit 的字体别名（常规 / 粗体）。 */
const FONT = 'body'
const FONT_BOLD = 'bold'

/** 正文字号 / 颜色（与 HTML 模板一致）。 */
const BODY_SIZE = 11
const BODY_COLOR = '#1f2937'
const MUTED_COLOR = '#6b7280'
const FAINT_COLOR = '#9ca3af'
const DARK_COLOR = '#111827'
const CODE_BG = '#0f172a'
const CODE_FG = '#e2e8f0'
const BORDER_COLOR = '#e5e7eb'

/** 图表/图片相关常量。 */
/** 图表默认高度（pt）。 */
const CHART_H = 200
/** 单张图片最大高度（pt），超出则按宽度等比缩放后仍限高。 */
const IMAGE_MAX_H = 320
/** 远程图片下载超时（毫秒）。 */
const IMAGE_FETCH_TIMEOUT = 5000
/** 图表网格线颜色（浅灰虚线）。 */
const GRID_COLOR = '#e5e7eb'
/** 坐标轴颜色。 */
const AXIS_COLOR = '#9ca3af'
/** 图表数据标签/刻度字号。 */
const CHART_FONT_SIZE = 8
/** 多数据系列配色（首系列使用主题色 accent，其余为互补色相）。 */
const SERIES_PALETTE = ['#0f766e', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777']

/** 一组可用字体：常规体与粗体（粗体缺失时退化为常规体）。 */
interface CJKFontSet {
  /** fontkit 字体对象（含中英文字形），传给 pdfkit.registerFont。 */
  regular: unknown
  bold: unknown
}

/**
 * 候选中文字体集合（.ttc）路径与简中子字体索引。
 * Noto Sans CJK 的 .ttc 内顺序为 JP=0, KR=1, SC=2, TC=3, HK=4。
 */
const CJK_TTC_CANDIDATES: Array<{ regular: string; bold?: string; index: number }> = [
  // Linux（本服务环境实测：Noto Sans CJK SC 同时覆盖拉丁与中文）
  {
    regular: '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    bold: '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',
    index: 2,
  },
  // 文泉驿正黑（单字重，无独立粗体）
  { regular: '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', index: 0 },
]

/**
 * 从 fontkit.openSync 的返回值中取出第 index 个子字体。
 * .ttc 返回 FontCollection（含 fonts 数组）；单字体则直接是 Font。
 */
function pickFont(opener: unknown, index: number): unknown {
  if (opener !== null && typeof opener === 'object' && Array.isArray((opener as { fonts?: unknown[] }).fonts)) {
    return (opener as { fonts: unknown[] }).fonts[index]
  }
  return opener
}

/**
 * 探测系统中可用的中文字体。
 * 用 fontkit 打开 .ttc 集合并取出简中子字体对象（pdfkit 无法直接吃 .ttc）。
 * @returns 字体集合；找不到时返回 null（调用方走降级分支）。
 */
function loadCJKFonts(): CJKFontSet | null {
  for (const c of CJK_TTC_CANDIDATES) {
    try {
      if (!existsSync(c.regular)) continue
      const regular = pickFont(fontkit.openSync(c.regular), c.index)
      if (!regular) continue
      let bold: unknown = regular
      if (c.bold && existsSync(c.bold)) {
        try {
          const b = pickFont(fontkit.openSync(c.bold), c.index)
          if (b) bold = b
        } catch {
          /* 粗体加载失败则沿用常规体 */
        }
      }
      return { regular, bold }
    } catch {
      /* 忽略本候选异常，继续尝试下一个 */
    }
  }
  return null
}

// ─────────── Markdown 块级解析（与 markdownToHtml 对齐，输出结构化块） ───────────

/** 报告模板标识。 */
export type PdfTemplate = 'analysis' | 'meeting' | 'research'

/** 渲染输入选项。 */
export interface PdfRenderOptions {
  /** 报告标题。 */
  title: string
  /** 模板名（用于横幅标签）。 */
  template: PdfTemplate
  /** 模板主题色（hex，如 #2563eb）。 */
  accent: string
  /** 模板中文名（如「分析报告」）。 */
  templateLabel: string
}

/** 块级元素。 */
type Block =
  | { t: 'h'; level: number; text: string }
  | { t: 'p'; text: string }
  | { t: 'li'; text: string }
  | { t: 'code'; text: string }
  | { t: 'table'; head: string[]; rows: string[][] }
  | { t: 'image'; alt: string; src: string }
  | { t: 'chart'; chartType: 'bar' | 'line'; head: string[]; rows: string[][] }
  | { t: 'hr' }

/** 去除行内 markdown 标记（**加粗**、`代码`），保留纯文本内容。 */
function stripInline(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim()
}

/** 把 Markdown 正文解析为块数组。 */
function parseBlocks(md: string): Block[] {
  const lines = md.split(/\r?\n/)
  const blocks: Block[] = []
  let inCode = false
  let codeBuf: string[] = []
  let tableBuf: string[] = []
  /** 待生效的图表标记（来自表格前一行 <!-- chart:bar|line -->）。 */
  let pendingChart: 'bar' | 'line' | null = null

  const flushTable = () => {
    if (tableBuf.length === 0) return
    const rows = tableBuf
      .map((l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()))
    if (rows.length >= 2) {
      const head = rows[0] ?? []
      const body = rows.slice(2)
      // 若表格前紧跟图表标记，则输出 chart 块而非 table 块
      if (pendingChart !== null) {
        blocks.push({ t: 'chart', chartType: pendingChart, head, rows: body })
        pendingChart = null
      } else {
        blocks.push({ t: 'table', head, rows: body })
      }
    }
    tableBuf = []
  }

  for (const raw of lines) {
    const line = raw
    if (line.trim().startsWith('```')) {
      if (inCode) { blocks.push({ t: 'code', text: codeBuf.join('\n') }); codeBuf = []; inCode = false }
      else { flushTable(); inCode = true }
      continue
    }
    if (inCode) { codeBuf.push(line); continue }

    // 表格行累积
    if (/^\s*\|.*\|\s*$/.test(line)) { tableBuf.push(line); continue }
    flushTable()

    // HTML 注释形式的图表标记：<!-- chart:bar --> 或 <!-- chart:line -->
    const chartMark = /^\s*<!--\s*chart:\s*(bar|line)\s*-->\s*$/.exec(line)
    if (chartMark !== null) {
      pendingChart = (chartMark[1] as 'bar' | 'line')
      continue
    }

    if (line.trim() === '---' || line.trim() === '***') { blocks.push({ t: 'hr' }); continue }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading !== null) {
      blocks.push({ t: 'h', level: heading[1]?.length ?? 1, text: stripInline(heading[2] ?? '') })
      continue
    }
    // 独立成行的 Markdown 图片：![alt](src)
    const imageLine = /^\s*!\[([^\]]*)\]\(([^)\s]+)\)\s*$/.exec(line)
    if (imageLine !== null) {
      blocks.push({ t: 'image', alt: imageLine[1] ?? '', src: imageLine[2] ?? '' })
      continue
    }
    const listItem = /^\s*[-*]\s+(.*)$/.exec(line)
    if (listItem !== null) {
      blocks.push({ t: 'li', text: stripInline(listItem[1] ?? '') })
      continue
    }
    if (line.trim() === '') continue
    blocks.push({ t: 'p', text: stripInline(line) })
  }
  flushTable()
  if (inCode) blocks.push({ t: 'code', text: codeBuf.join('\n') })
  return blocks
}

// ─────────── 图片加载（本地路径 / 远程 URL，失败优雅降级） ───────────

/**
 * 加载远程图片为 Buffer，带 5 秒超时。
 * @param url  http(s) 图片地址
 * @returns 图片 Buffer；失败返回 null
 */
async function loadRemoteImage(url: string): Promise<Buffer | null> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => { ctrl.abort() }, IMAGE_FETCH_TIMEOUT)
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow' })
    clearTimeout(timer)
    if (!res.ok) return null
    const ab = await res.arrayBuffer()
    return Buffer.from(ab)
  } catch {
    return null
  }
}

/**
 * 加载本地图片为 Buffer（相对路径基于 process.cwd()）。
 * @param p 本地路径
 * @returns 图片 Buffer；失败返回 null
 */
function loadLocalImage(p: string): Buffer | null {
  try {
    const abs = isAbsolute(p) ? p : resolve(process.cwd(), p)
    return readFileSync(abs)
  } catch {
    return null
  }
}

/**
 * 统一加载图片：自动判断远程 URL 或本地路径。
 * @param src Markdown 图片地址（http(s):// 或本地相对/绝对路径）
 * @returns 图片 Buffer；失败返回 null
 */
async function loadImageBuffer(src: string): Promise<Buffer | null> {
  if (/^https?:\/\//i.test(src)) return loadRemoteImage(src)
  return loadLocalImage(src)
}

// ─────────── 纯 pdfkit 矢量图表绘制（柱状图 / 折线图） ───────────

/** 从表格单元格文本解析数值，非数字返回 0。 */
function toNum(s: string): number {
  const n = parseFloat(s.replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

/**
 * 计算系列配色：首系列用主题色，其余从调色板取。
 * @param accent 主题色（hex）
 * @param count  系列数量
 */
function seriesColors(accent: string, count: number): string[] {
  const out: string[] = [accent]
  for (let i = 0; i < count - 1; i++) out.push(SERIES_PALETTE[i % SERIES_PALETTE.length] ?? accent)
  return out
}

/**
 * 绘制图例（图表顶部横向排列：颜色方块 + 系列名）。
 * @param doc    pdfkit 文档
 * @param x      图例起始 x
 * @param y      图例 y
 * @param names  系列名数组
 * @param colors 系列颜色数组
 */
function drawLegend(doc: PDFKit.PDFDocument, x: number, y: number, names: string[], colors: string[]): void {
  let cx = x
  doc.save()
  doc.fontSize(CHART_FONT_SIZE).fillColor(BODY_COLOR)
  names.forEach((name, i) => {
    const color = colors[i] ?? colors[0] ?? '#333333'
    // 颜色方块
    doc.rect(cx, y + 1, 8, 8).fill(color)
    cx += 12
    const w = doc.widthOfString(name)
    doc.text(name, cx, y, { width: w + 2 })
    cx += w + 14
  })
  doc.restore()
}

/**
 * 绘制坐标轴与网格线（柱状/折线共用）。
 * @returns 返回绘图区（plot）的几何参数，供具体图表使用。
 */
function setupAxes(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  labels: string[],
  maxVal: number,
): { plotX: number; plotY: number; plotW: number; plotH: number; catW: number } {
  // 内边距：左留 Y 轴刻度，下留 X 轴类别名，上留给图例
  const leftPad = 36
  const rightPad = 8
  const topPad = 18
  const bottomPad = 18
  const plotX = x + leftPad
  const plotY = y + topPad
  const plotW = w - leftPad - rightPad
  const plotH = h - topPad - bottomPad
  const catW = plotW / Math.max(labels.length, 1)

  doc.save()
  doc.lineWidth(0.6)
  // 横向网格线 + Y 轴刻度（0 / 25% / 50% / 75% / 100%）
  for (let i = 0; i <= 4; i++) {
    const gy = plotY + plotH - (plotH * i) / 4
    doc.strokeColor(GRID_COLOR).dash(2, { gap: 2 })
    doc.moveTo(plotX, gy).lineTo(plotX + plotW, gy).stroke()
    doc.undash()
    // 刻度文字
    const val = (maxVal * i) / 4
    doc.font(FONT).fontSize(CHART_FONT_SIZE).fillColor(MUTED_COLOR)
    doc.text(String(Math.round(val)), x + 2, gy - 4, { width: leftPad - 6, align: 'right' })
  }
  // 坐标轴（X / Y 实线）
  doc.strokeColor(AXIS_COLOR).lineWidth(0.8)
  doc.moveTo(plotX, plotY).lineTo(plotX, plotY + plotH).lineTo(plotX + plotW, plotY + plotH).stroke()
  doc.restore()

  return { plotX, plotY, plotW, plotH, catW }
}

/**
 * 绘制柱状图：第一列为类别标签，其余列为数据系列。
 * @param doc     pdfkit 文档
 * @param x       图表区左上角 x
 * @param y       图表区左上角 y
 * @param w       图表区宽度（=CONTENT_W）
 * @param h       图表区高度
 * @param accent  主题色
 * @param head    表头（[类别名, 系列1, 系列2, ...]）
 * @param rows    数据行
 */
function drawBarChart(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: string,
  head: string[],
  rows: string[][],
): void {
  const cats = rows.map((r) => stripInline(r[0] ?? ''))
  const seriesCount = Math.max(head.length - 1, 1)
  // 计算最大值
  let maxVal = 0
  for (const r of rows) {
    for (let c = 1; c < r.length; c++) maxVal = Math.max(maxVal, toNum(r[c] ?? ''))
  }
  if (maxVal <= 0) maxVal = 1
  const colors = seriesColors(accent, seriesCount)

  // 图例（系列名 = 表头第 2 列起）
  drawLegend(doc, x, y, head.slice(1).map((s) => stripInline(s)), colors)

  const { plotX, plotY, plotH, catW } = setupAxes(doc, x, y, w, h, cats, maxVal)

  doc.save()
  // 逐类别、逐系列画柱
  rows.forEach((r, ci) => {
    const groupX = plotX + ci * catW
    const groupInnerW = catW * 0.7
    const barW = groupInnerW / seriesCount
    for (let s = 0; s < seriesCount; s++) {
      const v = toNum(r[s + 1] ?? '')
      const bh = (v / maxVal) * plotH
      const bx = groupX + (catW - groupInnerW) / 2 + s * barW
      const by = plotY + plotH - bh
      doc.rect(bx, by, Math.max(barW - 1.5, 1), bh).fill(colors[s] ?? colors[0] ?? accent)
      // 柱顶数值标签
      if (v > 0) {
        doc.font(FONT).fontSize(CHART_FONT_SIZE).fillColor(MUTED_COLOR)
        doc.text(String(v), bx - 2, by - 10, { width: barW + 4, align: 'center' })
      }
    }
    // X 轴类别标签
    doc.font(FONT).fontSize(CHART_FONT_SIZE).fillColor(BODY_COLOR)
    doc.text(cats[ci] ?? '', groupX, plotY + plotH + 3, { width: catW, align: 'center' })
  })
  doc.restore()
}

/**
 * 绘制折线图：第一列为 X 轴类别，其余列为数据系列。
 * @param doc     pdfkit 文档
 * @param x       图表区左上角 x
 * @param y       图表区左上角 y
 * @param w       图表区宽度
 * @param h       图表区高度
 * @param accent  主题色
 * @param head    表头
 * @param rows    数据行
 */
function drawLineChart(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: string,
  head: string[],
  rows: string[][],
): void {
  const cats = rows.map((r) => stripInline(r[0] ?? ''))
  const seriesCount = Math.max(head.length - 1, 1)
  let maxVal = 0
  for (const r of rows) {
    for (let c = 1; c < r.length; c++) maxVal = Math.max(maxVal, toNum(r[c] ?? ''))
  }
  if (maxVal <= 0) maxVal = 1
  const colors = seriesColors(accent, seriesCount)

  drawLegend(doc, x, y, head.slice(1).map((s) => stripInline(s)), colors)

  const { plotX, plotY, plotH, catW } = setupAxes(doc, x, y, w, h, cats, maxVal)

  doc.save()
  // 逐系列画折线 + 数据点
  for (let s = 0; s < seriesCount; s++) {
    const c = colors[s] ?? colors[0] ?? accent
    doc.strokeColor(c).lineWidth(1.4)
    doc.moveTo(plotX + (catW / 2), plotY + plotH - (toNum(rows[0]?.[s + 1] ?? '') / maxVal) * plotH)
    rows.forEach((r, ci) => {
      const v = toNum(r[s + 1] ?? '')
      const px = plotX + ci * catW + catW / 2
      const py = plotY + plotH - (v / maxVal) * plotH
      doc.lineTo(px, py)
    })
    doc.stroke()
    // 数据点（小圆点）
    rows.forEach((r, ci) => {
      const v = toNum(r[s + 1] ?? '')
      const px = plotX + ci * catW + catW / 2
      const py = plotY + plotH - (v / maxVal) * plotH
      doc.circle(px, py, 2.2).fill(c)
    })
  }
  // X 轴类别标签
  cats.forEach((cat, ci) => {
    doc.font(FONT).fontSize(CHART_FONT_SIZE).fillColor(BODY_COLOR)
    doc.text(cat, plotX + ci * catW, plotY + plotH + 3, { width: catW, align: 'center' })
  })
  doc.restore()
}

// ─────────── 渲染 ───────────

/**
 * 把 Markdown 正文渲染为 PDF Buffer。
 *
 * @param md  Markdown 正文
 * @param opts 标题 / 模板 / 主题色等
 * @returns PDF 文件 Buffer（可直接 writeFile 落盘）
 */
export async function markdownToPdf(md: string, opts: PdfRenderOptions): Promise<Buffer> {
  // 探测系统中文字体（fontkit 取出的子字体对象）
  const cjk = loadCJKFonts()

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: MARGIN_TOP, bottom: MARGIN_BOTTOM, left: MARGIN_X, right: MARGIN_X },
    info: { Title: opts.title, Author: 'OmniAgent report_export' },
    bufferPages: true,
  })

  // 收集流式输出为 Buffer
  const chunks: Buffer[] = []
  const done = new Promise<Buffer>((resolve) => {
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => { resolve(Buffer.concat(chunks)) })
  })

  // 注册字体：中文用嵌入字体（常规 + 粗体）；没有则降级标准 Helvetica
  const hasCJK = cjk !== null
  if (hasCJK) {
    doc.registerFont(FONT, cjk.regular as never)
    doc.registerFont(FONT_BOLD, cjk.bold as never)
  } else {
    // pdfkit 内置标准字体名
    doc.registerFont(FONT, 'Helvetica')
    doc.registerFont(FONT_BOLD, 'Helvetica-Bold')
  }

  /** 恢复正文排版状态（页脚绘制后会污染字体/字号/颜色）。 */
  const resetBodyStyle = () => {
    doc.font(FONT).fontSize(BODY_SIZE).fillColor(BODY_COLOR)
  }

  // ── 页脚页码（每页底部居中） ──
  // 注意：页脚位于底部边距区，若直接 text() 会被 pdfkit 判定为溢出而自动翻页，
  // 进而再次触发 pageAdded → 递归。这里临时把底部边距收小，使页脚落在可绘制区内。
  const drawFooter = () => {
    const n = doc.bufferedPageRange().count
    const savedBottom = doc.page.margins.bottom
    doc.page.margins.bottom = 16
    doc.font(FONT).fontSize(8).fillColor(FAINT_COLOR)
    doc.text(`- ${n} -`, MARGIN_X, PAGE_H - 36, { width: CONTENT_W, align: 'center' })
    doc.page.margins.bottom = savedBottom
    resetBodyStyle()
  }
  drawFooter() // 首页页脚
  doc.on('pageAdded', () => { drawFooter() })

  // ── 顶部横幅（与 HTML 模板 .banner 对齐） ──
  let y = MARGIN_TOP
  // 主题色左边条
  doc.save()
  doc.rect(MARGIN_X, y, 4, 52).fill(opts.accent)
  doc.restore()
  // 模板标签（小字号、主题色、字距感）
  doc.font(FONT).fontSize(10).fillColor(opts.accent).text(opts.templateLabel, MARGIN_X + 14, y, { width: CONTENT_W - 14 })
  // 标题（粗体）
  doc.font(FONT_BOLD).fontSize(20).fillColor(DARK_COLOR).text(opts.title, MARGIN_X + 14, doc.y + 2, { width: CONTENT_W - 14 })
  // 导出时间
  doc.font(FONT).fontSize(9).fillColor(MUTED_COLOR).text(`导出时间 ${new Date().toISOString()} · 由 OmniAgent report_export 生成`, MARGIN_X + 14, doc.y + 2, { width: CONTENT_W - 14 })
  y = doc.y + 18

  // 降级说明：无中文字体时在正文前提示
  if (!hasCJK) {
    doc.font(FONT).fontSize(9).fillColor('#b45309').text(
      '注意：未检测到可用中文字体文件，当前 PDF 仅拉丁字符可正常显示；中文可能显示为空白。请在系统中安装 Noto Sans CJK / Droid Sans Fallback 等中文字体。',
      MARGIN_X, y, { width: CONTENT_W },
    )
    y = doc.y + 10
  }

  resetBodyStyle()

  // ── 逐块渲染 ──
  const blocks = parseBlocks(md)
  for (const b of blocks) {
    // 换页保护：大块（图片/图表约需 220pt，表格按行数估算）需要更多页底空间
    const reserve = b.t === 'image' || b.t === 'chart' ? CHART_H + 30
      : b.t === 'table' ? (b.rows.length + 1) * 20 + 20
      : 80
    if (y > PAGE_H - MARGIN_BOTTOM - reserve) {
      doc.addPage()
      y = MARGIN_TOP
      resetBodyStyle()
    }

    switch (b.t) {
      case 'h': {
        const size = b.level <= 1 ? 17 : b.level === 2 ? 14.5 : b.level === 3 ? 12.5 : 11.5
        doc.font(FONT_BOLD).fontSize(size).fillColor(DARK_COLOR)
        doc.text(stripInline(b.text), MARGIN_X, y, { width: CONTENT_W })
        y = doc.y + 4
        // h2 加一条底部分割线（与 HTML h2 border-bottom 对齐）
        if (b.level <= 2) {
          doc.save()
          doc.moveTo(MARGIN_X, y).lineTo(MARGIN_X + CONTENT_W, y).lineWidth(0.8).strokeColor(BORDER_COLOR).stroke()
          doc.restore()
          y += 8
        } else {
          y += 4
        }
        resetBodyStyle()
        break
      }
      case 'p': {
        resetBodyStyle()
        doc.text(b.text, MARGIN_X, y, { width: CONTENT_W, lineGap: 2 })
        y = doc.y + 8
        break
      }
      case 'li': {
        resetBodyStyle()
        // 悬挂缩进：项目符号 + 文本
        doc.text('•', MARGIN_X, y, { width: 16 })
        doc.text(b.text, MARGIN_X + 16, y, { width: CONTENT_W - 16, lineGap: 2 })
        y = doc.y + 5
        break
      }
      case 'hr': {
        doc.save()
        doc.moveTo(MARGIN_X, y + 4).lineTo(MARGIN_X + CONTENT_W, y + 4).lineWidth(0.6).strokeColor(BORDER_COLOR).stroke()
        doc.restore()
        y += 14
        break
      }
      case 'code': {
        resetBodyStyle()
        const pad = 10
        const fontSize = 9
        doc.font(FONT).fontSize(fontSize)
        const h = doc.heightOfString(b.text, { width: CONTENT_W - pad * 2 }) + pad * 2
        // 深色背景块
        doc.save()
        doc.roundedRect(MARGIN_X, y, CONTENT_W, h, 4).fill(CODE_BG)
        doc.restore()
        doc.fillColor(CODE_FG).text(b.text, MARGIN_X + pad, y + pad, { width: CONTENT_W - pad * 2 })
        y += h + 10
        resetBodyStyle()
        break
      }
      case 'table': {
        resetBodyStyle()
        const cols = Math.max(b.head.length, ...b.rows.map((r) => r.length))
        const colW = CONTENT_W / Math.max(cols, 1)
        const PAD_Y = 5
        // 按每个单元格在本列宽度内的实际换行高度取最大值，避免长文本
        // （如「计算口径」列）换行后与下一行边框/文字重叠。
        const rowHeight = (cells: string[]): number => {
          doc.font(FONT).fontSize(9.5)
          let h = 20
          cells.forEach((cell) => {
            const w = colW - 10
            const measured = doc.heightOfString(stripInline(cell), { width: w })
            h = Math.max(h, measured + PAD_Y * 2)
          })
          return h
        }
        const drawRow = (cells: string[], rowY: number, rowH: number, isHead: boolean) => {
          if (isHead) {
            doc.save()
            doc.rect(MARGIN_X, rowY, CONTENT_W, rowH).fill('#f8fafc')
            doc.restore()
          }
          // 边框
          doc.save()
          doc.rect(MARGIN_X, rowY, CONTENT_W, rowH).lineWidth(0.6).strokeColor(BORDER_COLOR).stroke()
          doc.restore()
          doc.font(FONT).fontSize(9.5).fillColor(isHead ? DARK_COLOR : BODY_COLOR)
          cells.forEach((cell, i) => {
            doc.text(stripInline(cell), MARGIN_X + 6 + i * colW, rowY + PAD_Y, { width: colW - 10 })
          })
        }
        const headH = rowHeight(b.head)
        drawRow(b.head, y, headH, true)
        y += headH
        for (const r of b.rows) {
          const rh = rowHeight(r)
          // 行高可能超过页底剩余空间时翻页，避免单行表格被跨页截断。
          if (y + rh > PAGE_H - MARGIN_BOTTOM) { doc.addPage(); y = MARGIN_TOP; resetBodyStyle() }
          drawRow(r, y, rh, false)
          y += rh
        }
        y += 10
        resetBodyStyle()
        break
      }
      case 'image': {
        resetBodyStyle()
        const buf = await loadImageBuffer(b.src)
        if (buf === null) {
          // 加载失败：绘制占位框 + 提示文字，不中断 PDF 生成
          doc.save()
          doc.roundedRect(MARGIN_X, y, CONTENT_W, 60, 4).lineWidth(0.8).strokeColor(FAINT_COLOR).dash(3, { gap: 3 }).stroke()
          doc.undash()
          doc.restore()
          doc.font(FONT).fontSize(9.5).fillColor(MUTED_COLOR)
          doc.text(`[图片加载失败] ${b.alt || b.src}`, MARGIN_X, y + 24, { width: CONTENT_W, align: 'center' })
          y += 70
        } else {
          // 读取图片原始宽高，按内容区宽度等比缩放，限高
          let dispW = CONTENT_W
          let dispH = IMAGE_MAX_H
          try {
            const im = (doc as unknown as { openImage(s: Buffer): { width: number; height: number } }).openImage(buf)
            const natW = im.width || CONTENT_W
            const natH = im.height || IMAGE_MAX_H
            dispW = Math.min(CONTENT_W, natW)
            dispH = (natH * dispW) / natW
            if (dispH > IMAGE_MAX_H) { dispH = IMAGE_MAX_H; dispW = (natW * dispH) / natH }
          } catch {
            // 读不到尺寸则按内容区宽、默认高度绘制
          }
          // 水平居中绘制图片
          const imgX = MARGIN_X + (CONTENT_W - dispW) / 2
          doc.image(buf, imgX, y, { width: dispW, height: dispH })
          y += dispH + 4
          // 图注（alt 文本，小字号灰色居中）
          if (b.alt.trim().length > 0) {
            doc.font(FONT).fontSize(9).fillColor(MUTED_COLOR)
            doc.text(b.alt.trim(), MARGIN_X, y, { width: CONTENT_W, align: 'center' })
            y = doc.y + 8
          } else {
            y += 8
          }
        }
        resetBodyStyle()
        break
      }
      case 'chart': {
        resetBodyStyle()
        if (b.chartType === 'bar') drawBarChart(doc, MARGIN_X, y, CONTENT_W, CHART_H, opts.accent, b.head, b.rows)
        else drawLineChart(doc, MARGIN_X, y, CONTENT_W, CHART_H, opts.accent, b.head, b.rows)
        y += CHART_H + 12
        resetBodyStyle()
        break
      }
    }
  }

  // 末页页脚说明
  resetBodyStyle()
  {
    const savedBottom = doc.page.margins.bottom
    doc.page.margins.bottom = 16
    doc.font(FONT).fontSize(8).fillColor(FAINT_COLOR)
    doc.text('本报告由 OmniAgent 自动生成，内容仅供参考。', MARGIN_X, PAGE_H - 50, { width: CONTENT_W, align: 'center' })
    doc.page.margins.bottom = savedBottom
  }

  doc.end()
  return done
}
