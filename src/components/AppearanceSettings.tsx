import { RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { t } from '../lib/i18n'
import { READER_LAYOUT_DEFAULTS, READER_LAYOUT_RANGES, readerPageInset, DOCUMENT_FONT_FAMILIES } from '../lib/designTokens'
import { isAppearanceLocked, resolvedThemePalette, THEME_COLOR_SLOTS, THEME_PRESETS } from '../lib/theme'
import type { DocumentFont, Locale, ReaderLayout, ThemeColorScheme, ThemeColorSlot, ThemeColors, ThemeMode, ThemePreset } from '../types'

interface AppearanceSettingsProps {
  locale: Locale
  theme: ThemeMode
  themePreset: ThemePreset
  themeColors: ThemeColors
  documentFont: DocumentFont
  readerLayout: ReaderLayout
  onThemeChange: (theme: ThemeMode) => void
  onThemePresetChange: (preset: ThemePreset) => void
  onThemeColorChange: (scheme: ThemeColorScheme, slot: ThemeColorSlot, color: string) => void
  onThemeColorsReset: () => void
  onDocumentFontChange: (font: DocumentFont) => void
  onReaderLayoutChange: (layout: Partial<ReaderLayout>) => void
}

type AppearanceSection = 'themes' | 'font' | 'layout' | 'colors'

/** The reading prose of the upstream ThemeSamplePage: ordinary sentences long
 * enough that spacing, margins and line rhythm read as themselves. */
const SAMPLE_PROSE =
  'The team looking after our recommendation system has been spiking out some new algorithms, and the results are promising enough that we are planning to put them in front of readers next month. Long paragraphs are what make a reading face show its character: the rhythm of the lines, how the spacing settles, where the eye lands when it returns from the end of one line to the start of the next.'

export function AppearanceSettings(props: AppearanceSettingsProps) {
  const hasOverrides = Object.keys(props.themeColors).length > 0
  const appearanceLocked = isAppearanceLocked(props.themePreset)
  const [section, setSection] = useState<AppearanceSection>('themes')
  const layout = props.readerLayout
  const effectiveLayout: ReaderLayout = layout.isCustomized
    ? layout
    : { ...layout, lineSpacing: READER_LAYOUT_DEFAULTS.lineSpacing, characterSpacingPercent: 0, wordSpacingPercent: 0, marginsPercent: 0 }
  // The Reset Theme button enables when the reading look drifts from the
  // applied preset's own colors (upstream compares readingLook to the
  // appliedPresetLook; color overrides are the part TextMark can derive).
  const isDefaultLook = !hasOverrides && !layout.isCustomized && !layout.boldText
  const resetTheme = () => {
    props.onThemeColorsReset()
    props.onReaderLayoutChange({ ...READER_LAYOUT_DEFAULTS })
  }
  return (
    <div className="appearance-settings">
      <label>
        <span>{t(props.locale, 'appearance')}</span>
        <select
          value={appearanceLocked ? THEME_PRESETS[props.themePreset].flavor : props.theme}
          disabled={appearanceLocked}
          onChange={(event) => props.onThemeChange(event.target.value as ThemeMode)}
        >
          <option value="system">{t(props.locale, 'automatic')}</option>
          <option value="light">{t(props.locale, 'light')}</option>
          <option value="dark">{t(props.locale, 'dark')}</option>
        </select>
      </label>
      <small className="settings-caption">
        {appearanceLocked
          ? props.locale === 'zh-CN'
            ? '此主题使用固定外观。选择 Original 即可更改。'
            : 'This theme uses a fixed appearance. Choose Original to change it.'
          : props.locale === 'zh-CN'
            ? '外观同时应用于快速预览。'
            : 'Appearance also applies to Quick Look previews.'}
      </small>
      <ThemeSamplePage locale={props.locale} themePreset={props.themePreset} themeColors={props.themeColors} layout={effectiveLayout} />
      <div className="appearance-section-picker" role="tablist" aria-label={props.locale === 'zh-CN' ? '外观区段' : 'Appearance sections'}>
        {(
          [
            ['themes', 'sectionThemes'],
            ['font', 'sectionFont'],
            ['layout', 'sectionLayout'],
            ['colors', 'sectionColors'],
          ] as const
        ).map(([id, key]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={section === id}
            className={section === id ? 'selected' : ''}
            onClick={() => setSection(id)}
          >
            {t(props.locale, key)}
          </button>
        ))}
      </div>
      {section === 'themes' ? (
        <section className="theme-presets" aria-labelledby="theme-presets-title">
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
      ) : null}
      {section === 'font' ? (
        <div className="appearance-section">
          <label>
            <span>{t(props.locale, 'documentFont')}</span>
            <select value={props.documentFont} onChange={(event) => props.onDocumentFontChange(event.target.value as DocumentFont)}>
              {(
                [
                  ['system', 'fontSystem'],
                  ['athelas', 'fontAthelas'],
                  ['avenirNext', 'fontAvenirNext'],
                  ['charter', 'fontCharter'],
                  ['georgia', 'fontGeorgia'],
                  ['iowan', 'fontIowan'],
                  ['newYork', 'fontNewYork'],
                  ['palatino', 'fontPalatino'],
                  ['rounded', 'fontRounded'],
                  ['seravek', 'fontSeravek'],
                  ['timesNewRoman', 'fontTimesNewRoman'],
                  ['monospace', 'fontMonospace'],
                ] as const
              ).map(([value, key]) => (
                <option key={value} value={value}>
                  {t(props.locale, key)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t(props.locale, 'boldText')}</span>
            <input
              type="checkbox"
              checked={layout.boldText}
              onChange={(event) => props.onReaderLayoutChange({ boldText: event.target.checked })}
            />
          </label>
        </div>
      ) : null}
      {section === 'layout' ? (
        <div className="appearance-section">
          <label>
            <span>{t(props.locale, 'customize')}</span>
            <input
              type="checkbox"
              checked={layout.isCustomized}
              onChange={(event) => props.onReaderLayoutChange({ isCustomized: event.target.checked })}
            />
          </label>
          <small className="settings-caption">{t(props.locale, 'layoutCustomizeCaption')}</small>
          {(
            [
              ['spacingLine', 'lineSpacing', READER_LAYOUT_RANGES.lineSpacing, (value: number) => value.toFixed(2)],
              ['spacingCharacter', 'characterSpacingPercent', READER_LAYOUT_RANGES.characterSpacingPercent, (value: number) => `${value}%`],
              ['spacingWord', 'wordSpacingPercent', READER_LAYOUT_RANGES.wordSpacingPercent, (value: number) => `${value}%`],
              ['spacingMargins', 'marginsPercent', READER_LAYOUT_RANGES.marginsPercent, (value: number) => `${value}%`],
            ] as const
          ).map(([key, field, range, display]) => (
            <label key={field}>
              <span>{t(props.locale, key)}</span>
              <div className="setting-range">
                <input
                  type="range"
                  min={range.min}
                  max={range.max}
                  step={range.step}
                  value={layout[field]}
                  disabled={!layout.isCustomized}
                  aria-label={t(props.locale, key)}
                  onChange={(event) => props.onReaderLayoutChange({ [field]: Number(event.target.value) })}
                />
                <output>{display(layout[field])}</output>
              </div>
            </label>
          ))}
        </div>
      ) : null}
      {section === 'colors' ? (
        <div className="theme-colors" aria-label={props.locale === 'zh-CN' ? '主题颜色' : 'Theme colors'}>
          {/* Upstream lays each slot out as one row with the Light and Dark
           * color wells side by side (ThemeSettingsView.swift:229-245), so a
           * look can be tuned for both schemes without scrolling between
           * fieldsets. The header row carries the Light/Dark captions. */}
          <div className="theme-color-row theme-color-head" aria-hidden="true">
            <span />
            <span>{t(props.locale, 'light')}</span>
            <span>{t(props.locale, 'dark')}</span>
          </div>
          {THEME_COLOR_SLOTS.map((slot) => (
            <div key={slot} className="theme-color-row">
              <span>{themeSlotLabel(slot, props.locale)}</span>
              {(['light', 'dark'] as const).map((scheme) => {
                const colors = resolvedThemePalette(props.themePreset, scheme, props.themeColors)
                return (
                  <input
                    key={scheme}
                    type="color"
                    aria-label={`${scheme === 'light' ? t(props.locale, 'light') : t(props.locale, 'dark')} ${themeSlotLabel(slot, props.locale)}`}
                    value={colors[slot]}
                    onChange={(event) => props.onThemeColorChange(scheme, slot, event.target.value)}
                  />
                )
              })}
            </div>
          ))}
        </div>
      ) : null}
      <div className="appearance-reset-row">
        <button type="button" disabled={isDefaultLook} onClick={resetTheme}>
          <RotateCcw />
          {t(props.locale, 'resetTheme')}
        </button>
      </div>
    </div>
  )
}

/** The live sample page from the upstream ThemeSamplePage: an "Aa" in the
 * reading face over prose set with the look's spacing and margins, cut off
 * by a fade at the bottom. */
function ThemeSamplePage({
  locale,
  themePreset,
  themeColors,
  layout,
}: {
  locale: Locale
  themePreset: ThemePreset
  themeColors: ThemeColors
  layout: ReaderLayout
}) {
  const scheme: ThemeColorScheme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  const colors = resolvedThemePalette(themePreset, scheme, themeColors)
  const inset = 28 + readerPageInset(layout.marginsPercent)
  return (
    <div className="theme-sample-page" style={{ background: colors.windowBackground, color: colors.textColor }}>
      <span className="theme-sample-title" style={{ fontWeight: layout.boldText ? 700 : 500 }}>
        Aa
      </span>
      <div
        className="theme-sample-prose"
        style={{
          fontFamily: DOCUMENT_FONT_FAMILIES.system,
          fontWeight: layout.boldText ? 600 : 400,
          lineHeight: layout.lineSpacing,
          letterSpacing: `${layout.characterSpacingPercent / 100}em`,
          wordSpacing: `${layout.wordSpacingPercent / 100}em`,
          paddingInline: inset,
        }}
      >
        {SAMPLE_PROSE}
        <span className="sr-only">{t(locale, 'appearance')}</span>
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
