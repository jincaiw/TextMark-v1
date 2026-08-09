import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ConflictDialog } from "./ConflictDialog";
import { DocumentTabs } from "./DocumentTabs";
import { FindBar } from "./FindBar";
import { ToolbarCustomizer } from "./ToolbarCustomizer";
import type { DocumentSession } from "../types";

const session = (id: string, name: string, dirty = false): DocumentSession => ({ id, name, path: null, contents: "", savedContents: "", diskContents: "", dirty, scrollTop: 0, history: [{ path: null, scrollTop: 0 }], historyIndex: 0 });

describe("localized desktop components", () => {
  it("renders the upstream Contains/Begins With find modes in Chinese", () => {
    const html = renderToStaticMarkup(<FindBar locale="zh-CN" query="Text" current={0} count={2} matchCase={false} mode="contains" onQueryChange={vi.fn()} onPrevious={vi.fn()} onNext={vi.fn()} onMatchCaseChange={vi.fn()} onModeChange={vi.fn()} onClose={vi.fn()} />);
    expect(html).toContain("包含");
    expect(html).toContain("开头匹配");
    expect(html).toContain("第 1 项，共 2 项");
  });
  it("exposes dirty document tabs and localized close labels", () => {
    const html = renderToStaticMarkup(<DocumentTabs sessions={[session("a", "A.md", true), session("b", "B.md")]} activeId="a" locale="zh-CN" onActivate={vi.fn()} onClose={vi.fn()} />);
    expect(html).toContain("A.md •");
    expect(html).toContain("关闭标签页 A.md");
  });
  it("renders the three explicit conflict choices", () => {
    const html = renderToStaticMarkup(<ConflictDialog open locale="en" onResolve={vi.fn()} />);
    expect(html).toContain("Reload");
    expect(html).toContain("Overwrite");
    expect(html).toContain("Cancel");
  });
  it("renders configurable toolbar inventory", () => {
    const html = renderToStaticMarkup(<ToolbarCustomizer open locale="zh-CN" items={["sidebar", "search"]} onChange={vi.fn()} onClose={vi.fn()} />);
    expect(html).toContain("自定工具栏");
    expect(html).toContain("可用项目");
    expect(html).toContain("当前工具栏");
  });
});
