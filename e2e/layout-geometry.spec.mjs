before(async () => {
  await browser.tauri.switchWindow('main')
})

describe('TextMark desktop layout geometry', () => {
  it('matches the measured desktop chrome and document geometry', async () => {
    await browser.setWindowSize(1440, 900)
    await (await $('.markdown-body h1')).waitForDisplayed()

    const geometry = await browser.execute(() => {
      const rect = (selector) => {
        const element = document.querySelector(selector)
        if (!element) return null
        const box = element.getBoundingClientRect()
        const styles = getComputedStyle(element)
        return {
          x: Math.round(box.x),
          y: Math.round(box.y),
          width: Math.round(box.width),
          height: Math.round(box.height),
          paddingTop: styles.paddingTop,
          paddingRight: styles.paddingRight,
          paddingBottom: styles.paddingBottom,
          paddingLeft: styles.paddingLeft,
        }
      }
      return {
        toolbar: rect('.native-toolbar'),
        tabs: rect('.document-tabs'),
        platform: document.documentElement.dataset.platform,
        sidebar: rect('.native-sidebar'),
        outlineRow: rect('.native-outline .outline-row'),
        page: rect('.markdown-body'),
        editorPage: rect('.editor-page'),
      }
    })

    expect(geometry.toolbar.height).toBe(52)
    if (geometry.platform === 'macos') {
      expect(geometry.tabs?.height).toBe(38)
      expect(geometry.tabs?.y).toBe(52)
    } else {
      expect(geometry.tabs).toBeNull()
    }
    expect(geometry.sidebar.width).toBe(240)
    expect(geometry.outlineRow?.height).toBe(30)
    expect(geometry.page.width).toBeLessThanOrEqual(900)
    expect(geometry.page.width).toBeGreaterThan(0)
    expect(geometry.page.paddingTop).toBe('32px')
    expect(geometry.page.paddingRight).toBe('40px')
    expect(geometry.page.paddingBottom).toBe('48px')
    expect(geometry.page.paddingLeft).toBe('40px')
    expect(geometry.editorPage).toBeNull()
  })

  it('keeps the layout contract available for inspector and editor modes', async () => {
    const state = await browser.execute(() => ({
      inspectorWidth: getComputedStyle(document.documentElement).getPropertyValue('--inspector-width').trim(),
      documentPageWidth: getComputedStyle(document.documentElement).getPropertyValue('--document-page-width').trim(),
      editorPageRule: Boolean(document.querySelector('.editor-page')),
      inspectorRule: Boolean(document.querySelector('.inspector-panel')),
    }))
    expect(state.inspectorWidth).toBe('270px')
    expect(state.documentPageWidth).toBe('900px')
    expect(state.editorPageRule).toBe(false)
    expect(state.inspectorRule).toBe(false)
  })

  it('keeps toolbar actions and search reachable in a half-width window', async () => {
    await browser.setWindowSize(760, 800)
    const toolbar = await browser.execute(() => {
      const rect = (element) => {
        const { x, y, width, height } = element.getBoundingClientRect()
        return { left: x, right: x + width, top: y, bottom: y + height, width, height }
      }
      const bar = document.querySelector('.native-toolbar')
      const actions = [...document.querySelectorAll('.native-actions > [data-toolbar-item]')]
        .filter((element) => getComputedStyle(element).display !== 'none')
        .map((element) => ({ name: element.dataset.toolbarItem, ...rect(element) }))
      const search = document.querySelector('.document-search input')
      return {
        viewportWidth: document.documentElement.clientWidth,
        toolbar: bar ? rect(bar) : null,
        actions,
        searchVisible: Boolean(search && getComputedStyle(search).display !== 'none'),
        search: search ? rect(search) : null,
      }
    })
    expect(toolbar.viewportWidth).toBeLessThanOrEqual(800)
    expect(toolbar.toolbar?.width).toBeGreaterThan(0)
    expect(toolbar.searchVisible).toBe(true)
    expect(toolbar.search?.width).toBeGreaterThan(0)
    for (let index = 1; index < toolbar.actions.length; index += 1) {
      expect(toolbar.actions[index].left).toBeGreaterThanOrEqual(toolbar.actions[index - 1].left)
    }
    await browser.setWindowSize(1440, 900)
  })
})
