// Code-language catalog for the floating format bar's "Code Block" picker.
// Port of upstream `CodeLanguageCatalog` (md-preview v0.0.71). The upstream
// list is sorted with `localizedStandardCompare` (case-insensitive, locale
// aware); that order is reproduced literally below because it is not plain
// code-unit order (e.g. "C#" < "C++" < "CSS", "SQL" < "Swift").

export interface CodeLanguageOption {
  id: string
  name: string
  glyph: string
}

interface CatalogEntry extends CodeLanguageOption {
  /** Extra fence names accepted by the filter, mirroring upstream `aliases`. */
  aliases: string
}

/**
 * Upstream `CodeLanguageCatalog.all`, already in sorted order.
 *
 * Glyphs are monospaced text for the web UI. Upstream renders `swift` and
 * `bash` as SF Symbols (`swift`, `terminal`) and leaves the Swift glyph empty;
 * "Sw" is the short text fallback used here. Bash keeps its upstream "$".
 */
const CATALOG: readonly CatalogEntry[] = [
  { id: 'bash', name: 'Bash', glyph: '$', aliases: 'shell sh zsh console' },
  { id: 'c', name: 'C', glyph: 'C', aliases: 'h' },
  { id: 'csharp', name: 'C#', glyph: 'C#', aliases: 'cs' },
  { id: 'cpp', name: 'C++', glyph: 'C⁺⁺', aliases: 'cc hpp' },
  { id: 'css', name: 'CSS', glyph: '#', aliases: 'scss' },
  { id: 'go', name: 'Go', glyph: 'Go', aliases: 'golang' },
  { id: 'hcl', name: 'HCL', glyph: '{}', aliases: 'terraform tf' },
  { id: 'html', name: 'HTML', glyph: '<>', aliases: 'htm xml' },
  { id: 'java', name: 'Java', glyph: 'J', aliases: '' },
  { id: 'javascript', name: 'JavaScript', glyph: 'JS', aliases: 'js jsx node' },
  { id: 'json', name: 'JSON', glyph: '{}', aliases: 'jsonc' },
  { id: 'kotlin', name: 'Kotlin', glyph: 'K', aliases: 'kt' },
  { id: 'objective-c', name: 'Objective-C', glyph: 'm', aliases: 'objc objectivec' },
  { id: 'text', name: 'Plain Text', glyph: '¶', aliases: 'txt plaintext' },
  { id: 'python', name: 'Python', glyph: 'Py', aliases: 'py' },
  { id: 'ruby', name: 'Ruby', glyph: 'Rb', aliases: 'rb' },
  { id: 'rust', name: 'Rust', glyph: 'Rs', aliases: 'rs' },
  { id: 'sql', name: 'SQL', glyph: 'SQL', aliases: '' },
  { id: 'swift', name: 'Swift', glyph: 'Sw', aliases: '' },
  { id: 'toml', name: 'TOML', glyph: 'T', aliases: '' },
  { id: 'typescript', name: 'TypeScript', glyph: 'TS', aliases: 'ts tsx' },
  { id: 'yaml', name: 'YAML', glyph: 'Y', aliases: 'yml' },
]

const entriesById = new Map(CATALOG.map((entry) => [entry.id, entry]))

/** Dedupes ids, drops unknown ones, preserves the input order. */
function resolveOptions(ids: readonly string[]): CodeLanguageOption[] {
  const seen = new Set<string>()
  const options: CodeLanguageOption[] = []
  for (const id of ids) {
    if (seen.has(id)) continue
    seen.add(id)
    const entry = entriesById.get(id)
    if (entry) options.push({ id: entry.id, name: entry.name, glyph: entry.glyph })
  }
  return options
}

/** Full catalog, in upstream order. */
export const allLanguages: CodeLanguageOption[] = CATALOG.map(({ id, name, glyph }) => ({ id, name, glyph }))

/** Upstream `commonIDs`, resolved in that order (the picker's "Common" section). */
const COMMON_IDS = ['swift', 'objective-c', 'c', 'cpp', 'python', 'javascript', 'bash', 'json', 'html'] as const

/** The common subset, in upstream `commonIDs` order. */
export const commonLanguages: CodeLanguageOption[] = resolveOptions(COMMON_IDS)

/** localStorage key holding recent language ids (upstream `recentKey` namespaced for TextMark). */
export const RECENT_STORAGE_KEY = 'textmark.recentCodeLanguages'

/** Upstream caps recents at 5. */
export const RECENT_LIMIT = 5

/**
 * Case-insensitive filter over name, id and aliases, in catalog order.
 * An empty or whitespace-only query returns [] (the caller renders the
 * Recent/Common/All sections for the blank case).
 */
export function matchingLanguages(query: string): CodeLanguageOption[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return []
  return allLanguages.filter((language) => {
    const entry = entriesById.get(language.id)
    return entry !== undefined && `${entry.name} ${entry.id} ${entry.aliases}`.toLowerCase().includes(needle)
  })
}

function readRecentIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is string => typeof value === 'string')
  } catch {
    // Private window, blocked storage, or malformed JSON: degrade to no recents.
    return []
  }
}

/** Most-recent-first, deduped, capped at RECENT_LIMIT, resolved against the catalog. */
export function recentLanguages(): CodeLanguageOption[] {
  const seen = new Set<string>()
  const ids: string[] = []
  for (const id of readRecentIds()) {
    if (seen.has(id)) continue
    seen.add(id)
    if (entriesById.has(id)) ids.push(id)
    if (ids.length === RECENT_LIMIT) break
  }
  return resolveOptions(ids)
}

/** Moves a known language id to the front of recents, dedupes, caps and persists. */
export function rememberLanguage(id: string): void {
  if (!entriesById.has(id)) return
  const ids = [
    id,
    ...recentLanguages()
      .map((language) => language.id)
      .filter((recent) => recent !== id),
  ].slice(0, RECENT_LIMIT)
  try {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // Storage unavailable: recents simply do not persist.
  }
}
