import katex from "katex";

export function renderMath(source: string, displayMode: boolean) {
  return katex.renderToString(source, { displayMode, throwOnError: false, output: "htmlAndMathml" });
}
