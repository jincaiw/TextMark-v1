export const externalMenuUrls = {
  'project-home': 'https://github.com/jincaiw/TextMark-v1',
  'github-releases': 'https://github.com/jincaiw/TextMark-v1/releases',
  'report-issue': 'https://github.com/jincaiw/TextMark-v1/issues/new',
} as const

export type ExternalMenuCommand = keyof typeof externalMenuUrls

export function externalMenuUrl(command: string): string | undefined {
  return externalMenuUrls[command as ExternalMenuCommand]
}
