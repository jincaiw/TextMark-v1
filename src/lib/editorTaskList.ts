export interface TaskListEnterPlan {
  handled: boolean
  change?: { from: number; to: number; insert: string }
  selection?: number
}

/** Keeps Enter inside a task list while the item has content, and exits an
 * empty task by removing its marker and leaving a blank Markdown separator. */
export function taskListEnterPlan(source: string, position: number, selectionEmpty = true): TaskListEnterPlan {
  if (!selectionEmpty) return { handled: false }
  const lineStart = source.lastIndexOf('\n', position - 1) + 1
  const lineEndIndex = source.indexOf('\n', lineStart)
  const lineEnd = lineEndIndex < 0 ? source.length : lineEndIndex
  const line = source.slice(lineStart, lineEnd).replace(/\r$/, '')
  const match = line.match(/^(\s*)([-+*]|(\d+)([.)]))\s+\[([ xX])\]\s*(.*)$/)
  if (!match) return { handled: false }

  const [, indent, bullet, orderedNumber, orderedSuffix, , content] = match
  const contentStart = lineStart + match[0].length - content.length
  if (position < contentStart) return { handled: false }

  if (!content.trim()) {
    const insert = lineEndIndex < 0 ? '\n' : ''
    const selection = lineStart + insert.length
    return {
      handled: true,
      change: { from: lineStart, to: lineEndIndex < 0 ? source.length : lineEnd, insert },
      selection,
    }
  }

  const nextBullet = orderedNumber ? `${Number(orderedNumber) + 1}${orderedSuffix}` : bullet
  const insert = `\n${indent}${nextBullet} [ ] `
  return {
    handled: true,
    change: { from: position, to: position, insert },
    selection: position + insert.length,
  }
}
