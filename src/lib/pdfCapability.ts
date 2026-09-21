export type PdfCapability = 'native-vector' | 'browser-vector' | 'raster-fallback'

export interface PdfRuntime {
  tauri: boolean
  macos: boolean
  printAvailable: boolean
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
