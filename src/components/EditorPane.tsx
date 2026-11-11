import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView } from '@codemirror/view'
import { indentLess, indentMore } from '@codemirror/commands'
import { keymap } from '@codemirror/view'
import { editorHeadings } from '../lib/editorHeadings'
import {
  applyBlockStyle,
  applyListStyle,
  insertLinkFromPopover,
  insertLinkPlaceholder,
  setHeading,
  toggleBlockPrefix,
  toggleInlineMark,
  toggleOrderedList,
} from '../lib/formatEditing'
import {
  blockStyle,
  linkSelection,
  listStyle,
  selectionContext,
  type BlockStyle,
  type FormattingState,
  type LinkSelection,
  type ListStyle,
} from '../lib/formatState'
import { createEditorMarkdownDecorations } from '../lib/editorMarkdownDecorations'
import {
  codeFenceAutoCloseInsertion,
  editableCodeFenceAtLine,
  isCodeFenceBodyLine,
  rewriteCodeFenceLanguage,
  type EditableCodeFence,
} from '../lib/codeFenceEditing'
import { clampScrollFraction } from '../lib/scrollFraction'
import { caretToOffset } from '../lib/readingPosition'
import { loadLocalAsset } from '../lib/platform'
import { orderedMatchesFrom, replaceAllMatches, searchMatchOffsets, selectionMatches } from '../lib/search'
import type { ContentWidth, DocumentStats, EditorSessionState, FormatCommand, SearchMode } from '../types'

export interface EditorPaneHandle {
  focus: () => void
  find: (query: string, matchCase: boolean, backwards?: boolean) => boolean
  replace: (query: string, replacement: string, options: ReplaceOptions) => number
  revealLine: (line: number) => void
  /** The currently selected source text, or '' when the caret has no range. */
  getSelectionText: () => string
  /** Center the current selection in the editor viewport (Jump to Selection). */
  revealSelection: () => void
  /** Source line currently at the top of the editor viewport. */
  getTopLine: () => number | null
  format: (command: FormatCommand) => void
  /** Live formatting state of the selection, for the floating format controls. */
  getFormattingState: () => FormattingState | null
  /** The innermost block style enclosing the caret (quote/code/plain/fenced/table). */
  getBlockStyle: () => BlockStyle | null
  /** The common list style of the selected lines. */
  getListStyle: () => ListStyle | null
  /** The range and text the link form edits, expanding an enclosing link. */
  getLinkSelection: () => LinkSelection | null
  /** Replace a range with a Markdown link (the floating bar's link form). */
  insertLink: (text: string, url: string, from: number, to: number) => boolean
  /** Apply a block style from the More Formatting popover. */
  setBlockStyle: (style: BlockStyle, language?: string) => boolean
  /** Apply a list style from the Lists popover. */
  setListStyle: (style: Exclude<ListStyle, 'mixed'>) => boolean
  /** Fraction of the editor's scroll range (0–1); used to hand the reading
   * position over to the preview when leaving edit mode. */
  getScrollFraction: () => number
  getState: () => EditorSessionState | null
}

export interface ReplaceOptions {
  matchCase: boolean
  all?: boolean
  mode?: SearchMode
}

interface EditorPaneProps {
  value: string
  theme: 'dark' | 'light'
  fontSize: number
  zoom: number
  contentWidth: ContentWidth
  /** Scroll fraction (0–1) to restore when entering edit mode from the preview. */
  initialScrollFraction?: number
  /** Source line to reveal when entering edit mode. Takes precedence over the
   * scroll fraction because heading anchors survive the layout difference
   * between the preview and the editor. */
  initialLine?: number
  /** Selection to put back when returning to the editor. */
  initialSelection?: EditorSessionState['selection'] | null
  /** Caret to put back when returning to the editor, in source line/column.
   * Only honoured together with `initialLine`, and only when the reader did not
   * move while they were in the preview (see `caretForReturnToEditor`). */
  initialCursor?: { line: number; column: number } | null
  /** Focus the editor after its initial position has been applied. This is
   * intentionally consumed by the editor instance, because the parent is
   * mounted through Suspense and cannot focus it reliably on the next tick. */
  initialFocus?: boolean
  /** Called once the initial scroll position has been consumed. The parent is
   * mounted through Suspense, so it cannot know when that happened and must not
   * clear the pending position on the next tick. */
  onInitialPositionApplied?: () => void
  initialFormat?: FormatCommand | null
  onInitialFormatApplied?: () => void
  /** Center the restored selection once the editor mounts (Jump to Selection
   * from the preview, where the editor arrives through Suspense). */
  initialRevealSelection?: boolean
  onInitialSelectionRevealed?: () => void
  onChange: (value: string) => void
  /** Returns Markdown to insert after a clipboard image has been saved safely. */
  onPasteImage?: (file: File) => Promise<string | null>
  baseDirectory?: string | null
  workspacePath?: string | null
  onRenameImage?: (path: string) => void
  onCursorChange: (line: number, column: number) => void
  onStateChange?: (state: EditorSessionState) => void
  /** Reports the selection's formatting state so the floating format controls
   * can show the live heading label and emphasis tints. */
  onFormattingChange?: (state: FormattingState) => void
  /** Reports the selection's word/character/line counts (null when the caret
   * has no range) so the inspector can show selection-aware totals. */
  onSelectionStatsChange?: (stats: DocumentStats | null) => void
  /** Find-bar state. The preview pane highlights matches in rendered text;
   * the editor highlights the same matches in source text so the match
   * counter, the cycle order and “replace” stay in step while editing. */
  searchQuery?: string
  searchIndex?: number
  matchCase?: boolean
  searchMode?: SearchMode
  onSearchCount?: (count: number) => void
}

function editorOverlayHeight(view: EditorView): number {
  return parseFloat(getComputedStyle(view.dom).getPropertyValue('--document-tools-height')) || 0
}

function editorTopLine(view: EditorView): number {
  const top = view.scrollDOM.getBoundingClientRect().top + editorOverlayHeight(view)
  const block = view.lineBlockAtHeight(Math.max(0, top - view.documentTop))
  return view.state.doc.lineAt(block.from).number
}

function getEditorState(view: EditorView): EditorSessionState {
  const position = (offset: number) => {
    const line = view.state.doc.lineAt(offset)
    return { line: line.number, column: offset - line.from + 1 }
  }
  const dom = view.scrollDOM
  return {
    selection: {
      anchor: position(view.state.selection.main.anchor),
      head: position(view.state.selection.main.head),
    },
    topLine: editorTopLine(view),
    scrollFraction: dom.scrollHeight <= dom.clientHeight ? 0 : clampScrollFraction(dom.scrollTop / (dom.scrollHeight - dom.clientHeight)),
  }
}

/** Words/characters/lines of the current selection, or null when the caret
 * has no range. Drives the inspector's "- Selected" count rows. */
function getSelectionStats(view: EditorView): DocumentStats | null {
  const selection = view.state.selection.main
  if (selection.empty) return null
  const selected = view.state.sliceDoc(selection.from, selection.to)
  return {
    words: selected.trim().split(/\s+/u).filter(Boolean).length,
    characters: selected.length,
    lines: selected.split(/\r?\n/).length,
    headings: 0,
    links: 0,
    images: 0,
  }
}

function applyFormat(view: EditorView, command: FormatCommand) {
  const heading = /^h([0-6])$/.exec(command)
  if (heading) {
    setHeading(view, Number(heading[1]))
    return
  }
  switch (command) {
    case 'bold':
      toggleInlineMark(view, '**')
      return
    case 'italic':
      toggleInlineMark(view, '*')
      return
    case 'strikethrough':
      toggleInlineMark(view, '~~')
      return
    case 'code':
      toggleInlineMark(view, '`')
      return
    case 'link':
      insertLinkPlaceholder(view)
      return
    case 'quote':
      toggleBlockPrefix(view, '> ', /^>\s?/)
      return
    case 'bulletList':
      toggleBlockPrefix(view, '- ', /^\s*[-*+]\s/)
      return
    case 'orderedList':
      toggleOrderedList(view)
      return
    case 'taskList':
      toggleBlockPrefix(view, '- [ ] ', /^\s*[-+*]\s+\[[ xX]\]\s/)
  }
}

export const EditorPane = forwardRef<EditorPaneHandle, EditorPaneProps>(function EditorPane(props, forwardedRef) {
  const viewRef = useRef<EditorView | null>(null)
  const pasteImageRef = useRef(props.onPasteImage)
  pasteImageRef.current = props.onPasteImage
  const imageContextRef = useRef({
    baseDirectory: props.baseDirectory,
    workspacePath: props.workspacePath,
    onRenameImage: props.onRenameImage,
  })
  imageContextRef.current = {
    baseDirectory: props.baseDirectory,
    workspacePath: props.workspacePath,
    onRenameImage: props.onRenameImage,
  }
  const [ready, setReady] = useState(false)
  // Same unstable-callback hazard as the preview: the parent re-creates these on
  // every render, and putting them in the dependency list made the effect re-run
  // (and re-apply the position) whenever the parent happened to render.
  const onInitialPositionAppliedRef = useRef(props.onInitialPositionApplied)
  onInitialPositionAppliedRef.current = props.onInitialPositionApplied
  const initialFocusRef = useRef(props.initialFocus)
  initialFocusRef.current = props.initialFocus
  const initialCursorRef = useRef(props.initialCursor)
  initialCursorRef.current = props.initialCursor
  const initialSelectionRef = useRef(props.initialSelection)
  initialSelectionRef.current = props.initialSelection
  const onStateChangeRef = useRef(props.onStateChange)
  onStateChangeRef.current = props.onStateChange
  const onSelectionStatsChangeRef = useRef(props.onSelectionStatsChange)
  onSelectionStatsChangeRef.current = props.onSelectionStatsChange
  const onFormattingChangeRef = useRef(props.onFormattingChange)
  onFormattingChangeRef.current = props.onFormattingChange
  // The parent callback is recreated on every render. Keeping it in the
  // dependency list would re-apply a pending format command on unrelated
  // renders before the parent has cleared it.
  const onInitialFormatAppliedRef = useRef(props.onInitialFormatApplied)
  onInitialFormatAppliedRef.current = props.onInitialFormatApplied
  const onInitialSelectionRevealedRef = useRef(props.onInitialSelectionRevealed)
  onInitialSelectionRevealedRef.current = props.onInitialSelectionRevealed
  const [activeFence, setActiveFence] = useState<EditableCodeFence | null>(null)
  const imagePasteExtension = useMemo(
    () =>
      EditorView.domEventHandlers({
        paste(event, view) {
          const clipboard = event.clipboardData
          const fileFromList = Array.from(clipboard?.files ?? []).find((file) => file.type.startsWith('image/'))
          const fileFromItem = Array.from(clipboard?.items ?? [])
            .find((item) => item.kind === 'file' && item.type.startsWith('image/'))
            ?.getAsFile()
          const image = fileFromList ?? fileFromItem
          const saveImage = pasteImageRef.current
          if (!image || !saveImage) return false
          event.preventDefault()
          const selection = view.state.selection.main
          void saveImage(image).then((markdown) => {
            if (!markdown) return
            view.dispatch({
              changes: { from: selection.from, to: selection.to, insert: markdown },
              selection: { anchor: selection.from + markdown.length },
            })
            view.focus()
          })
          return true
        },
      }),
    [],
  )
  const codeFenceInputExtension = useMemo(
    () =>
      EditorView.inputHandler.of((view, from, to, text) => {
        if (from !== to) return false
        const line = view.state.doc.lineAt(from)
        const insertion = codeFenceAutoCloseInsertion(view.state.sliceDoc(line.from, from), view.state.sliceDoc(to, line.to), text)
        if (!insertion) return false
        view.dispatch({
          changes: { from, to, insert: insertion.insert },
          selection: { anchor: from + insertion.cursorOffset },
          userEvent: 'input.type',
        })
        return true
      }),
    [],
  )
  const imagePreviewExtension = useMemo(
    () =>
      createEditorMarkdownDecorations({
        resolveImage: (path) => {
          const context = imageContextRef.current
          if (!context.baseDirectory) return Promise.resolve(null)
          return loadLocalAsset(context.baseDirectory, path, context.workspacePath).catch(() => null)
        },
        onRenameImage: (path) => imageContextRef.current.onRenameImage?.(path),
      }),
    [],
  )
  const indentFenceBody = (view: EditorView, direction: 'more' | 'less') => {
    const line = view.state.doc.lineAt(view.state.selection.main.head)
    const fence = editableCodeFenceAtLine(view.state.doc, line.number)
    if (!isCodeFenceBodyLine(fence, line.number)) return false
    return direction === 'more' ? indentMore(view) : indentLess(view)
  }

  useImperativeHandle(
    forwardedRef,
    () => ({
      focus: () => viewRef.current?.focus(),
      find: (query, matchCase, backwards = false) => {
        const view = viewRef.current
        if (!view || !query) return false
        const source = view.state.doc.toString()
        const haystack = matchCase ? source : source.toLocaleLowerCase()
        const needle = matchCase ? query : query.toLocaleLowerCase()
        const selection = view.state.selection.main
        const start = backwards ? Math.max(0, selection.from - 1) : selection.to
        const index = backwards ? haystack.lastIndexOf(needle, start) : haystack.indexOf(needle, start)
        const target = index >= 0 ? index : backwards ? haystack.lastIndexOf(needle) : haystack.indexOf(needle)
        if (target < 0) return false
        view.dispatch({ selection: { anchor: target, head: target + query.length }, scrollIntoView: true })
        view.focus()
        return true
      },
      replace: (query, replacement, options) => {
        const view = viewRef.current
        if (!view || !query) return 0
        const source = view.state.doc.toString()
        const mode = options.mode ?? 'contains'
        if (options.all) {
          const outcome = replaceAllMatches(source, query, replacement, options.matchCase, mode)
          if (!outcome.count) return 0
          view.dispatch({
            changes: { from: 0, to: source.length, insert: outcome.contents },
            selection: { anchor: outcome.contents.length },
          })
          return outcome.count
        }
        const selection = view.state.selection.main
        const selected = view.state.sliceDoc(selection.from, selection.to)
        // “替换” acts on the current match when the caret already sits on one.
        // Otherwise it takes the next match after the caret and wraps to the
        // top of the document, so a query typed into the find bar is always
        // replaceable instead of silently doing nothing.
        const anchor = selectionMatches(selected, query, options.matchCase) ? selection.from : selection.to
        const matches = orderedMatchesFrom(searchMatchOffsets(source, query, options.matchCase, mode), anchor)
        const target = matches[0]
        if (!target) return 0
        view.dispatch({
          changes: { from: target.index, to: target.index + target.length, insert: replacement },
          selection: { anchor: target.index + replacement.length },
        })
        return 1
      },
      getTopLine: () => {
        const view = viewRef.current
        if (!view) return null
        return editorTopLine(view)
      },
      revealLine: (line) => {
        const view = viewRef.current
        if (!view || line < 1) return
        const target = Math.min(Math.max(1, Math.round(line)), view.state.doc.lines)
        const position = view.state.doc.line(target).from
        view.dispatch({ selection: { anchor: position }, effects: EditorView.scrollIntoView(position, { y: 'start' }) })
        view.focus()
      },
      getSelectionText: () => {
        const view = viewRef.current
        if (!view) return ''
        const selection = view.state.selection.main
        return view.state.sliceDoc(selection.from, selection.to)
      },
      revealSelection: () => {
        const view = viewRef.current
        if (!view) return
        const head = view.state.selection.main.head
        view.dispatch({ effects: EditorView.scrollIntoView(head, { y: 'center' }) })
        view.focus()
      },
      format: (command) => {
        if (viewRef.current) applyFormat(viewRef.current, command)
      },
      getFormattingState: () => (viewRef.current ? selectionContext(viewRef.current.state) : null),
      getBlockStyle: () => (viewRef.current ? blockStyle(viewRef.current.state) : null),
      getListStyle: () => (viewRef.current ? listStyle(viewRef.current.state) : null),
      getLinkSelection: () => (viewRef.current ? linkSelection(viewRef.current.state, true) : null),
      insertLink: (text, url, from, to) => (viewRef.current ? insertLinkFromPopover(viewRef.current, text, url, from, to) : false),
      setBlockStyle: (style, language = '') => (viewRef.current ? applyBlockStyle(viewRef.current, style, language) : false),
      setListStyle: (style) => (viewRef.current ? applyListStyle(viewRef.current, style) : false),
      getScrollFraction: () => {
        const dom = viewRef.current?.scrollDOM
        if (!dom || dom.scrollHeight <= dom.clientHeight) return 0
        return clampScrollFraction(dom.scrollTop / (dom.scrollHeight - dom.clientHeight))
      },
      getState: () => (viewRef.current ? getEditorState(viewRef.current) : null),
    }),
    [],
  )

  useEffect(() => {
    if (!ready || !viewRef.current) return
    const view = viewRef.current
    if (props.initialLine == null && props.initialScrollFraction == null) {
      if (initialFocusRef.current) view.focus()
      return
    }
    let frame = 0
    // Match the upstream contract: apply the source anchor first, then focus
    // the editor only after CodeMirror has measured its scrollable viewport.
    // Focusing in the parent on the next tick races Suspense and can select the
    // toolbar/search field instead of the editor on first entry.
    frame = requestAnimationFrame(() => {
      if (props.initialLine != null) {
        // A source line survives the layout difference between the preview and the
        // editor; a scroll fraction does not, so the line wins when both arrive.
        const target = Math.min(Math.max(1, Math.round(props.initialLine)), view.state.doc.lines)
        const lineStart = view.state.doc.line(target).from
        // Move the caret with the viewport: the editor is remounted on every mode
        // switch, and leaving the selection at the document start put the caret
        // thousands of pixels above the line the reader had just come back to.
        // When the round trip ended where it started, put it back exactly.
        const initialSelection = initialSelectionRef.current
        const restoredAnchor = caretToOffset(
          initialSelection?.anchor ?? initialCursorRef.current ?? null,
          (line) => view.state.doc.line(line).from,
          (line) => view.state.doc.line(line).to,
          view.state.doc.lines,
        )
        const restoredHead = caretToOffset(
          initialSelection?.head ?? initialCursorRef.current ?? null,
          (line) => view.state.doc.line(line).from,
          (line) => view.state.doc.line(line).to,
          view.state.doc.lines,
        )
        view.dispatch({
          selection: { anchor: restoredAnchor ?? lineStart, head: restoredHead ?? restoredAnchor ?? lineStart },
          effects: EditorView.scrollIntoView(lineStart, { y: 'start' }),
        })
      } else {
        const fraction = clampScrollFraction(props.initialScrollFraction ?? 0)
        const dom = view.scrollDOM
        dom.scrollTop = fraction * Math.max(0, dom.scrollHeight - dom.clientHeight)
      }
      if (initialFocusRef.current) view.focus()
      onInitialPositionAppliedRef.current?.()
    })
    return () => cancelAnimationFrame(frame)
  }, [ready, props.initialLine, props.initialScrollFraction])

  useEffect(() => {
    if (!ready) return
    props.onSearchCount?.(searchMatchOffsets(props.value, props.searchQuery ?? '', props.matchCase ?? false, props.searchMode).length)
  }, [ready, props.value, props.searchQuery, props.matchCase, props.searchMode, props.onSearchCount])

  const searchIndex = props.searchIndex ?? 0
  useEffect(() => {
    if (!ready || !props.searchQuery || !viewRef.current) return
    const view = viewRef.current
    const matches = searchMatchOffsets(view.state.doc.toString(), props.searchQuery, props.matchCase ?? false, props.searchMode)
    if (!matches.length) return
    const target = matches[((searchIndex % matches.length) + matches.length) % matches.length]
    // Selection only — stealing focus here would pull the caret out of the
    // find bar while the user is still typing the query.
    view.dispatch({
      selection: { anchor: target.index, head: target.index + target.length },
      effects: EditorView.scrollIntoView(target.index, { y: 'center' }),
    })
  }, [ready, searchIndex, props.searchQuery, props.matchCase, props.searchMode])

  useEffect(() => {
    if (ready && props.initialFormat && viewRef.current) {
      applyFormat(viewRef.current, props.initialFormat)
      onInitialFormatAppliedRef.current?.()
    }
  }, [ready, props.initialFormat])

  useEffect(() => {
    if (!ready || !props.initialRevealSelection) return
    // Queue after the initial-position effect's frame so the restored selection
    // is in place before we center it (Jump to Selection from the preview).
    const frame = requestAnimationFrame(() => {
      const view = viewRef.current
      if (view) {
        const head = view.state.selection.main.head
        view.dispatch({ effects: EditorView.scrollIntoView(head, { y: 'center' }) })
        view.focus()
      }
      onInitialSelectionRevealedRef.current?.()
    })
    return () => cancelAnimationFrame(frame)
  }, [ready, props.initialRevealSelection])

  return (
    <section className={`editor-pane content-${props.contentWidth}`} aria-label="Markdown editor">
      <div className="editor-page">
        {activeFence ? (
          <label className="code-fence-language-control">
            <span>Code language</span>
            <input
              aria-label="Code fence language"
              value={activeFence.language}
              placeholder="auto"
              onChange={(event) => {
                const view = viewRef.current
                if (!view) return
                const fence = editableCodeFenceAtLine(view.state.doc, activeFence.lineNumber)
                if (!fence) return
                view.dispatch({ changes: rewriteCodeFenceLanguage(fence, event.target.value) })
              }}
            />
          </label>
        ) : null}
        <CodeMirror
          value={props.value}
          height="100%"
          theme={props.theme === 'dark' ? oneDark : 'light'}
          extensions={[
            markdown({ codeLanguages: languages }),
            editorHeadings,
            imagePreviewExtension,
            imagePasteExtension,
            codeFenceInputExtension,
            EditorView.lineWrapping,
            EditorView.scrollMargins.of((view) => ({ top: editorOverlayHeight(view) })),
            EditorView.contentAttributes.of({ spellcheck: 'true', autocapitalize: 'sentences' }),
            keymap.of([
              { key: 'Tab', run: (view) => indentFenceBody(view, 'more') },
              { key: 'Shift-Tab', run: (view) => indentFenceBody(view, 'less') },
            ]),
          ]}
          onCreateEditor={(view) => {
            viewRef.current = view
            if (import.meta.env.DEV) (window as Window & { __TEXTMARK_EDITOR_VIEW__?: EditorView }).__TEXTMARK_EDITOR_VIEW__ = view
            const head = view.state.selection.main.head
            const line = view.state.doc.lineAt(head)
            setActiveFence(editableCodeFenceAtLine(view.state.doc, line.number))
            props.onCursorChange(line.number, head - line.from + 1)
            onStateChangeRef.current?.(getEditorState(view))
            onSelectionStatsChangeRef.current?.(getSelectionStats(view))
            onFormattingChangeRef.current?.(selectionContext(view.state))
            setReady(true)
          }}
          onChange={props.onChange}
          onUpdate={(update) => {
            if (!update.selectionSet && !update.docChanged) return
            const head = update.state.selection.main.head
            const line = update.state.doc.lineAt(head)
            setActiveFence(editableCodeFenceAtLine(update.state.doc, line.number))
            props.onCursorChange(line.number, head - line.from + 1)
            onStateChangeRef.current?.(getEditorState(update.view))
            onSelectionStatsChangeRef.current?.(getSelectionStats(update.view))
            onFormattingChangeRef.current?.(selectionContext(update.state))
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
