import { describe, expect, it } from 'vitest'
import { replacePastedImageReferences } from './pastedImages'

describe('pasted image reference rewrites', () => {
  it('updates only matching Markdown image destinations', () => {
    const result = replacePastedImageReferences(
      '![one](Pictures/guide/1.png)\n[ordinary](Pictures/guide/1.png)\n![two](<Pictures/guide/1.png> "caption")',
      'Pictures/guide/1.png',
      'Pictures/guide/diagram.png',
    )
    expect(result.count).toBe(2)
    expect(result.source).toContain('![one](Pictures/guide/diagram.png)')
    expect(result.source).toContain('[ordinary](Pictures/guide/1.png)')
    expect(result.source).toContain('![two](<Pictures/guide/diagram.png> "caption")')
  })

  it('does not rewrite an image-looking string in a fenced code block', () => {
    const result = replacePastedImageReferences(
      '```md\n![x](Pictures/guide/1.png)\n```\n![x](Pictures/guide/1.png)',
      'Pictures/guide/1.png',
      'Pictures/guide/2.png',
    )
    expect(result.count).toBe(1)
    expect(result.source).toContain('```md\n![x](Pictures/guide/1.png)\n```')
    expect(result.source).toMatch(/!\[x\]\(Pictures\/guide\/2\.png\)$/)
  })
})
