describe("TextMark desktop shell", () => {
  it("starts in Chinese, renders in the Worker and switches language immediately", async () => {
    const heading = await $(".markdown-body h1");
    await heading.waitForDisplayed();
    await expect(heading).toHaveText("Welcome to TextMark");
    await expect(await $('input[placeholder="在文档中搜索"]')).toBeDisplayed();

    await $(".more-menu summary").click();
    await $("button=偏好设置…").click();
    await browser.execute(() => {
      const locale = document.querySelector(".settings-dialog select");
      locale.value = "en";
      locale.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(await $(".settings-dialog h2")).toHaveText("TextMark Preferences");
    await $(".settings-dialog button[aria-label='Close']").click();
    await $(".more-menu summary").click();
    await $("button=Customize Toolbar…").click();
    await expect(await $(".toolbar-customizer")).toBeDisplayed();
    await $(".toolbar-customizer footer button.primary").click();
    await $("button[aria-label='Toggle Edit Mode']").click();
    await expect(await $(".cm-editor")).toBeDisplayed();
    await browser.execute(() => localStorage.clear());
  });
});
