import { Range, StateField, type EditorState } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { BlockWrapper, Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { markdownImageReferences } from './pastedImages'
import { splitFrontmatter } from './frontmatter'
import { renderMath } from './mathRender'
import { renderMarkdown } from './markdown'
import { markdownDefinitionListBlocks, type MarkdownDefinitionListBlock } from './markdownDefinitionLists'
import { sanitizeMermaidSvg } from './sanitize'

export { markdownDefinitionListBlocks } from './markdownDefinitionLists'

const lineClass = (line: string) => {
  if (/^\s{0,3}\[\^[^\]]+\]:/.test(line)) return 'cm-md-footnote-definition'
  const quotePrefix = markdownQuotePrefix(line)
  const quoteContent = line.slice(quotePrefix.length)
  const alert = quoteContent.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i)
  if (alert) return `cm-md-quote cm-md-quote-alert cm-md-quote-alert-${alert[1].toLowerCase()}`
  const heading = line.match(/^ {0,3}(#{1,6})(?:\s|$)/)
  if (heading) return `cm-md-h${heading[1].length}`
  const fence = quoteContent.match(/^\s*(`{3,}|~{3,})\s*([^\s]*)?/)
  if (fence) return fence[2]?.toLowerCase() === 'mermaid' ? 'cm-md-mermaid-fence' : 'cm-md-code-fence'
  if (/^\s*(?:\$\$|\\\[|\\\])\s*$/.test(line)) return 'cm-md-math'
  if (/^\s*(?:[-+*]|\d+[.)])\s+\[[ xX]\]\s+/.test(line)) return 'cm-md-task'
  if (/^\s*\|.*\|\s*$/.test(line) && /\|\s*:?-{3,}:?\s*(?:\||$)/.test(line)) return 'cm-md-table'
  if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) return 'cm-md-rule'
  if (quotePrefix) return 'cm-md-quote'
  if (/^\s*(?:[-+*]|\d+[.)])\s+/.test(line)) return 'cm-md-list'
  return ''
}

interface MarkdownFootnotes {
  numberById: Map<string, number>
  targetById: Map<string, number>
}

function markdownFootnotes(state: EditorState): MarkdownFootnotes {
  const numberById = new Map<string, number>()
  const targetById = new Map<string, number>()
  const codeRanges: Array<[number, number]> = []
  syntaxTree(state).iterate({
    enter(node) {
      if (node.name === 'FencedCode' || node.name === 'CodeBlock') codeRanges.push([node.from, node.to])
    },
  })
  const inCode = (position: number) => codeRanges.some(([from, to]) => position >= from && position <= to)
  for (let number = 1; number <= state.doc.lines; number += 1) {
    const line = state.doc.line(number)
    const definition = line.text.match(/^\s{0,3}\[\^([^\]]+)\]:[ \t]*/)
    if (definition && !targetById.has(definition[1])) targetById.set(definition[1], line.from + definition[0].length)
  }
  for (let number = 1; number <= state.doc.lines; number += 1) {
    const line = state.doc.line(number)
    if (/^\s{0,3}\[\^[^\]]+\]:/.test(line.text)) continue
    for (const match of line.text.matchAll(/\[\^([^\]]+)\]/g)) {
      const position = line.from + (match.index ?? 0)
      if (inCode(position) || !targetById.has(match[1]) || numberById.has(match[1])) continue
      numberById.set(match[1], numberById.size + 1)
    }
  }
  return { numberById, targetById }
}

function markdownQuotePrefix(line: string): string {
  return line.match(/^(?:[ \t]{0,3}>[ \t]?)+/)?.[0] ?? ''
}

/** Alternating bullet shapes improve the hierarchy cues in nested lists. */
export function markdownListMarkerClass(line: string): string {
  const quotePrefix = markdownQuotePrefix(line)
  const indentation = line.slice(quotePrefix.length).match(/^[\t ]*/)?.[0] ?? ''
  const columns = indentation.replace(/\t/g, '    ').length
  return `cm-md-list-marker cm-md-list-depth-${Math.floor(columns / 2) % 3}`
}

function markdownCodeContentOffset(line: string): number {
  const quotePrefixLength = markdownQuotePrefix(line).length
  const indentation = line.slice(quotePrefixLength).match(/^[\t ]*/)?.[0].length ?? 0
  return quotePrefixLength + indentation
}

const tableSeparator = (line: string) => {
  const cells = line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split(/(?<!\\)\|/)
  return cells.length > 1 && cells.every((cell) => /^\s*:?-{3,}:?\s*$/.test(cell))
}

const tableRowCandidate = (line: string) => {
  const trimmed = line.trim()
  if (!trimmed || /^>/.test(trimmed) || /^(```|~~~)/.test(trimmed)) return false
  const pipes = [...trimmed.matchAll(/(?<!\\)\|/g)].length
  return pipes >= 1
}

/** Returns the source ranges for each pipe-table cell, excluding the pipe
 * delimiters. Escaped pipes stay part of the cell so decorations never change
 * the underlying Markdown text or its cursor positions. */
export function markdownTableCellRanges(line: string): Array<{ from: number; to: number }> {
  const pipes = [...line.matchAll(/(?<!\\)\|/g)].map((match) => match.index ?? 0)
  if (!pipes.length) return []
  const ranges: Array<{ from: number; to: number }> = []
  let from = line.trimStart().startsWith('|') ? pipes[0] + 1 : 0
  for (const pipe of pipes) {
    if (pipe < from) continue
    const to = pipe
    ranges.push({ from, to })
    from = pipe + 1
  }
  if (!line.trimEnd().endsWith('|')) ranges.push({ from, to: line.length })
  return ranges
}

/** Maps each table source row to the alignment declared by its separator. */
export function markdownTableAlignmentMap(source: string): Map<number, Array<'left' | 'center' | 'right'>> {
  const lines = source.split(/\r?\n/)
  const result = new Map<number, Array<'left' | 'center' | 'right'>>()
  for (let index = 0; index < lines.length; index += 1) {
    if (!tableSeparator(lines[index])) continue
    const alignment = markdownTableCellRanges(lines[index]).map((range) => {
      const cell = lines[index].slice(range.from, range.to).trim()
      const left = cell.startsWith(':')
      const right = cell.endsWith(':')
      return left && right ? 'center' : right ? 'right' : 'left'
    })
    let first = index - 1
    while (first > 0 && tableRowCandidate(lines[first - 1])) first -= 1
    let last = index + 1
    while (last + 1 < lines.length && tableRowCandidate(lines[last + 1])) last += 1
    for (let row = first; row <= last; row += 1) if (row !== index) result.set(row + 1, alignment)
  }
  return result
}

/** Marks every source row belonging to a pipe table, including body rows.
 * Lezer's default Markdown parser does not enable GFM table nodes, so the
 * separator is used as the unambiguous anchor and adjacent pipe rows expand it. */
export function markdownTableLines(source: string): Set<number> {
  const lines = source.split('\n')
  const result = new Set<number>()
  for (let index = 0; index < lines.length; index += 1) {
    if (!tableSeparator(lines[index]) || !tableRowCandidate(lines[index])) continue
    let first = index
    let last = index
    while (first > 0 && tableRowCandidate(lines[first - 1])) first -= 1
    while (last + 1 < lines.length && tableRowCandidate(lines[last + 1])) last += 1
    for (let row = first; row <= last; row += 1) result.add(row + 1)
  }
  return result
}

/** Source lines inside display-math blocks should keep a consistent TeX style
 * and must not be interpreted as Markdown headings or inline formatting. */
export function markdownMathLines(source: string): Set<number> {
  const lines = source.split(/\r?\n/)
  const result = new Set<number>()
  let delimiter: '$$' | '\\[' | null = null
  let fencedMath = false
  let fenceChar = ''
  let fenceLength = 0

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const fence = line.match(/^\s*(`{3,}|~{3,})\s*([^\s]*)?.*$/)
    if (fencedMath) {
      result.add(index + 1)
      if (fence && fence[1][0] === fenceChar && fence[1].length >= fenceLength) fencedMath = false
      continue
    }
    if (fence && /^(?:math|latex|tex)$/i.test(fence[2] ?? '')) {
      fencedMath = true
      fenceChar = fence[1][0]
      fenceLength = fence[1].length
      result.add(index + 1)
      continue
    }

    const trimmed = line.trim()
    if (!delimiter && (trimmed === '$$' || trimmed === '\\[')) {
      delimiter = trimmed as '$$' | '\\['
      result.add(index + 1)
      continue
    }
    if (delimiter) {
      result.add(index + 1)
      if ((delimiter === '$$' && trimmed === '$$') || (delimiter === '\\[' && trimmed === '\\]')) delimiter = null
    }
  }
  return result
}

interface MathBlockRange {
  from: number
  to: number
  source: string
}

/** Finds display-math ranges without interpreting math inside ordinary fences. */
export function markdownMathBlocks(source: string): MathBlockRange[] {
  const lines = source.split(/\r?\n/)
  const offsets: number[] = []
  let offset = 0
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    offsets.push(offset)
    offset += line.length
    if (index < lines.length - 1) offset += source.slice(offset, offset + 2) === '\r\n' ? 2 : 1
  }
  const blocks: MathBlockRange[] = []
  let open: { index: number; delimiter: '$$' | '\\[' | 'fence'; fenceChar?: string; fenceLength?: number } | null = null
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const fence = line.match(/^\s*(`{3,}|~{3,})\s*([^\s]*)?.*$/)
    if (!open) {
      if (fence && /^(?:math|latex|tex)$/i.test(fence[2] ?? '')) {
        open = { index, delimiter: 'fence', fenceChar: fence[1][0], fenceLength: fence[1].length }
      } else {
        const trimmed = line.trim()
        if (trimmed === '$$' || trimmed === '\\[') open = { index, delimiter: trimmed as '$$' | '\\[' }
      }
      continue
    }
    const closes =
      open.delimiter === 'fence'
        ? Boolean(fence && fence[1][0] === open.fenceChar && fence[1].length >= (open.fenceLength ?? 3))
        : line.trim() === (open.delimiter === '$$' ? '$$' : '\\]')
    if (!closes) continue
    const from = offsets[open.index]
    const to = offsets[index] + line.length
    const sourceText = lines.slice(open.index + 1, index).join('\n')
    blocks.push({ from, to, source: sourceText })
    open = null
  }
  return blocks
}

function markdownMermaidBlocks(source: string): MathBlockRange[] {
  const lines = source.split(/\r?\n/)
  const offsets: number[] = []
  let offset = 0
  for (let index = 0; index < lines.length; index += 1) {
    offsets.push(offset)
    offset += lines[index].length
    if (index < lines.length - 1) offset += source.slice(offset, offset + 2) === '\r\n' ? 2 : 1
  }
  const blocks: MathBlockRange[] = []
  let open: { index: number; marker: string } | null = null
  for (let index = 0; index < lines.length; index += 1) {
    const quote = markdownQuotePrefix(lines[index])
    const line = lines[index].slice(quote.length)
    const fence = line.match(/^\s*(`{3,}|~{3,})\s*([^\s]*)?.*$/)
    if (!open) {
      if (fence && (fence[2] ?? '').toLowerCase() === 'mermaid') open = { index, marker: fence[1] }
      continue
    }
    if (!fence || fence[1][0] !== open.marker[0] || fence[1].length < open.marker.length) continue
    const diagram = lines
      .slice(open.index + 1, index)
      .map((value) => value.slice(markdownQuotePrefix(value).length))
      .join('\n')
    blocks.push({ from: offsets[open.index], to: offsets[index] + lines[index].length, source: diagram })
    open = null
  }
  return blocks
}

interface MarkdownDetailsBlock extends MathBlockRange {
  summary: string
  open: boolean
}

type MarkdownHtmlBlock = MathBlockRange
type MarkdownTableBlock = MathBlockRange
type MarkdownQuoteBlock = MathBlockRange
type MarkdownTocBlock = MathBlockRange

/** Finds standalone [TOC] directives outside frontmatter and fenced code. */
function markdownTocBlocks(source: string): MarkdownTocBlock[] {
  const lines = source.split(/\r?\n/)
  const blocks: MarkdownTocBlock[] = []
  let offset = 0
  let fence: { character: string; length: number } | null = null
  let frontmatter = false
  let frontmatterClosed = false
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (index === 0 && /^\uFEFF?(---|\+\+\+)\s*$/.test(line)) frontmatter = true
    if (frontmatter && !frontmatterClosed) {
      if (index > 0 && /^(?:---|\.\.\.|\+\+\+)\s*$/.test(line)) {
        frontmatter = false
        frontmatterClosed = true
      }
    } else {
      const codeFence = line.match(/^\s*(`{3,}|~{3,})/)
      if (fence) {
        if (codeFence && codeFence[1][0] === fence.character && codeFence[1].length >= fence.length) fence = null
      } else if (codeFence) {
        fence = { character: codeFence[1][0], length: codeFence[1].length }
      } else if (/^ {0,3}\[TOC\]\s*$/i.test(line)) {
        blocks.push({ from: offset, to: offset + line.length, source: line })
      }
    }
    offset +=
      line.length + (index < lines.length - 1 ? (source.slice(offset + line.length, offset + line.length + 2) === '\r\n' ? 2 : 1) : 0)
  }
  return blocks
}

function markdownDetailsBlocks(source: string): MarkdownDetailsBlock[] {
  const lines = source.split(/\r?\n/)
  const offsets: number[] = []
  let offset = 0
  for (let index = 0; index < lines.length; index += 1) {
    offsets.push(offset)
    offset += lines[index].length
    if (index < lines.length - 1) offset += source.slice(offset, offset + 2) === '\r\n' ? 2 : 1
  }

  const blocks: MarkdownDetailsBlock[] = []
  let outerFence: { character: string; length: number } | null = null
  for (let index = 0; index < lines.length; index += 1) {
    const opening = lines[index].match(/^ {0,3}<details\b([^>]*)>\s*$/i)
    const fence = lines[index].match(/^\s*(`{3,}|~{3,})/)
    if (outerFence) {
      if (fence && fence[1][0] === outerFence.character && fence[1].length >= outerFence.length) outerFence = null
      continue
    }
    if (!opening) {
      if (fence) outerFence = { character: fence[1][0], length: fence[1].length }
      continue
    }

    let depth = 1
    let innerFence: { character: string; length: number } | null = null
    let summary = ''
    const body: string[] = []
    let closingLine = -1
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const line = lines[cursor]
      const codeFence = line.match(/^\s*(`{3,}|~{3,})/)
      if (innerFence) {
        body.push(line)
        if (codeFence && codeFence[1][0] === innerFence.character && codeFence[1].length >= innerFence.length) innerFence = null
        continue
      }
      if (codeFence) {
        innerFence = { character: codeFence[1][0], length: codeFence[1].length }
        body.push(line)
        continue
      }
      if (/^\s*<details\b[^>]*>\s*$/i.test(line)) {
        depth += 1
        body.push(line)
        continue
      }
      if (/^\s*<\/details>\s*$/i.test(line)) {
        depth -= 1
        if (depth === 0) {
          closingLine = cursor
          break
        }
        body.push(line)
        continue
      }
      const summaryMatch = line.match(/^\s*<summary(?:\s[^>]*)?>([\s\S]*)<\/summary>\s*$/i)
      if (summaryMatch && depth === 1 && !summary) {
        summary = summaryMatch[1]
        continue
      }
      body.push(line)
    }
    if (closingLine < 0) continue
    const summaryText = document.createElement('textarea')
    summaryText.innerHTML = summary
    blocks.push({
      from: offsets[index],
      to: offsets[closingLine] + lines[closingLine].length,
      source: body.join('\n'),
      summary: summaryText.value || 'Details',
      open: /(?:^|\s)open(?:\s|=|$)/i.test(opening[1]),
    })
    index = closingLine
  }
  return blocks
}

/** Finds standalone container HTML blocks while ignoring fenced code. */
function markdownHtmlBlocks(source: string): MarkdownHtmlBlock[] {
  const lines = source.split(/\r?\n/)
  const offsets: number[] = []
  let offset = 0
  for (let index = 0; index < lines.length; index += 1) {
    offsets.push(offset)
    offset += lines[index].length
    if (index < lines.length - 1) offset += source.slice(offset, offset + 2) === '\r\n' ? 2 : 1
  }

  const blocks: MarkdownHtmlBlock[] = []
  let fence: { character: string; length: number } | null = null
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const codeFence = line.match(/^\s*(`{3,}|~{3,})/)
    if (fence) {
      if (codeFence && codeFence[1][0] === fence.character && codeFence[1].length >= fence.length) fence = null
      continue
    }
    if (codeFence) {
      fence = { character: codeFence[1][0], length: codeFence[1].length }
      continue
    }
    const opening = line.match(/^ {0,3}<(div|section|article|aside|figure|center)\b[^>]*>\s*$/i)
    if (!opening) continue

    const tag = opening[1].toLowerCase()
    let depth = 1
    let innerFence: { character: string; length: number } | null = null
    let closingLine = -1
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const current = lines[cursor]
      const currentFence = current.match(/^\s*(`{3,}|~{3,})/)
      if (innerFence) {
        if (currentFence && currentFence[1][0] === innerFence.character && currentFence[1].length >= innerFence.length) innerFence = null
        continue
      }
      if (currentFence) {
        innerFence = { character: currentFence[1][0], length: currentFence[1].length }
        continue
      }
      for (const match of current.matchAll(new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi'))) {
        if (match[0].startsWith('</')) depth -= 1
        else if (!/\/\s*>$/.test(match[0])) depth += 1
        if (depth === 0) {
          closingLine = cursor
          break
        }
      }
      if (closingLine >= 0) break
    }
    if (closingLine < 0) continue
    blocks.push({
      from: offsets[index],
      to: offsets[closingLine] + lines[closingLine].length,
      source: lines.slice(index, closingLine + 1).join('\n'),
    })
    index = closingLine
  }
  return blocks
}

/** Finds GFM pipe tables as complete source ranges, excluding fenced examples. */
function markdownTableBlocks(source: string): MarkdownTableBlock[] {
  const lines = source.split(/\r?\n/)
  const offsets: number[] = []
  let offset = 0
  for (let index = 0; index < lines.length; index += 1) {
    offsets.push(offset)
    offset += lines[index].length
    if (index < lines.length - 1) offset += source.slice(offset, offset + 2) === '\r\n' ? 2 : 1
  }

  const blocks: MarkdownTableBlock[] = []
  let fence: { character: string; length: number } | null = null
  for (let index = 0; index < lines.length; index += 1) {
    const codeFence = lines[index].match(/^\s*(`{3,}|~{3,})/)
    if (fence) {
      if (codeFence && codeFence[1][0] === fence.character && codeFence[1].length >= fence.length) fence = null
      continue
    }
    if (codeFence) {
      fence = { character: codeFence[1][0], length: codeFence[1].length }
      continue
    }
    if (!tableSeparator(lines[index]) || !tableRowCandidate(lines[index])) continue

    let first = index
    let last = index
    while (first > 0 && tableRowCandidate(lines[first - 1]) && !/^\s*(`{3,}|~{3,})/.test(lines[first - 1])) first -= 1
    while (last + 1 < lines.length && tableRowCandidate(lines[last + 1]) && !/^\s*(`{3,}|~{3,})/.test(lines[last + 1])) last += 1
    blocks.push({ from: offsets[first], to: offsets[last] + lines[last].length, source: lines.slice(first, last + 1).join('\n') })
    index = last
  }
  return blocks
}

/** Finds contiguous blockquote source regions while ignoring examples in fences. */
function markdownQuoteBlocks(source: string): MarkdownQuoteBlock[] {
  const lines = source.split(/\r?\n/)
  const offsets: number[] = []
  let offset = 0
  for (let index = 0; index < lines.length; index += 1) {
    offsets.push(offset)
    offset += lines[index].length
    if (index < lines.length - 1) offset += source.slice(offset, offset + 2) === '\r\n' ? 2 : 1
  }

  const blocks: MarkdownQuoteBlock[] = []
  let fence: { character: string; length: number } | null = null
  for (let index = 0; index < lines.length; index += 1) {
    const codeFence = lines[index].match(/^\s*(`{3,}|~{3,})/)
    if (fence) {
      if (codeFence && codeFence[1][0] === fence.character && codeFence[1].length >= fence.length) fence = null
      continue
    }
    if (codeFence) {
      fence = { character: codeFence[1][0], length: codeFence[1].length }
      continue
    }
    if (!markdownQuotePrefix(lines[index])) continue

    const first = index
    while (index + 1 < lines.length && markdownQuotePrefix(lines[index + 1])) index += 1
    const last = index
    blocks.push({ from: offsets[first], to: offsets[last] + lines[last].length, source: lines.slice(first, last + 1).join('\n') })
  }
  return blocks
}

function canRenderQuotePreview(block: MarkdownQuoteBlock) {
  return (
    !/!\[[^\]]*\]\([^)]*\)/.test(block.source) &&
    !/\[\^[^\]]+\]/.test(block.source) &&
    !/^\s*>\s*(?:`{3,}|~{3,})\s*mermaid\b/im.test(block.source)
  )
}

export function markdownAlertLines(source: string): Map<number, string> {
  const lines = source.split(/\r?\n/)
  const result = new Map<number, string>()
  for (let index = 0; index < lines.length; index += 1) {
    const prefix = markdownQuotePrefix(lines[index])
    const match = lines[index].slice(prefix.length).match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i)
    if (!prefix || !match) continue
    const className = `cm-md-quote-alert cm-md-quote-alert-${match[1].toLowerCase()}`
    let end = index
    while (end < lines.length && markdownQuotePrefix(lines[end])) {
      result.set(end + 1, className)
      end += 1
    }
    index = end - 1
  }
  return result
}

/** Public for lightweight fixture tests; the view plugin only processes the
 * viewport, keeping large Markdown files responsive. */
export function markdownLineClass(line: string) {
  return lineClass(line)
}

/** Frontmatter styling is limited to a valid metadata block at document start.
 * Ordinary `key: value` prose and horizontal rules must retain their body styles. */
export function markdownFrontmatterLines(source: string): Map<number, string> {
  const normalized = source.replace(/^\uFEFF/, '')
  const parsed = splitFrontmatter(normalized)
  if (parsed.raw === null) return new Map()
  const lines = normalized.split(/\r?\n/)
  const delimiter = lines[0]
  const close = delimiter === '---' ? /^(?:---|\.\.\.)\s*$/ : /^\+\+\+\s*$/
  const closingIndex = lines.findIndex((line, index) => index > 0 && close.test(line))
  if (closingIndex < 0) return new Map()
  const result = new Map<number, string>([
    [1, 'cm-md-frontmatter-boundary cm-md-frontmatter-start'],
    [closingIndex + 1, 'cm-md-frontmatter-boundary cm-md-frontmatter-end'],
  ])
  for (let index = 1; index < closingIndex; index += 1)
    if (/^[A-Za-z][\w-]*:\s*/.test(lines[index])) result.set(index + 1, 'cm-md-frontmatter-value')
  return result
}

export interface MarkdownSyntaxMarker {
  from: number
  to: number
  className: string
}

const inlineMathPattern = /(?<!\\)\$\$([^$\n]+?)\$\$|(?<!\\)\$(?!\$)([^$\n]+?)\$(?!\$)|\\\((.+?)\\\)|\\\[([^\]]+?)\\\]/g

/** Returns only structural Markdown punctuation, so inactive source can be
 * visually quieter without hiding the content itself. Offsets are line-local. */
export function markdownSyntaxMarkers(line: string): MarkdownSyntaxMarker[] {
  const markers: MarkdownSyntaxMarker[] = []
  const add = (from: number, to: number, className = 'cm-md-syntax-marker') => {
    if (to > from) markers.push({ from, to, className })
  }
  const isEscaped = (offset: number) => {
    let backslashes = 0
    for (let index = offset - 1; index >= 0 && line[index] === '\\'; index -= 1) backslashes += 1
    return backslashes % 2 === 1
  }
  const isFenceLine = /^\s{0,3}(?:`{3,}|~{3,})/.test(line)
  const inlineCodeRanges = (isFenceLine ? [] : [...line.matchAll(/(`+)([\s\S]*?)\1(?!`)/g)]).map((match) => {
    const from = match.index ?? 0
    return { from, to: from + match[0].length, delimiterLength: match[1].length }
  })
  const inlineMathRanges = [...line.matchAll(inlineMathPattern)]
    .filter((match) => {
      const from = match.index ?? 0
      return !inlineCodeRanges.some((range) => range.from < from + match[0].length && range.to > from)
    })
    .map((match) => {
      const from = match.index ?? 0
      return { from, to: from + match[0].length }
    })
  const isFullyInsideRange = (from: number, to: number, ranges: Array<{ from: number; to: number }>) =>
    ranges.some((range) => range.from <= from && range.to >= to)
  if (!isFenceLine) {
    for (let index = 0; index + 1 < line.length; index += 1) {
      if (line[index] !== '\\') continue
      const escaped = line.charCodeAt(index + 1)
      const isAsciiPunctuation =
        (escaped >= 33 && escaped <= 47) ||
        (escaped >= 58 && escaped <= 64) ||
        (escaped >= 91 && escaped <= 96) ||
        (escaped >= 123 && escaped <= 126)
      if (
        !isAsciiPunctuation ||
        isFullyInsideRange(index, index + 2, inlineCodeRanges) ||
        isFullyInsideRange(index, index + 2, inlineMathRanges)
      )
        continue
      add(index, index + 1, 'cm-md-escape-marker')
      add(index + 1, index + 2, 'cm-md-escaped-character')
      index += 1
    }
  }
  const prefix = line.match(/^(\s{0,3})(#{1,6})(?=\s)|^(\s*)([-+*]|\d+[.)])(?=\s)/)
  if (prefix) {
    const markerStart = prefix[1]?.length ?? prefix[3]?.length ?? 0
    const marker = prefix[2] ?? prefix[4] ?? ''
    if (prefix[2]) {
      const headingPrefix = line.match(/^\s{0,3}#{1,6}\s+/)?.[0] ?? `${prefix[1]}${marker}`
      add(0, headingPrefix.length, 'cm-md-heading-marker')
    } else {
      const markerClass = /^\d/.test(marker) ? 'cm-md-list-ordered-marker' : 'cm-md-list-marker'
      add(markerStart, markerStart + marker.length, markerClass)
    }
  }
  for (const match of line.matchAll(/(^|\s)(>)(?=\s|$)/g)) {
    const start = (match.index ?? 0) + match[1].length
    add(start, start + 1)
  }
  const quotePrefix = markdownQuotePrefix(line)
  const admonition = line.slice(quotePrefix.length).match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i)
  if (admonition) add(quotePrefix.length, quotePrefix.length + admonition[0].length, 'cm-md-admonition-marker')
  const task = line.match(/^(\s*)(?:[-+*]|\d+[.)])\s+(\[[ xX]\])/)
  if (task)
    add(
      task[1].length + line.slice(task[1].length).search(/\[/),
      task[1].length + line.slice(task[1].length).search(/\[/) + task[2].length,
      task[2].toLowerCase() === '[x]' ? 'cm-md-task-marker cm-md-task-checked' : 'cm-md-task-marker',
    )
  const fence = line.match(/^(\s*)(`{3,}|~{3,})(?:\s*[^\s]*)?\s*$/)
  if (fence) add(fence[1].length, fence[1].length + fence[2].length, 'cm-md-fence-marker')
  for (const range of inlineCodeRanges) {
    add(range.from, range.from + range.delimiterLength, 'cm-md-inline-syntax')
    add(range.to - range.delimiterLength, range.to, 'cm-md-inline-syntax')
  }
  const trailingBackslashes = line.match(/(\\+)[ \t]*$/)
  if (trailingBackslashes && trailingBackslashes[1].length % 2 === 1) {
    const offset = (trailingBackslashes.index ?? 0) + trailingBackslashes[1].length - 1
    add(offset, offset + 1, 'cm-md-hardbreak-marker')
  }
  if (/^\s*\|.*\|\s*$/.test(line)) {
    for (const match of line.matchAll(/\|/g)) {
      const offset = match.index ?? 0
      if (!isEscaped(offset)) add(offset, offset + 1, 'cm-md-table-marker')
    }
  }
  // Keep Markdown syntax visible on the active line (the caller skips markers
  // there), and let inactive lines read like rendered content. These ranges
  // are intentionally limited to simple, single-line inline constructs.
  for (const match of line.matchAll(
    /\*\*\*[^*\n]+\*\*\*|___[^_\n]+___|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|==[^=\n]+==|\*(?!\*)[^*\n]+\*(?!\*)|_(?!_)[^_\n]+_(?!_)/g,
  )) {
    const value = match[0]
    const start = match.index ?? 0
    if (isEscaped(start)) continue
    // Inline code and math are opaque source regions; formatting-looking
    // punctuation inside them is literal or belongs to the formula parser.
    if (
      isFullyInsideRange(start, start + value.length, inlineCodeRanges) ||
      isFullyInsideRange(start, start + value.length, inlineMathRanges)
    )
      continue
    const delimiter = value.startsWith('***') || value.startsWith('___') ? 3 : /^(?:\*\*|__|~~|==)/.test(value) ? 2 : 1
    add(start, start + delimiter, 'cm-md-inline-syntax')
    add(start + value.length - delimiter, start + value.length, 'cm-md-inline-syntax')
  }
  for (const match of line.matchAll(/\[([^\]\n]+)\]\(([^)\n]+)\)/g)) {
    const start = match.index ?? 0
    if (isEscaped(start) || isFullyInsideRange(start, start + match[0].length, inlineCodeRanges)) continue
    const labelEnd = start + match[0].indexOf(']')
    add(start, start + 1, 'cm-md-inline-syntax')
    add(labelEnd, start + match[0].length, 'cm-md-inline-syntax')
  }
  return markers.sort((left, right) => left.from - right.from || left.to - right.to)
}

const inlinePattern = /==[^=\n]+==/g
const inlineHtmlPattern = /<(kbd|sup|sub|mark)>([^<>\n]*)<\/\1>/gi
const inlineNodeClasses: Record<string, string> = {
  StrongEmphasis: 'cm-md-strong',
  Emphasis: 'cm-md-italic',
  Strikethrough: 'cm-md-strikethrough',
  InlineCode: 'cm-md-inline-code',
  Link: 'cm-md-link',
  Autolink: 'cm-md-link',
  URL: 'cm-md-link',
}
export interface EditorImageReference {
  alt: string
  path: string
  title?: string
  from: number
  to: number
}

export function editorImageReferences(line: string): EditorImageReference[] {
  return markdownImageReferences(line)
    .filter(({ path }) => !/^(?:[a-z][a-z0-9+.-]*:|\/|\\|#)/i.test(path))
    .map(({ alt, path, title, imageFrom, imageTo }) => ({ alt, path, ...(title ? { title } : {}), from: imageFrom, to: imageTo }))
}

interface EditorMarkdownDecorationOptions {
  resolveImage?: (path: string) => Promise<string | null>
  onRenameImage?: (path: string) => void
}

class ImagePreviewWidget extends WidgetType {
  constructor(
    readonly path: string,
    readonly alt: string,
    readonly title: string | undefined,
    readonly options: EditorMarkdownDecorationOptions,
  ) {
    super()
  }

  eq(other: ImagePreviewWidget) {
    return other.path === this.path && other.alt === this.alt && other.title === this.title && other.options === this.options
  }

  toDOM() {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'cm-md-image-preview'
    button.setAttribute('aria-label', this.alt ? `Image: ${this.alt}` : 'Markdown image')
    button.title = this.title || this.alt || this.path
    const image = document.createElement('img')
    image.alt = this.alt
    button.append(image)
    void this.options.resolveImage?.(this.path).then((source) => {
      if (source && button.isConnected) image.src = source
      else if (button.isConnected) {
        button.classList.add('asset-error')
        const fallback = document.createElement('span')
        fallback.className = 'cm-md-image-fallback'
        fallback.textContent = this.alt || this.path
        button.append(fallback)
      }
    })
    button.addEventListener('mousedown', (event) => event.preventDefault())
    button.addEventListener('click', () => this.options.onRenameImage?.(this.path))
    return button
  }

  ignoreEvent() {
    return false
  }
}

class MathPreviewWidget extends WidgetType {
  constructor(
    readonly source: string,
    readonly displayMode: boolean,
  ) {
    super()
  }

  eq(other: MathPreviewWidget) {
    return other.source === this.source && other.displayMode === this.displayMode
  }

  toDOM() {
    const element = document.createElement(this.displayMode ? 'div' : 'span')
    element.className = `cm-md-math-preview${this.displayMode ? ' cm-md-math-preview-display' : ''}`
    element.setAttribute('contenteditable', 'false')
    element.innerHTML = renderMath(this.source, this.displayMode)
    return element
  }

  ignoreEvent() {
    return false
  }
}

class InlineHtmlWidget extends WidgetType {
  constructor(
    readonly tag: 'kbd' | 'sup' | 'sub' | 'mark',
    readonly content: string,
  ) {
    super()
  }

  eq(other: InlineHtmlWidget) {
    return this.tag === other.tag && this.content === other.content
  }

  toDOM() {
    const element = document.createElement(this.tag)
    element.className = `cm-md-inline-html cm-md-inline-html-${this.tag}`
    const text = document.createElement('textarea')
    text.innerHTML = this.content
    element.textContent = text.value
    return element
  }
}

class InlineSemanticWidget extends WidgetType {
  constructor(
    readonly tag: 'ins' | 'sup' | 'sub',
    readonly content: string,
  ) {
    super()
  }

  eq(other: InlineSemanticWidget) {
    return this.tag === other.tag && this.content === other.content
  }

  toDOM() {
    const element = document.createElement(this.tag)
    element.className = `cm-md-inline-semantic cm-md-inline-semantic-${this.tag}`
    element.textContent = this.content
    return element
  }
}

class EntityWidget extends WidgetType {
  constructor(readonly value: string) {
    super()
  }

  eq(other: EntityWidget) {
    return this.value === other.value
  }

  toDOM() {
    const element = document.createElement('span')
    element.className = 'cm-md-entity'
    element.textContent = this.value
    return element
  }
}

class DetailsPreviewWidget extends WidgetType {
  constructor(
    readonly summaryText: string,
    readonly bodySource: string,
    readonly initiallyOpen: boolean,
  ) {
    super()
  }

  eq(other: DetailsPreviewWidget) {
    return this.summaryText === other.summaryText && this.bodySource === other.bodySource && this.initiallyOpen === other.initiallyOpen
  }

  toDOM() {
    const details = document.createElement('details')
    details.className = 'cm-md-details-preview'
    details.open = this.initiallyOpen
    const summary = document.createElement('summary')
    summary.textContent = this.summaryText
    details.append(summary)

    const body = document.createElement('div')
    body.className = 'cm-md-details-body markdown-body'
    body.innerHTML = renderMarkdown(this.bodySource).html
    details.append(body)
    return details
  }

  ignoreEvent(event: Event) {
    return event.target instanceof Element && Boolean(event.target.closest('summary'))
  }
}

class HtmlBlockPreviewWidget extends WidgetType {
  constructor(readonly source: string) {
    super()
  }

  eq(other: HtmlBlockPreviewWidget) {
    return this.source === other.source
  }

  toDOM() {
    const element = document.createElement('div')
    element.className = 'cm-md-html-block-preview markdown-body'
    element.innerHTML = renderMarkdown(this.source).html
    return element
  }
}

class TablePreviewWidget extends WidgetType {
  constructor(readonly block: MarkdownTableBlock) {
    super()
  }

  eq(other: TablePreviewWidget) {
    return this.block.from === other.block.from && this.block.to === other.block.to && this.block.source === other.block.source
  }

  toDOM(view: EditorView) {
    const element = document.createElement('div')
    element.className = 'cm-md-table-preview markdown-body'
    element.innerHTML = renderMarkdown(this.block.source).html
    element.querySelectorAll<HTMLTableCellElement>('th, td').forEach((cell) => {
      cell.tabIndex = 0
    })
    const enterSourceCell = (cell: HTMLTableCellElement, event: MouseEvent | KeyboardEvent) => {
      const row = cell.parentElement as HTMLTableRowElement | null
      const table = cell.closest('table')
      if (!row || !table) return
      event.preventDefault()
      event.stopPropagation()

      const rowIndex = [...table.querySelectorAll('tr')].indexOf(row)
      const cellIndex = [...row.cells].indexOf(cell)
      // Markdown's delimiter row is omitted from the rendered table body.
      const sourceLineIndex = rowIndex === 0 ? 0 : rowIndex + 1
      const firstLine = view.state.doc.lineAt(this.block.from)
      const sourceLineNumber = firstLine.number + sourceLineIndex
      if (sourceLineNumber > view.state.doc.lines) return
      const sourceLine = view.state.doc.line(sourceLineNumber)
      const range = markdownTableCellRanges(sourceLine.text)[cellIndex]
      if (!range) return

      const rawCell = sourceLine.text.slice(range.from, range.to)
      const leadingWhitespace = rawCell.length - rawCell.trimStart().length
      const trimmedEnd = rawCell.trimEnd().length
      const from = sourceLine.from + range.from + leadingWhitespace
      const to = sourceLine.from + range.from + trimmedEnd
      const scroller = view.scrollDOM
      const clickedY = cell.getBoundingClientRect().top
      // Selecting a cell removes the rendered table widget. Scrolling in the
      // same transaction uses the widget's old height and can jump to the
      // document start. Align the source row after CodeMirror lays it out.
      view.dispatch({ selection: { anchor: from, head: Math.max(from, to) } })
      view.focus()
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!view.dom.isConnected || view.state.selection.main.from !== from || view.state.selection.main.to !== Math.max(from, to))
            return
          const sourceY = view.coordsAtPos(from)?.top
          if (sourceY !== undefined) scroller.scrollTop += sourceY - clickedY
        }),
      )
    }
    element.addEventListener('mousedown', (event) => {
      if (event.target instanceof Element && event.target.closest('th, td')) event.preventDefault()
    })
    element.addEventListener('click', (event) => {
      const cell = event.target instanceof Element ? event.target.closest<HTMLTableCellElement>('th, td') : null
      if (cell) enterSourceCell(cell, event)
    })
    element.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== 'F2') return
      const cell = event.target instanceof Element ? event.target.closest<HTMLTableCellElement>('th, td') : null
      if (cell) enterSourceCell(cell, event)
    })
    return element
  }

  ignoreEvent(event: Event) {
    return event.target instanceof Element && Boolean(event.target.closest('th, td'))
  }
}

class DefinitionListPreviewWidget extends WidgetType {
  constructor(readonly block: MarkdownDefinitionListBlock) {
    super()
  }

  eq(other: DefinitionListPreviewWidget) {
    return this.block.from === other.block.from && this.block.to === other.block.to && this.block.source === other.block.source
  }

  toDOM(view: EditorView) {
    const renderContents = (container: HTMLElement, markdown: string) => {
      const rendered = renderMarkdown(markdown).html.trim()
      const parsed = new DOMParser().parseFromString(rendered, 'text/html')
      const paragraph =
        parsed.body.children.length === 1 && parsed.body.firstElementChild?.tagName === 'P' ? parsed.body.firstElementChild : null
      container.innerHTML = paragraph?.innerHTML ?? rendered
    }
    const list = document.createElement('dl')
    list.className = 'cm-md-definition-list-preview markdown-body'
    const term = document.createElement('dt')
    renderContents(term, this.block.term)
    term.dataset.sourcePosition = String(this.block.termFrom)
    list.append(term)
    for (const definition of this.block.definitions) {
      const description = document.createElement('dd')
      renderContents(description, definition.source)
      description.dataset.sourcePosition = String(definition.from)
      list.append(description)
    }
    list.addEventListener('mousedown', (event) => event.preventDefault())
    list.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-source-position]') : null
      const position = Number(target?.dataset.sourcePosition)
      if (!Number.isFinite(position)) return
      // Changing the selection expands this block replacement back into its
      // source lines. Scroll after that layout update, otherwise CodeMirror
      // measures the old widget height and can jump to the document top.
      view.dispatch({ selection: { anchor: position } })
      view.focus()
      const alignSourceLine = () => {
        if (!view.dom.isConnected || view.state.selection.main.head !== position) return
        const block = view.lineBlockAt(position)
        const scroller = view.scrollDOM
        const targetTop = block.top + block.height / 2 - scroller.clientHeight / 2
        if (Math.abs(targetTop - scroller.scrollTop) > 1) scroller.scrollTo({ top: targetTop, behavior: 'auto' })
      }
      requestAnimationFrame(() => {
        if (!view.dom.isConnected) return
        view.dispatch({ effects: EditorView.scrollIntoView(position, { y: 'center' }) })
        // Selection changes also update the editor toolbar through React.
        // Reconcile after that update has painted; WebKit otherwise restores
        // the previous scroll offset while replacing the quote widget.
        requestAnimationFrame(alignSourceLine)
      })
    })
    return list
  }

  ignoreEvent(event: Event) {
    return event.target instanceof Element && Boolean(event.target.closest('dt, dd'))
  }
}

class TocPreviewWidget extends WidgetType {
  constructor(readonly source: string) {
    super()
  }

  eq(other: TocPreviewWidget) {
    return this.source === other.source
  }

  toDOM(view: EditorView) {
    const element = document.createElement('div')
    element.className = 'cm-md-toc-preview markdown-body'
    const rendered = renderMarkdown(view.state.doc.toString())
    const nav = new DOMParser().parseFromString(rendered.html, 'text/html').querySelector('.table-of-contents')
    if (!nav) {
      element.classList.add('cm-md-toc-empty')
      return element
    }
    element.append(nav)
    element.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href^="#"]') : null
      if (!target) return
      let id = target.hash.slice(1)
      try {
        id = decodeURIComponent(id)
      } catch {
        // Preserve literal percent characters in headings when they are not a valid escape.
      }
      const heading = rendered.outline.find((item) => item.id === id)
      if (!heading) return
      event.preventDefault()
      const position = view.state.doc.line(Math.max(1, Math.min(view.state.doc.lines, heading.line))).from
      view.dispatch({ selection: { anchor: position }, effects: EditorView.scrollIntoView(position, { y: 'center' }) })
      view.focus()
    })
    return element
  }

  ignoreEvent(event: Event) {
    return event.target instanceof Element && Boolean(event.target.closest('a'))
  }
}

class QuotePreviewWidget extends WidgetType {
  constructor(readonly block: MarkdownQuoteBlock) {
    super()
  }

  eq(other: QuotePreviewWidget) {
    return this.block.from === other.block.from && this.block.to === other.block.to && this.block.source === other.block.source
  }

  toDOM(view: EditorView) {
    const element = document.createElement('div')
    element.className = 'cm-md-quote-preview markdown-body'
    element.tabIndex = 0
    element.setAttribute('aria-label', '编辑引用块')
    const firstLine = this.block.source.split('\n', 1)[0] ?? ''
    const indentation = firstLine.match(/^[\t ]*/)?.[0] ?? ''
    const indentColumns = indentation.replace(/\t/g, '    ').length
    if (indentColumns >= 2) {
      // Block widgets are laid out at the editor's left edge, even when the
      // source quote continues a list item. Preserve that list indentation in
      // the preview so the quote remains visually nested under its item.
      const indent = `${indentColumns * 0.5}em`
      element.style.marginInlineStart = indent
      element.style.width = `calc(100% - ${indent})`
    }
    element.innerHTML = renderMarkdown(collapseRepeatedQuoteBlankLines(this.block.source)).html
    // The renderer preserves authored blank-line rhythm with synthetic
    // elements. In a block replacement the original Markdown lines are
    // already hidden, so carrying those spacers into the widget doubles the
    // vertical gap between quote paragraphs and nested blocks.
    element.querySelectorAll('.md-source-blank-line, .md-source-blank-line-final').forEach((blankLine) => blankLine.remove())
    element.querySelectorAll<HTMLElement>('p').forEach((paragraph) => {
      if (!paragraph.textContent?.trim() && !paragraph.querySelector('img, svg, math, input, video, audio')) paragraph.remove()
    })
    const enterSource = (target: EventTarget | null) => {
      const renderedLine = target instanceof Element ? target.closest('p, li, pre, .markdown-alert-title') : null
      const visibleText = renderedLine?.textContent?.replace(/\s+/g, ' ').trim().toLowerCase() ?? ''
      const sourceLines = this.block.source.split('\n')
      const lineIndex = sourceLines.findIndex((line) => {
        const content = line
          .slice(markdownQuotePrefix(line).length)
          .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)?/, '')
          .replace(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i, '$1')
          .replace(/[\*_`~]/g, '')
          .trim()
          .toLowerCase()
        return visibleText.length > 0 && content.startsWith(visibleText.slice(0, Math.min(6, visibleText.length)))
      })
      const fallback = sourceLines.findIndex((line) => line.slice(markdownQuotePrefix(line).length).trim())
      const firstLine = view.state.doc.lineAt(this.block.from).number
      const line = view.state.doc.line(firstLine + Math.max(0, lineIndex < 0 ? fallback : lineIndex))
      const quotePrefixLength = markdownQuotePrefix(line.text).length
      const listPrefix = line.text.slice(quotePrefixLength).match(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/)?.[0] ?? ''
      // A click on rendered list text should enter the text, leaving its
      // bullet or number rendered while the caret is inside the item.
      const position = line.from + quotePrefixLength + listPrefix.length
      // Removing the preview replacement changes the height of this block.
      // Let CodeMirror finish that layout before scrolling to the source line;
      // an immediate scroll request can be anchored against the old widget and
      // leave the caret off screen (or jump all the way to the document top).
      view.dispatch({ selection: { anchor: position } })
      view.focus()
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!view.dom.isConnected || view.state.selection.main.head !== position) return
          const scroller = view.scrollDOM
          const line = view.lineBlockAt(position)
          scroller.scrollTop = Math.max(0, line.top - (scroller.clientHeight - line.height) / 2)
        }),
      )
    }
    element.addEventListener('mousedown', (event) => event.preventDefault())
    element.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      enterSource(event.target)
    })
    element.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== 'F2') return
      event.preventDefault()
      enterSource(event.target)
    })
    return element
  }

  ignoreEvent() {
    return true
  }
}

function collapseRepeatedQuoteBlankLines(source: string): string {
  let fence: { marker: '`' | '~'; length: number } | null = null
  let previousWasBlankQuote = false
  const lines: string[] = []
  for (const line of source.split('\n')) {
    const prefix = markdownQuotePrefix(line)
    const content = line.slice(prefix.length)
    const fenceMatch = content.match(/^\s*(`{3,}|~{3,})/)
    const isFenceBoundary = Boolean(fenceMatch && (!fence || (fence.marker === fenceMatch[1][0] && fence.length <= fenceMatch[1].length)))
    const inFenceBeforeLine = Boolean(fence)
    if (prefix && !content.trim() && previousWasBlankQuote && !inFenceBeforeLine) continue
    lines.push(line)
    previousWasBlankQuote = Boolean(prefix && !content.trim() && !inFenceBeforeLine)
    if (isFenceBoundary && fenceMatch) {
      if (fence) fence = null
      else fence = { marker: fenceMatch[1][0] as '`' | '~', length: fenceMatch[1].length }
    }
  }
  return lines.join('\n')
}

let mermaidRenderSequence = 0

class MermaidPreviewWidget extends WidgetType {
  constructor(readonly source: string) {
    super()
  }

  eq(other: MermaidPreviewWidget) {
    return other.source === this.source
  }

  toDOM() {
    const figure = document.createElement('figure')
    figure.className = 'cm-md-mermaid-preview'
    const diagram = document.createElement('div')
    diagram.className = 'cm-md-mermaid'
    diagram.setAttribute('aria-label', 'Mermaid diagram')
    diagram.textContent = 'Rendering diagram…'
    figure.append(diagram)
    const renderId = `textmark-editor-mermaid-${++mermaidRenderSequence}`
    void import('mermaid')
      .then(async ({ default: mermaid }) => {
        if (!diagram.isConnected) return null
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'neutral',
          fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
          flowchart: { htmlLabels: true },
        })
        return mermaid.render(renderId, this.source)
      })
      .then((result) => {
        if (result && diagram.isConnected) diagram.innerHTML = sanitizeMermaidSvg(result.svg)
      })
      .catch(() => {
        if (!diagram.isConnected) return
        diagram.classList.add('render-error')
        diagram.textContent = this.source
      })
    return figure
  }

  ignoreEvent() {
    return false
  }
}

class FootnoteReferenceWidget extends WidgetType {
  constructor(
    readonly number: number,
    readonly target: number,
  ) {
    super()
  }

  eq(other: FootnoteReferenceWidget) {
    return other.number === this.number && other.target === this.target
  }

  toDOM(view: EditorView) {
    const button = document.createElement('button')
    button.type = 'button'
    button.tabIndex = -1
    button.className = 'cm-md-footnote-reference'
    button.textContent = String(this.number)
    button.setAttribute('aria-label', `Footnote ${this.number}`)
    button.title = `Footnote ${this.number}`
    button.addEventListener('mousedown', (event) => event.preventDefault())
    button.addEventListener('click', () => {
      view.dispatch({
        selection: { anchor: this.target },
        effects: EditorView.scrollIntoView(this.target, { y: 'center' }),
      })
      view.focus()
    })
    return button
  }

  ignoreEvent() {
    return true
  }
}

class LinkDefinitionWidget extends WidgetType {
  constructor(
    readonly label: string,
    readonly destination: string,
  ) {
    super()
  }

  eq(other: LinkDefinitionWidget) {
    return this.label === other.label && this.destination === other.destination
  }

  toDOM() {
    const element = document.createElement('span')
    element.className = 'cm-md-link-definition'
    element.textContent = `Link reference · ${this.label} → ${this.destination}`
    element.title = this.destination
    return element
  }
}

class EmptyTableCellWidget extends WidgetType {
  constructor(readonly alignment: 'left' | 'center' | 'right') {
    super()
  }

  eq(other: EmptyTableCellWidget) {
    return this.alignment === other.alignment
  }

  toDOM() {
    const cell = document.createElement('span')
    cell.className = `cm-md-table-cell cm-md-table-cell-empty cm-md-table-align-${this.alignment}`
    cell.setAttribute('aria-hidden', 'true')
    return cell
  }
}

class TaskCheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly from: number,
    readonly to: number,
  ) {
    super()
  }

  eq(other: TaskCheckboxWidget) {
    return this.checked === other.checked && this.from === other.from && this.to === other.to
  }

  toDOM(view: EditorView) {
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.className = 'cm-md-task-checkbox'
    checkbox.checked = this.checked
    checkbox.setAttribute('aria-label', this.checked ? 'Mark task incomplete' : 'Mark task complete')
    checkbox.addEventListener('mousedown', (event) => event.preventDefault())
    checkbox.addEventListener('click', (event) => {
      event.preventDefault()
      view.dispatch({ changes: { from: this.from, to: this.to, insert: this.checked ? '[ ]' : '[x]' } })
      view.focus()
    })
    return checkbox
  }

  ignoreEvent(event: Event) {
    return event.target instanceof HTMLInputElement
  }
}

function buildDecorations(
  view: EditorView,
  options: EditorMarkdownDecorationOptions,
  tableLines: Set<number>,
  tableAlignments: Map<number, Array<'left' | 'center' | 'right'>>,
  frontmatterLines: Map<number, string>,
  mathLines: Set<number>,
  alertLines: Map<number, string>,
  detailsBlocks: MarkdownDetailsBlock[],
  htmlBlocks: MarkdownHtmlBlock[],
  tableBlocks: MarkdownTableBlock[],
  quoteBlocks: MarkdownQuoteBlock[],
  tocBlocks: MarkdownTocBlock[],
): DecorationSet {
  const ranges: Range<Decoration>[] = []
  const add = (from: number, to: number, decoration: Decoration) => ranges.push(decoration.range(from, to))
  const tree = syntaxTree(view.state)
  const selection = view.state.selection.main
  const markdownLinks: Array<{ from: number; to: number }> = []
  const inlineFormattingRanges: Array<{ from: number; to: number }> = []
  tree.iterate({
    enter(node) {
      if (node.name === 'Link') markdownLinks.push({ from: node.from, to: node.to })
      if (inlineNodeClasses[node.name]) inlineFormattingRanges.push({ from: node.from, to: node.to })
    },
  })
  const footnotes = markdownFootnotes(view.state)
  const setextHeadingLines = new Map<number, string>()
  const setextMarkerLines = new Set<number>()
  tree.iterate({
    enter(node) {
      if (node.name !== 'SetextHeading1' && node.name !== 'SetextHeading2') return
      const headingLine = view.state.doc.lineAt(node.from)
      const markerLine = view.state.doc.lineAt(node.to - 1)
      setextHeadingLines.set(headingLine.number, node.name === 'SetextHeading1' ? 'cm-md-h1' : 'cm-md-h2')
      setextMarkerLines.add(markerLine.number)
    },
  })
  const visibleDetailsBlocks = detailsBlocks.filter((block) =>
    selection.empty ? selection.head < block.from || selection.head > block.to : selection.from >= block.to || selection.to <= block.from,
  )
  const visibleHtmlBlocks = htmlBlocks.filter((block) =>
    selection.empty ? selection.head < block.from || selection.head > block.to : selection.from >= block.to || selection.to <= block.from,
  )
  const standaloneHtmlBlocks = visibleHtmlBlocks.filter(
    (html) =>
      !detailsBlocks.some((details) => html.from >= details.from && html.to <= details.to) &&
      !quoteBlocks.some((quote) => html.from >= quote.from && html.to <= quote.to),
  )
  const visibleTableBlocks = tableBlocks.filter(
    (block) =>
      (selection.empty
        ? selection.head < block.from || selection.head > block.to
        : selection.from >= block.to || selection.to <= block.from) &&
      !detailsBlocks.some((details) => block.from >= details.from && block.to <= details.to) &&
      !htmlBlocks.some((html) => block.from >= html.from && block.to <= html.to) &&
      !quoteBlocks.some((quote) => block.from >= quote.from && block.to <= quote.to),
  )
  const visibleQuoteBlocks = quoteBlocks.filter(
    (block) =>
      canRenderQuotePreview(block) &&
      (selection.empty
        ? selection.head < block.from || selection.head > block.to
        : selection.from >= block.to || selection.to <= block.from) &&
      !detailsBlocks.some((details) => block.from >= details.from && block.to <= details.to) &&
      !htmlBlocks.some((html) => block.from >= html.from && block.to <= html.to),
  )
  const visibleTocBlocks = tocBlocks.filter((block) =>
    selection.empty ? selection.head < block.from || selection.head > block.to : selection.from >= block.to || selection.to <= block.from,
  )
  // Keep the rendered appearance on the caret line too. Only reveal Markdown
  // delimiters while the user is editing/selecting the delimiter itself. When
  // the caret touches either edge of an inline construct, reveal both edges so
  // a single trailing marker cannot look like malformed source.
  const markerClassForSelection = (from: number, to: number, className: string) => {
    // An outline jump places the caret at the beginning of the heading line.
    // Keep the heading prefix hidden at that boundary so the heading remains
    // WYSIWYG; the user can still reveal and edit it by moving into the prefix.
    const touchesMarker = selection.empty
      ? selection.head >= from && selection.head <= to && !(className.includes('cm-md-heading-marker') && selection.head === from)
      : selection.from < to && selection.to > from
    const delimiterWidth = to - from
    const touchesInlineDelimiterPair =
      selection.empty &&
      className.includes('cm-md-inline-syntax') &&
      inlineFormattingRanges.some(
        (range) =>
          range.from <= from &&
          range.to >= to &&
          ((selection.head >= range.from && selection.head <= range.from + delimiterWidth) ||
            (selection.head >= range.to - delimiterWidth && selection.head <= range.to)),
      )
    // Keep heading syntax visible while an IME owns the composition range. Some
    // input methods temporarily move that range across the prefix; hiding it
    // then changes the measured line width and makes the heading flicker.
    const composingHeading = view.composing && className.includes('cm-md-heading-marker')
    return touchesMarker || touchesInlineDelimiterPair || composingHeading ? `${className} cm-md-source-revealed` : className
  }
  const syntaxMarkerClasses: Record<string, string> = {
    QuoteMark: 'cm-md-syntax-marker',
    EmphasisMark: 'cm-md-inline-syntax',
    CodeMark: 'cm-md-inline-syntax',
    LinkMark: 'cm-md-inline-syntax',
    ListMark: 'cm-md-list-marker',
    TaskMarker: 'cm-md-task-marker',
  }
  for (const visible of view.visibleRanges)
    tree.iterate({
      from: visible.from,
      to: visible.to,
      enter(node) {
        if (
          visibleDetailsBlocks.some((block) => node.from >= block.from && node.from < block.to) ||
          standaloneHtmlBlocks.some((block) => node.from >= block.from && node.from < block.to) ||
          visibleTableBlocks.some((block) => node.from >= block.from && node.from < block.to) ||
          visibleQuoteBlocks.some((block) => node.from >= block.from && node.from < block.to) ||
          visibleTocBlocks.some((block) => node.from >= block.from && node.from < block.to)
        )
          return
        const isLinkDestination = node.name === 'URL' && markdownLinks.some((link) => link.from <= node.from && link.to >= node.to)
        const className = isLinkDestination ? 'cm-md-link-destination' : inlineNodeClasses[node.name]
        if (className && node.from !== node.to) {
          const first = view.state.doc.lineAt(node.from).number
          const source = view.state.sliceDoc(node.from, node.to)
          const line = view.state.doc.line(first)
          const beforeNode = line.text.slice(0, node.from - line.from)
          const quotePrefix = markdownQuotePrefix(line.text)
          const alertLabel = line.text.slice(quotePrefix.length).match(/^\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i)
          const alertLabelEnd = alertLabel ? line.from + quotePrefix.length + alertLabel[0].length : -1
          const isAlertLabel = node.name === 'Link' && alertLabelEnd >= node.from && node.from < alertLabelEnd
          // Lezer can expose the `[x]`/`[ ]` task marker as a Link node. The
          // task-marker decoration below replaces it with a checkbox widget;
          // painting it as an ordinary blue, underlined link makes completed
          // tasks look broken and leaks Markdown parser internals into the UI.
          const isTaskMarkerLink = node.name === 'Link' && /^\[[ xX]\]$/.test(source) && /^\s*(?:[-+*]|\d+[.)])\s+$/.test(beforeNode)
          const isFootnoteReference = node.name === 'Link' && /^\[\^[^\]]+\]$/.test(source)
          if (!isAlertLabel && !isTaskMarkerLink && !isFootnoteReference && !frontmatterLines.has(first) && !mathLines.has(first))
            add(
              node.from,
              node.to,
              Decoration.mark({ class: isLinkDestination ? markerClassForSelection(node.from, node.to, className) : className }),
            )
        }
        const markerClass = syntaxMarkerClasses[node.name]
        if (!markerClass || node.from === node.to) return
        if (node.name === 'TaskMarker') return
        const line = view.state.doc.lineAt(node.from)
        if (
          frontmatterLines.has(line.number) ||
          mathLines.has(line.number) ||
          visibleDetailsBlocks.some((block) => node.from >= block.from && node.from < block.to) ||
          standaloneHtmlBlocks.some((block) => node.from >= block.from && node.from < block.to) ||
          visibleTableBlocks.some((block) => node.from >= block.from && node.from < block.to) ||
          visibleQuoteBlocks.some((block) => node.from >= block.from && node.from < block.to)
        )
          return
        const codeOffset = markdownCodeContentOffset(line.text)
        const insideCode = tree.resolveInner(line.from + Math.min(codeOffset, Math.max(0, line.length - 1)), 1)
        let ancestor = insideCode
        while (ancestor && ancestor.name !== 'FencedCode' && ancestor.name !== 'CodeBlock') ancestor = ancestor.parent!
        if (ancestor && !['CodeMark', 'QuoteMark'].includes(node.name)) return
        const source = view.state.sliceDoc(node.from, node.to)
        const cls =
          node.name === 'TaskMarker' && /^\[[xX]\]/.test(source)
            ? 'cm-md-task-marker cm-md-task-checked'
            : node.name === 'ListMark' && /^\d/.test(source)
              ? 'cm-md-list-ordered-marker'
              : node.name === 'ListMark'
                ? markdownListMarkerClass(line.text)
                : markerClass
        add(node.from, node.to, Decoration.mark({ class: markerClassForSelection(node.from, node.to, cls) }))
      },
    })
  for (const { from, to } of view.visibleRanges) {
    const first = view.state.doc.lineAt(from)
    const last = view.state.doc.lineAt(to)
    for (let number = first.number; number <= last.number; number += 1) {
      const line = view.state.doc.line(number)
      if (
        visibleDetailsBlocks.some((block) => line.from >= block.from && line.from < block.to) ||
        standaloneHtmlBlocks.some((block) => line.from >= block.from && line.from < block.to) ||
        visibleTableBlocks.some((block) => line.from >= block.from && line.from < block.to) ||
        visibleQuoteBlocks.some((block) => line.from >= block.from && line.from < block.to)
      )
        continue
      let codeNode = tree.resolveInner(line.from, 1)
      while (codeNode && codeNode.name !== 'FencedCode' && codeNode.name !== 'CodeBlock') codeNode = codeNode.parent!
      if (!codeNode) {
        const codeOffset = markdownCodeContentOffset(line.text)
        if (codeOffset > 0 && codeOffset < line.length) {
          codeNode = tree.resolveInner(line.from + codeOffset, 1)
          while (codeNode && codeNode.name !== 'FencedCode' && codeNode.name !== 'CodeBlock') codeNode = codeNode.parent!
        }
      }
      if (codeNode) {
        const quotePrefix = markdownQuotePrefix(line.text)
        const codeText = line.text.slice(quotePrefix.length)
        const fence = codeNode.name === 'FencedCode' && codeText.match(/^(\s*)(`{3,}|~{3,})/)
        const isFence = Boolean(fence)
        if (fence) {
          const fenceStart = line.from + quotePrefix.length + fence[1].length
          add(
            fenceStart,
            fenceStart + fence[2].length,
            Decoration.mark({ class: markerClassForSelection(fenceStart, fenceStart + fence[2].length, 'cm-md-fence-marker') }),
          )
        }
        const fenceLineEditing =
          isFence &&
          (selection.empty
            ? selection.head >= line.from && selection.head <= line.to
            : selection.from <= line.to && selection.to >= line.from)
        add(
          line.from,
          line.from,
          Decoration.line({
            class: isFence ? `cm-md-code-fence${fenceLineEditing ? ' cm-md-code-fence-editing' : ''}` : 'cm-md-code-line',
            attributes: codeNode.name === 'FencedCode' ? { 'data-code-fence-from': String(codeNode.from) } : {},
          }),
        )
      } else {
        const markerLineEditing =
          setextMarkerLines.has(number) &&
          (selection.empty
            ? selection.head >= line.from && selection.head <= line.to
            : selection.from <= line.to && selection.to >= line.from)
        const quotePrefix = markdownQuotePrefix(line.text)
        const quoteBlank = quotePrefix.length > 0 && !line.text.slice(quotePrefix.length).trim()
        const previousLine = number > 1 ? view.state.doc.line(number - 1).text : ''
        const previousQuotePrefix = markdownQuotePrefix(previousLine)
        const previousQuoteBlank = previousQuotePrefix.length > 0 && !previousLine.slice(previousQuotePrefix.length).trim()
        const blankRunHasEarlierLine = number > 1 && ((!line.text.trim() && !previousLine.trim()) || (quoteBlank && previousQuoteBlank))
        const blankLineEditing = selection.empty
          ? selection.head >= line.from && selection.head <= line.to
          : selection.from <= line.to && selection.to >= line.from
        const fallbackLineClass =
          setextHeadingLines.get(number) ??
          ((!line.text.trim() || quoteBlank) && blankRunHasEarlierLine && !blankLineEditing
            ? 'cm-md-blank-line-collapsed'
            : lineClass(line.text))
        const className =
          frontmatterLines.get(number) ??
          (setextMarkerLines.has(number) ? `cm-md-setext-marker${markerLineEditing ? ' cm-md-source-revealed' : ''}` : null) ??
          (mathLines.has(number)
            ? 'cm-md-math-block'
            : (alertLines.get(number) ??
              (tableLines.has(number)
                ? `cm-md-table-row${tableSeparator(line.text) ? ' cm-md-table-separator' : tableLines.has(number + 1) ? '' : ' cm-md-table-last-row'}`
                : fallbackLineClass)))
        if (className) add(line.from, line.from, Decoration.line({ class: className }))
      }
      if (tableLines.has(number) && !tableSeparator(line.text)) {
        for (const [column, cell] of markdownTableCellRanges(line.text).entries()) {
          const alignment = tableAlignments.get(number)?.[column] ?? 'left'
          if (cell.from === cell.to)
            add(line.from + cell.from, line.from + cell.to, Decoration.widget({ widget: new EmptyTableCellWidget(alignment), side: 1 }))
          else
            add(line.from + cell.from, line.from + cell.to, Decoration.mark({ class: `cm-md-table-cell cm-md-table-align-${alignment}` }))
        }
      }
      const isMetadataOrMath = frontmatterLines.has(number) || mathLines.has(number)
      const isCodeLine = Boolean(codeNode)
      const footnoteDefinition = line.text.match(/^\s{0,3}\[\^([^\]]+)\]:[ \t]*/)
      if (footnoteDefinition && !isCodeLine) {
        const footnoteNumber = footnotes.numberById.get(footnoteDefinition[1])
        const from = line.from
        const to = line.from + footnoteDefinition[0].length
        const editingMarker = selection.empty ? selection.head >= from && selection.head <= to : selection.from < to && selection.to > from
        if (footnoteNumber && !editingMarker)
          add(
            from,
            to,
            Decoration.replace({ widget: new FootnoteReferenceWidget(footnoteNumber, line.from + footnoteDefinition[0].length) }),
          )
      }
      const linkDefinition = line.text.match(/^\s{0,3}\[(?!\^)([^\]]+)\]:\s*(<[^>]+>|\S+)(?:\s+["'(].*?["')])?\s*$/)
      if (linkDefinition && !isCodeLine) {
        const from = line.from
        const to = line.to
        const editing = selection.empty ? selection.head >= from && selection.head <= to : selection.from < to && selection.to > from
        if (!editing)
          add(
            from,
            to,
            Decoration.replace({ widget: new LinkDefinitionWidget(linkDefinition[1], linkDefinition[2].replace(/^<|>$/g, '')) }),
          )
      }
      if (!isMetadataOrMath && !isCodeLine)
        for (const marker of markdownSyntaxMarkers(line.text))
          if (
            marker.className === 'cm-md-hardbreak-marker' ||
            marker.className === 'cm-md-escape-marker' ||
            marker.className === 'cm-md-escaped-character' ||
            marker.className === 'cm-md-table-marker' ||
            marker.className === 'cm-md-admonition-marker' ||
            marker.className === 'cm-md-heading-marker' ||
            (marker.className === 'cm-md-syntax-marker' && /^\s{0,3}#{1,6}(?:\s|$)/.test(line.text)) ||
            marker.className.startsWith('cm-md-task-marker') ||
            (marker.className === 'cm-md-inline-syntax' && /[=~]/.test(line.text.slice(marker.from, marker.to)))
          ) {
            const from = line.from + marker.from
            const to = line.from + marker.to
            if (marker.className === 'cm-md-hardbreak-marker') {
              let node = tree.resolveInner(from, 1)
              let inlineCode = false
              while (node) {
                if (node.name === 'InlineCode') {
                  inlineCode = true
                  break
                }
                if (!node.parent) break
                node = node.parent
              }
              const editing = selection.empty ? selection.head >= from && selection.head <= to : selection.from < to && selection.to > from
              if (!inlineCode && !editing) add(from, to, Decoration.mark({ class: marker.className }))
              continue
            }
            if (marker.className.startsWith('cm-md-task-marker')) {
              const editing = selection.empty ? selection.head >= from && selection.head <= to : selection.from < to && selection.to > from
              if (editing) add(from, to, Decoration.mark({ class: markerClassForSelection(from, to, marker.className) }))
              else
                add(
                  from,
                  to,
                  Decoration.replace({
                    widget: new TaskCheckboxWidget(/^\[x\]$/i.test(line.text.slice(marker.from, marker.to)), from, to),
                  }),
                )
            } else add(from, to, Decoration.mark({ class: markerClassForSelection(from, to, marker.className) }))
          }
      if (isMetadataOrMath || isCodeLine) continue
      const inlineHtmlRanges: Array<{ from: number; to: number }> = []
      inlineHtmlPattern.lastIndex = 0
      for (const match of line.text.matchAll(inlineHtmlPattern)) {
        const value = match[0]
        const offset = match.index ?? 0
        if (offset > 0 && line.text[offset - 1] === '\\') continue
        const from = line.from + offset
        const to = from + value.length
        let node = tree.resolveInner(from, 1)
        let insideCode = false
        while (node) {
          if (node.name === 'InlineCode' || node.name === 'FencedCode' || node.name === 'CodeBlock') {
            insideCode = true
            break
          }
          if (!node.parent) break
          node = node.parent
        }
        if (insideCode) continue
        inlineHtmlRanges.push({ from, to })
        const editing = selection.empty ? selection.head >= from && selection.head <= to : selection.from < to && selection.to > from
        if (editing) continue
        const tag = match[1].toLowerCase() as InlineHtmlWidget['tag']
        add(from, to, Decoration.replace({ widget: new InlineHtmlWidget(tag, match[2]) }))
      }
      // Render the inline semantic extensions just like preview while keeping
      // the original delimiters editable whenever the selection enters them.
      const inlineMathRanges = [...line.text.matchAll(inlineMathPattern)].map((match) => {
        const from = match.index ?? 0
        return { from, to: from + match[0].length }
      })
      for (const match of line.text.matchAll(/\+\+([^+\n]+)\+\+|(?<=[\p{L}\p{N}])\^([^\s^\n]+)\^|(?<=[\p{L}\p{N}])(?<!~)~(\d+)~(?!~)/gu)) {
        const value = match[0]
        const offset = match.index ?? 0
        const from = line.from + offset
        const to = from + value.length
        if (offset > 0 && line.text[offset - 1] === '\\') continue
        if (inlineMathRanges.some((range) => range.from < offset + value.length && range.to > offset)) continue
        if (inlineHtmlRanges.some((range) => range.from < to && range.to > from)) continue
        let node = tree.resolveInner(from, 1)
        let insideCode = false
        while (node) {
          if (node.name === 'InlineCode' || node.name === 'FencedCode' || node.name === 'CodeBlock') {
            insideCode = true
            break
          }
          if (!node.parent) break
          node = node.parent
        }
        if (insideCode) continue
        const editing = selection.empty ? selection.head >= from && selection.head <= to : selection.from < to && selection.to > from
        if (editing) continue
        const tag = match[1] !== undefined ? 'ins' : match[2] !== undefined ? 'sup' : 'sub'
        add(from, to, Decoration.replace({ widget: new InlineSemanticWidget(tag, match[1] ?? match[2] ?? match[3] ?? '') }))
      }
      for (const match of line.text.matchAll(/&(?:#\d+|#x[\da-f]+|[a-z][a-z\d]+);/gi)) {
        const value = match[0]
        const offset = match.index ?? 0
        if (
          (offset > 0 && line.text[offset - 1] === '\\') ||
          inlineHtmlRanges.some((range) => range.from <= line.from + offset && range.to >= line.from + offset + value.length)
        )
          continue
        const from = line.from + offset
        const to = from + value.length
        let node = tree.resolveInner(from, 1)
        let insideCodeOrLink = false
        while (node) {
          if (['InlineCode', 'FencedCode', 'CodeBlock', 'Link', 'Autolink', 'URL'].includes(node.name)) {
            insideCodeOrLink = true
            break
          }
          if (!node.parent) break
          node = node.parent
        }
        if (insideCodeOrLink) continue
        const decoded = document.createElement('textarea')
        decoded.innerHTML = value
        if (decoded.value === value) continue
        const editing = selection.empty ? selection.head >= from && selection.head <= to : selection.from < to && selection.to > from
        if (!editing) add(from, to, Decoration.replace({ widget: new EntityWidget(decoded.value) }))
      }
      inlinePattern.lastIndex = 0
      for (const match of line.text.matchAll(inlinePattern)) {
        const value = match[0]
        const offset = match.index ?? 0
        const inlineClass = 'cm-md-highlight'
        add(line.from + offset, line.from + offset + value.length, Decoration.mark({ class: inlineClass }))
      }
      for (const match of line.text.matchAll(/~~([^~\n]+)~~/g)) {
        const value = match[1]
        const offset = (match.index ?? 0) + 2
        const from = line.from + offset
        const to = from + value.length
        const delimiterOffset = from - 2
        let escapedSlashes = 0
        for (let index = delimiterOffset - 1; index >= 0 && line.text[index] === '\\'; index -= 1) escapedSlashes += 1
        if (escapedSlashes % 2 === 1) continue
        let node = tree.resolveInner(from, 1)
        let insideCode = false
        while (node) {
          if (node.name === 'InlineCode' || node.name === 'FencedCode' || node.name === 'CodeBlock') {
            insideCode = true
            break
          }
          if (!node.parent) break
          node = node.parent
        }
        if (!insideCode) add(from, to, Decoration.mark({ class: 'cm-md-strikethrough' }))
      }
      if (!isMetadataOrMath && !isCodeLine) {
        for (const match of line.text.matchAll(inlineMathPattern)) {
          const value = match[0]
          const offset = match.index ?? 0
          const from = line.from + offset
          const to = from + value.length
          const editingMath = selection.empty ? selection.head >= from && selection.head <= to : selection.from < to && selection.to > from
          if (editingMath) continue
          let mathNode = tree.resolveInner(from, 1)
          while (mathNode && mathNode.name !== 'InlineCode' && mathNode.name !== 'FencedCode' && mathNode.name !== 'CodeBlock')
            mathNode = mathNode.parent!
          if (mathNode) continue
          add(
            from,
            to,
            Decoration.replace({
              widget: new MathPreviewWidget(match[1] ?? match[2] ?? match[3] ?? match[4] ?? '', false),
            }),
          )
        }
      }
      if (!isMetadataOrMath && !isCodeLine && !footnoteDefinition) {
        for (const match of line.text.matchAll(/\[\^([^\]]+)\]/g)) {
          const id = match[1]
          const number = footnotes.numberById.get(id)
          const target = footnotes.targetById.get(id)
          if (!number || target === undefined) continue
          const from = line.from + (match.index ?? 0)
          const to = from + match[0].length
          const editingReference = selection.empty
            ? selection.head >= from && selection.head <= to
            : selection.from < to && selection.to > from
          if (!editingReference) add(from, to, Decoration.replace({ widget: new FootnoteReferenceWidget(number, target) }))
        }
      }
      if (options.resolveImage)
        for (const image of editorImageReferences(line.text)) {
          let node = tree.resolveInner(line.from + image.from, 1)
          while (node && node.name !== 'Image') node = node.parent!
          if (!node) continue
          const from = line.from + image.from
          const to = line.from + image.to
          const editingImage = selection.empty ? selection.head >= from && selection.head <= to : selection.from < to && selection.to > from
          if (editingImage) continue
          add(from, to, Decoration.replace({ widget: new ImagePreviewWidget(image.path, image.alt, image.title, options) }))
        }
    }
  }
  return Decoration.set(ranges, true)
}

function buildCodeBlockWrappers(
  view: EditorView,
  detailsBlocks: MarkdownDetailsBlock[],
  htmlBlocks: MarkdownHtmlBlock[],
  quoteBlocks: MarkdownQuoteBlock[],
) {
  const wrappers: Range<BlockWrapper>[] = []
  const document = view.state.doc
  const selection = view.state.selection.main
  const visibleDetailsBlocks = detailsBlocks.filter((block) =>
    selection.empty ? selection.head < block.from || selection.head > block.to : selection.from >= block.to || selection.to <= block.from,
  )
  const visibleHtmlBlocks = htmlBlocks.filter((block) =>
    selection.empty ? selection.head < block.from || selection.head > block.to : selection.from >= block.to || selection.to <= block.from,
  )
  const standaloneHtmlBlocks = visibleHtmlBlocks.filter(
    (html) => !detailsBlocks.some((details) => html.from >= details.from && html.to <= details.to),
  )
  const visibleQuoteBlocks = quoteBlocks.filter(
    (block) =>
      canRenderQuotePreview(block) &&
      (selection.empty
        ? selection.head < block.from || selection.head > block.to
        : selection.from >= block.to || selection.to <= block.from) &&
      !detailsBlocks.some((details) => block.from >= details.from && block.to <= details.to) &&
      !htmlBlocks.some((html) => block.from >= html.from && block.to <= html.to),
  )
  syntaxTree(view.state).iterate({
    enter(node) {
      if (node.name !== 'FencedCode' && node.name !== 'CodeBlock') return
      if (
        visibleDetailsBlocks.some((block) => node.from >= block.from && node.from < block.to) ||
        standaloneHtmlBlocks.some((block) => node.from >= block.from && node.from < block.to) ||
        visibleQuoteBlocks.some((block) => node.from >= block.from && node.from < block.to)
      )
        return
      const first = document.lineAt(node.from)
      const last = document.lineAt(Math.max(node.from, node.to - 1))
      if (/^\s*(?:>\s*)?(`{3,}|~{3,})\s*mermaid\b/i.test(first.text)) return
      wrappers.push(
        BlockWrapper.create({
          tagName: 'div',
          attributes: { class: markdownQuotePrefix(first.text) ? 'cm-md-code-card cm-md-quote-code-card' : 'cm-md-code-card' },
        }).range(first.from, Math.max(last.to, last.from + 1)),
      )
    },
  })
  return BlockWrapper.set(wrappers, true)
}

interface RenderedBlockDecorations {
  mathBlocks: MathBlockRange[]
  mermaidBlocks: MathBlockRange[]
  detailsBlocks: MarkdownDetailsBlock[]
  htmlBlocks: MarkdownHtmlBlock[]
  tableBlocks: MarkdownTableBlock[]
  quoteBlocks: MarkdownQuoteBlock[]
  tocBlocks: MarkdownTocBlock[]
  definitionListBlocks: MarkdownDefinitionListBlock[]
  decorations: DecorationSet
}

function buildDisplayMathDecorations(
  state: EditorState,
  mathBlocks: MathBlockRange[],
  mermaidBlocks: MathBlockRange[],
  detailsBlocks: MarkdownDetailsBlock[],
  htmlBlocks: MarkdownHtmlBlock[],
  tableBlocks: MarkdownTableBlock[],
  quoteBlocks: MarkdownQuoteBlock[],
  tocBlocks: MarkdownTocBlock[],
  definitionListBlocks: MarkdownDefinitionListBlock[],
): DecorationSet {
  const selection = state.selection.main
  const ranges: Range<Decoration>[] = []
  const visibleDetailsBlocks = detailsBlocks.filter((block) =>
    selection.empty ? selection.head < block.from || selection.head > block.to : selection.from >= block.to || selection.to <= block.from,
  )
  const visibleQuoteBlocks = quoteBlocks.filter(
    (block) =>
      canRenderQuotePreview(block) &&
      (selection.empty
        ? selection.head < block.from || selection.head > block.to
        : selection.from >= block.to || selection.to <= block.from) &&
      !detailsBlocks.some((details) => block.from >= details.from && block.to <= details.to) &&
      !htmlBlocks.some((html) => block.from >= html.from && block.to <= html.to),
  )
  const visibleHtmlBlocks = htmlBlocks.filter((block) =>
    selection.empty ? selection.head < block.from || selection.head > block.to : selection.from >= block.to || selection.to <= block.from,
  )
  const standaloneHtmlBlocks = visibleHtmlBlocks.filter(
    (html) =>
      !detailsBlocks.some((details) => html.from >= details.from && html.to <= details.to) &&
      !quoteBlocks.some((quote) => html.from >= quote.from && html.to <= quote.to),
  )
  const visibleTableBlocks = tableBlocks.filter(
    (block) =>
      (selection.empty
        ? selection.head < block.from || selection.head > block.to
        : selection.from >= block.to || selection.to <= block.from) &&
      !detailsBlocks.some((details) => block.from >= details.from && block.to <= details.to) &&
      !htmlBlocks.some((html) => block.from >= html.from && block.to <= html.to) &&
      !quoteBlocks.some((quote) => block.from >= quote.from && block.to <= quote.to),
  )
  const visibleTocBlocks = tocBlocks.filter((block) =>
    selection.empty ? selection.head < block.from || selection.head > block.to : selection.from >= block.to || selection.to <= block.from,
  )
  const visibleDefinitionListBlocks = definitionListBlocks.filter(
    (block) =>
      (selection.empty
        ? selection.head < block.from || selection.head > block.to
        : selection.from >= block.to || selection.to <= block.from) &&
      !detailsBlocks.some((details) => block.from >= details.from && block.to <= details.to) &&
      !htmlBlocks.some((html) => block.from >= html.from && block.to <= html.to) &&
      !tableBlocks.some((table) => block.from >= table.from && block.to <= table.to) &&
      !quoteBlocks.some((quote) => block.from >= quote.from && block.to <= quote.to),
  )
  for (const block of mathBlocks) {
    const editing = selection.empty
      ? selection.head >= block.from && selection.head <= block.to
      : selection.from < block.to && selection.to > block.from
    if (
      editing ||
      !block.source.trim() ||
      detailsBlocks.some((details) => block.from >= details.from && block.to <= details.to) ||
      quoteBlocks.some((quote) => block.from >= quote.from && block.to <= quote.to && canRenderQuotePreview(quote))
    )
      continue
    ranges.push(Decoration.replace({ widget: new MathPreviewWidget(block.source, true), block: true }).range(block.from, block.to))
  }
  for (const block of mermaidBlocks) {
    const editing = selection.empty
      ? selection.head >= block.from && selection.head <= block.to
      : selection.from < block.to && selection.to > block.from
    if (
      editing ||
      !block.source.trim() ||
      detailsBlocks.some((details) => block.from >= details.from && block.to <= details.to) ||
      quoteBlocks.some((quote) => block.from >= quote.from && block.to <= quote.to && canRenderQuotePreview(quote))
    )
      continue
    ranges.push(Decoration.replace({ widget: new MermaidPreviewWidget(block.source), block: true }).range(block.from, block.to))
  }
  for (const block of visibleDetailsBlocks)
    ranges.push(
      Decoration.replace({ widget: new DetailsPreviewWidget(block.summary, block.source, block.open), block: true }).range(
        block.from,
        block.to,
      ),
    )
  for (const block of visibleQuoteBlocks)
    ranges.push(Decoration.replace({ widget: new QuotePreviewWidget(block), block: true }).range(block.from, block.to))
  for (const block of standaloneHtmlBlocks)
    ranges.push(Decoration.replace({ widget: new HtmlBlockPreviewWidget(block.source), block: true }).range(block.from, block.to))
  for (const block of visibleTableBlocks)
    ranges.push(Decoration.replace({ widget: new TablePreviewWidget(block), block: true }).range(block.from, block.to))
  for (const block of visibleTocBlocks)
    ranges.push(Decoration.replace({ widget: new TocPreviewWidget(state.doc.toString()), block: true }).range(block.from, block.to))
  for (const block of visibleDefinitionListBlocks)
    ranges.push(Decoration.replace({ widget: new DefinitionListPreviewWidget(block), block: true }).range(block.from, block.to))
  return Decoration.set(ranges, true)
}

export function createEditorMarkdownDecorations(options: EditorMarkdownDecorationOptions = {}) {
  const inlineDecorations = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      blockWrappers: ReturnType<typeof buildCodeBlockWrappers>
      tableLines: Set<number>
      tableAlignments: Map<number, Array<'left' | 'center' | 'right'>>
      frontmatterLines: Map<number, string>
      mathLines: Set<number>
      alertLines: Map<number, string>
      detailsBlocks: MarkdownDetailsBlock[]
      htmlBlocks: MarkdownHtmlBlock[]
      tableBlocks: MarkdownTableBlock[]
      quoteBlocks: MarkdownQuoteBlock[]
      tocBlocks: MarkdownTocBlock[]
      constructor(view: EditorView) {
        this.tableLines = markdownTableLines(view.state.doc.toString())
        this.tableAlignments = markdownTableAlignmentMap(view.state.doc.toString())
        this.frontmatterLines = markdownFrontmatterLines(view.state.doc.toString())
        this.mathLines = markdownMathLines(view.state.doc.toString())
        this.alertLines = markdownAlertLines(view.state.doc.toString())
        this.detailsBlocks = markdownDetailsBlocks(view.state.doc.toString())
        this.htmlBlocks = markdownHtmlBlocks(view.state.doc.toString())
        this.tableBlocks = markdownTableBlocks(view.state.doc.toString())
        this.quoteBlocks = markdownQuoteBlocks(view.state.doc.toString())
        this.tocBlocks = markdownTocBlocks(view.state.doc.toString())
        this.decorations = buildDecorations(
          view,
          options,
          this.tableLines,
          this.tableAlignments,
          this.frontmatterLines,
          this.mathLines,
          this.alertLines,
          this.detailsBlocks,
          this.htmlBlocks,
          this.tableBlocks,
          this.quoteBlocks,
          this.tocBlocks,
        )
        this.blockWrappers = buildCodeBlockWrappers(view, this.detailsBlocks, this.htmlBlocks, this.quoteBlocks)
      }
      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.selectionSet ||
          update.viewportChanged ||
          syntaxTree(update.startState) !== syntaxTree(update.state)
        ) {
          if (update.docChanged) {
            this.tableLines = markdownTableLines(update.state.doc.toString())
            this.tableAlignments = markdownTableAlignmentMap(update.state.doc.toString())
            this.frontmatterLines = markdownFrontmatterLines(update.state.doc.toString())
            this.mathLines = markdownMathLines(update.state.doc.toString())
            this.alertLines = markdownAlertLines(update.state.doc.toString())
            this.detailsBlocks = markdownDetailsBlocks(update.state.doc.toString())
            this.htmlBlocks = markdownHtmlBlocks(update.state.doc.toString())
            this.tableBlocks = markdownTableBlocks(update.state.doc.toString())
            this.quoteBlocks = markdownQuoteBlocks(update.state.doc.toString())
            this.tocBlocks = markdownTocBlocks(update.state.doc.toString())
          }
          this.decorations = buildDecorations(
            update.view,
            options,
            this.tableLines,
            this.tableAlignments,
            this.frontmatterLines,
            this.mathLines,
            this.alertLines,
            this.detailsBlocks,
            this.htmlBlocks,
            this.tableBlocks,
            this.quoteBlocks,
            this.tocBlocks,
          )
          this.blockWrappers = buildCodeBlockWrappers(update.view, this.detailsBlocks, this.htmlBlocks, this.quoteBlocks)
        }
      }
    },
    {
      decorations: (plugin) => plugin.decorations,
      provide: (plugin) => EditorView.blockWrappers.of((view) => view.plugin(plugin)?.blockWrappers ?? BlockWrapper.set([])),
    },
  )
  // Block widgets must come from the direct decorations facet (rather than a
  // ViewPlugin) so CodeMirror can lay them out as document-level blocks.
  const displayMathDecorations = StateField.define<RenderedBlockDecorations>({
    create: (state) => {
      const source = state.doc.toString()
      const mathBlocks = markdownMathBlocks(source)
      const mermaidBlocks = markdownMermaidBlocks(source)
      const detailsBlocks = markdownDetailsBlocks(source)
      const htmlBlocks = markdownHtmlBlocks(source)
      const tableBlocks = markdownTableBlocks(source)
      const quoteBlocks = markdownQuoteBlocks(source)
      const tocBlocks = markdownTocBlocks(source)
      const definitionListBlocks = markdownDefinitionListBlocks(source)
      return {
        mathBlocks,
        mermaidBlocks,
        detailsBlocks,
        htmlBlocks,
        tableBlocks,
        quoteBlocks,
        tocBlocks,
        definitionListBlocks,
        decorations: buildDisplayMathDecorations(
          state,
          mathBlocks,
          mermaidBlocks,
          detailsBlocks,
          htmlBlocks,
          tableBlocks,
          quoteBlocks,
          tocBlocks,
          definitionListBlocks,
        ),
      }
    },
    update: (current, transaction) => {
      const source = transaction.docChanged ? transaction.state.doc.toString() : null
      const mathBlocks = source === null ? current.mathBlocks : markdownMathBlocks(source)
      const mermaidBlocks = source === null ? current.mermaidBlocks : markdownMermaidBlocks(source)
      const detailsBlocks = source === null ? current.detailsBlocks : markdownDetailsBlocks(source)
      const htmlBlocks = source === null ? current.htmlBlocks : markdownHtmlBlocks(source)
      const tableBlocks = source === null ? current.tableBlocks : markdownTableBlocks(source)
      const quoteBlocks = source === null ? current.quoteBlocks : markdownQuoteBlocks(source)
      const tocBlocks = source === null ? current.tocBlocks : markdownTocBlocks(source)
      const definitionListBlocks = source === null ? current.definitionListBlocks : markdownDefinitionListBlocks(source)
      return {
        mathBlocks,
        mermaidBlocks,
        detailsBlocks,
        htmlBlocks,
        tableBlocks,
        quoteBlocks,
        tocBlocks,
        definitionListBlocks,
        decorations: buildDisplayMathDecorations(
          transaction.state,
          mathBlocks,
          mermaidBlocks,
          detailsBlocks,
          htmlBlocks,
          tableBlocks,
          quoteBlocks,
          tocBlocks,
          definitionListBlocks,
        ),
      }
    },
    provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
  })
  return [inlineDecorations, displayMathDecorations]
}
