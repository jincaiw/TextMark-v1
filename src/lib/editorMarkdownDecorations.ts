import { RangeSetBuilder } from '@codemirror/state'
import { Decoration, ViewPlugin, type DecorationSet, type EditorView, type ViewUpdate } from '@codemirror/view'

const lineClass = (line: string) => {
  if (/^(---|\+\+\+)$/.test(line)) return 'cm-md-frontmatter-boundary'
  if (/^[A-Za-z][\w-]*:\s/.test(line)) return 'cm-md-frontmatter-value'
  if (/^\s*(`{3,}|~{3,})/.test(line)) return 'cm-md-code-fence'
  if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) return 'cm-md-rule'
  if (/^\s*>/.test(line)) return 'cm-md-quote'
  if (/^\s*(?:[-+*]|\d+[.)])\s+\[[ xX]\]\s+/.test(line)) return 'cm-md-task'
  if (/^\s*(?:[-+*]|\d+[.)])\s+/.test(line)) return 'cm-md-list'
  return ''
}

/** Public for lightweight fixture tests; the view plugin only processes the
 * viewport, keeping large Markdown files responsive. */
export function markdownLineClass(line: string) {
  return lineClass(line)
}

const inlinePattern = /`[^`\n]+`|\*\*[^*\n]+\*\*|~~[^~\n]+~~|\[[^\]\n]+\]\([^\)\n]+\)/g

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  for (const { from, to } of view.visibleRanges) {
    const first = view.state.doc.lineAt(from)
    const last = view.state.doc.lineAt(to)
    for (let number = first.number; number <= last.number; number += 1) {
      const line = view.state.doc.line(number)
      const className = lineClass(line.text)
      if (className) builder.add(line.from, line.from, Decoration.line({ class: className }))
      inlinePattern.lastIndex = 0
      for (const match of line.text.matchAll(inlinePattern)) {
        const value = match[0]
        const offset = match.index ?? 0
        const inlineClass = value.startsWith('`') ? 'cm-md-inline-code' : value.startsWith('[') ? 'cm-md-link' : 'cm-md-emphasis'
        builder.add(line.from + offset, line.from + offset + value.length, Decoration.mark({ class: inlineClass }))
      }
    }
  }
  return builder.finish()
}

export const editorMarkdownDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) this.decorations = buildDecorations(update.view)
    }
  },
  { decorations: (plugin) => plugin.decorations },
)
