import { renderMarkdownUnsafe } from "../lib/markdown";

self.addEventListener("message", (event: MessageEvent<{ id: number; source: string }>) => {
  const { id, source } = event.data;
  try { self.postMessage({ id, result: renderMarkdownUnsafe(source) }); }
  catch { self.postMessage({ id, error: "render_failed" }); }
});
