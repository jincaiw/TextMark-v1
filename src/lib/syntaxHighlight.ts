import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import python from 'highlight.js/lib/languages/python'
import rust from 'highlight.js/lib/languages/rust'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'

hljs.registerLanguage('bash', bash)
hljs.registerLanguage('css', css)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('jsx', javascript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('rust', rust)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('tsx', typescript)
hljs.registerLanguage('xml', xml)

const hcl = (api: typeof hljs) => ({
  name: 'HCL',
  aliases: ['terraform', 'tf'],
  keywords: { keyword: 'resource data variable output module provider terraform locals dynamic for in if', literal: 'true false null' },
  contains: [
    api.COMMENT('#', '$'),
    api.COMMENT('//', '$'),
    api.COMMENT('/\\*', '\\*/'),
    api.QUOTE_STRING_MODE,
    api.NUMBER_MODE,
    { className: 'attr', begin: /[A-Za-z_][\w-]*(?=\s*=)/ },
  ],
})
hljs.registerLanguage('hcl', hcl)
hljs.registerLanguage('terraform', hcl)
hljs.registerLanguage('tf', hcl)
hljs.registerLanguage('sh', bash)
hljs.registerLanguage('shell', bash)

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character,
  )

export function highlightCode(code: string, language: string) {
  return hljs.getLanguage(language) ? hljs.highlight(code, { language }).value : escapeHtml(code)
}
