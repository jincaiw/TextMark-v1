import { describe, expect, it } from 'vitest'
import { applyUpstreamDocumentTokens, UPSTREAM_DOCUMENT_TOKENS } from './designTokens'

const apply = (overrides?: { lineHeight?: number; pagePaddingHorizontal?: number }) => {
  const root = document.createElement('div')
  applyUpstreamDocumentTokens(root, 'system', overrides)
  return root.style
}

describe('reading typography tokens', () => {
  it('renders the frozen upstream values when nothing is overridden', () => {
    const style = apply()
    expect(style.getPropertyValue('--document-line-height')).toBe('1.52')
    expect(style.getPropertyValue('--document-page-padding')).toBe('32px 40px 48px')
    expect(style.getPropertyValue('--document-page-padding-horizontal')).toBe('40px')
    // 15px × 1.52 — the frozen source line height the editor and preview share.
    expect(style.getPropertyValue('--document-source-line-height')).toBe('22.8px')
    expect(UPSTREAM_DOCUMENT_TOKENS.sourceLineHeight).toBe(22.8)
  })

  it('drives the body, the gutter and the shared source line height together', () => {
    const style = apply({ lineHeight: 2, pagePaddingHorizontal: 72 })
    expect(style.getPropertyValue('--document-line-height')).toBe('2')
    expect(style.getPropertyValue('--document-page-padding')).toBe('32px 72px 48px')
    expect(style.getPropertyValue('--document-page-padding-horizontal')).toBe('72px')
    // Without this the preview's blank-line spacers would no longer be one text
    // line tall, and edit/read vertical rhythm would drift apart.
    expect(style.getPropertyValue('--document-source-line-height')).toBe('30px')
  })

  it('accepts the reading line height of zero gutters', () => {
    expect(apply({ pagePaddingHorizontal: 0 }).getPropertyValue('--document-page-padding')).toBe('32px 0px 48px')
  })

  it('ignores non-numeric overrides rather than writing NaN into the tokens', () => {
    const style = apply({ lineHeight: Number.NaN, pagePaddingHorizontal: Number.NaN })
    expect(style.getPropertyValue('--document-line-height')).toBe('1.52')
    expect(style.getPropertyValue('--document-page-padding-horizontal')).toBe('40px')
  })
})
