import { describe, expect, it } from 'vitest'
import {
  DRAFT_RECOVERY_KEY,
  listDraftRecords,
  removeDraftRecord,
  restoreDraftDocument,
  saveDraftRecord,
  type DraftStorage,
} from './draftRecovery'
import type { DocumentSession, TextDocument } from '../types'

function storage(): DraftStorage {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  }
}

const document: TextDocument = { path: '/tmp/guide.md', name: 'guide.md', contents: 'disk', revision: 'r1', modifiedMs: null, sizeBytes: 4 }
const session: DocumentSession = {
  ...document,
  id: 'session-1',
  contents: 'draft',
  savedContents: 'disk',
  diskContents: 'disk',
  dirty: true,
  scrollTop: 120,
  history: [{ path: document.path, scrollTop: 120 }],
  historyIndex: 0,
}

describe('draft recovery', () => {
  it('persists only dirty saved documents and restores matching revisions', () => {
    const store = storage()
    saveDraftRecord(session, store, 10)
    expect(store.getItem(DRAFT_RECOVERY_KEY)).toContain('draft')
    const record = listDraftRecords(store)[0]
    expect(restoreDraftDocument(document, record)).toMatchObject({ contents: 'draft', dirty: true, scrollTop: 120 })
    expect(restoreDraftDocument({ ...document, revision: 'r2' }, record)).toBeNull()
  })

  it('persists and restores an optional editor selection state', () => {
    const store = storage()
    saveDraftRecord(
      {
        ...session,
        editorState: {
          selection: { anchor: { line: 3, column: 2 }, head: { line: 3, column: 8 } },
          topLine: 2,
          scrollFraction: 0.25,
        },
      },
      store,
    )
    const record = listDraftRecords(store)[0]
    expect(record.editorState).toEqual({
      selection: { anchor: { line: 3, column: 2 }, head: { line: 3, column: 8 } },
      topLine: 2,
      scrollFraction: 0.25,
    })
    expect(restoreDraftDocument(document, record)?.editorState?.selection.head.column).toBe(8)
  })

  it('keeps legacy drafts without editor state readable', () => {
    const store = storage()
    saveDraftRecord(session, store)
    const record = listDraftRecords(store)[0]
    expect(restoreDraftDocument(document, record)?.editorState).toBeUndefined()
  })

  it('removes a draft after the document is resolved', () => {
    const store = storage()
    saveDraftRecord(session, store)
    removeDraftRecord(document.path, store)
    expect(listDraftRecords(store)).toEqual([])
  })
})
