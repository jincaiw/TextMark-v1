import hljs from 'highlight.js/lib/core'
import type { LanguageFn } from 'highlight.js'

type LanguageModule = { default: LanguageFn }

const languageAliases: Record<string, string> = {
  'c++': 'cpp',
  csharp: 'csharp',
  compose: 'yaml',
  console: 'bash',
  docker: 'dockerfile',
  'docker-compose': 'yaml',
  docker_compose: 'yaml',
  html: 'xml',
  js: 'javascript',
  jsx: 'javascript',
  node: 'javascript',
  py: 'python',
  ps: 'powershell',
  ps1: 'powershell',
  shell: 'bash',
  sh: 'bash',
  svg: 'xml',
  terraform: 'hcl',
  tf: 'hcl',
  ts: 'typescript',
  tsx: 'typescript',
  xml: 'xml',
  yml: 'yaml',
  zsh: 'bash',
}

const languageLoaders: Record<string, () => Promise<LanguageModule>> = {
  bash: () => import('highlight.js/lib/languages/bash'),
  c: () => import('highlight.js/lib/languages/c'),
  cpp: () => import('highlight.js/lib/languages/cpp'),
  csharp: () => import('highlight.js/lib/languages/csharp'),
  css: () => import('highlight.js/lib/languages/css'),
  diff: () => import('highlight.js/lib/languages/diff'),
  dockerfile: () => import('highlight.js/lib/languages/dockerfile'),
  go: () => import('highlight.js/lib/languages/go'),
  graphql: () => import('highlight.js/lib/languages/graphql'),
  ini: () => import('highlight.js/lib/languages/ini'),
  java: () => import('highlight.js/lib/languages/java'),
  javascript: () => import('highlight.js/lib/languages/javascript'),
  json: () => import('highlight.js/lib/languages/json'),
  kotlin: () => import('highlight.js/lib/languages/kotlin'),
  markdown: () => import('highlight.js/lib/languages/markdown'),
  nginx: () => import('highlight.js/lib/languages/nginx'),
  php: () => import('highlight.js/lib/languages/php'),
  powershell: () => import('highlight.js/lib/languages/powershell'),
  python: () => import('highlight.js/lib/languages/python'),
  ruby: () => import('highlight.js/lib/languages/ruby'),
  rust: () => import('highlight.js/lib/languages/rust'),
  sql: () => import('highlight.js/lib/languages/sql'),
  swift: () => import('highlight.js/lib/languages/swift'),
  typescript: () => import('highlight.js/lib/languages/typescript'),
  xml: () => import('highlight.js/lib/languages/xml'),
  yaml: () => import('highlight.js/lib/languages/yaml'),
}

const hcl = (api: typeof hljs) => ({
  name: 'HCL',
  aliases: ['terraform', 'tf'],
  keywords: { keyword: 'resource data variable output module provider terraform locals dynamic for in if', literal: 'true false null' },
  contains: [
    api.COMMENT('#', '$'),
    api.COMMENT('//', '$'),
    api.COMMENT('/\\*', '\\*/'),
    api.QUOTE_STRING_MODE,
    api.NUMBER_MODE,
    { className: 'attr', begin: /[A-Za-z_][\w-]*(?=\s*=)/ },
  ],
})

const loadingLanguages = new Map<string, Promise<void>>()

export function normalizeHighlightLanguage(language: string): string {
  const normalized = language.trim().toLowerCase()
  return languageAliases[normalized] ?? normalized
}

async function loadLanguage(language: string): Promise<void> {
  const normalized = normalizeHighlightLanguage(language)
  if (!normalized || hljs.getLanguage(normalized)) return
  const pending = loadingLanguages.get(normalized)
  if (pending) return pending

  const load = async () => {
    if (normalized === 'hcl') {
      hljs.registerLanguage('hcl', hcl)
      return
    }
    const loader = languageLoaders[normalized]
    if (!loader) return
    const { default: definition } = await loader()
    hljs.registerLanguage(normalized, definition)
  }
  const promise = load().finally(() => loadingLanguages.delete(normalized))
  loadingLanguages.set(normalized, promise)
  return promise
}

/** Loads distinct requested grammars concurrently, keeping them out of the initial bundle. */
export async function prepareHighlightLanguages(languages: Iterable<string>): Promise<void> {
  await Promise.all([...new Set([...languages].map(normalizeHighlightLanguage))].map(loadLanguage))
}

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character,
  )

export function highlightCode(code: string, language: string) {
  const normalized = normalizeHighlightLanguage(language)
  return hljs.getLanguage(normalized) ? hljs.highlight(code, { language: normalized }).value : escapeHtml(code)
}
