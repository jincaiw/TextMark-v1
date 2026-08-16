import { MARKDOWN_EXTENSIONS } from '../constants'
import type { DiskChangeEvent } from '../types'

function normalized(path: string): string {
  const slashPath = path.replace(/\\/g, '/').replace(/\/+$/, '')
  return /^[a-z]:\//i.test(slashPath) ? slashPath.toLocaleLowerCase('en-US') : slashPath
}

export function samePath(left: string, right: string): boolean {
  return normalized(left) === normalized(right)
}

function directory(path: string): string {
  const value = normalized(path)
  const separator = value.lastIndexOf('/')
  return separator < 0 ? '' : value.slice(0, separator)
}

function isSupportedDocument(path: string): boolean {
  const name = normalized(path).split('/').pop() ?? ''
  const extension = name.includes('.') ? name.split('.').pop()?.toLocaleLowerCase('en-US') : ''
  return Boolean(extension && MARKDOWN_EXTENSIONS.includes(extension))
}

export function eventAffectsPath(event: DiskChangeEvent, path: string): boolean {
  return event.paths.some((changedPath) => samePath(changedPath, path))
}

export function renamedDestinationInDirectory(event: DiskChangeEvent, originalPath: string): string | null {
  if (event.kind !== 'rename') return null
  const originalDirectory = directory(originalPath)
  for (let index = event.paths.length - 1; index >= 0; index -= 1) {
    const candidate = event.paths[index]
    if (!samePath(candidate, originalPath) && directory(candidate) === originalDirectory && isSupportedDocument(candidate)) return candidate
  }
  return null
}

export function renamedDocumentCandidate(event: DiskChangeEvent, originalPath: string): string | null {
  if (event.kind !== 'rename' || !eventAffectsPath(event, originalPath)) return null
  return renamedDestinationInDirectory(event, originalPath)
}

export function resolveChangedDocumentPath(
  originalPath: string,
  originalExists: boolean,
  event: DiskChangeEvent,
  pairedDestination: string | null = null,
): string | null {
  if (originalExists) return originalPath
  return renamedDocumentCandidate(event, originalPath) ?? pairedDestination
}
