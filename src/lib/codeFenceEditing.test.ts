import { describe, expect, it } from 'vitest'
import { codeFenceAutoCloseInsertion, editableCodeFenceAtLine, isCodeFenceBodyLine, rewriteCodeFenceLanguage } from './codeFenceEditing'

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

  it('keeps a completed fence editable from its closing marker', () => {
    expect(editableCodeFenceAtLine(document('```\nbody\n```'), 3)).toMatchObject({ lineNumber: 1, closingLineNumber: 3 })
  })

  it('does not treat a longer fence with info as a closing marker', () => {
    const source = '````markdown\n```js\nconst value = 1\n```\n````'
    expect(editableCodeFenceAtLine(document(source), 4)).toMatchObject({ lineNumber: 1, language: 'markdown' })
    expect(editableCodeFenceAtLine(document(source), 5)).toMatchObject({ closingLineNumber: 5 })
  })

  it('supports tilde fences and distinguishes body lines from markers', () => {
    const source = '~~~python title="app.py"\nprint("ready")\n~~~'
    const body = editableCodeFenceAtLine(document(source), 2)
    const closing = editableCodeFenceAtLine(document(source), 3)
    expect(body).toMatchObject({ language: 'python', metadata: 'title="app.py"' })
    expect(isCodeFenceBodyLine(body, 2)).toBe(true)
    expect(isCodeFenceBodyLine(closing, 3)).toBe(false)
  })

  it('creates a matching closing fence after the third marker', () => {
    expect(codeFenceAutoCloseInsertion('``', '', '`')).toEqual({ insert: '`\n\n```', cursorOffset: 2 })
    expect(codeFenceAutoCloseInsertion('  ~~', '', '~')).toEqual({ insert: '~\n\n  ~~~', cursorOffset: 2 })
    expect(codeFenceAutoCloseInsertion('text ``', '', '`')).toBeNull()
    expect(codeFenceAutoCloseInsertion('``', ' trailing', '`')).toBeNull()
  })
})
