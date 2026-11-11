// Fuzzy file matching replicating upstream FileSearchMatcher (v0.0.71): a
// case-insensitive subsequence alignment scored by dynamic programming, with
// whole-name exact/prefix tiers. The query route depends on whether it contains
// a slash: without one only the file name is matched, with one only the path.

export interface FileSearchCandidate {
  /** Last path component, shown as the row title. */
  name: string
  /** Relative path for project files, absolute path for recents. Matched on the
   * slash route and used for the length/locale tiebreaks. */
  path: string
}

export type MatchField = 'name' | 'path'

export interface FileMatch {
  score: number
  /** Which field the query matched (and whose characters should be bolded). */
  field: MatchField
  /** Coalesced [start, end) offset runs of matched characters in `field`. */
  ranges: Array<[number, number]>
}

export interface RankedFile<T extends FileSearchCandidate> {
  candidate: T
  match: FileMatch
}

const BOUNDARY_CHARS = new Set(['-', '_', '.', ' ', '/'])

// ASCII A–Z folds to lowercase; other characters take the first code point of
// their lowercase form (upstream `lowercased().first`), with no diacritic strip.
function foldChar(char: string): string {
  const lower = char.toLowerCase()
  return Array.from(lower)[0] ?? char
}

function foldString(value: string): string {
  return Array.from(value).map(foldChar).join('')
}

const isLower = (char: string) => char >= 'a' && char <= 'z'
const isUpper = (char: string) => char >= 'A' && char <= 'Z'
const isDigit = (char: string) => char >= '0' && char <= '9'
const isLetter = (char: string) => isLower(char) || isUpper(char)

interface Alignment {
  score: number
  /** Matched candidate offsets, ascending, for highlight backtracking. */
  positions: number[]
}

// Best-scoring alignment of `query` (folded) as a subsequence of `text`. The
// candidate's original characters drive the boundary/camel bonuses; `folded`
// drives equality. Returns null when the query is not a subsequence.
function align(query: string[], folded: string[], original: string[]): Alignment | null {
  const n = query.length
  const m = folded.length
  if (n === 0) return { score: 0, positions: [] }
  if (n > m) return null
  // score[i][j]: best score matching query[0..i] with query[i] placed at text[j].
  // prevBest[i][j]: max score[i][k] for k <= j (the best gapped predecessor).
  const score: number[][] = Array.from({ length: n }, () => new Array<number>(m).fill(-Infinity))
  const prevBest: number[][] = Array.from({ length: n }, () => new Array<number>(m).fill(-Infinity))
  const trace: number[][] = Array.from({ length: n }, () => new Array<number>(m).fill(-1))

  const charBonus = (j: number): number => {
    let bonus = 16
    const prev = j > 0 ? original[j - 1] : ''
    if (j === 0 || BOUNDARY_CHARS.has(prev)) bonus += 24
    const current = original[j]
    if (j > 0 && ((isLower(prev) && isUpper(current)) || (isDigit(prev) && isLetter(current)))) bonus += 18
    return bonus
  }

  for (let i = 0; i < n; i += 1) {
    for (let j = i; j < m; j += 1) {
      if (query[i] === folded[j]) {
        const bonus = charBonus(j)
        if (i === 0) {
          score[i][j] = bonus - Math.min(j, 20)
          trace[i][j] = -1
        } else {
          // Contiguous: previous query char matched at j-1.
          const contiguous = score[i - 1][j - 1] > -Infinity ? score[i - 1][j - 1] + bonus + 20 : -Infinity
          // Gapped: best previous placement anywhere before j, flat -8 penalty.
          const gappedBase = prevBest[i - 1][j - 1]
          const gapped = gappedBase > -Infinity ? gappedBase + bonus - 8 : -Infinity
          // Ties prefer contiguous over gapped.
          if (contiguous >= gapped) {
            score[i][j] = contiguous
            trace[i][j] = j - 1
          } else {
            score[i][j] = gapped
            // Recover which k achieved prevBest[i-1][j-1].
            let k = j - 1
            while (k > 0 && score[i - 1][k] !== prevBest[i - 1][j - 1]) k -= 1
            trace[i][j] = k
          }
        }
      }
      // Carry the running best forward even when this column does not match,
      // so a later query character can gap back to the best earlier placement.
      prevBest[i][j] = j > 0 ? Math.max(prevBest[i][j - 1], score[i][j]) : score[i][j]
    }
  }

  let bestJ = -1
  let bestScore = -Infinity
  for (let j = n - 1; j < m; j += 1) {
    if (score[n - 1][j] > bestScore) {
      bestScore = score[n - 1][j]
      bestJ = j
    }
  }
  if (bestJ < 0) return null
  const positions: number[] = []
  let i = n - 1
  let j = bestJ
  while (i >= 0 && j >= 0) {
    positions.push(j)
    const previous = trace[i][j]
    j = previous
    i -= 1
  }
  positions.reverse()
  return { score: bestScore, positions }
}

function coalesce(positions: number[]): Array<[number, number]> {
  const ranges: Array<[number, number]> = []
  for (const position of positions) {
    const last = ranges[ranges.length - 1]
    if (last && last[1] === position) last[1] = position + 1
    else ranges.push([position, position + 1])
  }
  return ranges
}

/** Match one candidate against the query, or null when it does not match. */
export function matchFile(query: string, candidate: FileSearchCandidate): FileMatch | null {
  const trimmed = query.trim()
  const foldedQuery = Array.from(foldString(trimmed))
  const pathRoute = trimmed.includes('/')
  const field: MatchField = pathRoute ? 'path' : 'name'
  const text = pathRoute ? candidate.path : candidate.name
  const original = Array.from(text)
  const folded = Array.from(foldString(text))
  const alignment = align(foldedQuery, folded, original)
  if (!alignment) return null
  let score = alignment.score
  // Whole-name tiers dominate the per-character score (name route only). A blank
  // query matches everything with score 0 and never earns a tier.
  if (!pathRoute && foldedQuery.length > 0) {
    const foldedName = folded.join('')
    const foldedTrimmed = foldedQuery.join('')
    if (foldedName === foldedTrimmed) score += 1_000_000
    else if (foldedName.startsWith(foldedTrimmed)) score += 100_000
  }
  return { score, field, ranges: coalesce(alignment.positions) }
}

const comparePaths = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }) || (a < b ? -1 : a > b ? 1 : 0)

/** Rank candidates by relevance: score desc, then shorter path, then locale
 * case-insensitive path compare, then raw order. Non-matches are dropped. */
export function rankFiles<T extends FileSearchCandidate>(query: string, candidates: T[]): Array<RankedFile<T>> {
  const ranked: Array<RankedFile<T>> = []
  for (const candidate of candidates) {
    const match = matchFile(query, candidate)
    if (match) ranked.push({ candidate, match })
  }
  ranked.sort((a, b) => {
    if (b.match.score !== a.match.score) return b.match.score - a.match.score
    if (a.candidate.path.length !== b.candidate.path.length) return a.candidate.path.length - b.candidate.path.length
    return comparePaths(a.candidate.path, b.candidate.path)
  })
  return ranked
}
