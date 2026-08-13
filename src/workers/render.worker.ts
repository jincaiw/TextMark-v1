import { renderMarkdownEnhancedUnsafe } from "../lib/markdown";

self.addEventListener("message", async (event: MessageEvent<{ id: number; source: string; locale?: "zh-CN" | "en" }>) => {
  const { id, source, locale } = event.data;
  try { self.postMessage({ id, result: await renderMarkdownEnhancedUnsafe(source, locale) }); }
  catch { self.postMessage({ id, error: "render_failed" }); }
});
