import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'

const [sourceArgument, outputArgument, origin = 'http://127.0.0.1:1420'] = process.argv.slice(2)
if (!sourceArgument) throw new Error('Usage: node scripts/verify-exports.mjs <source.md> [output-directory] [origin]')
const sourcePath = resolve(sourceArgument)
const outputDirectory = resolve(outputArgument || join(tmpdir(), 'textmark-export-qa'))
const source = readFileSync(sourcePath, 'utf8')
const documentName = basename(sourcePath)
const stripImages = process.env.TEXTMARK_EXPORT_STRIP_IMAGES === '1'
const expectFullFixture = process.env.TEXTMARK_EXPORT_EXPECT_FULL === '1'
const previewUrl = new URL('/preview.html', origin).href
const chrome = process.env.TEXTMARK_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
if (!existsSync(chrome)) throw new Error(`Chrome is unavailable: ${chrome}`)

let serverProcess
try {
  const response = await fetch(origin)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
} catch {
  serverProcess = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev', '--', '--host', '127.0.0.1'], {
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  let serverLog = ''
  serverProcess.stderr.on('data', (chunk) => {
    serverLog += chunk.toString()
  })
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (serverProcess.exitCode !== null) throw new Error(`Preview server exited early.\n${serverLog}`)
    try {
      const response = await fetch(origin)
      if (response.ok) break
    } catch {
      // The server is still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100))
    if (attempt === 149) throw new Error(`Preview server did not start.\n${serverLog}`)
  }
}

const profile = mkdtempSync(join(tmpdir(), 'textmark-export-chrome-'))
const chromeProcess = spawn(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--remote-debugging-port=0',
    '--window-size=1280,900',
    `--user-data-dir=${profile}`,
    previewUrl,
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] },
)
let chromeLog = ''
let chromeExitCode
chromeProcess.stderr.on('data', (chunk) => {
  chromeLog += chunk.toString()
})
chromeProcess.once('exit', (code) => {
  chromeExitCode = code
})

const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))
let socket
try {
  for (let attempt = 0; attempt < 600 && !existsSync(join(profile, 'DevToolsActivePort')) && chromeExitCode === undefined; attempt += 1)
    await delay(50)
  if (!existsSync(join(profile, 'DevToolsActivePort')))
    throw new Error(`Chrome debugging endpoint did not start (exit ${chromeExitCode ?? 'still running'}).\n${chromeLog}`)
  const [port] = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').trim().split('\n')

  let page
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json())
    page = targets.find((target) => target.type === 'page' && target.url === previewUrl)
    if (page) break
    await delay(50)
  }
  if (!page) throw new Error('Chrome preview target was not found')

  socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolveSocket, rejectSocket) => {
    socket.addEventListener('open', resolveSocket, { once: true })
    socket.addEventListener('error', rejectSocket, { once: true })
  })
  let commandId = 0
  const pending = new Map()
  const browserFailures = []
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      const callbacks = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) callbacks.reject(new Error(message.error.message))
      else callbacks.resolve(message.result)
    }
    if (message.method === 'Runtime.exceptionThrown')
      browserFailures.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text)
    if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params.type))
      browserFailures.push(message.params.args.map((argument) => argument.value ?? argument.description).join(' '))
  })
  const send = (method, params = {}) =>
    new Promise((resolveCommand, rejectCommand) => {
      const id = ++commandId
      pending.set(id, { resolve: resolveCommand, reject: rejectCommand })
      socket.send(JSON.stringify({ id, method, params }))
    })

  await send('Runtime.enable')
  await send('Page.enable')
  let ready = false
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const response = await send('Runtime.evaluate', {
      expression: 'Boolean(window.TextMarkPreview?.render)',
      returnByValue: true,
    })
    if (response.result.value) {
      ready = true
      break
    }
    await delay(50)
  }
  if (!ready) throw new Error('TextMark preview host did not become ready')

  const expression = `(async () => {
    let stage = 'render';
    try {
      const source = ${JSON.stringify(source)};
      const documentName = ${JSON.stringify(documentName)};
      await window.TextMarkPreview.render({ source, locale: 'zh-CN', appearance: 'dark', themePreset: 'dracula' });
      await document.fonts.ready;
      const root = document.querySelector('.markdown-body');
      await Promise.all([...root.querySelectorAll('img')].map((image) => image.decode().catch(() => undefined)));
      if (${JSON.stringify(stripImages)}) root.querySelectorAll('img').forEach((image) => image.remove());
      const before = {
        theme: document.documentElement.dataset.theme,
        documentText: document.documentElement.style.getPropertyValue('--document-text')
      };
      const failedFetches = [];
      const originalFetch = window.fetch.bind(window);
      window.fetch = (...arguments_) => originalFetch(...arguments_).catch((error) => {
        failedFetches.push(String(arguments_[0]));
        throw error;
      });
      stage = 'load exporter';
      const exporter = await import('/src/lib/export.ts');
      stage = 'HTML export';
      const html = await exporter.buildHtmlExport(documentName, root);
      stage = 'PNG export';
      const png = await exporter.buildPngExport(documentName, root);
      stage = 'PDF export';
      const pdf = await exporter.buildPdfExport(documentName, root);
    const encode = (bytes) => {
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 32768)
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
      return btoa(binary);
    };
    const htmlText = new TextDecoder().decode(html.bytes);
    const parsed = new DOMParser().parseFromString(htmlText, 'text/html');
      return {
      names: { html: html.name, png: png.name, pdf: pdf.name },
      htmlText,
      pngBase64: encode(png.bytes),
      pdfBase64: encode(pdf.bytes),
      root: { width: root.scrollWidth, height: root.scrollHeight },
      rendered: {
        headings: root.querySelectorAll('h1,h2,h3,h4,h5,h6').length,
        tables: root.querySelectorAll('table').length,
        tasks: root.querySelectorAll('.task-list-item-checkbox').length,
        alerts: root.querySelectorAll('.markdown-alert').length,
        math: root.querySelectorAll('.katex').length,
        diagrams: root.querySelectorAll('.mermaid svg').length,
        images: root.querySelectorAll('img').length,
        scripts: root.querySelectorAll('script').length,
        inlineHandlers: root.querySelectorAll('[onerror],[onclick],[onload]').length
      },
      htmlChecks: {
        csp: Boolean(parsed.querySelector('meta[http-equiv="Content-Security-Policy"]')),
        scripts: parsed.scripts.length,
        diagrams: parsed.querySelectorAll('.mermaid svg').length,
        diagramText: Array.from(parsed.querySelectorAll('.mermaid svg text'))
          .map((node) => node.textContent?.replace(/\\s+/g, ' ').trim() || '')
          .filter(Boolean)
          .join(' '),
        dataImages: parsed.querySelectorAll('img[src^="data:"]').length,
        missingImages: parsed.querySelectorAll('img.asset-error:not([src])').length,
        screenControls: parsed.querySelectorAll('.copy-code-button,.diagram-hud,mark.search-match').length
      },
      themeRestored: {
        theme: document.documentElement.dataset.theme,
        documentText: document.documentElement.style.getPropertyValue('--document-text')
      },
      themeBefore: before,
      failedFetches
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : error?.type || String(error);
      const root = document.querySelector('.markdown-body');
      const images = [...(root?.querySelectorAll('img') || [])].map((image) => ({
        src: image.getAttribute('src'),
        currentSrc: image.currentSrc,
        complete: image.complete,
        naturalWidth: image.naturalWidth,
        className: image.className
      }));
      throw new Error(stage + ': ' + message + ' | root=' + (root?.scrollWidth || 0) + 'x' + (root?.scrollHeight || 0) + ' | images=' + JSON.stringify(images));
    }
  })()`
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text)
  const result = response.result.value
  mkdirSync(outputDirectory, { recursive: true })
  const htmlPath = join(outputDirectory, result.names.html)
  const pngPath = join(outputDirectory, result.names.png)
  const pdfPath = join(outputDirectory, result.names.pdf)
  writeFileSync(htmlPath, result.htmlText)
  writeFileSync(pngPath, Buffer.from(result.pngBase64, 'base64'))
  writeFileSync(pdfPath, Buffer.from(result.pdfBase64, 'base64'))
  await send('Runtime.evaluate', {
    expression: "document.getElementById('十数学公式')?.scrollIntoView({ block: 'start' })",
    returnByValue: true,
  })
  await delay(150)
  const liveMathScreenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const liveMathPath = join(outputDirectory, 'live-preview-math.png')
  writeFileSync(liveMathPath, Buffer.from(liveMathScreenshot.data, 'base64'))
  await send('Runtime.evaluate', {
    expression: `document.open();document.write(${JSON.stringify(result.htmlText)});document.close()`,
    returnByValue: true,
  })
  await delay(150)
  await send('Runtime.evaluate', {
    expression: "document.getElementById('十数学公式')?.scrollIntoView({ block: 'start' })",
    returnByValue: true,
  })
  const htmlMathScreenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const htmlMathPath = join(outputDirectory, 'html-export-math.png')
  writeFileSync(htmlMathPath, Buffer.from(htmlMathScreenshot.data, 'base64'))
  const png = readFileSync(pngPath)
  const pdf = readFileSync(pdfPath)
  const report = {
    outputs: {
      html: htmlPath,
      png: pngPath,
      pdf: pdfPath,
      liveMathScreenshot: liveMathPath,
      htmlMathScreenshot: htmlMathPath,
    },
    root: result.root,
    rendered: result.rendered,
    htmlChecks: result.htmlChecks,
    png: {
      bytes: png.length,
      signature: png.subarray(0, 8).toString('hex'),
      width: png.readUInt32BE(16),
      height: png.readUInt32BE(20),
    },
    pdf: { bytes: pdf.length, signature: pdf.subarray(0, 5).toString('ascii') },
    themeBefore: result.themeBefore,
    themeRestored: result.themeRestored,
    failedFetches: result.failedFetches,
    browserFailures,
  }
  console.log(JSON.stringify(report, null, 2))
  if (
    browserFailures.length ||
    report.rendered.scripts ||
    report.rendered.inlineHandlers ||
    report.htmlChecks.scripts ||
    report.htmlChecks.screenControls ||
    report.png.signature !== '89504e470d0a1a0a' ||
    report.pdf.signature !== '%PDF-' ||
    report.failedFetches.length ||
    report.png.width < 1 ||
    report.png.height < 1 ||
    report.pdf.bytes < 1_000 ||
    !report.htmlChecks.csp ||
    report.htmlChecks.missingImages ||
    (expectFullFixture &&
      (report.rendered.headings < 6 ||
        report.rendered.tables < 1 ||
        report.rendered.tasks < 2 ||
        report.rendered.alerts < 1 ||
        report.rendered.math < 2 ||
        report.rendered.diagrams < 1 ||
        report.htmlChecks.diagrams < 1 ||
        !report.htmlChecks.diagramText.includes('Markdown') ||
        !report.htmlChecks.diagramText.includes('Preview'))) ||
    JSON.stringify(report.themeBefore) !== JSON.stringify(report.themeRestored)
  )
    process.exitCode = 1
} finally {
  socket?.close()
  chromeProcess.kill('SIGTERM')
  await Promise.race([new Promise((resolveExit) => chromeProcess.once('exit', resolveExit)), delay(2_000)])
  serverProcess?.kill('SIGTERM')
  rmSync(profile, { recursive: true, force: true })
}
