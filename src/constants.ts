export const SAMPLE_MARKDOWN = `# Welcome to TextMark

**Cross-platform Markdown, beautifully rendered.**

TextMark is a fast, lightweight Markdown editor and reader for Windows, Linux, and macOS. It combines a focused editing experience with a live preview.

> Write in Markdown. See it live. Ship with confidence.

## Features

- Live preview
- Syntax highlighting
- Mermaid diagrams
- Math with KaTeX: $E = mc^2$
- Safe local image loading

## Quick start

1. Open a Markdown file
2. Edit on the left
3. See changes live on the right

## Sample table

| Platform | Support | Package |
| --- | --- | --- |
| Windows | Yes | MSI / NSIS |
| Linux | Yes | AppImage / DEB / RPM |
| macOS | Yes | Universal app / DMG |

## Diagram

\`\`\`mermaid
flowchart LR
  A[Edit Markdown] --> B{Live Preview}
  B -->|Looks good| C[Save]
  B -->|Keep editing| A
\`\`\`

## Code

\`\`\`ts
const platforms = ["Windows", "Linux", "macOS"];
console.log(\`TextMark runs on \${platforms.join(", ")}\`);
\`\`\`
`;

export const MARKDOWN_EXTENSIONS = ["md", "markdown", "mdown", "mkd", "mkdn", "mdwn", "mdtxt", "mdtext", "rmd", "txt"];

export const MARKDOWN_FILTERS = [{
  name: "Markdown",
  extensions: MARKDOWN_EXTENSIONS,
}];

export const ZOOM_STOPS = [50, 67, 75, 80, 90, 100, 110, 125, 133, 150, 175, 200, 250, 300] as const;
export const nextZoomStep = (current: number, direction: 1 | -1) =>
  direction > 0
    ? ZOOM_STOPS.find((value) => value > current) ?? 300
    : [...ZOOM_STOPS].reverse().find((value) => value < current) ?? 50;
