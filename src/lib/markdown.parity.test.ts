import { describe, expect, it } from 'vitest'
import { renderMarkdown, renderMarkdownEnhanced } from './markdown'
import { editMarkdownTable } from './table'

describe('upstream MarkdownHTML rendering parity', () => {
  it('renders YAML properties before the body', () => {
    const result = renderMarkdown('---\ntitle: Draft\n---\n# Body')
    expect(result.html.indexOf('md-frontmatter')).toBeLessThan(result.html.indexOf('<h1'))
  })
  it('renders list properties as pills and unquotes scalars', () => {
    const result = renderMarkdown('---\nname: "TextMark"\ntags: [one, "two words"]\n---\nBody')
    expect(result.html).toContain('md-fm-pill')
    expect(result.html).toContain('two words')
    expect(result.html).not.toContain('&quot;TextMark&quot;')
  })
  it('renders TOML properties', () => expect(renderMarkdown('+++\ntitle = "Draft"\n+++\nBody').html).toContain('md-frontmatter'))
  it('omits the properties panel without frontmatter', () => expect(renderMarkdown('# Body').html).not.toContain('md-frontmatter'))
  it('maps a long table through its final data line', () =>
    expect(renderMarkdown('| A |\n| --- |\n| 1 |\n| 2 |\n| 3 |').tables[0]).toMatchObject({
      startLine: 1,
      endLine: 5,
      rows: 4,
      columns: 1,
    }))
  it('keeps long inline code in a heading', () =>
    expect(renderMarkdown('# `this-is-a-very-long-inline-code-token-without-breaks`').html).toContain('this-is-a-very-long'))
  it('reports Hebrew documents as RTL', () => expect(renderMarkdown('# כותרת\n\nזהו מסמך ארוך בעברית עם תוכן נוסף').direction).toBe('rtl'))
  it('reports Arabic documents as RTL', () =>
    expect(renderMarkdown('# عنوان\n\nهذا مستند عربي طويل يحتوي على نص إضافي').direction).toBe('rtl'))
  it('preserves authored blank lines while compacting the final blank in a run', () => {
    const html = renderMarkdown('First.\n\n\nSecond.').html
    expect(html.match(/<div class="md-source-blank-line(?:\s|")/g)).toHaveLength(2)
    expect(html.match(/md-source-blank-line-final/g)).toHaveLength(1)
  })
  it('preserves an inline tab with an explicit tab span', () => expect(renderMarkdown('alpha\tbeta').html).toContain('md-inline-tab'))
  it('keeps standalone indented code as a code block', () => expect(renderMarkdown('    const value = 1').html).toContain('<pre'))
  it('keeps deep list nesting', () => {
    const result = renderMarkdown('- one\n  - two\n    - three\n      - four')
    expect(result.html.match(/<ul>/g)?.length).toBe(4)
  })
  it('uses only the first Mermaid info word', () => {
    const result = renderMarkdown('```Mermaid diagram-name\ngraph TD\nA-->B\n```')
    expect(result.hasMermaid).toBe(true)
    expect(result.html).not.toContain('diagram-name')
  })
  it('advertises Mermaid as an optional renderer', () =>
    expect(renderMarkdown('```mermaid\ngraph TD\nA-->B\n```').optionalRenderers).toContain('mermaid'))
  it('encodes Mermaid source without executable HTML', () => {
    const result = renderMarkdown('```mermaid\ngraph TD\nA[<script>x</script>]\n```')
    expect(result.html).not.toContain('<script>')
    expect(result.html).toContain('data-mermaid-source')
  })
  it('normalizes sh to bash highlighting', async () =>
    expect((await renderMarkdownEnhanced('```sh\necho $HOME # comment\n```')).html).toContain('hljs-built_in'))
  it('normalizes console to bash highlighting', async () =>
    expect((await renderMarkdownEnhanced('```console\necho ok\n```')).html).toContain('hljs-built_in'))
  it('highlights Python and its py alias', async () => {
    const rendered = await renderMarkdownEnhanced('```py\ndef greet(name):\n  return f"Hello, {name}"\n```')
    expect(rendered.html).toContain('language-python')
    expect(rendered.html).toContain('hljs-keyword')
  })
  it('highlights Terraform/HCL aliases', async () =>
    expect((await renderMarkdownEnhanced('```hcl\nresource "x" "y" { enabled = true }\n```')).html).toContain('hljs-keyword'))
  it('does not treat Mermaid as syntax highlighting', () =>
    expect(renderMarkdown('```mermaid\ngraph TD\n```').optionalRenderers).not.toContain('highlight'))
  it('renders dollar block math', async () =>
    expect((await renderMarkdownEnhanced('$$\n\\int_0^1 x^2 dx\n$$')).html).toContain('katex-display'))
  it('renders parenthesized inline LaTeX', async () => expect((await renderMarkdownEnhanced('\\(x+y\\)')).html).toContain('katex'))
  it('renders bracketed display LaTeX', async () => expect((await renderMarkdownEnhanced('\\[x^2\\]')).html).toContain('katex-display'))
  it('renders fenced math', async () => expect((await renderMarkdownEnhanced('```math\nx^2 + y^2\n```')).html).toContain('katex-display'))
  it('keeps LaTeX delimiters inside inline code literal', () => {
    const html = renderMarkdown('`\\(literal\\)`').html
    expect(html).toContain('\\(literal\\)')
    expect(html).not.toContain('katex')
  })
  it('keeps dollar math inside fenced code literal', () => {
    const html = renderMarkdown('```text\n$x$\n```').html
    expect(html).toContain('$x$')
    expect(html).not.toContain('katex')
  })
  it('advertises KaTeX only when math exists', () => {
    expect(renderMarkdown('$x$').optionalRenderers).toContain('katex')
    expect(renderMarkdown('plain').optionalRenderers).not.toContain('katex')
  })
  it('keeps footnote references in source order', () => {
    const html = renderMarkdown('A[^a] B[^b].\n\n[^a]: First\n[^b]: Second').html
    expect(html.indexOf('First')).toBeLessThan(html.indexOf('Second'))
  })
  it('supports multiple references to one footnote', () =>
    expect(renderMarkdown('A[^a] B[^a].\n\n[^a]: Note').html.match(/footnote-ref/g)?.length).toBe(2))
  it('keeps source line mapping after frontmatter', () =>
    expect(renderMarkdown('---\ntitle: A\n---\n# Body\n\n- [ ] task').tasks[0].line).toBe(6))
  it('keeps multiline footnote source ranges after frontmatter', () =>
    expect(
      renderMarkdown('---\ntitle: A\n---\nPrelude[^a].\n\n[^a]: First\n    Second').sourceMap.find((range) => range.kind === 'footnote'),
    ).toMatchObject({ line: 6 }))
  it('exposes stable table dimensions', () =>
    expect(renderMarkdown('| A | B |\n| --- | --- |\n| x | y |').tables[0]).toMatchObject({ rows: 2, columns: 2 }))
  it('exposes source Markdown for every stable table cell coordinate', () =>
    expect(renderMarkdown('| A | B |\n| --- | --- |\n| x | y |').tables[0].cells).toContainEqual({ row: 1, column: 1, markdown: 'y' }))
  it('edits the exact table cell and escapes pipes', () =>
    expect(editMarkdownTable('| A | B |\n| --- | --- |\n| x | y |', 0, 1, 1, { edit: 'setCell', value: 'a | b' })).toContain('a \\| b'))
  it('marks Markdown relative images for native hydration', () =>
    expect(renderMarkdown('![x](images/a.png)').html).toContain('data-local-src="images/a.png"'))
  it('marks raw HTML relative images for native hydration', () =>
    expect(renderMarkdown('<img src="images/a.png" alt="x">').html).toContain('data-local-src="images/a.png"'))
  it('does not rewrite remote images', () => {
    const html = renderMarkdown('![x](https://example.com/a.png)').html
    expect(html).toContain('https://example.com/a.png')
    expect(html).not.toContain('data-local-src')
  })
  it('keeps GitHub alert default titles in English in every locale', () => {
    expect(renderMarkdown('> [!IMPORTANT]\n> Body', 'zh-CN').html).toContain('Important')
    expect(renderMarkdown('> [!IMPORTANT]\n> Body', 'zh-CN').html).not.toContain('重要')
  })
  it('supports formatted custom alert titles', () =>
    expect(renderMarkdown('> [!NOTE] With **bold** title').html).toContain('With <strong>bold</strong> title'))
  it('includes the alert icon', () => expect(renderMarkdown('> [!NOTE]\n> Body').html).toContain('markdown-alert-icon'))
  it('renders every Obsidian callout kind and alias as a callout', () => {
    expect(renderMarkdown('> [!abstract] A').html).toContain('markdown-alert-abstract')
    expect(renderMarkdown('> [!summary] A').html).toContain('markdown-alert-abstract')
    expect(renderMarkdown('> [!tldr] A').html).toContain('markdown-alert-abstract')
    expect(renderMarkdown('> [!hint] A').html).toContain('markdown-alert-tip')
    expect(renderMarkdown('> [!check] A').html).toContain('markdown-alert-success')
    expect(renderMarkdown('> [!done] A').html).toContain('markdown-alert-success')
    expect(renderMarkdown('> [!help] A').html).toContain('markdown-alert-question')
    expect(renderMarkdown('> [!faq] A').html).toContain('markdown-alert-question')
    expect(renderMarkdown('> [!attention] A').html).toContain('markdown-alert-warning')
    expect(renderMarkdown('> [!fail] A').html).toContain('markdown-alert-failure')
    expect(renderMarkdown('> [!missing] A').html).toContain('markdown-alert-failure')
    expect(renderMarkdown('> [!error] A').html).toContain('markdown-alert-danger')
    expect(renderMarkdown('> [!cite] A').html).toContain('markdown-alert-quote')
    expect(renderMarkdown('> [!bug] A').html).toContain('markdown-alert-bug')
    expect(renderMarkdown('> [!todo] A').html).toContain('markdown-alert-todo')
    expect(renderMarkdown('> [!info] A').html).toContain('markdown-alert-info')
    expect(renderMarkdown('> [!example] A').html).toContain('markdown-alert-example')
  })
  it('treats an unknown type as a note callout with the capitalized type as title', () => {
    const html = renderMarkdown('> [!FOO] Nope').html
    expect(html).toContain('markdown-alert markdown-alert-note')
    expect(html).not.toContain('<blockquote>')
    expect(renderMarkdown('> [!bar]').html).toContain('Bar')
    expect(renderMarkdown('> [!NOTE]').html).toContain('Note')
    expect(renderMarkdown('> [!faq]').html).toContain('Faq')
  })
  it('folds callouts with the Obsidian markers', () => {
    const closed = renderMarkdown('> [!tip]- Folded\n> Body').html
    expect(closed).toContain('<details class="markdown-alert markdown-alert-tip" data-md-fold="closed">')
    expect(closed).toContain('<summary class="markdown-alert-title">')
    expect(closed).not.toContain('open=""')
    const open = renderMarkdown('> [!tip]+ Open\n> Body').html
    expect(open).toContain('data-md-fold="open" open=""')
    expect(renderMarkdown('> [!tip] Title').html).toContain('<div class="markdown-alert markdown-alert-tip">')
  })
  it('uses the text after the tag as the title and the rest as the body', () => {
    const html = renderMarkdown('> [!warning] Heads up\n> First line\n> Second line').html
    expect(html).toContain('Heads up')
    expect(html).toContain('First line\nSecond line')
    expect(renderMarkdown('> [!note]\n> Only body').html).toContain('Note</p><p>Only body</p>')
  })
  it('keeps a blockquote without a callout tag as a blockquote', () => {
    expect(renderMarkdown('> Plain quote').html).toContain('<blockquote>')
    expect(renderMarkdown('> Plain quote').html).not.toContain('markdown-alert')
  })
  it('widens the gutter only for lists whose widest rendered marker reaches three digits', () => {
    // Markers number sequentially from the list's start; authored values of
    // later items never render, so they must not widen the gutter.
    expect(renderMarkdown('1. a\n2. b').html).not.toContain('data-mdp-digits')
    expect(renderMarkdown('1. a\n100. b').html).not.toContain('data-mdp-digits')
    expect(renderMarkdown('1. a\n10. b\n99. c').html).not.toContain('data-mdp-digits')
    expect(renderMarkdown('100. a\n101. b').html).toContain('<ol start="100" data-mdp-digits="3">')
    expect(renderMarkdown('1000. a').html).toContain('data-mdp-digits="4"')
    expect(renderMarkdown('999999999. a').html).toContain('data-mdp-digits="9"')
    // A renumbered nested list is its own <ol> with its own count.
    const nested = renderMarkdown('1. a\n   - x\n   100. y\n2. b').html
    expect(nested.match(/<ol data-mdp-digits="3">|<ol start="100" data-mdp-digits="3">/g)).toHaveLength(1)
    expect(nested).toMatch(/<ol>\n<li>a/)
  })
  it('sanitizes executable alert title HTML', () =>
    expect(renderMarkdown('> [!CAUTION] <script>alert(1)</script>').html).not.toContain('script'))
  it('keeps CommonMark soft breaks as source whitespace', () => {
    const html = renderMarkdown('First line\nSecond line').html
    expect(html).toContain('First line\nSecond line')
    expect(html).not.toContain('<br')
  })
  it('builds a localized TOC', () => expect(renderMarkdown('# A\n\n[TOC]', 'zh-CN').html).toContain('aria-label="目录"'))
  it('builds Setext heading anchors', () =>
    expect(renderMarkdown('Heading\n=======').outline).toEqual([{ id: 'heading', text: 'Heading', level: 1, line: 1 }]))
  it('deduplicates heading anchors deterministically', () =>
    expect(renderMarkdown('# A\n# A\n# A').outline.map((item) => item.id)).toEqual(['a', 'a-2', 'a-3']))
  it('sanitizes script, event, form, and style surfaces', () => {
    const html = renderMarkdown('<form><input></form><style>x{}</style><img src="x" onload="x">').html
    expect(html).not.toMatch(/<form|<style|onload/i)
  })
  it('renders double-tilde strikethrough', () => expect(renderMarkdown('~~deleted~~').html).toContain('<s>deleted</s>'))
  it('renders upstream-style ==highlight== without changing code spans', () => {
    const rendered = renderMarkdown('Before ==important== after\n\n`==literal==`')
    expect(rendered.html).toContain('<mark>important</mark>')
    expect(rendered.html).toContain('<code>==literal==</code>')
  })
  it('keeps unmatched highlight markers as literal text', () => {
    const rendered = renderMarkdown('A ==not closed')
    expect(rendered.html).not.toContain('<mark>')
    expect(rendered.html).toContain('==not closed')
  })
  it('keeps single tildes literal (upstream #278)', () => {
    const html = renderMarkdown('~literal~').html
    expect(html).toContain('~literal~')
    expect(html).not.toContain('<s>')
  })
})
