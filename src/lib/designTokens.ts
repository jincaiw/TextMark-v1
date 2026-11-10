export const UPSTREAM_DOCUMENT_TOKENS = Object.freeze({
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
  fontSize: 15,
  lineHeight: 1.6,
  pageColumnWidth: 900,
  contentColumnWidth: 820,
  pagePaddingTop: 32,
  pagePaddingHorizontal: 40,
  pagePaddingBottom: 48,
  sourceLineHeight: 24,
  light: { text: '#1d1d1f', secondary: '#6e6e73', link: '#0066cc', fill: '#f5f5f7', grid: '#d2d2d7' },
  dark: { text: '#f5f5f7', secondary: '#86868b', link: '#2997ff', fill: '#2a2828', grid: '#424245' },
})

/** The upstream reading faces (DocumentFontSetting): a curated Apple
 * Books-style list. Each stack ends in a generic family so the per-script
 * cascade can still pick a face for CJK text the named fonts don't cover. */
export const DOCUMENT_FONT_FAMILIES = {
  system: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
  athelas: 'Athelas, ui-serif, Georgia, serif',
  avenirNext: '"Avenir Next", Avenir, -apple-system, system-ui, sans-serif',
  charter: 'Charter, ui-serif, Georgia, serif',
  georgia: 'Georgia, ui-serif, serif',
  iowan: '"Iowan Old Style", ui-serif, Georgia, serif',
  newYork: 'ui-serif, "New York", "Iowan Old Style", Georgia, serif',
  palatino: 'Palatino, "Palatino Linotype", ui-serif, Georgia, serif',
  rounded: 'ui-rounded, "SF Pro Rounded", -apple-system, system-ui, sans-serif',
  seravek: 'Seravek, -apple-system, system-ui, sans-serif',
  timesNewRoman: '"Times New Roman", Times, serif',
  monospace: 'ui-monospace, "SF Mono", Menlo, monospace',
} as const

export type DocumentFontName = keyof typeof DOCUMENT_FONT_FAMILIES

const SERIF_FONTS = new Set<DocumentFontName>(['athelas', 'charter', 'georgia', 'iowan', 'newYork', 'palatino', 'timesNewRoman'])

export function isSerifFont(font: DocumentFontName): boolean {
  return SERIF_FONTS.has(font)
}

/** Code stays monospaced whatever the document font is; only its size moves —
 * 0.9em is tuned against the system face's x-height, so a serif takes 0.86em
 * and a monospace document takes 1em (upstream DocumentFontSetting.codeFontSize). */
export function documentCodeFontSize(font: DocumentFontName): string {
  if (font === 'monospace') return '1em'
  return isSerifFont(font) ? '0.86em' : '0.9em'
}

/** User-tunable reading typography. Anything omitted falls back to the frozen
 * upstream token so the default profile renders exactly like the reference. */
export interface DocumentTokenOverrides {
  lineHeight?: number
  pagePaddingHorizontal?: number
  /** Reader-layout preferences from the Customize Theme panel. The spacing
   * sliders apply only while `readerCustomized` is true (upstream gates them
   * the same way); Bold Text is not gated. */
  boldText?: boolean
  readerCustomized?: boolean
  characterSpacingPercent?: number
  wordSpacingPercent?: number
  marginsPercent?: number
}

export function applyUpstreamDocumentTokens(
  root: HTMLElement = document.documentElement,
  documentFont: DocumentFontName = 'system',
  overrides: DocumentTokenOverrides = {},
) {
  const tokens = UPSTREAM_DOCUMENT_TOKENS
  const customized = overrides.readerCustomized === true
  const lineHeight = Number.isFinite(overrides.lineHeight) ? Number(overrides.lineHeight) : tokens.lineHeight
  const pagePaddingHorizontal = Number.isFinite(overrides.pagePaddingHorizontal)
    ? Number(overrides.pagePaddingHorizontal)
    : tokens.pagePaddingHorizontal
  const characterSpacingPercent = customized ? clamp(overrides.characterSpacingPercent ?? 0, -5, 12) : 0
  const wordSpacingPercent = customized ? clamp(overrides.wordSpacingPercent ?? 0, -10, 25) : 0
  const marginsPercent = customized ? clamp(overrides.marginsPercent ?? 0, -100, 100) : 0
  root.style.setProperty('--document-font-family', DOCUMENT_FONT_FAMILIES[documentFont])
  root.style.setProperty('--document-code-font-size', documentCodeFontSize(documentFont))
  root.style.setProperty('--document-font-size', `${tokens.fontSize}px`)
  root.style.setProperty('--document-font-weight', overrides.boldText ? '600' : '400')
  root.style.setProperty('--document-line-height', String(lineHeight))
  root.style.setProperty('--document-letter-spacing', characterSpacingPercent ? `${characterSpacingPercent / 100}em` : 'normal')
  root.style.setProperty('--document-word-spacing', wordSpacingPercent ? `${wordSpacingPercent / 100}em` : 'normal')
  root.style.setProperty('--document-page-width', `${tokens.pageColumnWidth}px`)
  root.style.setProperty('--document-column-width', `${tokens.contentColumnWidth}px`)
  root.style.setProperty('--document-page-padding-horizontal', `${pagePaddingHorizontal}px`)
  root.style.setProperty('--document-page-padding', `${tokens.pagePaddingTop}px ${pagePaddingHorizontal}px ${tokens.pagePaddingBottom}px`)
  // The reader margins slider: a symmetric inset inside the reading column, so
  // it holds in every content-width mode instead of fighting the column measure
  // (upstream ReaderLayoutSetting.pageInset). Negative margins shrink the body
  // padding toward its floor of zero instead.
  const pageInset = Math.round(0.9 * Math.max(0, marginsPercent))
  root.style.setProperty('--document-page-inset', `${pageInset}px`)
  const scaledPadding = marginsPercent < 0 ? pagePaddingHorizontal * (1 + marginsPercent / 100) : pagePaddingHorizontal
  root.style.setProperty('--document-page-padding-horizontal', `${Math.max(0, scaledPadding)}px`)
  root.style.setProperty(
    '--document-page-padding',
    `${tokens.pagePaddingTop}px ${Math.max(0, scaledPadding)}px ${tokens.pagePaddingBottom}px`,
  )
  // The spacer that stands in for a source blank line is one text line tall.
  // Deriving it keeps the preview's vertical rhythm in step when the reading
  // line height changes.
  root.style.setProperty('--document-source-line-height', `${Number((tokens.fontSize * lineHeight).toFixed(2))}px`)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0))
}
