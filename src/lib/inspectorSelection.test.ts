import { describe, expect, it } from 'vitest'
import { isNonEmptySelection, selectionStatsFromText, sliceSelection } from './inspectorSelection'

describe('selectionStatsFromText', () => {
  it('counts words, characters, and lines of a selection', () => {
    expect(selectionStatsFromText('hello world')).toEqual({ words: 2, characters: 11, lines: 1 })
  })

  it('counts multi-line selections including the trailing line', () => {
    expect(selectionStatsFromText('one\ntwo\nthree')).toEqual({ words: 3, characters: 13, lines: 3 })
  })

  it('counts CRLF selections as single lines between breaks', () => {
    // CRLF is one grapheme cluster, as in Swift's String.count.
    expect(selectionStatsFromText('a\r\nb')).toEqual({ words: 2, characters: 3, lines: 2 })
  })

  it('counts code points, not UTF-16 units', () => {
    expect(selectionStatsFromText('好👍').characters).toBe(2)
  })

  it('counts grapheme clusters, so emoji modifiers stay one character', () => {
    // Family emoji: 7 code points, 1 grapheme cluster.
    expect(selectionStatsFromText('👨‍👩‍👧‍👦a').characters).toBe(2)
  })

  it('collapses runs of whitespace for word counts', () => {
    expect(selectionStatsFromText('  hello   world  ').words).toBe(2)
  })
})

describe('isNonEmptySelection', () => {
  it('rejects a collapsed caret', () => {
    expect(isNonEmptySelection({ anchor: { line: 1, column: 1 }, head: { line: 1, column: 1 } })).toBe(false)
  })

  it('accepts a selection within one line', () => {
    expect(isNonEmptySelection({ anchor: { line: 1, column: 1 }, head: { line: 1, column: 5 } })).toBe(true)
  })

  it('accepts a selection across lines', () => {
    expect(isNonEmptySelection({ anchor: { line: 1, column: 3 }, head: { line: 4, column: 1 } })).toBe(true)
  })

  it('rejects missing state', () => {
    expect(isNonEmptySelection(null)).toBe(false)
    expect(isNonEmptySelection(undefined)).toBe(false)
  })
})

describe('sliceSelection', () => {
  const source = 'alpha\nbeta\ngamma'

  it('slices within one line', () => {
    expect(sliceSelection(source, { line: 2, column: 1 }, { line: 2, column: 5 })).toBe('beta')
  })

  it('slices across line breaks', () => {
    expect(sliceSelection(source, { line: 1, column: 3 }, { line: 2, column: 3 })).toBe('pha\nbe')
  })

  it('returns the whole tail when the end is past the document', () => {
    expect(sliceSelection(source, { line: 3, column: 1 }, { line: 9, column: 99 })).toBe('gamma')
  })

  it('is order-independent in the anchor/head pair', () => {
    expect(sliceSelection(source, { line: 2, column: 3 }, { line: 1, column: 3 })).toBe('pha\nbe')
  })
})
