import { canvasBackground } from './pngCapture'

/**
 * The schematic is styled through classes and CSS variables, which an SVG
 * loaded into an <img> cannot see. Copy the computed values onto the clone
 * before serialising so the PNG looks exactly like the on-screen drawing.
 */
const COPIED_PROPERTIES = [
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'font-family',
  'font-size',
  'font-weight',
] as const

function inlineComputedStyles(source: SVGSVGElement, clone: SVGSVGElement): void {
  const sourceNodes = [source, ...Array.from(source.querySelectorAll('*'))]
  const cloneNodes = [clone, ...Array.from(clone.querySelectorAll('*'))]

  for (const [index, node] of cloneNodes.entries()) {
    if (!(node instanceof SVGElement)) continue
    const original = sourceNodes[index]
    if (original === undefined) continue

    const computed = getComputedStyle(original)
    node.removeAttribute('class')
    for (const property of COPIED_PROPERTIES) {
      const value = computed.getPropertyValue(property)
      if (value !== '') node.style.setProperty(property, value)
    }
  }
}

export async function rasterizeSvgToPng(
  svg: SVGSVGElement,
  width: number,
  height: number,
  pixelRatio = 2
): Promise<string | null> {
  const clone = svg.cloneNode(true) as SVGSVGElement
  inlineComputedStyles(svg, clone)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))

  const markup = new XMLSerializer().serializeToString(clone)
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }))

  try {
    const image = new Image()
    image.src = url
    await image.decode()

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * pixelRatio)
    canvas.height = Math.round(height * pixelRatio)
    const context = canvas.getContext('2d')
    if (context === null) return null

    context.fillStyle = canvasBackground()
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}
