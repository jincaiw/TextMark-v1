import { BookOpen, Cog, Info, Palette, Settings2, ShieldCheck, X } from 'lucide-react'
import { useEffect, useState, type ComponentType } from 'react'
import { t } from '../lib/i18n'
import { useDialogAccessibility } from '../hooks/useDialogAccessibility'
import { AppearanceSettings } from './AppearanceSettings'
import type {
  AppSettings,
  ContentWidth,
  ExternalApplication,
  Locale,
  ThemeColorScheme,
  ThemeColorSlot,
  ThemeMode,
  ThemePreset,
} from '../types'
import type { UpdateStatus } from '../hooks/useUpdater'

export type SettingsPane = 'general' | 'reading' | 'appearance' | 'privacy' | 'advanced' | 'about'

interface SettingsDialogProps {
  open: boolean
  initialPane?: SettingsPane
  theme: ThemeMode
  contentWidth: ContentWidth
  themePreset: ThemePreset
  themeColors: AppSettings['themeColors']
  autoSaveIntervalMinutes: number
  openDocumentsInTabs: boolean
  alwaysOnTop: boolean
  zoom: number
  applications: ExternalApplication[]
  defaultOpenTarget: string
  locale: Locale
  crashReports: boolean
  crashReportsAvailable: boolean
  updateChannel: AppSettings['updateChannel']
  autoCheckUpdates: boolean
  lastUpdateCheckAt: number | null
  updateStatus: UpdateStatus
  onLocaleChange: (locale: Locale) => void
  onCrashReportsChange: (enabled: boolean) => void
  onUpdateChannelChange: (channel: AppSettings['updateChannel']) => void
  onAutoCheckUpdatesChange: (enabled: boolean) => void
  onCheckUpdate: () => void
  onInstallUpdate: () => void
  onRelaunchUpdate?: () => void
  onThemeChange: (theme: ThemeMode) => void
  onContentWidthChange: (width: ContentWidth) => void
  onThemePresetChange: (preset: ThemePreset) => void
  onThemeColorChange: (scheme: ThemeColorScheme, slot: ThemeColorSlot, color: string) => void
  onThemeColorsReset: () => void
  onCustomizeTheme?: () => void
  onAutoSaveIntervalChange: (minutes: number) => void
  onOpenDocumentsInTabsChange: (enabled: boolean) => void
  onAlwaysOnTopChange: (enabled: boolean) => void
  onZoomChange: (zoom: number) => void
  onDefaultOpenTargetChange: (target: string) => void
  onInstallCli: () => void
  onClose: () => void
}

/** Upstream SettingsPane order: General gearshape, Reading book, Appearance
 * paintpalette, Privacy hand.raised, Advanced gearshape.2, About info.circle —
 * toolbar tabs, the way Safari's and Xcode's Settings are. */
const PANES: Array<{ pane: SettingsPane; titleKey: Parameters<typeof t>[1]; icon: ComponentType }> = [
  { pane: 'general', titleKey: 'settingsGeneral', icon: Settings2 },
  { pane: 'reading', titleKey: 'settingsReading', icon: BookOpen },
  { pane: 'appearance', titleKey: 'appearance', icon: Palette },
  { pane: 'privacy', titleKey: 'settingsPrivacy', icon: ShieldCheck },
  { pane: 'advanced', titleKey: 'settingsAdvanced', icon: Cog },
  { pane: 'about', titleKey: 'settingsAbout', icon: Info },
]

export function SettingsDialog(props: SettingsDialogProps) {
  const [pane, setPane] = useState<SettingsPane>(props.initialPane ?? 'general')
  useEffect(() => {
    if (props.open) setPane(props.initialPane ?? 'general')
  }, [props.initialPane, props.open])
  const close = () => {
    setPane('general')
    props.onClose()
  }
  const backdropRef = useDialogAccessibility(props.open, close)
  if (!props.open) return null
  const updateErrorKey =
    props.updateStatus.errorCode === 'update_install'
      ? 'updateInstallError'
      : props.updateStatus.errorCode === 'update_release_not_found'
        ? 'updateReleaseNotFound'
        : props.updateStatus.errorCode === 'update_unsupported_platform'
          ? 'updateUnsupportedPlatform'
          : props.updateStatus.errorCode === 'update_target_not_found'
            ? 'updateTargetNotFound'
            : props.updateStatus.errorCode === 'update_signature'
              ? 'updateSignature'
              : props.updateStatus.errorCode === 'update_network'
                ? 'updateNetwork'
                : props.updateStatus.errorCode === 'update_invalid_manifest'
                  ? 'updateInvalidManifest'
                  : 'updateError'
  const updateText =
    props.updateStatus.state === 'checking'
      ? t(props.locale, 'checking')
      : props.updateStatus.state === 'current'
        ? t(props.locale, 'upToDate')
        : props.updateStatus.state === 'available'
          ? t(props.locale, 'updateAvailable', { version: props.updateStatus.version ?? '' })
          : props.updateStatus.state === 'downloading'
            ? t(props.locale, 'downloadingUpdate', { progress: props.updateStatus.progress ?? 0 })
            : props.updateStatus.state === 'preparing'
              ? t(props.locale, 'updatePreparing')
              : props.updateStatus.state === 'ready'
                ? t(props.locale, 'updateInstalled')
                : props.updateStatus.state === 'installing'
                  ? t(props.locale, 'updateInstalling')
                  : props.updateStatus.state === 'updated'
                    ? t(props.locale, 'updatedTo', { version: props.updateStatus.version ?? '' })
                    : props.updateStatus.state === 'error'
                      ? t(props.locale, updateErrorKey)
                      : ''
  const lastChecked = props.lastUpdateCheckAt
    ? new Intl.DateTimeFormat(props.locale, { dateStyle: 'medium', timeStyle: 'short' }).format(props.lastUpdateCheckAt)
    : t(props.locale, 'never')
  const editorApps = props.applications.filter((application) => application.available && application.kind === 'editor')
  const aiApps = props.applications.filter((application) => application.available && application.kind === 'llm')
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={close} ref={backdropRef}>
      <section
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="settings-title" className="visually-hidden">
          TextMark {t(props.locale, 'preferences')}
        </h2>
        <nav className="settings-tabs" aria-label={t(props.locale, 'preferences')}>
          {PANES.map((entry) => {
            const Icon = entry.icon
            return (
              <button
                key={entry.pane}
                type="button"
                className={pane === entry.pane ? 'selected' : ''}
                aria-current={pane === entry.pane}
                onClick={() => setPane(entry.pane)}
              >
                <Icon />
                <span>{t(props.locale, entry.titleKey)}</span>
              </button>
            )
          })}
          <button type="button" className="settings-close" aria-label={t(props.locale, 'close')} onClick={close}>
            <X />
          </button>
        </nav>
        <div className="settings-pane">
          {pane === 'general' ? (
            <>
              <label>
                <span>{t(props.locale, 'languageSection')}</span>
                <select value={props.locale} onChange={(event) => props.onLocaleChange(event.target.value as Locale)}>
                  <option value="zh-CN">{t(props.locale, 'chinese')}</option>
                  <option value="en">{t(props.locale, 'english')}</option>
                </select>
              </label>
              <p className="settings-caption">{t(props.locale, 'languageEffectNote')}</p>
              <div className="settings-group">
                <span className="settings-group-label">{t(props.locale, 'openingFiles')}</span>
                <label>
                  <span>{t(props.locale, 'openDocumentsInTabs')}</span>
                  <input
                    type="checkbox"
                    checked={props.openDocumentsInTabs}
                    onChange={(event) => props.onOpenDocumentsInTabsChange(event.target.checked)}
                  />
                </label>
                <label>
                  <span>{t(props.locale, 'openMarkdownLinksInNewWindows')}</span>
                  <input type="checkbox" checked={false} disabled onChange={() => undefined} />
                </label>
              </div>
              <div className="settings-group">
                <span className="settings-group-label">{t(props.locale, 'windows')}</span>
                <label>
                  <span>{t(props.locale, 'alwaysOnTop')}</span>
                  <input
                    type="checkbox"
                    checked={props.alwaysOnTop}
                    onChange={(event) => props.onAlwaysOnTopChange(event.target.checked)}
                  />
                </label>
              </div>
              <label>
                <span>{t(props.locale, 'automaticSaving')}</span>
                <select
                  value={props.autoSaveIntervalMinutes}
                  onChange={(event) => props.onAutoSaveIntervalChange(Number(event.target.value))}
                >
                  <option value={0}>{t(props.locale, 'autoSaveOff')}</option>
                  <option value={-30}>{t(props.locale, 'autoSaveThirtySeconds')}</option>
                  <option value={1}>{t(props.locale, 'autoSaveOneMinute')}</option>
                  <option value={5}>{t(props.locale, 'autoSaveFiveMinutes')}</option>
                  <option value={10}>{t(props.locale, 'autoSaveTenMinutes')}</option>
                  <option value={15}>{t(props.locale, 'autoSaveFifteenMinutes')}</option>
                  <option value={30}>{t(props.locale, 'autoSaveThirtyMinutes')}</option>
                  <option value={60}>{t(props.locale, 'autoSaveSixtyMinutes')}</option>
                </select>
              </label>
              <label>
                <span>{t(props.locale, 'openDocumentsIn')}</span>
                <select value={props.defaultOpenTarget} onChange={(event) => props.onDefaultOpenTargetChange(event.target.value)}>
                  <option value="system">{t(props.locale, 'systemDefault')}</option>
                  {aiApps.length ? (
                    <optgroup label={t(props.locale, 'aiAppsSection')}>
                      {aiApps.map((application) => (
                        <option key={application.id} value={application.id}>
                          {application.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  <optgroup label={t(props.locale, 'editorsSection')}>
                    {editorApps.map((application) => (
                      <option key={application.id} value={application.id}>
                        {application.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>
            </>
          ) : null}
          {pane === 'reading' ? (
            <>
              <label>
                <span>{t(props.locale, 'textSize')}</span>
                <div className="settings-text-size">
                  {(
                    [
                      { stop: 90, key: 'textSizeSmall', sample: 10 },
                      { stop: 100, key: 'textSizeMedium', sample: 12 },
                      { stop: 125, key: 'textSizeLarge', sample: 15 },
                    ] as const
                  ).map(({ stop, key, sample }) => (
                    <button
                      key={key}
                      type="button"
                      className={props.zoom === stop ? 'selected' : ''}
                      aria-pressed={props.zoom === stop}
                      onClick={() => props.onZoomChange(stop)}
                    >
                      <span className="settings-text-size-sample" style={{ fontSize: sample }}>
                        Aa
                      </span>
                      {t(props.locale, key)}
                    </button>
                  ))}
                </div>
              </label>
              <label>
                <span>{t(props.locale, 'contentWidth')}</span>
                <select value={props.contentWidth} onChange={(event) => props.onContentWidthChange(event.target.value as ContentWidth)}>
                  <option value="normal">{t(props.locale, 'normal')}</option>
                  <option value="full">{t(props.locale, 'fullWidth')}</option>
                </select>
              </label>
              <p className="settings-caption">{t(props.locale, 'readingNote')}</p>
            </>
          ) : null}
          {pane === 'appearance' ? (
            <AppearanceSettings
              locale={props.locale}
              theme={props.theme}
              themePreset={props.themePreset}
              onThemeChange={props.onThemeChange}
              onThemePresetChange={props.onThemePresetChange}
              onCustomizeTheme={props.onCustomizeTheme}
            />
          ) : null}
          {pane === 'privacy' ? (
            <>
              <label>
                <span>{t(props.locale, 'crashReports')}</span>
                <span className="setting-toggle">
                  <input
                    type="checkbox"
                    checked={props.crashReports}
                    disabled={!props.crashReportsAvailable}
                    onChange={(event) => props.onCrashReportsChange(event.target.checked)}
                    aria-label={t(props.locale, 'crashReports')}
                  />
                  {!props.crashReportsAvailable ? <small>{t(props.locale, 'unavailable')}</small> : null}
                </span>
              </label>
              <p className="settings-caption">{t(props.locale, 'crashReportsCaption')}</p>
            </>
          ) : null}
          {pane === 'advanced' ? (
            <>
              <div className="settings-group">
                <span className="settings-group-label">{t(props.locale, 'commandLineTools')}</span>
                <button type="button" className="settings-button" onClick={props.onInstallCli}>
                  {t(props.locale, 'installCliButton')}
                </button>
                <p className="settings-caption">{t(props.locale, 'installCliCaption')}</p>
              </div>
            </>
          ) : null}
          {pane === 'about' ? (
            <>
              <div className="settings-about">
                <strong>TextMark</strong>
                <span>v{__APP_VERSION__}</span>
                <small>{props.locale === 'zh-CN' ? '本地优先的 Markdown 阅读与编辑。' : 'A local-first Markdown reader and editor.'}</small>
              </div>
              <label>
                <span>{t(props.locale, 'version')}</span>
                <span>v{__APP_VERSION__}</span>
              </label>
              <label>
                <span>{t(props.locale, 'updates')}</span>
                <span className="setting-toggle">
                  <input
                    type="checkbox"
                    checked={props.autoCheckUpdates}
                    onChange={(event) => props.onAutoCheckUpdatesChange(event.target.checked)}
                  />
                  <select
                    value={props.updateChannel}
                    onChange={(event) => props.onUpdateChannelChange(event.target.value as AppSettings['updateChannel'])}
                    aria-label={t(props.locale, 'updateChannel')}
                  >
                    <option value="stable">{t(props.locale, 'stable')}</option>
                    <option value="beta">{t(props.locale, 'beta')}</option>
                  </select>
                </span>
              </label>
              <label>
                <span>{t(props.locale, 'lastChecked')}</span>
                <span className="settings-caption-inline">{lastChecked}</span>
              </label>
              <div className="settings-update">
                <span>{updateText || t(props.locale, 'checkForUpdatesPrompt')}</span>
                {props.updateStatus.state === 'available' ? (
                  <button onClick={props.onInstallUpdate}>{t(props.locale, 'download')}</button>
                ) : props.updateStatus.state === 'ready' && props.onRelaunchUpdate ? (
                  <button onClick={props.onRelaunchUpdate}>{t(props.locale, 'relaunchNow')}</button>
                ) : (
                  <button
                    disabled={['checking', 'downloading', 'preparing', 'installing'].includes(props.updateStatus.state)}
                    onClick={props.onCheckUpdate}
                  >
                    {t(props.locale, 'checkForUpdatesShort')}
                  </button>
                )}
              </div>
              <div className="settings-links">
                <span>{t(props.locale, 'linksSection')}</span>
                <a href="https://github.com/jincaiw/TextMark-v1#readme" target="_blank" rel="noreferrer">
                  {t(props.locale, 'githubProject')}
                </a>
              </div>
              <p className="settings-caption">{t(props.locale, 'settingsStored')}</p>
            </>
          ) : null}
        </div>
      </section>
    </div>
  )
}
