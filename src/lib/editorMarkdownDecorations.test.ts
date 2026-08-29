import { describe, expect, it } from 'vitest'
import { editorImageReferences, markdownLineClass } from './editorMarkdownDecorations'

describe('editor Markdown line semantics', () => {
  it.each([
    ['---', 'cm-md-frontmatter-boundary'],
    ['title: Draft', 'cm-md-frontmatter-value'],
    ['```ts', 'cm-md-code-fence'],
    ['---   ', 'cm-md-rule'],
    ['> Quote', 'cm-md-quote'],
    ['- [x] Done', 'cm-md-task'],
    ['1. Item', 'cm-md-list'],
  ])('classifies %s', (line, expected) => expect(markdownLineClass(line)).toBe(expected))
})

describe('editor image previews', () => {
  it('finds safe relative inline images and preserves their labels', () => {
    expect(editorImageReferences('before ![Diagram](Pictures/guide/1.png "caption") after')).toEqual([
      { alt: 'Diagram', path: 'Pictures/guide/1.png', from: 7, to: 49 },
    ])
  })

  it('supports balanced destinations and ignores inline code', () => {
    expect(editorImageReferences('`![skip](a.png)` ![Chart](Pictures/guide/chart(1).png "caption")')).toEqual([
      { alt: 'Chart', path: 'Pictures/guide/chart(1).png', from: 17, to: 64 },
    ])
  })

  it('does not preview remote, anchored, or absolute destinations', () => {
    expect(editorImageReferences('![a](https://example.com/a.png) ![b](/tmp/b.png) ![c](#anchor)')).toEqual([])
  })
})
