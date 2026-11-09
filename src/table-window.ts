// preview-host.css carries the page shell and alignment classes; table-window
// restores upstream's reading-surface table treatment for the expanded table
// and adapts the page shell the way the upstream window does.
import './preview-host.css'
import './code-theme.css'
import './table-window.css'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { applyUpstreamDocumentTokens } from './lib/designTokens'
import { isTauri } from './lib/platform'
import { applyThemeColors } from './lib/theme'
import type { DocumentFont, ThemeColors, ThemePreset } from './types'

// Expanded-table window, mirroring the upstream TablePreviewWindow: a
// read-only snapshot of one table in its own ordinary window, Escape closes,
// and zooming here never touches the document's saved text size. The source
// is the already-sanitized table HTML from the trusted preview.
const parameters = new URLSearchParams(location.search)
const id = parameters.get('id') ?? ''
const locale = parameters.get('locale') === 'en' ? 'en' : 'zh-CN'
const root = document.querySelector<HTMLElement>('#table-root')!
document.documentElement.lang = locale
applyUpstreamDocumentTokens()

interface TablePayload {
  source: string
  documentFont?: DocumentFont
  themePreset?: ThemePreset
  themeColors?: ThemeColors
}

let payload: TablePayload | null = null
try {
  const raw = localStorage.getItem(`textmark.${id}`)
  if (raw) payload = JSON.parse(raw) as TablePayload
} catch {
  payload = null
}
window.addEventListener('beforeunload', () => localStorage.removeItem(`textmark.${id}`))

if (payload?.source) {
  const appearance = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  document.documentElement.dataset.theme = appearance
  applyUpstreamDocumentTokens(document.documentElement, payload.documentFont)
  applyThemeColors(document.documentElement, payload.themePreset ?? 'normal', appearance, payload.themeColors)
  // Upstream hands the popup the same rendered table the page shows, wrap and
  // all; the wrapper carries the end gap and the header's sticky mask.
  const wrap = document.createElement('div')
  wrap.className = 'md-table-wrap'
  wrap.innerHTML = payload.source
  root.replaceChildren(wrap)
} else {
  root.textContent = locale === 'zh-CN' ? '表格内容不可用。' : 'Table content is unavailable.'
}

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return
  // A Tauri webview is not script-opened, so window.close() alone is a no-op
  // here; the app's close command takes the ordinary window down.
  if (isTauri()) void getCurrentWindow().close()
  else window.close()
})
