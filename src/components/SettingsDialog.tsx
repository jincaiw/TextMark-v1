import { X } from "lucide-react";
import { t } from "../lib/i18n";
import type { ContentWidth, Locale, ThemeMode } from "../types";

interface SettingsDialogProps {
  open: boolean;
  theme: ThemeMode;
  contentWidth: ContentWidth;
  editorFontSize: number;
  locale: Locale;
  crashReports: boolean;
  onLocaleChange: (locale: Locale) => void;
  onCrashReportsChange: (enabled: boolean) => void;
  onThemeChange: (theme: ThemeMode) => void;
  onContentWidthChange: (width: ContentWidth) => void;
  onEditorFontSizeChange: (size: number) => void;
  onClose: () => void;
}

export function SettingsDialog(props: SettingsDialogProps) {
  if (!props.open) return null;
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={props.onClose}>
      <section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}>
        <header><h2 id="settings-title">TextMark {t(props.locale, "preferences")}</h2><button onClick={props.onClose} aria-label={t(props.locale, "close")}><X /></button></header>
        <label><span>{t(props.locale, "language")}</span><select value={props.locale} onChange={(event) => props.onLocaleChange(event.target.value as Locale)}><option value="zh-CN">{t(props.locale, "chinese")}</option><option value="en">{t(props.locale, "english")}</option></select></label>
        <label><span>{t(props.locale, "appearance")}</span><select value={props.theme} onChange={(event) => props.onThemeChange(event.target.value as ThemeMode)}><option value="system">{t(props.locale, "automatic")}</option><option value="light">{t(props.locale, "light")}</option><option value="dark">{t(props.locale, "dark")}</option></select></label>
        <label><span>{t(props.locale, "contentWidth")}</span><select value={props.contentWidth} onChange={(event) => props.onContentWidthChange(event.target.value as ContentWidth)}><option value="normal">{t(props.locale, "normal")}</option><option value="full">{t(props.locale, "fullWidth")}</option></select></label>
        <label><span>{t(props.locale, "editorFontSize")}</span><div className="setting-range"><input type="range" min="12" max="24" value={props.editorFontSize} onChange={(event) => props.onEditorFontSizeChange(Number(event.target.value))} /><output>{props.editorFontSize}px</output></div></label>
        <label><span>{t(props.locale, "crashReports")}</span><input type="checkbox" checked={props.crashReports} onChange={(event) => props.onCrashReportsChange(event.target.checked)} aria-label={t(props.locale, "crashReports")} /></label>
        <p>{t(props.locale, "settingsStored")}</p>
      </section>
    </div>
  );
}
