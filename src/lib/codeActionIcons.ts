const svgNamespace = 'http://www.w3.org/2000/svg'

/** Small, dependency-free Lucide-style icons for code controls created in DOM. */
export function createCodeActionIcon(name: 'copy' | 'copied' | 'wrap') {
  const svg = document.createElementNS(svgNamespace, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('width', '14')
  svg.setAttribute('height', '14')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '2')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')
  const shapes: Record<typeof name, Array<[string, Record<string, string>]>> = {
    copy: [
      ['rect', { width: '14', height: '14', x: '8', y: '8', rx: '2' }],
      ['path', { d: 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2' }],
    ],
    copied: [['path', { d: 'm20 6-11 11-5-5' }]],
    wrap: [['path', { d: 'M3 6h18M3 12h15a3 3 0 1 1 0 6h-4m3-3-3 3 3 3M3 18h7' }]],
  }
  for (const [tag, attributes] of shapes[name]) {
    const element = document.createElementNS(svgNamespace, tag)
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value)
    svg.append(element)
  }
  return svg
}
