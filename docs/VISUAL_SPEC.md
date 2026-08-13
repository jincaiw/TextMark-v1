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

### v0.3.0 accepted comparison (2026-08-14)

| State | Viewport | Result | Mismatch ledger |
| --- | ---: | --- | --- |
| Main preview | 1440 × 900 | Pass | Reference skeleton, 820 px article measure, toolbar grouping and sidebar hierarchy retained; TextMark history controls are an intentional addition. |
| Edit mode | 1440 × 900 | Pass | Formatting row, single editing surface, source wrapping and chrome alignment retained; CodeMirror caret/spellcheck are platform-native. |
| Toolbar customization | 1440 × 900 | Pass | Palette/current-toolbar split, drag handles, reset/display controls and primary completion action match the reference workflow. |
| Dark appearance | 1440 × 900 | Pass | Dark chrome, document palette, selected outline item and contrast remain consistent without light-surface leaks. |
| Narrow window | 760 × 760 | Pass | Search and secondary controls collapse into the overflow menu; sidebar and readable article geometry remain usable. |

Native title bars, font rasterization and system menus remain masked comparison regions. No unexplained content, spacing, palette or interaction mismatch is open.
