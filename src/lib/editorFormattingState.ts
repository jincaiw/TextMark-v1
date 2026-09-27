import type { EditorFormattingState } from '../types'

export function editorFormattingStateFromSource(source: string, from: number, to: number, currentLine: string): EditorFormattingState {
  const heading = currentLine.match(/^\s*(#{1,6})\s/)
  const wraps = (opening: string, closing: string) =>
    from >= opening.length &&
    to + closing.length <= source.length &&
    source.slice(from - opening.length, from) === opening &&
    source.slice(to, to + closing.length) === closing
  const bold = wraps('**', '**')
  return {
    heading: heading ? (`h${heading[1].length}` as EditorFormattingState['heading']) : 'h0',
    bold,
    italic: !bold && (wraps('*', '*') || wraps('_', '_')),
    strikethrough: wraps('~~', '~~'),
    code: wraps('`', '`'),
    link: wraps('[', ']('),
    highlight: wraps('==', '=='),
    bulletList: /^\s*[-+*]\s+(?!\[[ xX]\]\s)/.test(currentLine),
    orderedList: /^\s*\d+[.)]\s+/.test(currentLine),
    taskList: /^\s*(?:[-+*]\s+)?\[[ xX]\]\s+/.test(currentLine),
    quote: /^\s*>\s?/.test(currentLine),
  }
}
