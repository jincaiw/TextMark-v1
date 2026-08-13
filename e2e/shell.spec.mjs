import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const fixturePath = path.join(os.tmpdir(), "textmark-v030-e2e.md");
const movedFixturePath = path.join(os.tmpdir(), "textmark-v030-e2e-renamed.md");

describe("TextMark desktop shell", () => {
  it("opens a real launch-path document in Chinese and renders through the Worker", async () => {
    await browser.setWindowSize(1440, 900);
    const heading = await $(".markdown-body h1");
    await heading.waitForDisplayed();
    await expect(heading).toHaveText("E2E Native Document");
    expect(await browser.execute(() => document.documentElement.lang)).toBe("zh-CN");
    await expect(await $('input[placeholder="在文档中搜索"]')).toExist();
    await expect(await $(".native-title")).toHaveText("textmark-v030-e2e.md");
    expect(await browser.execute(() => document.documentElement.dataset.renderer)).toBe("worker");
    expect(await browser.execute(() => document.documentElement.dataset.runtime)).toBe("tauri");
  });

  it("switches language immediately and persists toolbar customization", async () => {
    await browser.keys([process.platform === "darwin" ? "Meta" : "Control", ","]);
    await expect(await $(".settings-dialog")).toBeDisplayed();
    await browser.execute(() => {
      const locale = document.querySelector(".settings-dialog select");
      locale.value = "en";
      locale.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(await $(".settings-dialog h2")).toHaveText("TextMark Preferences");
    await browser.execute(() => {
      const locale = document.querySelector(".settings-dialog select");
      locale.value = "zh-CN";
      locale.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(await $(".settings-dialog h2")).toHaveText("TextMark 偏好设置");
    await $(".settings-dialog button[aria-label='关闭']").click();

    await $(".more-menu summary").click();
    await $("button=自定工具栏…").click();
    await expect(await $(".toolbar-customizer")).toBeDisplayed();
    await $(".toolbar-customizer footer button.primary").click();
  });

  it("supports native preview interactions, search, inspector and source-aware tables", async () => {
    await $(".markdown-body details summary").click();
    expect(await $(".markdown-body details").getAttribute("open")).not.toBeNull();
    await browser.keys([process.platform === "darwin" ? "Meta" : "Control", "f"]);
    const search = await $(".find-bar input");
    await search.waitForDisplayed();
    await search.click();
    await browser.keys("TextMark");
    await expect(await $(".find-bar")).toBeDisplayed();
    await browser.waitUntil(async () => (await $$("mark.search-match")).length > 0);
    expect(await $(".markdown-body details").getAttribute("open")).not.toBeNull();
    await browser.execute(() => {
      const mode = document.querySelector(".find-bar select");
      mode.value = "beginsWith";
      mode.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await $(".find-bar button[title='完成']").click();

    await $("button[aria-label='显示简介']").click();
    await expect(await $(".inspector-panel")).toBeDisplayed();
    await expect(await $(".frontmatter-list")).toHaveText(expect.stringContaining("TextMark QA"));
    await $(".inspector-panel button[aria-label='关闭']").click();

    const task = await $("input.task-list-item-checkbox");
    await task.click();
    await expect(task).toBeSelected();

    const cell = await $(".markdown-body tbody tr:first-child td:first-child");
    await browser.execute(() => {
      const target = document.querySelector(".markdown-body tbody tr:first-child td:first-child");
      const bounds = target.getBoundingClientRect();
      target.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: bounds.left + 4, clientY: bounds.top + 4 }));
    });
    await expect(await $(".table-context-menu")).toBeDisplayed();
    await $("//div[contains(@class,'table-context-menu')]/button[normalize-space()='复制行']").click();
    await expect(await $(".native-title")).toHaveText(expect.stringContaining("已编辑"));
  });

  it("saves through Rust and safely resolves an external write conflict", async () => {
    await $(".more-menu summary").click();
    await $("button=保存").click();
    await browser.waitUntil(() => (readFileSync(fixturePath, "utf8").match(/\| Preview \|/g) ?? []).length === 2);

    await $("button[aria-label='切换编辑模式']").click();
    const editor = await $(".cm-content");
    await editor.waitForDisplayed();
    await editor.click();
    await editor.addValue("\n\nE2E local draft");
    await expect(await $(".native-title")).toHaveText(expect.stringContaining("已编辑"));

    writeFileSync(fixturePath, "# External Disk Version\n\nTextMark external reload.\n", "utf8");
    await expect(await $(".conflict-dialog")).toBeDisplayed();
    await $("//section[contains(@class,'conflict-dialog')]//button[normalize-space()='重新加载']").click();
    await expect(editor).toHaveText(expect.stringContaining("External Disk Version"));
    await $("button[aria-label='切换编辑模式']").click();
    await expect(await $(".markdown-body h1")).toHaveText("External Disk Version");
  });

  it("follows a rename and can recreate a deleted document", async () => {
    renameSync(fixturePath, movedFixturePath);
    await expect(await $(".native-title")).toHaveText("textmark-v030-e2e-renamed.md");

    unlinkSync(movedFixturePath);
    await expect(await $(".conflict-dialog")).toBeDisplayed();
    await expect(await $("#conflict-title")).toHaveText("文件已被删除");
    await $("//section[contains(@class,'conflict-dialog')]//button[normalize-space()='重新创建']").click();
    await browser.waitUntil(() => existsSync(movedFixturePath));
    expect(readFileSync(movedFixturePath, "utf8")).toContain("External Disk Version");
  });
});
