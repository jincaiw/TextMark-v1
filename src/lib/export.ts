import type { RenderedMarkdown } from "../types";

const printCss = `body{max-width:860px;margin:40px auto;padding:0 28px;color:#1d1d1f;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}pre{overflow:auto;padding:16px;border-radius:8px;background:#f4f4f5}code{font-family:ui-monospace,monospace}img{max-width:100%;height:auto}table{width:100%;border-collapse:collapse}td,th{padding:8px;border:1px solid #ddd;text-align:left}.copy-code-button,mark.search-match{display:none!important}`;

export function downloadHtml(name: string, rendered: RenderedMarkdown) {
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name.replace(/[<&>]/g, "")}</title><style>${printCss}</style></head><body>${rendered.html}</body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = name.replace(/\.(?:md|markdown|mdown|mkd|mkdn|mdwn|mdtxt|mdtext|rmd|txt)$/i, "") + ".html"; link.click();
  URL.revokeObjectURL(url);
}
