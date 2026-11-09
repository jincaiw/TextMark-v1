import { useRef } from 'react'
import { Plus, X } from 'lucide-react'
import { t } from '../lib/i18n'
import type { DocumentSession, Locale } from '../types'

export function DocumentTabs({
  sessions,
  activeId,
  locale,
  onActivate,
  onClose,
  alwaysVisible = false,
  hidden = false,
  onNew,
}: {
  sessions: DocumentSession[]
  activeId: string
  locale: Locale
  onActivate: (id: string) => void
  onClose: (id: string) => void
  alwaysVisible?: boolean
  /** View ▸ Hide Tab Bar: the reference hides the whole strip, even with
   * several documents open. */
  hidden?: boolean
  onNew?: () => void
}) {
  const tabRefs = useRef<Array<HTMLDivElement | null>>([])
  if (hidden) return null
  if (sessions.length < 2 && !alwaysVisible) return null
  const moveTo = (index: number) => {
    const target = (index + sessions.length) % sessions.length
    onActivate(sessions[target].id)
    tabRefs.current[target]?.focus()
  }
  return (
    <div
      className={`document-tabs ${alwaysVisible ? 'native-document-tabs' : ''} ${sessions.length === 1 ? 'single-document-tab' : ''}`}
      role="tablist"
      aria-label="Documents"
      data-tauri-drag-region
    >
      {sessions.map((session, index) => (
        <div
          key={session.id}
          ref={(node) => {
            tabRefs.current[index] = node
          }}
          className={`document-tab ${session.id === activeId ? 'active' : ''}`}
          role="tab"
          aria-selected={session.id === activeId}
          tabIndex={session.id === activeId ? 0 : -1}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') moveTo(index + 1)
            else if (event.key === 'ArrowLeft') moveTo(index - 1)
            else if (event.key === 'Home') moveTo(0)
            else if (event.key === 'End') moveTo(sessions.length - 1)
            else if (event.key === 'Enter' || event.key === ' ') onActivate(session.id)
            else if (event.key === 'Delete' || event.key === 'Backspace') onClose(session.id)
            else return
            event.preventDefault()
          }}
        >
          <button className="tab-label" onClick={() => onActivate(session.id)} title={session.path ?? session.name}>
            {session.name}
            {session.dirty ? ' •' : ''}
          </button>
          <button className="tab-close" aria-label={`${t(locale, 'closeTab')} ${session.name}`} onClick={() => onClose(session.id)}>
            <X />
          </button>
        </div>
      ))}
      {alwaysVisible && onNew ? (
        <button className="new-tab-button" type="button" aria-label={t(locale, 'newTab')} title={t(locale, 'newTab')} onClick={onNew}>
          <Plus />
        </button>
      ) : null}
    </div>
  )
}
