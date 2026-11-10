import { t } from '../lib/i18n'
import { DOCUMENT_FONT_FAMILIES } from '../lib/designTokens'
import { THEME_PRESETS } from '../lib/theme'
import type { Locale, ThemeMode, ThemePreset } from '../types'

interface AppearanceSettingsProps {
  locale: Locale
  theme: ThemeMode
  themePreset: ThemePreset
  onThemeChange: (theme: ThemeMode) => void
  onThemePresetChange: (preset: ThemePreset) => void
  onCustomizeTheme?: () => void
}

/** The Settings > Appearance pane mirrors the upstream Themes popover: a
 * 3×3 preset gallery plus the appearance picker. Deeper per-theme edits live
 * in the Customize Theme sheet, reached from the document toolbar. */
export function AppearanceSettings(props: AppearanceSettingsProps) {
  return (
    <div className="appearance-settings">
      <section className="theme-presets" aria-labelledby="theme-presets-title">
        <strong id="theme-presets-title">{t(props.locale, 'themePresets')}</strong>
        <div className="theme-preset-grid" role="group" aria-label={t(props.locale, 'themePresets')}>
          {(Object.entries(THEME_PRESETS) as Array<[ThemePreset, (typeof THEME_PRESETS)[ThemePreset]]>).map(([id, preset]) => {
            const scheme = preset.flavor === 'dark' ? 'dark' : 'light'
            const colors = preset[scheme]
            return (
              <button
                key={id}
                type="button"
                data-theme-preset={id}
                className={props.themePreset === id ? 'selected' : ''}
                aria-pressed={props.themePreset === id}
                title={preset.name}
                aria-label={preset.name}
                onClick={() => props.onThemePresetChange(id)}
              >
                <span
                  className="theme-preset-preview"
                  style={{
                    background: colors.windowBackground,
                    color: colors.textColor,
                    fontFamily: DOCUMENT_FONT_FAMILIES[preset.font],
                    fontWeight: preset.boldText ? 600 : 400,
                  }}
                >
                  <span className="theme-preset-aa">Aa</span>
                </span>
                <span>{preset.name}</span>
              </button>
            )
          })}
        </div>
      </section>
      <label>
        <span>{t(props.locale, 'appearance')}</span>
        <select value={props.theme} onChange={(event) => props.onThemeChange(event.target.value as ThemeMode)}>
          <option value="system">{t(props.locale, 'automatic')}</option>
          <option value="light">{t(props.locale, 'light')}</option>
          <option value="dark">{t(props.locale, 'dark')}</option>
        </select>
      </label>
      {props.onCustomizeTheme ? (
        <button type="button" className="settings-customize-theme" onClick={props.onCustomizeTheme}>
          {t(props.locale, 'customizeTheme')}…
        </button>
      ) : null}
    </div>
  )
}
