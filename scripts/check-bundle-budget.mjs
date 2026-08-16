import { readFileSync, readdirSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const maximum = 300 * 1024
const assetDirectory = new URL('../dist/assets/', import.meta.url)

function linkedJavaScript(page) {
  const html = readFileSync(new URL(`../dist/${page}`, import.meta.url), 'utf8')
  const files = [...html.matchAll(/(?:src|href)="\.\/assets\/([^"?]+\.js)"/g)].map((match) => match[1])
  return { html, files: [...new Set(files)] }
}

function gzipBytes(files) {
  return files.reduce((total, file) => total + gzipSync(readFileSync(new URL(file, assetDirectory))).byteLength, 0)
}

const main = linkedJavaScript('index.html')
const preview = linkedJavaScript('preview.html')
const worker = readdirSync(assetDirectory).find((file) => file.startsWith('render.worker-') && file.endsWith('.js'))
if (!worker) throw new Error('render worker was not emitted')
if (/optional-(?:sentry|highlight|katex)/.test(main.html) || /optional-(?:highlight|katex)/.test(preview.html)) {
  throw new Error('an optional renderer or telemetry SDK was preloaded by a first-screen entry')
}
const mainBytes = gzipBytes([...main.files, worker])
const previewBytes = gzipBytes(preview.files)
if (mainBytes >= maximum || previewBytes >= maximum) {
  throw new Error(`gzip budget exceeded: main+worker=${mainBytes}, native-preview=${previewBytes}, limit=${maximum}`)
}
console.log(
  `Bundle budgets passed: main+worker ${Math.round(mainBytes / 1024)} KiB, native preview ${Math.round(previewBytes / 1024)} KiB gzip.`,
)
