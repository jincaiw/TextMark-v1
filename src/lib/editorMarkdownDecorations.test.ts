import { describe, expect, it } from 'vitest'
import { markdown } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import {
  editorImageReferences,
  markdownFrontmatterLines,
  markdownAlertLines,
  markdownLineClass,
  markdownListMarkerClass,
  markdownMathLines,
  markdownMathBlocks,
  markdownTableAlignmentMap,
  markdownSyntaxMarkers,
  markdownTableCellRanges,
  markdownTableLines,
  markdownDefinitionListBlocks,
  createEditorMarkdownDecorations,
} from './editorMarkdownDecorations'

describe('editor Markdown line semantics', () => {
  it('uses Typora-like bullet shapes for nested unordered lists', () => {
    expect(markdownListMarkerClass('- top level')).toBe('cm-md-list-marker cm-md-list-depth-0')
    expect(markdownListMarkerClass('  - second level')).toBe('cm-md-list-marker cm-md-list-depth-1')
    expect(markdownListMarkerClass('    - third level')).toBe('cm-md-list-marker cm-md-list-depth-2')
    expect(markdownListMarkerClass('>   - quoted nested item')).toBe('cm-md-list-marker cm-md-list-depth-1')
  })

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

  it('finds term/definition pairs while ignoring fenced examples', () => {
    const source = 'Markdown\n: A lightweight language.\n\n```md\nTerm\n: Literal example\n```\n\nRenderer\n: Converts Markdown.'
    const blocks = markdownDefinitionListBlocks(source)
    expect(blocks).toHaveLength(2)
    expect(blocks.map(({ term, definitions }) => [term, definitions.map(({ source: value }) => value)])).toEqual([
      ['Markdown', ['A lightweight language.']],
      ['Renderer', ['Converts Markdown.']],
    ])
  })
})

describe('editor definition list presentation', () => {
  it('renders definition lists and returns to the matching source when clicked', () => {
    const source = 'Markdown\n: **A lightweight language.**\n\nRenderer\n: Converts Markdown.'
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: source,
        selection: { anchor: source.length },
        extensions: [markdown(), createEditorMarkdownDecorations()],
      }),
    })
    try {
      const list = view.dom.querySelector('.cm-md-definition-list-preview')
      expect(list?.querySelector('dt')?.textContent?.trim()).toBe('Markdown')
      expect(list?.querySelector('dd strong')?.textContent).toBe('A lightweight language.')
      list?.querySelector('dd')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(view.state.selection.main.head).toBe(source.indexOf('**A lightweight language.**'))
      expect(view.dom.querySelectorAll('.cm-md-definition-list-preview')).toHaveLength(1)
      expect(view.dom.querySelector('.cm-md-definition-list-preview dt')?.textContent?.trim()).toBe('Renderer')
      expect(view.dom.textContent).toContain(': **A lightweight language.**')
    } finally {
      view.destroy()
    }
  })
})

describe('editor code block presentation', () => {
  it('opens a rendered table cell at its matching Markdown source', () => {
    const source = '| A | B |\n| --- | --- |\n| one | two |\n\nAfter'
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: source,
        selection: { anchor: source.length },
        extensions: [markdown(), createEditorMarkdownDecorations()],
      }),
    })
    try {
      const cell = view.dom.querySelector<HTMLTableCellElement>('.cm-md-table-preview tbody td')
      expect(cell?.textContent).toBe('one')
      cell?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe('one')
      expect(view.dom.querySelector('.cm-md-table-preview')).toBeNull()
    } finally {
      view.destroy()
    }
  })

  it('applies alternating visual markers to nested unordered list levels', () => {
    const source = '- top level\n  - second level\n    - third level'
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: source,
        selection: { anchor: source.length },
        extensions: [markdown(), createEditorMarkdownDecorations()],
      }),
    })
    try {
      const lineFor = (content: string) =>
        [...view.dom.querySelectorAll<HTMLElement>('.cm-line')].find((line) => line.textContent?.includes(content))
      expect(lineFor('top level')?.querySelector('.cm-md-list-marker')?.classList.contains('cm-md-list-depth-0')).toBe(true)
      expect(lineFor('second level')?.querySelector('.cm-md-list-marker')?.classList.contains('cm-md-list-depth-1')).toBe(true)
      expect(lineFor('third level')?.querySelector('.cm-md-list-marker')?.classList.contains('cm-md-list-depth-2')).toBe(true)
    } finally {
      view.destroy()
    }
  })

  it('hides active hard-break backslashes outside source editing without changing escaped text', () => {
    const source = 'Hard break\\\nNext line\nLiteral \\\\ and `inline \\\\`'
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: source,
        selection: { anchor: source.length },
        extensions: [markdown(), createEditorMarkdownDecorations()],
      }),
    })
    try {
      expect(view.dom.querySelectorAll('.cm-md-hardbreak-marker')).toHaveLength(1)
      expect(view.dom.textContent).toContain('Literal \\\\')

      const hardBreak = source.indexOf('\\\n')
      view.dispatch({ selection: { anchor: hardBreak } })
      expect(view.dom.querySelector('.cm-md-hardbreak-marker')).toBeNull()
      expect(view.dom.textContent).toContain('Hard break\\')

      view.dispatch({ selection: { anchor: 0 } })
      expect(view.dom.querySelectorAll('.cm-md-hardbreak-marker')).toHaveLength(1)
    } finally {
      view.destroy()
    }
  })

  it('renders Setext headings at heading scale and reveals underline source at the caret', () => {
    const source =
      'Setext level one\n===============\n\nSetext level two\n---------------\n\n---\n\n```md\nLiteral underline\n---------------\n```'
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: source,
        selection: { anchor: 0 },
        extensions: [markdown(), createEditorMarkdownDecorations()],
      }),
    })
    try {
      const headingOne = [...view.dom.querySelectorAll('.cm-line.cm-md-h1')].find((line) => line.textContent?.includes('Setext level one'))
      const headingTwo = [...view.dom.querySelectorAll('.cm-line.cm-md-h2')].find((line) => line.textContent?.includes('Setext level two'))
      expect(headingOne).not.toBeUndefined()
      expect(headingTwo).not.toBeUndefined()
      expect(view.dom.querySelectorAll('.cm-line.cm-md-setext-marker')).toHaveLength(2)

      view.dispatch({ selection: { anchor: source.indexOf('===============') + 3 } })
      const activeMarker = [...view.dom.querySelectorAll('.cm-line.cm-md-setext-marker')].find((line) =>
        line.classList.contains('cm-md-source-revealed'),
      )
      expect(activeMarker?.textContent).toContain('===============')
      expect(view.dom.textContent).toContain('Literal underline---------------')
    } finally {
      view.destroy()
    }
  })

  it('renders [TOC] as a linked outline, navigates headings, and reveals source at the caret', () => {
    const source = '# Guide\n\n[TOC]\n\n## First section\n\n## Second section'
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: source,
        selection: { anchor: 0 },
        extensions: [markdown(), createEditorMarkdownDecorations()],
      }),
    })
    try {
      const toc = view.dom.querySelector('.cm-md-toc-preview')
      expect(toc?.querySelectorAll('a')).toHaveLength(3)
      expect(toc?.textContent).toContain('Second section')
      const secondHeading = toc?.querySelector<HTMLAnchorElement>('a[href="#second-section"]')
      expect(secondHeading).not.toBeNull()
      secondHeading!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      expect(view.state.doc.lineAt(view.state.selection.main.head).text).toBe('## Second section')
      expect(view.dom.querySelector('.cm-md-toc-preview')).not.toBeNull()

      const firstHeading = source.indexOf('First section')
      view.dispatch({ changes: { from: firstHeading, to: firstHeading + 'First section'.length, insert: 'Renamed section' } })
      expect(view.dom.querySelector('.cm-md-toc-preview')?.textContent).toContain('Renamed section')

      view.dispatch({ selection: { anchor: source.indexOf('[TOC]') + 2 } })
      expect(view.dom.querySelector('.cm-md-toc-preview')).toBeNull()
      expect(view.dom.textContent).toContain('[TOC]')
    } finally {
      view.destroy()
    }
  })

  it('renders GFM tables as semantic tables and restores cell source on entry', () => {
    const source = [
      'Before',
      '',
      '| Left | Center | Right |',
      '| :--- | :---: | ---: |',
      '| a \\| b | **bold** | 12 |',
      '',
      '```markdown',
      '| Code | Sample |',
      '| --- | --- |',
      '```',
    ].join('\n')
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: source,
        selection: { anchor: 0 },
        extensions: [markdown(), createEditorMarkdownDecorations()],
      }),
    })
    try {
      const preview = view.dom.querySelector('.cm-md-table-preview')
      expect(preview?.querySelector('table')).not.toBeNull()
      expect(preview?.querySelectorAll('th')).toHaveLength(3)
      expect(
        [...preview!.querySelectorAll('th')].map((cell) => [...cell.classList].find((name) => name.startsWith('md-table-align-'))),
      ).toEqual(['md-table-align-left', 'md-table-align-center', 'md-table-align-right'])
      expect(preview?.querySelector('strong')?.textContent).toBe('bold')
      expect(view.dom.querySelectorAll('.cm-md-table-preview')).toHaveLength(1)

      preview?.querySelector('tbody td')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      const cellSelection = view.state.selection.main
      expect(view.state.sliceDoc(cellSelection.from, cellSelection.to)).toBe('a \\| b')
      expect(view.dom.querySelector('.cm-md-table-preview')).toBeNull()

      view.dispatch({ selection: { anchor: source.indexOf('Center') + 2 } })
      expect(view.dom.querySelector('.cm-md-table-preview')).toBeNull()
      expect(view.dom.textContent).toContain('| Left | Center | Right |')

      view.dispatch({ selection: { anchor: source.indexOf('Before') } })
      expect(view.dom.querySelector('.cm-md-table-preview')).not.toBeNull()
      const keyboardCell = view.dom.querySelector<HTMLTableCellElement>('.cm-md-table-preview tbody tr:last-child td:last-child')
      expect(keyboardCell?.tabIndex).toBe(0)
      keyboardCell?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      const keyboardSelection = view.state.selection.main
      expect(view.state.sliceDoc(keyboardSelection.from, keyboardSelection.to)).toBe('12')
    } finally {
      view.destroy()
    }
  })

  it('renders safe standalone HTML containers and restores editable source on entry', () => {
    const source = [
      'Before',
      '',
      '<div style="border: 1px solid #888; padding: 0.75em;">',
      '<strong>HTML block:</strong> safely rendered.',
      '<script>window.compromised = true</script>',
      '</div>',
      '',
      'After',
      '',
      '```html',
      '<div>Code sample, not an HTML block</div>',
      '```',
    ].join('\n')
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: source,
        selection: { anchor: 0 },
        extensions: [markdown(), createEditorMarkdownDecorations()],
      }),
    })
    try {
      const preview = view.dom.querySelector('.cm-md-html-block-preview')
      expect(preview).not.toBeNull()
      expect(preview?.querySelector('strong')?.textContent).toBe('HTML block:')
      expect(preview?.querySelector('script')).toBeNull()
      expect(view.dom.querySelectorAll('.cm-md-html-block-preview')).toHaveLength(1)

      view.dispatch({ selection: { anchor: source.indexOf('<strong>') + 2 } })
      expect(view.dom.querySelector('.cm-md-html-block-preview')).toBeNull()
      expect(view.dom.textContent).toContain('<strong>HTML block:</strong>')

      view.dispatch({ selection: { anchor: source.indexOf('Before') } })
      expect(view.dom.querySelector('.cm-md-html-block-preview')).not.toBeNull()
    } finally {
      view.destroy()
    }
  })

  it('renders safe details blocks and restores their source when the caret enters', () => {
    const source = [
      'Before',
      '',
      '<details>',
      '<summary>点击展开：&amp; 信息</summary>',
      '',
      '折叠内容包含 **格式文本**：',
      '',
      '- 条目一',
      '- 条目二',
      '',
      '```html',
      '</details>',
      '<script>bad()</script>',
      '```',
      '</details>',
      '',
      'After',
    ].join('\n')
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: source,
        selection: { anchor: 0 },
        extensions: [markdown(), createEditorMarkdownDecorations()],
      }),
    })
    try {
      const preview = view.dom.querySelector<HTMLDetailsElement>('.cm-md-details-preview')
      expect(preview).not.toBeNull()
      expect(preview?.querySelector('summary')?.textContent).toBe('点击展开：& 信息')
      expect(preview?.querySelector('.cm-md-details-body strong')?.textContent).toBe('格式文本')
      expect(preview?.querySelectorAll('.cm-md-details-body li')).toHaveLength(2)
      expect(preview?.querySelector('.cm-md-details-body pre code')?.textContent).toContain('</details>')
      expect(preview?.querySelector('script')).toBeNull()

      preview!.querySelector('summary')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(preview?.open).toBe(true)

      view.dispatch({ selection: { anchor: source.indexOf('<summary>') + 3 } })
      expect(view.dom.querySelector('.cm-md-details-preview')).toBeNull()
      expect(view.dom.textContent).toContain('<details>')

      view.dispatch({ selection: { anchor: source.indexOf('Before') } })
      expect(view.dom.querySelector('.cm-md-details-preview')).not.toBeNull()
    } finally {
      view.destroy()
    }
  })

  it('renders Mermaid blocks and restores their source at the caret', () => {
    const source = 'Before\n\n```mermaid\nflowchart LR\nA-->B\n```\n\nAfter'
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: source,
        selection: { anchor: 0 },
        extensions: [markdown(), createEditorMarkdownDecorations()],
      }),
    })
    try {
      expect(view.dom.querySelector('.cm-md-mermaid-preview')).not.toBeNull()
      expect(view.dom.querySelector('.cm-md-code-card')).toBeNull()
      view.dispatch({ selection: { anchor: source.indexOf('flowchart') + 2 } })
      expect(view.dom.querySelector('.cm-md-mermaid-preview')).toBeNull()
      expect(view.dom.textContent).toContain('flowchart LR')
    } finally {
      view.destroy()
    }
  })

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

  it('collapses fenced code delimiters outside editing and restores the active fence line', () => {
    const source = 'Intro\n\n```typescript\nconst value = 1\n```\n\nAfter'
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: source,
        selection: { anchor: 0 },
        extensions: [markdown(), createEditorMarkdownDecorations()],
      }),
    })
    try {
      const openingFence = [...view.dom.querySelectorAll<HTMLElement>('.cm-md-code-fence')].find((line) =>
        line.textContent?.includes('typescript'),
      )
      const closingFence = [...view.dom.querySelectorAll<HTMLElement>('.cm-md-code-fence')].find(
        (line) => line.textContent?.includes('```') && !line.textContent?.includes('typescript'),
      )
      expect(openingFence?.classList.contains('cm-md-code-fence-editing')).toBe(false)
      expect(closingFence?.classList.contains('cm-md-code-fence-editing')).toBe(false)

      view.dispatch({ selection: { anchor: source.indexOf('typescript') + 2 } })
      expect(openingFence?.classList.contains('cm-md-code-fence-editing')).toBe(true)
      expect(closingFence?.classList.contains('cm-md-code-fence-editing')).toBe(false)
    } finally {
      view.destroy()
    }
  })

  it('renders nested quotes, code, and alerts as one preview and restores their source on entry', () => {
    const source = [
      'Intro text.',
      '',
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
        selection: { anchor: 0 },
        extensions: [markdown(), createEditorMarkdownDecorations()],
      }),
    })
    try {
      const preview = [...view.dom.querySelectorAll('.cm-md-quote-preview')].find((candidate) =>
        candidate.textContent?.includes('外层引用'),
      )
      expect(preview?.querySelector('strong')?.textContent).toContain('加粗')
      expect(preview?.querySelector('pre code')?.textContent).toContain('**代码内容不应加粗**')
      expect(preview?.textContent).not.toContain('> 外层引用')
      const nestedPreview = [...view.dom.querySelectorAll('.cm-md-quote-preview')].find((candidate) =>
        candidate.textContent?.includes('内层引用'),
      )
      expect(nestedPreview?.querySelector('blockquote blockquote')).not.toBeNull()

      view.dispatch({ selection: { anchor: source.indexOf('内层引用') + 2 } })
      expect([...view.dom.querySelectorAll('.cm-md-quote-preview')].some((candidate) => candidate.textContent?.includes('内层引用'))).toBe(
        false,
      )
      expect(view.dom.querySelectorAll('.cm-md-code-card')).toHaveLength(1)
      expect(view.dom.querySelector('.cm-md-code-card')?.classList.contains('cm-md-quote-code-card')).toBe(true)
      expect(view.dom.textContent).toContain('> > 内层引用 **加粗**')

      view.dispatch({ selection: { anchor: source.length } })
      expect([...view.dom.querySelectorAll('.cm-md-quote-preview')].some((candidate) => candidate.textContent?.includes('内层引用'))).toBe(
        true,
      )
    } finally {
      view.destroy()
    }
  })

  it('collapses redundant blank lines in rendered quote previews', () => {
    const source = 'Intro text.\n\n> first paragraph\n> \n> \n> second paragraph\n> \n> ```text\n> one\n> \n> \n> two\n> ```'
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: source,
        selection: { anchor: 0 },
        extensions: [markdown(), createEditorMarkdownDecorations()],
      }),
    })
    try {
      const preview = view.dom.querySelector('.cm-md-quote-preview')
      expect(preview?.querySelectorAll('p')).toHaveLength(2)
      expect(preview?.querySelectorAll('.md-source-blank-line')).toHaveLength(0)
      expect(preview?.querySelector('pre code')?.textContent).toContain('one\n\n\ntwo')
    } finally {
      view.destroy()
    }
  })

  it('opens the matching quote source line when rendered content is clicked', () => {
    const source = 'Intro.\n\n> first paragraph\n>\n> second paragraph\n> - list item'
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: source,
        selection: { anchor: 0 },
        extensions: [markdown(), createEditorMarkdownDecorations()],
      }),
    })
    try {
      const item = view.dom.querySelector('.cm-md-quote-preview li')
      expect(item).not.toBeNull()
      item?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(view.state.selection.main.head).toBe(source.indexOf('list item'))
      expect(view.dom.querySelector('.cm-md-quote-preview')).toBeNull()
      expect(view.dom.textContent).toContain('> - list item')
    } finally {
      view.destroy()
    }
  })

  it('keeps a quote preview indented when it belongs to a list item', () => {
    const source = '1. First item\n\n   > A nested quote'
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: source,
        selection: { anchor: 0 },
        extensions: [markdown(), createEditorMarkdownDecorations()],
      }),
    })
    try {
      const quote = view.dom.querySelector<HTMLElement>('.cm-md-quote-preview')
      expect(quote?.style.marginInlineStart).toBe('1.5em')
      expect(quote?.style.width).toBe('calc(100% - 1.5em)')
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
        [1, 'cm-md-frontmatter-boundary cm-md-frontmatter-start'],
        [2, 'cm-md-frontmatter-value'],
        [3, 'cm-md-frontmatter-value'],
        [4, 'cm-md-frontmatter-boundary cm-md-frontmatter-end'],
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

  it('returns complete display-math source ranges', () => {
    expect(markdownMathBlocks('Before\n$$\nx^2\n$$\nAfter')).toEqual([{ from: 7, to: 16, source: 'x^2' }])
  })

  it('renders inline and display math until the caret enters the source', () => {
    const source = 'Inline $x^2$ end; $E = mc^2$、$a^2 + b^2 = c^2$、$\\alpha + \\beta = \\gamma$\n\n$$\n\\int_0^1 x^2 dx\n$$'
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: source,
        selection: { anchor: 0 },
        extensions: [markdown(), createEditorMarkdownDecorations()],
      }),
    })
    try {
      expect(view.dom.querySelectorAll('.cm-md-math-preview')).toHaveLength(5)
      expect(view.dom.querySelectorAll('.cm-md-inline-semantic-sup, .cm-md-inline-semantic-sub')).toHaveLength(0)
      expect(view.dom.querySelector('.cm-md-math-preview-display .katex-display')).not.toBeNull()
      view.dispatch({ selection: { anchor: source.indexOf('x^2') + 1 } })
      expect(view.dom.querySelectorAll('.cm-md-math-preview')).toHaveLength(4)
      view.dispatch({ selection: { anchor: source.indexOf('\\int') + 2 } })
      expect(view.state.selection.main.head).toBe(source.indexOf('\\int') + 2)
      expect(view.dom.querySelectorAll('.cm-md-math-preview')).toHaveLength(4)
      expect(view.dom.textContent).toContain('$$')
    } finally {
      view.destroy()
    }
  })
})

describe('inactive Markdown syntax markers', () => {
  it('hides Markdown link destinations until the source caret enters them', () => {
    const source = '[guide](https://example.com) and <https://example.org>'
    const destinationStart = source.indexOf('https://example.com')
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: source,
        selection: { anchor: source.length },
        extensions: [markdown(), createEditorMarkdownDecorations()],
      }),
    })
    try {
      const destination = view.dom.querySelector('.cm-md-link-destination')
      expect(destination?.textContent).toBe('https://example.com')
      expect(destination?.classList.contains('cm-md-source-revealed')).toBe(false)
      expect(view.dom.querySelectorAll('.cm-md-link-destination')).toHaveLength(1)

      view.dispatch({ selection: { anchor: destinationStart + 5 } })
      expect(view.dom.querySelector('.cm-md-link-destination')?.classList.contains('cm-md-source-revealed')).toBe(true)
      expect(view.dom.querySelector('.cm-md-link')?.textContent).toContain('guide')
    } finally {
      view.destroy()
    }
  })

  it('keeps rich formatting on the caret line and reveals delimiters only when editing them', () => {
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: '## **Formatted heading**',
        selection: { anchor: 8 },
        extensions: [markdown(), createEditorMarkdownDecorations()],
      }),
    })
    try {
      expect(view.dom.querySelector('.cm-md-h2')).not.toBeNull()
      expect(view.dom.querySelector('.cm-md-strong')?.textContent).toBe('**Formatted heading**')
      const headingMarker = view.dom.querySelector('.cm-md-heading-marker')
      expect(headingMarker).not.toBeNull()
      expect(headingMarker?.classList.contains('cm-md-source-revealed')).toBe(false)
      view.dispatch({ selection: { anchor: 0 } })
      expect(view.dom.querySelector('.cm-md-heading-marker')?.classList.contains('cm-md-source-revealed')).toBe(false)
      view.dispatch({ selection: { anchor: 2 } })
      expect(view.dom.querySelector('.cm-md-heading-marker')?.classList.contains('cm-md-source-revealed')).toBe(true)
    } finally {
      view.destroy()
    }
  })

  it('reveals both inline delimiters when the caret touches either edge', () => {
    const source = '**bold**'
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: source,
        selection: { anchor: source.indexOf('bold') + 'bold'.length },
        extensions: [markdown(), createEditorMarkdownDecorations()],
      }),
    })
    try {
      const delimiters = Array.from(view.dom.querySelectorAll('.cm-md-inline-syntax'))
      expect(delimiters).toHaveLength(2)
      expect(delimiters.every((delimiter) => delimiter.classList.contains('cm-md-source-revealed'))).toBe(true)
    } finally {
      view.destroy()
    }
  })

  it('keeps heading prefixes visible while an input method is composing', () => {
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: '## 中文标题',
        selection: { anchor: 6 },
        extensions: [markdown(), createEditorMarkdownDecorations()],
      }),
    })
    try {
      Object.defineProperty(view, 'composing', { configurable: true, get: () => true })
      view.dispatch({ selection: { anchor: 5 } })
      expect(view.dom.querySelector('.cm-md-heading-marker')?.classList.contains('cm-md-source-revealed')).toBe(true)
    } finally {
      view.destroy()
    }
  })

  it('marks structural punctuation without marking content', () => {
    expect(markdownSyntaxMarkers('  ## Heading')).toEqual([{ from: 0, to: 5, className: 'cm-md-heading-marker' }])
    expect(markdownSyntaxMarkers('Hard break\\')).toEqual([{ from: 10, to: 11, className: 'cm-md-hardbreak-marker' }])
    expect(markdownSyntaxMarkers('Literal \\\\')).toEqual([
      { from: 8, to: 9, className: 'cm-md-escape-marker' },
      { from: 9, to: 10, className: 'cm-md-escaped-character' },
    ])
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
    expect(markdownSyntaxMarkers('| a \\| b | c |')).toEqual([
      { from: 0, to: 1, className: 'cm-md-table-marker' },
      { from: 4, to: 5, className: 'cm-md-escape-marker' },
      { from: 5, to: 6, className: 'cm-md-escaped-character' },
      { from: 9, to: 10, className: 'cm-md-table-marker' },
      { from: 13, to: 14, className: 'cm-md-table-marker' },
    ])
  })

  it('marks inline wrappers so inactive lines can display as formatted text', () => {
    expect(markdownSyntaxMarkers('**bold** and `code`')).toEqual([
      { from: 0, to: 2, className: 'cm-md-inline-syntax' },
      { from: 6, to: 8, className: 'cm-md-inline-syntax' },
      { from: 13, to: 14, className: 'cm-md-inline-syntax' },
      { from: 18, to: 19, className: 'cm-md-inline-syntax' },
    ])
  })

  it('hides underscore bold and triple emphasis delimiters while preserving their content', () => {
    expect(markdownSyntaxMarkers('__bold__')).toEqual([
      { from: 0, to: 2, className: 'cm-md-inline-syntax' },
      { from: 6, to: 8, className: 'cm-md-inline-syntax' },
    ])
    expect(markdownSyntaxMarkers('***bold italic***')).toEqual([
      { from: 0, to: 3, className: 'cm-md-inline-syntax' },
      { from: 14, to: 17, className: 'cm-md-inline-syntax' },
    ])
    expect(markdownSyntaxMarkers('___bold italic___')).toEqual([
      { from: 0, to: 3, className: 'cm-md-inline-syntax' },
      { from: 14, to: 17, className: 'cm-md-inline-syntax' },
    ])
  })

  it('does not interpret formatting or links inside inline code and math as Markdown wrappers', () => {
    expect(markdownSyntaxMarkers('`**code** [label](url)`')).toEqual([
      { from: 0, to: 1, className: 'cm-md-inline-syntax' },
      { from: 22, to: 23, className: 'cm-md-inline-syntax' },
    ])
    expect(markdownSyntaxMarkers('$a*b*c$ and \\(x^2\\)')).toEqual([])
  })

  it('hides emphasis around inline code while leaving code delimiters visible as a rendered span', () => {
    expect(markdownSyntaxMarkers('**bold `code`**')).toEqual([
      { from: 0, to: 2, className: 'cm-md-inline-syntax' },
      { from: 7, to: 8, className: 'cm-md-inline-syntax' },
      { from: 12, to: 13, className: 'cm-md-inline-syntax' },
      { from: 13, to: 15, className: 'cm-md-inline-syntax' },
    ])
  })

  it('hides strikethrough and highlight delimiters on inactive lines', () => {
    const source = '~~deleted~~ and ==highlight==\ncaret below'
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: source,
        selection: { anchor: source.indexOf('caret') },
        extensions: [markdown(), createEditorMarkdownDecorations()],
      }),
    })
    try {
      const markers = [...view.dom.querySelectorAll('.cm-md-inline-syntax')].filter((element) => /[=~]/.test(element.textContent ?? ''))
      expect(markers).toHaveLength(4)
      expect(markers.every((marker) => !marker.classList.contains('cm-md-source-revealed'))).toBe(true)
      expect(view.dom.querySelector('.cm-md-strikethrough')?.textContent).toBe('deleted')
    } finally {
      view.destroy()
    }
  })

  it('renders escaped punctuation without its backslash while leaving literal delimiters intact', () => {
    expect(markdownSyntaxMarkers('\\~~literal~~ and \\*literal*')).toEqual([
      { from: 0, to: 1, className: 'cm-md-escape-marker' },
      { from: 1, to: 2, className: 'cm-md-escaped-character' },
      { from: 17, to: 18, className: 'cm-md-escape-marker' },
      { from: 18, to: 19, className: 'cm-md-escaped-character' },
    ])
    expect(markdownSyntaxMarkers('`\\*literal*`')).toEqual([
      { from: 0, to: 1, className: 'cm-md-inline-syntax' },
      { from: 11, to: 12, className: 'cm-md-inline-syntax' },
    ])
    expect(markdownSyntaxMarkers('```md')).toEqual([{ from: 0, to: 3, className: 'cm-md-fence-marker' }])
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

  it('renders interactive task checkboxes and updates their Markdown source', () => {
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: '- [x] Done\n- [ ] Todo\n\nPlain text',
        selection: { anchor: 30 },
        extensions: [markdown(), createEditorMarkdownDecorations()],
      }),
    })
    try {
      const taskLines = [...view.dom.querySelectorAll<HTMLElement>('.cm-line')].filter(
        (line) => line.textContent?.includes('Done') || line.textContent?.includes('Todo'),
      )
      expect(taskLines).toHaveLength(2)
      expect(taskLines.every((line) => line.classList.contains('cm-md-task'))).toBe(true)
      expect(taskLines.every((line) => line.querySelector('.cm-md-list-marker'))).toBe(true)
      const checkboxes = [...view.dom.querySelectorAll<HTMLInputElement>('.cm-md-task-checkbox')]
      expect(checkboxes).toHaveLength(2)
      expect(checkboxes.map((checkbox) => checkbox.checked)).toEqual([true, false])
      expect(taskLines.some((line) => line.querySelector('.cm-md-link'))).toBe(false)

      checkboxes[1].click()
      expect(view.state.doc.toString()).toContain('- [x] Todo')
      expect([...view.dom.querySelectorAll<HTMLInputElement>('.cm-md-task-checkbox')].map((checkbox) => checkbox.checked)).toEqual([
        true,
        true,
      ])

      const source = view.state.doc.toString()
      view.dispatch({ selection: { anchor: source.indexOf('[x] Todo') + 1 } })
      expect(view.dom.querySelectorAll('.cm-md-task-checkbox')).toHaveLength(1)
      expect(view.dom.textContent).toContain('[x] Todo')
    } finally {
      view.destroy()
    }
  })

  it('keeps admonition labels styled as labels instead of links', () => {
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: '> [!NOTE]\n> Helpful details',
        selection: { anchor: 25 },
        extensions: [markdown(), createEditorMarkdownDecorations()],
      }),
    })
    try {
      const label = view.dom.querySelector('.cm-md-admonition-marker')
      expect(label).not.toBeNull()
      expect(label?.closest('.cm-md-link')).toBeNull()
      expect(view.dom.querySelector('.cm-md-quote-alert-note')).not.toBeNull()
    } finally {
      view.destroy()
    }
  })
})

describe('editing-mode whitespace', () => {
  it('collapses repeated blank source lines but restores the active line', () => {
    const source = '> first\n\n\n> second\n```text\none\n\n\ntwo\n```'
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: source,
        selection: { anchor: source.indexOf('second') },
        extensions: [markdown(), createEditorMarkdownDecorations()],
      }),
    })
    try {
      const blankLines = [...view.dom.querySelectorAll('.cm-line')].filter((line) => !line.textContent?.trim())
      expect(blankLines).toHaveLength(4)
      expect(blankLines.filter((line) => line.classList.contains('cm-md-blank-line-collapsed'))).toHaveLength(1)
      view.dispatch({ selection: { anchor: source.indexOf('\n\n') + 2 } })
      expect(view.dom.querySelectorAll('.cm-md-blank-line-collapsed')).toHaveLength(0)
    } finally {
      view.destroy()
    }
  })

  it('collapses repeated empty blockquote lines while preserving one paragraph break', () => {
    const source = '> first paragraph\n> \n> \n> second paragraph'
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: source,
        selection: { anchor: source.indexOf('second') },
        extensions: [markdown(), createEditorMarkdownDecorations()],
      }),
    })
    try {
      expect(view.dom.querySelectorAll('.cm-line.cm-md-blank-line-collapsed')).toHaveLength(1)
      view.dispatch({ selection: { anchor: source.indexOf('> \n> \n') + 4 } })
      expect(view.dom.querySelectorAll('.cm-line.cm-md-blank-line-collapsed')).toHaveLength(0)
    } finally {
      view.destroy()
    }
  })
})

describe('safe inline HTML in WYSIWYG mode', () => {
  it('renders allowed inline tags and restores their source while the cursor edits them', () => {
    const source = 'Key <kbd>&#8984;</kbd>, H<sub>2</sub>O, x<sup>2</sup>, and <mark>important</mark>. `Keep <kbd>source</kbd>`'
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: source,
        selection: { anchor: 0 },
        extensions: [markdown(), createEditorMarkdownDecorations()],
      }),
    })
    try {
      expect(view.dom.querySelector('.cm-md-inline-html-kbd')?.textContent).toBe('⌘')
      expect(view.dom.querySelector('.cm-md-inline-html-sub')?.textContent).toBe('2')
      expect(view.dom.querySelector('.cm-md-inline-html-sup')?.textContent).toBe('2')
      expect(view.dom.querySelector('.cm-md-inline-html-mark')?.textContent).toBe('important')
      expect(view.dom.querySelectorAll('.cm-md-inline-html-kbd')).toHaveLength(1)
      expect(view.dom.querySelector('script')).toBeNull()

      view.dispatch({ selection: { anchor: source.indexOf('<kbd>') + 2 } })
      expect(view.dom.querySelector('.cm-md-inline-html-kbd')).toBeNull()
      expect(view.dom.textContent).toContain('<kbd>&#8984;</kbd>')

      view.dispatch({ selection: { anchor: 0 } })
      expect(view.dom.querySelectorAll('.cm-md-inline-html-kbd')).toHaveLength(1)
    } finally {
      view.destroy()
    }
  })

  it('does not decorate escaped HTML or HTML inside inline code', () => {
    const source = '\\<kbd>escaped</kbd> and `<kbd>literal</kbd>`'
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({ doc: source, extensions: [markdown(), createEditorMarkdownDecorations()] }),
    })
    try {
      expect(view.dom.querySelector('.cm-md-inline-html-kbd')).toBeNull()
      expect(view.dom.textContent).toContain('<kbd>escaped</kbd>')
      expect(view.dom.textContent).toContain('<kbd>literal</kbd>')
    } finally {
      view.destroy()
    }
  })

  it('decodes safe HTML entities as text and restores their spelling at the caret', () => {
    const source = 'A &amp; B &lt; C &copy;'
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({ doc: source, selection: { anchor: 0 }, extensions: [markdown(), createEditorMarkdownDecorations()] }),
    })
    try {
      expect(view.dom.textContent).toBe('A & B < C ©')
      expect(view.dom.querySelector('script')).toBeNull()

      view.dispatch({ selection: { anchor: source.indexOf('&lt;') + 2 } })
      expect(view.dom.textContent).toContain('&lt;')
      expect(view.dom.textContent).not.toContain(' B < C ')
    } finally {
      view.destroy()
    }
  })
})

describe('editor image previews', () => {
  it('finds safe relative inline images and preserves their labels', () => {
    expect(editorImageReferences('before ![Diagram](Pictures/guide/1.png "caption") after')).toEqual([
      { alt: 'Diagram', path: 'Pictures/guide/1.png', title: 'caption', from: 7, to: 49 },
    ])
  })

  it('supports balanced destinations and ignores inline code', () => {
    expect(editorImageReferences('`![skip](a.png)` ![Chart](Pictures/guide/chart(1).png "caption")')).toEqual([
      { alt: 'Chart', path: 'Pictures/guide/chart(1).png', title: 'caption', from: 17, to: 64 },
    ])
  })

  it('does not preview remote, anchored, or absolute destinations', () => {
    expect(editorImageReferences('![a](https://example.com/a.png) ![b](/tmp/b.png) ![c](#anchor)')).toEqual([])
  })

  it('replaces local image syntax with an inline preview until the caret enters it', () => {
    const source = 'Before ![Guide image](images/guide.png "Image tooltip") after'
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: source,
        selection: { anchor: 0 },
        extensions: [markdown(), createEditorMarkdownDecorations({ resolveImage: async () => 'data:image/png;base64,AA==' })],
      }),
    })
    try {
      expect(view.dom.querySelectorAll('.cm-md-image-preview')).toHaveLength(1)
      expect(view.dom.querySelector('.cm-md-image-preview')?.getAttribute('aria-label')).toBe('Image: Guide image')
      expect(view.dom.querySelector('.cm-md-image-preview')?.getAttribute('title')).toBe('Image tooltip')
      view.dispatch({ selection: { anchor: source.indexOf('guide.png') + 2 } })
      expect(view.dom.querySelector('.cm-md-image-preview')).toBeNull()
      expect(view.dom.textContent).toContain('![Guide image](images/guide.png "Image tooltip")')
    } finally {
      view.destroy()
    }
  })
})

describe('editor inline semantic extensions', () => {
  it('renders superscript, subscript, and inserted text while preserving source on edit', () => {
    const source = 'x^2^ H~2~O ++inserted++ and `x^3^`'
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({ doc: source, selection: { anchor: 0 }, extensions: [markdown(), createEditorMarkdownDecorations()] }),
    })
    try {
      expect(view.dom.querySelector('.cm-md-inline-semantic-sup')?.textContent).toBe('2')
      expect(view.dom.querySelector('.cm-md-inline-semantic-sub')?.textContent).toBe('2')
      expect(view.dom.querySelector('.cm-md-inline-semantic-ins')?.textContent).toBe('inserted')
      expect(view.dom.querySelectorAll('.cm-md-inline-semantic')).toHaveLength(3)
      view.dispatch({ selection: { anchor: source.indexOf('^2^') + 1 } })
      expect(view.dom.querySelector('.cm-md-inline-semantic-sup')).toBeNull()
      expect(view.dom.textContent).toContain('x^2^')
    } finally {
      view.destroy()
    }
  })

  it('renders strikethrough outside code while keeping escaped text literal', () => {
    const source = '~~deleted~~, \\~~literal~~, and `~~code~~`'
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({ doc: source, selection: { anchor: 0 }, extensions: [markdown(), createEditorMarkdownDecorations()] }),
    })
    try {
      const struck = view.dom.querySelector('.cm-md-strikethrough')
      expect(struck?.textContent).toBe('deleted')
      expect(view.dom.textContent).toContain('\\~~literal~~')
      expect(view.dom.textContent).toContain('~~code~~')
    } finally {
      view.destroy()
    }
  })
})

describe('editor footnote presentation', () => {
  it('renders references as numbered jumps and restores Markdown source at the caret', () => {
    const source = 'A note[^note] in text.\n\n[^note]: Footnote body'
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: source,
        selection: { anchor: 0 },
        extensions: [markdown(), createEditorMarkdownDecorations()],
      }),
    })
    try {
      const references = view.dom.querySelectorAll<HTMLButtonElement>('.cm-md-footnote-reference')
      expect(references).toHaveLength(2)
      expect(references[0].textContent).toBe('1')
      expect(references[1].closest('.cm-md-footnote-definition')).not.toBeNull()
      references[0].click()
      expect(view.state.selection.main.head).toBe(source.indexOf('Footnote body'))
      view.dispatch({ selection: { anchor: source.indexOf('[^note]') + 2 } })
      expect(view.dom.querySelectorAll('.cm-md-footnote-reference')).toHaveLength(1)
      expect(view.dom.textContent).toContain('[^note]')
    } finally {
      view.destroy()
    }
  })
})

describe('editor reference link definitions', () => {
  it('collapses reference definitions to a compact chip and restores the source at the caret', () => {
    const source = '[Guide][md]\n\n[md]: https://example.com/docs "Guide title"'
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({ doc: source, selection: { anchor: 0 }, extensions: [markdown(), createEditorMarkdownDecorations()] }),
    })
    try {
      expect(view.dom.querySelector('.cm-md-link-definition')?.textContent).toContain('md → https://example.com/docs')
      view.dispatch({ selection: { anchor: source.indexOf('[md]:') + 2 } })
      expect(view.dom.querySelector('.cm-md-link-definition')).toBeNull()
      expect(view.dom.textContent).toContain('[md]: https://example.com/docs')
    } finally {
      view.destroy()
    }
  })
})
