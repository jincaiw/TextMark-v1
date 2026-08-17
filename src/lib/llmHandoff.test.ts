import { describe, expect, it } from 'vitest'
import { buildLlmHandoff, LLM_DEEP_LINK_LIMIT } from './llmHandoff'

const base = {
  path: '/Users/me/docs/notes.md',
  folder: '/Users/me/docs',
  name: 'notes.md',
  locale: 'en' as const,
}

describe('buildLlmHandoff', () => {
  it('builds the Codex deep link with a path prompt and folder context', () => {
    const handoff = buildLlmHandoff({ ...base, target: 'codex', contents: '# Notes' })
    expect(handoff.kind).toBe('deep-link')
    expect(handoff.url).toBe(
      'codex://new?prompt=' +
        encodeURIComponent('Open this Markdown file and use it as the working context:\n/Users/me/docs/notes.md') +
        '&path=' +
        encodeURIComponent('/Users/me/docs'),
    )
    expect(handoff.clipboard).toContain('/Users/me/docs/notes.md')
  })

  it('localizes the Codex prompt', () => {
    const handoff = buildLlmHandoff({ ...base, target: 'codex', contents: '# Notes', locale: 'zh-CN' })
    expect(handoff.clipboard).toContain('请打开此 Markdown 文件')
    expect(handoff.url).toContain('codex://new?prompt=')
  })

  it('builds the Claude deep link with embedded markdown and folder context', () => {
    const handoff = buildLlmHandoff({ ...base, target: 'claude', contents: '# Notes\n\nBody text' })
    expect(handoff.kind).toBe('deep-link')
    expect(handoff.url).toContain('claude://code/new?q=')
    expect(decodeURIComponent(handoff.url!.split('q=')[1].split('&')[0])).toContain('# Notes')
    expect(handoff.url).toContain('folder=' + encodeURIComponent('/Users/me/docs'))
    expect(handoff.long).toBe(false)
  })

  it('falls back to copy-and-open when the Claude prompt exceeds the deep-link cap', () => {
    const contents = 'x'.repeat(LLM_DEEP_LINK_LIMIT)
    const handoff = buildLlmHandoff({ ...base, target: 'claude', contents })
    expect(handoff.kind).toBe('copy')
    expect(handoff.url).toBeNull()
    expect(handoff.clipboard).toContain(contents)
    expect(handoff.long).toBe(true)
  })

  it('falls back to copy-and-open for an unsaved document', () => {
    const handoff = buildLlmHandoff({ ...base, target: 'claude', path: null, folder: null, contents: '# Draft' })
    expect(handoff.kind).toBe('copy')
    expect(handoff.url).toBeNull()
    expect(handoff.clipboard).toContain('# Draft')
  })

  it('keeps the ChatGPT behavior as copy-and-open without a deep link', () => {
    const short = buildLlmHandoff({ ...base, target: 'chatgpt', contents: '# Notes' })
    expect(short.kind).toBe('copy')
    expect(short.url).toBeNull()
    expect(short.clipboard).toContain('Please review this Markdown document')
    expect(short.long).toBe(false)

    const long = buildLlmHandoff({ ...base, target: 'chatgpt', contents: 'y'.repeat(LLM_DEEP_LINK_LIMIT + 1) })
    expect(long.clipboard).toBe('y'.repeat(LLM_DEEP_LINK_LIMIT + 1))
    expect(long.long).toBe(true)
  })

  it('derives the folder from the document path when no folder is given', () => {
    const handoff = buildLlmHandoff({ ...base, target: 'codex', folder: null, contents: '# Notes' })
    expect(handoff.url).toContain('path=' + encodeURIComponent('/Users/me/docs'))
  })
})
