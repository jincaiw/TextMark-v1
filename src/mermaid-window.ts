import DOMPurify from "dompurify";
import "./mermaid-window.css";
import { attachDiagramInteractions } from "./lib/diagramInteractions";

const parameters = new URLSearchParams(location.search);
const id = parameters.get("id") ?? "";
const locale = parameters.get("locale") === "en" ? "en" : "zh-CN";
const source = localStorage.getItem(`textmark.${id}`) ?? "";
const canvas = document.querySelector<HTMLElement>(".mermaid-window-canvas")!;
const stage = document.querySelector<HTMLElement>(".mermaid-window-stage")!;
const output = document.querySelector<HTMLOutputElement>(".mermaid-window-hud output")!;
const fitButton = document.querySelector<HTMLButtonElement>('[data-action="fit"]')!;
document.documentElement.lang = locale;
document.title = locale === "zh-CN" ? "TextMark 图表" : "TextMark Diagram";
window.addEventListener("beforeunload", () => localStorage.removeItem(`textmark.${id}`));

async function render() {
  if (!source) { stage.textContent = locale === "zh-CN" ? "图表源不可用。" : "Diagram source is unavailable."; return; }
  const { default: mermaid } = await import("mermaid");
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: dark ? "dark" : "neutral" });
  const { svg } = await mermaid.render(`textmark-window-${Date.now()}`, source);
  stage.innerHTML = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });
  return attachDiagramInteractions(canvas, stage, { minimumZoom: 25, maximumZoom: 400, onChange: (state) => {
    output.value = `${state.zoom}%`;
    fitButton.setAttribute("aria-pressed", String(state.fitWidth));
    fitButton.title = locale === "zh-CN" ? (state.fitWidth ? "实际大小" : "适合宽度") : (state.fitWidth ? "Actual Size" : "Fit Width");
  } });
}

document.querySelector(".mermaid-window-hud")?.addEventListener("click", (event) => {
  const action = (event.target as HTMLElement).closest<HTMLButtonElement>("button")?.dataset.action;
  if (!action) return;
  void controllerPromise.then((controller) => {
    if (!controller) return;
    if (action === "in") controller.zoomIn();
    else if (action === "out") controller.zoomOut();
    else if (action === "reset") controller.reset();
    else if (action === "fit") controller.toggleFitWidth();
  });
});

const controllerPromise = render();
