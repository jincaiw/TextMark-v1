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
        sidebar: rect('.native-sidebar'),
        outlineRow: rect('.native-outline .outline-row'),
        page: rect('.markdown-body'),
        editorPage: rect('.editor-page'),
      }
    })

    expect(geometry.toolbar.height).toBe(52)
    expect(geometry.tabs).toBeNull()
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
})
