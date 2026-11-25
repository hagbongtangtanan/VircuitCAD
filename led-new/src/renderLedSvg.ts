import { LED_SPEC } from "./ledSpec";

export type LedColor = "red" | "green" | "blue" | "yellow" | "white";
export type LedTheme = "dark" | "light";

export interface RenderLedSvgOptions {
  color?: LedColor;
  lit?: boolean;
  burnt?: boolean;
  theme?: LedTheme;
  showLabels?: boolean;
  selected?: boolean;
  brightness?: number;
  idPrefix?: string;
}

interface LedPalette {
  bodyTop: string;
  bodyBottom: string;
  bodyLitTop: string;
  bodyLitBottom: string;
  flange: string;
  rim: string;
  highlight: string;
  glowColor: string;
  leg: string;
  pin: string;
  surface: string;
  labelBg: string;
  labelStroke: string;
  labelText: string;
}

const PITCH = 40;
const ANCHOR_A_X = LED_SPEC.ANCHOR_A_X;
const ANCHOR_K_X = LED_SPEC.ANCHOR_K_X;
const ANCHOR_Y = LED_SPEC.ANCHOR_Y;
const ANCHOR_SPACING = LED_SPEC.ANCHOR_SPACING;
const DEFAULT_COLOR: LedColor = "red";
const DEFAULT_THEME: LedTheme = "dark";
const DEFAULT_ID_PREFIX = "led";

const DARK_PALETTES: Record<LedColor, LedPalette> = {
  red: { bodyTop: "#b84f58", bodyBottom: "#7d3038", bodyLitTop: "#ff1f3d", bodyLitBottom: "#c90028", flange: "#5b6674", rim: "#7d3038", highlight: "#ffe1e6", glowColor: "#FF3B3B", leg: "#9aa1a8", pin: "#b7d2ef", surface: "#050a14", labelBg: "#111b2b", labelStroke: "#334155", labelText: "#f4f7fb" },
  green: { bodyTop: "#418d52", bodyBottom: "#2e6840", bodyLitTop: "#00ff66", bodyLitBottom: "#00b83f", flange: "#5b6674", rim: "#2e6840", highlight: "#e4ffe9", glowColor: "#1FE05A", leg: "#9aa1a8", pin: "#b7d2ef", surface: "#050a14", labelBg: "#111b2b", labelStroke: "#334155", labelText: "#f4f7fb" },
  blue: { bodyTop: "#4673ba", bodyBottom: "#315993", bodyLitTop: "#1677ff", bodyLitBottom: "#0047ff", flange: "#5b6674", rim: "#315993", highlight: "#e0efff", glowColor: "#2F8CFF", leg: "#9aa1a8", pin: "#b7d2ef", surface: "#050a14", labelBg: "#111b2b", labelStroke: "#334155", labelText: "#f4f7fb" },
  yellow: { bodyTop: "#ae8829", bodyBottom: "#775c1e", bodyLitTop: "#ffe600", bodyLitBottom: "#ffb800", flange: "#5b6674", rim: "#775c1e", highlight: "#fff9d6", glowColor: "#FFC400", leg: "#9aa1a8", pin: "#b7d2ef", surface: "#050a14", labelBg: "#111b2b", labelStroke: "#334155", labelText: "#f4f7fb" },
  white: { bodyTop: "#b8c1cd", bodyBottom: "#788391", bodyLitTop: "#ffffff", bodyLitBottom: "#dceeff", flange: "#5b6674", rim: "#788391", highlight: "#ffffff", glowColor: "#FFFFFF", leg: "#9aa1a8", pin: "#b7d2ef", surface: "#050a14", labelBg: "#111b2b", labelStroke: "#334155", labelText: "#f4f7fb" },
};

const LIGHT_PALETTES: Record<LedColor, LedPalette> = {
  red: { bodyTop: "#c53228", bodyBottom: "#8f2420", bodyLitTop: "#ff1744", bodyLitBottom: "#e6002e", flange: "#5b6674", rim: "#8f2420", highlight: "#ffe4e8", glowColor: "#FF1F1F", leg: "#5b6674", pin: "#4b5563", surface: "#eef2f7", labelBg: "#ffffff", labelStroke: "#94a3b8", labelText: "#1f2937" },
  green: { bodyTop: "#259c43", bodyBottom: "#1d6d33", bodyLitTop: "#00e85a", bodyLitBottom: "#00b83f", flange: "#5b6674", rim: "#1d6d33", highlight: "#e0ffe7", glowColor: "#00B84A", leg: "#5b6674", pin: "#4b5563", surface: "#eef2f7", labelBg: "#ffffff", labelStroke: "#94a3b8", labelText: "#1f2937" },
  blue: { bodyTop: "#1c67c8", bodyBottom: "#12488f", bodyLitTop: "#0b74ff", bodyLitBottom: "#004de0", flange: "#5b6674", rim: "#12488f", highlight: "#e0efff", glowColor: "#1664FF", leg: "#5b6674", pin: "#4b5563", surface: "#eef2f7", labelBg: "#ffffff", labelStroke: "#94a3b8", labelText: "#1f2937" },
  yellow: { bodyTop: "#c58a00", bodyBottom: "#7a5600", bodyLitTop: "#ffe600", bodyLitBottom: "#ffc400", flange: "#5b6674", rim: "#7a5600", highlight: "#fff9d6", glowColor: "#FF9800", leg: "#5b6674", pin: "#4b5563", surface: "#eef2f7", labelBg: "#ffffff", labelStroke: "#94a3b8", labelText: "#1f2937" },
  white: { bodyTop: "#e2e6ed", bodyBottom: "#697586", bodyLitTop: "#ffffff", bodyLitBottom: "#eaf8ff", flange: "#5b6674", rim: "#697586", highlight: "#ffffff", glowColor: "#6E8CA3", leg: "#5b6674", pin: "#4b5563", surface: "#eef2f7", labelBg: "#ffffff", labelStroke: "#94a3b8", labelText: "#1f2937" },
};

const BURNT_PALETTE: LedPalette = {
  bodyTop: "#232327", bodyBottom: "#0a0a0c", bodyLitTop: "#232327", bodyLitBottom: "#0a0a0c", flange: "#141416", rim: "#000000", highlight: "#2b2b30", glowColor: "#000000", leg: "#1b1b1e", pin: "#232327", surface: "#000000", labelBg: "#000000", labelStroke: "#1b1b1e", labelText: "#2b2b30",
};

function sanitizePrefix(prefix: string): string {
  const value = prefix.replace(/[^A-Za-z0-9_-]/g, "");
  return value || DEFAULT_ID_PREFIX;
}

function stop(offset: number, color: string, opacity: number): string {
  return `<stop offset="${(offset * 100).toFixed(1)}%" stop-color="${color}" stop-opacity="${opacity.toFixed(3)}"/>`;
}

function labelChip(label: string, x: number, id: string, palette: LedPalette): string {
  const width = 14;
  const height = 13;
  const x0 = x - width / 2;
  const y0 = 12;
  return `<g data-label="${id}"><rect x="${x0}" y="${y0}" width="${width}" height="${height}" rx="3" fill="${palette.labelBg}" stroke="${palette.labelStroke}" stroke-opacity="0.45"/><text x="${x}" y="${y0 + height / 2}" fill="${palette.labelText}" font-family="monospace" font-size="9" text-anchor="middle" dominant-baseline="middle">${label}</text></g>`;
}

function burstPath(cx: number, cy: number, outer: number, inner: number, points: number): string {
  const coords: string[] = [];
  for (let index = 0; index < points * 2; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = (Math.PI * index) / points - Math.PI / 2;
    coords.push(`${(cx + Math.cos(angle) * radius).toFixed(2)} ${(cy + Math.sin(angle) * radius).toFixed(2)}`);
  }
  return `M ${coords.join(" L ")} Z`;
}

function explodedIcon(): string {
  const cx = LED_SPEC.EXPLODED_ICON_CX;
  const cy = LED_SPEC.EXPLODED_ICON_CY;
  const color = LED_SPEC.EXPLODED_ICON_COLOR;
  const stroke = LED_SPEC.EXPLODED_ICON_STROKE;
  const rays = [
    [-9, -9, -15, -15],
    [-12, -2, -18, -3],
    [-2, -12, -3, -18],
  ]
    .map(([x1, y1, x2, y2]) => `M ${cx + x1} ${cy + y1} L ${cx + x2} ${cy + y2}`)
    .join(" ");
  return `<g data-layer="exploded" pointer-events="none"><path data-layer="exploded-rays" d="${rays}" fill="none" stroke="${color}" stroke-width="1.4" stroke-linecap="round"/><path data-layer="exploded-burst" d="${burstPath(cx, cy, LED_SPEC.EXPLODED_ICON_OUTER_RADIUS, LED_SPEC.EXPLODED_ICON_INNER_RADIUS, 8)}" fill="${color}" stroke="${stroke}" stroke-width="${LED_SPEC.EXPLODED_ICON_STROKE_WIDTH}" stroke-linejoin="round"/></g>`;
}

export function renderLedSvg(options: RenderLedSvgOptions = {}): string {
  const color = options.color || DEFAULT_COLOR;
  const theme = options.theme || DEFAULT_THEME;
  const burnt = options.burnt === true;
  const brightness = options.brightness === undefined ? (options.lit ? 1 : 0) : Math.max(0, Math.min(1, options.brightness));
  const lit = (options.lit === true || (options.lit === undefined && brightness > 0.01)) && !burnt;
  const showLabels = options.showLabels !== false;
  const selected = options.selected === true;
  const prefix = sanitizePrefix(options.idPrefix || DEFAULT_ID_PREFIX);
  const palette = burnt ? BURNT_PALETTE : theme === "light" ? LIGHT_PALETTES[color] : DARK_PALETTES[color];
  const bodyBottom = lit ? palette.bodyLitBottom : palette.bodyBottom;
  const bodyTop = lit ? palette.bodyLitTop : palette.bodyTop;
  const bodyPath = `M ${LED_SPEC.BODY_MIN_X} ${LED_SPEC.BODY_TOP_Y} A ${LED_SPEC.DOME_RX} ${LED_SPEC.DOME_RY} 0 0 1 ${LED_SPEC.BODY_MAX_X} ${LED_SPEC.BODY_TOP_Y} V ${LED_SPEC.BODY_BOTTOM_Y} H ${LED_SPEC.BODY_MIN_X} Z`;
  const flangePath = `M ${LED_SPEC.FLANGE_MIN_X + LED_SPEC.FLANGE_RADIUS} ${LED_SPEC.FLANGE_TOP_Y} H ${LED_SPEC.FLANGE_MAX_X} V ${LED_SPEC.FLANGE_BOTTOM_Y} H ${LED_SPEC.FLANGE_MIN_X + LED_SPEC.FLANGE_RADIUS} A ${LED_SPEC.FLANGE_RADIUS} ${LED_SPEC.FLANGE_RADIUS} 0 0 1 ${LED_SPEC.FLANGE_MIN_X} ${LED_SPEC.FLANGE_BOTTOM_Y - LED_SPEC.FLANGE_RADIUS} V ${LED_SPEC.FLANGE_TOP_Y + LED_SPEC.FLANGE_RADIUS} A ${LED_SPEC.FLANGE_RADIUS} ${LED_SPEC.FLANGE_RADIUS} 0 0 1 ${LED_SPEC.FLANGE_MIN_X + LED_SPEC.FLANGE_RADIUS} ${LED_SPEC.FLANGE_TOP_Y} Z`;
  const legAPath = `M ${ANCHOR_A_X} ${ANCHOR_Y} L ${ANCHOR_A_X} ${LED_SPEC.LEG_A_STRAIGHT_Y} C ${LED_SPEC.LEG_A_CONTROL_1_X} ${LED_SPEC.LEG_A_CONTROL_1_Y} ${LED_SPEC.LEG_A_CONTROL_2_X} ${LED_SPEC.LEG_A_CONTROL_2_Y} ${LED_SPEC.LEG_A_BEND_END_X} ${LED_SPEC.LEG_A_BEND_END_Y} L ${LED_SPEC.LEG_A_BOTTOM_X} ${LED_SPEC.LEG_A_BOTTOM_Y}`;
  const legKPath = `M ${ANCHOR_K_X} ${ANCHOR_Y} L ${LED_SPEC.LEG_K_X} ${LED_SPEC.LEG_K_TOP_Y}`;
  const glowPeakAlpha = (theme === "light" ? LED_SPEC.GLOW_PEAK_ALPHA_LIGHT : LED_SPEC.GLOW_PEAK_ALPHA_DARK) * brightness;
  const glowBlendMode = theme === "light" ? LED_SPEC.GLOW_BLEND_MODE_LIGHT : LED_SPEC.GLOW_BLEND_MODE_DARK;
  const glowStop = (radius: number, alpha: number) => stop(radius / LED_SPEC.GLOW_RADIUS, palette.glowColor, alpha);
  const defs = `<linearGradient id="${prefix}-body" gradientUnits="userSpaceOnUse" x1="0" y1="${LED_SPEC.DOME_TOP_Y}" x2="0" y2="${LED_SPEC.BODY_BOTTOM_Y}">${stop(0, bodyTop, 1)}${stop(0.48, bodyBottom, 1)}${stop(1, palette.rim, 1)}</linearGradient><radialGradient id="${prefix}-glow" gradientUnits="objectBoundingBox" cx="0.5" cy="0.5" r="0.5">${glowStop(LED_SPEC.GLOW_STOP_RADIUS_0, glowPeakAlpha)}${glowStop(LED_SPEC.GLOW_STOP_RADIUS_55, glowPeakAlpha)}${glowStop(LED_SPEC.GLOW_STOP_RADIUS_135, glowPeakAlpha * LED_SPEC.GLOW_STOP_ALPHA_135_FACTOR)}${glowStop(LED_SPEC.GLOW_STOP_RADIUS_195, glowPeakAlpha * LED_SPEC.GLOW_STOP_ALPHA_195_FACTOR)}${glowStop(LED_SPEC.GLOW_STOP_RADIUS_225, 0)}</radialGradient><radialGradient id="${prefix}-core">${stop(0, "#ffffff", LED_SPEC.CORE_OPACITY_START)}${stop(1, "#ffffff", LED_SPEC.CORE_OPACITY_END)}</radialGradient>`;
  const glow = lit ? `<circle data-layer="glow" cx="${LED_SPEC.GLOW_CX}" cy="${LED_SPEC.GLOW_CY}" r="${LED_SPEC.GLOW_RADIUS}" fill="url(#${prefix}-glow)" style="mix-blend-mode:${glowBlendMode}" pointer-events="none"/>` : "";
  const glowEdgeRing = lit && theme === "light" ? `<circle data-layer="glow-edge-ring" cx="${LED_SPEC.GLOW_CX}" cy="${LED_SPEC.GLOW_CY}" r="${LED_SPEC.GLOW_EDGE_RING_RADIUS}" fill="none" stroke="${palette.glowColor}" stroke-width="${LED_SPEC.GLOW_EDGE_RING_WIDTH}" stroke-opacity="${LED_SPEC.GLOW_EDGE_RING_ALPHA}" pointer-events="none"/>` : "";
  const core = lit ? `<ellipse data-layer="core" cx="${LED_SPEC.CORE_CX}" cy="${LED_SPEC.CORE_CY}" rx="${LED_SPEC.CORE_RX}" ry="${LED_SPEC.CORE_RY}" fill="url(#${prefix}-core)" pointer-events="none"/>` : "";
  const ring = lit && theme === "light" ? `<circle data-layer="ring" cx="${LED_SPEC.LIGHT_RING_CX}" cy="${LED_SPEC.LIGHT_RING_CY}" r="${LED_SPEC.LIGHT_RING_RADIUS}" fill="none" stroke="${palette.glowColor}" stroke-width="${LED_SPEC.LIGHT_RING_WIDTH}" stroke-opacity="${LED_SPEC.LIGHT_RING_OPACITY}" pointer-events="none"/>` : "";
  const highlight = burnt ? "" : `<ellipse data-layer="highlight" cx="${LED_SPEC.HIGHLIGHT_CX}" cy="${LED_SPEC.HIGHLIGHT_CY}" rx="${LED_SPEC.HIGHLIGHT_RX}" ry="${LED_SPEC.HIGHLIGHT_RY}" transform="rotate(${LED_SPEC.HIGHLIGHT_ROTATION} ${LED_SPEC.HIGHLIGHT_CX} ${LED_SPEC.HIGHLIGHT_CY})" fill="${palette.highlight}" fill-opacity="${LED_SPEC.HIGHLIGHT_OPACITY}" pointer-events="none"/>`;
  const cup = `<path data-layer="cup" d="M ${LED_SPEC.CUP_CENTER_X - LED_SPEC.CUP_TOP_WIDTH / 2} ${LED_SPEC.CUP_TOP_Y} H ${LED_SPEC.CUP_CENTER_X + LED_SPEC.CUP_TOP_WIDTH / 2} L ${LED_SPEC.CUP_CENTER_X + LED_SPEC.CUP_BOTTOM_WIDTH / 2} ${LED_SPEC.CUP_BOTTOM_Y} H ${LED_SPEC.CUP_CENTER_X - LED_SPEC.CUP_BOTTOM_WIDTH / 2} Z" fill="${palette.rim}" fill-opacity="${LED_SPEC.CUP_OPACITY}" pointer-events="none"/>`;
  const exploded = burnt ? explodedIcon() : "";
  const selection = selected ? `<path data-layer="selection" d="${bodyPath}" fill="none" stroke="#ffc928" stroke-width="2" pointer-events="none"/>` : "";
  const labels = showLabels ? `<g data-layer="labels">${labelChip("A", ANCHOR_A_X, "anode", palette)}${labelChip("K", ANCHOR_K_X, "cathode", palette)}</g>` : "";
  const labelStyle = showLabels ? `<style>#${prefix}-labels{opacity:0;pointer-events:none;transition:opacity 120ms}#${prefix}-root:hover #${prefix}-labels{opacity:1}@media(min-resolution:3dppx){#${prefix}-labels{opacity:1}}</style>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" id="${prefix}-root" viewBox="${LED_SPEC.BBOX_WITH_GLOW_MIN_X} ${LED_SPEC.BBOX_WITH_GLOW_MIN_Y} ${LED_SPEC.BBOX_WITH_GLOW_MAX_X - LED_SPEC.BBOX_WITH_GLOW_MIN_X} ${LED_SPEC.BBOX_WITH_GLOW_MAX_Y - LED_SPEC.BBOX_WITH_GLOW_MIN_Y}" data-part-type="led" data-color="${color}" data-lit="${lit}" data-burnt="${burnt}" data-theme="${theme}" data-pitch="${PITCH}" data-anchor-spacing="${ANCHOR_SPACING}"><defs>${defs}</defs>${labelStyle}${glow}<g data-layer="legs" fill="none" stroke-linecap="round"><path data-layer="leg-anode" d="${legAPath}" stroke="${LED_SPEC.LEG_COLOR}" stroke-width="${LED_SPEC.LEG_WIDTH}"/><path data-layer="leg-anode-edge" d="${legAPath}" stroke="${LED_SPEC.LEG_EDGE_COLOR}" stroke-width="${LED_SPEC.LEG_EDGE_WIDTH}"/><path data-layer="leg-cathode" d="${legKPath}" stroke="${LED_SPEC.LEG_COLOR}" stroke-width="${LED_SPEC.LEG_WIDTH}"/><path data-layer="leg-cathode-edge" d="${legKPath}" stroke="${LED_SPEC.LEG_EDGE_COLOR}" stroke-width="${LED_SPEC.LEG_EDGE_WIDTH}"/></g><path data-layer="flange" d="${flangePath}" fill="${palette.flange}" stroke="${palette.rim}" stroke-width="${LED_SPEC.OUTLINE_WIDTH}"/><g data-layer="body"><path d="${bodyPath}" fill="url(#${prefix}-body)"/>${cup}</g>${core}${highlight}${ring}${glowEdgeRing}${exploded}<path data-layer="outline" d="${bodyPath}" fill="none" stroke="${palette.rim}" stroke-width="${LED_SPEC.OUTLINE_WIDTH}" stroke-opacity="${LED_SPEC.OUTLINE_OPACITY}" pointer-events="none"/>${selection}<g data-layer="anchors"><circle data-anchor="anode" cx="${ANCHOR_A_X}" cy="${ANCHOR_Y}" r="3.2" fill="${palette.pin}" stroke="${palette.surface}" stroke-width="1.5"/><circle data-anchor="cathode" cx="${ANCHOR_K_X}" cy="${ANCHOR_Y}" r="3.2" fill="${palette.pin}" stroke="${palette.surface}" stroke-width="1.5"/></g>${labels}<g data-layer="hit-areas" fill="transparent" pointer-events="all"><rect data-hit="body" x="-52" y="-120" width="104" height="128"/><circle data-hit="anode" cx="${ANCHOR_A_X}" cy="${ANCHOR_Y}" r="8"/><circle data-hit="cathode" cx="${ANCHOR_K_X}" cy="${ANCHOR_Y}" r="8"/></g></svg>`;
}

export default renderLedSvg;
