/**
 * Clamps a scroll fraction to the [0, 1] range, treating non-finite input as
 * the top of the document. Used by the preview/editor scroll hand-off.
 */
export const clampScrollFraction = (value: number): number => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0)
