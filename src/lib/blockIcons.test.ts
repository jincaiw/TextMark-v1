import { describe, expect, it } from 'vitest'
import { blockIcon } from './blockIcons'

describe('block control icons', () => {
  it('draws a 16×16 line icon in a 24-unit viewBox with the upstream stroke', () => {
    const svg = blockIcon('copy')
    expect(svg).toContain('viewBox="0 0 24 24"')
    expect(svg).toContain('width="16" height="16"')
    expect(svg).toContain('stroke="currentColor"')
    expect(svg).toContain('stroke-width="1.6"')
    expect(svg).toContain('aria-hidden="true"')
  })
  it('uses the upstream copy, check, wrap and unwrap shapes', () => {
    expect(blockIcon('copy')).toContain('<rect x="4" y="8" width="12" height="13" rx="3"/>')
    expect(blockIcon('check')).toContain('m5 12 4 4L19 6')
    expect(blockIcon('wrap')).toContain('M4 6h16M4 11h12a4 4 0 0 1 0 8h-5')
    expect(blockIcon('unwrap')).toContain('M4 6h16M4 12h16m-4-4 4 4-4 4M4 18h7')
  })
  it('uses the upstream zoom and open-in-window shapes', () => {
    expect(blockIcon('out')).toContain('M6 12h12')
    expect(blockIcon('in')).toContain('M12 6v12M6 12h12')
    expect(blockIcon('popup')).toContain('M14 4h6v6M10 20H4v-6M20 4l-6 6M4 20l6-6')
  })
})
