// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { toBlob } from 'html-to-image'
import {
  alignedPdfSliceHeight,
  buildPngExport,
  buildSelfContainedHtml,
  pdfPageBreakPositions,
  pdfSourceSliceHeight,
  rasterPixelRatio,
} from './export'

vi.mock('html-to-image', () => ({ toBlob: vi.fn() }))

const mockedToBlob = vi.mocked(toBlob)

afterEach(() => {
  mockedToBlob.mockReset()
  document.body.replaceChildren()
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.removeAttribute('style')
})

describe('self-contained HTML export', () => {
  it('keeps rendered content and data images while removing screen-only controls', async () => {
    document.documentElement.lang = 'zh-CN'
    const style = document.createElement('style')
    style.textContent = '.injected-export-style{color:rgb(1,2,3)}'
    document.head.append(style)
    const root = document.createElement('article')
    root.className = 'markdown-body'
    root.innerHTML =
      '<h1>导出</h1><img alt="local" src="data:image/png;base64,AA=="><img alt="missing" src=""><button class="copy-code-button">Copy</button><mark class="search-match">命中</mark>'
    document.body.append(root)
    const html = await buildSelfContainedHtml('示例.md', root)
    expect(html).toContain('<html lang="zh-CN">')
    expect(html).toContain('data:image/png;base64,AA==')
    expect(html).toContain('.injected-export-style')
    expect(html).toContain('<img alt="missing" class="asset-error">')
    expect(html).toContain("default-src 'none'")
    expect(html).not.toContain('copy-code-button">Copy')
    expect(html).not.toContain('search-match">命中')
    root.remove()
    style.remove()
  })
})

describe('PDF pagination', () => {
  it('uses page geometry rather than full document height for source slices', () => {
    expect(pdfSourceSliceHeight(2000, 500, 700)).toBe(2800)
    expect(pdfSourceSliceHeight(1000, 500, 700)).toBe(1400)
  })
  it('aligns a page break to the latest block boundary without creating a tiny page', () => {
    expect(alignedPdfSliceHeight([300, 580, 720], 0, 600, 1_200)).toBe(580)
    expect(alignedPdfSliceHeight([100, 250], 0, 600, 1_200)).toBe(600)
    expect(alignedPdfSliceHeight([300], 600, 600, 1_100)).toBe(500)
  })
  it('keeps consecutive headings with their following content across source spacer nodes', () => {
    const root = document.createElement('article')
    const append = (tag: string, top: number, className = '') => {
      const child = document.createElement(tag)
      child.className = className
      child.getBoundingClientRect = () => ({ top }) as DOMRect
      root.append(child)
    }
    append('p', 100)
    append('div', 180, 'md-source-blank-line')
    append('h2', 200)
    append('div', 240, 'md-source-blank-line')
    append('h3', 260)
    append('div', 300, 'md-source-blank-line')
    append('figure', 320, 'diagram')
    append('p', 600)

    expect(pdfPageBreakPositions(root, 20)).toEqual([80, 180, 580])
  })
})

describe('raster dimensions', () => {
  it('keeps ordinary documents at 2x and scales long documents below dimension and area limits', () => {
    expect(rasterPixelRatio(820, 4000)).toBe(2)
    expect(rasterPixelRatio(820, 31_692)).toBeCloseTo(32_760 / 31_692)
    expect(rasterPixelRatio(820, 31_692, 2, 16_380)).toBeCloseTo(16_380 / 31_692)
    expect(rasterPixelRatio(820, 10_000, 2, 16_380, 16_777_216)).toBeCloseTo(Math.sqrt(16_777_216 / (820 * 10_000)))
    expect(rasterPixelRatio(820, 200_000, 2, 16_380, 16_777_216)).toBeCloseTo(16_380 / 200_000)
  })
})

describe('raster export appearance', () => {
  it('captures with the light palette and restores inline theme colors exactly', async () => {
    const html = document.documentElement
    const root = document.createElement('article')
    document.body.append(root)
    html.dataset.theme = 'dark'
    html.style.setProperty('--window', '#101010')
    html.style.setProperty('--document-text', '#ffffff', 'important')
    html.style.setProperty('--unrelated-export-token', 'preserved')
    mockedToBlob.mockImplementation(async () => {
      expect(html.dataset.theme).toBe('light')
      expect(html.style.getPropertyValue('--window')).toBe('')
      expect(html.style.getPropertyValue('--document-text')).toBe('')
      expect(html.style.getPropertyValue('--unrelated-export-token')).toBe('preserved')
      expect(root.classList).toContain('textmark-exporting')
      return new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' })
    })

    const result = await buildPngExport('dark.md', root)

    expect(result.name).toBe('dark@2x.png')
    expect(result.bytes).toEqual(new Uint8Array([137, 80, 78, 71]))
    expect(html.dataset.theme).toBe('dark')
    expect(html.style.getPropertyValue('--window')).toBe('#101010')
    expect(html.style.getPropertyValue('--document-text')).toBe('#ffffff')
    expect(html.style.getPropertyPriority('--document-text')).toBe('important')
    expect(html.style.getPropertyValue('--unrelated-export-token')).toBe('preserved')
    expect(root.classList).not.toContain('textmark-exporting')
    expect(mockedToBlob.mock.calls[0][1]).toMatchObject({
      imagePlaceholder: expect.stringMatching(/^data:image\/gif/),
      preferredFontFormat: 'woff2',
      skipAutoScale: true,
      style: { margin: '0' },
    })
  })

  it('restores an absent theme and all inline colors when capture fails', async () => {
    const html = document.documentElement
    const root = document.createElement('article')
    document.body.append(root)
    html.style.setProperty('--accent', '#ff0000')
    mockedToBlob.mockRejectedValue(new Error('capture failed'))

    await expect(buildPngExport('failure.md', root)).rejects.toThrow('capture failed')
    expect(html.hasAttribute('data-theme')).toBe(false)
    expect(html.style.getPropertyValue('--accent')).toBe('#ff0000')
    expect(root.classList).not.toContain('textmark-exporting')
    expect(mockedToBlob).toHaveBeenCalledTimes(3)
  })
})
