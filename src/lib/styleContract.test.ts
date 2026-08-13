import { describe, expect, it } from "vitest";
import { documentCss } from "./export";
import { UPSTREAM_DOCUMENT_TOKENS } from "./designTokens";

describe("v0.0.47 visual and print contract", () => {
  it("uses the frozen 820px content column and exact page gutters", () => expect(UPSTREAM_DOCUMENT_TOKENS).toMatchObject({ contentColumnWidth: 820, pagePaddingTop: 32, pagePaddingHorizontal: 40, pagePaddingBottom: 48 }));
  it("uses the upstream 15px/1.52 typography", () => expect(UPSTREAM_DOCUMENT_TOKENS).toMatchObject({ fontSize: 15, lineHeight: 1.52 }));
  it("uses the upstream Apple document palette", () => expect(UPSTREAM_DOCUMENT_TOKENS.light).toEqual({ text: "#1d1d1f", secondary: "#6e6e73", link: "#0066cc", fill: "#f5f5f7", grid: "#d2d2d7" }));
  it("gives every authored blank line one source line of height", () => expect(UPSTREAM_DOCUMENT_TOKENS.sourceLineHeight).toBe(22.8));
  it("keeps system preview typography aligned with the app", () => expect(UPSTREAM_DOCUMENT_TOKENS.fontFamily).toContain("SF Pro Text"));
  it("forces a light print palette and removes screen controls", () => { expect(documentCss).toContain("color-scheme:light"); expect(documentCss).toContain(".copy-code-button,.diagram-hud,mark.search-match{display:none!important}"); expect(documentCss).toContain("break-inside:avoid"); });
});
