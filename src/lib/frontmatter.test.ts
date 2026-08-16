import { describe, expect, it } from 'vitest'
import { splitFrontmatter } from './frontmatter'

describe('upstream frontmatter parity', () => {
  it('splits YAML frontmatter', () =>
    expect(splitFrontmatter('---\ntitle: Draft\n---\n# Body')).toMatchObject({ raw: 'title: Draft', body: '# Body' }))
  it('accepts the YAML ellipsis closer', () => expect(splitFrontmatter('---\ntitle: Draft\n...\n# Body').body).toBe('# Body'))
  it('splits TOML frontmatter', () =>
    expect(splitFrontmatter('+++\ntitle = "Draft"\n+++\n# Body')).toMatchObject({ raw: 'title = "Draft"', body: '# Body' }))
  it('does not close TOML with a YAML delimiter', () => expect(splitFrontmatter('+++\ntitle = "Draft"\n---\n# Body').raw).toBeNull())
  it('only recognizes a delimiter at document start', () => expect(splitFrontmatter('# Body\n\n+++\ntitle = Draft\n+++').raw).toBeNull())
  it('parses YAML scalar and block sequence entries', () =>
    expect(splitFrontmatter('---\ntitle: Draft\ntags:\n  - markdown\n---\n').entries).toEqual([
      { key: 'title', value: 'Draft' },
      { key: 'tags', value: 'markdown', items: ['markdown'] },
    ]))
  it('unquotes YAML scalar values', () =>
    expect(splitFrontmatter('---\nname: "openai-docs"\nnote: \'single\'\n---\n').entries).toEqual([
      { key: 'name', value: 'openai-docs' },
      { key: 'note', value: 'single' },
    ]))
  it('parses YAML flow sequences as items', () =>
    expect(splitFrontmatter('---\ntags: [links, "core features", drafts]\n---\n').entries[0]).toEqual({
      key: 'tags',
      value: 'links, core features, drafts',
      items: ['links', 'core features', 'drafts'],
    }))
  it('parses unindented block sequence items', () =>
    expect(splitFrontmatter('---\ntags:\n- links\n- "core features"\n---\n').entries[0].items).toEqual(['links', 'core features']))
  it('folds YAML block scalars', () =>
    expect(splitFrontmatter('---\ndescription: >-\n  Line one\n  line two.\n---\n').entries[0].value).toBe('Line one line two.'))
  it('strips comments without damaging URL fragments', () =>
    expect(splitFrontmatter('---\n# metadata\nstatus: shipped # since 1\nurl: https://example.com/#anchor\n---\n').entries).toEqual([
      { key: 'status', value: 'shipped' },
      { key: 'url', value: 'https://example.com/#anchor' },
    ]))
  it('parses TOML booleans, dates, and arrays', () =>
    expect(
      splitFrontmatter('+++\ntitle = "Draft"\ndate = "2026-05-21"\ndraft = false\ntags = ["markdown", "frontmatter"]\n+++\n').entries,
    ).toEqual([
      { key: 'title', value: 'Draft' },
      { key: 'date', value: '2026-05-21' },
      { key: 'draft', value: 'false' },
      { key: 'tags', value: 'markdown, frontmatter', items: ['markdown', 'frontmatter'] },
    ]))
})
