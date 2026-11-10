import { describe, expect, it } from 'vitest'
import { applyUpstreamDocumentTokens, UPSTREAM_DOCUMENT_TOKENS } from './designTokens'

const apply = (overrides?: {
  lineHeight?: number
  pagePaddingHorizontal?: number
  boldText?: boolean
  readerCustomized?: boolean
  characterSpacingPercent?: number
  wordSpacingPercent?: number
  marginsPercent?: number
}) => {
  const root = document.createElement('div')
  applyUpstreamDocumentTokens(root, 'system', overrides)
  return root.style
}

describe('reading typography tokens', () => {
  it('renders the frozen upstream values when nothing is overridden', () => {
    const style = apply()
    expect(style.getPropertyValue('--document-line-height')).toBe('1.6')
    expect(style.getPropertyValue('--document-page-padding')).toBe('32px 40px 48px')
    expect(style.getPropertyValue('--document-page-padding-horizontal')).toBe('40px')
    // 15px × 1.6 — the frozen source line height the editor and preview share.
    expect(style.getPropertyValue('--document-source-line-height')).toBe('24px')
    expect(UPSTREAM_DOCUMENT_TOKENS.sourceLineHeight).toBe(24)
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
    expect(style.getPropertyValue('--document-line-height')).toBe('1.6')
    expect(style.getPropertyValue('--document-page-padding-horizontal')).toBe('40px')
  })

  it('gates the spacing sliders behind the Customize switch', () => {
    const gated = apply({ readerCustomized: false, characterSpacingPercent: 8, wordSpacingPercent: 12, marginsPercent: 50 })
    expect(gated.getPropertyValue('--document-letter-spacing')).toBe('normal')
    expect(gated.getPropertyValue('--document-word-spacing')).toBe('normal')
    expect(gated.getPropertyValue('--document-page-inset')).toBe('0px')
    const applied = apply({ readerCustomized: true, characterSpacingPercent: 8, wordSpacingPercent: 12, marginsPercent: 50 })
    expect(applied.getPropertyValue('--document-letter-spacing')).toBe('0.08em')
    expect(applied.getPropertyValue('--document-word-spacing')).toBe('0.12em')
    expect(applied.getPropertyValue('--document-page-inset')).toBe('45px')
  })

  it('shrinks the body padding for negative margins and floors it at zero', () => {
    const style = apply({ readerCustomized: true, marginsPercent: -50 })
    expect(style.getPropertyValue('--document-page-inset')).toBe('0px')
    expect(style.getPropertyValue('--document-page-padding-horizontal')).toBe('20px')
    const floored = apply({ readerCustomized: true, marginsPercent: -100 })
    expect(floored.getPropertyValue('--document-page-padding-horizontal')).toBe('0px')
  })

  it('applies the body weight only when Bold Text is on', () => {
    expect(apply().getPropertyValue('--document-font-weight')).toBe('400')
    expect(apply({ boldText: true }).getPropertyValue('--document-font-weight')).toBe('600')
  })
})
