import { RotateCcw } from 'lucide-react'
import { t } from '../lib/i18n'
import { resolvedThemePalette, THEME_COLOR_SLOTS, THEME_PRESETS } from '../lib/theme'
import type { Locale, ThemeColorScheme, ThemeColorSlot, ThemeColors, ThemeMode, ThemePreset } from '../types'

interface AppearanceSettingsProps {
  locale: Locale
  theme: ThemeMode
  themePreset: ThemePreset
  themeColors: ThemeColors
  onThemeChange: (theme: ThemeMode) => void
  onThemePresetChange: (preset: ThemePreset) => void
  onThemeColorChange: (scheme: ThemeColorScheme, slot: ThemeColorSlot, color: string) => void
  onThemeColorsReset: () => void
}

export function AppearanceSettings(props: AppearanceSettingsProps) {
  const hasOverrides = Object.keys(props.themeColors).length > 0
  return (
    <div className="appearance-settings">
      <label>
        <span>{t(props.locale, 'appearance')}</span>
        <select value={props.theme} onChange={(event) => props.onThemeChange(event.target.value as ThemeMode)}>
          <option value="system">{t(props.locale, 'automatic')}</option>
          <option value="light">{t(props.locale, 'light')}</option>
          <option value="dark">{t(props.locale, 'dark')}</option>
        </select>
      </label>
      <section className="theme-presets" aria-labelledby="theme-presets-title">
        <strong id="theme-presets-title">{props.locale === 'zh-CN' ? '主题预设' : 'Theme presets'}</strong>
        <div className="theme-preset-grid">
          {(Object.entries(THEME_PRESETS) as Array<[ThemePreset, (typeof THEME_PRESETS)[ThemePreset]]>).map(([id, preset]) => {
            const scheme = preset.flavor === 'dark' ? 'dark' : 'light'
            const colors = preset[scheme]
            return (
              <button
                key={id}
                type="button"
                className={props.themePreset === id ? 'selected' : ''}
                aria-pressed={props.themePreset === id}
                onClick={() => props.onThemePresetChange(id)}
              >
                <span className="theme-preset-preview" style={{ background: colors.windowBackground, color: colors.textColor }}>
                  <i style={{ background: colors.linkColor }} />
                  <i style={{ background: colors.codeBlockBackground }} />
                  <i style={{ background: colors.textColor }} />
                </span>
                <span>{preset.name}</span>
              </button>
            )
          })}
        </div>
      </section>
      <div className="theme-colors" aria-label={props.locale === 'zh-CN' ? '主题颜色' : 'Theme colors'}>
        <div className="theme-colors-heading">
          <strong>{props.locale === 'zh-CN' ? '自定义颜色' : 'Custom colors'}</strong>
          <button type="button" disabled={!hasOverrides} onClick={props.onThemeColorsReset}>
            <RotateCcw />
            {props.locale === 'zh-CN' ? '恢复默认' : 'Reset'}
          </button>
        </div>
        {(['light', 'dark'] as const).map((scheme) => {
          const colors = resolvedThemePalette(props.themePreset, scheme, props.themeColors)
          return (
            <fieldset key={scheme}>
              <legend>{scheme === 'light' ? t(props.locale, 'light') : t(props.locale, 'dark')}</legend>
              {THEME_COLOR_SLOTS.map((slot) => (
                <label key={slot}>
                  <span>{themeSlotLabel(slot, props.locale)}</span>
                  <input
                    type="color"
                    aria-label={`${scheme === 'light' ? t(props.locale, 'light') : t(props.locale, 'dark')} ${themeSlotLabel(slot, props.locale)}`}
                    value={colors[slot]}
                    onChange={(event) => props.onThemeColorChange(scheme, slot, event.target.value)}
                  />
                </label>
              ))}
            </fieldset>
          )
        })}
      </div>
    </div>
  )
}

function themeSlotLabel(slot: ThemeColorSlot, locale: Locale) {
  const zh: Record<ThemeColorSlot, string> = {
    windowBackground: '窗口背景',
    editorBackground: '编辑器背景',
    codeBlockBackground: '代码背景',
    textColor: '正文文字',
    linkColor: '链接颜色',
  }
  const en: Record<ThemeColorSlot, string> = {
    windowBackground: 'Window background',
    editorBackground: 'Editor background',
    codeBlockBackground: 'Code background',
    textColor: 'Text',
    linkColor: 'Links',
  }
  return (locale === 'zh-CN' ? zh : en)[slot]
}
