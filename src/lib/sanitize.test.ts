import { describe, expect, it } from 'vitest'
import { sanitizeMermaidSvg } from './sanitize'

describe('Mermaid SVG sanitization', () => {
  it('preserves strict-mode foreignObject labels', () => {
    const sanitized = sanitizeMermaidSvg(
      '<svg><foreignObject><div><span class="nodeLabel"><p>Markdown Preview</p></span></div></foreignObject></svg>',
    )
    expect(sanitized).not.toContain('<foreignObject>')
    expect(sanitized).toContain('<text')
    expect(sanitized).toContain('Markdown Preview')
  })

  it('removes scripts and event handlers from SVG labels', () => {
    const sanitized = sanitizeMermaidSvg(
      '<svg onload="alert(1)"><foreignObject><div onclick="alert(1)"><script>alert(1)</script>Safe</div></foreignObject></svg>',
    )
    expect(sanitized).toContain('Safe')
    expect(sanitized).not.toContain('<script')
    expect(sanitized).not.toContain('onload')
    expect(sanitized).not.toContain('onclick')
  })
})
