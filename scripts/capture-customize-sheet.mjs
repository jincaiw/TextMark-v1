#!/usr/bin/env node
// Capture the Customize Theme sheet by driving the live app via CDP.
// Usage: node scripts/capture-customize-sheet.mjs [url] [out.png] [width] [height] [preset]
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [
  url = 'http://localhost:1420/',
  output = '/tmp/textmark-shots/customize-sheet.png',
  widthText = '1440',
  heightText = '900',
  preset = 'original',
] = process.argv.slice(2)
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
await send('Page.reload')
await delay(2500)

// Pin the preset first so the sheet's palette matches it after reload.
await run(`(() => {
  const key = 'textmark.settings.v8';
  const stored = JSON.parse(localStorage.getItem(key) || '{}');
  localStorage.setItem(key, JSON.stringify({ ...stored, themePreset: ${JSON.stringify(preset)} }));
  return true;
})()`)
await send('Page.reload')
await delay(2500)

await run(`(() => {
  const summary = document.querySelector('details.themes-and-settings > summary');
  summary?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  summary?.click();
  return Boolean(summary);
})()`)
await delay(600)
await run(`(() => {
  const button = document.querySelector('.appearance-popover button[data-theme-preset=${JSON.stringify(preset)}]');
  button?.click();
  return Boolean(button);
})()`)
await delay(600)
await run(`(() => {
  const button = document.querySelector('.appearance-popover .appearance-customize');
  button?.click();
  return Boolean(button);
})()`)
await delay(700)
await run(`(() => {
  document.querySelector('.customize-theme-sheet .customize-theme-font-header')?.click();
  return true;
})()`)
await delay(700)

const shot = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync(output, Buffer.from(shot.data, 'base64'))
console.log(`saved ${output}`)

socket.close()
processHandle.kill()
process.exit(0)
