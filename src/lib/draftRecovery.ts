import type { DocumentSession, EditorSessionState, TextDocument } from '../types'

export const DRAFT_RECOVERY_VERSION = 1
export const DRAFT_RECOVERY_KEY = 'textmark.drafts.v1'

export interface DraftRecord {
  version: typeof DRAFT_RECOVERY_VERSION
  path: string
  name: string
  contents: string
  diskContents: string
  diskRevision: string
  scrollTop: number
  editorState?: EditorSessionState
  updatedAt: number
}

export type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function readRecords(storage: DraftStorage): DraftRecord[] {
  const raw = storage.getItem(DRAFT_RECOVERY_KEY)
  if (!raw) return []
  try {
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) return []
    return value.filter(isDraftRecord)
  } catch {
    return []
  }
}

function isDraftRecord(value: unknown): value is DraftRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<DraftRecord>
  return (
    record.version === DRAFT_RECOVERY_VERSION &&
    typeof record.path === 'string' &&
    record.path.length > 0 &&
    typeof record.name === 'string' &&
    typeof record.contents === 'string' &&
    typeof record.diskContents === 'string' &&
    typeof record.diskRevision === 'string' &&
    Number.isFinite(record.scrollTop) &&
    (record.editorState === undefined || isEditorSessionState(record.editorState)) &&
    Number.isFinite(record.updatedAt)
  )
}

function isEditorSessionState(value: unknown): value is EditorSessionState {
  if (!value || typeof value !== 'object') return false
  const state = value as Partial<EditorSessionState>
  const validPosition = (position: unknown) => {
    if (!position || typeof position !== 'object') return false
    const candidate = position as { line?: unknown; column?: unknown }
    return Number.isFinite(candidate.line) && Number.isFinite(candidate.column)
  }
  return (
    (state.topLine === null || Number.isFinite(state.topLine)) &&
    Number.isFinite(state.scrollFraction) &&
    Boolean(state.selection && validPosition(state.selection.anchor) && validPosition(state.selection.head))
  )
}

function writeRecords(storage: DraftStorage, records: DraftRecord[]) {
  if (records.length) storage.setItem(DRAFT_RECOVERY_KEY, JSON.stringify(records))
  else storage.removeItem(DRAFT_RECOVERY_KEY)
}

export function saveDraftRecord(session: DocumentSession, storage: DraftStorage = localStorage, now = Date.now()): void {
  if (!session.path || !session.dirty || !session.revision) return
  const record: DraftRecord = {
    version: DRAFT_RECOVERY_VERSION,
    path: session.path,
    name: session.name,
    contents: session.contents,
    diskContents: session.diskContents,
    diskRevision: session.revision,
    scrollTop: session.scrollTop,
    editorState: session.editorState,
    updatedAt: now,
  }
  const records = readRecords(storage).filter((candidate) => candidate.path !== session.path)
  writeRecords(storage, [...records, record])
}

export function removeDraftRecord(path: string | null, storage: DraftStorage = localStorage): void {
  if (!path) return
  writeRecords(
    storage,
    readRecords(storage).filter((record) => record.path !== path),
  )
}

export function listDraftRecords(storage: DraftStorage = localStorage): DraftRecord[] {
  return readRecords(storage).sort((left, right) => right.updatedAt - left.updatedAt)
}

export function restoreDraftDocument(
  document: TextDocument,
  record: DraftRecord,
): (TextDocument & { dirty: true; scrollTop: number; editorState?: EditorSessionState }) | null {
  if (!document.path || document.path !== record.path || document.revision !== record.diskRevision) return null
  return {
    ...document,
    contents: record.contents,
    dirty: true,
    scrollTop: record.scrollTop,
    editorState: record.editorState,
  }
}
