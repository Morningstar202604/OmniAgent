/**
 * Regression lock for the Markdown renderer's XSS surface.
 *
 * The renderer treats raw HTML as literal text (it never re-parses authored
 * HTML into the DOM) and allowlists link/image protocols. These tests pin that
 * contract: hostile markup is neutralized while ordinary links, images, tables
 * and code keep rendering. They run on Node via `react-dom/server`, so no DOM
 * (jsdom/happy-dom) is required.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MarkdownText } from '../src/markdown/MarkdownText.tsx'
import type { MarkdownLabels } from '../src/markdown/render.tsx'

const labels: MarkdownLabels = {
  code: { copyLabel: 'Copy', copiedLabel: 'Copied' },
  footnotes: 'Footnotes',
}

function render(text: string): string {
  return renderToStaticMarkup(<MarkdownText text={text} labels={labels} />)
}

describe('markdown XSS surface', () => {
  it('renders a raw <script> block as escaped text, not executable markup', () => {
    const out = render('<script>alert(1)</script>')
    expect(out).not.toMatch(/<script\b/i)
    expect(out).toContain('&lt;script&gt;')
  })

  it('does not mount an <img> carrying an onerror handler from raw HTML', () => {
    const out = render('<img src=x onerror=alert(1)>')
    // No real <img> element is mounted: the whole tag survives only as
    // escaped, inert visible text (&lt;img ... &gt;), so onerror never becomes
    // a live attribute.
    expect(out).not.toMatch(/<img\b/i)
    expect(out).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('drops javascript: link destinations instead of emitting a live href', () => {
    const out = render('[click me](javascript:alert(1))')
    expect(out).not.toMatch(/href=["']javascript:/i)
    expect(out).not.toContain('javascript:')
    // The link text still renders; the anchor itself is unwrapped.
    expect(out).toContain('click me')
  })

  it('preserves ordinary https links', () => {
    const out = render('[ok](https://example.com/page)')
    expect(out).toContain('href="https://example.com/page"')
    expect(out).toContain('noopener')
  })

  it('preserves ordinary https images', () => {
    const out = render('![alt text](https://example.com/a.png)')
    expect(out).toContain('src="https://example.com/a.png"')
    expect(out).toContain('alt="alt text"')
  })

  it('drops case-obfuscated javascript: link destinations', () => {
    const out = render('[x](JaVaScRiPt:alert(1))')
    expect(out).not.toMatch(/href=["']/i)
    expect(out).not.toContain('alert(1)')
    expect(out).toContain('x')
  })

  it('escapes raw <iframe> markup as inert text', () => {
    const out = render('<iframe src="https://evil.example"></iframe>')
    expect(out).not.toMatch(/<iframe\b/i)
    expect(out).toContain('&lt;iframe')
  })

  it('blocks data:/blob: image destinations that bypass the remote allowlist', () => {
    const out = render('![x](data:text/html,<script>alert(1)</script>)')
    expect(out).not.toMatch(/<img\b/i)
  })

  it('keeps ordinary GFM tables, fenced code and headings rendering', () => {
    const out = render([
      '# Title',
      '',
      '| a | b |',
      '| - | - |',
      '| 1 | 2 |',
      '',
      '```ts',
      'const x: number = 1',
      '```',
    ].join('\n'))
    expect(out).toContain('<h1')
    expect(out).toContain('<table')
    expect(out).toContain('<pre')
    expect(out).toContain('const x: number = 1')
  })
})
