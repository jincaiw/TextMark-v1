import { describe, expect, it } from 'vitest'
import { renderMarkdown, renderMarkdownEnhanced, renderMarkdownUnsafe } from './markdown'
import { SAMPLE_MARKDOWN } from '../constants'

describe('renderMarkdown', () => {
  it('enhances the full welcome document without dropping the render', async () => {
    const rendered = await renderMarkdownEnhanced(SAMPLE_MARKDOWN, 'zh-CN')
    expect(rendered.html).toContain('Welcome to TextMark')
    expect(rendered.html).toContain('katex')
    expect(rendered.html).toContain('hljs-keyword')
    expect(rendered.hasMermaid).toBe(true)
  })
  it('builds stable heading anchors and an outline', () => {
    const rendered = renderMarkdown('# Hello world\n\n## Hello world')
    expect(rendered.outline).toEqual([
      { id: 'hello-world', text: 'Hello world', level: 1 },
      { id: 'hello-world-2', text: 'Hello world', level: 2 },
    ])
    expect(rendered.html).toContain('id="hello-world"')
  })

  it('reuses only the latest identical immutable render', () => {
    const first = renderMarkdownUnsafe('# Cached', 'zh-CN')
    expect(renderMarkdownUnsafe('# Cached', 'zh-CN')).toBe(first)
    expect(renderMarkdownUnsafe('# Changed', 'zh-CN')).not.toBe(first)
    expect(renderMarkdownUnsafe('# Changed', 'en')).not.toBe(first)
  })

  it('removes executable HTML and inline styles', () => {
    const rendered = renderMarkdown('<script>alert(1)</script><img src="x" onerror="alert(1)" style="display:none">')
    expect(rendered.html).not.toContain('script')
    expect(rendered.html).not.toContain('onerror')
    expect(rendered.html).not.toContain('style=')
  })

  it('marks relative images for guarded desktop hydration', () => {
    const rendered = renderMarkdown('![diagram](images/diagram.png)')
    expect(rendered.html).toContain('data-local-src="images/diagram.png"')
    expect(rendered.html).toContain('src=""')
  })

  it('defers Mermaid diagrams to the preview renderer', () => {
    const rendered = renderMarkdown('```mermaid\nflowchart LR\nA-->B\n```')
    expect(rendered.hasMermaid).toBe(true)
    expect(rendered.html).toContain('data-mermaid-source')
  })

  it('renders footnotes, task lists, alerts and generated TOC', () => {
    const rendered = renderMarkdown('# Guide\n\n[TOC]\n\n- [x] Done\n\nText[^1]\n\n[^1]: Note\n\n> [!NOTE]\n> Useful')
    expect(rendered.html).toContain('table-of-contents')
    expect(rendered.html).toContain('task-list-item-checkbox')
    expect(rendered.html).toContain('footnote')
    expect(rendered.html).toContain('markdown-alert-note')
  })

  it('extracts YAML and TOML frontmatter from the rendered body', () => {
    const rendered = renderMarkdown('---\ntitle: Demo\ntags: docs\n---\n# Body')
    expect(rendered.frontmatter).toEqual([
      { key: 'title', value: 'Demo' },
      { key: 'tags', value: 'docs' },
    ])
    expect(rendered.html).not.toContain('title: Demo')
  })

  it('maps task and table source locations for source-aware editing', () => {
    const rendered = renderMarkdown('# Title\n\n- [x] done\n\n| A | B |\n| --- | --- |\n| 1 | 2 |')
    expect(rendered.tasks).toEqual([{ index: 0, line: 3, checked: true }])
    expect(rendered.tables[0]).toMatchObject({ startLine: 5, endLine: 7, rows: 2, columns: 2 })
    expect(rendered.sourceMap.map((entry) => entry.kind)).toEqual(['heading', 'task', 'table'])
  })

  it('renders canonical LaTeX delimiters but keeps code literal', async () => {
    const rendered = await renderMarkdownEnhanced('\\(x + y\\) and `\\(literal\\)`\n\n\\[z^2\\]')
    expect(rendered.html).toContain('katex')
    expect(rendered.html).toContain('style="height:')
    expect(rendered.html).toContain('\\(literal\\)')
  })

  it('preserves a heading boundary immediately after display math', async () => {
    const rendered = await renderMarkdownEnhanced('$$\nx^2\n$$\n\n## Diagram')
    expect(rendered.html).toContain('katex-display')
    expect(rendered.html).toContain('<h2 id="diagram">Diagram</h2>')
    expect(rendered.outline).toContainEqual({ id: 'diagram', text: 'Diagram', level: 2 })
  })

  it('keeps only KaTeX layout styles and rejects user-controlled CSS', async () => {
    const rendered = await renderMarkdownEnhanced(
      '$x^2$ <span style="color:red">plain</span> <span class="katex"><span style="background:url(https://example.com/x);position:fixed">fake</span></span>',
    )
    expect(rendered.html).toContain('style="height:')
    expect(rendered.html).not.toContain('color:red')
    expect(rendered.html).not.toContain('background:')
    expect(rendered.html).not.toContain('position:fixed')
  })

  it('keeps escaped brackets in reference-link labels out of the math parser', () => {
    const rendered = renderMarkdown('[\\[4\\]][source]\n\n[source]: https://example.com')
    expect(rendered.html).toContain('href="https://example.com"')
    expect(rendered.html).toContain('[4]')
    expect(rendered.html).not.toContain('textmark-math-placeholder')
    expect(rendered.hasMath).toBe(false)
  })

  it('keeps escaped brackets literal in inline links and ordinary text', () => {
    const inline = renderMarkdown('[\\[4\\]](https://example.com)')
    const plain = renderMarkdown('Range: \\[4\\] and \\[draft\\]. Parentheses: \\(圆括号\\).')
    expect(inline.html).toContain('href="https://example.com"')
    expect(inline.html).toContain('[4]')
    expect(inline.hasMath).toBe(false)
    expect(plain.html).toContain('Range: [4] and [draft]. Parentheses: (圆括号).')
    expect(plain.hasMath).toBe(false)
  })

  it('restores inline code nested inside a Markdown link', () => {
    const rendered = renderMarkdown('[`code`](https://example.com)')
    expect(rendered.html).toContain('<a href="https://example.com"')
    expect(rendered.html).toContain('<code>code</code>')
    expect(rendered.html).not.toContain('TEXTMARKPROTECTED')
  })

  it('uses a real HCL grammar for Terraform fences', async () => {
    const rendered = await renderMarkdownEnhanced('```terraform\nresource "aws_s3_bucket" "example" { enabled = true }\n```')
    expect(rendered.html).toContain('hljs-keyword')
    expect(rendered.html).toContain('hljs-attr')
  })

  it('highlights an unlabeled common-language code fence without changing explicit source syntax', async () => {
    const rendered = await renderMarkdownEnhanced('```\nconst title: string = "TextMark"\n```')
    expect(rendered.optionalRenderers).toContain('highlight')
    expect(rendered.html).toContain('language-javascript')
  })

  it('keeps CommonMark soft breaks soft while preserving explicit hard breaks', () => {
    const rendered = renderMarkdown('soft line\ncontinues\n\nhard line  \ncontinues\n\\\nhard again')
    expect(rendered.html).toContain('<p>soft line\ncontinues</p>')
    expect(rendered.html).toContain('hard line<br>\ncontinues\n<br>\nhard again')
  })

  it('uses safe alignment classes instead of inline table styles', () => {
    const rendered = renderMarkdown('| A | B | C |\n| :--- | ---: | :---: |\n| left | right | center |')
    expect(rendered.html).toContain('md-table-align-right')
    expect(rendered.html).toContain('md-table-align-center')
    expect(rendered.html).not.toContain('style=')
  })

  it('creates manual-link-compatible Chinese heading anchors after marker punctuation', () => {
    const rendered = renderMarkdown('## 一、标题与分隔线 🅲')
    expect(rendered.outline).toEqual([{ id: '一标题与分隔线', text: '一、标题与分隔线 🅲', level: 2 }])
  })

  it('does not let task labels turn escaped code into raw HTML that consumes following content', () => {
    const rendered = renderMarkdown('- [ ] Inline `<script>` must stay literal\n\n# After task\n\nText[^a]\n\n[^a]: Note')
    expect(rendered.html).toContain('&lt;script&gt;')
    expect(rendered.html).toContain('After task')
    expect(rendered.html).toContain('footnotes')
    expect(rendered.html).not.toContain('<script')
  })
})
