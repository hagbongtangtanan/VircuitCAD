/**
 * Hand-made `<part-id>.svg` overrides (docs/DESIGN.md 3.5).
 *
 * Place a file named after the part next to this module and register its markup here
 * (a build step can also generate this map). When present it replaces the serialised
 * DSL for the gallery and SVG export; the DSL still drives the live canvas.
 */
export const SVG_OVERRIDES: Record<string, string> = {};
