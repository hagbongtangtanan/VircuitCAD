/**
 * PDF export is only available while the engineering schematic is mounted in
 * its original style. The schematic registers a capture function there.
 */

export type PdfCapture = () => Promise<string | null>

let active: PdfCapture | null = null

export function registerPdfCapture(capture: PdfCapture): () => void {
  active = capture
  return () => {
    if (active === capture) active = null
  }
}

export async function captureActiveSchematicPdf(): Promise<string | null> {
  return active === null ? null : active()
}
