/** Scroll a fragment target inside the rendered preview without moving the
 * app/window scroll ancestors. Native fragment navigation can scroll both
 * layers in WebKit when the preview is nested in a fixed-height desktop shell. */
export function scrollPreviewToFragment(pane: HTMLElement, root: HTMLElement, href: string) {
  if (!href.startsWith('#') || href.length < 2) return false

  let id: string
  try {
    id = decodeURIComponent(href.slice(1))
  } catch {
    return false
  }

  const target = document.getElementById(id)
  if (!target || !root.contains(target)) return false

  const paneBounds = pane.getBoundingClientRect()
  const targetBounds = target.getBoundingClientRect()
  const paneStyle = getComputedStyle(pane)
  const targetStyle = getComputedStyle(target)
  const scrollPadding = Number.parseFloat(paneStyle.scrollPaddingTop) || 0
  const scrollMargin = Number.parseFloat(targetStyle.scrollMarginTop) || 0
  const targetTop = pane.scrollTop + targetBounds.top - paneBounds.top - pane.clientTop - scrollPadding - scrollMargin

  if (typeof pane.scrollTo === 'function') pane.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' })
  else pane.scrollTop = Math.max(0, targetTop)
  return true
}
