import DOMPurify from "dompurify";
import "./mermaid-window.css";

const id = new URLSearchParams(location.search).get("id") ?? "";
const source = localStorage.getItem(`textmark.${id}`) ?? "";
const canvas = document.querySelector<HTMLElement>(".mermaid-window-canvas")!;
const output = document.querySelector<HTMLOutputElement>(".mermaid-window-hud output")!;
let zoom = 100;
window.addEventListener("beforeunload", () => localStorage.removeItem(`textmark.${id}`));

async function render() {
  if (!source) { canvas.textContent = "Diagram source is unavailable."; return; }
  const { default: mermaid } = await import("mermaid");
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: dark ? "dark" : "neutral" });
  const { svg } = await mermaid.render(`textmark-window-${Date.now()}`, source);
  canvas.innerHTML = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });
}

document.querySelector(".mermaid-window-hud")?.addEventListener("click", (event) => {
  const action = (event.target as HTMLElement).closest<HTMLButtonElement>("button")?.dataset.action;
  const svg = canvas.querySelector<SVGSVGElement>("svg");
  if (!action || !svg) return;
  zoom = action === "fit" ? 100 : Math.max(25, Math.min(400, zoom + (action === "in" ? 25 : -25)));
  svg.style.width = action === "fit" ? "100%" : `${zoom}%`;
  output.value = `${zoom}%`;
});

void render();
