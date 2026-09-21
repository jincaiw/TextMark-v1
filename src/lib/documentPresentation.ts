import type { DocumentSession } from '../types'

/** A clean, pathless bootstrap document can be replaced without opening a new
 * window. Once the user has real document state, ordinary opens respect the
 * app-wide tabs preference. */
export function canReplaceBootstrapDocument(sessions: DocumentSession[]) {
  return sessions.length === 1 && !sessions[0].path && !sessions[0].dirty
}

export function shouldOpenDocumentInCurrentWindow(sessions: DocumentSession[], openDocumentsInTabs: boolean, explicitTab: boolean) {
  return explicitTab || openDocumentsInTabs || canReplaceBootstrapDocument(sessions)
}

export function partitionDroppedPaths(paths: string[]): { first: string | null; extras: string[] } {
  const unique = [...new Set(paths.filter((path) => path.trim().length > 0))]
  return { first: unique[0] ?? null, extras: unique.slice(1) }
}
