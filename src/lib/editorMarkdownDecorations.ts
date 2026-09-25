import { RangeSetBuilder } from '@codemirror/state'
import { Range } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { BlockWrapper, Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { markdownImageReferences } from './pastedImages'

const lineClass = (line: string) => {
  if (/^(---|\+\+\+)$/.test(line)) return 'cm-md-frontmatter-boundary'
  if (/^[A-Za-z][\w-]*:\s/.test(line)) return 'cm-md-frontmatter-value'
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

/** Public for lightweight fixture tests; the view plugin only processes the
 * viewport, keeping large Markdown files responsive. */
export function markdownLineClass(line: string) {
  return lineClass(line)
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
    add(markerStart, markerStart + marker.length)
  }
  const task = line.match(/^(\s*)(?:[-+*]|\d+[.)])\s+(\[[ xX]\])/)
  if (task)
    add(
      task[1].length + line.slice(task[1].length).search(/\[/),
      task[1].length + line.slice(task[1].length).search(/\[/) + task[2].length,
      'cm-md-task-marker',
    )
  const fence = line.match(/^(\s*)(`{3,}|~{3,})(?:\s*[^\s]*)?\s*$/)
  if (fence) add(fence[1].length, fence[1].length + fence[2].length, 'cm-md-fence-marker')
  if (/^\s*\|.*\|\s*$/.test(line)) {
    for (const match of line.matchAll(/\|/g)) add(match.index ?? 0, (match.index ?? 0) + 1, 'cm-md-table-marker')
  }
  return markers.sort((left, right) => left.from - right.from || left.to - right.to)
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
      let codeNode = tree.resolveInner(line.from, 1)
      while (codeNode && codeNode.name !== 'FencedCode') codeNode = codeNode.parent!
      if (codeNode) {
        const isFence = /^\s*(?:`{3,}|~{3,})/.test(line.text)
        builder.add(
          line.from,
          line.from,
          Decoration.line({
            class: isFence ? 'cm-md-code-fence' : 'cm-md-code-line',
            attributes: { 'data-code-fence-from': String(codeNode.from) },
          }),
        )
      } else {
        const className = lineClass(line.text)
        if (className) builder.add(line.from, line.from, Decoration.line({ class: className }))
      }
      const activeLine = view.state.doc.lineAt(view.state.selection.main.head).number === number
      if (!activeLine)
        for (const marker of markdownSyntaxMarkers(line.text))
          builder.add(line.from + marker.from, line.from + marker.to, Decoration.mark({ class: marker.className }))
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
      constructor(view: EditorView) {
        this.decorations = buildDecorations(view, options)
        this.blockWrappers = buildCodeBlockWrappers(view)
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || syntaxTree(update.startState) !== syntaxTree(update.state)) {
          this.decorations = buildDecorations(update.view, options)
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
