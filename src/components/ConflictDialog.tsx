import { t } from "../lib/i18n";
import type { ExternalChangeResolution, ExternalDocumentChange, Locale } from "../types";

export function ConflictDialog({ change, locale, onResolve }: { change: ExternalDocumentChange | null; locale: Locale; onResolve: (choice: ExternalChangeResolution) => void }) {
  if (!change) return null;
  const title = change.kind === "deleted" ? "deletedTitle" : change.kind === "renamed" ? "renamedTitle" : "conflictTitle";
  const body = change.kind === "deleted" ? "deletedBody" : change.kind === "renamed" ? "renamedBody" : "conflictBody";
  return <div className="dialog-backdrop"><section className="conflict-dialog" role="alertdialog" aria-modal="true" aria-labelledby="conflict-title" aria-describedby="conflict-body">
    <h2 id="conflict-title">{t(locale, title)}</h2><p id="conflict-body">{t(locale, body)}</p>
    <div>
      <button onClick={() => onResolve("cancel")}>{t(locale, "cancel")}</button>
      {change.kind === "deleted"
        ? <button onClick={() => onResolve("saveAs")}>{t(locale, "saveAsConflict")}</button>
        : <button onClick={() => onResolve("reload")}>{t(locale, change.kind === "renamed" ? "openRenamed" : "reload")}</button>}
      <button className="destructive" onClick={() => onResolve("overwrite")}>{t(locale, change.kind === "modified" ? "overwrite" : change.kind === "renamed" ? "recreateOriginal" : "recreate")}</button>
    </div>
  </section></div>;
}
