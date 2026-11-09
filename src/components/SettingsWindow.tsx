import { getCurrentWindow } from '@tauri-apps/api/window'
import { useEffect, useState } from 'react'
import { crashReportingAvailable, configureCrashReporting } from '../lib/telemetry'
import { discoverApplications, installCli, isTauri } from '../lib/platform'
import { useSettings } from '../hooks/useSettings'
import { useTheme } from '../hooks/useTheme'
import { useUpdater } from '../hooks/useUpdater'
import type { ExternalApplication } from '../types'
import { SettingsDialog } from './SettingsDialog'
import { THEME_PRESETS } from '../lib/theme'

/** A dedicated Settings WebView must not initialize document I/O or Markdown
 * rendering. Keeping this as a separate root makes that boundary explicit. */
export function SettingsWindow() {
  const {
    settings,
    locale,
    setLocale,
    setTheme,
    setContentWidth,
    setZoom,
    setEditorFontSize,
    setLineHeight,
    setPagePaddingHorizontal,
    setDocumentFont,
    setReaderLayout,
    patch,
  } = useSettings()
  const updater = useUpdater(
    settings.updateChannel,
    settings.autoCheckUpdates,
    (lastUpdateCheckAt) => patch({ lastUpdateCheckAt }),
    settings.autoDownloadUpdates,
  )
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
    document.documentElement.lang = locale
    document.title = 'TextMark Settings'
    if (isTauri()) void getCurrentWindow().setTitle('TextMark Settings')
  }, [locale])

  const close = () => {
    if (isTauri()) void getCurrentWindow().close()
    else window.close()
  }

  return (
    <main className="app-shell native-shell settings-window-shell">
      <SettingsDialog
        open
        locale={locale}
        crashReports={settings.crashReports}
        sharesUsageAnalytics={settings.sharesUsageAnalytics}
        crashReportsAvailable={crashReportingAvailable}
        updateChannel={settings.updateChannel}
        autoCheckUpdates={settings.autoCheckUpdates}
        autoDownloadUpdates={settings.autoDownloadUpdates}
        lastUpdateCheckAt={settings.lastUpdateCheckAt}
        updateStatus={updater.status}
        onCheckUpdate={() => void updater.checkNow()}
        onInstallUpdate={() => void updater.install()}
        onRelaunchUpdate={() => void updater.relaunch()}
        theme={settings.theme}
        contentWidth={settings.contentWidth}
        editorFontSize={settings.editorFontSize}
        lineHeight={settings.lineHeight}
        strictLineBreaks={settings.strictLineBreaks}
        pagePaddingHorizontal={settings.pagePaddingHorizontal}
        textAlignment={settings.textAlignment}
        outlineFollowsPointer={settings.outlineFollowsPointer}
        documentFont={settings.documentFont}
        readerLayout={settings.readerLayout}
        themePreset={settings.themePreset}
        themeColors={settings.themeColors}
        autoSaveIntervalMinutes={settings.autoSaveIntervalMinutes}
        openDocumentsInTabs={settings.openDocumentsInTabs}
        openMarkdownLinksInNewWindows={settings.openMarkdownLinksInNewWindows}
        supportCardDismissed={settings.supportCardDismissed}
        alwaysOnTop={settings.alwaysOnTop}
        zoom={settings.zoom}
        applications={applications}
        defaultOpenTarget={settings.defaultOpenTarget}
        onLocaleChange={setLocale}
        localeSetting={settings.locale}
        onCrashReportsChange={(crashReports) => patch({ crashReports })}
        onUsageAnalyticsChange={(sharesUsageAnalytics) => patch({ sharesUsageAnalytics })}
        onUpdateChannelChange={(updateChannel) => patch({ updateChannel })}
        onAutoCheckUpdatesChange={(autoCheckUpdates) => patch({ autoCheckUpdates })}
        onAutoDownloadUpdatesChange={(autoDownloadUpdates) => patch({ autoDownloadUpdates })}
        onThemeChange={setTheme}
        onContentWidthChange={setContentWidth}
        onEditorFontSizeChange={setEditorFontSize}
        onLineHeightChange={setLineHeight}
        onStrictLineBreaksChange={(strictLineBreaks) => patch({ strictLineBreaks })}
        onPagePaddingHorizontalChange={setPagePaddingHorizontal}
        onTextAlignmentChange={(textAlignment) => patch({ textAlignment })}
        onOutlineFollowsPointerChange={(outlineFollowsPointer) => patch({ outlineFollowsPointer })}
        onDocumentFontChange={setDocumentFont}
        onReaderLayoutChange={setReaderLayout}
        onThemePresetChange={(themePreset) => {
          const flavor = THEME_PRESETS[themePreset].flavor
          patch({ themePreset, theme: flavor === 'system' ? settings.theme : flavor, themeColors: {} })
        }}
        onThemeColorChange={(scheme, slot, color) =>
          patch({ themeColors: { ...settings.themeColors, [scheme]: { ...settings.themeColors[scheme], [slot]: color.toUpperCase() } } })
        }
        onThemeColorsReset={() => patch({ themeColors: {} })}
        onAutoSaveIntervalChange={(autoSaveIntervalMinutes) => patch({ autoSaveIntervalMinutes })}
        onOpenDocumentsInTabsChange={(openDocumentsInTabs) => patch({ openDocumentsInTabs })}
        onOpenMarkdownLinksInNewWindowsChange={(openMarkdownLinksInNewWindows) => patch({ openMarkdownLinksInNewWindows })}
        onSupportCardDismissedChange={(supportCardDismissed) => patch({ supportCardDismissed })}
        onAlwaysOnTopChange={(alwaysOnTop) => patch({ alwaysOnTop })}
        onZoomChange={setZoom}
        onDefaultOpenTargetChange={(defaultOpenTarget) => patch({ defaultOpenTarget })}
        onInstallCli={() => {
          void installCli().then((result) => {
            if (result.ok)
              window.alert(
                locale === 'zh-CN' ? `命令行工具已安装到 ${result.detail ?? ''}` : `Command-line tools installed to ${result.detail ?? ''}`,
              )
            else window.alert(locale === 'zh-CN' ? '安装命令行工具失败。' : 'Could not install the command-line tools.')
          })
        }}
        onClose={close}
      />
    </main>
  )
}
