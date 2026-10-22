import { prepareSvgForExport } from './svgPng'

function toBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000
  let binary = ''
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

/**
 * Converts the live engineering sheet to a vector PDF. The SVG is cloned with
 * computed styles inlined first, because the stylesheet is not part of the
 * serialised element that svg2pdf receives.
 */
export async function svgToPdfBase64(
  svg: SVGSVGElement,
  width: number,
  height: number
): Promise<string> {
  const clone = prepareSvgForExport(svg, width, height)
  // Keep the PDF toolchain out of the startup bundle; it is only needed when
  // the user actually asks to save a sheet.
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')])
  const pdf = new jsPDF({
    orientation: width >= height ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [width, height],
    compress: true,
    putOnlyUsedFonts: true,
  })

  await svg2pdf(clone, pdf, { x: 0, y: 0, width, height, loadExternalStyleSheets: false })
  return toBase64(new Uint8Array(pdf.output('arraybuffer')))
}
