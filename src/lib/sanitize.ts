import DOMPurify from 'dompurify'
import type { RenderedMarkdown } from '../types'

const katexStyleProperties = new Set([
  'border-bottom-width',
  'height',
  'margin-left',
  'margin-right',
  'min-width',
  'padding-left',
  'position',
  'top',
  'vertical-align',
  'width',
])

function isSafeKatexStyle(value: string) {
  const declarations = value
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean)
  return (
    declarations.length > 0 &&
    declarations.every((declaration) => {
      const separator = declaration.indexOf(':')
      if (separator < 1) return false
      const property = declaration.slice(0, separator).trim().toLowerCase()
      const styleValue = declaration
        .slice(separator + 1)
        .trim()
        .toLowerCase()
      if (!katexStyleProperties.has(property)) return false
      if (property === 'position') return styleValue === 'relative'
      const measurement = styleValue.match(/^(-?\d+(?:\.\d+)?)em$/)
      return Boolean(measurement && Math.abs(Number(measurement[1])) <= 20)
    })
  )
}

export function sanitizeRenderedMarkdown(result: RenderedMarkdown): RenderedMarkdown {
  const preserveTrustedKatexLayout = (node: Element, hook: { attrName: string; attrValue: string; keepAttr: boolean }) => {
    if (hook.attrName !== 'style') return
    hook.keepAttr = Boolean(node.closest('.katex') && isSafeKatexStyle(hook.attrValue))
  }
  DOMPurify.addHook('uponSanitizeAttribute', preserveTrustedKatexLayout)
  try {
    return {
      ...result,
      html: DOMPurify.sanitize(result.html, {
        ADD_ATTR: ['target', 'rel', 'data-local-src', 'data-mermaid-source', 'data-lines'],
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'style', 'link', 'meta', 'base'],
      }),
    }
  } finally {
    DOMPurify.removeHook('uponSanitizeAttribute', preserveTrustedKatexLayout)
  }
}

/** Convert Mermaid's strict-mode HTML labels to plain SVG text before
 * sanitizing. This keeps labels visible in WebView, canvas, HTML, and PDF
 * exports without allowing foreignObject HTML into the trusted preview. */
export function sanitizeMermaidSvg(svg: string): string {
  const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml')
  parsed.querySelectorAll('foreignObject').forEach((foreignObject) => {
    const lines = (foreignObject.textContent ?? '')
      .split(/\n+/)
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
    const text = parsed.createElementNS('http://www.w3.org/2000/svg', 'text')
    const x = Number(foreignObject.getAttribute('x') ?? 0) + Number(foreignObject.getAttribute('width') ?? 0) / 2
    const y = Number(foreignObject.getAttribute('y') ?? 0) + Number(foreignObject.getAttribute('height') ?? 0) / 2
    text.setAttribute('x', String(x))
    text.setAttribute('y', String(y))
    text.setAttribute('text-anchor', 'middle')
    text.setAttribute('dominant-baseline', 'middle')
    text.setAttribute('class', 'nodeLabel')
    ;(lines.length ? lines : ['']).forEach((line, index) => {
      const tspan = parsed.createElementNS('http://www.w3.org/2000/svg', 'tspan')
      tspan.setAttribute('x', String(x))
      if (lines.length > 1) tspan.setAttribute('dy', index ? '1.1em' : `${-0.55 * (lines.length - 1)}em`)
      tspan.textContent = line
      text.append(tspan)
    })
    foreignObject.replaceWith(text)
  })
  return DOMPurify.sanitize(parsed.documentElement.outerHTML, { USE_PROFILES: { svg: true, svgFilters: true } })
}
