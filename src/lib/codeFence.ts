export interface CodeFenceInfo {
  language: string
  metadata: string
  highlightLanguage: string
}

export function parseCodeFenceInfo(raw: string | null | undefined): CodeFenceInfo {
  const trimmed = raw?.trim() ?? ''
  const split = trimmed.search(/\s/u)
  const language = (split < 0 ? trimmed : trimmed.slice(0, split)).toLowerCase()
  const metadata = split < 0 ? '' : trimmed.slice(split).trim()
  const highlightLanguage = ['shell', 'sh', 'zsh', 'console'].includes(language) ? 'bash' : language
  return { language, metadata, highlightLanguage }
}
