import { describe, expect, it } from 'vitest'
import { matchFile, rankFiles, type FileSearchCandidate } from './fileSearchMatcher'

const file = (path: string): FileSearchCandidate => ({ name: path.split('/').pop() ?? path, path })

describe('file search matcher', () => {
  it('matches a case-insensitive subsequence with gaps allowed', () => {
    expect(matchFile('rd', file('README.md'))).not.toBeNull()
    expect(matchFile('RDM', file('README.md'))).not.toBeNull()
    expect(matchFile('zzz', file('README.md'))).toBeNull()
    expect(matchFile('read', file('thread.md'))).not.toBeNull()
  })

  it('returns no rows for a non-subsequence query', () => {
    expect(rankFiles('zzz', [file('README.md'), file('notes.md')])).toEqual([])
  })

  it('ranks exact name above prefix above scattered (query "read")', () => {
    const ranked = rankFiles('read', [file('thread.md'), file('reading-list.md'), file('README.md')])
    expect(ranked.map((r) => r.candidate.name)).toEqual(['README.md', 'reading-list.md', 'thread.md'])
    // Exact and prefix hits carry the whole-name tiers.
    expect(ranked[0].match.score).toBeGreaterThanOrEqual(100_000)
    expect(ranked[2].match.score).toBeLessThan(100_000)
  })

  it('ranks an exact full-name match above a mere prefix', () => {
    const ranked = rankFiles('readme.md', [file('readme.md.bak'), file('readme.md')])
    expect(ranked[0].candidate.name).toBe('readme.md')
    expect(ranked[0].match.score).toBeGreaterThanOrEqual(1_000_000)
  })

  it('prefers the name prefix for query "md"', () => {
    const ranked = rankFiles('md', [file('README.md'), file('notes.md'), file('md-notes.md')])
    expect(ranked[0].candidate.name).toBe('md-notes.md')
    expect(ranked[0].match.score).toBeGreaterThanOrEqual(100_000)
  })

  it('breaks score ties by shorter path then locale order', () => {
    const ranked = rankFiles('read', [file('b/reading-list.md'), file('a/reading-list.md'), file('README.md')])
    // README.md and reading-list.md tie on the prefix tier; README.md is shorter.
    expect(ranked[0].candidate.name).toBe('README.md')
    // The two equal-length reading-list paths tie on score and length; locale wins.
    const lists = ranked.filter((r) => r.candidate.name === 'reading-list.md')
    expect(lists[0].candidate.path).toBe('a/reading-list.md')
  })

  it('matches the name route by default and bolds name characters', () => {
    const match = matchFile('read', file('docs/README.md'))!
    expect(match.field).toBe('name')
    expect(match.ranges).toEqual([[0, 4]])
  })

  it('switches to the path route when the query contains a slash', () => {
    const match = matchFile('docs/read', file('docs/README.md'))!
    expect(match.field).toBe('path')
    expect(matchFile('docs/read', file('other/README.md'))).toBeNull()
    // Highlight runs coalesce contiguous matched characters.
    expect(match.ranges.length).toBeGreaterThan(0)
  })

  it('treats a blank query as matching everything with zero score', () => {
    const match = matchFile('   ', file('README.md'))!
    expect(match.score).toBe(0)
    expect(match.ranges).toEqual([])
  })

  it('does not fold diacritics (é is not e)', () => {
    expect(matchFile('cafe', file('café.md'))).toBeNull()
    expect(matchFile('café', file('café.md'))).not.toBeNull()
  })
})
