import { useDialogAccessibility } from '../hooks/useDialogAccessibility'
import type { DraftRecord } from '../lib/draftRecovery'
import type { Locale } from '../types'

export function DraftRecoveryDialog({
  record,
  locale,
  onRestore,
  onDiscard,
}: {
  record: DraftRecord
  locale: Locale
  onRestore: () => void
  onDiscard: () => void
}) {
  const isChinese = locale === 'zh-CN'
  const updatedAt = new Date(record.updatedAt).toLocaleString(isChinese ? 'zh-CN' : 'en-US')
  const backdropRef = useDialogAccessibility(true, onDiscard)
  return (
    <div className="dialog-backdrop" role="presentation" ref={backdropRef}>
      <section
        onMouseDown={(event) => event.stopPropagation()}
        className="conflict-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="draft-recovery-title"
        aria-describedby="draft-recovery-body"
      >
        <h2 id="draft-recovery-title">{isChinese ? '发现本地草稿' : 'Local draft found'}</h2>
        <p id="draft-recovery-body">
          {isChinese
            ? `“${record.name}” 在上次会话中有未保存的修改（${updatedAt}）。磁盘文件未被修改，是否恢复？`
            : `“${record.name}” has unsaved changes from the previous session (${updatedAt}). The disk file is unchanged. Restore it?`}
        </p>
        <div>
          <button className="destructive" onClick={onDiscard}>
            {isChinese ? '放弃草稿' : 'Discard Draft'}
          </button>
          <button onClick={onRestore}>{isChinese ? '恢复草稿' : 'Restore Draft'}</button>
        </div>
      </section>
    </div>
  )
}
