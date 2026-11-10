#!/usr/bin/env node
// Capture the update capsule (upstream UpdatePill) in each phase via the
// dev-only ?updatePillDemo= hook, and verify its geometry.
// Usage: node scripts/capture-update-pill.mjs [url] [outDir] [width] [height]
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [url = 'http://localhost:1420/', outDir = '/tmp/textmark-shots/update-pill', widthText = '1440', heightText = '900'] =
  process.argv.slice(2)
const width = Number(widthText)
const height = Number(heightText)
mkdirSync(outDir, { recursive: true })
const chrome = process.env.TEXTMARK_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
if (!existsSync(chrome)) throw new Error(`Chrome is unavailable: ${chrome}`)

const profile = mkdtempSync(join(tmpdir(), 'textmark-chrome-'))
const processHandle = spawn(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--hide-scrollbars',
    '--remote-debugging-port=0',
    `--window-size=${width},${height}`,
    `--user-data-dir=${profile}`,
    url,
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] },
)
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
for (let attempt = 0; attempt < 600 && !existsSync(join(profile, 'DevToolsActivePort')); attempt += 1) await delay(50)
const [port] = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').trim().split('\n')
let page
for (let attempt = 0; attempt < 50; attempt += 1) {
  const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json())
  page = targets.find((target) => target.type === 'page' && target.url.startsWith(url))
  if (page) break
  await delay(50)
}
const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }))
let commandId = 0
const pending = new Map()
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  if (message.id && pending.has(message.id)) {
    const resolve = pending.get(message.id)
    pending.delete(message.id)
    resolve(message.result)
  }
})
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++commandId
    pending.set(id, resolve)
    socket.send(JSON.stringify({ id, method, params }))
  })
const run = async (expression) => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  return result?.result?.value
}

await send('Page.enable')
await send('Runtime.enable')

const phases = ['checking', 'available', 'downloading', 'preparing', 'ready', 'upToDate', 'failed', 'updated']
const summary = {}
for (const phase of phases) {
  await send('Page.navigate', { url: `${url}?updatePillDemo=${phase}` })
  await delay(2000)
  const state = await run(`(() => {
    const pill = document.querySelector('.update-pill');
    if (!pill) return { present: false };
    const r = pill.getBoundingClientRect();
    const cs = getComputedStyle(pill);
    const workspace = document.querySelector('.document-workspace').getBoundingClientRect();
    const action = pill.querySelector('.update-pill-action');
    const close = pill.querySelector('.update-pill-close');
    return {
      present: true,
      phase: pill.dataset.phase,
      tint: pill.dataset.tint || null,
      text: pill.querySelector('.update-pill-title').textContent,
      percent: pill.querySelector('.update-pill-percent')?.textContent || null,
      action: action ? action.textContent : null,
      close: !!close,
      height: r.height,
      rightInset: Math.round(workspace.right - r.right),
      bottomInset: Math.round(workspace.bottom - r.bottom),
      borderRadius: cs.borderRadius,
      actionHeight: action ? action.getBoundingClientRect().height : null,
      closeSize: close ? close.getBoundingClientRect().width : null,
    };
  })()`)
  summary[phase] = state
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(outDir, `${phase}.png`), Buffer.from(shot.data, 'base64'))
}
console.log(JSON.stringify(summary, null, 2))
console.log(`saved ${phases.length} shots to ${outDir}`)

socket.close()
processHandle.kill()
process.exit(0)
