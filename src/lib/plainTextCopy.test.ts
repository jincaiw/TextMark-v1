import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './markdown'
import { copyAsPlainText, plainTextForSelection } from './plainTextCopy'

/** Mounts the article the way PreviewPane does, with the test markdown
 * rendered through TextMark's own pipeline, and injects a KaTeX node exactly
 * as upstream's harness leaves it (annotation + hidden HTML layer). */
function mountArticle(markdown: string) {
  document.body.innerHTML = ''
  const article = document.createElement('article')
  article.className = 'markdown-body content-normal'
  article.innerHTML = renderMarkdown(markdown).html
  document.body.appendChild(article)
  return article
}

function selectAll() {
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.selectAllChildren(document.body)
}

function selectWord(textNode: Text, from: number, to: number) {
  const selection = window.getSelection()
  const range = document.createRange()
  range.setStart(textNode, from)
  range.setEnd(textNode, to)
  selection?.removeAllRanges()
  selection?.addRange(range)
}

const PARITY_MARKDOWN = `# Title

A paragraph with **bold** and a [link](https://example.com).[^n]

- First
- Second
  - Nested

3. Three
4. Four

- [x] Done
- [ ] Open

> [!NOTE]
> A note.

| Name | Note | Value |
| ---- | ---- | ----- |
| Alpha |  | 1 |
|  | x |  |

- Item
-

After the empty item.

\`\`\`mermaid
flowchart LR
    A --> B
\`\`\`

[^n]: The note.
`

describe('Copy as Plain Text (upstream #637)', () => {
  it('writes the text as it reads, without Markdown', () => {
    const article = mountArticle(PARITY_MARKDOWN)
    // KaTeX output with its TeX annotation, as the real renderer leaves it.
    const math = document.createElement('p')
    math.innerHTML =
      'Math <span class="katex"><span class="katex-mathml"><math><semantics>' +
      '<annotation encoding="application/x-tex">a^2</annotation></semantics></math></span>' +
      '<span class="katex-html" aria-hidden="true">a2</span></span> here.'
    article.querySelector('ul')?.before(math)
    selectAll()

    const copy = plainTextForSelection()
    expect(copy?.text).toBe(
      [
        'Title',
        '',
        'A paragraph with bold and a link.[1]',
        '',
        'Math a^2 here.',
        '',
        '• First',
        '• Second',
        '  • Nested',
        '',
        '3. Three',
        '4. Four',
        '',
        '☑ Done',
        '☐ Open',
        '',
        'Note',
        'A note.',
        '',
        'Name\tNote\tValue',
        'Alpha\t\t1',
        '\tx\t',
        '',
        '• Item',
        '',
        'After the empty item.',
        '',
        '1. The note.',
      ].join('\n'),
    )
    // The same HTML a normal copy writes, for rich text fields.
    expect(copy?.html).toContain('<strong>bold</strong>')
  })

  it('copies a word inside a paragraph without any marker', () => {
    const article = mountArticle(PARITY_MARKDOWN)
    const firstText = article.querySelector('p')?.firstChild
    expect(firstText?.nodeType).toBe(Node.TEXT_NODE)
    selectWord(firstText as Text, 2, 11)
    expect(plainTextForSelection()?.text).toBe('paragraph')
  })

  it('copies text that starts inside a list item without the item marker', () => {
    const article = mountArticle(PARITY_MARKDOWN)
    const secondItem = article.querySelectorAll('li')[1]
    const text = document.createTreeWalker(secondItem, NodeFilter.SHOW_TEXT).nextNode() as Text
    selectWord(text, 1, 4)
    expect(plainTextForSelection()?.text).toBe('eco')
  })

  it('returns null with no selection', () => {
    mountArticle(PARITY_MARKDOWN)
    window.getSelection()?.removeAllRanges()
    expect(plainTextForSelection()).toBeNull()
  })

  it('keeps markers on nested list lines and skips hidden table cells', () => {
    const article = mountArticle(
      '- Parent\n  - Child\n    - Deep bullet\n    1. Deep ordered\n    - [x] Deep task\n\n' +
        '<table><tr><td hidden>Hidden</td><td>Visible</td></tr></table>',
    )
    // TextMark renders real nested <li> elements, so the deep items are
    // nested lists rather than upstream's in-paragraph source lines.
    expect(article.querySelectorAll('li').length).toBeGreaterThan(0)
    selectAll()
    const text = plainTextForSelection()?.text ?? ''
    expect(text).toContain('• Parent')
    expect(text).toContain('  • Child')
    expect(text).toContain('    • Deep bullet')
    expect(text).toContain('    1. Deep ordered')
    expect(text).toContain('    ☑ Deep task')
    // A hidden cell is left out; the visible one still copies.
    expect(text).not.toContain('Hidden')
    expect(text).toContain('Visible')
  })

  it('writes through the injected pasteboard and reports failure without a selection', async () => {
    mountArticle('# Head\n\nBody text')
    selectAll()
    const writes: Array<{ text: string; html: string }> = []
    await expect(copyAsPlainText(async (copy) => void writes.push(copy))).resolves.toBe(true)
    expect(writes[0]?.text).toBe('Head\n\nBody text')

    window.getSelection()?.removeAllRanges()
    await expect(copyAsPlainText(async () => {})).resolves.toBe(false)
  })
})
