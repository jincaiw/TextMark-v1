// macOS titlebar glyphs. The reference draws its titlebar with SF Symbols, so
// on macOS each glyph is rasterised by AppKit and applied as a CSS mask — the
// outlines the reference shows, tinted by the button's own text colour. The
// hand-authored paths below stay as the fallback for Linux and Windows, where
// SF Symbols do not exist, and as the first paint before the rasters arrive.

import { SfGlyph } from './SfGlyph'

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

/** The reference's titlebar symbols are all one point size and weight: at 16pt
 * semibold each symbol's ink lands on the reference's to within a device pixel
 * (copy 32x40 against 34x41, share 28x36 against 29x37, export 34x37 against
 * 35x38), which is how the size was pinned. */
const SYMBOL_POINTS = 16
const SYMBOL_WEIGHT = 0.23

/** A selected toggle knocks its symbol out of the accent ellipse, and AppKit
 * draws that knock-out symbol a size larger than the bare toolbar glyph: the
 * reference's white i measures 15x32 device pixels against the bare i's 14x29,
 * which is the 16pt raster's ink at a 17.5pt point size. */
const DISC_SYMBOL_POINTS = 17.5

/** `doc.on.doc`: two pages, each with a folded top-right corner. The front
    page's top edge is cut by the fold diagonal and the fold is drawn as an L
    crease inside the page; the back page's left and bottom edges stop where the
    front page's stroke covers them. Traced from the symbol's 88pt rendering so
    the cut, crease and stubs land on the reference's geometry. */
const CopyStackSvg = () => (
  <svg {...base}>
    {/* Scale is measured from the reference's screen ink: the two pages draw
        18.55 by 22.36 viewBox units at this box, i.e. 1.7 percent narrower and
        7 percent taller than the trace, and sit a hair right of centre. */}
    <g transform="translate(12 12) scale(0.977 1.07) translate(-12 -12)">
      <path d="M4.35 6.09H9.19L15.35 12.42V20.61A1.6 1.6 0 0 1 13.75 22.21H4.35A1.6 1.6 0 0 1 2.75 20.61V7.69A1.6 1.6 0 0 1 4.35 6.09Z" />
      <path d="M8.53 6.09V12.79H15.35" />
      <path d="M7.14 6.6V4.91A1.6 1.6 0 0 1 8.74 3.31H14.09L19.74 7.35V16.01A1.6 1.6 0 0 1 18.14 17.62H16" />
      <path d="M13.91 3.31V7.74H19.74" />
    </g>
  </svg>
)

export const CopyStackIcon = () => <SfGlyph name="doc.on.doc" points={SYMBOL_POINTS} weight={SYMBOL_WEIGHT} fallback={<CopyStackSvg />} />

/** `info`: a bare lowercase i, not the circled variant. */
const InfoBareSvg = () => (
  <svg {...base}>
    <circle cx="12" cy="5.2" r="1.35" fill="currentColor" stroke="none" />
    <path d="M12 9.6V20.7" />
    <path d="M8.5 20.7H15.5" />
  </svg>
)

export const InfoBareIcon = () => <SfGlyph name="info" points={SYMBOL_POINTS} weight={SYMBOL_WEIGHT} fallback={<InfoBareSvg />} />

/** The reference's selected inspector: AppKit fills its 30-by-28pt selection
    ellipse with the accent and knocks the same bare i out in white. */
const InfoDiscMarkSvg = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <g fill="rgb(241 255 255)" transform="translate(15 14) scale(1.188) translate(-12 -12)">
      <circle cx="12.2" cy="5.9" r="1.05" />
      <rect x="9" y="9.48" width="3.8" height="1.26" />
      <rect x="11.95" y="9.48" width="0.85" height="7.57" />
      <rect x="9.06" y="17.05" width="6.3" height="1.26" rx="0.3" />
    </g>
  </svg>
)

export const InfoCircleFillIcon = () => (
  <span className="info-circle-fill">
    <svg viewBox="0 -0.5 30 29" fill="none" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <ellipse cx="15" cy="14" rx="15" ry="14" fill="var(--toolbar-active-fill)" />
    </svg>
    <SfGlyph name="info" points={DISC_SYMBOL_POINTS} weight={SYMBOL_WEIGHT} className="disc-mark" fallback={<InfoDiscMarkSvg />} />
  </span>
)

/** `square.and.arrow.up`: an open-topped box with an arrow rising out of it. */
const ShareUpSvg = () => (
  <svg {...base}>
    <path d="M9.28 10.4H7.08A2.2 2.2 0 0 0 4.88 12.6V19.2A2.2 2.2 0 0 0 7.08 21.4H16.92A2.2 2.2 0 0 0 19.12 19.2V12.6A2.2 2.2 0 0 0 16.92 10.4H14.72" />
    <path d="M12 15.4V2.8" />
    <path d="M8.1 6.7L12 2.8L15.9 6.7" />
  </svg>
)

export const ShareUpIcon = () => (
  <SfGlyph name="square.and.arrow.up" points={SYMBOL_POINTS} weight={SYMBOL_WEIGHT} fallback={<ShareUpSvg />} />
)

/** `doc.badge.arrow.up`: a folded page with an arrow disc badged over its
    lower-left corner, the arrow knocked out of the disc. */
const ExportPageSvg = () => (
  <svg {...base}>
    <defs>
      {/* The badge sits on the page's left edge, so the symbol clears the page
          under and around the disc before it draws the disc: SF Symbols knocks
          the disc's whole footprint out of the page rather than letting the
          page's stroke show through the arrow. */}
      <mask id="tm-export-page">
        <rect width="24" height="24" fill="#fff" />
        <circle cx="6.93" cy="17.9" r="5.2" fill="#000" />
      </mask>
      <mask id="tm-export-badge">
        <rect width="24" height="24" fill="#fff" />
        <g fill="none" stroke="#000" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6.93 20.9V15.2" />
          <path d="M4.8 19L6.93 15.2L9.06 19" />
        </g>
      </mask>
    </defs>
    <g mask="url(#tm-export-page)">
      <path d="M8.2 2.27H13.69L20.72 9.10V18.5Q20.72 19.87 19.4 19.87H8.2Q6.86 19.87 6.86 18.5V3.6Q6.86 2.27 8.2 2.27Z" />
      <path d="M13.69 2.27V9.10H20.72" />
    </g>
    <circle cx="6.93" cy="17.9" r="4.6" fill="currentColor" stroke="none" mask="url(#tm-export-badge)" />
  </svg>
)

export const ExportPageIcon = () => (
  <SfGlyph name="doc.badge.arrow.up" points={SYMBOL_POINTS} weight={SYMBOL_WEIGHT} fallback={<ExportPageSvg />} />
)

/** `doc.text.magnifyingglass`: an upright page with two short rules whose
    lower-right corner is cut away by the magnifier. */
const DocumentSearchSvg = () => (
  <svg {...base}>
    <path d="M13.9 11.4V4.8A1.9 1.9 0 0 0 12 2.9H6.8A1.9 1.9 0 0 0 4.9 4.8V15.8A1.9 1.9 0 0 0 6.8 17.7H11.6" />
    <path d="M7.2 8H11.6" />
    <path d="M7.2 10.5H11.6" />
    <circle cx="14.6" cy="15.2" r="3.9" />
    <path d="M17.36 17.96L18.75 20.9" />
  </svg>
)

export const DocumentSearchIcon = () => (
  <SfGlyph name="doc.text.magnifyingglass" points={SYMBOL_POINTS} weight={SYMBOL_WEIGHT} fallback={<DocumentSearchSvg />} />
)

/** `list.bullet.indent`: three bulleted lines, each indented past the last. */
const ListIndentSvg = () => (
  <svg {...base}>
    <circle cx="2.36" cy="6.41" r="1.1" fill="currentColor" stroke="none" />
    <path d="M7 6.5H17.5" />
    <circle cx="4.36" cy="11.41" r="1.1" fill="currentColor" stroke="none" />
    <path d="M9 11.5H19.5" />
    <circle cx="6.36" cy="16.41" r="1.1" fill="currentColor" stroke="none" />
    <path d="M11 16.5H21.5" />
  </svg>
)

export const ListIndentIcon = () => (
  <SfGlyph name="list.bullet.indent" points={SYMBOL_POINTS} weight={SYMBOL_WEIGHT} fallback={<ListIndentSvg />} />
)

/** `folder`: a closed folder whose tab steps down into the body, with the
    inner rule that separates the tab band from the page. */
const FolderGlyphSvg = () => (
  <svg {...base}>
    <path d="M3.25 15.8V6.4A2 2 0 0 1 5.25 4.4H8.8C9.7 4.4 10.25 5 10.8 6H18.05A2.2 2.2 0 0 1 20.25 8.2V15.8A2.2 2.2 0 0 1 18.05 18H5.45A2.2 2.2 0 0 1 3.25 15.8Z" />
    <path d="M5.25 8.5H17.75" />
  </svg>
)

export const FolderGlyphIcon = () => <SfGlyph name="folder" points={SYMBOL_POINTS} weight={SYMBOL_WEIGHT} fallback={<FolderGlyphSvg />} />

/** `sidebar.leading`: the window frame with its leading pane split off and
    three lines standing for the list it holds. */
const SidebarLeadingSvg = () => (
  <svg {...base}>
    <g style={{ strokeWidth: 1.41 }}>
      <rect x="3.2" y="5.1" width="17.9" height="13.7" rx="3.4" />
      <path d="M9.55 5.1V18.8" />
    </g>
    <g style={{ strokeWidth: 1 }}>
      <path d="M4.9 8.35H7.2" />
      <path d="M4.9 10.55H7.2" />
      <path d="M4.9 12.75H7.2" />
    </g>
  </svg>
)

export const SidebarLeadingIcon = () => (
  <SfGlyph name="sidebar.leading" points={SYMBOL_POINTS} weight={SYMBOL_WEIGHT} fallback={<SidebarLeadingSvg />} />
)

/** The pencil's selected state: the reference tints the toggle accent blue and
    knocks the same pencil out in white. AppKit's selection shape follows the
    symbol's wider-than-tall image frame, so this disc is a 31.5-by-28pt
    ellipse rather than a circle. The pencil itself is not an SF Symbol (every
    pencil variant is filled at this size), so it stays hand-drawn. */
const EditDiscMarkSvg = () => (
  <svg className="disc-mark" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <g
      stroke="rgb(241 255 255)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      transform="translate(12 12.12) scale(0.97) translate(-12 -12)"
    >
      <path d="M14.97 3.56A2.52 2.52 0 0 1 18.53 7.12L11 14.65L5.15 17.45L5.73 12.7Z" />
      <path d="M15.27 5.02L18.09 7.84" strokeWidth="1.3" strokeLinecap="butt" />
      <path d="M7.09 11.44L10.65 15.0" strokeWidth="1.3" strokeLinecap="butt" />
      <path d="M3.53 20.95H20.74" strokeWidth="1.5" />
    </g>
  </svg>
)

export const EditDiscIcon = () => (
  <span className="edit-disc">
    <svg viewBox="0 -0.5 31.5 29" fill="none" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <ellipse cx="15.75" cy="14" rx="15.75" ry="14" fill="var(--toolbar-active-fill)" />
    </svg>
    <EditDiscMarkSvg />
  </span>
)

/** Edit: an outlined pencil standing on the rule it writes. Coordinates are
    traced from the reference's screen ink; its walls are stroked at about
    1.25pt — lighter than the 1.5pt action symbols beside it — so the stylesheet
    overrides this glyph's stroke width. */
const EditPencilSvg = () => (
  <svg {...base}>
    <path d="M14.97 3.56A2.52 2.52 0 0 1 18.53 7.12L11 14.65L5.15 17.45L5.73 12.7Z" />
    <path d="M15.27 5.02L18.09 7.84" strokeWidth="1.25" strokeLinecap="butt" />
    <path d="M7.09 11.44L10.65 15.0" strokeWidth="1.25" strokeLinecap="butt" />
    <path d="M3.53 20.12H20.74" strokeWidth="1.37" />
  </svg>
)

export const EditPencilIcon = () => <EditPencilSvg />
