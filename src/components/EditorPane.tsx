import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
// The reference's dark editor is the same neutral surface as its reading view:
// headings stay the body colour and only fenced code takes the shared --hl-*
// palette. One Dark's *theme* supplies the dark UI chrome, but its highlight
// style would tint markdown headings coral (#e06c75), so only the theme half is
// used here and codeHighlight below owns every syntax colour.
import { oneDarkTheme } from '@codemirror/theme-one-dark'
import { tags } from '@lezer/highlight'
import { EditorView } from '@codemirror/view'
import { Check, Copy, WrapText } from 'lucide-react'
import { indentLess, indentMore, redo, undo } from '@codemirror/commands'
import { keymap } from '@codemirror/view'
import { editorHeadings } from '../lib/editorHeadings'
import { createEditorMarkdownDecorations } from '../lib/editorMarkdownDecorations'
import { markdownTableNavigationPlan } from '../lib/editorTableNavigation'
import { taskListEnterPlan } from '../lib/editorTaskList'
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
import { openTableWindow } from '../lib/tableWindow'
import { orderedMatchesFrom, replaceAllMatches, searchMatchOffsets, selectionMatches } from '../lib/search'
import { t } from '../lib/i18n'
import type {
  ContentWidth,
  DocumentFont,
  EditorFormattingState,
  EditorSessionState,
  FormatCommand,
  Locale,
  SearchMode,
  ThemeColors,
  ThemePreset,
} from '../types'
import { editorFormattingStateFromSource } from '../lib/editorFormattingState'

export interface EditorPaneHandle {
  focus: () => void
  find: (query: string, matchCase: boolean, backwards?: boolean) => boolean
  replace: (query: string, replacement: string, options: ReplaceOptions) => number
  /** Scrolls to a source line without moving the editor caret. */
  scrollToLine: (line: number) => void
  /** Source line currently at the top of the editor viewport. */
  getTopLine: () => number | null
  /** Pixel gap from that source line to the editor's visible viewport top. */
  getTopGap: () => number | null
  format: (command: FormatCommand) => void
  undo: () => boolean
  redo: () => boolean
  scrollBy: (pixels: number) => void
  scrollToEdge: (end: boolean) => void
  insertLink: (label: string, destination: string) => void
  /** Inserts plain text at the caret, replacing the selection. */
  insertText: (text: string) => void
  /** Deletes the selection, as Edit ▸ Delete does. */
  deleteSelection: () => void
  selectionText: () => string
  /** Applies AppKit's text-case commands to the selection. */
  transformSelection: (kind: 'upper' | 'lower' | 'capitalize') => void
  scrollToSelection: () => void
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

/**
 * Code token palette, mirroring the reading view's `--hl-*` tokens (see
 * `code-theme.css`). Upstream (Markdown Preview 0.0.71) shares one palette
 * between preview and editor, so a fenced block keeps the same colors in both.
 * Untagged identifiers keep the surrounding text color, as in the preview.
 */
const codeHighlight = HighlightStyle.define([
  {
    tag: [
      tags.keyword,
      tags.modifier,
      tags.controlKeyword,
      tags.operatorKeyword,
      tags.definitionKeyword,
      tags.moduleKeyword,
      tags.self,
      tags.literal,
      tags.bool,
      tags.null,
      tags.atom,
      // highlight.js files markup tag names under `.hljs-name`, which its
      // theme colors like a keyword.
      tags.tagName,
    ],
    color: 'var(--hl-keyword)',
  },
  { tag: [tags.typeName, tags.namespace], color: 'var(--hl-type)' },
  { tag: [tags.className, tags.definition(tags.className)], color: 'var(--hl-declaration)' },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.definition(tags.function(tags.variableName))],
    color: 'var(--hl-function)',
  },
  { tag: [tags.number, tags.integer, tags.float, tags.character], color: 'var(--hl-number)' },
  {
    tag: [tags.string, tags.special(tags.string), tags.regexp, tags.docString, tags.attributeValue],
    color: 'var(--hl-string)',
  },
  { tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment], color: 'var(--hl-comment)' },
  { tag: tags.attributeName, color: 'var(--hl-attribute)' },
  { tag: [tags.meta, tags.macroName, tags.processingInstruction], color: 'var(--hl-preprocessor)' },
  { tag: [tags.link, tags.url], color: 'var(--hl-url)' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: '600' },
])

interface EditorPaneProps {
  active?: boolean
  value: string
  locale: Locale
  theme: 'dark' | 'light'
  fontSize: number
  zoom: number
  contentWidth: ContentWidth
  documentFont?: DocumentFont
  themePreset?: ThemePreset
  themeColors?: ThemeColors
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
  onChange: (value: string) => void
  /** Returns Markdown to insert after a clipboard image has been saved safely. */
  onPasteImage?: (file: File) => Promise<string | null>
  baseDirectory?: string | null
  workspacePath?: string | null
  onRenameImage?: (path: string) => void
  onCursorChange: (line: number, column: number) => void
  onFormattingStateChange?: (state: EditorFormattingState) => void
  onStateChange?: (state: EditorSessionState) => void
  /** Find-bar state. The preview pane highlights matches in rendered text;
   * the editor highlights the same matches in source text so the match
   * counter, the cycle order and “replace” stay in step while editing. */
  searchQuery?: string
  searchIndex?: number
  matchCase?: boolean
  searchMode?: SearchMode
  onSearchCount?: (count: number) => void
}

const wrappers: Partial<Record<FormatCommand, [string, string]>> = {
  bold: ['**', '**'],
  italic: ['*', '*'],
  strikethrough: ['~~', '~~'],
  code: ['`', '`'],
  link: ['[', '](https://)'],
  highlight: ['==', '=='],
}

function editorFormattingState(view: EditorView): EditorFormattingState {
  const selection = view.state.selection.main
  const line = view.state.doc.lineAt(selection.head)
  return editorFormattingStateFromSource(view.state.doc.toString(), selection.from, selection.to, line.text)
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
  if (command === 'codeBlock') {
    const source = view.state.sliceDoc(from, to).replace(/^```\w*\n?|\n?```$/g, '')
    const wrapped = `\`\`\`\n${source || 'code'}\n\`\`\``
    view.dispatch({ changes: { from, to, insert: wrapped }, selection: { anchor: from + wrapped.length } })
    view.focus()
    return
  }
  if (command === 'horizontalRule') {
    const separator = `${view.state.sliceDoc(from, to)}\n---`
    view.dispatch({ changes: { from, to, insert: separator }, selection: { anchor: from + separator.length } })
    view.focus()
    return
  }
  const heading = command.match(/^h([0-6])$/)?.[1]
  const nonEmptyLines = lines.filter((line) => line.trim())
  const allHave = (pattern: RegExp) => nonEmptyLines.length > 0 && nonEmptyLines.every((line) => pattern.test(line))
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
        return !line.trim() || removing || heading === '0'
          ? line.replace(/^#{1,6}\s+/, '')
          : `${'#'.repeat(Number(heading))} ${line.replace(/^#{1,6}\s+/, '')}`
      if (command === 'bulletList') return !line.trim() ? line : removing ? line.replace(/^\s*[-+*]\s+/, '') : `- ${stripListMarker(line)}`
      if (command === 'orderedList')
        return !line.trim() ? line : removing ? line.replace(/^\s*\d+[.)]\s+/, '') : `${++index}. ${stripListMarker(line)}`
      if (command === 'taskList') return !line.trim() ? line : removing ? stripTaskMarker(line) : `- [ ] ${stripTaskMarker(line)}`
      if (command === 'quote') return removing ? line.replace(/^>\s?/, '') : `> ${line.replace(/^>\s?/, '')}`
      return line
    })
    .join('\n')
  view.dispatch({ changes: { from, to, insert: transformed }, selection: { anchor: from, head: from + transformed.length } })
  view.focus()
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
  const onFormattingStateChangeRef = useRef(props.onFormattingStateChange)
  onFormattingStateChangeRef.current = props.onFormattingStateChange
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
  // The parent callback is recreated on every render. Keeping it in the
  // dependency list would re-apply a pending format command on unrelated
  // renders before the parent has cleared it.
  const onInitialFormatAppliedRef = useRef(props.onInitialFormatApplied)
  onInitialFormatAppliedRef.current = props.onInitialFormatApplied
  const [activeFence, setActiveFence] = useState<EditableCodeFence | null>(null)
  const [unwrappedFences, setUnwrappedFences] = useState<Set<number>>(() => new Set())
  const [copiedCode, setCopiedCode] = useState(false)
  const syncCodeWrap = (view: EditorView, unwrapped: Set<number>) => {
    view.dom.querySelectorAll<HTMLElement>('.cm-md-code-line').forEach((line) => {
      const fenceFrom = Number(line.dataset.codeFenceFrom)
      line.classList.toggle('cm-md-code-nowrap', unwrapped.has(fenceFrom))
    })
    view.dom.querySelectorAll<HTMLElement>('.cm-md-code-card').forEach((card) => {
      const codeLine = card.querySelector<HTMLElement>('.cm-md-code-line')
      const fenceFrom = Number(codeLine?.dataset.codeFenceFrom)
      const wrapped = !unwrapped.has(fenceFrom)
      card.classList.toggle('cm-md-code-card-wrapped', wrapped)
      card.querySelector<HTMLButtonElement>('.cm-md-code-action[data-code-action="wrap"]')?.setAttribute('aria-pressed', String(wrapped))
    })
  }
  const activeFenceUnwrapped = Boolean(activeFence && unwrappedFences.has(activeFence.from))
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
  // The decoration extension is created once, so its card-header controls read
  // their labels through this ref instead of freezing the locale of the first
  // render.
  const codeCardLabelsRef = useRef<() => { wrap: string; unwrap: string; copy: string; copied: string }>(() => ({
    wrap: 'Wrap code',
    unwrap: 'Unwrap code',
    copy: 'Copy code',
    copied: 'Copied',
  }))
  codeCardLabelsRef.current = () => ({
    wrap: t(props.locale, 'wrapCode'),
    unwrap: t(props.locale, 'unwrapCode'),
    copy: t(props.locale, 'copyCode'),
    copied: t(props.locale, 'copied'),
  })
  // Same pattern for the table widget: its expand title follows the locale and
  // its window inherits the document appearance without rebuilding the editor.
  const tableLabelsRef = useRef<() => string>(() => 'Expand table')
  tableLabelsRef.current = () => t(props.locale, 'expandTable')
  const tableAppearanceRef = useRef({
    documentFont: props.documentFont,
    themePreset: props.themePreset,
    themeColors: props.themeColors,
  })
  tableAppearanceRef.current = {
    documentFont: props.documentFont,
    themePreset: props.themePreset,
    themeColors: props.themeColors,
  }
  const openTableRef = useRef<(table: HTMLTableElement) => void>(() => {})
  openTableRef.current = (table) => openTableWindow(table, props.locale, undefined, tableAppearanceRef.current)
  const imagePreviewExtension = useMemo(
    () =>
      createEditorMarkdownDecorations({
        resolveImage: (path) => {
          const context = imageContextRef.current
          if (!context.baseDirectory) return Promise.resolve(null)
          return loadLocalAsset(context.baseDirectory, path, context.workspacePath).catch(() => null)
        },
        onRenameImage: (path) => imageContextRef.current.onRenameImage?.(path),
        onToggleCodeWrap: (fenceFrom) =>
          setUnwrappedFences((current) => {
            const next = new Set(current)
            if (next.has(fenceFrom)) next.delete(fenceFrom)
            else next.add(fenceFrom)
            return next
          }),
        codeCardLabels: () => codeCardLabelsRef.current(),
        expandTableLabel: () => tableLabelsRef.current(),
        onExpandTable: (table) => openTableRef.current(table),
      }),
    [],
  )
  const indentFenceBody = (view: EditorView, direction: 'more' | 'less') => {
    const line = view.state.doc.lineAt(view.state.selection.main.head)
    const fence = editableCodeFenceAtLine(view.state.doc, line.number)
    if (!isCodeFenceBodyLine(fence, line.number)) return false
    return direction === 'more' ? indentMore(view) : indentLess(view)
  }
  const navigateTableCell = (view: EditorView, direction: 'next' | 'previous') => {
    const selection = view.state.selection.main
    const plan = markdownTableNavigationPlan(view.state.doc.toString(), selection.head, direction)
    if (!plan.handled) return false
    if (plan.change) {
      view.dispatch({
        changes: plan.change,
        selection: { anchor: plan.selection ?? plan.change.from + plan.change.insert.length },
        userEvent: 'input',
        scrollIntoView: true,
      })
    } else if (plan.selection !== undefined) {
      view.dispatch({ selection: { anchor: plan.selection }, scrollIntoView: true })
    }
    return true
  }
  const continueTaskList = (view: EditorView) => {
    const selection = view.state.selection.main
    const plan = taskListEnterPlan(view.state.doc.toString(), selection.head, selection.empty)
    if (!plan.handled) return false
    if (plan.change) {
      view.dispatch({
        changes: plan.change,
        selection: { anchor: plan.selection ?? plan.change.from + plan.change.insert.length },
        userEvent: 'input',
        scrollIntoView: true,
      })
    }
    return true
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
      getTopGap: () => {
        const view = viewRef.current
        if (!view) return null
        const line = view.state.doc.line(editorTopLine(view))
        const lineRect = view.coordsAtPos(line.from)
        if (!lineRect) return null
        const scroller = view.scrollDOM
        const visibleTop = scroller.getBoundingClientRect().top + scroller.clientTop + editorOverlayHeight(view)
        return lineRect.top - visibleTop
      },
      scrollToLine: (line) => {
        const view = viewRef.current
        if (!view || line < 1) return
        const target = Math.min(Math.max(1, Math.round(line)), view.state.doc.lines)
        const position = view.state.doc.line(target).from
        view.dispatch({ effects: EditorView.scrollIntoView(position, { y: 'start' }) })
        // WebKit can accept the selection transaction without applying the
        // CodeMirror scroll effect when the target line is outside its current
        // virtualized viewport. `coordsAtPos` returns null for such off-screen
        // positions, so reconcile against CodeMirror's document-relative line
        // block geometry after the new viewport has been laid out.
        requestAnimationFrame(() => {
          if (viewRef.current !== view) return
          const block = view.lineBlockAt(position)
          const scroller = view.scrollDOM
          const visibleTop = scroller.getBoundingClientRect().top + scroller.clientTop + editorOverlayHeight(view) + 12
          const delta = view.documentTop + block.top - visibleTop
          if (Math.abs(delta) > 1) scroller.scrollTo({ top: scroller.scrollTop + delta, behavior: 'auto' })
        })
      },
      format: (command) => {
        if (viewRef.current) applyFormat(viewRef.current, command)
      },
      undo: () => (viewRef.current ? undo(viewRef.current) : false),
      redo: () => (viewRef.current ? redo(viewRef.current) : false),
      scrollBy: (pixels) => viewRef.current?.scrollDOM.scrollBy({ top: pixels, behavior: 'smooth' }),
      scrollToEdge: (end) => {
        const dom = viewRef.current?.scrollDOM
        if (dom) dom.scrollTo({ top: end ? dom.scrollHeight : 0, behavior: 'smooth' })
      },
      insertLink: (label, destination) => {
        const view = viewRef.current
        if (!view) return
        const selection = view.state.selection.main
        const selected = view.state.sliceDoc(selection.from, selection.to)
        const text = selected || label || 'link'
        const safeText = text.replace(/\\/g, '\\\\').replace(/([\[\]])/g, '\\$1')
        const trimmedDestination = destination.trim()
        const scheme = trimmedDestination.match(/^([a-z][a-z\d+.-]*):/i)?.[1]?.toLowerCase()
        if (scheme && !['http', 'https', 'mailto', 'tel'].includes(scheme)) return
        const safeDestination = trimmedDestination.replace(/[<>\s()]/g, (character) => encodeURIComponent(character))
        const markdown = `[${safeText}](${safeDestination})`
        view.dispatch({
          changes: { from: selection.from, to: selection.to, insert: markdown },
          selection: { anchor: selection.from + markdown.length },
        })
        view.focus()
      },
      insertText: (text) => {
        const view = viewRef.current
        if (!view || !text) return
        const selection = view.state.selection.main
        view.dispatch({
          changes: { from: selection.from, to: selection.to, insert: text },
          selection: { anchor: selection.from + text.length },
          scrollIntoView: true,
        })
        view.focus()
      },
      deleteSelection: () => {
        const view = viewRef.current
        if (!view) return
        const selection = view.state.selection.main
        if (selection.empty) return
        view.dispatch({
          changes: { from: selection.from, to: selection.to, insert: '' },
          selection: { anchor: selection.from },
        })
        view.focus()
      },
      selectionText: () => {
        const view = viewRef.current
        if (!view) return ''
        const selection = view.state.selection.main
        return view.state.sliceDoc(selection.from, selection.to)
      },
      transformSelection: (kind) => {
        const view = viewRef.current
        if (!view) return
        const selection = view.state.selection.main
        const selected = view.state.sliceDoc(selection.from, selection.to)
        if (!selected) return
        const text =
          kind === 'upper'
            ? selected.toLocaleUpperCase()
            : kind === 'lower'
              ? selected.toLocaleLowerCase()
              : selected.replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase())
        if (text === selected) return
        view.dispatch({
          changes: { from: selection.from, to: selection.to, insert: text },
          selection: { anchor: selection.from, head: selection.from + text.length },
        })
        view.focus()
      },
      scrollToSelection: () => {
        const view = viewRef.current
        if (!view) return
        view.dispatch({ effects: EditorView.scrollIntoView(view.state.selection.main.head, { y: 'center' }) })
      },
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
    if (props.active === false || !ready || !viewRef.current) return
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
        // The document's first line is the one anchor that must not be aligned
        // to the viewport's top edge: CodeMirror measures that alignment against
        // the canvas inset, which is still the 54pt fallback on this frame
        // (`--document-tools-height` arrives a frame later), so `start` parked
        // the canvas 51px down and the whole document sat too high once the
        // inset settled. Scroll zero is the same reading position the preview's
        // own anchor maps to, and it survives the inset change.
        const anchorAtDocumentStart = target === 1
        view.dispatch({
          selection: { anchor: restoredAnchor ?? lineStart, head: restoredHead ?? restoredAnchor ?? lineStart },
          effects: anchorAtDocumentStart ? [] : EditorView.scrollIntoView(lineStart, { y: 'start' }),
        })
        if (anchorAtDocumentStart) view.scrollDOM.scrollTop = 0
      } else {
        const fraction = clampScrollFraction(props.initialScrollFraction ?? 0)
        const dom = view.scrollDOM
        dom.scrollTop = fraction * Math.max(0, dom.scrollHeight - dom.clientHeight)
      }
      if (initialFocusRef.current) view.focus()
      onInitialPositionAppliedRef.current?.()
    })
    return () => cancelAnimationFrame(frame)
  }, [props.active, ready, props.initialLine, props.initialScrollFraction])

  useEffect(() => {
    if (!ready) return
    props.onSearchCount?.(searchMatchOffsets(props.value, props.searchQuery ?? '', props.matchCase ?? false, props.searchMode).length)
  }, [ready, props.value, props.searchQuery, props.matchCase, props.searchMode, props.onSearchCount])

  useEffect(() => {
    if (ready && viewRef.current) syncCodeWrap(viewRef.current, unwrappedFences)
  }, [ready, unwrappedFences])

  const searchIndex = props.searchIndex ?? 0
  useEffect(() => {
    if (props.active === false || !ready || !props.searchQuery || !viewRef.current) return
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
  }, [props.active, ready, searchIndex, props.searchQuery, props.matchCase, props.searchMode])

  useEffect(() => {
    if (ready && props.initialFormat && viewRef.current) {
      applyFormat(viewRef.current, props.initialFormat)
      onInitialFormatAppliedRef.current?.()
    }
  }, [ready, props.initialFormat])

  return (
    <section
      className={`editor-pane content-${props.contentWidth} pane-${props.active === false ? 'inactive' : 'active'}`}
      aria-label="Markdown editor"
      aria-hidden={props.active === false}
      inert={props.active === false}
    >
      <div className="editor-page">
        {activeFence ? (
          <div className="code-fence-toolbar" role="toolbar" aria-label="Code block controls">
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
            <button
              type="button"
              className="md-code-action"
              aria-label={activeFenceUnwrapped ? t(props.locale, 'wrapCode') : t(props.locale, 'unwrapCode')}
              title={activeFenceUnwrapped ? t(props.locale, 'wrapCode') : t(props.locale, 'unwrapCode')}
              aria-pressed={!activeFenceUnwrapped}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setUnwrappedFences((current) => {
                  const next = new Set(current)
                  if (next.has(activeFence.from)) next.delete(activeFence.from)
                  else next.add(activeFence.from)
                  return next
                })
              }}
            >
              <WrapText aria-hidden="true" />
            </button>
            <button
              type="button"
              className="md-code-action"
              aria-label={t(props.locale, copiedCode ? 'copied' : 'copyCode')}
              title={t(props.locale, copiedCode ? 'copied' : 'copyCode')}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                const view = viewRef.current
                const fence = view && editableCodeFenceAtLine(view.state.doc, activeFence.lineNumber)
                if (!view || !fence) return
                const lastBodyLine = (fence.closingLineNumber ?? view.state.doc.lines + 1) - 1
                const source = Array.from(
                  { length: Math.max(0, lastBodyLine - fence.lineNumber) },
                  (_, index) => view.state.doc.line(fence.lineNumber + index + 1).text,
                ).join('\n')
                void navigator.clipboard.writeText(source).then(() => {
                  setCopiedCode(true)
                  window.setTimeout(() => setCopiedCode(false), 1400)
                })
              }}
            >
              {copiedCode ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            </button>
          </div>
        ) : null}
        <CodeMirror
          value={props.value}
          height="100%"
          theme={props.theme === 'dark' ? oneDarkTheme : 'light'}
          extensions={[
            markdown({ codeLanguages: languages }),
            syntaxHighlighting(codeHighlight),
            editorHeadings,
            imagePreviewExtension,
            imagePasteExtension,
            codeFenceInputExtension,
            EditorView.lineWrapping,
            EditorView.scrollMargins.of((view) => ({ top: editorOverlayHeight(view) })),
            EditorView.contentAttributes.of({ spellcheck: 'true', autocapitalize: 'sentences' }),
            keymap.of([
              { key: 'Enter', run: continueTaskList },
              { key: 'Tab', run: (view) => navigateTableCell(view, 'next') || indentFenceBody(view, 'more') },
              { key: 'Shift-Tab', run: (view) => navigateTableCell(view, 'previous') || indentFenceBody(view, 'less') },
            ]),
          ]}
          onCreateEditor={(view) => {
            viewRef.current = view
            if (import.meta.env.DEV || import.meta.env.VITE_WDIO)
              (window as Window & { __TEXTMARK_EDITOR_VIEW__?: EditorView }).__TEXTMARK_EDITOR_VIEW__ = view
            const head = view.state.selection.main.head
            const line = view.state.doc.lineAt(head)
            setActiveFence(editableCodeFenceAtLine(view.state.doc, line.number))
            props.onCursorChange(line.number, head - line.from + 1)
            onFormattingStateChangeRef.current?.(editorFormattingState(view))
            onStateChangeRef.current?.(getEditorState(view))
            setReady(true)
          }}
          onChange={props.onChange}
          onUpdate={(update) => {
            if (update.docChanged || update.viewportChanged) syncCodeWrap(update.view, unwrappedFences)
            if (update.docChanged) {
              setUnwrappedFences((current) => {
                const next = new Set([...current].map((from) => update.changes.mapPos(from, 1)))
                return next.size === current.size && [...next].every((from) => current.has(from)) ? current : next
              })
            }
            if (!update.selectionSet && !update.docChanged) return
            const head = update.state.selection.main.head
            const line = update.state.doc.lineAt(head)
            setActiveFence(editableCodeFenceAtLine(update.state.doc, line.number))
            props.onCursorChange(line.number, head - line.from + 1)
            onFormattingStateChangeRef.current?.(editorFormattingState(update.view))
            onStateChangeRef.current?.(getEditorState(update.view))
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
