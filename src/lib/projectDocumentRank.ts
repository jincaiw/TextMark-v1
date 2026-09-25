import { fuzzySubsequenceMatch, fuzzySubsequenceScore } from './fuzzySubsequence'

export interface SearchEntry {
  name: string
  path: string
  relativePath: string
  relativePathLength: number
}

export interface SearchResult {
  entry: SearchEntry
  score: number
  positions: number[]
}

const pathCollator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

function score(entry: SearchEntry, query: string): number | null {
  const searchPath = query.includes('/')
  const field = searchPath ? entry.relativePath : entry.name
  const matchScore = fuzzySubsequenceScore(query, field)
  if (matchScore === null) return null
  const name = entry.name.toLocaleLowerCase()
  const needle = query.toLocaleLowerCase()
  const tierBonus = searchPath ? 0 : name === needle ? 1_000_000 : name.startsWith(needle) ? 100_000 : 0
  return matchScore + tierBonus
}

/** Rank candidates cheaply, then calculate highlight positions for visible rows only. */
export function rankProjectDocuments(entries: SearchEntry[], query: string): SearchResult[] {
  const normalizedQuery = query.trim()
  if (!normalizedQuery) return []
  return entries
    .map((entry) => ({ entry, score: score(entry, normalizedQuery) }))
    .filter((item): item is { entry: SearchEntry; score: number } => item.score !== null)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.entry.relativePathLength - b.entry.relativePathLength ||
        pathCollator.compare(a.entry.relativePath, b.entry.relativePath) ||
        a.entry.relativePath.localeCompare(b.entry.relativePath),
    )
    .slice(0, 30)
    .map(({ entry, score: resultScore }) => {
      const field = normalizedQuery.includes('/') ? entry.relativePath : entry.name
      return { entry, score: resultScore, positions: fuzzySubsequenceMatch(normalizedQuery, field)?.positions ?? [] }
    })
}
