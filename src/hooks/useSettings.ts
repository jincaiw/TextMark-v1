import { useCallback, useEffect, useState } from "react";
import { DEFAULT_LOCALE } from "../lib/i18n";
import type { AppSettings, ContentWidth, Locale, ThemeMode } from "../types";

const KEY = "textmark.settings.v1";
const KEY_V2 = "textmark.settings.v2";
export const DEFAULT_SETTINGS: AppSettings = {
  schemaVersion: 2,
  locale: DEFAULT_LOCALE, theme: "system", contentWidth: "normal", zoom: 100, editorFontSize: 16,
  toolbar: ["sidebar", "openWith", "zoom", "inspector", "share", "edit", "search"], defaultOpenTarget: "system", crashReports: false,
  updateChannel: "stable",
};

const toolbarItems = new Set(["sidebar", "openWith", "zoom", "inspector", "share", "edit", "search", "print", "copy", "export", "flexibleSpace", "space"]);

export function readSettings(storage: Pick<Storage, "getItem"> = localStorage): AppSettings {
  try {
    const raw = storage.getItem(KEY_V2) ?? storage.getItem(KEY) ?? "{}";
    const stored = JSON.parse(raw) as Partial<AppSettings>;
    const toolbar = Array.isArray(stored.toolbar) ? stored.toolbar.filter((item): item is AppSettings["toolbar"][number] => typeof item === "string" && toolbarItems.has(item)) : DEFAULT_SETTINGS.toolbar;
    return { ...DEFAULT_SETTINGS, ...stored, schemaVersion: 2, toolbar, zoom: Number.isFinite(stored.zoom) ? Math.min(300, Math.max(50, stored.zoom!)) : DEFAULT_SETTINGS.zoom };
  } catch { return DEFAULT_SETTINGS; }
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(readSettings);
  useEffect(() => { localStorage.setItem(KEY_V2, JSON.stringify(settings)); }, [settings]);
  const patch = useCallback((next: Partial<AppSettings>) => setSettings((current) => ({ ...current, ...next })), []);
  return {
    settings, patch,
    setLocale: (locale: Locale) => patch({ locale }), setTheme: (theme: ThemeMode) => patch({ theme }),
    setContentWidth: (contentWidth: ContentWidth) => patch({ contentWidth }), setZoom: (zoom: number) => patch({ zoom: Math.max(50, Math.min(300, zoom)) }),
    setEditorFontSize: (editorFontSize: number) => patch({ editorFontSize: Math.max(12, Math.min(24, editorFontSize)) }),
  };
}
