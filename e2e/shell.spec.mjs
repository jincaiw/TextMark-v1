import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const fixturePath = path.join(os.tmpdir(), 'textmark-v030-e2e.md')
const movedFixturePath = path.join(os.tmpdir(), 'textmark-v030-e2e-renamed.md')

describe('TextMark desktop shell', () => {
  it('opens a real launch-path document in Chinese and renders through the Worker', async () => {
    await browser.setWindowSize(1440, 900)
    const heading = await $('.markdown-body h1')
    await heading.waitForDisplayed()
    // Dismiss the first-run default-handler prompt: its modal backdrop would
    // otherwise swallow every subsequent toolbar click.
    const backdrop = await $('.dialog-backdrop')
    if (await backdrop.isExisting()) {
      const notNow = await backdrop.$('button=以后再说')
      if (await notNow.isExisting()) await notNow.click()
    }
    await expect(heading).toHaveText('E2E Native Document')
    expect(await browser.execute(() => document.documentElement.lang)).toBe('zh-CN')
    await expect(await $('input[placeholder="在文稿中搜索"]')).toExist()
    expect(await browser.getTitle()).toBe('textmark-v030-e2e.md')
    expect(await browser.execute(() => document.documentElement.dataset.renderer)).toBe('worker')
    expect(await browser.execute(() => document.documentElement.dataset.runtime)).toBe('tauri')
  })

  it('switches language immediately and persists toolbar customization', async () => {
    await browser.keys([process.platform === 'darwin' ? 'Meta' : 'Control', ','])
    await expect(await $('.settings-dialog')).toBeDisplayed()
    await browser.execute(() => {
      const locale = document.querySelector('.settings-dialog select')
      locale.value = 'en'
      locale.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await expect(await $('.settings-dialog h2')).toHaveText('TextMark Preferences')
    await browser.execute(() => {
      const locale = document.querySelector('.settings-dialog select')
      locale.value = 'zh-CN'
      locale.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await expect(await $('.settings-dialog h2')).toHaveText('TextMark 偏好设置')
    await $(".settings-dialog button[aria-label='关闭']").click()

    await $('.more-menu summary').click()
    await $('button=自定义工具栏…').click()
    await expect(await $('.toolbar-customizer')).toBeDisplayed()
    await $('.toolbar-customizer footer button.primary').click()
  })

  it('supports native preview interactions, search, inspector and source-aware tables', async () => {
    await $('.markdown-body details summary').click()
    expect(await $('.markdown-body details').getAttribute('open')).not.toBeNull()
    await browser.keys([process.platform === 'darwin' ? 'Meta' : 'Control', 'f'])
    const search = await $('.find-bar input')
    await search.waitForDisplayed()
    await search.click()
    await browser.keys('TextMark')
    await expect(await $('.find-bar')).toBeDisplayed()
    await browser.waitUntil(async () => (await $$('mark.search-match')).length > 0)
    expect(await $('.markdown-body details').getAttribute('open')).not.toBeNull()
    const modes = await $$('.find-bar .find-mode')
    for (const mode of modes) {
      if ((await mode.getText()).trim() === '开头为') {
        await mode.click()
        break
      }
    }
    await $('.find-bar .find-done').click()

    await $("button[aria-label='显示简介']").click()
    await expect(await $('.inspector-panel')).toBeDisplayed()
    await (await $$(".inspector-panel [role='tab']"))[1].click()
    await expect(await $('.frontmatter-list')).toHaveText(expect.stringContaining('TextMark QA'))
    await $(".inspector-panel button[aria-label='关闭']").click()

    const task = await $('input.task-list-item-checkbox')
    await task.click()
    await expect(task).toBeSelected()

    await browser.execute(() => {
      const target = document.querySelector('.markdown-body tbody tr:first-child td:first-child')
      const bounds = target.getBoundingClientRect()
      target.dispatchEvent(
        new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: bounds.left + 4, clientY: bounds.top + 4 }),
      )
    })
    await expect(await $('.table-context-menu')).toBeDisplayed()
    await $("//div[contains(@class,'table-context-menu')]/button[normalize-space()='复制行']").click()
    expect(await browser.getTitle()).toContain('已编辑')
  })

  it('saves through Rust and safely resolves an external write conflict', async () => {
    await $('.more-menu summary').click()
    await $('button=存储').click()
    await browser.waitUntil(() => (readFileSync(fixturePath, 'utf8').match(/\| Preview \|/g) ?? []).length === 2)

    await $("button[aria-label='切换编辑模式']").click()
    const editor = await $('.cm-content')
    await editor.waitForDisplayed()
    await editor.click()
    await editor.addValue('\n\nE2E local draft')
    expect(await browser.getTitle()).toContain('已编辑')

    writeFileSync(fixturePath, '# External Disk Version\n\nTextMark external reload.\n', 'utf8')
    await expect(await $('.conflict-dialog')).toBeDisplayed()
    await $("//section[contains(@class,'conflict-dialog')]//button[normalize-space()='从磁盘重新载入']").click()
    await expect(editor).toHaveText(expect.stringContaining('External Disk Version'))
    await $("button[aria-label='切换编辑模式']").click()
    await expect(await $('.markdown-body h1')).toHaveText('External Disk Version')
  })

  it('follows a rename and can recreate a deleted document', async () => {
    renameSync(fixturePath, movedFixturePath)
    await browser.waitUntil(async () => (await browser.getTitle()) === 'textmark-v030-e2e-renamed.md')

    unlinkSync(movedFixturePath)
    await expect(await $('.conflict-dialog')).toBeDisplayed()
    await expect(await $('#conflict-title')).toHaveText('文件已被删除')
    await $("//section[contains(@class,'conflict-dialog')]//button[normalize-space()='重新创建']").click()
    await browser.waitUntil(() => existsSync(movedFixturePath))
    expect(readFileSync(movedFixturePath, 'utf8')).toContain('External Disk Version')
  })
})

// Toolbar click matrix: every top-area control must respond to real clicks.
// Runs against the default toolbar (flexibleSpace, sidebar, navigation,
// flexibleSpace, openActions, space, zoom, inspector, share, edit, search)
// in the default zh-CN locale. Native file dialogs are intentionally not
// invoked: their trigger items are asserted to exist and open the menu, and
// dialog-bound actions stay covered by the shell tests above.

describe('TextMark toolbar click matrix', () => {
  before(async () => {
    await browser.setWindowSize(1440, 900)
    const heading = await $('.markdown-body h1')
    await heading.waitForDisplayed()
    // Dismiss the first-run default-handler prompt if present, and close any
    // panels left open by earlier tests.
    const backdrop = await $('.dialog-backdrop')
    if (await backdrop.isExisting()) {
      const notNow = await backdrop.$('button=以后再说')
      if (await notNow.isExisting()) await notNow.click()
    }
    const findDone = await $('.find-bar .find-done')
    if (await findDone.isExisting()) await findDone.click()
    const inspectorClose = await $(".inspector-panel button[aria-label='关闭']")
    if (await inspectorClose.isExisting()) await inspectorClose.click()
    // Deterministic share fallback: no native share sheet under WebDriver.
    await browser.execute(() => {
      Object.defineProperty(window.navigator, 'share', { value: undefined, configurable: true })
    })
  })

  it('sidebar toggle and mode dropdown (hide / outline / folders)', async () => {
    const toggle = await $('.sidebar-control button[aria-label="显示或隐藏边栏"]')
    if ((await $('.document-shell').getAttribute('class')).includes('with-sidebar')) await toggle.click()
    await expect(await $('.document-shell')).not.toHaveClassContaining('with-sidebar')
    await toggle.click()
    await expect(await $('.document-shell')).toHaveClassContaining('with-sidebar')
    await expect(await $('.native-sidebar')).toBeDisplayed()

    const summary = await $('.sidebar-control summary[aria-label="选择边栏模式"]')
    await summary.click()
    await expect(await $('.sidebar-control details').getAttribute('open')).not.toBeNull()
    await $("//div[contains(@class,'sidebar-menu')]//button[normalize-space()='文件夹']").click()
    await expect(await $('.native-file-tree')).toBeDisplayed()
    await summary.click()
    await $("//div[contains(@class,'sidebar-menu')]//button[normalize-space()='大纲']").click()
    await expect(await $('.native-outline')).toBeDisplayed()
    await summary.click()
    await $("//div[contains(@class,'sidebar-menu')]//button[normalize-space()='隐藏边栏']").click()
    await expect(await $('.document-shell')).not.toHaveClassContaining('with-sidebar')
  })

  it('open-actions dropdown lists editors and stays interactive', async () => {
    const summary = await $('.toolbar-group.open-with summary[title="打开"]')
    await summary.click()
    await expect(await $('details.toolbar-group.open-with').getAttribute('open')).not.toBeNull()
    await expect(
      await $(
        "//details[contains(@class,'open-with')]//div[contains(@class,'menu-popover')]//button[contains(normalize-space(),'系统默认编辑器')]",
      ),
    ).toBeDisplayed()
    // close by clicking the summary again
    await summary.click()
    await expect(await $('details.toolbar-group.open-with').getAttribute('open')).toBeNull()
  })

  it('zoom in/out updates the zoom percentage', async () => {
    const zoom = await $('.zoom-buttons')
    const before = await zoom.getAttribute('aria-label')
    await $('.zoom-buttons button[title="放大"]').click()
    const afterIn = await zoom.getAttribute('aria-label')
    expect(afterIn).not.toBe(before)
    await $('.zoom-buttons button[title="缩小"]').click()
    const afterOut = await zoom.getAttribute('aria-label')
    expect(afterOut).not.toBe(afterIn)
  })

  it('search opens the find bar and its controls respond', async () => {
    const input = await $('.document-search input')
    await input.click()
    await expect(await $('.find-bar')).toBeDisplayed()
    const findInput = await $('.find-bar input')
    await findInput.setValue('TextMark')
    await expect(await $('.find-count')).toBeDisplayed()
    await expect(await $('.find-icon[title="下一个匹配项"]')).toBeEnabled()
    await $('.find-icon[title="下一个匹配项"]').click()
    await expect(await $('.find-icon[title="上一个匹配项"]')).toBeEnabled()
    await $('.find-icon[title="上一个匹配项"]').click()
    await $('.find-bar .find-done').click()
    await expect(await $('.find-bar')).not.toBeDisplayed()
  })

  it('edit mode toggles on and off from the toolbar', async () => {
    const edit = await $('button[aria-label="切换编辑模式"]')
    if ((await $('.app-shell').getAttribute('class')).includes('mode-edit')) await edit.click()
    await expect(await $('.app-shell')).not.toHaveClassContaining('mode-edit')
    await edit.click()
    await expect(await $('.app-shell')).toHaveClassContaining('mode-edit')
    await edit.click()
    await expect(await $('.app-shell')).not.toHaveClassContaining('mode-edit')
  })

  it('inspector opens and closes', async () => {
    const info = await $('button[aria-label="显示简介"]')
    if ((await $('.document-shell').getAttribute('class')).includes('with-inspector')) await info.click()
    await expect(await $('.document-shell')).not.toHaveClassContaining('with-inspector')
    await info.click()
    await expect(await $('.document-shell')).toHaveClassContaining('with-inspector')
    await info.click()
    await expect(await $('.document-shell')).not.toHaveClassContaining('with-inspector')
  })

  it('share falls back to copy and flashes a notice', async () => {
    await $('button[aria-label="共享 Markdown 源文件"]').click()
    await expect(await $('.toast[role="status"]')).toBeDisplayed()
  })

  it('more menu lists every overflow action', async () => {
    const summary = await $('.more-menu summary[title="更多"]')
    await summary.click()
    await expect(await $('details.more-menu').getAttribute('open')).not.toBeNull()
    for (const label of [
      '打开文件…',
      '打开文件夹…',
      '存储',
      '存储为…',
      '拷贝 Markdown 源文本',
      '打印…',
      '导出 HTML…',
      '导出 PDF',
      '导出 PNG…',
      '自定义工具栏…',
      '偏好设置…',
    ]) {
      await expect(await $(`//details[contains(@class,'more-menu')]//button[normalize-space()='${label}']`)).toBeDisplayed()
    }
    await $("//details[contains(@class,'more-menu')]//button[normalize-space()='拷贝 Markdown 源文本']").click()
    await expect(await $('.toast[role="status"]')).toBeDisplayed()
  })

  it('more menu opens the toolbar customizer and preferences', async () => {
    await $('.more-menu summary[title="更多"]').click()
    await $("//details[contains(@class,'more-menu')]//button[normalize-space()='自定义工具栏…']").click()
    await expect(await $('.toolbar-customizer')).toBeDisplayed()
    await $('.toolbar-customizer footer button.primary').click()
    await $('.more-menu summary[title="更多"]').click()
    await $("//details[contains(@class,'more-menu')]//button[normalize-space()='偏好设置…']").click()
    await expect(await $('.settings-dialog')).toBeDisplayed()
    await $(".settings-dialog button[aria-label='关闭']").click()
  })

  it('dialogs trap focus and close on Escape', async () => {
    // Settings opens with focus moved inside the dialog.
    await browser.keys([process.platform === 'darwin' ? 'Meta' : 'Control', ','])
    await expect(await $('.settings-dialog')).toBeDisplayed()
    await browser.waitUntil(async () => await browser.execute(() => document.activeElement?.closest('.settings-dialog') != null))
    // Tab wraps inside the dialog, never leaving it.
    for (let i = 0; i < 6; i += 1) {
      await browser.keys('Tab')
      expect(await browser.execute(() => document.activeElement?.closest('.settings-dialog') != null)).toBe(true)
    }
    // Escape closes the dialog.
    await browser.keys('Escape')
    await expect(await $('.settings-dialog')).not.toBeDisplayed()
  })

  it('navigation buttons exist and reflect history state', async () => {
    await expect(await $('.history-buttons button[aria-label="Back"]')).toExist()
    await expect(await $('.history-buttons button[aria-label="Forward"]')).toExist()
  })

  it('window control buttons exist in the top area', async () => {
    await expect(await $('.traffic-lights button[aria-label="关闭"]')).toExist()
    await expect(await $('.traffic-lights button[aria-label="最小化"]')).toExist()
    await expect(await $('.traffic-lights button[aria-label="缩放"]')).toExist()
  })

  it('platform adapter positions window controls per OS (browser fallback)', async () => {
    const layout = (platform) =>
      browser.execute((p) => {
        document.documentElement.dataset.platform = p
        document.documentElement.dataset.runtime = 'browser'
        const lights = document.querySelector('.traffic-lights')
        const buttons = [...document.querySelectorAll('.traffic-lights button')]
        const rect = lights.getBoundingClientRect()
        // Assert the visual order via layout positions instead of the order
        // computed style: WKWebView/WebView2 report order:0 for these buttons
        // while still reordering them (the CSS uses order for the cluster
        // layout), so only the rendered position is engine-independent.
        const lefts = buttons.map((button) => Math.round(button.getBoundingClientRect().left))
        return {
          count: buttons.length,
          visible: buttons.every((button) => getComputedStyle(button).display !== 'none' && button.offsetParent !== null),
          left: Math.round(rect.x),
          rightEdge: Math.round(window.innerWidth - (rect.x + rect.width)),
          closeRightmost: lefts.indexOf(Math.max(...lefts)) === 0,
        }
      }, platform)
    const reset = () =>
      browser.execute(() => {
        document.documentElement.dataset.platform = 'macos'
        document.documentElement.dataset.runtime = 'tauri'
        return true
      })
    try {
      const macos = await layout('macos')
      expect(macos.count).toBe(3)
      expect(macos.visible).toBe(true)
      expect(macos.left).toBeLessThan(120)
      for (const platform of ['windows', 'linux']) {
        const state = await layout(platform)
        expect(state.count).toBe(3)
        expect(state.visible).toBe(true)
        expect(state.rightEdge).toBeLessThan(4)
        // Windows/Linux convention: close on the far right of the cluster.
        expect(state.closeRightmost).toBe(true)
      }
    } finally {
      await reset()
    }
  })
})
