export interface CodeFenceInfo {
  language: string
  metadata: string
  highlightLanguage: string
}

const highlightAliases: Record<string, string> = {
  'c++': 'cpp',
  compose: 'yaml',
  console: 'bash',
  docker: 'dockerfile',
  'docker-compose': 'yaml',
  docker_compose: 'yaml',
  html: 'xml',
  js: 'javascript',
  jsx: 'javascript',
  node: 'javascript',
  py: 'python',
  ps: 'powershell',
  ps1: 'powershell',
  shell: 'bash',
  sh: 'bash',
  svg: 'xml',
  terraform: 'hcl',
  tf: 'hcl',
  ts: 'typescript',
  tsx: 'typescript',
  xml: 'xml',
  yml: 'yaml',
  zsh: 'bash',
}

export function parseCodeFenceInfo(raw: string | null | undefined): CodeFenceInfo {
  const trimmed = raw?.trim() ?? ''
  const split = trimmed.search(/\s/u)
  const language = (split < 0 ? trimmed : trimmed.slice(0, split)).toLowerCase()
  const metadata = split < 0 ? '' : trimmed.slice(split).trim()
  const highlightLanguage = highlightAliases[language] ?? language
  return { language, metadata, highlightLanguage }
}

/** Conservative detection for unlabeled fences. A declared language always wins. */
export function detectCodeFenceLanguage(source: string): string | null {
  const text = source.trim()
  if (!text) return null
  if (/^(?:#!.*\b(?:ba)?sh\b|\s*\$\s+)/im.test(text) || /^\s*(?:echo|printf|export|source|cd|mkdir|rm|cp|mv)\s+/im.test(text)) return 'bash'
  if (((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) && isJson(text)) return 'json'
  if (/^\s*(?:<!doctype\s+html|<html\b|<(?:div|span|section|article)\b)/im.test(text)) return 'html'
  if (/\b(?:resource|data|provider|variable|module)\s+"[\w-]+"(?:\s+"[\w-]+")?\s*\{|\bterraform\s*\{/i.test(text)) return 'hcl'
  if (/\b(?:import\s+Foundation|func\s+\w+\s*\(|@main)\b|\b(?:let|var)\s+\w+\s*:\s*(?:String|Int|Bool|Double|Float)\b/i.test(text))
    return 'swift'
  if (/^\s*(?:#\s*include\s*<iostream>|(?:using\s+namespace\s+std|std::\w+|(?:cout|cin)\s*(?:<<|>>))\b)/im.test(text)) return 'cpp'
  if (
    /^\s*(?:#\s*include\s*[<"](?:assert|ctype|errno|float|inttypes|limits|math|setjmp|signal|stdarg|stdbool|stddef|stdint|stdio|stdlib|string|time)\.h[>"]|(?:int|void)\s+main\s*\([^)]*\)\s*\{)/im.test(
      text,
    )
  )
    return 'c'
  if (/^\s*(?:async\s+)?def\s+\w+\s*\(|^\s*from\s+\w+[\w.]*\s+import\b|^\s*class\s+\w+\s*[:(]/im.test(text)) return 'python'
  if (/\b(?:select|insert|update|delete|create\s+(?:table|view|index)|with)\b[\s\S]*\b(?:from|into|where|as)\b/i.test(text)) return 'sql'
  if (/(?:^|\n)\s*(?:[#.]?[A-Za-z][\w-]*)\s*\{[\s\S]*:[\s\S]*\}/m.test(text) || /@(?:media|keyframes|supports)\b/i.test(text)) return 'css'
  if (
    /^\s*(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*(?::[^=\n]+)?\s*=/m.test(text) ||
    /\b(?:function\s+\w+\s*\(|console\.(?:log|error|warn)|=>)/.test(text)
  )
    return 'javascript'
  if (/^\s*(?:[-A-Za-z_][\w-]*):\s*(?:[^:#\n]|$)/m.test(text) && !text.includes('{') && !text.includes(';')) return 'yaml'
  return null
}

function isJson(value: string): boolean {
  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}
