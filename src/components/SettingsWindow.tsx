import { getCurrentWindow } from '@tauri-apps/api/window'
import { useEffect, useState } from 'react'
import { crashReportingAvailable, configureCrashReporting } from '../lib/telemetry'
import { discoverApplications, isTauri } from '../lib/platform'
import { useSettings } from '../hooks/useSettings'
import { useTheme } from '../hooks/useTheme'
import { useUpdater } from '../hooks/useUpdater'
import type { ExternalApplication } from '../types'
import { SettingsDialog } from './SettingsDialog'
import { THEME_PRESETS } from '../lib/theme'

/** A dedicated Settings WebView must not initialize document I/O or Markdown
 * rendering. Keeping this as a separate root makes that boundary explicit. */
export function SettingsWindow() {
  const { settings, setLocale, setTheme, setContentWidth, setZoom, setEditorFontSize, setDocumentFont, patch } = useSettings()
  const updater = useUpdater(settings.updateChannel, settings.autoCheckUpdates, (lastUpdateCheckAt) => patch({ lastUpdateCheckAt }))
  const [applications, setApplications] = useState<ExternalApplication[]>([])
  useTheme(settings.theme)

  useEffect(() => {
    void configureCrashReporting(settings.crashReports)
  }, [settings.crashReports])
  useEffect(() => {
    let cancelled = false
    void discoverApplications().then((next) => {
      if (!cancelled) setApplications(next)
    })
    return () => {
      cancelled = true
    }
  }, [])
  useEffect(() => {
    document.documentElement.lang = settings.locale
    document.title = 'TextMark Settings'
    if (isTauri()) void getCurrentWindow().setTitle('TextMark Settings')
  }, [settings.locale])

  const close = () => {
    if (isTauri()) void getCurrentWindow().close()
    else window.close()
  }

  return (
    <main className="app-shell native-shell settings-window-shell">
      <SettingsDialog
        open
        locale={settings.locale}
        crashReports={settings.crashReports}
        crashReportsAvailable={crashReportingAvailable}
        updateChannel={settings.updateChannel}
        autoCheckUpdates={settings.autoCheckUpdates}
        lastUpdateCheckAt={settings.lastUpdateCheckAt}
        updateStatus={updater.status}
        onCheckUpdate={() => void updater.checkNow()}
        onInstallUpdate={() => void updater.install()}
        theme={settings.theme}
        contentWidth={settings.contentWidth}
        editorFontSize={settings.editorFontSize}
        documentFont={settings.documentFont}
        themePreset={settings.themePreset}
        themeColors={settings.themeColors}
        autoSaveIntervalMinutes={settings.autoSaveIntervalMinutes}
        openDocumentsInTabs={settings.openDocumentsInTabs}
        alwaysOnTop={settings.alwaysOnTop}
        zoom={settings.zoom}
        applications={applications}
        defaultOpenTarget={settings.defaultOpenTarget}
        onLocaleChange={setLocale}
        onCrashReportsChange={(crashReports) => patch({ crashReports })}
        onUpdateChannelChange={(updateChannel) => patch({ updateChannel })}
        onAutoCheckUpdatesChange={(autoCheckUpdates) => patch({ autoCheckUpdates })}
        onThemeChange={setTheme}
        onContentWidthChange={setContentWidth}
        onEditorFontSizeChange={setEditorFontSize}
        onDocumentFontChange={setDocumentFont}
        onThemePresetChange={(themePreset) => {
          const flavor = THEME_PRESETS[themePreset].flavor
          patch({ themePreset, theme: flavor === 'system' ? 'system' : flavor, themeColors: {} })
        }}
        onThemeColorChange={(scheme, slot, color) =>
          patch({ themeColors: { ...settings.themeColors, [scheme]: { ...settings.themeColors[scheme], [slot]: color.toUpperCase() } } })
        }
        onAutoSaveIntervalChange={(autoSaveIntervalMinutes) => patch({ autoSaveIntervalMinutes })}
        onOpenDocumentsInTabsChange={(openDocumentsInTabs) => patch({ openDocumentsInTabs })}
        onAlwaysOnTopChange={(alwaysOnTop) => patch({ alwaysOnTop })}
        onZoomChange={setZoom}
        onDefaultOpenTargetChange={(defaultOpenTarget) => patch({ defaultOpenTarget })}
        onClose={close}
      />
    </main>
  )
}
