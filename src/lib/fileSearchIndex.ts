// Builds the file-search candidate set the way upstream ProjectFileIndex does:
// the sidebar-mounted project folder walked for Markdown files (dependency
// directories pruned, depth and file caps), plus the app-wide recent documents.
import type { FileNode } from '../types'
import type { FileSearchCandidate } from './fileSearchMatcher'

export const MARKDOWN_EXTENSIONS = ['md', 'markdown', 'mdown', 'mkd', 'mdwn', 'mdx']
const RECENT_EXTENSIONS = [...MARKDOWN_EXTENSIONS, 'txt']
const PRUNED_DIRECTORIES = new Set(['node_modules', 'DerivedData', 'build', 'Pods', 'Carthage', 'vendor', 'target', 'venv', '__pycache__'])
const MAX_DEPTH = 12
const MAX_FILES = 20_000
const MAX_RECENTS = 10

export interface IndexedFile extends FileSearchCandidate {
  /** Absolute path used to open the file and render its breadcrumb subtitle. */
  absolutePath: string
  /** True for rows sourced from the recent-documents list. */
  isRecent: boolean
}

const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

const isMarkdown = (name: string) => MARKDOWN_EXTENSIONS.includes(extensionOf(name))

/** Normalize an absolute path for identity dedupe (separator + trailing slash). */
export function normalizeIdentity(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

function relativeTo(root: string, absolutePath: string): string {
  const normalizedRoot = root.replace(/\\/g, '/').replace(/\/+$/, '')
  const normalizedPath = absolutePath.replace(/\\/g, '/')
  if (normalizedPath.startsWith(`${normalizedRoot}/`)) return normalizedPath.slice(normalizedRoot.length + 1)
  return normalizedPath
}

/** Flatten the project tree to Markdown files, pruning dependency/hidden dirs,
 * honoring the depth and file caps. `truncated` is true when the cap was hit. */
export function flattenProjectFiles(nodes: FileNode[], root: string): { files: IndexedFile[]; truncated: boolean } {
  const files: IndexedFile[] = []
  let truncated = false
  const walk = (list: FileNode[], depth: number) => {
    for (const node of list) {
      if (truncated) return
      if (node.name.startsWith('.')) continue
      if (node.isDirectory) {
        if (PRUNED_DIRECTORIES.has(node.name) || depth >= MAX_DEPTH) continue
        walk(node.children, depth + 1)
      } else if (isMarkdown(node.name)) {
        if (files.length >= MAX_FILES) {
          truncated = true
          return
        }
        files.push({
          name: node.name,
          path: relativeTo(root, node.path),
          absolutePath: node.path,
          isRecent: false,
        })
      }
    }
  }
  walk(nodes, 0)
  return { files, truncated }
}

/** Recent documents filtered to Markdown + txt, deduped by identity, newest
 * first, capped. The incoming order is the system recency order. */
export function recentCandidates(paths: string[]): IndexedFile[] {
  const seen = new Set<string>()
  const result: IndexedFile[] = []
  for (const path of paths) {
    const name = path.replace(/\\/g, '/').split('/').pop() ?? path
    if (!RECENT_EXTENSIONS.includes(extensionOf(name))) continue
    const identity = normalizeIdentity(path)
    if (seen.has(identity)) continue
    seen.add(identity)
    result.push({ name, path, absolutePath: path, isRecent: true })
    if (result.length >= MAX_RECENTS) break
  }
  return result
}
