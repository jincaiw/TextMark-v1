import { describe, expect, it } from 'vitest'
import { planRestoredSession, sessionWindowById } from './sessionRestore'
import type { SessionManifest, SessionWindowSnapshot } from './platform'

const snapshot = (activeIndex: number): SessionWindowSnapshot => ({
  windowId: 'main',
  documents: ['/tmp/a.md', '/tmp/missing.md', '/tmp/c.md'],
  activeIndex,
  workspacePath: null,
})

describe('session restore planning', () => {
  it('keeps the active manifest tab when earlier documents are unreadable', () => {
    expect(
      planRestoredSession(snapshot(2), [
        { manifestIndex: 0, path: '/tmp/a.md' },
        { manifestIndex: 2, path: '/tmp/c.md' },
      ]),
    ).toEqual({ paths: ['/tmp/a.md', '/tmp/c.md'], activePath: '/tmp/c.md' })
  })

  it('falls back to the first readable document when the active tab is missing', () => {
    expect(planRestoredSession(snapshot(1), [{ manifestIndex: 2, path: '/tmp/c.md' }])).toEqual({
      paths: ['/tmp/c.md'],
      activePath: '/tmp/c.md',
    })
  })

  it('returns an empty plan for a session whose documents all disappeared', () => {
    expect(planRestoredSession(snapshot(0), [])).toEqual({ paths: [], activePath: null })
  })

  it('deduplicates readable paths without changing manifest order', () => {
    expect(
      planRestoredSession(snapshot(0), [
        { manifestIndex: 0, path: '/tmp/a.md' },
        { manifestIndex: 0, path: '/tmp/a.md' },
        { manifestIndex: 2, path: '/tmp/c.md' },
      ]).paths,
    ).toEqual(['/tmp/a.md', '/tmp/c.md'])
  })

  it('selects a session window by stable logical id', () => {
    const manifest: SessionManifest = {
      version: 1,
      updatedAt: 1,
      windows: [snapshot(0), { ...snapshot(0), windowId: 'secondary' }],
    }
    expect(sessionWindowById(manifest, 'secondary')?.windowId).toBe('secondary')
    expect(sessionWindowById(manifest, 'missing')).toBeNull()
    expect(sessionWindowById(null, 'main')).toBeNull()
  })
})
