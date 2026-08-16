import DOMPurify from 'dompurify'
import './preview-host.css'
import { renderMarkdownEnhanced } from './lib/markdown'
import type { Locale, ThemeMode } from './types'
import { applyUpstreamDocumentTokens } from './lib/designTokens'
import { loadOptionalRendererStyles } from './lib/optionalStyles'

export interface PreviewRequest {
  source: string
  locale?: Locale
  appearance?: ThemeMode
  assets?: Record<string, string>
}

const root = document.querySelector<HTMLElement>('#preview')!
applyUpstreamDocumentTokens()

async function hydrateMermaid() {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>('.mermaid[data-mermaid-source]'))
  if (!nodes.length) return
  const { default: mermaid } = await import('mermaid')
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'neutral',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
  })
  await Promise.all(
    nodes.map(async (node, index) => {
      try {
        const source = decodeURIComponent(node.dataset.mermaidSource ?? '')
        const { svg } = await mermaid.render(`textmark-system-preview-${index}`, source)
        node.innerHTML = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } })
      } catch {
        node.textContent = document.documentElement.lang === 'zh-CN' ? '无法渲染 Mermaid 图表。' : 'Unable to render Mermaid diagram.'
      }
    }),
  )
}

export async function renderPreview(request: PreviewRequest) {
  const locale = request.locale === 'en' ? 'en' : 'zh-CN'
  const appearance =
    request.appearance === 'dark'
      ? 'dark'
      : request.appearance === 'light'
        ? 'light'
        : matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
  document.documentElement.lang = locale
  document.documentElement.dataset.theme = appearance
  const result = await renderMarkdownEnhanced(request.source, locale)
  await loadOptionalRendererStyles(result.optionalRenderers)
  root.dir = result.direction
  root.innerHTML = result.html
  root.querySelectorAll<HTMLImageElement>('img[data-local-src]').forEach((image) => {
    const source = image.dataset.localSrc ?? ''
    const resolved = request.assets?.[source]
    if (resolved) image.src = resolved
    else image.classList.add('asset-error')
  })
  await hydrateMermaid()
  return { outline: result.outline, optionalRenderers: result.optionalRenderers }
}

declare global {
  interface Window {
    TextMarkPreview: { render: typeof renderPreview }
  }
}

window.TextMarkPreview = { render: renderPreview }
window.addEventListener('message', (event: MessageEvent<PreviewRequest>) => {
  if (event.data && typeof event.data.source === 'string') void renderPreview(event.data)
})
document.dispatchEvent(new CustomEvent('textmark-preview-ready'))
