import { describe, expect, it } from 'vitest'
import type { FileNode } from '../types'
import { flattenProjectFiles, normalizeIdentity, recentCandidates } from './fileSearchIndex'

const file = (name: string, path: string): FileNode => ({ name, path, isDirectory: false, children: [] })
const dir = (name: string, path: string, children: FileNode[]): FileNode => ({ name, path, isDirectory: true, children })

describe('project file index', () => {
  it('keeps only Markdown-family files and computes relative paths', () => {
    const tree = [
      file('README.md', '/proj/README.md'),
      file('notes.markdown', '/proj/docs/notes.markdown'),
      file('image.png', '/proj/image.png'),
      file('plain.txt', '/proj/plain.txt'),
      file('page.mdx', '/proj/page.mdx'),
    ]
    const { files, truncated } = flattenProjectFiles(tree, '/proj')
    expect(files.map((f) => f.path)).toEqual(['README.md', 'docs/notes.markdown', 'page.mdx'])
    expect(files[0].absolutePath).toBe('/proj/README.md')
    expect(files.every((f) => !f.isRecent)).toBe(true)
    expect(truncated).toBe(false)
  })

  it('prunes dependency directories and hidden entries', () => {
    const tree = [
      dir('node_modules', '/proj/node_modules', [file('dep.md', '/proj/node_modules/dep.md')]),
      dir('.git', '/proj/.git', [file('config.md', '/proj/.git/config.md')]),
      dir('target', '/proj/target', [file('out.md', '/proj/target/out.md')]),
      file('.hidden.md', '/proj/.hidden.md'),
      dir('src', '/proj/src', [file('guide.md', '/proj/src/guide.md')]),
    ]
    const { files } = flattenProjectFiles(tree, '/proj')
    expect(files.map((f) => f.path)).toEqual(['src/guide.md'])
  })

  it('flags truncation when the file cap is reached', () => {
    const tree = Array.from({ length: 20_001 }, (_, i) => file(`f${i}.md`, `/proj/f${i}.md`))
    const { files, truncated } = flattenProjectFiles(tree, '/proj')
    expect(files).toHaveLength(20_000)
    expect(truncated).toBe(true)
  })

  it('does not descend past the depth limit', () => {
    // Build a chain 14 levels deep; the file at the bottom must not be indexed.
    let node = file('deep.md', '/proj/d13/deep.md')
    let path = '/proj'
    for (let depth = 13; depth >= 1; depth -= 1) {
      path = `/proj/d${depth}`
      node = dir(`d${depth}`, path, [node])
    }
    const { files } = flattenProjectFiles([node], '/proj')
    expect(files).toEqual([])
  })
})

describe('recent candidates', () => {
  it('filters to Markdown + txt, dedupes by identity, caps at 10 newest first', () => {
    const paths = [
      '/Users/a/notes.md',
      '/Users/a/notes.md', // duplicate identity
      '/Users/a/image.png', // dropped
      '/Users/a/plain.txt',
      ...Array.from({ length: 12 }, (_, i) => `/Users/a/f${i}.md`),
    ]
    const recents = recentCandidates(paths)
    expect(recents).toHaveLength(10)
    expect(recents[0].absolutePath).toBe('/Users/a/notes.md')
    expect(recents[1].absolutePath).toBe('/Users/a/plain.txt')
    expect(recents.every((r) => r.isRecent)).toBe(true)
    expect(recents.some((r) => r.name === 'image.png')).toBe(false)
  })

  it('normalizes identity across separators, trailing slash and case', () => {
    expect(normalizeIdentity('/Users/A/Notes.md/')).toBe('/users/a/notes.md')
    expect(normalizeIdentity('C:\\Users\\A\\Notes.md')).toBe('c:/users/a/notes.md')
  })
})
