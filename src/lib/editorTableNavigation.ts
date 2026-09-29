import { markdownTableCellRanges, markdownTableLines } from './editorMarkdownDecorations'

export interface MarkdownTableNavigationPlan {
  handled: boolean
  selection?: number
  change?: { from: number; insert: string }
}

interface CellPosition {
  table: number
  line: number
  from: number
  to: number
  column: number
}

function isSeparatorRow(line: string) {
  const cells = markdownTableCellRanges(line)
  return cells.length > 0 && cells.every((cell) => /^\s*:?-{3,}:?\s*$/.test(line.slice(cell.from, cell.to)))
}

function cellCaretPosition(source: string, cell: CellPosition) {
  const lineStart = source.lastIndexOf('\n', cell.from - 1) + 1
  const text = source.slice(lineStart, source.indexOf('\n', lineStart) < 0 ? source.length : source.indexOf('\n', lineStart))
  const rangeStart = cell.from - lineStart
  const leadingWhitespace = text.slice(rangeStart, cell.to - lineStart).match(/^\s*/)?.[0].length ?? 0
  return Math.min(cell.to, cell.from + leadingWhitespace)
}

/** Finds the next/previous visible cell in a Markdown table. At the end of a
 * table, forward navigation inserts a blank source row and places the caret
 * in its first cell. The document remains ordinary editable Markdown. */
export function markdownTableNavigationPlan(source: string, position: number, direction: 'next' | 'previous'): MarkdownTableNavigationPlan {
  const lines = source.split(/\r?\n/)
  const lineStarts: number[] = []
  let offset = 0
  lines.forEach((line, index) => {
    lineStarts.push(offset)
    offset += line.length
    if (index < lines.length - 1) offset += source.slice(offset, offset + 2) === '\r\n' ? 2 : 1
  })
  let lineIndex = 0
  for (let index = 0; index < lineStarts.length; index += 1) if (lineStarts[index] <= position) lineIndex = index
  const lineNumber = lineIndex + 1
  const tableLines = markdownTableLines(source)
  if (!tableLines.has(lineNumber)) return { handled: false }

  const cells: CellPosition[] = []
  const tableByLine = new Map<number, number>()
  let table = -1
  let previousWasTableLine = false
  for (let index = 0; index < lines.length; index += 1) {
    const currentLineNumber = index + 1
    const isTableLine = tableLines.has(currentLineNumber)
    if (isTableLine && !previousWasTableLine) table += 1
    if (isTableLine) tableByLine.set(currentLineNumber, table)
    if (isTableLine && !isSeparatorRow(lines[index])) {
      for (const [column, range] of markdownTableCellRanges(lines[index]).entries())
        cells.push({ table, line: currentLineNumber, from: lineStarts[index] + range.from, to: lineStarts[index] + range.to, column })
    }
    previousWasTableLine = isTableLine
  }

  const currentTable = tableByLine.get(lineNumber)
  const currentCells = cells.filter((cell) => cell.table === currentTable)
  if (currentTable === undefined || currentCells.length === 0) return { handled: true }

  const onCurrentLine = currentCells.filter((cell) => cell.line === lineNumber)
  const current =
    onCurrentLine.find((cell) => position >= cell.from && position <= cell.to) ??
    [...onCurrentLine].sort(
      (left, right) =>
        Math.min(Math.abs(position - left.from), Math.abs(position - left.to)) -
        Math.min(Math.abs(position - right.from), Math.abs(position - right.to)),
    )[0]

  let target: CellPosition | undefined
  if (current) {
    const index = currentCells.indexOf(current)
    target = currentCells[index + (direction === 'next' ? 1 : -1)]
  } else {
    target =
      direction === 'next'
        ? currentCells.find((cell) => cell.line > lineNumber)
        : [...currentCells].reverse().find((cell) => cell.line < lineNumber)
  }

  if (target) return { handled: true, selection: cellCaretPosition(source, target) }
  if (direction !== 'next' || !current || currentCells.indexOf(current) !== currentCells.length - 1) return { handled: true }

  const lastLineNumber = Math.max(...currentCells.map((cell) => cell.line))
  const lastLineIndex = lastLineNumber - 1
  const lastLine = lines[lastLineIndex]
  const lastLineStart = lineStarts[lastLineIndex]
  const columns = Math.max(...currentCells.filter((cell) => cell.line === lastLineNumber).map((cell) => cell.column + 1))
  const lineSeparator = source.match(/\r\n|\n/)?.[0] ?? '\n'
  const insert = `${lineSeparator}| ${Array(columns).fill('').join(' | ')} |`
  return {
    handled: true,
    change: { from: lastLineStart + lastLine.length, insert },
    selection: lastLineStart + lastLine.length + lineSeparator.length + 2,
  }
}
