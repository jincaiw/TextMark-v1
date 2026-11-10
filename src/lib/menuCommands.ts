export const externalMenuUrls = {
  'project-home': 'https://github.com/jincaiw/TextMark-v1',
  'github-releases': 'https://github.com/jincaiw/TextMark-v1/releases',
  'release-notes': 'https://github.com/jincaiw/TextMark-v1/releases',
  'report-issue': 'https://github.com/jincaiw/TextMark-v1/issues/new',
} as const

export type ExternalMenuCommand = keyof typeof externalMenuUrls

export function externalMenuUrl(command: string): string | undefined {
  return externalMenuUrls[command as ExternalMenuCommand]
}

/** The tab a ⌘1–⌘9 shortcut selects, Safari-style: ⌘1–⌘8 pick that tab when it
 * exists, ⌘9 always picks the last one. Returns null when there is no such tab. */
export function tabIndexForShortcut(key: string, tabCount: number): number | null {
  if (tabCount <= 0) return null
  if (key === '9') return tabCount - 1
  const digit = Number(key)
  if (!Number.isInteger(digit) || digit < 1 || digit > 8) return null
  const index = digit - 1
  return index < tabCount ? index : null
}
