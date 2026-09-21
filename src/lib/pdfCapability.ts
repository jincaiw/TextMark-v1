export type PdfCapability = 'native-vector' | 'browser-vector' | 'raster-fallback'

export type PdfTextGuarantee = 'selectable-text' | 'rasterized'

export interface PdfRuntime {
  tauri: boolean
  macos: boolean
  printAvailable: boolean
}

export interface PdfExportContract {
  capability: PdfCapability
  text: PdfTextGuarantee
  vectorGraphics: boolean
}

/**
 * Selects the least lossy PDF path without claiming cross-platform parity that
 * has not been verified. macOS Tauri uses the native WebView print dialog;
 * browser runtimes use window.print; other desktop targets retain the tested
 * raster export fallback until a platform-specific vector probe is available.
 */
export function pdfCapability(runtime: PdfRuntime): PdfCapability {
  if (runtime.tauri && runtime.macos && runtime.printAvailable) return 'native-vector'
  if (!runtime.tauri && runtime.printAvailable) return 'browser-vector'
  return 'raster-fallback'
}

/**
 * Documents the observable guarantees of the selected path. The jsPDF path is
 * intentionally described as rasterized: it produces a reliable PDF file on
 * every desktop target, but does not promise searchable text or vector output.
 */
export function pdfExportContract(runtime: PdfRuntime): PdfExportContract {
  const capability = pdfCapability(runtime)
  const vector = capability !== 'raster-fallback'
  return {
    capability,
    text: vector ? 'selectable-text' : 'rasterized',
    vectorGraphics: vector,
  }
}
