// Equivalence tests for the floating-format editing port: each case mirrors
// the documented upstream entry-cm.js behavior (toggleInlineMark, setHeading,
// list/block toggles, insertLinkFromPopover) on real source edits.
import { afterEach, describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { markdown } from '@codemirror/lang-markdown'
import {
  applyBlockStyle,
  applyListStyle,
  insertLinkFromPopover,
  insertLinkPlaceholder,
  setHeading,
  toggleBlockPrefix,
  toggleInlineMark,
  toggleOrderedList,
} from './formatEditing'

let view: EditorView | null = null

/** Mount an editor with the selection [from,to]; returns the view. */
function editor(doc: string, from = 0, to = from): EditorView {
  const host = document.createElement('div')
  document.body.append(host)
  view = new EditorView({
    state: EditorState.create({ doc, extensions: [markdown()] }),
    parent: host,
  })
  view.dispatch({ selection: { anchor: from, head: to } })
  return view
}
const text = () => view!.state.doc.toString()
const selection = () => {
  const range = view!.state.selection.main
  return [range.from, range.to] as const
}

afterEach(() => {
  view?.destroy()
  view = null
  document.body.innerHTML = ''
})

describe('toggleInlineMark', () => {
  it('wraps the selection with the marker and keeps the text selected', () => {
    editor('hello', 0, 5)
    toggleInlineMark(view!, '**')
    expect(text()).toBe('**hello**')
    expect(selection()).toEqual([2, 7])
  })

  it('leaves surrounding whitespace outside the markers', () => {
    editor('say hello now', 3, 9)
    toggleInlineMark(view!, '**')
    expect(text()).toBe('say **hello** now')
  })

  it('unwraps when the markers already surround the trimmed selection', () => {
    editor('**hello**', 0, 9)
    toggleInlineMark(view!, '**')
    expect(text()).toBe('hello')
    expect(selection()).toEqual([0, 5])
  })

  it('unwraps when the selection itself contains the markers', () => {
    editor('**hello**', 0, 9)
    toggleInlineMark(view!, '**')
    expect(text()).toBe('hello')
    // Second pass over the bare word rewraps it.
    toggleInlineMark(view!, '**')
    expect(text()).toBe('**hello**')
  })

  it('toggles emphasis on a caret without a selection', () => {
    editor('hello', 5, 5)
    toggleInlineMark(view!, '*')
    expect(text()).toBe('hello**')
    expect(selection()).toEqual([6, 6])
  })
})

describe('setHeading', () => {
  it('adds markers to a body line', () => {
    editor('Title', 2, 2)
    setHeading(view!, 2)
    expect(text()).toBe('## Title')
  })

  it('replaces an existing level', () => {
    editor('### Title', 2, 2)
    setHeading(view!, 1)
    expect(text()).toBe('# Title')
  })

  it('strips markers back to body', () => {
    editor('# Title', 2, 2)
    setHeading(view!, 0)
    expect(text()).toBe('Title')
  })

  it('applies to every selected line', () => {
    editor('one\ntwo', 0, 7)
    setHeading(view!, 3)
    expect(text()).toBe('### one\n### two')
  })
})

describe('block prefix toggles', () => {
  it('adds and removes a quote prefix', () => {
    editor('hello', 0, 0)
    toggleBlockPrefix(view!, '> ', /^>\s?/)
    expect(text()).toBe('> hello')
    toggleBlockPrefix(view!, '> ', /^>\s?/)
    expect(text()).toBe('hello')
  })

  it('keeps the caret after the inserted prefix', () => {
    editor('hello', 0, 0)
    toggleBlockPrefix(view!, '- ', /^\s*[-+*]\s/)
    expect(text()).toBe('- hello')
    expect(selection()[0]).toBe(2)
  })

  it('renumbers ordered lines on toggle', () => {
    editor('one\ntwo\nthree', 0, 11)
    toggleOrderedList(view!)
    expect(text()).toBe('1. one\n2. two\n3. three')
    toggleOrderedList(view!)
    expect(text()).toBe('one\ntwo\nthree')
  })

  it('converts between list styles without stacking markers', () => {
    editor('- item', 2, 2)
    applyListStyle(view!, 'task')
    expect(text()).toBe('- [ ] item')
    applyListStyle(view!, 'ordered')
    expect(text()).toBe('1. item')
    applyListStyle(view!, 'none')
    expect(text()).toBe('item')
  })
})

describe('applyBlockStyle', () => {
  it('wraps the selection line in a quote', () => {
    editor('hello', 0, 0)
    applyBlockStyle(view!, 'quote')
    expect(text()).toBe('> hello')
  })

  it('switches quote to fenced code instead of nesting', () => {
    editor('> hello', 2, 2)
    applyBlockStyle(view!, 'fenced', 'js')
    expect(text()).toBe('```js\nhello\n```')
  })

  it('unwraps fenced code back to plain text', () => {
    editor('```\nhello\n```', 5, 5)
    applyBlockStyle(view!, 'none')
    expect(text()).toBe('hello')
  })

  it('indents plain text blocks', () => {
    editor('hello', 0, 0)
    applyBlockStyle(view!, 'plain')
    expect(text()).toBe('    hello')
  })

  it('wraps a plain-line selection in inline code', () => {
    editor('a b c', 0, 5)
    applyBlockStyle(view!, 'code')
    expect(text()).toBe('`a b c`')
  })

  it('sizes the fence past inner backticks when converting a quote', () => {
    editor('> a `b` c', 2, 2)
    applyBlockStyle(view!, 'code')
    expect(text()).toBe('``a `b` c``')
  })

  it('inserts a starter table after the selection line', () => {
    editor('intro', 0, 0)
    applyBlockStyle(view!, 'table')
    expect(text()).toBe('intro\n\n| Column 1 | Column 2 |\n| --- | --- |\n|  |  |\n')
  })
})

describe('link insertion', () => {
  it('escapes the label and percent-encodes parentheses in the URL', () => {
    editor('x', 1, 1)
    insertLinkFromPopover(view!, 'a [b] c', 'https://example.com/a(1)', 0, 1)
    expect(text()).toBe('[a \\[b\\] c](https://example.com/a%281%29)')
  })

  it('falls back to the URL as the label when text is empty', () => {
    editor('', 0, 0)
    expect(insertLinkFromPopover(view!, '', 'https://a.dev', 0, 0)).toBe(true)
    expect(text()).toBe('[https://a.dev](https://a.dev)')
  })

  it('refuses a blank or newline destination', () => {
    editor('x', 0, 1)
    expect(insertLinkFromPopover(view!, 't', '  ', 0, 1)).toBe(false)
    expect(insertLinkFromPopover(view!, 't', 'a\nb', 0, 1)).toBe(false)
    expect(text()).toBe('x')
  })

  it('inserts the placeholder link with url selected for typing', () => {
    editor('word', 0, 4)
    insertLinkPlaceholder(view!)
    expect(text()).toBe('[word](url)')
    expect(selection()).toEqual([7, 10])
  })
})
