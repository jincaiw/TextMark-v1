#!/usr/bin/env node
// Capture the code-block card and the diagram HUD (upstream md-code-header /
// mermaid-hud) via CDP. Usage: node scripts/capture-block-pills.mjs [url] [outdir]
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [url = 'http://localhost:1420/', outdir = '/tmp/textmark-shots'] = process.argv.slice(2)
mkdirSync(outdir, { recursive: true })
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
    '--window-size=1440,900',
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
const shot = async (name) => {
  const png = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(outdir, name), Buffer.from(png.data, 'base64'))
  console.log(`saved ${join(outdir, name)}`)
}
await send('Page.enable')
await send('Runtime.enable')
await delay(2500)

// Code card: scroll the first code block into view and measure its header pill.
const code = await run(`(() => {
  const wrap = document.querySelector('.md-code-wrap');
  if (!wrap) return { present: false };
  wrap.scrollIntoView({ block: 'center' });
  const header = wrap.querySelector('.md-code-header');
  const pill = wrap.querySelector('.md-code-actions');
  const btn = wrap.querySelector('.md-code-action');
  const hr = header.getBoundingClientRect();
  const pr = pill.getBoundingClientRect();
  const br = btn.getBoundingClientRect();
  const wr = wrap.getBoundingClientRect();
  return {
    present: true,
    language: wrap.querySelector('.md-code-language')?.textContent,
    buttons: Array.from(wrap.querySelectorAll('.md-code-action')).map((b) => b.getAttribute('aria-label')),
    cardRadius: getComputedStyle(wrap).borderRadius,
    headerHeight: hr.height,
    pillHeight: pr.height,
    pillRadius: getComputedStyle(pill).borderRadius,
    pillTopInset: Math.round(pr.top - wr.top),
    pillRightInset: Math.round(wr.right - pr.right),
    buttonSize: [Math.round(br.width), Math.round(br.height)],
  };
})()`)
console.log('CODE', JSON.stringify(code, null, 2))
await delay(300)
await shot('code-card.png')

// Diagram HUD: scroll the figure into view, hover it, measure the two pills.
const diagramCenter = await run(`(() => {
  const figure = document.querySelector('.diagram');
  if (!figure) return null;
  figure.scrollIntoView({ block: 'center' });
  const r = figure.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
})()`)
if (diagramCenter) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: diagramCenter.x, y: diagramCenter.y })
  await delay(400)
}
const diagram = await run(`(() => {
  const figure = document.querySelector('.diagram');
  if (!figure) return { present: false };
  const hud = figure.querySelector('.diagram-hud');
  if (!hud) return { present: false, hud: false };
  const fr = figure.getBoundingClientRect();
  const hr = hud.getBoundingClientRect();
  const groups = Array.from(hud.querySelectorAll('.diagram-hud-group'));
  const level = hud.querySelector('.diagram-hud-level');
  const btn = hud.querySelector('.diagram-hud-btn');
  const br = btn.getBoundingClientRect();
  return {
    present: true,
    opacity: getComputedStyle(hud).opacity,
    topInset: Math.round(hr.top - fr.top),
    rightInset: Math.round(fr.right - hr.right),
    groupGap: groups.length === 2 ? Math.round(groups[1].getBoundingClientRect().left - groups[0].getBoundingClientRect().right) : null,
    groupHeight: groups[0] ? Math.round(groups[0].getBoundingClientRect().height) : null,
    groupRadius: groups[0] ? getComputedStyle(groups[0]).borderRadius : null,
    level: level?.textContent,
    actions: Array.from(hud.querySelectorAll('[data-diagram-action]')).map((b) => b.dataset.diagramAction),
    buttonSize: [Math.round(br.width), Math.round(br.height)],
  };
})()`)
console.log('DIAGRAM', JSON.stringify(diagram, null, 2))
await shot('diagram-hud.png')
socket.close()
processHandle.kill()
process.exit(0)
