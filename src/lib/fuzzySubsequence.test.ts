import { describe, expect, it } from 'vitest'
import { fuzzySubsequenceMatch } from './fuzzySubsequence'

describe('fuzzySubsequenceMatch', () => {
  it('chooses a stronger word-boundary alignment over the earliest greedy hit', () => {
    expect(fuzzySubsequenceMatch('ab', 'a---ab')?.positions).toEqual([4, 5])
  })

  it('returns null when the query is not a subsequence', () => {
    expect(fuzzySubsequenceMatch('xyz', 'xylophone')).toBeNull()
  })

  it('trims the query and matches without case sensitivity', () => {
    expect(fuzzySubsequenceMatch('  fb ', 'FooBar')?.positions).toEqual([0, 3])
  })
})
