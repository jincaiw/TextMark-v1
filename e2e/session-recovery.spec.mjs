import { existsSync, readFileSync } from 'node:fs'

const configPath = process.env.TEXTMARK_E2E_CONFIG_DIR
const manifestPath = `${configPath}/session-v1.json`

function readManifest() {
  return JSON.parse(readFileSync(manifestPath, 'utf8'))
}

describe('TextMark multi-document session recovery', () => {
  it('creates and persists two document tabs with the second tab active', async () => {
    await browser.tauri.switchWindow('main')
    await $('.markdown-body h1').waitForDisplayed()
    const secondPath = process.env.TEXTMARK_SESSION_RECOVERY_SECOND_FIXTURE
    if (!secondPath) throw new Error('TEXTMARK_SESSION_RECOVERY_SECOND_FIXTURE is required')
    await browser.tauri.execute((tauri, path) => tauri.core.invoke('test_open_path', { path }), secondPath)
    await browser.waitUntil(() => browser.execute(() => document.querySelectorAll('.document-tab[role="tab"]').length >= 2), {
      timeout: 20_000,
      timeoutMsg: `expected two document tabs after launching with two paths; title=${await browser.getTitle()}; roleTabs=${await browser.execute(() => document.querySelectorAll('[role="tab"]').length)}; tabClasses=${JSON.stringify(await browser.execute(() => [...document.querySelectorAll('.document-tab')].map((element) => element.textContent)))}; headings=${JSON.stringify(await $$('.markdown-body h1').map((heading) => heading.getText()))}; body=${JSON.stringify((await $('body').getText()).slice(0, 500))}`,
    })

    const tabs = await $$('.document-tab[role="tab"]')
    expect(await tabs[0].$('button.tab-label').getText()).toBe('recovery-a.md')
    expect(await tabs[1].$('button.tab-label').getText()).toBe('recovery-b.md')
    expect(await tabs[0].getAttribute('aria-selected')).toBe('false')
    expect(await tabs[1].getAttribute('aria-selected')).toBe('true')
    expect(await $('.markdown-body h1').getText()).toBe('Recovery B')

    await browser.waitUntil(
      () => {
        if (!existsSync(manifestPath)) return false
        const manifest = readManifest()
        const window = manifest.windows?.find((entry) => entry.windowId === 'main')
        return Boolean(
          window &&
          window.documents?.length === 2 &&
          window.documents[0].endsWith('recovery-a.md') &&
          window.documents[1].endsWith('recovery-b.md') &&
          window.activeIndex === 1,
        )
      },
      {
        timeout: 20_000,
        timeoutMsg: 'session manifest did not persist both documents with activeIndex=1',
      },
    )
  })
})

export function recoveryManifest() {
  return existsSync(manifestPath) ? readManifest() : null
}
