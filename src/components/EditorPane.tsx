import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView } from '@codemirror/view'
import { indentLess, indentMore } from '@codemirror/commands'
import { keymap } from '@codemirror/view'
import { editorHeadings } from '../lib/editorHeadings'
import { editorMarkdownDecorations } from '../lib/editorMarkdownDecorations'
import { clampScrollFraction } from '../lib/scrollFraction'
import type { ContentWidth, FormatCommand } from '../types'

export interface EditorPaneHandle {
  focus: () => void
  format: (command: FormatCommand) => void
  /** Fraction of the editor's scroll range (0–1); used to hand the reading
   * position over to the preview when leaving edit mode. */
  getScrollFraction: () => number
}

interface EditorPaneProps {
  value: string
  theme: 'dark' | 'light'
  fontSize: number
  zoom: number
  contentWidth: ContentWidth
  /** Scroll fraction (0–1) to restore when entering edit mode from the preview. */
  initialScrollFraction?: number
  initialFormat?: FormatCommand | null
  onInitialFormatApplied?: () => void
  onChange: (value: string) => void
  onCursorChange: (line: number, column: number) => void
}

const wrappers: Partial<Record<FormatCommand, [string, string]>> = {
  bold: ['**', '**'],
  italic: ['*', '*'],
  strikethrough: ['~~', '~~'],
  code: ['`', '`'],
  link: ['[', '](https://)'],
}

function toggledInline(selected: string, wrapper: [string, string]) {
  if (selected.startsWith(wrapper[0]) && selected.endsWith(wrapper[1]) && selected.length >= wrapper[0].length + wrapper[1].length)
    return {
      text: selected.slice(wrapper[0].length, -wrapper[1].length),
      selectionStart: 0,
      selectionEnd: selected.length - wrapper[0].length - wrapper[1].length,
    }
  const body = selected || 'text'
  return { text: `${wrapper[0]}${body}${wrapper[1]}`, selectionStart: wrapper[0].length, selectionEnd: wrapper[0].length + body.length }
}

const stripListMarker = (line: string) => line.replace(/^\s*(?:[-+*]|\d+[.)])\s+/, '')
const stripTaskMarker = (line: string) => line.replace(/^\s*(?:[-+*]\s+)?(?:\[[ xX]\]\s+)?/, '')

function applyFormat(view: EditorView, command: FormatCommand) {
  const selection = view.state.selection.main
  const selected = view.state.sliceDoc(selection.from, selection.to)
  const wrapper = wrappers[command]
  if (wrapper) {
    const toggled = toggledInline(selected, wrapper)
    view.dispatch({
      changes: { from: selection.from, to: selection.to, insert: toggled.text },
      selection: { anchor: selection.from + toggled.selectionStart, head: selection.from + toggled.selectionEnd },
    })
    view.focus()
    return
  }

  const startLine = view.state.doc.lineAt(selection.from)
  const endLine = view.state.doc.lineAt(selection.to)
  const from = startLine.from
  const to = endLine.to
  const lines = view.state.sliceDoc(from, to).split('\n')
  const heading = command.match(/^h([0-3])$/)?.[1]
  const allHave = (pattern: RegExp) => lines.every((line) => pattern.test(line))
  const removing =
    heading !== undefined
      ? allHave(heading === '0' ? /^#{1,6}\s+/ : new RegExp(`^#{${heading}}\\s+`))
      : command === 'bulletList'
        ? allHave(/^\s*[-+*]\s+/)
        : command === 'orderedList'
          ? allHave(/^\s*\d+[.)]\s+/)
          : command === 'taskList'
            ? allHave(/^\s*(?:[-+*]\s+)?\[[ xX]\]\s+/)
            : command === 'quote'
              ? allHave(/^>\s?/)
              : false
  let index = 0
  const transformed = lines
    .map((line) => {
      if (heading !== undefined)
        return removing || heading === '0'
          ? line.replace(/^#{1,6}\s+/, '')
          : `${'#'.repeat(Number(heading))} ${line.replace(/^#{1,6}\s+/, '')}`
      if (command === 'bulletList') return removing ? line.replace(/^\s*[-+*]\s+/, '') : `- ${stripListMarker(line)}`
      if (command === 'orderedList') return removing ? line.replace(/^\s*\d+[.)]\s+/, '') : `${++index}. ${stripListMarker(line)}`
      if (command === 'taskList') return removing ? stripTaskMarker(line) : `- [ ] ${stripTaskMarker(line)}`
      if (command === 'quote') return removing ? line.replace(/^>\s?/, '') : `> ${line.replace(/^>\s?/, '')}`
      return line
    })
    .join('\n')
  view.dispatch({ changes: { from, to, insert: transformed }, selection: { anchor: from, head: from + transformed.length } })
  view.focus()
}

export const EditorPane = forwardRef<EditorPaneHandle, EditorPaneProps>(function EditorPane(props, forwardedRef) {
  const viewRef = useRef<EditorView | null>(null)
  const [ready, setReady] = useState(false)

  useImperativeHandle(
    forwardedRef,
    () => ({
      focus: () => viewRef.current?.focus(),
      format: (command) => {
        if (viewRef.current) applyFormat(viewRef.current, command)
      },
      getScrollFraction: () => {
        const dom = viewRef.current?.scrollDOM
        if (!dom || dom.scrollHeight <= dom.clientHeight) return 0
        return clampScrollFraction(dom.scrollTop / (dom.scrollHeight - dom.clientHeight))
      },
    }),
    [],
  )

  useEffect(() => {
    if (!ready || props.initialScrollFraction == null || !viewRef.current) return
    const dom = viewRef.current.scrollDOM
    const fraction = clampScrollFraction(props.initialScrollFraction)
    const frame = requestAnimationFrame(() => {
      dom.scrollTop = fraction * Math.max(0, dom.scrollHeight - dom.clientHeight)
    })
    return () => cancelAnimationFrame(frame)
  }, [ready, props.initialScrollFraction])

  useEffect(() => {
    if (ready && props.initialFormat && viewRef.current) {
      applyFormat(viewRef.current, props.initialFormat)
      props.onInitialFormatApplied?.()
    }
  }, [ready, props.initialFormat, props.onInitialFormatApplied])

  return (
    <section className={`editor-pane content-${props.contentWidth}`} aria-label="Markdown editor">
      <div className="editor-page">
        <CodeMirror
          value={props.value}
          height="100%"
          theme={props.theme === 'dark' ? oneDark : 'light'}
          extensions={[
            markdown(),
            editorHeadings,
            editorMarkdownDecorations,
            EditorView.lineWrapping,
            EditorView.contentAttributes.of({ spellcheck: 'true', autocapitalize: 'sentences' }),
            keymap.of([
              { key: 'Tab', run: indentMore },
              { key: 'Shift-Tab', run: indentLess },
            ]),
          ]}
          onCreateEditor={(view) => {
            viewRef.current = view
            setReady(true)
          }}
          onChange={props.onChange}
          onUpdate={(update) => {
            if (!update.selectionSet && !update.docChanged) return
            const head = update.state.selection.main.head
            const line = update.state.doc.lineAt(head)
            props.onCursorChange(line.number, head - line.from + 1)
          }}
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
            bracketMatching: true,
            closeBrackets: true,
          }}
          style={{ fontSize: (props.fontSize * props.zoom) / 100 }}
        />
      </div>
    </section>
  )
})
