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
