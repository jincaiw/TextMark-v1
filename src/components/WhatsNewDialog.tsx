import { X } from 'lucide-react'
import { useDialogAccessibility } from '../hooks/useDialogAccessibility'
import type { Locale } from '../types'

interface WhatsNewDialogProps {
  locale: Locale
  onClose: () => void
}

export function WhatsNewDialog({ locale, onClose }: WhatsNewDialogProps) {
  const backdropRef = useDialogAccessibility(true, onClose)
  const isChinese = locale === 'zh-CN'

  return (
    <div
      className="dialog-backdrop whats-new-backdrop"
      role="presentation"
      ref={backdropRef}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="conflict-dialog whats-new-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <h2 id="whats-new-title">{isChinese ? 'TextMark 更新内容' : "What's New in TextMark"}</h2>
            <p>{isChinese ? '目录跳转与文稿查找体验改进' : 'Improvements to outline navigation and document search'}</p>
          </div>
          <button type="button" aria-label={isChinese ? '关闭' : 'Close'} onClick={onClose}>
            <X size={16} />
          </button>
        </header>
        <ul>
          <li>
            <strong>{isChinese ? '长文档目录跳转更可靠' : 'More reliable outline navigation in long documents'}</strong>
            <span>
              {isChinese
                ? '编辑模式下点击目录可滚动到屏幕外的标题，同时保留当前编辑光标。'
                : 'In Edit Mode, selecting an offscreen heading scrolls it into view while preserving the current caret position.'}
            </span>
          </li>
          <li>
            <strong>{isChinese ? '工具栏查找不再重复显示' : 'Toolbar search has a single query field'}</strong>
            <span>
              {isChinese
                ? '搜索框直接在工具栏展开，不会再与查找栏重复；打开后会自动聚焦，工具栏空间不足时仍保持可用。'
                : 'The query expands in the toolbar without a duplicate field, receives focus when opened, and remains available when toolbar items overflow.'}
            </span>
          </li>
          <li>
            <strong>{isChinese ? '快捷键查找保留完整操作' : 'Keyboard search keeps full find controls'}</strong>
            <span>
              {isChinese
                ? '使用快捷键打开查找时，查找栏仍提供匹配计数、大小写选项和替换操作。'
                : 'Opening Find with its keyboard shortcut keeps the match count, case options, and replacement controls available.'}
            </span>
          </li>
          <li>
            <strong>{isChinese ? '随时重看更新说明' : 'Revisit release highlights'}</strong>
            <span>
              {isChinese ? '可从“帮助 → TextMark 更新内容”重新打开此窗口。' : 'Open this window again from Help → What’s New in TextMark.'}
            </span>
          </li>
        </ul>
        <footer>
          <button type="button" className="primary" onClick={onClose}>
            {isChinese ? '完成' : 'Done'}
          </button>
        </footer>
      </section>
    </div>
  )
}
