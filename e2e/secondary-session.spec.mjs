import { existsSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const configPath = process.env.TEXTMARK_E2E_CONFIG_DIR || path.join(os.tmpdir(), 'textmark-v030-e2e-config')
const fixturePath = process.env.TEXTMARK_SECONDARY_FIXTURE
const fixtureName = fixturePath ? path.basename(fixturePath) : ''
const fixtureHeading = fixturePath
  ? readFileSync(fixturePath, 'utf8')
      .match(/^#\s+(.+)$/m)?.[1]
      ?.trim()
  : undefined
const manifestPath = path.join(configPath, 'session-v1.json')

function readManifest() {
  return JSON.parse(readFileSync(manifestPath, 'utf8'))
}

function secondaryWindow(manifest) {
  return manifest.windows?.find(
    (window) => window.windowId !== 'main' && window.documents.some((document) => document.endsWith(fixtureName)),
  )
}

describe('TextMark secondary session lifecycle', () => {
  it('creates, persists, and removes a secondary window snapshot', async () => {
    await browser.tauri.switchWindow('main')
    await $('.markdown-body h1').waitForDisplayed()
    if (!fixturePath) throw new Error('TEXTMARK_SECONDARY_FIXTURE is required')

    const beforeHandles = await browser.getWindowHandles()
    await browser.tauri.execute((tauri, path) => tauri.core.invoke('open_document_window', { path }), fixturePath)

    let secondaryHandle
    await browser.waitUntil(
      async () => {
        const handles = await browser.getWindowHandles()
        secondaryHandle = handles.find((handle) => !beforeHandles.includes(handle))
        return Boolean(secondaryHandle)
      },
      {
        timeout: 20_000,
        timeoutMsg: 'secondary window was not created',
      },
    )

    await browser.switchToWindow(secondaryHandle)
    await $('.markdown-body h1').waitForDisplayed()
    await expect(await $('.markdown-body h1')).toHaveText(fixtureHeading)

    await browser.waitUntil(() => existsSync(manifestPath) && Boolean(secondaryWindow(readManifest())), {
      timeout: 20_000,
      timeoutMsg: `secondary window snapshot was not persisted; manifest=${existsSync(manifestPath) ? readFileSync(manifestPath, 'utf8') : 'missing'}`,
    })

    await $('.traffic-lights button[aria-label="关闭"]').click()
    await browser.tauri.switchWindow('main')
    await browser.waitUntil(() => !existsSync(manifestPath) || !secondaryWindow(readManifest()), {
      timeout: 20_000,
      timeoutMsg: `secondary window snapshot was not removed after close; manifest=${existsSync(manifestPath) ? readFileSync(manifestPath, 'utf8') : 'missing'}`,
    })
  })
})
