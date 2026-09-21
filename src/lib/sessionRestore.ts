import type { SessionManifest, SessionWindowSnapshot } from './platform'

export interface ReadableSessionDocument {
  manifestIndex: number
  path: string
}

export interface RestoredSessionPlan {
  paths: string[]
  activePath: string | null
}

/**
 * Rebuild the session order from documents that were actually readable. The
 * manifest index is retained while reading so a deleted earlier tab cannot
 * make the active tab point at the wrong surviving document.
 */
export function planRestoredSession(snapshot: SessionWindowSnapshot, readableDocuments: ReadableSessionDocument[]): RestoredSessionPlan {
  const documents = readableDocuments.filter(
    (document, index) => document.path.length > 0 && readableDocuments.findIndex((candidate) => candidate.path === document.path) === index,
  )
  if (!documents.length) return { paths: [], activePath: null }
  const activeIndex = Math.min(Math.max(0, snapshot.activeIndex), Math.max(0, snapshot.documents.length - 1))
  const activePath = documents.find((document) => document.manifestIndex === activeIndex)?.path ?? documents[0].path
  return { paths: documents.map((document) => document.path), activePath }
}

export function sessionWindowById(manifest: SessionManifest | null, windowId: string): SessionWindowSnapshot | null {
  return manifest?.windows.find((window) => window.windowId === windowId) ?? null
}
