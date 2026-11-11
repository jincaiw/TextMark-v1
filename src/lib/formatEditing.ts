// Block/inline formatting commands for the floating format controls, ported
// from upstream markdown-preview's CodeMirror editor (entry-cm.js exec table,
// toggleInlineMark, setHeading, applyListStyle, applyBlockStyle,
// insertLinkFromPopover). The menu's Format commands and the floating bar run
// through the same functions, so both produce upstream source edits.
import { EditorSelection, type ChangeSpec, type Line } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import {
  enclosingNode,
  listPrefix,
  selectedListLines,
  stylingContext,
  editableListLines,
  type BlockStyle,
  type ListStyle,
} from './formatState'

/** Dispatch line-prefix edits while keeping the cursor after any inserted
 * prefix (the default mapping leaves it before, stranding the caret behind
 * the new list marker). */
function dispatchBlockChanges(view: EditorView, changes: ChangeSpec[]) {
  const changeSet = view.state.changes(changes)
  const sel = view.state.selection.main
  view.dispatch({
    changes,
    selection: EditorSelection.range(changeSet.mapPos(sel.anchor, 1), changeSet.mapPos(sel.head, 1)),
    userEvent: 'input',
  })
}

/** Toggle `**`/`*`/`~~`/`` ` `` around each selection range. CommonMark
 * rejects emphasis that opens or closes against whitespace, so surrounding
 * spaces stay outside the markers. */
export function toggleInlineMark(view: EditorView, marker: string) {
  const len = marker.length
  const changes = view.state.changeByRange((range) => {
    let { from, to } = range
    while (from < to && /\s/.test(view.state.sliceDoc(from, from + 1))) from++
    while (to > from && /\s/.test(view.state.sliceDoc(to - 1, to))) to--
    const before = view.state.sliceDoc(Math.max(0, from - len), from)
    const after = view.state.sliceDoc(to, to + len)
    if (before === marker && after === marker) {
      return {
        changes: [
          { from: from - len, to: from, insert: '' },
          { from: to, to: to + len, insert: '' },
        ],
        range: EditorSelection.range(from - len, to - len),
      }
    }
    const selected = view.state.sliceDoc(from, to)
    if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length >= len * 2) {
      return {
        changes: { from, to, insert: selected.slice(len, selected.length - len) },
        range: EditorSelection.range(from, to - len * 2),
      }
    }
    return {
      changes: { from, to, insert: marker + selected + marker },
      range: EditorSelection.range(from + len, to + len),
    }
  })
  view.dispatch(changes, { scrollIntoView: true, userEvent: 'input' })
}

/** Set the heading level (0 = body) on every selected line. */
export function setHeading(view: EditorView, level: number) {
  const sel = view.state.selection.main
  const start = view.state.doc.lineAt(sel.from).number
  const end = view.state.doc.lineAt(sel.to).number
  const changes: ChangeSpec[] = []
  for (let n = start; n <= end; n++) {
    const line = view.state.doc.line(n)
    const m = /^(#{1,6})\s+/.exec(line.text)
    const current = m ? m[1].length : 0
    const insert = current === level || level === 0 ? '' : `${'#'.repeat(level)} `
    changes.push({ from: line.from, to: line.from + (m ? m[0].length : 0), insert })
  }
  view.dispatch({ changes, userEvent: 'input' })
}

/** The source lines the selection spans, including the line the range ends on. */
function eachSelectedLine(view: EditorView, fn: (lines: Line[]) => ChangeSpec[]) {
  const sel = view.state.selection.main
  const start = view.state.doc.lineAt(sel.from).number
  const end = view.state.doc.lineAt(sel.to).number
  const lines: Line[] = []
  for (let n = start; n <= end; n++) lines.push(view.state.doc.line(n))
  return fn(lines)
}

/** Add `prefix` to every selected line, or strip it when all lines have it. */
export function toggleBlockPrefix(view: EditorView, prefix: string, pattern: RegExp) {
  const changes = eachSelectedLine(view, (lines) => {
    const all = lines.every((line) => pattern.test(line.text))
    return lines
      .map((line) => {
        if (all) {
          const m = line.text.match(pattern)
          return { from: line.from, to: line.from + m![0].length, insert: '' }
        }
        return pattern.test(line.text) ? null : { from: line.from, insert: prefix }
      })
      .filter(Boolean) as ChangeSpec[]
  })
  if (changes.length) dispatchBlockChanges(view, changes)
}

/** Numbered-list toggle: renumbers the lines it adds markers to. */
export function toggleOrderedList(view: EditorView) {
  const pattern = /^\d+\.\s/
  const changes = eachSelectedLine(view, (lines) => {
    const all = lines.every((line) => pattern.test(line.text))
    let i = 1
    return lines
      .map((line) => {
        if (all) {
          const m = line.text.match(pattern)
          return { from: line.from, to: line.from + m![0].length, insert: '' }
        }
        return pattern.test(line.text) ? null : { from: line.from, insert: `${i++}. ` }
      })
      .filter(Boolean) as ChangeSpec[]
  })
  if (changes.length) dispatchBlockChanges(view, changes)
}

/** Convert every selected line to the given list style, or back to plain. */
export function applyListStyle(view: EditorView, style: Exclude<ListStyle, 'mixed'>): boolean {
  if (!['none', 'bullet', 'ordered', 'task'].includes(style)) return false
  const changes = editableListLines(view.state)
    .map((line, index) => {
      const current = listPrefix(line.text)
      if (current.style === style) return null
      const marker = style === 'none' ? '' : style === 'bullet' ? '- ' : style === 'task' ? '- [ ] ' : `${index + 1}. `
      return { from: line.from, to: line.from + current.prefix.length, insert: current.indent + marker }
    })
    .filter(Boolean) as ChangeSpec[]
  if (changes.length) dispatchBlockChanges(view, changes)
  view.focus()
  return true
}

/** Apply a block style to the selection, unwrapping an existing block first
 * so switching quote → code replaces rather than nests. */
export function applyBlockStyle(view: EditorView, style: BlockStyle, language = ''): boolean {
  if (!['none', 'quote', 'code', 'plain', 'fenced', 'table'].includes(style)) return false
  const state = view.state
  const selection = state.selection.main
  const context = stylingContext(state)
  const containsSelection = context.node && selection.from >= context.node.from && selection.to <= context.node.to
  if (style === 'code' && (!containsSelection || context.style === 'code')) {
    if (context.style !== 'code') toggleInlineMark(view, '`')
    view.focus()
    return true
  }
  if (style === 'table') {
    const fence = enclosingNode(state, selection.to, ['FencedCode'])
    const end = fence ? fence.to : state.doc.lineAt(selection.to).to
    const insert = '\n\n| Column 1 | Column 2 |\n| --- | --- |\n|  |  |\n'
    view.dispatch({ changes: { from: end, insert }, selection: { anchor: end + insert.length }, userEvent: 'input' })
    view.focus()
    return true
  }
  if (style === context.style && containsSelection && style !== 'fenced') return true
  if (style === 'quote' && !containsSelection) {
    const changes = selectedListLines(state)
      .filter((line) => !enclosingNode(state, line.from + Math.max(0, line.text.search(/\S/)), ['Blockquote']))
      .map((line) => ({ from: line.from, insert: '> ' }))
    if (changes.length) dispatchBlockChanges(view, changes)
    view.focus()
    return true
  }
  const lines = selectedListLines(state)
  let from = lines[0].from
  let to = lines[lines.length - 1].to
  let source = state.sliceDoc(from, to)
  const node = context.node
  if (node && selection.from >= node.from && selection.to <= node.to && (context.style !== 'code' || style === 'none')) {
    from = context.style === 'code' ? node.from : state.doc.lineAt(node.from).from
    to = node.to
    source = state.sliceDoc(from, to)
    if (context.style === 'fenced') {
      const opening = state.doc.lineAt(node.from)
      const last = state.doc.lineAt(node.to)
      const closed = node.lastChild?.name === 'CodeMark'
      source = state.sliceDoc(Math.min(opening.to + 1, node.to), closed ? last.from : node.to).replace(/\n$/, '')
    } else if (context.style === 'plain') source = source.replace(/^(?: {4}|\t)/gm, '')
    else if (context.style === 'quote') source = source.replace(/^ {0,3}> ?/gm, '')
    else if (context.style === 'code') source = state.sliceDoc(node.firstChild!.to, node.lastChild!.from)
  }
  let insert = source
  let caretOffset = 0
  if (style === 'code') {
    source = source.replace(/\n/g, ' ')
    const fence = '`'.repeat(Math.max(1, ...(source.match(/`+/g) || []).map((run) => run.length + 1)))
    const pad = /^`|`$/.test(source) || (/^ .* $/.test(source) && /\S/.test(source)) ? ' ' : ''
    insert = fence + pad + source + pad + fence
    caretOffset = fence.length + pad.length
  }
  if (style === 'quote') {
    insert = source
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n')
    caretOffset = 2
  }
  if (style === 'plain') {
    insert = source
      .split('\n')
      .map((line) => `    ${line}`)
      .join('\n')
    caretOffset = 4
  }
  if (style === 'fenced') {
    const runs = source.match(/`+/g) || []
    const fence = '`'.repeat(Math.max(3, ...runs.map((run) => run.length + 1)))
    const info = String(language).replace(/[^\w+-]/g, '')
    const opening = `${fence}${info}\n`
    insert = opening + source + '\n' + fence
    caretOffset = opening.length
  }
  if (style === 'plain' && from > 0 && state.doc.lineAt(from - 1).text.trim()) {
    insert = `\n${insert}`
    caretOffset++
  }
  view.dispatch({ changes: { from, to, insert }, selection: { anchor: from + caretOffset }, userEvent: 'input' })
  view.focus()
  return true
}

/** Replace the range with a Markdown link, escaping the label and encoding
 * the destination the way upstream insertLinkFromPopover does. */
export function insertLinkFromPopover(view: EditorView, text: string, url: string, from: number, to: number): boolean {
  const destination = String(url).trim()
  if (!destination || /[\r\n]/.test(destination) || from < 0 || to < from || to > view.state.doc.length) return false
  const label = (String(text) || destination)
    .replace(/\\/g, '\\\\')
    .replace(/([\[\]])/g, '\\$1')
    .replace(/[\r\n]+/g, ' ')
  const target = destination.replace(/[\s<>\\()]/g, (character) =>
    /[()]/.test(character) ? `%${character.charCodeAt(0).toString(16).toUpperCase()}` : encodeURIComponent(character),
  )
  const insert = `[${label}](${target})`
  view.dispatch({ changes: { from, to, insert }, selection: { anchor: from + insert.length }, userEvent: 'input' })
  view.focus()
  return true
}

/** ⌘K / the menu's Link: wrap the selection, selecting `url` for typing. */
export function insertLinkPlaceholder(view: EditorView) {
  const range = view.state.selection.main
  const text = view.state.sliceDoc(range.from, range.to) || 'text'
  const insert = `[${text}](url)`
  const urlStart = range.from + text.length + 3
  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: EditorSelection.range(urlStart, urlStart + 3),
    userEvent: 'input',
    scrollIntoView: true,
  })
}
