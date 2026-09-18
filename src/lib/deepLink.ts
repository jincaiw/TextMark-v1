/**
 * Accept only TextMark's documented form: textmark://file/<absolute-path>.
 * The native boundary decides whether the target is a supported document or
 * a directory; URL parsing must not guess from a filename extension.
 * URLs are untrusted input even when delivered by the operating system.
 */
export function parseTextmarkFileUrl(raw: string): string | null {
  const rawPath = raw.match(/^textmark:\/\/file(?<path>[^?#]*)/i)?.groups?.path
  if (rawPath == null) return null
  try {
    if (
      decodeURIComponent(rawPath)
        .split(/[\\/]+/)
        .includes('..')
    )
      return null
  } catch {
    return null
  }
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'textmark:' || url.hostname !== 'file' || url.search || url.hash) return null
  let path: string
  try {
    path = decodeURIComponent(url.pathname)
  } catch {
    return null
  }
  if (!path || path.includes('\0') || path.split(/[\\/]+/).includes('..')) return null
  // URL paths on Windows begin with /C:/; the native file command expects C:/.
  if (/^\/[A-Za-z]:[\\/]/.test(path)) path = path.slice(1)
  const absolute = path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path)
  if (!absolute) return null
  return path
}
