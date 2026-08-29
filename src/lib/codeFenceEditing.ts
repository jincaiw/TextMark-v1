import { parseCodeFenceInfo } from './codeFence'

export interface EditableCodeFence {
  lineNumber: number
  from: number
  to: number
  markerEnd: number
  language: string
  metadata: string
}

interface LineDocument {
  lines: number
  line(number: number): { from: number; to: number; text: string }
}

const fencePattern = /^(\s*((`{3,})|(~{3,})))([^\n]*)$/

/** Finds the opening fence containing a line, without parsing the whole document text. */
export function editableCodeFenceAtLine(document: LineDocument, targetLine: number): EditableCodeFence | null {
  let open: { marker: string; lineNumber: number; from: number; to: number; markerEnd: number; info: string } | null = null
  for (let lineNumber = 1; lineNumber <= Math.min(targetLine, document.lines); lineNumber += 1) {
    const line = document.line(lineNumber)
    const match = fencePattern.exec(line.text)
    if (!match) continue
    const marker = match[2].trim()
    if (!open) {
      open = { marker: marker[0], lineNumber, from: line.from, to: line.to, markerEnd: line.from + match[1].length, info: match[5] }
      continue
    }
    if (marker[0] === open.marker && marker.length >= 3) open = null
  }
  if (!open) return null
  const info = parseCodeFenceInfo(open.info)
  return { ...open, language: info.language, metadata: info.metadata }
}

export function rewriteCodeFenceLanguage(fence: EditableCodeFence, language: string): { from: number; to: number; insert: string } {
  const normalized = language
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_+.-]/g, '')
  const info = normalized ? `${normalized}${fence.metadata ? ` ${fence.metadata}` : ''}` : fence.metadata ? ` ${fence.metadata}` : ''
  return { from: fence.markerEnd, to: fence.to, insert: info }
}
