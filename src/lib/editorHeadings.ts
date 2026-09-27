import { syntaxTree } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'
import { RangeSetBuilder } from '@codemirror/state'
import { Decoration, ViewPlugin, type DecorationSet, type EditorView, type ViewUpdate } from '@codemirror/view'
import { markdownFrontmatterLines, markdownMathLines } from './editorMarkdownDecorations'

export interface HeadingLineInfo {
  level: number
  afterBlank: boolean
}

const headingName = /(?:ATX|Setext)?Heading([1-6])\b/
const codeNode = /(?:FencedCode|CodeBlock|InlineCode|Comment)\b/
const underlineOnly = /^[=\-]+\s*$/

/**
 * Reports whether the given source line renders as a Markdown heading in the
 * editor, mirroring the preview's heading styling. Returns null for plain
 * lines, for heading syntax inside fenced/inline code, and for the setext
 * underline itself (the preview never renders the ==== / ---- line).
 */
export function headingInfoForLine(
  state: EditorState,
  lineNumber: number,
  excludedLines = new Set([...markdownFrontmatterLines(state.doc.toString()).keys(), ...markdownMathLines(state.doc.toString())]),
): HeadingLineInfo | null {
  if (lineNumber < 1 || lineNumber > state.doc.lines) return null
  if (excludedLines.has(lineNumber)) return null
  const line = state.doc.line(lineNumber)
  if (!line.text.trim() || underlineOnly.test(line.text)) return null
  let level = 0
  let insideCode = false
  syntaxTree(state).iterate({
    from: line.from,
    to: line.to,
    enter(node) {
      if (codeNode.test(node.name)) {
        insideCode = true
        return false
      }
      if (!level) {
        const match = headingName.exec(node.name)
        if (match) level = Number(match[1])
      }
    },
  })
  if (insideCode || !level) return null
  const previous = lineNumber > 1 ? state.doc.line(lineNumber - 1) : null
  return { level, afterBlank: previous !== null && previous.text.trim() === '' }
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const excludedLines = new Set([
    ...markdownFrontmatterLines(view.state.doc.toString()).keys(),
    ...markdownMathLines(view.state.doc.toString()),
  ])
  for (const { from, to } of view.visibleRanges) {
    const firstLine = view.state.doc.lineAt(from)
    const lastLine = view.state.doc.lineAt(to)
    for (let number = firstLine.number; number <= lastLine.number; number += 1) {
      const info = headingInfoForLine(view.state, number, excludedLines)
      if (!info) continue
      const line = view.state.doc.line(number)
      const className = info.afterBlank ? `cm-md-h${info.level} cm-md-heading-after-blank` : `cm-md-h${info.level}`
      builder.add(line.from, line.from, Decoration.line({ class: className }))
    }
  }
  return builder.finish()
}

/**
 * Line decorations that render source headings at the preview's typographic
 * scale. Rebuilt only when the document or the visible viewport changes.
 */
export const editorHeadings = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) this.decorations = buildDecorations(update.view)
    }
  },
  { decorations: (view) => view.decorations },
)
