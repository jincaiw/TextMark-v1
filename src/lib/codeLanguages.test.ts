import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  RECENT_LIMIT,
  RECENT_STORAGE_KEY,
  allLanguages,
  commonLanguages,
  matchingLanguages,
  recentLanguages,
  rememberLanguage,
} from './codeLanguages'

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** Minimal in-memory Storage: this jsdom build does not expose a usable localStorage global. */
function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  }
}

describe('code language catalog', () => {
  it('contains the full upstream catalog in upstream order', () => {
    expect(allLanguages).toHaveLength(22)
    expect(allLanguages.map((language) => language.id)).toEqual([
      'bash',
      'c',
      'csharp',
      'cpp',
      'css',
      'go',
      'hcl',
      'html',
      'java',
      'javascript',
      'json',
      'kotlin',
      'objective-c',
      'text',
      'python',
      'ruby',
      'rust',
      'sql',
      'swift',
      'toml',
      'typescript',
      'yaml',
    ])
    expect(allLanguages.map((language) => language.name)).toEqual([
      'Bash',
      'C',
      'C#',
      'C++',
      'CSS',
      'Go',
      'HCL',
      'HTML',
      'Java',
      'JavaScript',
      'JSON',
      'Kotlin',
      'Objective-C',
      'Plain Text',
      'Python',
      'Ruby',
      'Rust',
      'SQL',
      'Swift',
      'TOML',
      'TypeScript',
      'YAML',
    ])
  })

  it('keeps every entry shaped as {id, name, glyph}', () => {
    for (const language of allLanguages) {
      expect(Object.keys(language).sort()).toEqual(['glyph', 'id', 'name'])
      expect(language.glyph.length).toBeGreaterThan(0)
    }
  })

  it('exposes the upstream common subset in upstream order, all drawn from the catalog', () => {
    expect(commonLanguages.map((language) => language.id)).toEqual([
      'swift',
      'objective-c',
      'c',
      'cpp',
      'python',
      'javascript',
      'bash',
      'json',
      'html',
    ])
    const catalogIDs = new Set(allLanguages.map((language) => language.id))
    expect(commonLanguages.every((language) => catalogIDs.has(language.id))).toBe(true)
  })
})

describe('matchingLanguages', () => {
  it('returns [] for an empty or whitespace-only query', () => {
    expect(matchingLanguages('')).toEqual([])
    expect(matchingLanguages('   ')).toEqual([])
    expect(matchingLanguages('\n\t')).toEqual([])
  })

  it('matches names case-insensitively', () => {
    expect(matchingLanguages('pyThOn').map((language) => language.id)).toEqual(['python'])
    expect(matchingLanguages('swift').map((language) => language.id)).toEqual(['swift'])
  })

  it('matches ids case-insensitively', () => {
    expect(matchingLanguages('objective-c').map((language) => language.id)).toEqual(['objective-c'])
    expect(matchingLanguages('OBJECTIVE-C').map((language) => language.id)).toEqual(['objective-c'])
  })

  it('matches aliases, including the upstream shorthand', () => {
    expect(matchingLanguages('golang').map((language) => language.id)).toEqual(['go'])
    expect(matchingLanguages('tsx').map((language) => language.id)).toEqual(['typescript'])
    expect(matchingLanguages('terraform').map((language) => language.id)).toEqual(['hcl'])
  })

  it('trims surrounding whitespace before matching', () => {
    expect(matchingLanguages('  rust  ').map((language) => language.id)).toEqual(['rust'])
  })

  it('preserves catalog order when several languages match', () => {
    expect(matchingLanguages('script').map((language) => language.id)).toEqual(['javascript', 'typescript'])
    expect(matchingLanguages('java').map((language) => language.id)).toEqual(['java', 'javascript'])
  })

  it('returns [] when nothing matches', () => {
    expect(matchingLanguages('cobol')).toEqual([])
    expect(matchingLanguages('zzzz')).toEqual([])
  })
})

describe('recentLanguages', () => {
  it('returns [] when nothing has been remembered', () => {
    expect(recentLanguages()).toEqual([])
  })

  it('stores and returns remembered languages most-recent-first', () => {
    rememberLanguage('python')
    rememberLanguage('rust')
    rememberLanguage('swift')
    expect(recentLanguages().map((language) => language.id)).toEqual(['swift', 'rust', 'python'])
  })

  it('moves a repeated language to the front instead of duplicating it', () => {
    rememberLanguage('python')
    rememberLanguage('rust')
    rememberLanguage('python')
    expect(recentLanguages().map((language) => language.id)).toEqual(['python', 'rust'])
  })

  it(`caps recents at ${RECENT_LIMIT}`, () => {
    for (const id of ['bash', 'c', 'go', 'java', 'ruby', 'rust', 'yaml']) rememberLanguage(id)
    const recents = recentLanguages()
    expect(recents).toHaveLength(RECENT_LIMIT)
    expect(recents.map((language) => language.id)).toEqual(['yaml', 'rust', 'ruby', 'java', 'go'])
  })

  it('ignores unknown ids', () => {
    rememberLanguage('cobol')
    expect(recentLanguages()).toEqual([])
    expect(localStorage.getItem(RECENT_STORAGE_KEY)).toBeNull()
  })

  it('persists ids under the documented storage key', () => {
    rememberLanguage('python')
    expect(JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY) ?? 'null')).toEqual(['python'])
  })

  it('drops stale or duplicate ids read from storage', () => {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(['cobol', 'python', 'python', 'rust']))
    expect(recentLanguages().map((language) => language.id)).toEqual(['python', 'rust'])
  })

  it('returns [] when stored JSON is malformed', () => {
    localStorage.setItem(RECENT_STORAGE_KEY, '{not json')
    expect(recentLanguages()).toEqual([])
  })

  it('degrades gracefully when localStorage.getItem throws', () => {
    vi.stubGlobal('localStorage', {
      ...memoryStorage(),
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError')
      },
    })
    expect(recentLanguages()).toEqual([])
  })

  it('degrades gracefully when localStorage.setItem throws', () => {
    vi.stubGlobal('localStorage', {
      ...memoryStorage(),
      setItem: () => {
        throw new DOMException('quota exceeded', 'QuotaExceededError')
      },
    })
    expect(() => rememberLanguage('python')).not.toThrow()
    expect(recentLanguages()).toEqual([])
  })
})
