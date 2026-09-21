import { existsSync } from 'node:fs'

const configPath = process.env.TEXTMARK_E2E_CONFIG_DIR
const manifestPath = `${configPath}/session-v1.json`

describe('TextMark normal close session persistence', () => {
  it('saves the main window snapshot before closing', async () => {
    await browser.tauri.switchWindow('main')
    await $('.markdown-body h1').waitForDisplayed()
    await $('.traffic-lights button[aria-label="关闭"]').click()
    await browser.waitUntil(() => existsSync(manifestPath), {
      timeout: 20_000,
      timeoutMsg: 'main session manifest was not preserved before normal close',
    })
  })
})
