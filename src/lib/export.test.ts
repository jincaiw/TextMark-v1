// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { buildSelfContainedHtml, pdfSourceSliceHeight } from './export'

describe('self-contained HTML export', () => {
  it('keeps rendered content and data images while removing screen-only controls', async () => {
    document.documentElement.lang = 'zh-CN'
    const root = document.createElement('article')
    root.className = 'markdown-body'
    root.innerHTML =
      '<h1>导出</h1><img alt="local" src="data:image/png;base64,AA=="><button class="copy-code-button">Copy</button><mark class="search-match">命中</mark>'
    document.body.append(root)
    const html = await buildSelfContainedHtml('示例.md', root)
    expect(html).toContain('<html lang="zh-CN">')
    expect(html).toContain('data:image/png;base64,AA==')
    expect(html).toContain("default-src 'none'")
    expect(html).not.toContain('copy-code-button">Copy')
    expect(html).not.toContain('search-match">命中')
    root.remove()
  })
})

describe('PDF pagination', () => {
  it('uses page geometry rather than full document height for source slices', () => {
    expect(pdfSourceSliceHeight(2000, 500, 700)).toBe(2800)
    expect(pdfSourceSliceHeight(1000, 500, 700)).toBe(1400)
  })
})
