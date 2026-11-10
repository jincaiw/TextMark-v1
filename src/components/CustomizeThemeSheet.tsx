import { Check, ChevronDown, ChevronRight, MoveVertical, PanelBottomClose, Type, X } from 'lucide-react'
import { useEffect, useState, type ReactElement } from 'react'
import { DOCUMENT_FONT_FAMILIES, type DocumentFontName } from '../lib/designTokens'
import { t } from '../lib/i18n'
import { READER_LAYOUT_RANGES, READING_FONTS } from '../lib/settings'
import { resolvedThemePalette, THEME_PRESETS } from '../lib/theme'
import { useDialogAccessibility } from '../hooks/useDialogAccessibility'
import type { Locale, ThemeColorScheme, ThemeColorSlot, ThemeColors, ThemeMode, ThemePreset } from '../types'

/** Everything the sheet can change, held locally until Done applies it. */
export interface ReadingLook {
  documentFont: DocumentFontName
  themeColors: ThemeColors
  boldText: boolean
  readerCustomized: boolean
  characterSpacingPercent: number
  wordSpacingPercent: number
  marginsPercent: number
}

interface CustomizeThemeSheetProps {
  open: boolean
  locale: Locale
  theme: ThemeMode
  themePreset: ThemePreset
  look: ReadingLook
  onApply: (look: ReadingLook) => void
  onCancel: () => void
  onResetTheme: () => void
}

/** The Apple Books-style font list rendered in each face's own name. */
const FONT_LABELS: Record<DocumentFontName, string> = {
  system: 'Original',
  athelas: 'Athelas',
  avenirNext: 'Avenir Next',
  charter: 'Charter',
  georgia: 'Georgia',
  iowan: 'Iowan',
  newYork: 'New York',
  palatino: 'Palatino',
  rounded: 'SF Rounded',
  seravek: 'Seravek',
  timesNewRoman: 'Times New Roman',
  monospace: 'Monospace',
}

/** Only the four Customize Theme rows; the editor background is derived upstream. */
type CustomizeColorSlot = Exclude<ThemeColorSlot, 'editorBackground'>
const FONT_SLOT_ORDER: CustomizeColorSlot[] = ['windowBackground', 'codeBlockBackground', 'textColor', 'linkColor']

export function CustomizeThemeSheet(props: CustomizeThemeSheetProps) {
  const [draft, setDraft] = useState<ReadingLook>(props.look)
  const [showsFontList, setShowsFontList] = useState(false)
  useEffect(() => {
    if (props.open) setDraft(props.look)
  }, [props.look, props.open])
  const backdropRef = useDialogAccessibility(props.open, props.onCancel)
  const tx = (key: Parameters<typeof t>[1]) => t(props.locale, key)
  const preset = THEME_PRESETS[props.themePreset]
  const scheme: ThemeColorScheme = props.theme === 'dark' ? 'dark' : 'light'
  const color = (slot: CustomizeColorSlot, overrides: ThemeColors) => resolvedThemePalette(props.themePreset, scheme, overrides)[slot]
  const fonts = READING_FONTS
  if (!props.open) return null
  const setColor = (slot: CustomizeColorSlot, value: string) =>
    setDraft((current) => ({
      ...current,
      themeColors: { ...current.themeColors, [scheme]: { ...current.themeColors[scheme], [slot]: value.toUpperCase() } },
    }))
  const sliderRow = (
    labelKey: Parameters<typeof t>[1],
    icon: ReactElement,
    value: number,
    range: { min: number; max: number; step: number },
    apply: (next: number) => void,
    format: (value: number) => string = (v) => `${Math.round(v)}%`,
  ) => (
    <label className="customize-slider">
      <span className="customize-slider-heading">{tx(labelKey)}</span>
      <span className="customize-slider-row">
        {icon}
        <input
          type="range"
          min={range.min}
          max={range.max}
          step={range.step}
          value={value}
          onChange={(event) => apply(Number(event.target.value))}
          aria-label={tx(labelKey)}
        />
        <output>{format(value)}</output>
      </span>
    </label>
  )
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={props.onCancel} ref={backdropRef}>
      <section
        className="customize-theme-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customize-theme-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div
          className="customize-theme-sample"
          style={{ background: color('windowBackground', draft.themeColors), color: color('textColor', draft.themeColors) }}
        >
          <header className="customize-theme-header">
            <button
              type="button"
              className="customize-theme-cancel"
              aria-label={tx('cancel')}
              title={tx('cancel')}
              onClick={props.onCancel}
            >
              <X />
            </button>
            <h2 id="customize-theme-title">{tx('customizeTheme')}</h2>
            <button
              type="button"
              className="customize-theme-done"
              aria-label={tx('done')}
              title={tx('done')}
              onClick={() => props.onApply(draft)}
            >
              <Check />
            </button>
          </header>
          <div
            className="customize-theme-prose"
            style={{ fontFamily: DOCUMENT_FONT_FAMILIES[draft.documentFont], fontWeight: draft.boldText ? 600 : 400 }}
          >
            <p style={{ margin: 0 }}>
              {props.locale === 'zh-CN' ? '山有木兮木有枝，心悦君兮君不知。' : 'The quick brown fox jumps over the lazy dog.'}
            </p>
            <p style={{ margin: '0.8em 0 0', fontSize: '0.86em' }}>
              <code
                className="customize-theme-code"
                style={{ background: color('codeBlockBackground', draft.themeColors), padding: '2px 4px', borderRadius: 4 }}
              >
                {props.locale === 'zh-CN' ? 'code()' : 'inline_code()'}
              </code>{' '}
              <a href="#" onClick={(event) => event.preventDefault()} style={{ color: color('linkColor', draft.themeColors) }}>
                {props.locale === 'zh-CN' ? '链接' : 'link'}
              </a>
            </p>
          </div>
        </div>
        <div className="customize-theme-form">
          <section aria-label={tx('fontSection')}>
            <button
              type="button"
              className="customize-theme-font-header"
              aria-expanded={showsFontList}
              onClick={() => setShowsFontList((open) => !open)}
            >
              <Type />
              <span>{tx('font')}</span>
              <span className="customize-theme-font-current">{FONT_LABELS[draft.documentFont]}</span>
              {showsFontList ? <ChevronDown /> : <ChevronRight />}
            </button>
            {showsFontList ? (
              <ul className="customize-theme-fonts" role="listbox" aria-label={tx('font')}>
                {fonts.map((font) => (
                  <li key={font} role="option" aria-selected={draft.documentFont === font}>
                    <button
                      type="button"
                      style={{ fontFamily: DOCUMENT_FONT_FAMILIES[font] }}
                      onClick={() => setDraft((current) => ({ ...current, documentFont: font }))}
                    >
                      {FONT_LABELS[font]}
                      {draft.documentFont === font ? <Check /> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <label className="customize-theme-toggle">
              <span>{tx('boldText')}</span>
              <input
                type="checkbox"
                checked={draft.boldText}
                onChange={(event) => setDraft((current) => ({ ...current, boldText: event.target.checked }))}
              />
            </label>
          </section>
          <section aria-label={tx('layoutOptions')}>
            <label className="customize-theme-toggle">
              <span>{tx('customizeGate')}</span>
              <input
                type="checkbox"
                checked={draft.readerCustomized}
                onChange={(event) => setDraft((current) => ({ ...current, readerCustomized: event.target.checked }))}
              />
            </label>
            {draft.readerCustomized ? (
              <>
                {sliderRow(
                  'characterSpacing',
                  <MoveVertical aria-hidden />,
                  draft.characterSpacingPercent,
                  READER_LAYOUT_RANGES.characterSpacing,
                  (next) => setDraft((current) => ({ ...current, characterSpacingPercent: next })),
                )}
                {sliderRow('wordSpacing', <Type aria-hidden />, draft.wordSpacingPercent, READER_LAYOUT_RANGES.wordSpacing, (next) =>
                  setDraft((current) => ({ ...current, wordSpacingPercent: next })),
                )}
                {sliderRow('margins', <PanelBottomClose aria-hidden />, draft.marginsPercent, READER_LAYOUT_RANGES.margins, (next) =>
                  setDraft((current) => ({ ...current, marginsPercent: next })),
                )}
              </>
            ) : null}
          </section>
          <section aria-label={tx('themeColors')}>
            {FONT_SLOT_ORDER.map((slot) => (
              <label key={slot} className="customize-theme-color">
                <span>{tx(slot)}</span>
                <span className="customize-theme-wells">
                  {props.theme === 'system' ? (
                    <>
                      {(['light', 'dark'] as const).map((wellScheme) => (
                        <span key={wellScheme} className="customize-theme-well">
                          <small>{tx(wellScheme === 'light' ? 'light' : 'dark')}</small>
                          <input
                            type="color"
                            aria-label={`${tx(wellScheme === 'light' ? 'light' : 'dark')} ${slot}`}
                            value={resolvedThemePalette(props.themePreset, wellScheme, draft.themeColors)[slot]}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                themeColors: {
                                  ...current.themeColors,
                                  [wellScheme]: { ...current.themeColors[wellScheme], [slot]: event.target.value.toUpperCase() },
                                },
                              }))
                            }
                          />
                        </span>
                      ))}
                    </>
                  ) : (
                    <input
                      type="color"
                      aria-label={`${tx(slot)} ${tx(props.theme)}`}
                      value={color(slot, draft.themeColors)}
                      onChange={(event) => setColor(slot, event.target.value)}
                    />
                  )}
                </span>
              </label>
            ))}
            <p className="customize-theme-note">
              {props.theme === 'system' ? tx('themeColorsAutomaticNote') : tx('themeColorsPinnedNote')}
            </p>
          </section>
          <button
            type="button"
            className="customize-theme-reset"
            onClick={props.onResetTheme}
            disabled={
              preset.flavor === 'system' &&
              !props.look.boldText &&
              Object.keys(props.look.themeColors).length === 0 &&
              props.look.documentFont === preset.font
            }
          >
            {tx('resetTheme')}
          </button>
        </div>
      </section>
    </div>
  )
}
