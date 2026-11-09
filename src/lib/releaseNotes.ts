// Ported from Markdown Preview's ReleaseNotesFormatter: a release body is a
// CHANGELOG.md entry — an intro, then `### Added`/`### Changed`/`### Fixed`
// lists of `**Title.** Text ([#1](…)).` bullets and a `### Contributors`
// list. Items are parsed into title, text and issue/pr links; releases are
// selected by numeric version comparison between the reader's previous and
// current versions.

export interface ReleaseItem {
  title: string | null
  text: string
  /** Pull request and issue links, as Markdown. */
  links: string[]
}

export interface ReleaseEntry {
  intro: string
  items: ReleaseItem[]
  /** Contributor links, as Markdown. */
  contributors: string[]
}

export interface Release {
  version: string
  /** The GitHub release name, when the CHANGELOG heading has one. */
  name: string | null
  /** ISO date. */
  date: string
  body: string
}

export const RELEASES_WEB_URL = 'https://github.com/jincaiw/TextMark-v1/releases'
const RELEASES_API_URL = 'https://api.github.com/repos/jincaiw/TextMark-v1/releases?per_page=100'

/** `**Title.**` or `**Title**` at the start of a bullet. */
const BOLD_TITLE = /^\*\*(.+?)\*\*/
/** ` ([#1](…), [#2](…)).` at the end of a bullet. */
const TRAILING_LINKS = /\s*\((?:\[#\d+\]\([^)\s]+\)(?:,\s*)?)+\)\.?\s*$/
const ISSUE_LINK = /\[#\d+\]\([^)\s]+\)/g
const CONTRIBUTOR_LINK = /\[@[^\]]+\]\([^)\s]+\)/g

/** Numeric comparison like upstream `compare(_:options:.numeric)`: 0.0.10 sorts
 * after 0.0.9, and "0.10" sorts after "0.9" even though "9" > "10" lexically. */
export function numericCompare(left: string, right: string): number {
  const toParts = (value: string) => value.split('.').map((part) => Number.parseInt(part, 10) || 0)
  const a = toParts(left)
  const b = toParts(right)
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const part = (a[index] ?? 0) - (b[index] ?? 0)
    if (part !== 0) return part < 0 ? -1 : 1
  }
  return 0
}

export function parseReleaseEntry(body: string): ReleaseEntry {
  const intro: string[] = []
  const items: ReleaseItem[] = []
  const contributors: string[] = []
  let section: string | null = null
  let bullet: string | null = null
  // Upstream drops prose under a heading ("Thank you to …"). This repo's
  // releases, however, open with a title heading followed by the summary
  // prose, so prose under the FIRST heading — until the first bullet or the
  // next heading — is kept as the intro; later sections behave as upstream.
  let firstHeadingSeen = false
  let introAllowed = true

  const finishBullet = () => {
    if (bullet === null) return
    const text = bullet
    bullet = null
    if (section === 'contributors') {
      contributors.push(...(text.match(CONTRIBUTOR_LINK) ?? []))
    } else {
      items.push(parseItem(text))
    }
  }

  for (const line of body.replace(/\r\n/g, '\n').split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('#')) {
      finishBullet()
      section = trimmed.replace(/^#+/, '').trim().toLowerCase()
      if (firstHeadingSeen) introAllowed = false
      firstHeadingSeen = true
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      finishBullet()
      bullet = trimmed.slice(2)
      introAllowed = false
    } else if (trimmed === '') {
      finishBullet()
    } else if (bullet !== null) {
      bullet += ` ${trimmed}`
    } else if (section === null || introAllowed) {
      intro.push(trimmed)
    }
    // Later prose under a heading ("Thank you to …") is dropped.
  }
  finishBullet()
  return { intro: intro.join(' '), items, contributors }
}

function parseItem(bullet: string): ReleaseItem {
  let text = bullet
  let title: string | null = null
  const titleMatch = text.match(BOLD_TITLE)
  if (titleMatch) {
    title = titleMatch[1].replace(/^[.\s]+|[.\s]+$/g, '')
    text = text.slice(titleMatch[0].length).trim()
  }
  let links: string[] = []
  const linksMatch = text.match(TRAILING_LINKS)
  if (linksMatch) {
    links = linksMatch[0].match(ISSUE_LINK) ?? []
    text = text.slice(0, linksMatch.index).trim()
    if (text !== '' && !text.endsWith('.')) text += '.'
  }
  return { title, text, links }
}

/** The releases a reader who updated from `previousVersion` to
 * `currentVersion` has not seen: newer than the first, up to and including
 * the second. An unknown (empty) `previousVersion`, or one that is not older
 * — a rebuild of the same version — gives the current version alone. */
export function releasesAfter(releases: Release[], previousVersion: string, currentVersion: string): Release[] {
  const previousIsOlder = previousVersion !== '' && numericCompare(previousVersion, currentVersion) < 0
  return releases.filter((release) => {
    if (!previousIsOlder) return release.version === currentVersion
    return numericCompare(release.version, previousVersion) > 0 && numericCompare(release.version, currentVersion) <= 0
  })
}

/** The release title, or one made from the first item titles for releases
 * that predate titles. */
export function releaseTitle(release: Release, entry: ReleaseEntry): string {
  const name = release.name?.trim() ?? ''
  if (name !== '' && name !== `TextMark ${release.version}`) return name
  const titles = entry.items.flatMap((item) => (item.title ? [item.title] : []))
  if (titles.length === 0) return `TextMark ${release.version}`
  if (titles.length > 1 && titles[0].length + titles[1].length <= 48) return `${titles[0]}, ${titles[1]}`
  return titles[0]
}

/** How many link pills an item shows before a "+N" pill. */
export const VISIBLE_LINK_COUNT = 4

/** The releases to offer for an update from `previousVersion` to the running
 * version, fetched from GitHub. Drafts, prereleases and tags without the `v`
 * prefix are dropped, as upstream does; the list is newest first. */
export async function fetchReleases(fetchImpl: typeof fetch = fetch): Promise<Release[]> {
  const response = await fetchImpl(RELEASES_API_URL, {
    headers: { Accept: 'application/vnd.github+json' },
  })
  if (!response.ok) throw new Error(`release_notes_http_${response.status}`)
  const payload: unknown = await response.json()
  if (!Array.isArray(payload)) throw new Error('release_notes_payload')
  return payload.flatMap((value) => {
    if (typeof value !== 'object' || value === null) return []
    const release = value as Record<string, unknown>
    if (release.draft === true || release.prerelease === true) return []
    if (typeof release.tag_name !== 'string' || !release.tag_name.startsWith('v')) return []
    if (typeof release.published_at !== 'string') return []
    const name = typeof release.name === 'string' && release.name.trim() !== '' ? release.name : null
    return [
      {
        version: release.tag_name.slice(1),
        name,
        date: release.published_at,
        body: typeof release.body === 'string' ? release.body : '',
      },
    ]
  })
}
