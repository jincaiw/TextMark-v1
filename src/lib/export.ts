export const documentCss = `
:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#fff;color:#1d1d1f;font:16px/1.58 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.markdown-body{width:min(820px,100%);margin:0 auto;padding:48px 40px 80px;overflow-wrap:anywhere}h1,h2,h3,h4,h5,h6{line-height:1.2;letter-spacing:-.02em}h1{font-size:2.15em}h2{margin-top:1.55em;font-size:1.65em}strong{font-weight:650}s,del{color:#6e6e73;text-decoration-thickness:1.5px}sub,sup{line-height:0}a{color:#0678de}blockquote,.markdown-alert{margin:1.2em 0;padding:1em 1.15em;border-radius:10px;background:#f4f4f6}details{margin:1.2em 0;padding:12px 14px;border:1px solid #ddd;border-radius:9px;background:#fafafa}summary{cursor:pointer;font-weight:600}details[open] summary{margin-bottom:10px}pre{overflow:auto;padding:18px 20px;border-radius:10px;background:#f2f2f5}code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}kbd{display:inline-block;min-width:1.7em;padding:.08em .42em;border:1px solid #d2d2d7;border-bottom-width:2px;border-radius:5px;background:#f5f5f7;font:82%/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;text-align:center}img,svg{max-width:100%;height:auto}.markdown-alert-icon{width:1em;height:1em;margin-right:.5em;vertical-align:-.12em;fill:currentColor}table{width:100%;border-spacing:0;border-collapse:separate;border:1px solid #ddd;border-radius:9px;overflow:hidden}td,th{padding:.62em .75em;border-right:1px solid #ddd;border-bottom:1px solid #ddd;text-align:left}th{background:#f5f5f6}.footnotes{margin-top:2.35em;padding-top:1em;border-top:1px solid #ddd;font-size:.9em}.diagram{margin:1.4em 0;padding:18px;border:1px solid #ddd;border-radius:10px}.copy-code-button,.diagram-hud,mark.search-match{display:none!important}@media print{@page{size:A4;margin:16mm 15mm 18mm}body{font-size:11pt;-webkit-print-color-adjust:exact;print-color-adjust:exact}.markdown-body{width:100%;padding:0}h1,h2,h3,h4,h5,h6{break-after:avoid-page}pre,table,blockquote,.markdown-alert,.diagram,details,img{break-inside:avoid-page}thead{display:table-header-group}}
`

const cleanName = (name: string) =>
  name.replace(/\.(?:md|markdown|mdown|mkd|mkdn|mdwn|mdtxt|mdtext|rmd|txt)$/i, '').replace(/[<>:"/\\|?*]/g, '-')

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  // Safari and desktop WebKit can ignore a detached anchor, and revoking the
  // object URL in the next task can race the actual download. Keep the anchor
  // attached until the click has been dispatched and release the URL later.
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function exportClone(root: HTMLElement) {
  const clone = root.cloneNode(true) as HTMLElement
  clone.querySelectorAll('.copy-code-button,.diagram-hud,mark.search-match').forEach((node) => node.remove())
  clone.querySelectorAll('[contenteditable]').forEach((node) => node.removeAttribute('contenteditable'))
  return clone
}

const documentThemeProperties = [
  '--window',
  '--chrome',
  '--sidebar',
  '--surface',
  '--text',
  '--document-text',
  '--document-secondary',
  '--accent',
  '--document-link',
  '--document-fill',
  '--document-grid',
] as const

/** Keep browser canvases below their per-axis limit. WebKit-based desktop
 * webviews have a lower practical ceiling than Chromium. */
export const rasterPixelRatio = (width: number, height: number, requested = 2, maximumDimension = 32_760, maximumArea = 268_435_456) => {
  const safeWidth = Math.max(1, width)
  const safeHeight = Math.max(1, height)
  return Math.min(requested, maximumDimension / safeWidth, maximumDimension / safeHeight, Math.sqrt(maximumArea / (safeWidth * safeHeight)))
}

/** Top-level rendered block boundaries which are safe to use as PDF page
 * breaks. Source-line spacer nodes are ignored, and consecutive headings stay
 * attached to the first content block which follows them. */
export const pdfPageBreakPositions = (root: HTMLElement, boundsTop: number) => {
  const children = Array.from(root.children).filter((child) => !child.classList.contains('md-source-blank-line'))
  return children
    .filter((_, index) => !children[index - 1]?.matches('h1,h2,h3,h4,h5,h6'))
    .map((child) => Math.max(0, child.getBoundingClientRect().top - boundsTop))
    .filter((position, index, positions) => position > 0 && position !== positions[index - 1])
}

interface RasterCapture {
  blob: Blob
  cssHeight: number
  pageBreaks: number[]
}

const transparentPixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='

async function captureLiveRaster(root: HTMLElement, pixelRatio = 2): Promise<RasterCapture> {
  // Rasterize the live, laid-out node (offscreen fixed clones render blank in
  // desktop webviews). Force the light palette during capture so dark-mode
  // documents export as readable light documents. Blob output avoids the very
  // large base64 string used by toPng, which is particularly fragile in
  // WebKit. Retry at a lower scale when a device reports a tighter canvas cap.
  const { toBlob } = await import('html-to-image')
  const html = document.documentElement
  const hadExportClass = root.classList.contains('textmark-exporting')
  root.classList.add('textmark-exporting')
  const bounds = root.getBoundingClientRect()
  const pageBreaks = pdfPageBreakPositions(root, bounds.top)
  const webKit = /AppleWebKit/i.test(navigator.userAgent) && !/(?:Chrome|Chromium)/i.test(navigator.userAgent)
  const maximumDimension = webKit ? 16_380 : 32_760
  const maximumArea = webKit ? 16_777_216 : 268_435_456
  const captureWidth = Math.max(root.scrollWidth, Math.ceil(bounds.width))
  const captureHeight = Math.max(root.scrollHeight, Math.ceil(bounds.height))
  const safePixelRatio = rasterPixelRatio(captureWidth, captureHeight, pixelRatio, maximumDimension, maximumArea)
  const previousTheme = html.getAttribute('data-theme')
  const previousThemeProperties = documentThemeProperties.map((property) => ({
    property,
    value: html.style.getPropertyValue(property),
    priority: html.style.getPropertyPriority(property),
  }))
  html.dataset.theme = 'light'
  // Theme presets are applied as inline custom properties, which otherwise
  // override the light export palette even after data-theme changes.
  documentThemeProperties.forEach((property) => html.style.removeProperty(property))
  try {
    await document.fonts?.ready
    const attempts = [
      ...new Set([safePixelRatio, safePixelRatio * 0.75, safePixelRatio * 0.5].map((ratio) => Math.max(Number.EPSILON, ratio))),
    ]
    let lastError: unknown
    for (const attemptPixelRatio of attempts) {
      try {
        const blob = await toBlob(root, {
          pixelRatio: attemptPixelRatio,
          backgroundColor: '#ffffff',
          cacheBust: true,
          imagePlaceholder: transparentPixel,
          preferredFontFormat: 'woff2',
          skipAutoScale: true,
          style: { margin: '0' },
          filter: (node) => {
            if (!(node instanceof HTMLElement)) return true
            if (node instanceof HTMLImageElement && (!node.currentSrc || node.classList.contains('asset-error'))) return false
            return (
              !node.classList.contains('copy-code-button') &&
              !node.classList.contains('diagram-hud') &&
              !node.classList.contains('search-match')
            )
          },
        })
        if (!blob) throw new Error('png_blob_unavailable')
        return {
          blob,
          cssHeight: captureHeight,
          pageBreaks,
        }
      } catch (error) {
        lastError = error
      }
    }
    throw lastError instanceof Error ? lastError : new Error('png_capture_failed')
  } finally {
    if (previousTheme === null) html.removeAttribute('data-theme')
    else html.setAttribute('data-theme', previousTheme)
    previousThemeProperties.forEach(({ property, value, priority }) => {
      if (value) html.style.setProperty(property, value, priority)
      else html.style.removeProperty(property)
    })
    if (!hadExportClass) root.classList.remove('textmark-exporting')
  }
}

const blobAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result)), { once: true })
    reader.addEventListener('error', () => reject(reader.error), { once: true })
    reader.readAsDataURL(blob)
  })

async function inlineCssAssetUrls(css: string, stylesheetUrl: string) {
  const matches = [...css.matchAll(/url\((['"]?)([^'"\)]+)\1\)/g)]
  const replacements = new Map<string, string>()
  await Promise.all(
    matches.map(async ([raw, , path]) => {
      if (/^(?:data:|#)/i.test(path) || replacements.has(raw)) return
      try {
        const response = await fetch(new URL(path, stylesheetUrl))
        if (!response.ok) return
        replacements.set(raw, `url("${await blobAsDataUrl(await response.blob())}")`)
      } catch {
        /* The base document CSS remains usable with system fonts. */
      }
    }),
  )
  for (const [from, to] of replacements) css = css.split(from).join(to)
  return css
}

async function selfContainedStyles() {
  const styles = [documentCss]
  for (const sheet of Array.from(document.styleSheets)) {
    if (!sheet.href) {
      try {
        const inlineCss = Array.from(sheet.cssRules)
          .map((rule) => rule.cssText)
          .join('\n')
        if (inlineCss) styles.push(await inlineCssAssetUrls(inlineCss, location.href))
      } catch {
        /* Ignore inaccessible injected styles; documentCss remains readable. */
      }
      continue
    }
    const stylesheetLocation = new URL(sheet.href, location.href)
    if (['http:', 'https:'].includes(stylesheetLocation.protocol) && stylesheetLocation.origin !== location.origin) continue
    try {
      const response = await fetch(sheet.href)
      if (response.ok) styles.push(await inlineCssAssetUrls(await response.text(), sheet.href))
    } catch {
      /* documentCss is a complete readable fallback. */
    }
  }
  return styles.join('\n')
}

async function inlineImages(source: HTMLElement, clone: HTMLElement) {
  const originals = Array.from(source.querySelectorAll<HTMLImageElement>('img'))
  const copies = Array.from(clone.querySelectorAll<HTMLImageElement>('img'))
  await Promise.all(
    copies.map(async (image, index) => {
      const original = originals[index]
      const declared = original?.getAttribute('src') || image.getAttribute('src') || ''
      const current = original?.currentSrc || (declared ? original?.src || image.src : '')
      if (!current) {
        image.removeAttribute('src')
        image.removeAttribute('srcset')
        image.classList.add('asset-error')
        return
      }
      if (current.startsWith('data:')) {
        image.src = current
        return
      }
      try {
        const response = await fetch(current)
        if (!response.ok) throw new Error('image_fetch_failed')
        image.src = await blobAsDataUrl(await response.blob())
        image.removeAttribute('srcset')
      } catch {
        image.removeAttribute('src')
        image.removeAttribute('srcset')
        image.classList.add('asset-error')
      }
    }),
  )
}

export async function buildSelfContainedHtml(name: string, root: HTMLElement) {
  const clone = exportClone(root)
  await inlineImages(root, clone)
  const title = name.replace(/[<&>]/g, '')
  const css = await selfContainedStyles()
  return `<!doctype html><html lang="${document.documentElement.lang || 'zh-CN'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:"><title>${title}</title><style>${css}</style></head><body>${clone.outerHTML}</body></html>`
}

export async function downloadHtml(name: string, root: HTMLElement) {
  download(`${cleanName(name)}.html`, new Blob([await buildSelfContainedHtml(name, root)], { type: 'text/html;charset=utf-8' }))
}

export async function downloadPng(name: string, root: HTMLElement) {
  const { name: fileName, bytes } = await buildPngExport(name, root)
  download(fileName, new Blob([bytes], { type: 'image/png' }))
}

export async function buildHtmlExport(name: string, root: HTMLElement) {
  const html = await buildSelfContainedHtml(name, root)
  return { name: `${cleanName(name)}.html`, bytes: new TextEncoder().encode(html) }
}

export async function buildPngExport(name: string, root: HTMLElement) {
  const { blob } = await captureLiveRaster(root, 2)
  return { name: `${cleanName(name)}@2x.png`, bytes: new Uint8Array(await blob.arrayBuffer()) }
}

/** Source-image pixels which fit exactly one output page at the supplied
 * rendered width. Kept separate so long-document pagination is testable. */
export const pdfSourceSliceHeight = (imageWidth: number, pageWidth: number, pageHeight: number) =>
  Math.max(1, Math.floor((pageHeight * imageWidth) / pageWidth))

export const alignedPdfSliceHeight = (pageBreaks: number[], offset: number, desiredHeight: number, totalHeight: number) => {
  if (offset + desiredHeight >= totalHeight) return totalHeight - offset
  const minimum = offset + desiredHeight * 0.52
  const maximum = offset + desiredHeight - 2
  const candidates = pageBreaks.filter((position) => position >= minimum && position <= maximum)
  const candidate = candidates[candidates.length - 1]
  return candidate == null ? desiredHeight : Math.max(1, candidate - offset)
}

export async function buildPdfExport(name: string, root: HTMLElement) {
  const { blob, cssHeight, pageBreaks } = await captureLiveRaster(root, 2)
  const { jsPDF } = await import('jspdf')
  const image = new Image()
  // A data URL is more consistently decodable than a short-lived blob URL in
  // WKWebView and headless export hosts. PNG download itself still stays on
  // the lower-memory Blob path above.
  image.src = await blobAsDataUrl(blob)
  await image.decode()
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const marginX = 42
  const marginTop = 46
  const marginBottom = 52
  const contentWidth = pageWidth - marginX * 2
  const contentHeight = pageHeight - marginTop - marginBottom
  // One physical A4 page-height slice per page, expressed in source-image
  // pixels. Using the full image height here makes page count width-dependent.
  const sliceHeight = pdfSourceSliceHeight(image.width, contentWidth, contentHeight)
  const imagePageBreaks = pageBreaks.map((position) => Math.round((position * image.height) / cssHeight))
  let offset = 0
  let page = 0
  while (offset < image.height) {
    const height = alignedPdfSliceHeight(imagePageBreaks, offset, Math.min(sliceHeight, image.height - offset), image.height)
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = height
    const context = canvas.getContext('2d')!
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, offset, image.width, height, 0, 0, image.width, height)
    // Lossless PNG keeps small CJK glyphs and syntax highlighting crisp. Each
    // page is rasterized separately, so this canvas remains comfortably below
    // browser limits even when the source document is long.
    const png = canvas.toDataURL('image/png')
    if (page > 0) pdf.addPage()
    const renderedHeight = Math.min(contentHeight, height / (image.width / contentWidth))
    pdf.addImage(png, 'PNG', marginX, marginTop, contentWidth, renderedHeight, undefined, 'FAST')
    offset += height
    page += 1
  }
  pdf.setProperties({ title: cleanName(name), creator: 'TextMark', subject: 'Markdown export' })
  const totalPages = pdf.getNumberOfPages()
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(120, 120, 124)
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    pdf.setPage(pageNumber)
    pdf.text(`${pageNumber} / ${totalPages}`, pageWidth / 2, pageHeight - 24, { align: 'center' })
  }
  return { name: `${cleanName(name)}.pdf`, bytes: new Uint8Array(pdf.output('arraybuffer')) }
}

export async function downloadPdf(name: string, root: HTMLElement) {
  const { name: fileName, bytes } = await buildPdfExport(name, root)
  download(fileName, new Blob([bytes], { type: 'application/pdf' }))
}
