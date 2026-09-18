import { describe, expect, it } from 'vitest'
import { anchorForOffset, caretForReturnToEditor, caretToOffset, lineForAnchor, offsetForLine } from './readingPosition'

describe('reading position handoff', () => {
  it('locates an offset between two anchors', () => {
    expect(anchorForOffset([0, 100, 250], 0)).toEqual({ index: 0, progress: 0 })
    expect(anchorForOffset([0, 100, 250], 50)).toEqual({ index: 0, progress: 0.5 })
    expect(anchorForOffset([0, 100, 250], 175)).toEqual({ index: 1, progress: 0.5 })
    expect(anchorForOffset([0, 100, 250], 900)).toEqual({ index: 2, progress: 0 })
  })
  it('expands an anchor into the matching source line', () => {
    const lines = [1, 40, 90]
    expect(lineForAnchor(lines, { index: 0, progress: 0 })).toBe(1)
    expect(lineForAnchor(lines, { index: 0, progress: 0.5 })).toBe(21)
    expect(lineForAnchor(lines, { index: 1, progress: 0.8 })).toBe(80)
    expect(lineForAnchor(lines, { index: 2, progress: 0 })).toBe(90)
  })
  it('survives empty input instead of inventing a position', () => {
    expect(anchorForOffset([], 10)).toBeNull()
    expect(lineForAnchor([], null)).toBeNull()
    expect(lineForAnchor([1, 2], null)).toBeNull()
  })
  it('maps a source line back to a preview offset', () => {
    const map = { lines: [1, 40, 90], offsets: [0, 800, 2000] }
    expect(offsetForLine(map, 1)).toBe(0)
    expect(offsetForLine(map, 40)).toBe(800)
    expect(offsetForLine(map, 65)).toBe(1400)
    expect(offsetForLine(map, 500)).toBe(2000)
    expect(offsetForLine({ lines: [], offsets: [] }, 5)).toBeNull()
  })
})

describe('caret restoration', () => {
  it('restores the exact caret when the round trip ended where it started', () => {
    expect(caretForReturnToEditor(31, { topLine: 31, line: 44, column: 9 })).toEqual({ line: 44, column: 9 })
  })
  it('lets the reading anchor win when the reader moved in the preview', () => {
    expect(caretForReturnToEditor(58, { topLine: 31, line: 44, column: 9 })).toBeNull()
  })
  it('has nothing to restore before the editor has ever been on screen', () => {
    expect(caretForReturnToEditor(31, null)).toBeNull()
    expect(caretForReturnToEditor(null, { topLine: 31, line: 44, column: 9 })).toBeNull()
  })
  it('clamps a caret onto the line it lands on', () => {
    const lineStart = (line: number) => [0, 12, 30][line - 1] ?? 0
    const lineEnd = (line: number) => [11, 29, 47][line - 1] ?? 0
    expect(caretToOffset(null, lineStart, lineEnd, 3)).toBeNull()
    expect(caretToOffset({ line: 2, column: 1 }, lineStart, lineEnd, 3)).toBe(12)
    expect(caretToOffset({ line: 2, column: 7 }, lineStart, lineEnd, 3)).toBe(18)
    // A caret remembered from a longer line settles at the end of the shorter one.
    expect(caretToOffset({ line: 2, column: 90 }, lineStart, lineEnd, 3)).toBe(29)
    expect(caretToOffset({ line: 99, column: 4 }, lineStart, lineEnd, 3)).toBe(33)
  })
})
