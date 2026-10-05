export interface MarkdownDefinitionListBlock {
  from: number
  to: number
  source: string
  term: string
  termFrom: number
  definitions: Array<{ source: string; from: number }>
}

/** Finds the compact term/definition form used by Typora and the rendering
 * fixture. Fenced examples and ordinary list/heading lines are left alone. */
export function markdownDefinitionListBlocks(source: string): MarkdownDefinitionListBlock[] {
  const lines = source.split(/\r?\n/)
  const offsets: number[] = []
  let offset = 0
  for (let index = 0; index < lines.length; index += 1) {
    offsets.push(offset)
    offset += lines[index].length
    if (index < lines.length - 1) offset += source.slice(offset, offset + 2) === '\r\n' ? 2 : 1
  }

  const blocks: MarkdownDefinitionListBlock[] = []
  let fence: { character: string; length: number } | null = null
  for (let index = 0; index < lines.length - 1; index += 1) {
    const fenceLine = lines[index].match(/^ {0,3}(`{3,}|~{3,})/)
    if (fence) {
      if (fenceLine && fenceLine[1][0] === fence.character && fenceLine[1].length >= fence.length) fence = null
      continue
    }
    if (fenceLine) {
      fence = { character: fenceLine[1][0], length: fenceLine[1].length }
      continue
    }

    const term = lines[index].trim()
    if (!term || /^ {0,3}(?:#{1,6}\s|>|[-+*]\s|\d+[.)]\s|`{3,}|~{3,}|\[\^)/.test(lines[index]) || /^ {0,3}</.test(lines[index])) continue
    let definitionIndex = index + 1
    if (!/^ {0,3}:\s?/.test(lines[definitionIndex] ?? '') && !lines[definitionIndex]?.trim()) definitionIndex += 1
    if (!/^ {0,3}:\s?/.test(lines[definitionIndex] ?? '')) continue

    const definitions: MarkdownDefinitionListBlock['definitions'] = []
    let last = definitionIndex
    while (last < lines.length) {
      const definition = lines[last].match(/^ {0,3}:\s?(.*)$/)
      if (!definition) break
      const contentFrom = offsets[last] + (lines[last].match(/^ {0,3}:\s?/)?.[0].length ?? 0)
      let content = definition[1]
      let next = last + 1
      while (
        next < lines.length &&
        (/^(?: {2,}|\t)\S/.test(lines[next]) || (!lines[next].trim() && /^(?: {2,}|\t)\S/.test(lines[next + 1] ?? '')))
      ) {
        if (!lines[next].trim()) content += '\n'
        else content += `${content.endsWith('\n') ? '' : '\n'}${lines[next].replace(/^(?: {2,}|\t)/, '')}`
        last = next
        next += 1
      }
      definitions.push({ source: content, from: contentFrom })
      if (last < next - 1) last = next - 1
      if (!/^ {0,3}:\s?/.test(lines[last + 1] ?? '')) break
      last += 1
    }

    const termFrom = offsets[index] + (lines[index].length - lines[index].trimStart().length)
    blocks.push({
      from: offsets[index],
      to: offsets[last] + lines[last].length,
      source: lines.slice(index, last + 1).join('\n'),
      term,
      termFrom,
      definitions,
    })
    index = last
  }
  return blocks
}
