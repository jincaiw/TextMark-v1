/** Source-position handoff between the preview and the editor.
 *
 * The preview and the editor lay out the same document with different metrics,
 * so a pixel scroll fraction is only an approximation. Headings exist in both
 * surfaces, so they are used as anchors: the reading position is expressed as
 * "inside block N, this far towards block N+1" and then re-expanded into a
 * source line on the other side. */

export interface ReadingAnchor {
  index: number
  progress: number
}

/** A heading map for one surface: source lines paired with pixel offsets. */
export interface ReadingAnchorMap {
  /** Source line of each anchor (heading). */
  lines: number[]
  /** Pixel offset of each anchor inside the scrolling surface. */
  offsets: number[]
}

/** Locates `offset` between two ascending anchor offsets. */
export function anchorForOffset(offsets: number[], offset: number): ReadingAnchor | null {
  if (!offsets.length) return null
  let index = 0
  for (let candidate = 0; candidate < offsets.length; candidate += 1) {
    if (offsets[candidate] <= offset) index = candidate
    else break
  }
  const current = offsets[index]
  const next = offsets[index + 1]
  if (next == null || next <= current) return { index, progress: 0 }
  return { index, progress: Math.min(1, Math.max(0, (offset - current) / (next - current))) }
}

/** Expands an anchor back into a source line, interpolating between the two
 * bracketing headings' source lines. */
export function lineForAnchor(lines: number[], anchor: ReadingAnchor | null): number | null {
  if (!anchor || !lines.length) return null
  const current = lines[anchor.index]
  if (current == null) return null
  const next = lines[anchor.index + 1]
  if (next == null || next <= current) return current
  return Math.max(1, Math.round(current + anchor.progress * (next - current)))
}

/** Reverse direction: locate a source line between two heading lines and
 * re-expand it into a pixel offset on the other surface. */
export function offsetForLine(map: ReadingAnchorMap, line: number): number | null {
  if (!map.lines.length || !map.offsets.length) return null
  const anchor = anchorForOffset(map.lines, line)
  if (!anchor) return null
  const current = map.offsets[anchor.index]
  if (current == null) return null
  const next = map.offsets[anchor.index + 1]
  if (next == null || next <= current) return current
  return current + anchor.progress * (next - current)
}

/** Caret left behind when the editor was last on screen. */
export interface EditorExitCaret {
  /** Source line the editor viewport was showing. */
  topLine: number | null
  line: number
  column: number
}

/** Whether the caret can be restored verbatim when returning to the editor.
 *
 * An output action (export, print) and a mode switch both unmount the editor,
 * and the caret is part of the editor's own state. It may only be restored
 * when the round trip ends on the line the editor was showing — that means the
 * reader did not move, so the caret is still where they left it. If the anchor
 * has moved, the reader *has* moved and expects the caret to follow them.
 */
export function caretForReturnToEditor(anchorLine: number | null, exit: EditorExitCaret | null) {
  if (!exit || anchorLine == null || exit.topLine !== anchorLine) return null
  return { line: exit.line, column: exit.column }
}

/** Clamps a line/column pair onto one line of a document of `size` characters. */
export function caretToOffset(
  caret: { line: number; column: number } | null,
  lineStart: (line: number) => number,
  lineEnd: (line: number) => number,
  lineCount: number,
): number | null {
  if (!caret) return null
  const line = Math.min(Math.max(1, Math.round(caret.line)), lineCount)
  const start = lineStart(line)
  const end = lineEnd(line)
  return Math.min(Math.max(start, start + Math.max(0, caret.column - 1)), end)
}
