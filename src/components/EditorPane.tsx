import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView } from '@codemirror/view'
import { indentLess, indentMore } from '@codemirror/commands'
import { keymap } from '@codemirror/view'
import type { ContentWidth, FormatCommand } from '../types'

export interface EditorPaneHandle {
  focus: () => void
  format: (command: FormatCommand) => void
}

interface EditorPaneProps {
  value: string
  theme: 'dark' | 'light'
  fontSize: number
  zoom: number
  contentWidth: ContentWidth
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

function applyFormat(view: EditorView, command: FormatCommand) {
  const selection = view.state.selection.main
  const selected = view.state.sliceDoc(selection.from, selection.to)
  const wrapper = wrappers[command]
  if (wrapper) {
    const inserted = `${wrapper[0]}${selected || 'text'}${wrapper[1]}`
    view.dispatch({
      changes: { from: selection.from, to: selection.to, insert: inserted },
      selection: { anchor: selection.from + wrapper[0].length, head: selection.from + wrapper[0].length + (selected || 'text').length },
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
  let index = 0
  const transformed = lines
    .map((line) => {
      if (heading !== undefined) return `${heading === '0' ? '' : `${'#'.repeat(Number(heading))} `}${line.replace(/^#{1,6}\s+/, '')}`
      if (command === 'bulletList') return `- ${line.replace(/^\s*(?:[-+*]|\d+\.)\s+/, '')}`
      if (command === 'orderedList') return `${++index}. ${line.replace(/^\s*(?:[-+*]|\d+\.)\s+/, '')}`
      if (command === 'taskList') return `- [ ] ${line.replace(/^\s*(?:[-+*]\s+)?(?:\[[ xX]\]\s+)?/, '')}`
      if (command === 'quote') return `> ${line.replace(/^>\s?/, '')}`
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
    }),
    [],
  )

  useEffect(() => {
    if (ready && props.initialFormat && viewRef.current) {
      applyFormat(viewRef.current, props.initialFormat)
      props.onInitialFormatApplied?.()
    }
  }, [ready, props.initialFormat, props.onInitialFormatApplied])

  return (
    <section
      className={`editor-pane content-${props.contentWidth}`}
      aria-label="Markdown editor"
      style={{ '--editor-zoom': props.zoom / 100 } as React.CSSProperties}
    >
      <div className="editor-page">
        <CodeMirror
          value={props.value}
          height="100%"
          theme={props.theme === 'dark' ? oneDark : 'light'}
          extensions={[
            markdown(),
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
