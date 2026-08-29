/** Rewrites only Markdown image destinations, never ordinary links or fenced code. */
export function replacePastedImageReferences(source: string, previousPath: string, nextPath: string): { source: string; count: number } {
  let fenced: string | null = null
  let count = 0
  const lines = source.split(/\r?\n/)
  const result = lines.map((line) => {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1]
    if (marker) {
      if (!fenced) fenced = marker[0]
      else if (marker[0] === fenced && marker.length >= 3) fenced = null
      return line
    }
    if (fenced) return line
    return line.replace(
      /!\[([^\]\n]*)\]\((<)?([^\s)>]+)(>)?([^)]*)\)/g,
      (full, alt: string, opening: string, destination: string, closing: string, suffix: string) => {
        if (destination !== previousPath || Boolean(opening) !== Boolean(closing)) return full
        count += 1
        return `![${alt}](${opening ?? ''}${nextPath}${closing ?? ''}${suffix})`
      },
    )
  })
  return { source: result.join('\n'), count }
}
