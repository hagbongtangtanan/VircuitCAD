/**
 * Lets the File menu export whichever view is mounted. The circuit and the
 * schematic know how to rasterise themselves, so they register a capture
 * function while they are on screen and unregister when they unmount.
 */

export type PngCapture = () => Promise<string | null>

let active: PngCapture | null = null

export function registerPngCapture(capture: PngCapture): () => void {
  active = capture
  return () => {
    if (active === capture) active = null
  }
}

export async function captureActiveViewPng(): Promise<string | null> {
  return active === null ? null : active()
}

/** Solid backdrop behind the transparent Konva/SVG drawings. */
export function canvasBackground(): string {
  if (typeof document === 'undefined') return '#0b1017'
  const value = getComputedStyle(document.documentElement).getPropertyValue('--cb-canvas').trim()
  return value === '' ? '#0b1017' : value
}
