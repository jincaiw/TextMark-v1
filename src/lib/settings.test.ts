import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, DEFAULT_TOOLBAR, normalizeLineHeight, normalizePagePadding, normalizeSettings, SETTINGS_KEYS } from './settings'
import { UPSTREAM_DOCUMENT_TOKENS } from './designTokens'

describe('reading typography settings', () => {
  it('defaults to the frozen upstream typography', () => {
    expect(DEFAULT_SETTINGS.lineHeight).toBe(UPSTREAM_DOCUMENT_TOKENS.lineHeight)
    expect(DEFAULT_SETTINGS.pagePaddingHorizontal).toBe(UPSTREAM_DOCUMENT_TOKENS.pagePaddingHorizontal)
  })

  it('keeps the new profile version ahead of the ones it reads from', () => {
    expect(SETTINGS_KEYS[0]).toBe('textmark.settings.v7')
    expect(DEFAULT_SETTINGS.schemaVersion).toBe(7)
  })

  it('defaults document actions to independent, reorderable toolbar items', () => {
    expect(DEFAULT_TOOLBAR).toEqual([
      'sidebar',
      'navigation',
      'flexibleSpace',
      'openActions',
      'space',
      'themesAndSettings',
      'space',
      'inspector',
      'share',
      'edit',
      'search',
    ])
  })

  it.each([
    [
      5,
      ['flexibleSpace', 'sidebar', 'navigation', 'flexibleSpace', 'openActions', 'space', 'zoom', 'inspector', 'share', 'edit', 'search'],
    ],
    [7, ['sidebar', 'navigation', 'flexibleSpace', 'openActions', 'space', 'themesAndSettings', 'inspector', 'share', 'edit', 'search']],
    [7, ['sidebar', 'navigation', 'flexibleSpace', 'openActions', 'space', 'themesAndSettings', 'documentActions', 'search']],
  ] as const)('migrates the prior default toolbar from schema v%s without changing custom layouts', (schemaVersion, toolbar) => {
    expect(normalizeSettings({ schemaVersion, toolbar }).toolbar).toEqual(DEFAULT_TOOLBAR)
    expect(normalizeSettings({ schemaVersion, toolbar: ['search', 'documentActions', 'space'] }).toolbar).toEqual([
      'search',
      'documentActions',
      'space',
    ])
  })

  it('fills the new fields in for a profile written by an older build', () => {
    const migrated = normalizeSettings({ schemaVersion: 6, theme: 'dark', editorFontSize: 18 })
    expect(migrated.lineHeight).toBe(UPSTREAM_DOCUMENT_TOKENS.lineHeight)
    expect(migrated.pagePaddingHorizontal).toBe(UPSTREAM_DOCUMENT_TOKENS.pagePaddingHorizontal)
    // Existing values must survive the migration.
    expect(migrated.theme).toBe('dark')
    expect(migrated.editorFontSize).toBe(18)
  })

  it('clamps instead of rejecting an out-of-range profile', () => {
    expect(normalizeLineHeight(9)).toBe(2.4)
    expect(normalizeLineHeight(0.1)).toBe(1.2)
    expect(normalizeLineHeight(1.8)).toBe(1.8)
    expect(normalizeLineHeight(1.777)).toBe(1.78)
    expect(normalizePagePadding(-40)).toBe(0)
    expect(normalizePagePadding(500)).toBe(96)
    expect(normalizePagePadding(24)).toBe(24)
  })

  it('falls back to the defaults for non-numeric input', () => {
    expect(normalizeLineHeight('tall')).toBe(1.52)
    expect(normalizeLineHeight(undefined)).toBe(1.52)
    expect(normalizePagePadding(null)).toBe(40)
    expect(normalizePagePadding(Number.NaN)).toBe(40)
  })
})
