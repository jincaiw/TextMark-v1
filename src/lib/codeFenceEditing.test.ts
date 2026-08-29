import { describe, expect, it } from 'vitest'
import { editableCodeFenceAtLine, rewriteCodeFenceLanguage } from './codeFenceEditing'

const document = (source: string) => {
  const lines = source.split('\n')
  let offset = 0
  return {
    lines: lines.length,
    line(number: number) {
      const text = lines[number - 1]
      const value = { from: offset, to: offset + text.length, text }
      offset += text.length + 1
      // The helper scans in increasing order, but this fixture should also be
      // safe for direct single-line inspection.
      if (number !== 1) {
        offset = lines.slice(0, number).reduce((sum, line) => sum + line.length + 1, 0)
      }
      return value
    },
  }
}

describe('editable code fences', () => {
  it('finds an enclosing fence and preserves metadata when changing language', () => {
    const source = '```ts title="app.ts"\nconst app = 1\n```'
    const fence = editableCodeFenceAtLine(document(source), 2)!
    expect(fence).toMatchObject({ lineNumber: 1, language: 'ts', metadata: 'title="app.ts"' })
    const rewrite = rewriteCodeFenceLanguage(fence, 'Swift!')
    expect(`${source.slice(0, rewrite.from)}${rewrite.insert}${source.slice(rewrite.to)}`).toBe(
      '```swift title="app.ts"\nconst app = 1\n```',
    )
  })

  it('does not expose a completed fence as editable', () => {
    expect(editableCodeFenceAtLine(document('```\nbody\n```'), 3)).toBeNull()
  })
})
