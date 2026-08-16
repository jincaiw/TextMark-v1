const urlScheme = /^[a-z][a-z\d+.-]*:/i

export function safeRelativeAssetPath(source: string): string | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(source.split(/[?#]/, 1)[0])
  } catch {
    return null
  }
  if (!decoded || decoded.startsWith('/') || decoded.startsWith('\\') || urlScheme.test(decoded)) return null
  const parts = decoded.replace(/\\/g, '/').split('/')
  if (parts.some((part) => part === '..') || /^[a-z]:/i.test(parts[0] ?? '')) return null
  return parts.filter((part) => part && part !== '.').join('/') || null
}
