// Formatting selection state for the floating format controls, ported from
// upstream markdown-preview's CodeMirror editor (entry-cm.js selectionContext /
// stylingContext / listStyle / getLinkSelection). Reads the lezer Markdown
// syntax tree the editor already builds, so the heading label, the B/I/S/link
// tint and the popover checkmarks describe exactly what is under the caret.
import { syntaxTree } from '@codemirror/language'
import type { EditorState, Line } from '@codemirror/state'

/** The subset of the lezer syntax tree this module reads. Declared locally so
 * the lib does not depend on the transitive @lezer/common package directly;
 * `syntaxTree(state).resolve*` returns exactly this shape. */
export interface MarkdownNode {
  name: string
  from: number
  to: number
  readonly parent: MarkdownNode | null
  readonly firstChild: MarkdownNode | null
  readonly lastChild: MarkdownNode | null
  getChildren(name: string): readonly MarkdownNode[]
}

export interface FormattingState {
  /** Heading level of the selection (0 = body, 1–6). */
  heading: number
  /** Active block/inline marks, sorted (bold, italic, strikethrough, link, …). */
  commands: string[]
  /** The selected source text, or null when the caret has no range. */
  selectedText: string | null
}

export interface LinkSelection {
  from: number
  to: number
  text: string
}

export type ListStyle = 'none' | 'bullet' | 'ordered' | 'task' | 'mixed'
export type BlockStyle = 'none' | 'quote' | 'code' | 'plain' | 'fenced' | 'table'

const NODE_COMMANDS: Record<string, string> = {
  StrongEmphasis: 'bold',
  Emphasis: 'italic',
  Strikethrough: 'strikethrough',
  Highlight: 'highlight',
  Link: 'link',
  InlineCode: 'code',
  BulletList: 'list',
  OrderedList: 'list',
  Blockquote: 'quote',
  FencedCode: 'fenced',
  CodeBlock: 'plain',
  Table: 'table',
}

const BLOCK_STYLES: Record<string, BlockStyle> = {
  InlineCode: 'code',
  FencedCode: 'fenced',
  CodeBlock: 'plain',
  Blockquote: 'quote',
  Table: 'table',
}

/** Heading level and active marks enclosing the selection (upstream
 * selectionContext). Walks outward from the selection start, skipping nodes
 * that end before the selection does. */
export function selectionContext(state: EditorState): FormattingState {
  const selection = state.selection.main
  const commands = new Set<string>()
  let heading = 0
  for (let node = syntaxTree(state).resolveInner(selection.from, 1) as MarkdownNode | null; node; node = node.parent) {
    if (node.to < selection.to) continue
    const match = /^(?:ATX|Setext)Heading([1-6])$/.exec(node.name)
    if (match) heading = Number(match[1])
    const command = NODE_COMMANDS[node.name]
    if (command) commands.add(command)
  }
  return {
    heading,
    commands: [...commands].sort(),
    selectedText: selection.empty ? null : state.sliceDoc(selection.from, selection.to),
  }
}

/** The innermost block style enclosing the caret (upstream stylingContext). */
export function stylingContext(state: EditorState): { style: BlockStyle; node: MarkdownNode | null } {
  const selection = state.selection.main
  for (let node = syntaxTree(state).resolve(selection.head, selection.empty ? 1 : -1) as MarkdownNode | null; node; node = node.parent) {
    const style = BLOCK_STYLES[node.name]
    if (style) return { style, node }
  }
  return { style: 'none', node: null }
}

export function blockStyle(state: EditorState): BlockStyle {
  return stylingContext(state).style
}

/** The leading list/quote marker of a line and the style it denotes. */
export function listPrefix(text: string): { prefix: string; indent: string; style: Exclude<ListStyle, 'mixed'> } {
  const match = /^([ \t]*(?:>[ \t]*)*)(?:([-+*]|\d+[.)])([ \t]+)(\[[ xX]\][ \t]+)?)?/.exec(text)!
  return {
    prefix: match[0],
    indent: match[1],
    style: !match[2] ? 'none' : match[4] ? 'task' : /^\d/.test(match[2]) ? 'ordered' : 'bullet',
  }
}

export function enclosingNode(state: EditorState, position: number, names: string[]): MarkdownNode | null {
  for (let node = syntaxTree(state).resolve(position, 1) as MarkdownNode | null; node; node = node.parent) {
    if (names.includes(node.name)) return node
  }
  return null
}

/** The source lines the selection touches (a trailing newline does not pull
 * the next line in). */
export function selectedListLines(state: EditorState): Line[] {
  const selection = state.selection.main
  const start = state.doc.lineAt(selection.from).number
  const end = state.doc.lineAt(selection.empty ? selection.to : selection.to - 1).number
  return Array.from({ length: end - start + 1 }, (_, index) => state.doc.line(start + index))
}

/** Selected lines that can carry a list marker: not blank, not inside code. */
export function editableListLines(state: EditorState): Line[] {
  return selectedListLines(state).filter(
    (line) =>
      !/^[ \t>]*$/.test(line.text) && !enclosingNode(state, line.from + Math.max(0, line.text.search(/\S/)), ['FencedCode', 'CodeBlock']),
  )
}

/** The common list style of the selected lines, or 'mixed'/'none'. */
export function listStyle(state: EditorState): ListStyle {
  const styles = editableListLines(state).map((line) => listPrefix(line.text).style)
  if (!styles.length) return 'none'
  return styles.every((style) => style === styles[0]) ? styles[0] : 'mixed'
}

/** The range and display text the link form should edit. With `expandLink`,
 * an enclosing link is selected whole so its label can be rewritten. */
export function linkSelection(state: EditorState, expandLink = false): LinkSelection {
  const { from, to } = state.selection.main
  const link = enclosingNode(state, from, ['Link'])
  if (expandLink && link && to <= link.to) {
    const marks = link.getChildren('LinkMark')
    if (marks.length >= 2) {
      return { from: link.from, to: link.to, text: state.sliceDoc(marks[0].to, marks[1].from) }
    }
  }
  return { from, to, text: state.sliceDoc(from, to) }
}
