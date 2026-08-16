export const documentCss = `
:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#fff;color:#1d1d1f;font:16px/1.58 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.markdown-body{width:min(820px,100%);margin:0 auto;padding:48px 40px 80px;overflow-wrap:anywhere}h1,h2,h3,h4,h5,h6{line-height:1.2;letter-spacing:-.02em}h1{font-size:2.15em}h2{margin-top:1.55em;font-size:1.65em}a{color:#0678de}blockquote,.markdown-alert{margin:1.2em 0;padding:1em 1.15em;border-radius:10px;background:#f4f4f6}pre{overflow:auto;padding:18px 20px;border-radius:10px;background:#f2f2f5}code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}img,svg{max-width:100%;height:auto}table{width:100%;border-spacing:0;border-collapse:separate;border:1px solid #ddd;border-radius:9px;overflow:hidden}td,th{padding:.62em .75em;border-right:1px solid #ddd;border-bottom:1px solid #ddd;text-align:left}th{background:#f5f5f6}.diagram{margin:1.4em 0;padding:18px;border:1px solid #ddd;border-radius:10px}.copy-code-button,.diagram-hud,mark.search-match{display:none!important}@media print{body{font-size:12pt}.markdown-body{width:100%;padding:0}pre,table,blockquote,.markdown-alert,.diagram{break-inside:avoid}}
`

const cleanName = (name: string) =>
  name.replace(/\.(?:md|markdown|mdown|mkd|mkdn|mdwn|mdtxt|mdtext|rmd|txt)$/i, '').replace(/[<>:"/\\|?*]/g, '-')

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function exportClone(root: HTMLElement) {
  const clone = root.cloneNode(true) as HTMLElement
  clone.querySelectorAll('.copy-code-button,.diagram-hud,mark.search-match').forEach((node) => node.remove())
  clone.querySelectorAll('[contenteditable]').forEach((node) => node.removeAttribute('contenteditable'))
  return clone
}

async function captureLivePng(root: HTMLElement, pixelRatio = 2) {
  // Rasterize the live, laid-out node (offscreen fixed clones render blank in
  // desktop webviews). Force the light palette during capture so dark-mode
  // documents export as readable light documents.
  const { toPng } = await import('html-to-image')
  const html = document.documentElement
  const wasDark = html.dataset.theme === 'dark'
  if (wasDark) html.dataset.theme = 'light'
  try {
    return await toPng(root, {
      pixelRatio,
      backgroundColor: '#ffffff',
      cacheBust: true,
      filter: (node) =>
        !(node instanceof HTMLElement) ||
        (!node.classList.contains('copy-code-button') &&
          !node.classList.contains('diagram-hud') &&
          !node.classList.contains('search-match')),
    })
  } finally {
    if (wasDark) html.dataset.theme = 'dark'
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
    if (!sheet.href) continue
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
      const current = originals[index]?.currentSrc || originals[index]?.src || image.src
      if (!current) return
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
  const dataUrl = await captureLivePng(root, 2)
  return { name: `${cleanName(name)}@2x.png`, bytes: dataUrlToBytes(dataUrl) }
}

const dataUrlToBytes = (dataUrl: string) => {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export async function buildPdfExport(name: string, root: HTMLElement) {
  const dataUrl = await captureLivePng(root, 2)
  const { jsPDF } = await import('jspdf')
  const image = new Image()
  image.src = dataUrl
  await image.decode()
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4', compress: true })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  // One A4 page-height slice per page, drawn from the continuous tall snapshot.
  const sliceHeight = Math.floor((image.height / image.width) * pageWidth)
  let offset = 0
  let page = 0
  while (offset < image.height) {
    const height = Math.min(sliceHeight, image.height - offset)
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = height
    const context = canvas.getContext('2d')!
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, offset, image.width, height, 0, 0, image.width, height)
    const jpeg = canvas.toDataURL('image/jpeg', 0.92)
    if (page > 0) pdf.addPage()
    pdf.addImage(jpeg, 'JPEG', 0, 0, pageWidth, Math.min(pageHeight, height / (image.width / pageWidth)))
    offset += height
    page += 1
  }
  return { name: `${cleanName(name)}.pdf`, bytes: new Uint8Array(pdf.output('arraybuffer')) }
}

export async function downloadPdf(name: string, root: HTMLElement) {
  const { name: fileName, bytes } = await buildPdfExport(name, root)
  download(fileName, new Blob([bytes], { type: 'application/pdf' }))
}
