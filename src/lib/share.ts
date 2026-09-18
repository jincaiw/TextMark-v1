export type ShareOutcome = 'shared' | 'copied' | 'cancelled'

interface ShareEnvironment {
  clipboard: Pick<Clipboard, 'writeText'>
  share?: (data: ShareData) => Promise<void>
  canShare?: (data: ShareData) => boolean
}

export async function shareMarkdownSource(options: {
  source: string
  name: string
  environment: ShareEnvironment
  nativeShare?: () => Promise<void>
}): Promise<ShareOutcome> {
  if (options.nativeShare) {
    try {
      await options.nativeShare()
      return 'shared'
    } catch {
      // Continue through the portable share path.
    }
  }

  const copy = async (): Promise<ShareOutcome> => {
    await options.environment.clipboard.writeText(options.source)
    return 'copied'
  }
  if (!options.environment.share) return copy()

  const file = new File([options.source], options.name, { type: 'text/markdown;charset=utf-8' })
  const withFile: ShareData = { title: options.name, files: [file] }
  try {
    await options.environment.share(options.environment.canShare?.(withFile) ? withFile : { title: options.name, text: options.source })
    return 'shared'
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    return copy()
  }
}
