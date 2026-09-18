import { describe, expect, it } from 'vitest'
import { orderedMatchesFrom, replaceAllMatches, searchMatchOffsets, selectionMatches } from './search'

describe('searchMatchOffsets', () => {
  it('finds every occurrence and ignores case by default', () => {
    expect(searchMatchOffsets('TextMark and textmark', 'TextMark', false).map((match) => match.index)).toEqual([0, 13])
  })

  it('honours case sensitivity', () => {
    expect(searchMatchOffsets('TextMark and textmark', 'TextMark', true).map((match) => match.index)).toEqual([0])
  })

  it('anchors beginsWith matches to a word boundary', () => {
    expect(searchMatchOffsets('mark remark markdown', 'mark', false, 'beginsWith').map((match) => match.index)).toEqual([0, 12])
    expect(searchMatchOffsets('mark remark markdown', 'mark', false, 'contains').map((match) => match.index)).toEqual([0, 7, 12])
  })

  it('treats the query literally instead of as a regular expression', () => {
    expect(searchMatchOffsets('a.b aXb', 'a.b', false).map((match) => match.index)).toEqual([0])
  })

  it('returns nothing for an empty query', () => {
    expect(searchMatchOffsets('anything', '', false)).toEqual([])
  })
})

describe('orderedMatchesFrom', () => {
  const matches = [
    { index: 10, length: 2 },
    { index: 40, length: 2 },
    { index: 90, length: 2 },
  ]

  it('starts from the first match at or after the caret', () => {
    expect(orderedMatchesFrom(matches, 40)[0]?.index).toBe(40)
    expect(orderedMatchesFrom(matches, 50)[0]?.index).toBe(90)
  })

  it('wraps to the top when the caret sits past the last match', () => {
    expect(orderedMatchesFrom(matches, 500).map((match) => match.index)).toEqual([10, 40, 90])
  })

  it('keeps document order when the caret precedes every match', () => {
    expect(orderedMatchesFrom(matches, 0).map((match) => match.index)).toEqual([10, 40, 90])
  })
})

describe('selectionMatches', () => {
  it('accepts a selection equal to the query', () => {
    expect(selectionMatches('TextMark', 'TextMark', true)).toBe(true)
    expect(selectionMatches('textmark', 'TextMark', true)).toBe(false)
    expect(selectionMatches('textmark', 'TextMark', false)).toBe(true)
  })

  it('rejects an empty query and a partial selection', () => {
    expect(selectionMatches('Text', 'TextMark', true)).toBe(false)
    expect(selectionMatches('', '', true)).toBe(false)
  })
})

describe('replaceAllMatches', () => {
  it('rewrites every occurrence', () => {
    expect(replaceAllMatches('a cat and a cat', 'cat', 'dog', true)).toEqual({ contents: 'a dog and a dog', count: 2 })
  })

  it('reports zero and leaves the text alone when nothing matches', () => {
    expect(replaceAllMatches('a cat', 'bird', 'dog', true)).toEqual({ contents: 'a cat', count: 0 })
  })

  it('does not re-match text it has already replaced', () => {
    expect(replaceAllMatches('aa', 'a', 'aa', true)).toEqual({ contents: 'aaaa', count: 2 })
  })
})
