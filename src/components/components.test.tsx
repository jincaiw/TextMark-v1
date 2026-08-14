import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ConflictDialog } from "./ConflictDialog";
import { DocumentTabs } from "./DocumentTabs";
import { FindBar } from "./FindBar";
import { ToolbarCustomizer } from "./ToolbarCustomizer";
import { PreviewPane } from "./PreviewPane";
import type { DocumentSession, RenderedMarkdown } from "../types";

const session = (id: string, name: string, dirty = false): DocumentSession => ({ id, name, path: null, contents: "", savedContents: "", diskContents: "", dirty, scrollTop: 0, history: [{ path: null, scrollTop: 0 }], historyIndex: 0 });

describe("localized desktop components", () => {
  it("renders the upstream Contains/Begins With find modes in Chinese", () => {
    const html = renderToStaticMarkup(<FindBar locale="zh-CN" query="Text" current={0} count={2} matchCase={false} mode="contains" onQueryChange={vi.fn()} onPrevious={vi.fn()} onNext={vi.fn()} onMatchCaseChange={vi.fn()} onModeChange={vi.fn()} onClose={vi.fn()} />);
    expect(html).toContain("包含");
    expect(html).toContain("开头为");
    expect(html).toContain("第 1 项，共 2 项");
  });
  it("exposes dirty document tabs and localized close labels", () => {
    const html = renderToStaticMarkup(<DocumentTabs sessions={[session("a", "A.md", true), session("b", "B.md")]} activeId="a" locale="zh-CN" onActivate={vi.fn()} onClose={vi.fn()} />);
    expect(html).toContain("A.md •");
    expect(html).toContain("关闭标签页 A.md");
  });
  it("renders the three explicit conflict choices", () => {
    const html = renderToStaticMarkup(<ConflictDialog change={{ kind: "modified", document: { path: "/a.md", name: "a.md", contents: "disk" } }} locale="en" onResolve={vi.fn()} />);
    expect(html).toContain("Reload from Disk");
    expect(html).toContain("Keep My Changes");
    expect(html).toContain("Cancel");
  });
  it("offers safe recovery when a document is deleted or renamed", () => {
    const deleted = renderToStaticMarkup(<ConflictDialog change={{ kind: "deleted", previousPath: "/a.md" }} locale="zh-CN" onResolve={vi.fn()} />);
    const renamed = renderToStaticMarkup(<ConflictDialog change={{ kind: "renamed", previousPath: "/a.md", document: { path: "/b.md", name: "b.md", contents: "disk" } }} locale="en" onResolve={vi.fn()} />);
    expect(deleted).toContain("另存为");
    expect(deleted).toContain("重新创建");
    expect(renamed).toContain("Open New Location");
    expect(renamed).toContain("Recreate Original");
  });
  it("renders configurable toolbar inventory", () => {
    const html = renderToStaticMarkup(<ToolbarCustomizer open locale="zh-CN" items={["sidebar", "search"]} displayMode="iconOnly" onChange={vi.fn()} onDisplayModeChange={vi.fn()} onClose={vi.fn()} />);
    expect(html).toContain("自定义工具栏");
    expect(html).toContain("可用项目");
    expect(html).toContain("当前工具栏");
  });
  it("preserves an open disclosure while incremental search marks are applied", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    Element.prototype.scrollIntoView = vi.fn();
    const root = createRoot(host);
    const rendered: RenderedMarkdown = { html: "<details><summary>Persistent details</summary><p>TextMark body</p></details>", outline: [], hasMermaid: false, hasMath: false, frontmatter: [], sourceMap: [], tables: [], tasks: [], optionalRenderers: [], direction: "auto" };
    const props = { rendered, documentKey: "doc", initialScrollTop: 0, baseDirectory: null, workspacePath: null, zoom: 100, contentWidth: "normal" as const, searchIndex: 0, matchCase: false, searchMode: "contains" as const, locale: "zh-CN" as const, onSearchCount: vi.fn(), onActiveHeading: vi.fn(), onZoomChange: vi.fn(), onOpenRelative: vi.fn(), onToggleTask: vi.fn(), onEditTable: vi.fn() };
    await act(async () => root.render(<PreviewPane {...props} searchQuery="" />));
    const details = host.querySelector("details")!;
    details.open = true;
    await act(async () => root.render(<PreviewPane {...props} searchQuery="TextMark" />));
    expect(host.querySelector("details")?.open).toBe(true);
    expect(host.querySelectorAll("mark.search-match")).toHaveLength(1);
    await act(async () => root.unmount());
    host.remove();
  });
});
