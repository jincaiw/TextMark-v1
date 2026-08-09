import { t } from "../lib/i18n";
import type { Locale } from "../types";

export function ConflictDialog({ open, locale, onResolve }: { open: boolean; locale: Locale; onResolve: (choice: "reload" | "overwrite" | "cancel") => void }) {
  if (!open) return null;
  return <div className="dialog-backdrop"><section className="conflict-dialog" role="alertdialog" aria-modal="true" aria-labelledby="conflict-title" aria-describedby="conflict-body">
    <h2 id="conflict-title">{t(locale, "conflictTitle")}</h2><p id="conflict-body">{t(locale, "conflictBody")}</p>
    <div><button onClick={() => onResolve("cancel")}>{t(locale, "cancel")}</button><button onClick={() => onResolve("reload")}>{t(locale, "reload")}</button><button className="destructive" onClick={() => onResolve("overwrite")}>{t(locale, "overwrite")}</button></div>
  </section></div>;
}
