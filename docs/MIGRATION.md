# Feature parity with Markdown Preview

TextMark keeps the original app's preview-first workflow and native desktop layout while moving the shared implementation to Tauri, React and Rust.

| Original capability | TextMark status |
| --- | --- |
| Preview-first native window and outline sidebar | Implemented |
| Edit Mode and Markdown formatting toolbar | Implemented |
| Mermaid rendering and diagram popup | Implemented |
| KaTeX inline/display/fenced math and copy source | Implemented |
| Footnotes, GFM alerts, task lists, tables and `[TOC]` | Implemented |
| Interactive task checkboxes | Implemented |
| Preview table row/column context actions | Implemented |
| Syntax highlighting and code copy | Implemented |
| Guarded relative images and relative Markdown links | Implemented |
| Document outline and project navigator | Implemented |
| Inspector metadata and frontmatter | Implemented |
| In-document search with next/previous and match modes | Implemented |
| Open With and Open in LLM menus | Implemented with platform launchers |
| Text zoom from 50–300% | Implemented |
| Share/copy raw Markdown source | Implemented |
| Print and PDF through the system print dialog | Implemented |
| File watching and external reload | Implemented |
| Light, dark, automatic appearance and content width | Implemented |
| Launch a Markdown path from the TextMark executable | Implemented |
| Default Markdown file association | Configured for all desktop bundles |
| macOS Quick Look | Requires a signed macOS extension target |
| Windows Explorer preview handler | Requires a signed Windows COM preview-handler package |
| Linux file-manager preview integration | Requires per-file-manager packages |
| Signed auto-update | Requires a release endpoint and signing keys |

The last four rows are distribution integrations rather than portable application features. Their adapters remain isolated so the document model, renderer and UI stay identical across operating systems.
