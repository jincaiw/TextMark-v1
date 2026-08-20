import { describe, expect, it } from 'vitest'
import { markdownLineClass } from './editorMarkdownDecorations'

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
