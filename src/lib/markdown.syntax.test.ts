import { describe, expect, it } from 'vitest'
import { renderMarkdownEnhanced } from './markdown'

const syntaxDocument = `---
title: Markdown syntax coverage
tags: [commonmark, gfm]
---

# ATX heading

Setext heading
--------------

[TOC]

Plain text with *emphasis*, **strong**, ***both***, ~~deleted~~, \`inline code\`, an escaped \\*asterisk\\*, and &amp;.
This is a soft line break.

This is a hard line break.  
This is the next line.

> A block quote
>
> - with a nested list

1. Ordered item
2. Second item
   1. Nested ordered item

- Unordered item
  - Nested unordered item
- [x] Completed task
- [ ] Open task

[Inline link](https://example.com "Title"), [reference link][guide], <https://example.org>, and https://example.net.

![Data image](data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==)

| Left | Center | Right |
| :--- | :----: | ----: |
| A | B | C |

---

Indented code:

    const indented = true

\`\`\`typescript
const fenced: boolean = true
\`\`\`

Inline math $E = mc^2$.

\`\`\`math
x^2 + y^2
\`\`\`

\`\`\`mermaid
flowchart LR
  Markdown --> Preview
\`\`\`

> [!TIP]
> Extended alert

<details open>
<summary>Raw HTML details</summary>
Use <kbd>⌘</kbd> + <kbd>K</kbd>. <script>unsafe()</script>
</details>

Footnote reference[^note].

[^note]: Footnote body

[guide]: https://example.com/guide
`

describe('supported Markdown syntax surface', () => {
  it('renders CommonMark, GFM, and TextMark extensions together without unsafe HTML', async () => {
    const result = await renderMarkdownEnhanced(syntaxDocument, 'en')
    const html = result.html

    expect(result.frontmatter).toHaveLength(2)
    expect(result.outline.map((item) => item.text)).toEqual(['ATX heading', 'Setext heading'])
    expect(html).toContain('table-of-contents')
    expect(html).toContain('<em>emphasis</em>')
    expect(html).toContain('<strong>strong</strong>')
    expect(html).toContain('<s>deleted</s>')
    expect(html).toContain('<code>inline code</code>')
    expect(html).toContain('*asterisk*')
    expect(html).toContain('&amp;')
    expect(html).toContain('<blockquote>')
    expect(html.match(/<ol>/g)?.length).toBeGreaterThanOrEqual(2)
    expect(html.match(/<ul>/g)?.length).toBeGreaterThanOrEqual(2)
    expect(html.match(/task-list-item-checkbox/g)).toHaveLength(2)
    expect(html).toContain('href="https://example.com/guide"')
    expect(html).toContain('href="https://example.org"')
    expect(html).toContain('href="https://example.net"')
    expect(html).toContain('<img')
    expect(html).toContain('md-table-align-center')
    expect(html).toContain('md-table-align-right')
    expect(html).toContain('const indented = true')
    expect(html).toContain('language-typescript')
    expect(html).toContain('katex')
    expect(result.hasMermaid).toBe(true)
    expect(html).toContain('markdown-alert-tip')
    expect(html).toContain('<details open="">')
    expect(html).toContain('<summary>Raw HTML details</summary>')
    expect(html).toContain('<kbd>⌘</kbd>')
    expect(html).toContain('footnotes')
    expect(html).not.toContain('<script')
  })

  it('keeps soft and hard line breaks semantically distinct', async () => {
    const html = (await renderMarkdownEnhanced(syntaxDocument)).html
    expect(html).toContain('Plain text with')
    expect(html).toContain('This is a soft line break.</p>')
    expect(html).toContain('This is a hard line break.<br>')
  })
})
