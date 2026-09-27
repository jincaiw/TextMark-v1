import { Range } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { BlockWrapper, Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { markdownImageReferences } from './pastedImages'
import { splitFrontmatter } from './frontmatter'

const lineClass = (line: string) => {
  const fence = line.match(/^\s*(`{3,}|~{3,})\s*([^\s]*)?/)
  if (fence) return fence[2]?.toLowerCase() === 'mermaid' ? 'cm-md-mermaid-fence' : 'cm-md-code-fence'
  if (/^\s*(?:\$\$|\\\[|\\\])\s*$/.test(line)) return 'cm-md-math'
  if (/^\s*(?:[-+*]|\d+[.)])\s+\[[ xX]\]\s+/.test(line)) return 'cm-md-task'
  if (/^\s*\|.*\|\s*$/.test(line) && /\|\s*:?-{3,}:?\s*(?:\||$)/.test(line)) return 'cm-md-table'
  if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) return 'cm-md-rule'
  if (/^\s*>/.test(line)) return 'cm-md-quote'
  if (/^\s*(?:[-+*]|\d+[.)])\s+/.test(line)) return 'cm-md-list'
  return ''
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
    [1, 'cm-md-frontmatter-boundary'],
    [closingIndex + 1, 'cm-md-frontmatter-boundary'],
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

/** Returns only structural Markdown punctuation, so inactive source can be
 * visually quieter without hiding the content itself. Offsets are line-local. */
export function markdownSyntaxMarkers(line: string): MarkdownSyntaxMarker[] {
  const markers: MarkdownSyntaxMarker[] = []
  const add = (from: number, to: number, className = 'cm-md-syntax-marker') => {
    if (to > from) markers.push({ from, to, className })
  }
  const prefix = line.match(/^(\s{0,3})(#{1,6})(?=\s)|^(\s*)([-+*]|\d+[.)])(?=\s)|^(\s*)(>)(?=\s?)/)
  if (prefix) {
    const markerStart = prefix[1]?.length ?? prefix[3]?.length ?? prefix[5]?.length ?? 0
    const marker = prefix[2] ?? prefix[4] ?? prefix[6] ?? ''
    const markerClass = prefix[4] ? (/^\d/.test(marker) ? 'cm-md-list-ordered-marker' : 'cm-md-list-marker') : 'cm-md-syntax-marker'
    add(markerStart, markerStart + marker.length, markerClass)
  }
  const task = line.match(/^(\s*)(?:[-+*]|\d+[.)])\s+(\[[ xX]\])/)
  if (task)
    add(
      task[1].length + line.slice(task[1].length).search(/\[/),
      task[1].length + line.slice(task[1].length).search(/\[/) + task[2].length,
      task[2].toLowerCase() === '[x]' ? 'cm-md-task-marker cm-md-task-checked' : 'cm-md-task-marker',
    )
  const fence = line.match(/^(\s*)(`{3,}|~{3,})(?:\s*[^\s]*)?\s*$/)
  if (fence) add(fence[1].length, fence[1].length + fence[2].length, 'cm-md-fence-marker')
  if (/^\s*\|.*\|\s*$/.test(line)) {
    for (const match of line.matchAll(/\|/g)) add(match.index ?? 0, (match.index ?? 0) + 1, 'cm-md-table-marker')
  }
  // Keep Markdown syntax visible on the active line (the caller skips markers
  // there), and let inactive lines read like rendered content. These ranges
  // are intentionally limited to simple, single-line inline constructs.
  for (const match of line.matchAll(/\*\*[^*\n]+\*\*|~~[^~\n]+~~|==[^=\n]+==|`[^`\n]+`|\*(?!\*)[^*\n]+\*(?!\*)|_(?!_)[^_\n]+_(?!_)/g)) {
    const value = match[0]
    const start = match.index ?? 0
    const delimiter = value.startsWith('**') || value.startsWith('~~') || value.startsWith('==') ? 2 : 1
    add(start, start + delimiter, 'cm-md-inline-syntax')
    add(start + value.length - delimiter, start + value.length, 'cm-md-inline-syntax')
  }
  for (const match of line.matchAll(/\[([^\]\n]+)\]\(([^)\n]+)\)/g)) {
    const start = match.index ?? 0
    const labelEnd = start + match[0].indexOf(']')
    add(start, start + 1, 'cm-md-inline-syntax')
    add(labelEnd, start + match[0].length, 'cm-md-inline-syntax')
  }
  return markers.sort((left, right) => left.from - right.from || left.to - right.to)
}

const inlinePattern =
  /==[^=\n]+==|`[^`\n]+`|\*\*[^*\n]+\*\*|~~[^~\n]+~~|\[[^\]\n]+\]\([^\)\n]+\)|\*(?!\*)[^*\n]+\*(?!\*)|_(?!_)[^_\n]+_(?!_)/g
export interface EditorImageReference {
  alt: string
  path: string
  from: number
  to: number
}

export function editorImageReferences(line: string): EditorImageReference[] {
  return markdownImageReferences(line)
    .filter(({ path }) => !/^(?:[a-z][a-z0-9+.-]*:|\/|\\|#)/i.test(path))
    .map(({ alt, path, imageFrom, imageTo }) => ({ alt, path, from: imageFrom, to: imageTo }))
}

interface EditorMarkdownDecorationOptions {
  resolveImage?: (path: string) => Promise<string | null>
  onRenameImage?: (path: string) => void
}

class ImagePreviewWidget extends WidgetType {
  constructor(
    readonly path: string,
    readonly alt: string,
    readonly options: EditorMarkdownDecorationOptions,
  ) {
    super()
  }

  eq(other: ImagePreviewWidget) {
    return other.path === this.path && other.alt === this.alt && other.options === this.options
  }

  toDOM() {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'cm-md-image-preview'
    button.setAttribute('aria-label', this.alt ? `Image: ${this.alt}` : 'Markdown image')
    button.title = this.path
    const image = document.createElement('img')
    image.alt = this.alt
    button.append(image)
    void this.options.resolveImage?.(this.path).then((source) => {
      if (source && button.isConnected) image.src = source
      else if (button.isConnected) button.classList.add('asset-error')
    })
    button.addEventListener('mousedown', (event) => event.preventDefault())
    button.addEventListener('click', () => this.options.onRenameImage?.(this.path))
    return button
  }

  ignoreEvent() {
    return false
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

function buildDecorations(
  view: EditorView,
  options: EditorMarkdownDecorationOptions,
  tableLines: Set<number>,
  tableAlignments: Map<number, Array<'left' | 'center' | 'right'>>,
  frontmatterLines: Map<number, string>,
  mathLines: Set<number>,
): DecorationSet {
  const ranges: Range<Decoration>[] = []
  const add = (from: number, to: number, decoration: Decoration) => ranges.push(decoration.range(from, to))
  const tree = syntaxTree(view.state)
  for (const { from, to } of view.visibleRanges) {
    const first = view.state.doc.lineAt(from)
    const last = view.state.doc.lineAt(to)
    for (let number = first.number; number <= last.number; number += 1) {
      const line = view.state.doc.line(number)
      let codeNode = tree.resolveInner(line.from, 1)
      while (codeNode && codeNode.name !== 'FencedCode') codeNode = codeNode.parent!
      if (codeNode) {
        const isFence = /^\s*(?:`{3,}|~{3,})/.test(line.text)
        add(
          line.from,
          line.from,
          Decoration.line({
            class: isFence ? 'cm-md-code-fence' : 'cm-md-code-line',
            attributes: { 'data-code-fence-from': String(codeNode.from) },
          }),
        )
      } else {
        const className =
          frontmatterLines.get(number) ??
          (mathLines.has(number)
            ? 'cm-md-math-block'
            : tableLines.has(number)
              ? `cm-md-table-row${tableSeparator(line.text) ? ' cm-md-table-separator' : tableLines.has(number + 1) ? '' : ' cm-md-table-last-row'}`
              : lineClass(line.text))
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
      const activeLine = view.state.doc.lineAt(view.state.selection.main.head).number === number
      const isMetadataOrMath = frontmatterLines.has(number) || mathLines.has(number)
      if (!activeLine && !isMetadataOrMath)
        for (const marker of markdownSyntaxMarkers(line.text))
          add(line.from + marker.from, line.from + marker.to, Decoration.mark({ class: marker.className }))
      if (isMetadataOrMath) continue
      inlinePattern.lastIndex = 0
      for (const match of line.text.matchAll(inlinePattern)) {
        const value = match[0]
        const offset = match.index ?? 0
        const inlineClass = value.startsWith('==')
          ? 'cm-md-highlight'
          : value.startsWith('`')
            ? 'cm-md-inline-code'
            : value.startsWith('[')
              ? 'cm-md-link'
              : 'cm-md-emphasis'
        add(line.from + offset, line.from + offset + value.length, Decoration.mark({ class: inlineClass }))
      }
      if (options.resolveImage)
        for (const image of editorImageReferences(line.text)) {
          let node = tree.resolveInner(line.from + image.from, 1)
          while (node && node.name !== 'Image') node = node.parent!
          if (!node) continue
          add(
            line.from + image.to,
            line.from + image.to,
            Decoration.widget({ widget: new ImagePreviewWidget(image.path, image.alt, options), side: 1 }),
          )
        }
    }
  }
  return Decoration.set(ranges, true)
}

function buildCodeBlockWrappers(view: EditorView) {
  const wrappers: Range<BlockWrapper>[] = []
  const document = view.state.doc
  syntaxTree(view.state).iterate({
    enter(node) {
      if (node.name !== 'FencedCode') return
      const first = document.lineAt(node.from)
      const last = document.lineAt(Math.max(node.from, node.to - 1))
      wrappers.push(
        BlockWrapper.create({
          tagName: 'div',
          attributes: { class: 'cm-md-code-card' },
        }).range(first.from, Math.max(last.to, last.from + 1)),
      )
    },
  })
  return BlockWrapper.set(wrappers, true)
}

export function createEditorMarkdownDecorations(options: EditorMarkdownDecorationOptions = {}) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      blockWrappers: ReturnType<typeof buildCodeBlockWrappers>
      tableLines: Set<number>
      tableAlignments: Map<number, Array<'left' | 'center' | 'right'>>
      frontmatterLines: Map<number, string>
      mathLines: Set<number>
      constructor(view: EditorView) {
        this.tableLines = markdownTableLines(view.state.doc.toString())
        this.tableAlignments = markdownTableAlignmentMap(view.state.doc.toString())
        this.frontmatterLines = markdownFrontmatterLines(view.state.doc.toString())
        this.mathLines = markdownMathLines(view.state.doc.toString())
        this.decorations = buildDecorations(view, options, this.tableLines, this.tableAlignments, this.frontmatterLines, this.mathLines)
        this.blockWrappers = buildCodeBlockWrappers(view)
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || syntaxTree(update.startState) !== syntaxTree(update.state)) {
          if (update.docChanged) {
            this.tableLines = markdownTableLines(update.state.doc.toString())
            this.tableAlignments = markdownTableAlignmentMap(update.state.doc.toString())
            this.frontmatterLines = markdownFrontmatterLines(update.state.doc.toString())
            this.mathLines = markdownMathLines(update.state.doc.toString())
          }
          this.decorations = buildDecorations(
            update.view,
            options,
            this.tableLines,
            this.tableAlignments,
            this.frontmatterLines,
            this.mathLines,
          )
          this.blockWrappers = buildCodeBlockWrappers(update.view)
        }
      }
    },
    {
      decorations: (plugin) => plugin.decorations,
      provide: (plugin) => EditorView.blockWrappers.of((view) => view.plugin(plugin)?.blockWrappers ?? BlockWrapper.set([])),
    },
  )
}
