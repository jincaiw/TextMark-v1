import { describe, expect, it } from 'vitest'
import type { DocumentSession } from '../types'
import { canReplaceBootstrapDocument, shouldOpenDocumentInCurrentWindow } from './documentPresentation'

const session = (path: string | null, dirty = false): DocumentSession => ({
  id: path ?? 'blank',
  path,
  name: path?.split('/').pop() ?? 'Untitled.md',
  contents: '',
  savedContents: '',
  diskContents: '',
  dirty,
  scrollTop: 0,
  history: [{ path, scrollTop: 0 }],
  historyIndex: 0,
})

describe('document presentation policy', () => {
  it('reuses only a single clean bootstrap document', () => {
    expect(canReplaceBootstrapDocument([session(null)])).toBe(true)
    expect(canReplaceBootstrapDocument([session(null, true)])).toBe(false)
    expect(canReplaceBootstrapDocument([session('/tmp/one.md')])).toBe(false)
    expect(canReplaceBootstrapDocument([session(null), session('/tmp/two.md')])).toBe(false)
  })

  it('always honors explicit tabs and otherwise follows the preference', () => {
    const current = [session('/tmp/one.md')]
    expect(shouldOpenDocumentInCurrentWindow(current, false, false)).toBe(false)
    expect(shouldOpenDocumentInCurrentWindow(current, true, false)).toBe(true)
    expect(shouldOpenDocumentInCurrentWindow(current, false, true)).toBe(true)
  })
})
