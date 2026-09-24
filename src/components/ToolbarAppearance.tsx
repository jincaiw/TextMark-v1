import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CircleCheck, Contrast, Moon, Settings, Sun } from 'lucide-react'
import { nextZoomStep, ZOOM_STOPS } from '../constants'
import { t } from '../lib/i18n'
import { THEME_PRESETS } from '../lib/theme'
import type { Locale, ThemeMode, ThemePreset } from '../types'

export interface ToolbarAppearanceProps {
  locale: Locale
  zoom: number
  theme: ThemeMode
  themePreset: ThemePreset
  onZoomChange: (zoom: number) => void
  onThemeChange: (theme: ThemeMode) => void
  onThemePresetChange: (preset: ThemePreset) => void
  onCustomizeAppearance: () => void
  children: ReactNode
}

export function ToolbarAppearance(props: ToolbarAppearanceProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const openRef = useRef(false)
  const setPopoverOpen = (value: boolean) => {
    openRef.current = value
    setOpen(value)
  }
  const [showsScale, setShowsScale] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const tx = (key: Parameters<typeof t>[1]) => t(props.locale, key)
  const appearanceLabel = `${tx('appearance')}: ${tx(props.theme === 'system' ? 'automatic' : props.theme)}`
  const close = (restoreFocus = false) => {
    if (detailsRef.current) detailsRef.current.open = false
    setPopoverOpen(false)
    if (restoreFocus) detailsRef.current?.querySelector('summary')?.focus()
  }

  useEffect(() => {
    const details = detailsRef.current
    if (!open || !details) return
    const position = () => {
      const details = detailsRef.current
      const panel = panelRef.current
      if (!details || !panel) return
      const anchor = details.getBoundingClientRect()
      const panelWidth = panel.getBoundingClientRect().width
      const left = Math.max(8, Math.min(anchor.right - panelWidth, window.innerWidth - panelWidth - 8))
      panel.style.left = `${left - anchor.left}px`
    }
    const outside = (event: PointerEvent) => {
      if (!detailsRef.current?.contains(event.target as Node)) close()
    }
    const toggle = (event: Event) => {
      const next = (event.currentTarget as HTMLDetailsElement).open
      setPopoverOpen(next)
      if (!next) return
      window.requestAnimationFrame(position)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      close(true)
    }
    position()
    window.addEventListener('resize', position)
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    details?.addEventListener('toggle', toggle)
    return () => {
      window.removeEventListener('resize', position)
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
      details?.removeEventListener('toggle', toggle)
    }
  }, [open])

  useEffect(() => () => clearTimeout(timerRef.current), [])
  const changeZoom = (direction: 1 | -1) => {
    props.onZoomChange(nextZoomStep(props.zoom, direction))
    setShowsScale(true)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setShowsScale(false), 2000)
  }

  return (
    <details className="toolbar-group themes-and-settings" ref={detailsRef} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary title={tx('themesAndSettings')} aria-label={tx('themesAndSettings')} aria-expanded={open}>
        {props.children}
      </summary>
      <div className="appearance-popover" ref={panelRef} role="dialog" aria-label={tx('themesAndSettings')}>
        <div className="appearance-heading">{tx('themesAndSettings')}</div>
        <div className="appearance-quick-controls">
          <div>
            <div className="appearance-text-size" role="group" aria-label={tx('zoom')}>
              <button
                type="button"
                aria-label={tx('zoomOut')}
                title={tx('zoomOut')}
                disabled={props.zoom <= 50}
                onClick={() => changeZoom(-1)}
              >
                A
              </button>
              <button
                type="button"
                aria-label={tx('zoomIn')}
                title={tx('zoomIn')}
                disabled={props.zoom >= 300}
                onClick={() => changeZoom(1)}
              >
                A
              </button>
            </div>
            <div className="appearance-zoom-scale" aria-hidden="true" style={{ opacity: showsScale ? 1 : 0 }}>
              {ZOOM_STOPS.map((stop) => (
                <i key={stop} className={stop <= props.zoom ? 'filled' : ''} />
              ))}
            </div>
            <output className="visually-hidden" aria-live="polite">
              {props.zoom}%
            </output>
          </div>
          <button
            type="button"
            className="appearance-cycle"
            title={appearanceLabel}
            aria-label={appearanceLabel}
            onClick={() => props.onThemeChange(props.theme === 'system' ? 'light' : props.theme === 'light' ? 'dark' : 'system')}
          >
            {props.theme === 'system' ? <Contrast /> : props.theme === 'light' ? <Sun /> : <Moon />}
          </button>
        </div>
        <div className="appearance-presets" role="group" aria-label={props.locale === 'zh-CN' ? '主题预设' : 'Theme presets'}>
          {(Object.entries(THEME_PRESETS) as Array<[ThemePreset, (typeof THEME_PRESETS)[ThemePreset]]>).map(([id, preset]) => {
            const colors = preset[preset.flavor === 'dark' ? 'dark' : 'light']
            return (
              <button
                type="button"
                key={id}
                data-theme-preset={id}
                title={preset.name}
                aria-label={preset.name}
                aria-pressed={props.themePreset === id}
                onClick={() => props.onThemePresetChange(id)}
              >
                <span className="appearance-preset-sample" style={{ background: colors.windowBackground, color: colors.textColor }}>
                  <span>Aa</span>
                  <i style={{ background: colors.linkColor }} />
                  {props.themePreset === id ? <CircleCheck /> : null}
                </span>
                <span className="appearance-preset-name">{preset.name}</span>
              </button>
            )
          })}
        </div>
        <button
          type="button"
          className="appearance-customize"
          onClick={() => {
            close()
            props.onCustomizeAppearance()
          }}
        >
          <Settings />
          {props.locale === 'zh-CN' ? '自定义外观…' : 'Customize appearance…'}
        </button>
      </div>
    </details>
  )
}
