import {
  ANCHOR_LEFT,
  ANCHOR_MIDDLE,
  ANCHOR_RIGHT,
  BBOX,
  BODY_CENTER,
  BODY_RADIUS,
  BODY_STROKE_WIDTH,
  BURNT_TOKENS,
  DEFAULT_PIN_NAMES,
  DESIGN_UNITS_PER_PITCH,
  HIGHLIGHT_CENTER,
  HIGHLIGHT_OPACITY,
  HIGHLIGHT_RX,
  HIGHLIGHT_ROTATION_DEG,
  HIGHLIGHT_RY,
  KNOB_GRADIENT_OFFSET,
  KNOB_GRADIENT_RADIUS,
  KNOB_RADIUS,
  KNOB_STROKE_WIDTH,
  LABEL_CHIP_CORNER,
  LABEL_CHIP_GAP,
  LABEL_CHIP_HEIGHT,
  LABEL_CHIP_WIDTH,
  LABEL_TEXT_SIZE,
  POINTER_BASE_RADIUS,
  POINTER_HULL_STEPS,
  POINTER_START_ANGLE_DEG,
  POINTER_SWEEP_DEG,
  POINTER_TIP_DISTANCE,
  POINTER_TIP_RADIUS,
  RIM_DOT_COUNT,
  RIM_DOT_ORBIT_RADIUS,
  RIM_DOT_RADIUS,
  RIM_DOT_STEP_DEG,
  TAIL_EDGE_WIDTH,
  TAIL_WIDTH,
  TICK_ANGLE_STEP_DEG,
  TICK_COUNT,
  TICK_INNER_RADIUS,
  TICK_OUTER_RADIUS,
  TICK_WIDTH,
  VALUE_CHIP_GAP,
  VALUE_CHIP_HEIGHT,
  VALUE_CHIP_WIDTH,
  VALUE_TEXT_SIZE,
  WELL_RADIUS,
  tailTopY,
  tokensFor,
  type PotPoint,
  type PotTheme,
} from "./potSpec.ts";

export interface PotPinNames {
  left: string;
  middle: string;
  right: string;
}

export interface PotRenderOptions {
  value: number;
  theme: PotTheme;
  burnt?: boolean;
  selected?: boolean;
  showLabels?: boolean;
  pinNames?: PotPinNames;
  resistanceText?: string;
}

const SVG_NS = "http://www.w3.org/2000/svg";

function num(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** A point at `radius` from the centre, `angleDeg` clockwise from straight up. */
function polar(center: PotPoint, radius: number, angleDeg: number): PotPoint {
  const radians = (angleDeg * Math.PI) / 180;
  return {
    x: center.x + Math.sin(radians) * radius,
    y: center.y - Math.cos(radians) * radius,
  };
}

export function pointerAngleDeg(value: number): number {
  const v = clamp(value, 0, 1);
  return POINTER_START_ANGLE_DEG + POINTER_SWEEP_DEG * v;
}

/**
 * The pointer is the convex hull of the base circle at the knob centre and the
 * tip circle along the pointing direction: the base arc on the far side, two
 * tangent lines and the tip arc on the near side.
 */
export function pointerHullPoints(value: number): PotPoint[] {
  const angleDeg = pointerAngleDeg(value);
  const radians = (angleDeg * Math.PI) / 180;
  const ux = Math.sin(radians);
  const uy = -Math.cos(radians);
  const nx = -uy;
  const ny = ux;
  const beta = Math.acos((POINTER_BASE_RADIUS - POINTER_TIP_RADIUS) / POINTER_TIP_DISTANCE);
  const baseCenter = BODY_CENTER;
  const tipCenter: PotPoint = {
    x: BODY_CENTER.x + ux * POINTER_TIP_DISTANCE,
    y: BODY_CENTER.y + uy * POINTER_TIP_DISTANCE,
  };
  const points: PotPoint[] = [];
  const baseArc = Math.max(
    2,
    Math.round((POINTER_HULL_STEPS * (2 * Math.PI - 2 * beta)) / (2 * Math.PI)),
  );
  for (let index = 0; index <= baseArc; index += 1) {
    const alpha = beta + (index / baseArc) * (2 * Math.PI - 2 * beta);
    const cos = Math.cos(alpha);
    const sin = Math.sin(alpha);
    points.push({
      x: baseCenter.x + POINTER_BASE_RADIUS * (cos * ux + sin * nx),
      y: baseCenter.y + POINTER_BASE_RADIUS * (cos * uy + sin * ny),
    });
  }
  const tipArc = Math.max(2, Math.round((POINTER_HULL_STEPS * (2 * beta)) / (2 * Math.PI)));
  for (let index = 0; index <= tipArc; index += 1) {
    const alpha = -beta + (index / tipArc) * (2 * beta);
    const cos = Math.cos(alpha);
    const sin = Math.sin(alpha);
    points.push({
      x: tipCenter.x + POINTER_TIP_RADIUS * (cos * ux + sin * nx),
      y: tipCenter.y + POINTER_TIP_RADIUS * (cos * uy + sin * ny),
    });
  }
  return points;
}

function chipMarkup(
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  text: string,
  fill: string,
  textFill: string,
  fontSize: number,
): string {
  const x = num(centerX - width / 2);
  const y = num(centerY - height / 2);
  return (
    `<rect x="${x}" y="${y}" width="${num(width)}" height="${num(height)}" rx="${num(LABEL_CHIP_CORNER)}" fill="${fill}"/>` +
    `<text x="${num(centerX)}" y="${num(centerY + fontSize * 0.36)}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="${num(fontSize)}" font-weight="600" fill="${textFill}">${text}</text>`
  );
}

export function renderPotSvg(options: PotRenderOptions): string {
  const theme = options.theme === "light" ? "light" : "dark";
  const burnt = options.burnt === true;
  const showLabels = options.showLabels === true;
  const pinNames = options.pinNames ?? DEFAULT_PIN_NAMES;
  const tokens = tokensFor(theme);
  const v = clamp(options.value, 0, 1);

  const bodyFill = burnt ? BURNT_TOKENS.bodyOuter : tokens.bodyOuter;
  const bodyRim = burnt
    ? BURNT_TOKENS.bodyOuter
    : options.selected === true
      ? "#FFC928"
      : tokens.bodyRim;
  const wellFill = burnt ? BURNT_TOKENS.well : tokens.well;
  const tickColor = burnt ? "#6B5C50" : tokens.tick;
  const dotColor = burnt ? "#6B5C50" : tokens.dots;
  const knobFill = burnt ? BURNT_TOKENS.knob : tokens.knobBottom;
  const knobTop = burnt ? BURNT_TOKENS.knob : tokens.knobTop;
  const knobRim = burnt ? "#241E1A" : tokens.knobRim;
  const pointerColor = burnt ? BURNT_TOKENS.pointer : tokens.pointer;
  const tailColor = burnt ? BURNT_TOKENS.tail : tokens.tail;
  const tailEdgeColor = burnt ? BURNT_TOKENS.tailEdge : tokens.tailEdge;

  const gradientId = `potKnobGradient${burnt ? "Burnt" : ""}`;
  const gradientCx = num(BODY_CENTER.x + KNOB_GRADIENT_OFFSET.x);
  const gradientCy = num(BODY_CENTER.y + KNOB_GRADIENT_OFFSET.y);
  const gradientRadius = num(KNOB_GRADIENT_RADIUS);

  const parts: string[] = [];

  const tails = [ANCHOR_LEFT, ANCHOR_MIDDLE, ANCHOR_RIGHT];
  parts.push(`<g id="pot-tails" fill="none" stroke-linecap="round">`);
  for (const anchor of tails) {
    const path = `M ${num(anchor.x)} ${num(tailTopY(anchor.x))} L ${num(anchor.x)} ${num(anchor.y)}`;
    parts.push(`<path d="${path}" stroke="${tailColor}" stroke-width="${num(TAIL_WIDTH)}"/>`);
    parts.push(
      `<path d="${path}" stroke="${tailEdgeColor}" stroke-width="${num(TAIL_EDGE_WIDTH)}"/>`,
    );
  }
  parts.push(`</g>`);

  parts.push(
    `<circle cx="${num(BODY_CENTER.x)}" cy="${num(BODY_CENTER.y)}" r="${num(BODY_RADIUS)}" fill="${bodyFill}" stroke="${bodyRim}" stroke-width="${num(BODY_STROKE_WIDTH)}"/>`,
  );

  parts.push(`<g id="pot-rim-dots">`);
  for (let index = 0; index < RIM_DOT_COUNT; index += 1) {
    const dot = polar(BODY_CENTER, RIM_DOT_ORBIT_RADIUS, index * RIM_DOT_STEP_DEG);
    parts.push(
      `<circle cx="${num(dot.x)}" cy="${num(dot.y)}" r="${num(RIM_DOT_RADIUS)}" fill="${dotColor}"/>`,
    );
  }
  parts.push(`</g>`);

  parts.push(
    `<circle cx="${num(BODY_CENTER.x)}" cy="${num(BODY_CENTER.y)}" r="${num(WELL_RADIUS)}" fill="${wellFill}"/>`,
  );

  parts.push(`<g id="pot-ticks">`);
  for (let index = 0; index < TICK_COUNT; index += 1) {
    const inner = polar(BODY_CENTER, TICK_INNER_RADIUS, index * TICK_ANGLE_STEP_DEG);
    const outer = polar(BODY_CENTER, TICK_OUTER_RADIUS, index * TICK_ANGLE_STEP_DEG);
    parts.push(
      `<line x1="${num(inner.x)}" y1="${num(inner.y)}" x2="${num(outer.x)}" y2="${num(outer.y)}" stroke="${tickColor}" stroke-width="${num(TICK_WIDTH)}" stroke-linecap="butt"/>`,
    );
  }
  parts.push(`</g>`);

  const hull = pointerHullPoints(v);
  const hullPath =
    hull
      .map((point, index) => `${index === 0 ? "M" : "L"}${num(point.x)} ${num(point.y)}`)
      .join(" ") + " Z";

  parts.push(`<g id="pot-knob">`);
  parts.push(
    `<defs><radialGradient id="${gradientId}" gradientUnits="userSpaceOnUse" cx="${gradientCx}" cy="${gradientCy}" r="${gradientRadius}">` +
      `<stop offset="0" stop-color="${knobTop}" stop-opacity="1"/>` +
      `<stop offset="1" stop-color="${knobFill}" stop-opacity="1"/>` +
      `</radialGradient></defs>`,
  );
  parts.push(
    `<circle cx="${num(BODY_CENTER.x)}" cy="${num(BODY_CENTER.y)}" r="${num(KNOB_RADIUS)}" fill="url(#${gradientId})" stroke="${knobRim}" stroke-width="${num(KNOB_STROKE_WIDTH)}"/>`,
  );
  if (!burnt) {
    const highlightX = num(BODY_CENTER.x + HIGHLIGHT_CENTER.x);
    const highlightY = num(BODY_CENTER.y + HIGHLIGHT_CENTER.y);
    parts.push(
      `<ellipse cx="${highlightX}" cy="${highlightY}" rx="${num(HIGHLIGHT_RX)}" ry="${num(HIGHLIGHT_RY)}" fill="#FFFFFF" fill-opacity="${num(HIGHLIGHT_OPACITY)}" transform="rotate(${num(HIGHLIGHT_ROTATION_DEG)} ${highlightX} ${highlightY})"/>`,
    );
  }
  parts.push(`<path d="${hullPath}" fill="${pointerColor}"/>`);
  parts.push(`</g>`);

  if (showLabels) {
    parts.push(`<g id="pot-labels">`);
    const labelFill = tokens.labelBg;
    const labelText = tokens.labelText;
    const labelY = BBOX.maxY + LABEL_CHIP_GAP + LABEL_CHIP_HEIGHT / 2;
    parts.push(
      chipMarkup(
        ANCHOR_LEFT.x,
        labelY,
        LABEL_CHIP_WIDTH,
        LABEL_CHIP_HEIGHT,
        pinNames.left,
        labelFill,
        labelText,
        LABEL_TEXT_SIZE,
      ),
    );
    parts.push(
      chipMarkup(
        ANCHOR_MIDDLE.x,
        labelY,
        LABEL_CHIP_WIDTH,
        LABEL_CHIP_HEIGHT,
        pinNames.middle,
        labelFill,
        labelText,
        LABEL_TEXT_SIZE,
      ),
    );
    parts.push(
      chipMarkup(
        ANCHOR_RIGHT.x,
        labelY,
        LABEL_CHIP_WIDTH,
        LABEL_CHIP_HEIGHT,
        pinNames.right,
        labelFill,
        labelText,
        LABEL_TEXT_SIZE,
      ),
    );
    const valueParts: string[] = [];
    if (options.resistanceText !== undefined && options.resistanceText !== "") {
      valueParts.push(options.resistanceText);
    }
    valueParts.push(`${Math.round(v * 100)}%`);
    const valueY = BODY_CENTER.y - BODY_RADIUS - VALUE_CHIP_GAP - VALUE_CHIP_HEIGHT / 2;
    parts.push(
      chipMarkup(
        BODY_CENTER.x,
        valueY,
        VALUE_CHIP_WIDTH,
        VALUE_CHIP_HEIGHT,
        valueParts.join("  "),
        labelFill,
        labelText,
        VALUE_TEXT_SIZE,
      ),
    );
    parts.push(`</g>`);
  }

  const minX = BBOX.minX;
  const maxX = BBOX.maxX;
  const minY = BBOX.minY;
  const maxY = BBOX.maxY;
  const width = maxX - minX;
  const height = maxY - minY;

  return (
    `<svg xmlns="${SVG_NS}" width="${num(width)}" height="${num(height)}" ` +
    `viewBox="${num(minX)} ${num(minY)} ${num(width)} ${num(height)}" ` +
    `overflow="visible" data-pot-pitch="${DESIGN_UNITS_PER_PITCH}">` +
    parts.join("") +
    `</svg>`
  );
}
