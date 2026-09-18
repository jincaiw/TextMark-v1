import { RangeSetBuilder } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { Decoration, ViewPlugin, WidgetType, type DecorationSet, type EditorView, type ViewUpdate } from '@codemirror/view'
import { markdownImageReferences } from './pastedImages'

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

function buildDecorations(view: EditorView, options: EditorMarkdownDecorationOptions): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const tree = syntaxTree(view.state)
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
      if (options.resolveImage)
        for (const image of editorImageReferences(line.text)) {
          let node = tree.resolveInner(line.from + image.from, 1)
          while (node && node.name !== 'Image') node = node.parent!
          if (!node) continue
          builder.add(
            line.from + image.to,
            line.from + image.to,
            Decoration.widget({ widget: new ImagePreviewWidget(image.path, image.alt, options), side: 1 }),
          )
        }
    }
  }
  return builder.finish()
}

export function createEditorMarkdownDecorations(options: EditorMarkdownDecorationOptions = {}) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      constructor(view: EditorView) {
        this.decorations = buildDecorations(view, options)
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) this.decorations = buildDecorations(update.view, options)
      }
    },
    { decorations: (plugin) => plugin.decorations },
  )
}
