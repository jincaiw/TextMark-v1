import { useCallback, useEffect, useState } from "react";
import { DEFAULT_LOCALE } from "../lib/i18n";
import type { AppSettings, ContentWidth, Locale, ThemeMode } from "../types";

const KEY = "textmark.settings.v1";
const defaults: AppSettings = {
  locale: DEFAULT_LOCALE, theme: "system", contentWidth: "normal", zoom: 100, editorFontSize: 16,
  toolbar: ["sidebar", "openWith", "zoom", "inspector", "share", "edit", "search"], defaultOpenTarget: "system", crashReports: false,
};

function read(): AppSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<AppSettings>;
    return { ...defaults, ...stored, zoom: Number.isFinite(stored.zoom) ? Math.min(300, Math.max(50, stored.zoom!)) : defaults.zoom };
  } catch { return defaults; }
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(read);
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(settings)); }, [settings]);
  const patch = useCallback((next: Partial<AppSettings>) => setSettings((current) => ({ ...current, ...next })), []);
  return {
    settings, patch,
    setLocale: (locale: Locale) => patch({ locale }), setTheme: (theme: ThemeMode) => patch({ theme }),
    setContentWidth: (contentWidth: ContentWidth) => patch({ contentWidth }), setZoom: (zoom: number) => patch({ zoom: Math.max(50, Math.min(300, zoom)) }),
    setEditorFontSize: (editorFontSize: number) => patch({ editorFontSize: Math.max(12, Math.min(24, editorFontSize)) }),
  };
}
