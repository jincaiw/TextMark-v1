import { Info, Palette, ShieldCheck, X } from 'lucide-react'
import { useState } from 'react'
import { t } from '../lib/i18n'
import { useDialogAccessibility } from '../hooks/useDialogAccessibility'
import type { AppSettings, ContentWidth, ExternalApplication, Locale, ThemeMode } from '../types'
import type { UpdateStatus } from '../hooks/useUpdater'

interface SettingsDialogProps {
  open: boolean
  theme: ThemeMode
  contentWidth: ContentWidth
  editorFontSize: number
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
  onThemeChange: (theme: ThemeMode) => void
  onContentWidthChange: (width: ContentWidth) => void
  onEditorFontSizeChange: (size: number) => void
  onZoomChange: (zoom: number) => void
  onDefaultOpenTargetChange: (target: string) => void
  onClose: () => void
}

export function SettingsDialog(props: SettingsDialogProps) {
  const backdropRef = useDialogAccessibility(props.open, props.onClose)
  const [pane, setPane] = useState<'general' | 'privacy' | 'about'>('general')
  if (!props.open) return null
  const updateText =
    props.updateStatus.state === 'checking'
      ? t(props.locale, 'checking')
      : props.updateStatus.state === 'current'
        ? t(props.locale, 'upToDate')
        : props.updateStatus.state === 'available'
          ? t(props.locale, 'updateAvailable', { version: props.updateStatus.version ?? '' })
          : props.updateStatus.state === 'downloading'
            ? t(props.locale, 'downloadingUpdate', { progress: props.updateStatus.progress ?? 0 })
            : props.updateStatus.state === 'error'
              ? t(props.locale, 'updateError')
              : ''
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={props.onClose} ref={backdropRef}>
      <section
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="settings-title">TextMark {t(props.locale, 'preferences')}</h2>
          <button onClick={props.onClose} aria-label={t(props.locale, 'close')}>
            <X />
          </button>
        </header>
        <div className="settings-layout">
          <nav className="settings-nav" aria-label="Settings sections">
            <button className={pane === 'general' ? 'selected' : ''} onClick={() => setPane('general')}>
              <Palette />
              {props.locale === 'zh-CN' ? '通用' : 'General'}
            </button>
            <button className={pane === 'privacy' ? 'selected' : ''} onClick={() => setPane('privacy')}>
              <ShieldCheck />
              {props.locale === 'zh-CN' ? '隐私' : 'Privacy'}
            </button>
            <button className={pane === 'about' ? 'selected' : ''} onClick={() => setPane('about')}>
              <Info />
              {props.locale === 'zh-CN' ? '关于' : 'About'}
            </button>
          </nav>
          <div className="settings-pane">
            {pane === 'general' ? (
              <>
                <label>
                  <span>{t(props.locale, 'language')}</span>
                  <select value={props.locale} onChange={(event) => props.onLocaleChange(event.target.value as Locale)}>
                    <option value="zh-CN">{t(props.locale, 'chinese')}</option>
                    <option value="en">{t(props.locale, 'english')}</option>
                  </select>
                </label>
                <label>
                  <span>{t(props.locale, 'appearance')}</span>
                  <select value={props.theme} onChange={(event) => props.onThemeChange(event.target.value as ThemeMode)}>
                    <option value="system">{t(props.locale, 'automatic')}</option>
                    <option value="light">{t(props.locale, 'light')}</option>
                    <option value="dark">{t(props.locale, 'dark')}</option>
                  </select>
                </label>
                <label>
                  <span>{t(props.locale, 'contentWidth')}</span>
                  <select value={props.contentWidth} onChange={(event) => props.onContentWidthChange(event.target.value as ContentWidth)}>
                    <option value="normal">{t(props.locale, 'normal')}</option>
                    <option value="full">{t(props.locale, 'fullWidth')}</option>
                  </select>
                </label>
                <label>
                  <span>{t(props.locale, 'defaultOpenTarget')}</span>
                  <select value={props.defaultOpenTarget} onChange={(event) => props.onDefaultOpenTargetChange(event.target.value)}>
                    <option value="system">{t(props.locale, 'systemDefault')}</option>
                    {props.applications
                      .filter((application) => application.available && application.id !== 'system')
                      .map((application) => (
                        <option key={application.id} value={application.id}>
                          {application.name}
                        </option>
                      ))}
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
              </>
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
                <p>
                  {props.locale === 'zh-CN'
                    ? '崩溃报告仅在你明确启用后发送；Markdown 文件内容不会随设置同步。'
                    : 'Crash reports are sent only when you explicitly enable them. Markdown contents are never synchronized with settings.'}
                </p>
              </>
            ) : null}
            {pane === 'about' ? (
              <>
                <div className="settings-about">
                  <strong>TextMark</strong>
                  <span>v0.8.0</span>
                  <small>
                    {props.locale === 'zh-CN' ? '本地优先的 Markdown 阅读与编辑。' : 'A local-first Markdown reader and editor.'}
                  </small>
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
                <div className="settings-update">
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
      </section>
    </div>
  )
}
