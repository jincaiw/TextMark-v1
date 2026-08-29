import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, readSettings } from './useSettings'
import { normalizeSettings } from '../lib/settings'

const storage = (values: Record<string, string>) => ({ getItem: (key: string) => values[key] ?? null })

describe('settings migration', () => {
  it('starts in Chinese with a stable v6 schema', () => {
    expect(readSettings(storage({}))).toMatchObject({
      schemaVersion: 6,
      locale: 'zh-CN',
      updateChannel: 'stable',
      toolbarDisplay: 'iconOnly',
    })
  })
  it('migrates v1 values and removes unknown toolbar entries', () => {
    const settings = readSettings(
      storage({ 'textmark.settings.v1': JSON.stringify({ locale: 'en', zoom: 999, toolbar: ['sidebar', 'bad', 'search'] }) }),
    )
    expect(settings).toMatchObject({ schemaVersion: 6, locale: 'en', zoom: 300, toolbar: ['sidebar', 'search'] })
  })
  it('migrates pre-v4 openWith into the combined openActions item', () => {
    expect(normalizeSettings({ schemaVersion: 3, toolbar: ['openWith', 'zoom'] }).toolbar).toEqual(['openActions', 'zoom'])
    expect(normalizeSettings({ schemaVersion: 4, toolbar: ['openWith', 'openInLlm'] }).toolbar).toEqual(['openWith', 'openInLlm'])
  })
  it('recovers from invalid JSON', () => expect(readSettings(storage({ 'textmark.settings.v2': '{' }))).toEqual(DEFAULT_SETTINGS))
  it('rejects unknown locale, theme, and width values', () =>
    expect(normalizeSettings({ locale: 'fr', theme: 'neon', contentWidth: 'wide' })).toMatchObject({
      locale: 'zh-CN',
      theme: 'system',
      contentWidth: 'normal',
    }))
  it('preserves valid English and dark settings', () =>
    expect(normalizeSettings({ locale: 'en', theme: 'dark', contentWidth: 'full' })).toMatchObject({
      locale: 'en',
      theme: 'dark',
      contentWidth: 'full',
    }))
  it('clamps zoom at the lower boundary', () => expect(normalizeSettings({ zoom: 1 }).zoom).toBe(50))
  it('clamps zoom at the upper boundary', () => expect(normalizeSettings({ zoom: 500 }).zoom).toBe(300))
  it('clamps editor text size', () => {
    expect(normalizeSettings({ editorFontSize: 2 }).editorFontSize).toBe(12)
    expect(normalizeSettings({ editorFontSize: 99 }).editorFontSize).toBe(24)
  })
  it('restores the upstream toolbar when a stored list is empty', () =>
    expect(normalizeSettings({ toolbar: [] }).toolbar).toEqual(DEFAULT_SETTINGS.toolbar))
  it('preserves toolbar duplicates used for flexible spacing', () =>
    expect(normalizeSettings({ toolbar: ['flexibleSpace', 'sidebar', 'flexibleSpace'] }).toolbar).toEqual([
      'flexibleSpace',
      'sidebar',
      'flexibleSpace',
    ]))
  it('migrates the toolbar display mode', () =>
    expect(normalizeSettings({ toolbarDisplay: 'iconAndLabel' }).toolbarDisplay).toBe('iconAndLabel'))
  it('accepts the alwaysOnTop toolbar item and removes unknown entries', () =>
    expect(normalizeSettings({ toolbar: ['alwaysOnTop', 'bogus', 'zoom'] }).toolbar).toEqual(['alwaysOnTop', 'zoom']))
  it('never enables crash reporting from a truthy non-boolean', () => {
    expect(normalizeSettings({ crashReports: 'yes' }).crashReports).toBe(false)
    expect(normalizeSettings({ crashReports: true }).crashReports).toBe(true)
  })
  it('upgrades the previous default toolbar to grouped document actions without rewriting custom layouts', () => {
    expect(
      normalizeSettings({
        toolbar: [
          'flexibleSpace',
          'sidebar',
          'navigation',
          'flexibleSpace',
          'openActions',
          'space',
          'zoom',
          'inspector',
          'share',
          'edit',
          'search',
        ],
      }).toolbar,
    ).toContain('documentActions')
    expect(normalizeSettings({ toolbar: ['inspector', 'search'] }).toolbar).toEqual(['inspector', 'search'])
  })
  it('migrates document lifecycle preferences with safe defaults and bounds', () => {
    expect(normalizeSettings({ autoSaveIntervalMinutes: -30, openDocumentsInTabs: true, alwaysOnTop: true })).toMatchObject({
      autoSaveIntervalMinutes: -30,
      openDocumentsInTabs: true,
      alwaysOnTop: true,
    })
    expect(normalizeSettings({ autoSaveIntervalMinutes: 999, openDocumentsInTabs: 'yes', alwaysOnTop: 1 })).toMatchObject({
      autoSaveIntervalMinutes: 60,
      openDocumentsInTabs: false,
      alwaysOnTop: false,
    })
  })
  it('keeps only valid document fonts, presets, and per-scheme color overrides', () => {
    expect(
      normalizeSettings({
        documentFont: 'serif',
        themePreset: 'dracula',
        themeColors: { light: { linkColor: '#abc123', textColor: 'invalid' }, dark: { windowBackground: '#1e1e1e' } },
      }),
    ).toMatchObject({
      documentFont: 'serif',
      themePreset: 'dracula',
      themeColors: { light: { linkColor: '#ABC123' }, dark: { windowBackground: '#1E1E1E' } },
    })
  })
})
