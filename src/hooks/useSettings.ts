import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AppSettings, ContentWidth, DocumentFont, LocaleSetting, ReaderLayout, ThemeMode } from '../types'
import { resolveLocale } from '../lib/i18n'
import { loadNativeSettings, saveNativeSettings } from '../lib/platform'
import {
  normalizeAutoSaveInterval,
  normalizeLineHeight,
  normalizePagePadding,
  normalizeReaderLayout,
  normalizeSettings,
  readSettings,
  SETTINGS_KEYS,
} from '../lib/settings'

export { DEFAULT_SETTINGS, readSettings } from '../lib/settings'

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(readSettings)
  const [nativeLoaded, setNativeLoaded] = useState(false)
  useEffect(() => {
    let cancelled = false
    void loadNativeSettings()
      .then((stored) => {
        if (!cancelled && stored) setSettings(normalizeSettings(stored))
      })
      .finally(() => {
        if (!cancelled) setNativeLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEYS[0], JSON.stringify(settings))
    if (nativeLoaded) void saveNativeSettings(settings)
  }, [nativeLoaded, settings])
  const patch = useCallback((next: Partial<AppSettings>) => setSettings((current) => ({ ...current, ...next })), [])
  // "system" (and any unknown stored value) resolves against the OS language
  // list, mirroring the upstream System Default behavior.
  const locale = useMemo(() => resolveLocale(settings.locale), [settings.locale])
  return {
    settings,
    patch,
    locale,
    setLocale: (locale: LocaleSetting) => patch({ locale }),
    setTheme: (theme: ThemeMode) => patch({ theme }),
    setContentWidth: (contentWidth: ContentWidth) => patch({ contentWidth }),
    setZoom: (zoom: number) => patch({ zoom: Math.max(50, Math.min(300, zoom)) }),
    setEditorFontSize: (editorFontSize: number) => patch({ editorFontSize: Math.max(12, Math.min(24, editorFontSize)) }),
    setLineHeight: (lineHeight: number) => patch({ lineHeight: normalizeLineHeight(lineHeight) }),
    setPagePaddingHorizontal: (pagePaddingHorizontal: number) =>
      patch({ pagePaddingHorizontal: normalizePagePadding(pagePaddingHorizontal) }),
    setDocumentFont: (documentFont: DocumentFont) => patch({ documentFont }),
    setReaderLayout: (readerLayout: Partial<ReaderLayout>) =>
      setSettings((current) => ({ ...current, readerLayout: normalizeReaderLayout({ ...current.readerLayout, ...readerLayout }) })),
    setAutoSaveIntervalMinutes: (autoSaveIntervalMinutes: number) =>
      patch({ autoSaveIntervalMinutes: normalizeAutoSaveInterval(autoSaveIntervalMinutes) }),
  }
}
