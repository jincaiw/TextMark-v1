import { describe, expect, it } from 'vitest'
import { markdown } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import {
  editorImageReferences,
  markdownFrontmatterLines,
  markdownAlertLines,
  markdownLineClass,
  markdownMathLines,
  markdownTableAlignmentMap,
  markdownSyntaxMarkers,
  markdownTableCellRanges,
  markdownTableLines,
  createEditorMarkdownDecorations,
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

  it('returns source offsets for table cells without changing escaped pipes', () => {
    expect(markdownTableCellRanges('| Name | Value |')).toEqual([
      { from: 1, to: 7 },
      { from: 8, to: 15 },
    ])
    expect(markdownTableCellRanges('left \\| literal | right')).toEqual([
      { from: 0, to: 16 },
      { from: 17, to: 23 },
    ])
    expect(markdownTableCellRanges('plain text')).toEqual([])
    expect(markdownTableCellRanges('| A |  | C |')).toHaveLength(3)
  })

  it('maps left, center, and right separator alignment to each source row', () => {
    expect(markdownTableAlignmentMap('| L | C | R |\n| :--- | :---: | ---: |\n| a | b | c |')).toEqual(
      new Map([
        [1, ['left', 'center', 'right']],
        [3, ['left', 'center', 'right']],
      ]),
    )
  })
})

describe('editor code block presentation', () => {
  it('renders indented code as a code card without applying inline Markdown styling', () => {
    const source = 'Before\n\n    **code text**\n    second line\n\nAfter'
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: source,
        extensions: [markdown(), createEditorMarkdownDecorations()],
      }),
    })
    try {
      expect(view.dom.querySelectorAll('.cm-md-code-card')).toHaveLength(1)
      const codeLine = [...view.dom.querySelectorAll<HTMLElement>('.cm-md-code-line')].find((line) =>
        line.textContent?.includes('code text'),
      )
      expect(codeLine).toBeDefined()
      expect(codeLine?.querySelector('.cm-md-emphasis')).toBeNull()
    } finally {
      view.destroy()
    }
  })

  it('renders quoted fences as code and styles nested emphasis and alerts without leaking quote markers', () => {
    const source = [
      '> 外层引用。',
      '>',
      '> > 内层引用 **加粗** 与 `代码`。',
      '>',
      '> ```text',
      '> **代码内容不应加粗**',
      '> ```',
      '',
      '> [!WARNING]',
      '> 请检查这个提示。',
    ].join('\n')
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: source,
        extensions: [markdown(), createEditorMarkdownDecorations()],
      }),
    })
    try {
      expect(view.dom.querySelectorAll('.cm-md-code-card')).toHaveLength(1)
      expect(view.dom.querySelectorAll('.cm-md-code-fence')).toHaveLength(2)
      expect([...view.dom.querySelectorAll('.cm-md-fence-marker')].map((marker) => marker.textContent)).toEqual(['```', '```'])
      expect(view.dom.querySelector('.cm-md-quote-alert-warning')).not.toBeNull()
      expect(view.dom.querySelector('.cm-md-admonition-marker')).not.toBeNull()
      expect(view.dom.querySelector('.cm-md-strong')?.textContent).toContain('加粗')
      const nestedQuote = [...view.dom.querySelectorAll<HTMLElement>('.cm-line')].find((line) => line.textContent?.includes('内层引用'))
      expect(nestedQuote?.querySelectorAll('.cm-md-inline-syntax')).toHaveLength(4)
      expect(view.dom.querySelector('.cm-md-quote-alert-warning .cm-md-link')).toBeNull()
      expect(view.dom.querySelector('.cm-md-code-card .cm-md-strong')).toBeNull()
      expect(nestedQuote?.querySelectorAll('.cm-md-syntax-marker')).toHaveLength(2)
    } finally {
      view.destroy()
    }
  })
})

describe('editor alert blocks', () => {
  it('styles all consecutive quoted lines under supported alert labels', () => {
    expect(markdownAlertLines('> [!NOTE]\n> Note body\n\n> Plain quote')).toEqual(
      new Map([
        [1, 'cm-md-quote-alert cm-md-quote-alert-note'],
        [2, 'cm-md-quote-alert cm-md-quote-alert-note'],
      ]),
    )
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

describe('editor display-math source regions', () => {
  it('marks complete dollar and bracket-delimited blocks', () => {
    expect(markdownMathLines('before\n$$\nx^2\n$$\nafter\n\\[\ny = 2\n\\]')).toEqual(new Set([2, 3, 4, 6, 7, 8]))
  })

  it('marks fenced math blocks without crossing into following prose', () => {
    expect(markdownMathLines('```math\nx^2\n```\ntext')).toEqual(new Set([1, 2, 3]))
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

  it('marks every nested quote prefix without duplicating the outer marker', () => {
    expect(markdownSyntaxMarkers('> > > Nested quote')).toEqual([
      { from: 0, to: 1, className: 'cm-md-syntax-marker' },
      { from: 2, to: 3, className: 'cm-md-syntax-marker' },
      { from: 4, to: 5, className: 'cm-md-syntax-marker' },
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
