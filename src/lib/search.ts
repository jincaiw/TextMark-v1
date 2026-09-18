import type { SearchMode } from '../types'

/**
 * Shared matching core for the find bar.
 *
 * The preview highlights search hits in rendered DOM text and the editor
 * highlights them in source text; both must agree on what counts as a match,
 * otherwise the match counter, the cycle order and “replace” disagree with the
 * highlights the user sees. Keeping the pattern builder here is what makes the
 * two panes consistent.
 */
export interface SearchMatch {
  /** Offset of the match in the searched string. */
  index: number
  /** Length of the matched text. */
  length: number
}

export const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** `beginsWith` matches at a word boundary, mirroring the preview's behaviour. */
export function buildSearchPattern(query: string, matchCase: boolean, mode: SearchMode): RegExp {
  const prefix = mode === 'beginsWith' ? '\\b' : ''
  return new RegExp(`${prefix}${escapeRegExp(query)}`, matchCase ? 'g' : 'gi')
}

export function searchMatchOffsets(source: string, query: string, matchCase: boolean, mode: SearchMode = 'contains'): SearchMatch[] {
  if (!query) return []
  const pattern = buildSearchPattern(query, matchCase, mode)
  const matches: SearchMatch[] = []
  let match = pattern.exec(source)
  while (match) {
    matches.push({ index: match.index, length: match[0].length })
    if (!match[0].length) pattern.lastIndex += 1
    match = pattern.exec(source)
  }
  return matches
}

/**
 * Matches re-ordered so the first one starts at or after `from`. When the
 * search runs off the end it wraps to the top of the document, which is what
 * makes “replace” work even though the caret usually sits far away from the
 * query the user just typed in the find bar.
 */
export function orderedMatchesFrom(matches: SearchMatch[], from: number): SearchMatch[] {
  const pivot = matches.findIndex((match) => match.index >= from)
  return pivot <= 0 ? matches : [...matches.slice(pivot), ...matches.slice(0, pivot)]
}

/** True when the current editor selection is itself a match for the query. */
export function selectionMatches(selected: string, query: string, matchCase: boolean): boolean {
  if (!query) return false
  return matchCase ? selected === query : selected.toLocaleLowerCase() === query.toLocaleLowerCase()
}

/** Replaces every match; `count` is 0 when nothing matched. */
export function replaceAllMatches(
  source: string,
  query: string,
  replacement: string,
  matchCase: boolean,
  mode: SearchMode = 'contains',
): { contents: string; count: number } {
  const matches = searchMatchOffsets(source, query, matchCase, mode)
  if (!matches.length) return { contents: source, count: 0 }
  let contents = ''
  let cursor = 0
  for (const match of matches) {
    contents += source.slice(cursor, match.index) + replacement
    cursor = match.index + match.length
  }
  contents += source.slice(cursor)
  return { contents, count: matches.length }
}
