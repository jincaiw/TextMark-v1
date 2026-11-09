import { useEffect } from 'react'
import { X } from 'lucide-react'
import type { DocumentSession, Locale } from '../types'

/** View ▸ Show All Tabs. The reference hands this command to AppKit's tab
    overview; TextMark's tabs live inside one window, so the same overview is
    drawn over the document area. */
export function DocumentOverview({
  sessions,
  activeId,
  locale,
  onActivate,
  onClose,
}: {
  sessions: DocumentSession[]
  activeId: string
  locale: Locale
  onActivate: (id: string) => void
  onClose: () => void
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [onClose])
  const title = locale === 'zh-CN' ? '所有标签页' : 'All Tabs'
  return (
    <div
      className="document-overview-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section className="document-overview" role="dialog" aria-modal="true" aria-label={title}>
        <header className="document-overview-header">
          <h2>{title}</h2>
          <button className="document-overview-close" onClick={onClose} aria-label={locale === 'zh-CN' ? '关闭' : 'Close'}>
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="document-overview-grid">
          {sessions.map((session) => (
            <button
              key={session.id}
              className={`document-overview-card ${session.id === activeId ? 'active' : ''}`}
              title={session.path ?? session.name}
              onClick={() => {
                onActivate(session.id)
                onClose()
              }}
            >
              <span className="document-overview-name">
                {session.name}
                {session.dirty ? ' •' : ''}
              </span>
              <span className="document-overview-path">{session.path ?? (locale === 'zh-CN' ? '未命名文稿' : 'Untitled')}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
