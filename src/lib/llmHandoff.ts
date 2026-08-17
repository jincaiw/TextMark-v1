import { t } from './i18n'
import { parentDirectory } from './platform'
import type { Locale } from '../types'

export type LlmTarget = 'codex' | 'claude' | 'chatgpt'
export type LlmHandoffKind = 'deep-link' | 'copy'

export interface LlmHandoff {
  /** Deep link to open; null means the caller opens the plain scheme. */
  url: string | null
  /** Text that is placed on the clipboard before opening. */
  clipboard: string
  kind: LlmHandoffKind
  /** True when the clipboard holds the full document (long-document fallback). */
  long: boolean
}

/** Matches the upstream (markdown-preview) 12,000-character deep-link cap. */
export const LLM_DEEP_LINK_LIMIT = 12_000

export interface LlmHandoffInput {
  target: LlmTarget
  path: string | null
  contents: string
  folder: string | null
  name: string
  locale: Locale
}

const reviewPrompt = (locale: Locale, contents: string) =>
  locale === 'zh-CN'
    ? `请审阅此 Markdown 文档：

${contents}`
    : `Please review this Markdown document:

${contents}`

/**
 * Builds an "Open in LLM" handoff mirroring the upstream deep links:
 * - Codex: codex://new?prompt=<path prompt>&path=<folder>
 * - Claude: claude://code/new?q=<embedded markdown prompt>&folder=<folder>,
 *   falling back to copy-and-open when the prompt exceeds the deep-link cap
 *   or the document has no on-disk path/folder context.
 * - ChatGPT keeps the plain copy-and-open behavior (the upstream uses a
 *   macOS-only AppleScript event that cannot be replicated cross-platform).
 */
export function buildLlmHandoff(input: LlmHandoffInput): LlmHandoff {
  const { target, path, contents, name, locale } = input
  const long = contents.length > LLM_DEEP_LINK_LIMIT
  const folder = input.folder ?? (path ? parentDirectory(path) : null)

  if (target === 'chatgpt') {
    return { url: null, clipboard: long ? contents : reviewPrompt(locale, contents), kind: 'copy', long }
  }
  if (!path || !folder) {
    // Unsaved document: copy-and-open. Claude still embeds the content so the
    // paste works without a file on disk.
    const clipboard =
      target === 'claude' ? t(locale, 'llmClaudePrompt', { name, path: '', contents }) : long ? contents : reviewPrompt(locale, contents)
    return { url: null, clipboard, kind: 'copy', long }
  }
  if (target === 'codex') {
    const prompt = t(locale, 'llmCodexPrompt', { path })
    return {
      url: `codex://new?prompt=${encodeURIComponent(prompt)}&path=${encodeURIComponent(folder)}`,
      clipboard: prompt,
      kind: 'deep-link',
      long: false,
    }
  }
  const prompt = t(locale, 'llmClaudePrompt', { name, path, contents })
  if (prompt.length <= LLM_DEEP_LINK_LIMIT) {
    return {
      url: `claude://code/new?q=${encodeURIComponent(prompt)}&folder=${encodeURIComponent(folder)}`,
      clipboard: prompt,
      kind: 'deep-link',
      long: false,
    }
  }
  return { url: null, clipboard: prompt, kind: 'copy', long: true }
}
