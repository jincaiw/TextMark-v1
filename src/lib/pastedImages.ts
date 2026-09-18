interface Replacement {
  from: number
  to: number
}

export interface MarkdownImageReference extends Replacement {
  alt: string
  path: string
  /** End of the complete inline image, including its optional title. */
  imageTo: number
  imageFrom: number
}

const openingFence = /^( {0,3})(`{3,}|~{3,})(.*)$/
const closingFence = /^( {0,3})(`{3,}|~{3,})[\t ]*$/

function unescapedAt(source: string, index: number, value: string) {
  if (source[index] !== value) return false
  let slashes = 0
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === '\\'; cursor -= 1) slashes += 1
  return slashes % 2 === 0
}

function inlineCodeRanges(line: string) {
  const ranges: Array<[number, number]> = []
  let cursor = 0
  while (cursor < line.length) {
    if (line[cursor] !== '`' || !unescapedAt(line, cursor, '`')) {
      cursor += 1
      continue
    }
    let run = 1
    while (line[cursor + run] === '`') run += 1
    const marker = '`'.repeat(run)
    const close = line.indexOf(marker, cursor + run)
    if (close < 0) break
    ranges.push([cursor, close + run])
    cursor = close + run
  }
  return ranges
}

function inlineImageEnd(line: string, destinationEnd: number) {
  let cursor = destinationEnd
  let separated = false
  while (line[cursor] === ' ' || line[cursor] === '\t') {
    separated = true
    cursor += 1
  }
  if (line[cursor] === ')') return cursor + 1
  if (!separated) return null
  const opener = line[cursor]
  const closer = opener === '"' ? '"' : opener === "'" ? "'" : opener === '(' ? ')' : null
  if (!closer) return null
  cursor += 1
  while (cursor < line.length && !unescapedAt(line, cursor, closer)) cursor += 1
  if (cursor >= line.length) return null
  cursor += 1
  while (line[cursor] === ' ' || line[cursor] === '\t') cursor += 1
  return line[cursor] === ')' ? cursor + 1 : null
}

/** Parses valid-looking inline image spans on one source line. Fenced-code
 * filtering is handled by the caller because it requires document context. */
export function markdownImageReferences(line: string): MarkdownImageReference[] {
  const code = inlineCodeRanges(line)
  const references: MarkdownImageReference[] = []
  let cursor = 0
  while (cursor < line.length - 3) {
    const imageStart = line.indexOf('![', cursor)
    if (imageStart < 0) break
    cursor = imageStart + 2
    if (!unescapedAt(line, imageStart, '!') || code.some(([from, to]) => imageStart >= from && imageStart < to)) continue

    let labelEnd = cursor
    while (labelEnd < line.length && !unescapedAt(line, labelEnd, ']')) labelEnd += 1
    if (labelEnd >= line.length || line[labelEnd + 1] !== '(') continue
    let destinationStart = labelEnd + 2
    while (line[destinationStart] === ' ' || line[destinationStart] === '\t') destinationStart += 1
    if (line[destinationStart] === '<') {
      const from = destinationStart + 1
      let to = from
      while (to < line.length && !unescapedAt(line, to, '>')) to += 1
      const imageTo = to < line.length ? inlineImageEnd(line, to + 1) : null
      if (imageTo && to > from)
        references.push({ alt: line.slice(imageStart + 2, labelEnd), path: line.slice(from, to), from, to, imageFrom: imageStart, imageTo })
      cursor = Math.max(cursor, imageTo ?? to + 1)
      continue
    }

    const from = destinationStart
    let to = from
    let nesting = 0
    while (to < line.length) {
      const character = line[to]
      if ((character === ' ' || character === '\t') && nesting === 0) break
      if (unescapedAt(line, to, '(')) nesting += 1
      else if (unescapedAt(line, to, ')')) {
        if (nesting === 0) break
        nesting -= 1
      }
      to += 1
    }
    const imageTo = inlineImageEnd(line, to)
    if (imageTo && to > from)
      references.push({ alt: line.slice(imageStart + 2, labelEnd), path: line.slice(from, to), from, to, imageFrom: imageStart, imageTo })
    cursor = Math.max(cursor, imageTo ?? to + 1)
  }
  return references
}

/** Rewrites only Markdown image destinations, never ordinary links, inline code, or fenced code. */
export function replacePastedImageReferences(source: string, previousPath: string, nextPath: string): { source: string; count: number } {
  let fence: { character: string; length: number } | null = null
  let count = 0
  const lines = source.split(/(\r?\n)/)
  const result = lines.map((line) => {
    if (/^\r?\n$/.test(line)) return line
    if (fence) {
      const close = closingFence.exec(line)
      if (close && close[2][0] === fence.character && close[2].length >= fence.length) fence = null
      return line
    }
    const open = openingFence.exec(line)
    if (open) {
      fence = { character: open[2][0], length: open[2].length }
      return line
    }
    const replacements = markdownImageReferences(line).filter((reference) => reference.path === previousPath)
    if (!replacements.length) return line
    count += replacements.length
    let rewritten = line
    for (const replacement of replacements.reverse())
      rewritten = `${rewritten.slice(0, replacement.from)}${nextPath}${rewritten.slice(replacement.to)}`
    return rewritten
  })
  return { source: result.join(''), count }
}

export function pastedImageRenameTarget(relativePath: string, name: string): string | null {
  const cleaned = name.trim().replace(/\.png$/i, '')
  if (!cleaned || !/^[A-Za-z0-9_-]+$/.test(cleaned)) return null
  const separator = relativePath.lastIndexOf('/')
  if (separator < 0) return null
  return `${relativePath.slice(0, separator + 1)}${cleaned}.png`
}
