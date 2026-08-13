import { describe, expect, it } from "vitest";
import { canPresentMermaid, MERMAID_POPUP_MINIMUM_WIDTH, MERMAID_POPUP_SCREEN_FRACTION, preferredMermaidPopupSize } from "./mermaidSizing";
import { clampDiagramZoom, panForZoomPoint } from "./diagramInteractions";

describe("Mermaid popup sizing parity", () => {
  it("fits a large diagram into the screen while preserving ratio", () => { const size = preferredMermaidPopupSize({ width: 2400, height: 1600 }, { width: 600, height: 400 }, { width: 1440, height: 900 }); expect(size.width).toBeLessThanOrEqual(1440 * MERMAID_POPUP_SCREEN_FRACTION); expect(size.height).toBeLessThanOrEqual(900 * MERMAID_POPUP_SCREEN_FRACTION); expect(size.width / size.height).toBeCloseTo(1.5); });
  it("prefers natural size over a capped display box", () => expect(preferredMermaidPopupSize({ width: 400, height: 1200 }, { width: 400, height: 500 }, { width: 1600, height: 1200 }).height).toBeGreaterThan(500));
  it("preserves natural aspect ratio despite a capped display", () => { const size = preferredMermaidPopupSize({ width: 400, height: 1200 }, { width: 800, height: 720 }, { width: 1600, height: 1200 }); expect(size.width / size.height).toBeCloseTo(1 / 3); });
  it("upscales tiny diagrams to a readable minimum", () => expect(preferredMermaidPopupSize({ width: 120, height: 80 }, { width: 120, height: 80 }, { width: 1600, height: 1000 }).width).toBeGreaterThanOrEqual(MERMAID_POPUP_MINIMUM_WIDTH));
  it("falls back to display geometry", () => expect(preferredMermaidPopupSize({ width: 0, height: 0 }, { width: 500, height: 300 }, { width: 1600, height: 1000 })).toMatchObject({ width: 500, height: 300 }));
  it("rejects missing SVG markup", () => { expect(canPresentMermaid("")).toBe(false); expect(canPresentMermaid("<svg></svg>")).toBe(true); });
  it("uses a stable screen fraction", () => expect(MERMAID_POPUP_SCREEN_FRACTION).toBeGreaterThan(0.7));
  it("returns a safe default when all geometry is missing", () => expect(preferredMermaidPopupSize({ width: 0, height: 0 }, { width: 0, height: 0 }, { width: 0, height: 0 })).toEqual({ width: 420, height: 320 }));
  it("clamps pointer zoom to the upstream interaction range", () => { expect(clampDiagramZoom(25)).toBe(50); expect(clampDiagramZoom(420)).toBe(300); });
  it("keeps the point under the pointer stable while zooming", () => expect(panForZoomPoint({ zoom: 100, panX: 0, panY: 0, fitWidth: true }, 200, { x: 120, y: 80 })).toEqual({ panX: -120, panY: -80 }));
});
