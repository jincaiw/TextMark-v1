export interface FuzzySubsequenceMatch {
  score: number
  positions: number[]
}

interface FuzzySubsequenceScore {
  score: number
}

const UNREACHABLE = Number.MIN_SAFE_INTEGER
const DELIMITERS = new Set(['-', '_', '.', ' ', '/'])

function fold(character: string) {
  return Array.from(character.toLocaleLowerCase())[0] ?? character
}

function boundaryBonus(characters: string[], index: number) {
  if (index === 0 || DELIMITERS.has(characters[index - 1])) return 24
  const previous = characters[index - 1]
  const current = characters[index]
  if ((/[a-z]/.test(previous) && /[A-Z]/.test(current)) || (/[0-9]/.test(previous) && /\p{L}/u.test(current))) return 18
  return 0
}

function alignSubsequence(query: string, text: string, includePositions: true): FuzzySubsequenceMatch | null
function alignSubsequence(query: string, text: string, includePositions: false): FuzzySubsequenceScore | null
function alignSubsequence(query: string, text: string, includePositions: boolean): FuzzySubsequenceMatch | FuzzySubsequenceScore | null {
  const queryCharacters = Array.from(query.trim()).map(fold)
  const characters = Array.from(text)
  if (!queryCharacters.length || queryCharacters.length > characters.length) return null

  const foldedText = characters.map(fold)
  let next = 0
  for (const character of foldedText) {
    if (character === queryCharacters[next]) next += 1
    if (next === queryCharacters.length) break
  }
  if (next !== queryCharacters.length) return null

  const rows = queryCharacters.length
  const columns = characters.length
  let previous = Array<number>(columns).fill(UNREACHABLE)
  let current = Array<number>(columns).fill(UNREACHABLE)
  const parents = includePositions ? Array<number>(rows * columns).fill(-1) : null

  for (let row = 0; row < rows; row += 1) {
    let gapBest = UNREACHABLE
    let gapBestColumn = -1
    current.fill(UNREACHABLE)

    for (let column = 0; column < columns; column += 1) {
      if (row > 0 && column >= 2 && previous[column - 2] > gapBest) {
        gapBest = previous[column - 2]
        gapBestColumn = column - 2
      }
      if (foldedText[column] !== queryCharacters[row]) continue

      const bonus = 16 + boundaryBonus(characters, column)
      if (row === 0) {
        current[column] = bonus - Math.min(column, 20)
        continue
      }

      let best = UNREACHABLE
      let parent = -1
      if (column >= 1 && previous[column - 1] !== UNREACHABLE) {
        best = previous[column - 1] + 20
        parent = column - 1
      }
      if (gapBest !== UNREACHABLE && gapBest - 8 > best) {
        best = gapBest - 8
        parent = gapBestColumn
      }
      if (parent >= 0) {
        current[column] = best + bonus
        if (parents) parents[row * columns + column] = parent
      }
    }
    ;[previous, current] = [current, previous]
  }

  let bestColumn = -1
  let bestScore = UNREACHABLE
  for (let column = 0; column < columns; column += 1) {
    if (previous[column] > bestScore) {
      bestScore = previous[column]
      bestColumn = column
    }
  }
  if (bestColumn < 0) return null

  if (!includePositions) return { score: bestScore }

  const positions = Array<number>(rows)
  let column = bestColumn
  for (let row = rows - 1; row >= 0; row -= 1) {
    positions[row] = column
    column = parents![row * columns + column]
  }
  return { score: bestScore, positions }
}

/** Score the strongest fuzzy alignment without allocating highlight backtracking data. */
export function fuzzySubsequenceScore(query: string, text: string): number | null {
  return alignSubsequence(query, text, false)?.score ?? null
}

/** Find the strongest fuzzy alignment, favoring contiguous runs and name boundaries. */
export function fuzzySubsequenceMatch(query: string, text: string): FuzzySubsequenceMatch | null {
  return alignSubsequence(query, text, true)
}
