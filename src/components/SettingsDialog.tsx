import { BookOpen, Info, Palette, Settings2, ShieldCheck, Terminal, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { resolveLocale, t } from '../lib/i18n'
import { LINE_HEIGHT_RANGE, PAGE_PADDING_RANGE } from '../lib/settings'
import { isTauri, resetLinkApprovals } from '../lib/platform'
import { useDialogAccessibility } from '../hooks/useDialogAccessibility'
import { AppearanceSettings } from './AppearanceSettings'
import type {
  AppSettings,
  ContentWidth,
  DocumentFont,
  ExternalApplication,
  Locale,
  LocaleSetting,
  ThemeColorScheme,
  ThemeColorSlot,
  ThemeColors,
  ThemeMode,
  ThemePreset,
} from '../types'
import type { UpdateStatus } from '../hooks/useUpdater'

interface SettingsDialogProps {
  open: boolean
  initialPane?: 'general' | 'reading' | 'appearance' | 'privacy' | 'advanced' | 'about'
  theme: ThemeMode
  contentWidth: ContentWidth
  editorFontSize: number
  lineHeight: number
  strictLineBreaks: boolean
  pagePaddingHorizontal: number
  textAlignment: AppSettings['textAlignment']
  outlineFollowsPointer: boolean
  documentFont: DocumentFont
  readerLayout: AppSettings['readerLayout']
  themePreset: ThemePreset
  themeColors: ThemeColors
  autoSaveIntervalMinutes: number
  openDocumentsInTabs: boolean
  openMarkdownLinksInNewWindows: boolean
  supportCardDismissed: boolean
  onSupportCardDismissedChange: (dismissed: boolean) => void
  alwaysOnTop: boolean
  zoom: number
  applications: ExternalApplication[]
  defaultOpenTarget: string
  locale: Locale
  localeSetting: LocaleSetting
  crashReports: boolean
  crashReportsAvailable: boolean
  sharesUsageAnalytics: boolean
  updateChannel: AppSettings['updateChannel']
  autoCheckUpdates: boolean
  autoDownloadUpdates: boolean
  lastUpdateCheckAt: number | null
  updateStatus: UpdateStatus
  onLocaleChange: (locale: LocaleSetting) => void
  onCrashReportsChange: (enabled: boolean) => void
  onUsageAnalyticsChange: (enabled: boolean) => void
  onUpdateChannelChange: (channel: AppSettings['updateChannel']) => void
  onAutoCheckUpdatesChange: (enabled: boolean) => void
  onAutoDownloadUpdatesChange: (enabled: boolean) => void
  onCheckUpdate: () => void
  onInstallUpdate: () => void
  onRelaunchUpdate: () => void
  onThemeChange: (theme: ThemeMode) => void
  onContentWidthChange: (width: ContentWidth) => void
  onEditorFontSizeChange: (size: number) => void
  onLineHeightChange: (value: number) => void
  onStrictLineBreaksChange: (enabled: boolean) => void
  onPagePaddingHorizontalChange: (value: number) => void
  onTextAlignmentChange: (alignment: AppSettings['textAlignment']) => void
  onOutlineFollowsPointerChange: (enabled: boolean) => void
  onDocumentFontChange: (font: DocumentFont) => void
  onReaderLayoutChange: (layout: Partial<AppSettings['readerLayout']>) => void
  onThemePresetChange: (preset: ThemePreset) => void
  onThemeColorChange: (scheme: ThemeColorScheme, slot: ThemeColorSlot, color: string) => void
  onThemeColorsReset: () => void
  onAutoSaveIntervalChange: (minutes: number) => void
  onOpenDocumentsInTabsChange: (enabled: boolean) => void
  onOpenMarkdownLinksInNewWindowsChange: (enabled: boolean) => void
  onAlwaysOnTopChange: (enabled: boolean) => void
  onZoomChange: (zoom: number) => void
  onDefaultOpenTargetChange: (target: string) => void
  onInstallCli: () => void
  onClose: () => void
}

export function SettingsDialog(props: SettingsDialogProps) {
  const [pane, setPane] = useState<'general' | 'reading' | 'appearance' | 'privacy' | 'advanced' | 'about'>(props.initialPane ?? 'general')
  const [languageRelaunch, setLanguageRelaunch] = useState(false)
  const [pendingLocale, setPendingLocale] = useState<LocaleSetting | null>(null)
  // Privacy ⓘ disclosure next to the analytics toggle (upstream popover
  // equivalent, rendered inline).
  const [privacyDetailOpen, setPrivacyDetailOpen] = useState(false)
  const openAboutLink = (url: string) => (isTauri() ? openUrl(url) : window.open(url, '_blank', 'noopener,noreferrer'))
  // Upstream shows the build number next to the version and lets the reader
  // select it; TextMark makes the whole version one click-to-copy control.
  const [versionCopied, setVersionCopied] = useState(false)
  const copyVersion = () => {
    void navigator.clipboard
      .writeText(`v${__APP_VERSION__}`)
      .then(() => setVersionCopied(true))
      .catch(() => setVersionCopied(false))
    window.setTimeout(() => setVersionCopied(false), 1600)
  }
  // The saved choice only reaches menus and controls after a restart, so a
  // change that alters the displayed language offers the upstream restart alert.
  const changeLocale = (setting: LocaleSetting) => {
    if (setting === props.localeSetting) return
    setPendingLocale(setting)
    if (resolveLocale(setting) !== props.locale) setLanguageRelaunch(true)
    else props.onLocaleChange(setting)
  }
  const relaunchNow = () => {
    if (pendingLocale) props.onLocaleChange(pendingLocale)
    setLanguageRelaunch(false)
    if (isTauri()) void import('@tauri-apps/plugin-process').then((module) => module.relaunch())
  }
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
            : props.updateStatus.state === 'ready'
              ? t(props.locale, 'updatePillReady')
              : props.updateStatus.state === 'error'
                ? t(props.locale, updateErrorKey)
                : ''
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={close} ref={backdropRef}>
      <section
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="settings-title">TextMark {t(props.locale, 'preferences')}</h2>
          <button onClick={close} aria-label={t(props.locale, 'close')}>
            <X />
          </button>
        </header>
        <div className="settings-layout">
          <nav className="settings-nav" aria-label="Settings sections">
            <button className={pane === 'general' ? 'selected' : ''} onClick={() => setPane('general')}>
              <Settings2 />
              {props.locale === 'zh-CN' ? '通用' : 'General'}
            </button>
            <button className={pane === 'reading' ? 'selected' : ''} onClick={() => setPane('reading')}>
              <BookOpen />
              {t(props.locale, 'reading')}
            </button>
            <button className={pane === 'appearance' ? 'selected' : ''} onClick={() => setPane('appearance')}>
              <Palette />
              {t(props.locale, 'appearance')}
            </button>
            <button className={pane === 'privacy' ? 'selected' : ''} onClick={() => setPane('privacy')}>
              <ShieldCheck />
              {props.locale === 'zh-CN' ? '隐私' : 'Privacy'}
            </button>
            <button className={pane === 'advanced' ? 'selected' : ''} onClick={() => setPane('advanced')}>
              <Terminal />
              {t(props.locale, 'advanced')}
            </button>
            <button className={pane === 'about' ? 'selected' : ''} onClick={() => setPane('about')}>
              <Info />
              {props.locale === 'zh-CN' ? '关于' : 'About'}
            </button>
          </nav>
          <div className="settings-pane">
            {pane === 'general' ? (
              <>
                {!props.supportCardDismissed ? (
                  <div className="settings-support-card" role="note">
                    <span>
                      {props.locale === 'zh-CN'
                        ? '喜欢 TextMark？请作者喝杯咖啡，支持持续开发。'
                        : 'Enjoying TextMark? Buy the developer a coffee to support development.'}
                    </span>
                    <div className="settings-support-actions">
                      <button onClick={() => void openAboutLink('https://www.buymeacoffee.com/')}>
                        {props.locale === 'zh-CN' ? '支持一下' : 'Buy Me a Coffee'}
                      </button>
                      <button
                        className="settings-support-dismiss"
                        aria-label={props.locale === 'zh-CN' ? '关闭支持卡片' : 'Dismiss support card'}
                        onClick={() => props.onSupportCardDismissedChange(true)}
                      >
                        <X />
                      </button>
                    </div>
                  </div>
                ) : null}
                <label>
                  <span>{t(props.locale, 'language')}</span>
                  <select value={props.localeSetting} onChange={(event) => changeLocale(event.target.value as LocaleSetting)}>
                    <option value="system">{t(props.locale, 'systemLanguage')}</option>
                    <option value="zh-CN">{t(props.locale, 'chinese')}</option>
                    <option value="en">{t(props.locale, 'english')}</option>
                  </select>
                </label>
                <label>
                  <span>{t(props.locale, 'documentFont')}</span>
                  <select value={props.documentFont} onChange={(event) => props.onDocumentFontChange(event.target.value as DocumentFont)}>
                    <option value="system">{t(props.locale, 'fontSystem')}</option>
                    <option value="athelas">{t(props.locale, 'fontAthelas')}</option>
                    <option value="avenirNext">{t(props.locale, 'fontAvenirNext')}</option>
                    <option value="charter">{t(props.locale, 'fontCharter')}</option>
                    <option value="georgia">{t(props.locale, 'fontGeorgia')}</option>
                    <option value="iowan">{t(props.locale, 'fontIowan')}</option>
                    <option value="newYork">{t(props.locale, 'fontNewYork')}</option>
                    <option value="palatino">{t(props.locale, 'fontPalatino')}</option>
                    <option value="rounded">{t(props.locale, 'fontRounded')}</option>
                    <option value="seravek">{t(props.locale, 'fontSeravek')}</option>
                    <option value="timesNewRoman">{t(props.locale, 'fontTimesNewRoman')}</option>
                    <option value="monospace">{t(props.locale, 'fontMonospace')}</option>
                  </select>
                </label>
                <label>
                  <span>{t(props.locale, 'defaultOpenTarget')}</span>
                  <select value={props.defaultOpenTarget} onChange={(event) => props.onDefaultOpenTargetChange(event.target.value)}>
                    <option value="system">{t(props.locale, 'systemDefault')}</option>
                    <optgroup label={t(props.locale, 'openTargetEditors')}>
                      {props.applications
                        .filter((application) => application.available && application.id !== 'system' && application.kind !== 'llm')
                        .map((application) => (
                          <option key={application.id} value={application.id}>
                            {application.name}
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label={t(props.locale, 'openTargetAIApps')}>
                      {props.applications
                        .filter((application) => application.available && application.kind === 'llm')
                        .map((application) => (
                          <option key={application.id} value={application.id}>
                            {application.name}
                          </option>
                        ))}
                    </optgroup>
                  </select>
                </label>
                <label>
                  <span>{t(props.locale, 'editorFontSize')}</span>
                  <div className="setting-range">
                    <input
                      type="range"
                      min="12"
                      max="24"
                      value={props.editorFontSize}
                      onChange={(event) => props.onEditorFontSizeChange(Number(event.target.value))}
                    />
                    <output>{props.editorFontSize}px</output>
                  </div>
                </label>
                <label>
                  <span>{t(props.locale, 'autoSave')}</span>
                  <select
                    value={props.autoSaveIntervalMinutes}
                    onChange={(event) => props.onAutoSaveIntervalChange(Number(event.target.value))}
                  >
                    <option value={0}>{t(props.locale, 'autoSaveOff')}</option>
                    <option value={-2}>{t(props.locale, 'autoSaveInstant')}</option>
                    <option value={-30}>{t(props.locale, 'autoSaveThirtySeconds')}</option>
                    <option value={1}>{t(props.locale, 'autoSaveOneMinute')}</option>
                    <option value={5}>{t(props.locale, 'autoSaveFiveMinutes')}</option>
                    <option value={10}>{t(props.locale, 'autoSaveTenMinutes')}</option>
                    <option value={15}>{t(props.locale, 'autoSaveFifteenMinutes')}</option>
                    <option value={30}>{t(props.locale, 'autoSaveThirtyMinutes')}</option>
                    <option value={60}>{t(props.locale, 'autoSaveSixtyMinutes')}</option>
                  </select>
                </label>
                <small className="settings-caption">{t(props.locale, 'autoSaveCaption')}</small>
                <label>
                  <span>{t(props.locale, 'openDocumentsInTabs')}</span>
                  <input
                    type="checkbox"
                    checked={props.openDocumentsInTabs}
                    onChange={(event) => props.onOpenDocumentsInTabsChange(event.target.checked)}
                  />
                </label>
                <small className="settings-caption">{t(props.locale, 'openDocumentsInTabsCaption')}</small>
                <label>
                  <span>{t(props.locale, 'openLinksInNewWindows')}</span>
                  <input
                    type="checkbox"
                    checked={props.openMarkdownLinksInNewWindows}
                    onChange={(event) => props.onOpenMarkdownLinksInNewWindowsChange(event.target.checked)}
                  />
                </label>
                <small className="settings-caption">{t(props.locale, 'openLinksInNewWindowsCaption')}</small>
                <label>
                  <span>{t(props.locale, 'alwaysOnTop')}</span>
                  <input
                    type="checkbox"
                    checked={props.alwaysOnTop}
                    onChange={(event) => props.onAlwaysOnTopChange(event.target.checked)}
                  />
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
                <small className="settings-caption">{t(props.locale, 'textAlignmentCaption')}</small>
                <label>
                  <span>{t(props.locale, 'contentWidth')}</span>
                  <select value={props.contentWidth} onChange={(event) => props.onContentWidthChange(event.target.value as ContentWidth)}>
                    <option value="normal">{t(props.locale, 'normal')}</option>
                    <option value="full">{t(props.locale, 'fullWidth')}</option>
                  </select>
                </label>
                <label>
                  <span>{t(props.locale, 'textAlignment')}</span>
                  <select
                    value={props.textAlignment}
                    onChange={(event) => props.onTextAlignmentChange(event.target.value as AppSettings['textAlignment'])}
                  >
                    <option value="automatic">{t(props.locale, 'textAlignmentAutomatic')}</option>
                    <option value="left">{t(props.locale, 'textAlignmentLeft')}</option>
                    <option value="center">{t(props.locale, 'textAlignmentCenter')}</option>
                    <option value="right">{t(props.locale, 'textAlignmentRight')}</option>
                    <option value="justified">{t(props.locale, 'textAlignmentJustified')}</option>
                  </select>
                </label>
                <label>
                  <span>{t(props.locale, 'lineHeight')}</span>
                  <div className="setting-range">
                    <input
                      type="range"
                      min={LINE_HEIGHT_RANGE.min}
                      max={LINE_HEIGHT_RANGE.max}
                      step={LINE_HEIGHT_RANGE.step}
                      value={props.lineHeight}
                      aria-label={t(props.locale, 'lineHeight')}
                      onChange={(event) => props.onLineHeightChange(Number(event.target.value))}
                    />
                    <output>{props.lineHeight.toFixed(2)}</output>
                  </div>
                </label>
                <small className="settings-caption">{t(props.locale, 'lineHeightCaption')}</small>
                <label>
                  <span>{t(props.locale, 'strictLineBreaks')}</span>
                  <input
                    type="checkbox"
                    checked={props.strictLineBreaks}
                    onChange={(event) => props.onStrictLineBreaksChange(event.target.checked)}
                  />
                </label>
                <small className="settings-caption">{t(props.locale, 'strictLineBreaksCaption')}</small>
                <label>
                  <span>{t(props.locale, 'pagePaddingHorizontal')}</span>
                  <div className="setting-range">
                    <input
                      type="range"
                      min={PAGE_PADDING_RANGE.min}
                      max={PAGE_PADDING_RANGE.max}
                      step={PAGE_PADDING_RANGE.step}
                      value={props.pagePaddingHorizontal}
                      aria-label={t(props.locale, 'pagePaddingHorizontal')}
                      onChange={(event) => props.onPagePaddingHorizontalChange(Number(event.target.value))}
                    />
                    <output>{props.pagePaddingHorizontal}px</output>
                  </div>
                </label>
                <small className="settings-caption">{t(props.locale, 'pagePaddingCaption')}</small>
                <label>
                  <span>{t(props.locale, 'outlineFollowsPointer')}</span>
                  <input
                    type="checkbox"
                    checked={props.outlineFollowsPointer}
                    onChange={(event) => props.onOutlineFollowsPointerChange(event.target.checked)}
                  />
                </label>
                <small className="settings-caption">{t(props.locale, 'outlineFollowsPointerCaption')}</small>
              </>
            ) : null}
            {pane === 'appearance' ? (
              <AppearanceSettings
                locale={props.locale}
                theme={props.theme}
                themePreset={props.themePreset}
                themeColors={props.themeColors}
                documentFont={props.documentFont}
                readerLayout={props.readerLayout}
                onThemeChange={props.onThemeChange}
                onThemePresetChange={props.onThemePresetChange}
                onThemeColorChange={props.onThemeColorChange}
                onThemeColorsReset={props.onThemeColorsReset}
                onDocumentFontChange={props.onDocumentFontChange}
                onReaderLayoutChange={props.onReaderLayoutChange}
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
                <label>
                  <span>
                    {t(props.locale, 'usageAnalytics')}
                    {/* The upstream ⓘ opens a popover with the full privacy
                        disclosure; a popover needs real anchoring, so the same
                        content is an expandable inline disclosure here. */}
                    <button
                      type="button"
                      className="privacy-info-button"
                      aria-expanded={privacyDetailOpen}
                      aria-label={props.locale === 'zh-CN' ? '隐私说明详情' : 'Privacy details'}
                      title={props.locale === 'zh-CN' ? '了解详情' : 'Learn more'}
                      onClick={() => setPrivacyDetailOpen((value) => !value)}
                    >
                      <Info />
                    </button>
                  </span>
                  <input
                    type="checkbox"
                    checked={props.sharesUsageAnalytics}
                    onChange={(event) => props.onUsageAnalyticsChange(event.target.checked)}
                  />
                </label>
                {privacyDetailOpen ? (
                  <div className="privacy-detail-popover" role="note">
                    <p>{t(props.locale, 'privacyDetailIntro')}</p>
                    <ul>
                      <li>{t(props.locale, 'privacyDetailPoint1')}</li>
                      <li>{t(props.locale, 'privacyDetailPoint2')}</li>
                      <li>{t(props.locale, 'privacyDetailPoint3')}</li>
                    </ul>
                  </div>
                ) : null}
                <small className="settings-caption">{t(props.locale, 'usageAnalyticsCaption')}</small>
                <p>
                  {props.locale === 'zh-CN'
                    ? '崩溃报告仅在你明确启用后发送；Markdown 文件内容不会随设置同步。'
                    : 'Crash reports are sent only when you explicitly enable them. Markdown contents are never synchronized with settings.'}
                </p>
              </>
            ) : null}
            {pane === 'advanced' ? (
              <>
                <div className="settings-advanced-row">
                  <span>{t(props.locale, 'commandLineTools')}</span>
                  <div>
                    <button onClick={props.onInstallCli}>{t(props.locale, 'installCli')}</button>
                    <small className="settings-caption">{t(props.locale, 'installCliCaption')}</small>
                  </div>
                </div>
                <div className="settings-advanced-row">
                  <span>{t(props.locale, 'appLinks')}</span>
                  <div>
                    <button onClick={() => resetLinkApprovals()}>{t(props.locale, 'resetAppLinks')}</button>
                    <small className="settings-caption">{t(props.locale, 'resetAppLinksCaption')}</small>
                  </div>
                </div>
              </>
            ) : null}
            {pane === 'about' ? (
              <>
                <div className="settings-about">
                  <strong>TextMark</strong>
                  <span
                    className="settings-version"
                    role="button"
                    tabIndex={0}
                    title={
                      versionCopied
                        ? props.locale === 'zh-CN'
                          ? '已拷贝'
                          : 'Copied'
                        : props.locale === 'zh-CN'
                          ? '点击拷贝版本号'
                          : 'Click to copy the version'
                    }
                    aria-label={
                      versionCopied
                        ? props.locale === 'zh-CN'
                          ? `版本 ${__APP_VERSION__} 已拷贝`
                          : `Version ${__APP_VERSION__} copied`
                        : props.locale === 'zh-CN'
                          ? `拷贝版本号 ${__APP_VERSION__}`
                          : `Copy version ${__APP_VERSION__}`
                    }
                    onClick={copyVersion}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') copyVersion()
                    }}
                  >
                    v{__APP_VERSION__}
                  </span>
                  <small>
                    {props.locale === 'zh-CN' ? '本地优先的 Markdown 阅读与编辑。' : 'A local-first Markdown reader and editor.'}
                  </small>
                  <div className="settings-about-links">
                    <button onClick={() => void openAboutLink('https://github.com/jincaiw/TextMark-v1')}>
                      {props.locale === 'zh-CN' ? 'GitHub 项目' : 'GitHub Project'}
                    </button>
                    <button onClick={() => void openAboutLink('https://github.com/jincaiw/TextMark-v1/releases')}>
                      {props.locale === 'zh-CN' ? '发布历史' : 'Release History'}
                    </button>
                    <button onClick={() => void openAboutLink('https://discord.com/')}>
                      {props.locale === 'zh-CN' ? 'Discord 社区' : 'Discord'}
                    </button>
                    <button onClick={() => void openAboutLink('https://www.buymeacoffee.com/')}>
                      {props.locale === 'zh-CN' ? '请作者喝杯咖啡' : 'Buy Me a Coffee'}
                    </button>
                  </div>
                </div>
                <label>
                  <span>{t(props.locale, 'updateChannel')}</span>
                  <select
                    value={props.updateChannel}
                    onChange={(event) => props.onUpdateChannelChange(event.target.value as AppSettings['updateChannel'])}
                  >
                    <option value="stable">{t(props.locale, 'stable')}</option>
                    <option value="beta">{t(props.locale, 'beta')}</option>
                  </select>
                </label>
                <label>
                  <span>{props.locale === 'zh-CN' ? '自动检查更新' : 'Automatically check for updates'}</span>
                  <input
                    type="checkbox"
                    checked={props.autoCheckUpdates}
                    onChange={(event) => props.onAutoCheckUpdatesChange(event.target.checked)}
                  />
                </label>
                <label>
                  <span>{t(props.locale, 'autoDownloadUpdates')}</span>
                  <input
                    type="checkbox"
                    checked={props.autoDownloadUpdates}
                    onChange={(event) => props.onAutoDownloadUpdatesChange(event.target.checked)}
                  />
                </label>
                <div className="settings-update">
                  {' '}
                  <span>
                    {updateText ||
                      (props.lastUpdateCheckAt
                        ? `${props.locale === 'zh-CN' ? '上次检查：' : 'Last checked: '}${new Intl.DateTimeFormat(props.locale, { dateStyle: 'medium', timeStyle: 'short' }).format(props.lastUpdateCheckAt)}`
                        : props.locale === 'zh-CN'
                          ? '尚未检查更新'
                          : 'Not checked yet')}
                  </span>
                  {props.updateStatus.state === 'available' ? (
                    <button onClick={props.onInstallUpdate}>{t(props.locale, 'installUpdate')}</button>
                  ) : props.updateStatus.state === 'ready' ? (
                    <button onClick={props.onRelaunchUpdate}>{t(props.locale, 'updatePillRelaunchNow')}</button>
                  ) : (
                    <button
                      disabled={props.updateStatus.state === 'checking' || props.updateStatus.state === 'downloading'}
                      onClick={props.onCheckUpdate}
                    >
                      {t(props.locale, 'checkForUpdates')}
                    </button>
                  )}
                </div>
                <p>{t(props.locale, 'settingsStored')}</p>
              </>
            ) : null}
          </div>
        </div>
        {languageRelaunch ? (
          <div className="dialog-backdrop" role="presentation">
            <section className="conflict-dialog" role="alertdialog" aria-modal="true" aria-labelledby="language-relaunch-title">
              <h2 id="language-relaunch-title">{t(props.locale, 'languageRelaunchTitle')}</h2>
              <p>{t(props.locale, 'languageRelaunchBody')}</p>
              <div>
                <button onClick={relaunchNow}>{t(props.locale, 'languageRelaunchNow')}</button>
                <button
                  onClick={() => {
                    if (pendingLocale) props.onLocaleChange(pendingLocale)
                    setLanguageRelaunch(false)
                  }}
                >
                  {t(props.locale, 'languageRelaunchLater')}
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </div>
  )
}
