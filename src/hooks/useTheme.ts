import { useEffect, useState } from "react";
import type { ThemeMode } from "../types";

const STORAGE_KEY = "textmark.theme.v1";

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "dark" || stored === "light" || stored === "system" ? stored : "system";
  });

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolved = theme === "system" ? (media.matches ? "dark" : "light") : theme;
      document.documentElement.dataset.theme = resolved;
    };
    apply();
    media.addEventListener("change", apply);
    localStorage.setItem(STORAGE_KEY, theme);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  return { theme, setTheme };
}
