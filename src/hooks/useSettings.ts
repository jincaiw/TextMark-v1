import { useCallback, useEffect, useState } from 'react'
import type { AppSettings, ContentWidth, Locale, ThemeMode } from '../types'
import { loadNativeSettings, saveNativeSettings } from '../lib/platform'
import { normalizeSettings, readSettings, SETTINGS_KEYS } from '../lib/settings'

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
  return {
    settings,
    patch,
    setLocale: (locale: Locale) => patch({ locale }),
    setTheme: (theme: ThemeMode) => patch({ theme }),
    setContentWidth: (contentWidth: ContentWidth) => patch({ contentWidth }),
    setZoom: (zoom: number) => patch({ zoom: Math.max(50, Math.min(300, zoom)) }),
    setEditorFontSize: (editorFontSize: number) => patch({ editorFontSize: Math.max(12, Math.min(24, editorFontSize)) }),
  }
}
