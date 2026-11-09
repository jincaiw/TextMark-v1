export const UPSTREAM_DOCUMENT_TOKENS = Object.freeze({
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
  fontSize: 15,
  lineHeight: 1.6,
  pageColumnWidth: 900,
  contentColumnWidth: 820,
  pagePaddingTop: 32,
  pagePaddingHorizontal: 40,
  pagePaddingBottom: 48,
  /** Upstream's app-only breathing room above the document: 8pt above the
   * floating 28pt pills, then 2pt before the page, less the padding already
   * there, less the half point WebKit lands the page low against the
   * reference's first heading row. Exports do not carry it, so the PDF keeps
   * the 32pt page. */
  appPageTopClearance: 5.5,
  sourceLineHeight: 24,
  light: { text: '#1d1d1f', secondary: '#6e6e73', link: '#0066cc', fill: '#f5f5f7', grid: '#d2d2d7' },
  dark: { text: '#f5f5f7', secondary: '#86868b', link: '#2997ff', fill: '#2a2828', grid: '#424245' },
})

/** The upstream curated reading faces. Every stack ends in a generic family so
 * the OS per-script cascade can still pick a face for CJK text. */
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
  monospace: 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace',
} as const

export type DocumentFontName = keyof typeof DOCUMENT_FONT_FAMILIES

/** Upstream ReaderLayoutSetting ranges and the stylesheet's tuned default.
 * `defaultLineSpacing` is `MarkdownHTML.bodyLineHeight`, so an un-customized
 * profile renders at the 1.6 the reference uses. */
export const READER_LAYOUT_DEFAULTS = Object.freeze({
  boldText: false,
  isCustomized: false,
  lineSpacing: 1.6,
  characterSpacingPercent: 0,
  wordSpacingPercent: 0,
  marginsPercent: 0,
})
export const READER_LAYOUT_RANGES = Object.freeze({
  lineSpacing: { min: 1.0, max: 2.0, step: 0.01 },
  characterSpacingPercent: { min: -5, max: 12, step: 0.5 },
  wordSpacingPercent: { min: -10, max: 25, step: 0.5 },
  marginsPercent: { min: -100, max: 100, step: 1 },
} as const)

/** The margins slider is a symmetric percent of the base page padding; only
 * the positive side adds inset inside the reading column. */
export const readerPageInset = (marginsPercent: number) => Math.round(0.9 * Math.max(0, marginsPercent))

/** CSS custom-property declarations for the page :root, upstream
 * ReaderLayoutSetting.cssVariables. Empty when nothing differs from the
 * stylesheet's tuned defaults, so the page renders exactly as before. */
export function readerLayoutCss(layout: {
  boldText: boolean
  isCustomized: boolean
  lineSpacing: number
  characterSpacingPercent: number
  wordSpacingPercent: number
  marginsPercent: number
}): string {
  const applied = layout.isCustomized
    ? layout
    : { ...layout, lineSpacing: READER_LAYOUT_DEFAULTS.lineSpacing, characterSpacingPercent: 0, wordSpacingPercent: 0, marginsPercent: 0 }
  const lines: string[] = []
  if (applied.boldText) lines.push('--mdp-body-weight: 600;')
  if (applied.lineSpacing !== READER_LAYOUT_DEFAULTS.lineSpacing) lines.push(`--mdp-line-height: ${applied.lineSpacing.toFixed(3)};`)
  if (applied.characterSpacingPercent !== 0) lines.push(`--mdp-letter-spacing: ${(applied.characterSpacingPercent / 100).toFixed(3)}em;`)
  if (applied.wordSpacingPercent !== 0) lines.push(`--mdp-word-spacing: ${(applied.wordSpacingPercent / 100).toFixed(3)}em;`)
  if (applied.marginsPercent !== 0) {
    lines.push(`--mdp-page-inset: ${readerPageInset(applied.marginsPercent)}px;`)
    lines.push(`--mdp-page-padding: ${Math.round(40 * (1 + Math.min(0, applied.marginsPercent) / 100))}px;`)
  }
  return lines.join('\n')
}

/** User-tunable reading typography. Anything omitted falls back to the frozen
 * upstream token so the default profile renders exactly like the reference. */
export interface DocumentTokenOverrides {
  lineHeight?: number
  pagePaddingHorizontal?: number
}

export function applyUpstreamDocumentTokens(
  root: HTMLElement = document.documentElement,
  documentFont: DocumentFontName = 'system',
  overrides: DocumentTokenOverrides = {},
) {
  const tokens = UPSTREAM_DOCUMENT_TOKENS
  const lineHeight = Number.isFinite(overrides.lineHeight) ? Number(overrides.lineHeight) : tokens.lineHeight
  const pagePaddingHorizontal = Number.isFinite(overrides.pagePaddingHorizontal)
    ? Number(overrides.pagePaddingHorizontal)
    : tokens.pagePaddingHorizontal
  root.style.setProperty('--document-font-family', DOCUMENT_FONT_FAMILIES[documentFont])
  root.style.setProperty(
    '--document-code-font-size',
    documentFont === 'monospace'
      ? '1em'
      : ['athelas', 'charter', 'georgia', 'iowan', 'newYork', 'palatino', 'timesNewRoman'].includes(documentFont)
        ? '0.86em'
        : '0.9em',
  )
  root.style.setProperty('--document-font-size', `${tokens.fontSize}px`)
  root.style.setProperty('--document-line-height', String(lineHeight))
  root.style.setProperty('--document-page-width', `${tokens.pageColumnWidth}px`)
  root.style.setProperty('--document-column-width', `${tokens.contentColumnWidth}px`)
  root.style.setProperty('--document-page-padding-horizontal', `${pagePaddingHorizontal}px`)
  root.style.setProperty('--document-page-padding-top', `${tokens.pagePaddingTop}px`)
  root.style.setProperty('--document-page-padding', `${tokens.pagePaddingTop}px ${pagePaddingHorizontal}px ${tokens.pagePaddingBottom}px`)
  root.style.setProperty('--mdp-page-top-clearance', `${tokens.appPageTopClearance}px`)
  // The spacer that stands in for a source blank line is one text line tall.
  // Deriving it keeps the preview's vertical rhythm in step when the reading
  // line height changes; at the upstream 15px/1.6 it is the frozen 24px.
  root.style.setProperty('--document-source-line-height', `${Number((tokens.fontSize * lineHeight).toFixed(2))}px`)
}
