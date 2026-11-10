#!/usr/bin/env node
// Capture the share popover (upstream NSSharingServicePicker) via CDP.
// Usage: node scripts/capture-share.mjs [url] [out.png] [width] [height]
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [url = 'http://localhost:1420/', output = '/tmp/textmark-shots/share.png', widthText = '1440', heightText = '900'] =
  process.argv.slice(2)
const width = Number(widthText)
const height = Number(heightText)
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
await delay(2500)
// Open the share popover from the toolbar share button.
await run(`(() => {
  const trigger = document.querySelector('[data-toolbar-item="share"] button');
  if (trigger) trigger.click();
  return !!trigger;
})()`)
await delay(500)
const state = await run(`(() => {
  const pop = document.querySelector('.share-popover');
  if (!pop) return { present: false };
  const r = pop.getBoundingClientRect();
  const firstRow = pop.querySelector('.share-row');
  const rowRect = firstRow.getBoundingClientRect();
  const iconRect = firstRow.querySelector('svg').getBoundingClientRect();
  return {
    present: true,
    name: pop.querySelector('.share-header-text strong')?.textContent,
    subtitle: pop.querySelector('.share-header-subtitle')?.textContent,
    rows: Array.from(pop.querySelectorAll('.share-row')).map((row) => row.textContent),
    width: r.width,
    x: r.x,
    y: r.y,
    rowJustify: getComputedStyle(firstRow).justifyContent,
    iconLeftOffset: Math.round(iconRect.left - rowRect.left),
  };
})()`)
console.log(JSON.stringify(state, null, 2))
const shot = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync(output, Buffer.from(shot.data, 'base64'))
console.log(`saved ${output}`)
socket.close()
processHandle.kill()
process.exit(0)
