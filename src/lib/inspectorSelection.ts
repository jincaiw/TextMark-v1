/**
 * Selected-range statistics for the inspector, mirroring the upstream
 * 0.0.70 behaviour: when the editor has a non-empty selection the words /
 * characters / lines rows count the selection and their labels gain a
 * "- Selected" suffix.
 */

export interface SelectionStats {
  words: number
  characters: number
  lines: number
}

export function selectionStatsFromText(text: string): SelectionStats {
  // Characters are grapheme clusters, matching the upstream `body.count` and
  // the document-level counter in App.tsx (code points split emoji modifiers).
  const segmenter = new Intl.Segmenter()
  return {
    words: text.split(/\s+/).filter(Boolean).length,
    characters: [...segmenter.segment(text)].length,
    lines: text.split(/\r\n|\r|\n/).length,
  }
}

export function isNonEmptySelection(
  selection: { anchor: { line: number; column: number }; head: { line: number; column: number } } | null | undefined,
): boolean {
  if (!selection) return false
  return selection.anchor.line !== selection.head.line || selection.anchor.column !== selection.head.column
}

/** Slice the source text between two (line, column) positions, both 1-based
 * lines and 1-based columns, matching SourcePosition. */
export function sliceSelection(source: string, from: { line: number; column: number }, to: { line: number; column: number }): string {
  const start = offsetAt(source, from)
  const end = offsetAt(source, to)
  return start <= end ? source.slice(start, end) : source.slice(end, start)
}

function offsetAt(source: string, position: { line: number; column: number }): number {
  const lines = source.split(/\r\n|\r|\n/)
  const lineIndex = Math.min(Math.max(position.line - 1, 0), lines.length - 1)
  let offset = 0
  for (let index = 0; index < lineIndex; index += 1) offset += lines[index].length + 1
  return offset + Math.min(Math.max(position.column - 1, 0), lines[lineIndex].length)
}
