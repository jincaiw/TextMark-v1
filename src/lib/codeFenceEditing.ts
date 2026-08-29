import { parseCodeFenceInfo } from './codeFence'

export interface EditableCodeFence {
  lineNumber: number
  closingLineNumber: number | null
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

const fencePattern = /^( {0,3})((`{3,})|(~{3,}))([^\n]*)$/

function openingFence(text: string) {
  const match = fencePattern.exec(text)
  if (!match || (match[3] && match[5].includes('`'))) return null
  return {
    indent: match[1],
    marker: match[2],
    character: match[2][0],
    info: match[5],
  }
}

function closesFence(text: string, character: string, minimumLength: number) {
  const match = /^( {0,3})(`{3,}|~{3,})[\t ]*$/.exec(text)
  return Boolean(match && match[2][0] === character && match[2].length >= minimumLength)
}

/** Finds the opening fence containing a line, without parsing the whole document text. */
export function editableCodeFenceAtLine(document: LineDocument, targetLine: number): EditableCodeFence | null {
  let open: {
    marker: string
    lineNumber: number
    from: number
    to: number
    markerEnd: number
    info: string
  } | null = null
  for (let lineNumber = 1; lineNumber <= Math.min(targetLine, document.lines); lineNumber += 1) {
    const line = document.line(lineNumber)
    if (open) {
      if (!closesFence(line.text, open.marker[0], open.marker.length)) continue
      if (lineNumber === targetLine) {
        const info = parseCodeFenceInfo(open.info)
        return { ...open, closingLineNumber: lineNumber, language: info.language, metadata: info.metadata }
      }
      open = null
      continue
    }
    const fence = openingFence(line.text)
    if (!fence) continue
    open = {
      marker: fence.marker,
      lineNumber,
      from: line.from,
      to: line.to,
      markerEnd: line.from + fence.indent.length + fence.marker.length,
      info: fence.info,
    }
  }
  if (!open) return null
  const info = parseCodeFenceInfo(open.info)
  return { ...open, closingLineNumber: null, language: info.language, metadata: info.metadata }
}

export function isCodeFenceBodyLine(fence: EditableCodeFence | null, lineNumber: number) {
  return Boolean(fence && lineNumber !== fence.lineNumber && lineNumber !== fence.closingLineNumber)
}

export function codeFenceAutoCloseInsertion(
  linePrefix: string,
  lineSuffix: string,
  typed: string,
): { insert: string; cursorOffset: number } | null {
  if ((typed !== '`' && typed !== '~') || lineSuffix.length > 0) return null
  const match = /^( {0,3})(``|~~)$/.exec(linePrefix)
  if (!match || match[2][0] !== typed) return null
  return {
    insert: `${typed}\n\n${match[1]}${typed.repeat(3)}`,
    cursorOffset: 2,
  }
}

export function rewriteCodeFenceLanguage(fence: EditableCodeFence, language: string): { from: number; to: number; insert: string } {
  const normalized = language
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_+.-]/g, '')
  const info = normalized ? `${normalized}${fence.metadata ? ` ${fence.metadata}` : ''}` : fence.metadata ? ` ${fence.metadata}` : ''
  return { from: fence.markerEnd, to: fence.to, insert: info }
}
