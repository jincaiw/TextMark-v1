import { describe, expect, it } from 'vitest'
import { editorFormattingStateFromSource } from './editorFormattingState'

describe('editor formatting state', () => {
  it('reports the active heading and inline styles around the selection', () => {
    const source = '## **Selected**'
    const from = source.indexOf('Selected')
    const state = editorFormattingStateFromSource(source, from, from + 'Selected'.length, source)

    expect(state).toEqual({
      heading: 'h2',
      bold: true,
      italic: false,
      strikethrough: false,
      code: false,
      link: false,
      highlight: false,
      bulletList: false,
      orderedList: false,
      taskList: false,
      quote: false,
    })
  })

  it('recognizes highlight, italic, code, and links without conflating emphasis', () => {
    const source = '==marked== *italic* `code` [link](https://example.com)'
    const select = (value: string) => {
      const start = source.indexOf(value)
      return editorFormattingStateFromSource(source, start, start + value.length, source)
    }

    expect(select('marked').highlight).toBe(true)
    expect(select('italic').italic).toBe(true)
    expect(select('code').code).toBe(true)
    expect(select('link').link).toBe(true)
  })

  it('returns body style when the caret is on a normal paragraph', () => {
    expect(editorFormattingStateFromSource('Plain paragraph', 4, 4, 'Plain paragraph').heading).toBe('h0')
  })

  it('reports the active block style for the caret line', () => {
    const state = editorFormattingStateFromSource('- [x] checked item', 8, 8, '- [x] checked item')
    expect(state.taskList).toBe(true)
    expect(state.bulletList).toBe(false)
    expect(state.orderedList).toBe(false)
    expect(state.quote).toBe(false)
  })
})
