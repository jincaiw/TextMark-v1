/**
 * Copy as Plain Text (upstream #637, v0.0.72): the selection as text without
 * Markdown, plus the same HTML a normal copy writes, for rich text fields.
 *
 * A normal copy in the reader writes the Markdown source, so pasting into a
 * plain text field gets `**bold**` and table pipes. This path writes the text
 * as it reads: list bullets and numbers, task boxes, tab-separated table
 * rows, TeX for math, and `[n]` for footnote references.
 */

// Rendered but not text worth pasting: diagrams and footnote back links.
// `.footnote-backrefs` is upstream's wrapper; TextMark's footnote plugin emits
// the back refs as plain siblings, so `.footnote-backref` skips them there.
// `.md-source-list-marker` is upstream's source-list DOM; TextMark renders
// real `<li>` elements instead, so there is no analogue to skip.
const MD_PLAIN_SKIPPED_SELECTOR = '.mermaid-figure, .mermaid, .footnote-backrefs, .footnote-backref, hr'

// Upstream's chrome surfaces, mapped to TextMark's DOM: the code card header
// (language + wrap/copy pill) and the diagram HUD. These are stripped from
// the copied HTML fragment too, exactly as upstream's selectionFragment does.
const MD_CHROME_SELECTOR = '.md-code-header, .diagram-hud'

// Upstream's non-text surfaces for the walker: chrome plus KaTeX's MathML
// layer (its TeX annotation is emitted separately below).
const MD_UNCOUNTED_SELECTOR = `${MD_CHROME_SELECTOR}, .katex-mathml`

function isBlock(display: string): boolean {
  return !/^(?:inline|contents|table-cell|ruby)/.test(display)
}

/** Whether the selection covers the block's whole rendered content at one
 * edge, so the block's marker (or nothing outside it) should be copied. */
function coversBlockEdge(range: Range, block: Element, edge: 'start' | 'end'): boolean {
  const probe = document.createRange()
  probe.selectNodeContents(block)
  if (edge === 'start') probe.setEnd(range.startContainer, range.startOffset)
  else probe.setStart(range.endContainer, range.endOffset)
  return probe.toString().trim() === ''
}

/** The selection's range clipped to the article, or null. */
export function selectedArticleRange(article: Element | null): Range | null {
  const selection = window.getSelection()
  if (!article || !selection || selection.isCollapsed || !selection.rangeCount) return null
  const range = selection.getRangeAt(0)
  if (!range.intersectsNode(article)) return null
  const clipped = range.cloneRange()
  const bounds = document.createRange()
  bounds.selectNodeContents(article)
  if (clipped.compareBoundaryPoints(Range.START_TO_START, bounds) < 0) clipped.setStart(bounds.startContainer, bounds.startOffset)
  if (clipped.compareBoundaryPoints(Range.END_TO_END, bounds) > 0) clipped.setEnd(bounds.endContainer, bounds.endOffset)
  return clipped
}

/**
 * Mirrors upstream's `renderedTextOfRange(range, root, { plain: true })`.
 * Layout probes (character widths, `checkVisibility`) degrade to the
 * attribute-based checks the DOM exposes; WebKit and Blink share the
 * `white-space-collapse` computed property, so the text-run logic is exact.
 */
export function plainRenderedText(range: Range, root: Element): string {
  const styles = new Map<Element, CSSStyleDeclaration>()
  function styleOf(element: Element): CSSStyleDeclaration {
    let style = styles.get(element)
    if (!style) {
      style = getComputedStyle(element)
      styles.set(element, style)
    }
    return style
  }
  function whiteSpaceMode(element: Element): 'preserve' | 'preserve-breaks' | 'collapse' {
    const style = styleOf(element)
    // The `white-space` shorthand wins first: engines that implement
    // `white-space-collapse` set both consistently, and jsdom reports the
    // longhand as `collapse` even for `pre`, which would corrupt code text.
    if (/^(?:pre|pre-wrap|break-spaces)$/.test(style.whiteSpace)) return 'preserve'
    if (style.whiteSpace === 'pre-line') return 'preserve-breaks'
    const collapse = (style as CSSStyleDeclaration & { whiteSpaceCollapse?: string }).whiteSpaceCollapse
    if (collapse) {
      if (collapse === 'preserve-breaks') return 'preserve-breaks'
      return collapse === 'collapse' ? 'collapse' : 'preserve'
    }
    return 'collapse'
  }
  // One line break inside lists, tables, and callouts; a blank line between
  // every other pair of blocks.
  function plainBlockBreaks(node: Element, display: string, listDepth: number): number {
    if (listDepth || node.nodeName === 'LI' || display.startsWith('table-')) return 1
    return node.parentElement?.classList.contains('markdown-alert') ? 1 : 2
  }

  // Separators wait until the next visible text, so leading and trailing
  // breaks never reach the result. Line breaks win over cell tabs, which win
  // over collapsed spaces.
  let text = ''
  let breaks = 0
  let cell = false
  let space = false
  // A list item's marker, written before its first text, and how many list
  // items the walk is inside.
  let prefix = ''
  let listDepth = 0
  function emit(value: string) {
    if (text) {
      if (breaks) {
        const trailing = /\n*$/.exec(text)![0].length
        text += '\n'.repeat(Math.max(0, breaks - trailing))
      } else if (cell) {
        text += '\t'
      } else if (space && !text.endsWith('\n') && !value.startsWith('\n')) {
        text += ' '
      }
    }
    breaks = 0
    cell = false
    space = false
    text += prefix + value
    prefix = ''
  }
  function listMarker(item: Element): string {
    const list = item.parentElement
    let marker = '•'
    if (list && list.nodeName === 'OL') {
      let number = parseInt(list.getAttribute('start') ?? '', 10)
      if (!Number.isFinite(number)) number = 1
      for (let el = item.previousElementSibling; el; el = el.previousElementSibling) {
        if (el.nodeName === 'LI') number += 1
      }
      marker = `${number}.`
    }
    const box = item.classList.contains('task-list-item')
      ? item.querySelector(':scope > input[type=checkbox], :scope > p > input[type=checkbox]')
      : null
    if (box) marker = (marker === '•' ? '' : `${marker} `) + ((box as HTMLInputElement).checked ? '☑' : '☐')
    return '  '.repeat(listDepth) + marker + ' '
  }
  // Whether the character at `index` takes up space on screen. Without a
  // laid-out document (jsdom) the probe reports nothing, which only affects
  // selections that start or end on a collapsed space.
  function rendersCharacter(node: Text, index: number): boolean {
    const probe = document.createRange()
    probe.setStart(node, index)
    probe.setEnd(node, index + 1)
    return typeof probe.getBoundingClientRect === 'function' ? probe.getBoundingClientRect().width > 0 : false
  }
  function isHidden(element: Element): boolean {
    if (element.closest('[hidden]')) return true
    const check = (element as Element & { checkVisibility?: () => boolean }).checkVisibility
    return typeof check === 'function' ? !check.call(element) : false
  }
  function addText(node: Text) {
    const from = node === range.startContainer ? range.startOffset : 0
    const to = node === range.endContainer ? range.endOffset : (node.nodeValue ?? '').length
    const selected = (node.nodeValue ?? '').slice(from, to)
    const parent = node.parentElement
    if (!selected || !parent || styleOf(parent).visibility !== 'visible') return
    const mode = whiteSpaceMode(parent)
    if (mode === 'preserve') {
      emit(selected)
      return
    }
    const collapsed =
      mode === 'preserve-breaks'
        ? selected.replace(/[ \t]*\n[ \t]*/g, '\n').replace(/[ \t]+/g, ' ')
        : selected.replace(/[ \t\n\r\f]+/g, ' ')
    // Spaces between text nodes wait for the next visible text so source
    // formatting drops out. A space at a selection edge has no such neighbor
    // in the selection, so ask layout instead.
    let value = collapsed
    if (value.startsWith(' ')) {
      value = value.slice(1)
      if (node === range.startContainer && rendersCharacter(node, from)) emit(' ')
      else space = true
    }
    const trailingSpace = value.endsWith(' ')
    if (trailingSpace) value = value.slice(0, -1)
    if (value) emit(value)
    if (trailingSpace) {
      const run = /[ \t\n\r\f]+$/.exec(selected)!
      if (node === range.endContainer && rendersCharacter(node, from + run.index)) emit(' ')
      else space = true
    }
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!range.intersectsNode(node)) return NodeFilter.FILTER_REJECT
      if (node.nodeType !== Node.ELEMENT_NODE) return NodeFilter.FILTER_ACCEPT
      const element = node as Element
      if (element.matches(MD_UNCOUNTED_SELECTOR)) return NodeFilter.FILTER_REJECT
      if (element.matches(MD_PLAIN_SKIPPED_SELECTOR)) return NodeFilter.FILTER_REJECT
      // display:contents has no box of its own, so checkVisibility reports
      // false even though its children render.
      if (styleOf(element).display === 'contents') return NodeFilter.FILTER_ACCEPT
      if (isHidden(element)) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })
  function walkChildren(node: Node) {
    if (!walker.firstChild()) return
    // A closed <details> renders only its summary.
    const closedDetails = node.nodeName === 'DETAILS' && !(node as HTMLDetailsElement).open
    do {
      const child = walker.currentNode
      if (closedDetails && child.nodeName !== 'SUMMARY') continue
      walk(child)
    } while (walker.nextSibling())
    walker.parentNode()
  }
  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      addText(node as Text)
      return
    }
    const element = node as Element
    if (element.nodeName === 'BR') {
      emit('\n')
      return
    }
    const display = styleOf(element).display
    if (element.classList.contains('katex')) {
      const annotation = element.querySelector('annotation[encoding="application/x-tex"]')
      if (annotation) {
        if (isBlock(display)) breaks = Math.max(breaks, plainBlockBreaks(element, display, listDepth))
        emit(annotation.textContent?.trim() ?? '')
        return
      }
    }
    if (element.matches('sup.footnote-ref')) {
      // Upstream's DOM holds a bare `1` here; TextMark's footnote plugin
      // already renders `[1]`, so wrap only what is not bracketed yet.
      const value = element.textContent?.trim() ?? ''
      emit(value.startsWith('[') ? value : `[${value}]`)
      return
    }
    const blockBreaks = isBlock(display) ? plainBlockBreaks(element, display, listDepth) : 0
    breaks = Math.max(breaks, blockBreaks)
    if (display === 'table-row') {
      // Cell by cell, so an empty cell keeps its column.
      const cells = Array.from(element.children)
        .filter((child) => range.intersectsNode(child) && !isHidden(child))
        .map((child) => plainRenderedText(range, child).replace(/\s*\n\s*/g, ' '))
      breaks = Math.max(breaks, 1)
      if (cells.some(Boolean)) emit(cells.join('\t'))
      breaks = Math.max(breaks, 1)
      return
    }
    const listItem = element.nodeName === 'LI'
    // A selection that starts inside the item's text copies that text
    // without the item's marker.
    if (listItem && coversBlockEdge(range, element, 'start')) {
      prefix = listMarker(element)
    }
    if (listItem) listDepth += 1
    walkChildren(element)
    if (listItem) {
      listDepth -= 1
      // An empty item's marker must not reach the next paragraph.
      prefix = ''
    }
    breaks = Math.max(breaks, blockBreaks)
    if (display === 'table-cell') cell = true
  }
  walkChildren(root)
  return text
}

function selectionFragment(): DocumentFragment | null {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null
  const fragment = document.createDocumentFragment()
  for (let i = 0; i < selection.rangeCount; i += 1) {
    fragment.appendChild(selection.getRangeAt(i).cloneContents())
  }
  fragment.querySelectorAll(MD_CHROME_SELECTOR).forEach((node) => node.remove())
  return fragment
}

function htmlFromFragment(fragment: DocumentFragment): string {
  const div = document.createElement('div')
  div.appendChild(fragment.cloneNode(true))
  return div.innerHTML
}

/** Copy as Plain Text: the selection as text without Markdown, plus the same
 * HTML a normal copy writes, for rich text fields. Null without a selection
 * inside the rendered article. */
export function plainTextForSelection(): { text: string; html: string } | null {
  const article = document.querySelector('article.markdown-body')
  const range = selectedArticleRange(article)
  if (!range) return null
  const text = plainRenderedText(range, article as Element)
  if (!text) return null
  const fragment = selectionFragment()
  return { text, html: fragment ? htmlFromFragment(fragment) : '' }
}

/**
 * Writes the plain-text copy to the pasteboard (text plus HTML for rich text
 * fields). The writer is injected so the DOM walk stays testable and the
 * platform pasteboard lives with the platform layer. Returns false — nothing
 * written — when there is no article selection, matching upstream's no-op
 * (and beep) path.
 */
export async function copyAsPlainText(write: (copy: { text: string; html: string }) => Promise<void>): Promise<boolean> {
  const copy = plainTextForSelection()
  if (!copy) return false
  await write(copy)
  return true
}
