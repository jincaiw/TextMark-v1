const documentCss = `
:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#fff;color:#1d1d1f;font:16px/1.58 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.markdown-body{width:min(820px,100%);margin:0 auto;padding:48px 40px 80px;overflow-wrap:anywhere}h1,h2,h3,h4,h5,h6{line-height:1.2;letter-spacing:-.02em}h1{font-size:2.15em}h2{margin-top:1.55em;font-size:1.65em}a{color:#0678de}blockquote,.markdown-alert{margin:1.2em 0;padding:1em 1.15em;border-radius:10px;background:#f4f4f6}pre{overflow:auto;padding:18px 20px;border-radius:10px;background:#f2f2f5}code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}img,svg{max-width:100%;height:auto}table{width:100%;border-spacing:0;border-collapse:separate;border:1px solid #ddd;border-radius:9px;overflow:hidden}td,th{padding:.62em .75em;border-right:1px solid #ddd;border-bottom:1px solid #ddd;text-align:left}th{background:#f5f5f6}.diagram{margin:1.4em 0;padding:18px;border:1px solid #ddd;border-radius:10px}.copy-code-button,.diagram-hud,mark.search-match{display:none!important}@media print{body{font-size:12pt}.markdown-body{width:100%;padding:0}pre,table,blockquote,.markdown-alert,.diagram{break-inside:avoid}}
`;

const cleanName = (name: string) => name.replace(/\.(?:md|markdown|mdown|mkd|mkdn|mdwn|mdtxt|mdtext|rmd|txt)$/i, "").replace(/[<>:"/\\|?*]/g, "-");

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function exportClone(root: HTMLElement) {
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".copy-code-button,.diagram-hud,mark.search-match").forEach((node) => node.remove());
  clone.querySelectorAll("[contenteditable]").forEach((node) => node.removeAttribute("contenteditable"));
  return clone;
}

export function downloadHtml(name: string, root: HTMLElement) {
  const clone = exportClone(root);
  const title = name.replace(/[<&>]/g, "");
  const html = `<!doctype html><html lang="${document.documentElement.lang || "zh-CN"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${documentCss}</style></head><body>${clone.outerHTML}</body></html>`;
  download(`${cleanName(name)}.html`, new Blob([html], { type: "text/html;charset=utf-8" }));
}

export async function downloadPng(name: string, root: HTMLElement) {
  const { toBlob } = await import("html-to-image");
  const blob = await toBlob(root, { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: true, filter: (node) => !(node instanceof HTMLElement) || (!node.classList.contains("copy-code-button") && !node.classList.contains("diagram-hud")) });
  if (!blob) throw new Error("png_export_failed");
  download(`${cleanName(name)}@2x.png`, blob);
}
