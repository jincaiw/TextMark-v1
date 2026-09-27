import { describe, expect, it } from 'vitest'
import {
  editorImageReferences,
  markdownFrontmatterLines,
  markdownLineClass,
  markdownSyntaxMarkers,
  markdownTableLines,
} from './editorMarkdownDecorations'

describe('editor Markdown line semantics', () => {
  it.each([
    ['---', 'cm-md-rule'],
    ['title: Draft', ''],
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

  it('marks the header, separator, and body rows of a GFM table', () => {
    expect(markdownTableLines('Before\n| A | B |\n| --- | --- |\n| one | two |\n\nAfter')).toEqual(new Set([2, 3, 4]))
  })

  it('supports tables without outer pipes and ignores escaped inline pipes', () => {
    expect(markdownTableLines('A | B\n:--- | ---:\none | two\n\ntext with a \\| pipe')).toEqual(new Set([1, 2, 3]))
  })
})

describe('editor frontmatter styling', () => {
  it('styles only the metadata block at the beginning of a valid document', () => {
    expect(markdownFrontmatterLines('---\ntitle: Draft\ntags: [a, b]\n---\nBody\n---')).toEqual(
      new Map([
        [1, 'cm-md-frontmatter-boundary'],
        [2, 'cm-md-frontmatter-value'],
        [3, 'cm-md-frontmatter-value'],
        [4, 'cm-md-frontmatter-boundary'],
      ]),
    )
  })

  it('leaves ordinary key-value prose and horizontal rules alone', () => {
    expect(markdownFrontmatterLines('# Heading\n\nstatus: shipped\n\n---')).toEqual(new Map())
  })
})

describe('inactive Markdown syntax markers', () => {
  it('marks structural punctuation without marking content', () => {
    expect(markdownSyntaxMarkers('  ## Heading')).toEqual([{ from: 2, to: 4, className: 'cm-md-syntax-marker' }])
    expect(markdownSyntaxMarkers('- [x] Done')).toEqual([
      { from: 0, to: 1, className: 'cm-md-list-marker' },
      { from: 2, to: 5, className: 'cm-md-task-marker cm-md-task-checked' },
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

  it('marks inline wrappers so inactive lines can display as formatted text', () => {
    expect(markdownSyntaxMarkers('**bold** and `code`')).toEqual([
      { from: 0, to: 2, className: 'cm-md-inline-syntax' },
      { from: 6, to: 8, className: 'cm-md-inline-syntax' },
      { from: 13, to: 14, className: 'cm-md-inline-syntax' },
      { from: 18, to: 19, className: 'cm-md-inline-syntax' },
    ])
  })

  it('marks link destination syntax while retaining the label', () => {
    expect(markdownSyntaxMarkers('[guide](https://example.com)')).toEqual([
      { from: 0, to: 1, className: 'cm-md-inline-syntax' },
      { from: 6, to: 28, className: 'cm-md-inline-syntax' },
    ])
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
