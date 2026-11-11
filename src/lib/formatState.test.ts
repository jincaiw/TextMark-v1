// Equivalence tests for the formatting selection reads ported from upstream
// entry-cm.js: the floating bar's live heading label, emphasis tints, popover
// checkmarks and link form all come from these functions.
import { EditorState } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { describe, expect, it } from 'vitest'
import { blockStyle, linkSelection, listPrefix, listStyle, selectionContext, stylingContext } from './formatState'

/** Build a markdown state with the selection at the `|` markers (one `|` = a
 * caret, two = a range). */
function at(source: string): EditorState {
  const first = source.indexOf('|')
  const second = source.indexOf('|', first + 1)
  const doc = source.replace(/\|/g, '')
  return EditorState.create({
    doc,
    extensions: [markdown()],
    selection: { anchor: first, head: second >= 0 ? second - 1 : first },
  })
}

describe('selectionContext', () => {
  it('reports the heading level under the caret', () => {
    expect(selectionContext(at('## Ti|tle')).heading).toBe(2)
    expect(selectionContext(at('Body |text')).heading).toBe(0)
  })

  it('collects the marks enclosing the selection', () => {
    const bold = selectionContext(at('**bo|ld**'))
    expect(bold.commands).toContain('bold')
    const nested = selectionContext(at('**[li|nk](u)**'))
    expect(nested.commands).toEqual(expect.arrayContaining(['bold', 'link']))
  })

  it('returns the selected text or null for a caret', () => {
    expect(selectionContext(at('|hello')).selectedText).toBeNull()
    expect(selectionContext(at('h|ello|')).selectedText).toBe('ello')
  })
})

describe('listPrefix and listStyle', () => {
  it('classifies each marker shape', () => {
    expect(listPrefix('- item').style).toBe('bullet')
    expect(listPrefix('3. item').style).toBe('ordered')
    expect(listPrefix('- [ ] item').style).toBe('task')
    expect(listPrefix('- [x] item').style).toBe('task')
    expect(listPrefix('plain').style).toBe('none')
    expect(listPrefix('  - indented').style).toBe('bullet')
  })

  it('keeps the quote wrapper in the indent so markers stay outside it', () => {
    const quoted = listPrefix('> - item')
    expect(quoted.style).toBe('bullet')
    expect(quoted.indent).toBe('> ')
  })

  it('reports the common style across selected lines', () => {
    expect(listStyle(at('|- a\n- b|'))).toBe('bullet')
    expect(listStyle(at('|- a\n1. b|'))).toBe('mixed')
    expect(listStyle(at('|plain|'))).toBe('none')
  })

  it('ignores blank lines and code when deciding the style', () => {
    expect(listStyle(at('|- a\n\n- b|'))).toBe('bullet')
  })
})

describe('stylingContext', () => {
  it('finds the innermost block style', () => {
    expect(blockStyle(at('> qu|ote'))).toBe('quote')
    expect(blockStyle(at('```\nco|de\n```'))).toBe('fenced')
    expect(blockStyle(at('|plain text'))).toBe('none')
  })

  it('reports inline code as the code style', () => {
    expect(stylingContext(at('a `co|de` b')).style).toBe('code')
  })
})

describe('linkSelection', () => {
  it('returns the plain range when nothing is linked', () => {
    const state = at('pl|ain|')
    expect(linkSelection(state)).toEqual({ from: 2, to: 5, text: 'ain' })
  })

  it('expands to the whole link label when asked', () => {
    const state = at('[lab|el](https://a.dev)')
    const expanded = linkSelection(state, true)
    expect(expanded.text).toBe('label')
    expect(state.sliceDoc(expanded.from, expanded.to)).toBe('[label](https://a.dev)')
  })

  it('leaves the selection alone without expandLink', () => {
    const state = at('[la|b|el](https://a.dev)')
    expect(linkSelection(state).text).toBe('b')
  })
})
