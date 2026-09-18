import { describe, expect, it } from 'vitest'
import { pastedImageRenameTarget, replacePastedImageReferences } from './pastedImages'

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

  it('preserves line endings and ignores inline code and longer nested fence markers', () => {
    const source =
      '`![inline](Pictures/guide/1.png)`\r\n````md\r\n![nested](Pictures/guide/1.png)\r\n```\r\n````\r\n![real](Pictures/guide/1.png)'
    const result = replacePastedImageReferences(source, 'Pictures/guide/1.png', 'Pictures/guide/diagram.png')
    expect(result.count).toBe(1)
    expect(result.source).toContain('`![inline](Pictures/guide/1.png)`\r\n')
    expect(result.source).toContain('![nested](Pictures/guide/1.png)\r\n')
    expect(result.source).toMatch(/!\[real\]\(Pictures\/guide\/diagram\.png\)$/)
  })

  it('rewrites balanced and angle-bracket destinations with titles', () => {
    const previous = 'Pictures/guide/chart(1).png'
    const source = '![one](Pictures/guide/chart(1).png "title")\n![two](<Pictures/guide/chart(1).png> "title")'
    const result = replacePastedImageReferences(source, previous, 'Pictures/guide/chart.png')
    expect(result.count).toBe(2)
    expect(result.source).toBe('![one](Pictures/guide/chart.png "title")\n![two](<Pictures/guide/chart.png> "title")')
  })

  it('builds only safe sibling PNG rename targets', () => {
    expect(pastedImageRenameTarget('Pictures/guide/1.png', 'diagram.png')).toBe('Pictures/guide/diagram.png')
    expect(pastedImageRenameTarget('Pictures/guide/1.png', '../escape')).toBeNull()
    expect(pastedImageRenameTarget('1.png', 'diagram')).toBeNull()
  })
})
