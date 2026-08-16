import { CaseSensitive, ChevronDown, ChevronUp } from 'lucide-react'
import { t } from '../lib/i18n'
import type { Locale, SearchMode } from '../types'

interface FindBarProps {
  query: string
  current: number
  count: number
  matchCase: boolean
  mode: SearchMode
  locale: Locale
  onQueryChange: (value: string) => void
  onPrevious: () => void
  onNext: () => void
  onMatchCaseChange: (value: boolean) => void
  onModeChange: (mode: SearchMode) => void
  onClose: () => void
}

export function FindBar(props: FindBarProps) {
  const modeToggle = (value: SearchMode, label: Parameters<typeof t>[1]) => (
    <button
      role="button"
      aria-pressed={props.mode === value}
      className={`find-mode ${props.mode === value ? 'selected' : ''}`}
      onClick={() => props.onModeChange(value)}
    >
      {t(props.locale, label)}
    </button>
  )
  return (
    <div className="find-bar" role="search">
      <input
        autoFocus
        value={props.query}
        onChange={(event) => props.onQueryChange(event.target.value)}
        placeholder={t(props.locale, 'find')}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.shiftKey ? props.onPrevious() : props.onNext()
          if (event.key === 'Escape') props.onClose()
        }}
      />
      <span className="find-match-label">{t(props.locale, 'match')}</span>
      {modeToggle('contains', 'contains')}
      {modeToggle('beginsWith', 'beginsWith')}
      <span className="find-count">
        {props.query
          ? props.count
            ? t(props.locale, 'matchCount', { current: props.current + 1, count: props.count })
            : t(props.locale, 'notFound')
          : ''}
      </span>
      <button
        className={`find-icon ${props.matchCase ? 'selected' : ''}`}
        title={t(props.locale, 'matchCase')}
        aria-pressed={props.matchCase}
        onClick={() => props.onMatchCaseChange(!props.matchCase)}
      >
        <CaseSensitive />
      </button>
      <button className="find-icon" title={t(props.locale, 'previousMatch')} disabled={!props.count} onClick={props.onPrevious}>
        <ChevronUp />
      </button>
      <button className="find-icon" title={t(props.locale, 'nextMatch')} disabled={!props.count} onClick={props.onNext}>
        <ChevronDown />
      </button>
      <button className="find-done" onClick={props.onClose}>
        {t(props.locale, 'done')}
      </button>
    </div>
  )
}
