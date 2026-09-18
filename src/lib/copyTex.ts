function closestKatex(node: Node): Element | null {
  const element = node instanceof Element ? node : node.parentElement
  return element?.closest('.katex') ?? null
}

function selectedHtml(fragment: DocumentFragment): string {
  return Array.from(fragment.childNodes)
    .map((node) => (node instanceof Text ? node.textContent : (node as Element).outerHTML))
    .join('')
}

/**
 * Mirrors KaTeX's official copy-tex extension without installing a global
 * document listener. The scoped handler keeps TextMark table-copy semantics
 * intact and only rewrites selections made inside the preview pane.
 */
export function writeKatexSelectionToClipboard(event: ClipboardEvent, root: HTMLElement): boolean {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || !selection.rangeCount || !event.clipboardData) return false

  const range = selection.getRangeAt(0).cloneRange()
  if (!root.contains(range.commonAncestorContainer)) return false

  const startKatex = closestKatex(range.startContainer)
  if (startKatex && root.contains(startKatex)) range.setStartBefore(startKatex)
  const endKatex = closestKatex(range.endContainer)
  if (endKatex && root.contains(endKatex)) range.setEndAfter(endKatex)

  const displayStates = Array.from(root.querySelectorAll('.katex-mathml'))
    .filter((mathml) => range.intersectsNode(mathml))
    .map((mathml) => Boolean(mathml.closest('.katex-display')))
  const fragment = range.cloneContents()
  if (!fragment.querySelector('.katex-mathml')) return false

  event.clipboardData.setData('text/html', selectedHtml(fragment))
  fragment.querySelectorAll('.katex-mathml + .katex-html').forEach((element) => element.remove())
  fragment.querySelectorAll('.katex-mathml').forEach((mathml, index) => {
    const annotation = mathml.querySelector('annotation')
    if (!annotation) return
    // Expanding a selection that starts inside a display formula clones the
    // inner `.katex` node but not its `.katex-display` parent. Preserve the
    // original node's display state so the plain-text delimiters stay exact.
    const display = displayStates[index] ?? Boolean(mathml.closest('.katex-display'))
    annotation.textContent = `${display ? '$$' : '$'}${annotation.textContent ?? ''}${display ? '$$' : '$'}`
    mathml.replaceWith(annotation)
  })
  event.clipboardData.setData('text/plain', fragment.textContent ?? '')
  event.preventDefault()
  return true
}
