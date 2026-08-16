import { Bold, Code, Italic, Link, List, ListChecks, ListOrdered, Quote, Strikethrough } from 'lucide-react'
import type { FormatCommand } from '../types'
import type { Locale } from '../types'
import { t } from '../lib/i18n'

interface FormattingToolbarProps {
  onFormat: (command: FormatCommand) => void
  locale: Locale
}

export function FormattingToolbar({ onFormat, locale }: FormattingToolbarProps) {
  return (
    <div className="formatting-toolbar" role="toolbar" aria-label={t(locale, 'formatting')}>
      <select
        aria-label="Text style"
        defaultValue="h0"
        onChange={(event) => {
          onFormat(event.target.value as FormatCommand)
          event.currentTarget.value = 'h0'
        }}
      >
        <option value="h0">{t(locale, 'body')}</option>
        <option value="h1">{t(locale, 'heading1')}</option>
        <option value="h2">{t(locale, 'heading2')}</option>
        <option value="h3">{t(locale, 'heading3')}</option>
      </select>
      <span />
      <button title={t(locale, 'bold')} onClick={() => onFormat('bold')}>
        <Bold />
      </button>
      <button title={t(locale, 'italic')} onClick={() => onFormat('italic')}>
        <Italic />
      </button>
      <button title={t(locale, 'strikethrough')} onClick={() => onFormat('strikethrough')}>
        <Strikethrough />
      </button>
      <span />
      <button title={t(locale, 'bulletedList')} onClick={() => onFormat('bulletList')}>
        <List />
      </button>
      <button title={t(locale, 'numberedList')} onClick={() => onFormat('orderedList')}>
        <ListOrdered />
      </button>
      <button title={t(locale, 'checklist')} onClick={() => onFormat('taskList')}>
        <ListChecks />
      </button>
      <button title={t(locale, 'quote')} onClick={() => onFormat('quote')}>
        <Quote />
      </button>
      <span />
      <button title={t(locale, 'inlineCode')} onClick={() => onFormat('code')}>
        <Code />
      </button>
      <button title={t(locale, 'link')} onClick={() => onFormat('link')}>
        <Link />
      </button>
    </div>
  )
}
