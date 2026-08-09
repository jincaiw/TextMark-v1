# TextMark visual specification

The accepted design references are the four screenshots in `pluk-inc/markdown-preview@v0.0.47`: main preview, edit mode, toolbar customization and Quick Look. TextMark preserves their recognizable skeleton while following each platform's window-control conventions.

## Tokens

- UI type: system sans-serif; document type: system sans-serif; code: platform monospace.
- Article measure: 820 px normal, full viewport in full-width mode.
- Chrome: 68 px primary toolbar, 44 px formatting row, 40 px find row.
- Sidebar: 300 px default; Inspector: 292 px.
- Accent: `#0a84ff`; light page: true white; dark page: `#202124`.
- Corners: 6–12 px for controls/content, 16–18 px for dialogs.
- Icons: Lucide outline, 1.7 px stroke, 16–20 px optical size.

## Platform deviations

- macOS keeps traffic lights at the leading edge and native global menus.
- Windows and Linux place minimize/maximize/close on the trailing edge and use rectangular hit targets.
- Native title-bar and menu regions are masked in cross-platform screenshot comparisons; document, toolbar, sidebar and inspector are not.

## Fidelity ledger

Every visual run records: viewport, reference, rendered screenshot, copy differences, layout differences, typography, palette, icons, interaction state and intentional platform deviations. Unexplained differences block release.
