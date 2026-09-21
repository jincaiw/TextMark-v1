import { describe, expect, it } from 'vitest'
import { editorImageReferences, markdownLineClass, markdownSyntaxMarkers } from './editorMarkdownDecorations'

describe('editor Markdown line semantics', () => {
  it.each([
    ['---', 'cm-md-frontmatter-boundary'],
    ['title: Draft', 'cm-md-frontmatter-value'],
    ['```ts', 'cm-md-code-fence'],
    ['```mermaid', 'cm-md-mermaid-fence'],
    ['| A | B |', ''],
    ['| --- | --- |', 'cm-md-table'],
    ['$$', 'cm-md-math'],
    ['---   ', 'cm-md-rule'],
    ['> Quote', 'cm-md-quote'],
    ['- [x] Done', 'cm-md-task'],
    ['1. Item', 'cm-md-list'],
  ])('classifies %s', (line, expected) => expect(markdownLineClass(line)).toBe(expected))
})

describe('inactive Markdown syntax markers', () => {
  it('marks structural punctuation without marking content', () => {
    expect(markdownSyntaxMarkers('  ## Heading')).toEqual([{ from: 2, to: 4, className: 'cm-md-syntax-marker' }])
    expect(markdownSyntaxMarkers('- [x] Done')).toEqual([
      { from: 0, to: 1, className: 'cm-md-syntax-marker' },
      { from: 2, to: 5, className: 'cm-md-task-marker' },
    ])
  })

  it('marks table pipes and fence punctuation', () => {
    expect(markdownSyntaxMarkers('| A | B |')).toEqual([
      { from: 0, to: 1, className: 'cm-md-table-marker' },
      { from: 4, to: 5, className: 'cm-md-table-marker' },
      { from: 8, to: 9, className: 'cm-md-table-marker' },
    ])
    expect(markdownSyntaxMarkers('```mermaid')).toEqual([{ from: 0, to: 3, className: 'cm-md-fence-marker' }])
  })
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
