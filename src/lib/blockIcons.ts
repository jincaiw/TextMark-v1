// The line icons of the code-block header and the diagram HUD, drawn as the
// upstream `MarkdownHTML.codeIconShapes` / diagram HUD masks: a 24-unit viewBox
// at 16×16 with a 1.6 round stroke. Shared by the code card and the diagram pills
// so both read as one control family.
const shapes: Record<string, string> = {
  copy: '<rect x="4" y="8" width="12" height="13" rx="3"/><path d="M8 8V6a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-1"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  wrap: '<path d="M4 6h16M4 11h12a4 4 0 0 1 0 8h-5m3-3-3 3 3 3M4 16h3"/>',
  unwrap: '<path d="M4 6h16M4 12h16m-4-4 4 4-4 4M4 18h7"/>',
  out: '<path d="M6 12h12"/>',
  in: '<path d="M12 6v12M6 12h12"/>',
  popup: '<path d="M14 4h6v6M10 20H4v-6M20 4l-6 6M4 20l6-6"/>',
}

export type BlockIconName = keyof typeof shapes

export function blockIcon(name: BlockIconName): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[name]}</svg>`
}
