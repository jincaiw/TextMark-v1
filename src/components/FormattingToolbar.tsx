import { Bold, ChevronDown, Code, Highlighter, Italic, Link, List, ListChecks, ListOrdered, Plus, Quote, Strikethrough } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import type { EditorFormattingState, FormatCommand, Locale } from '../types'
import { t } from '../lib/i18n'

interface FormattingToolbarProps {
  onFormat: (command: FormatCommand) => void
  onInsertLink: (label: string, destination: string) => void
  locale: Locale
  state: EditorFormattingState
}

export function FormattingToolbar({ onFormat, onInsertLink, locale, state }: FormattingToolbarProps) {
  const [linkLabel, setLinkLabel] = useState('')
  const [linkDestination, setLinkDestination] = useState('https://')
  useEffect(() => {
    const closeOutsideMenus = (event: Event) => {
      document.querySelectorAll<HTMLDetailsElement>('.formatting-toolbar details[open]').forEach((menu) => {
        if (!menu.contains(event.target as Node)) menu.open = false
      })
    }
    const closeMenusOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const menus = [...document.querySelectorAll<HTMLDetailsElement>('.formatting-toolbar details[open]')]
      if (!menus.length) return
      event.preventDefault()
      menus.forEach((menu) => {
        menu.open = false
      })
      menus[menus.length - 1]?.querySelector<HTMLElement>('summary')?.focus()
    }
    document.addEventListener('pointerdown', closeOutsideMenus)
    document.addEventListener('click', closeOutsideMenus)
    document.addEventListener('keydown', closeMenusOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutsideMenus)
      document.removeEventListener('click', closeOutsideMenus)
      document.removeEventListener('keydown', closeMenusOnEscape)
    }
  }, [])
  const labels =
    locale === 'zh-CN'
      ? {
          list: '列表',
          unordered: '无序列表',
          ordered: '有序列表',
          checklist: '任务列表',
          more: '更多格式',
          quote: '引用',
          codeBlock: '代码块',
          rule: '水平分隔线',
        }
      : {
          list: 'Lists',
          unordered: 'Bulleted list',
          ordered: 'Numbered list',
          checklist: 'Task list',
          more: 'More Formatting',
          quote: 'Block quote',
          codeBlock: 'Code block',
          rule: 'Horizontal rule',
        }

  const button = (command: FormatCommand, label: string, icon: ReactNode, active = false) => (
    <button
      key={command}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onFormat(command)}
    >
      {icon}
    </button>
  )

  return (
    <div className="formatting-toolbar" role="toolbar" aria-label={t(locale, 'formatting')}>
      <div className="formatting-group formatting-style-group" role="group" aria-label={t(locale, 'formatting')}>
        <select
          className="formatting-heading"
          aria-label="Text style"
          value={state.heading}
          onChange={(event) => onFormat(event.target.value as FormatCommand)}
        >
          <option value="h0">{t(locale, 'body')}</option>
          <option value="h1">{t(locale, 'heading1')}</option>
          <option value="h2">{t(locale, 'heading2')}</option>
          <option value="h3">{t(locale, 'heading3')}</option>
          <option value="h4">{t(locale, 'heading4')}</option>
          <option value="h5">{t(locale, 'heading5')}</option>
          <option value="h6">{t(locale, 'heading6')}</option>
        </select>
      </div>
      <div className="formatting-group" role="group" aria-label={t(locale, 'bold')}>
        {button('bold', t(locale, 'bold'), <Bold />, state.bold)}
        {button('italic', t(locale, 'italic'), <Italic />, state.italic)}
        {button('strikethrough', t(locale, 'strikethrough'), <Strikethrough />, state.strikethrough)}
      </div>
      <details className="formatting-group formatting-menu formatting-link-menu" role="group">
        <summary aria-label={t(locale, 'link')} title={t(locale, 'link')} aria-pressed={state.link}>
          <Link />
        </summary>
        <form
          className="formatting-link-popover"
          onSubmit={(event) => {
            event.preventDefault()
            if (!linkDestination.trim() || linkDestination.trim() === 'https://') return
            onInsertLink(linkLabel, linkDestination)
            event.currentTarget.parentElement?.removeAttribute('open')
            setLinkLabel('')
            setLinkDestination('https://')
          }}
        >
          <label>
            <span>{locale === 'zh-CN' ? '链接文本' : 'Text'}</span>
            <input
              autoComplete="off"
              value={linkLabel}
              onChange={(event) => setLinkLabel(event.target.value)}
              placeholder={locale === 'zh-CN' ? '选中文本或输入标签' : 'Selected text or label'}
            />
          </label>
          <label>
            <span>{locale === 'zh-CN' ? '网址' : 'URL'}</span>
            <input
              autoComplete="url"
              type="url"
              required
              value={linkDestination}
              onChange={(event) => setLinkDestination(event.target.value)}
              onFocus={(event) => event.target.select()}
            />
          </label>
          <button type="submit">{locale === 'zh-CN' ? '插入链接' : 'Insert Link'}</button>
        </form>
      </details>
      <details className="formatting-group formatting-menu" role="group">
        <summary aria-label={labels.list} title={labels.list}>
          {state.orderedList ? <ListOrdered /> : state.taskList ? <ListChecks /> : <List />}
          <ChevronDown />
        </summary>
        <div
          className="formatting-menu-popover"
          role="menu"
          aria-label={labels.list}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest('button')) event.currentTarget.parentElement?.removeAttribute('open')
          }}
        >
          {button('bulletList', labels.unordered, <List />, state.bulletList)}
          {button('orderedList', labels.ordered, <ListOrdered />, state.orderedList)}
          {button('taskList', labels.checklist, <ListChecks />, state.taskList)}
        </div>
      </details>
      <details className="formatting-group formatting-menu" role="group">
        <summary aria-label={labels.more} title={labels.more}>
          <Plus />
          <ChevronDown />
        </summary>
        <div
          className="formatting-menu-popover"
          role="menu"
          aria-label={labels.more}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest('button')) event.currentTarget.parentElement?.removeAttribute('open')
          }}
        >
          {button('quote', labels.quote, <Quote />, state.quote)}
          {button('code', t(locale, 'inlineCode'), <Code />, state.code)}
          {button('highlight', t(locale, 'highlight'), <Highlighter />, state.highlight)}
          {button('codeBlock', labels.codeBlock, <Code />)}
          {button('horizontalRule', labels.rule, <span className="formatting-rule-icon">―</span>)}
        </div>
      </details>
    </div>
  )
}
