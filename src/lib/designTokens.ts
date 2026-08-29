export const UPSTREAM_DOCUMENT_TOKENS = Object.freeze({
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
  fontSize: 15,
  lineHeight: 1.52,
  contentColumnWidth: 820,
  pagePaddingTop: 32,
  pagePaddingHorizontal: 40,
  pagePaddingBottom: 48,
  sourceLineHeight: 22.8,
  light: { text: '#1d1d1f', secondary: '#6e6e73', link: '#0066cc', fill: '#f5f5f7', grid: '#d2d2d7' },
  dark: { text: '#f5f5f7', secondary: '#86868b', link: '#2997ff', fill: '#2a2828', grid: '#424245' },
})

export const DOCUMENT_FONT_FAMILIES = {
  system: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
  serif: 'ui-serif, "New York", "Iowan Old Style", Georgia, serif',
  rounded: 'ui-rounded, "SF Pro Rounded", -apple-system, system-ui, sans-serif',
  monospace: 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace',
} as const

export type DocumentFontName = keyof typeof DOCUMENT_FONT_FAMILIES

export function applyUpstreamDocumentTokens(root: HTMLElement = document.documentElement, documentFont: DocumentFontName = 'system') {
  const tokens = UPSTREAM_DOCUMENT_TOKENS
  root.style.setProperty('--document-font-family', DOCUMENT_FONT_FAMILIES[documentFont])
  root.style.setProperty('--document-code-font-size', documentFont === 'serif' ? '0.84em' : documentFont === 'monospace' ? '1em' : '0.88em')
  root.style.setProperty('--document-font-size', `${tokens.fontSize}px`)
  root.style.setProperty('--document-line-height', String(tokens.lineHeight))
  root.style.setProperty('--document-column-width', `${tokens.contentColumnWidth}px`)
  root.style.setProperty(
    '--document-page-padding',
    `${tokens.pagePaddingTop}px ${tokens.pagePaddingHorizontal}px ${tokens.pagePaddingBottom}px`,
  )
  root.style.setProperty('--document-source-line-height', `${tokens.sourceLineHeight}px`)
}
