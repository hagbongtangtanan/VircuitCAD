export type PotTheme = "dark" | "light";

export interface PotPoint {
  x: number;
  y: number;
}

export interface PotTokens {
  bodyOuter: string;
  bodyRim: string;
  well: string;
  tick: string;
  dots: string;
  knobTop: string;
  knobBottom: string;
  knobRim: string;
  pointer: string;
  tail: string;
  tailEdge: string;
  labelBg: string;
  labelText: string;
}

/** Design units: one design unit is one app world unit (one hole pitch is 10). */
export const DESIGN_UNITS_PER_PITCH = 10;

/**
 * The design frame puts the middle anchor at (0, 0) and the body disc above
 * it, so the three tails run from the bottom of the disc down to the pins.
 */
export const BODY_CENTER: PotPoint = { x: 0, y: -46.2 };
export const BODY_RADIUS = 22.2;
export const BODY_STROKE_WIDTH = 1.2;
export const WELL_RADIUS = 15.6;

export const RIM_DOT_COUNT = 8;
export const RIM_DOT_RADIUS = 0.96;
export const RIM_DOT_ORBIT_RADIUS = 18.96;
export const RIM_DOT_STEP_DEG = 360 / RIM_DOT_COUNT;

export const TICK_COUNT = 24;
export const TICK_INNER_RADIUS = 11.88;
export const TICK_OUTER_RADIUS = 14.28;
export const TICK_ANGLE_STEP_DEG = 360 / TICK_COUNT;
export const TICK_WIDTH = 0.72;

export const KNOB_RADIUS = 10.8;
export const KNOB_GRADIENT_OFFSET: PotPoint = { x: -3.12, y: -3.84 };
export const KNOB_GRADIENT_RADIUS = 13.2;
export const KNOB_STROKE_WIDTH = 0.72;

export const HIGHLIGHT_CENTER: PotPoint = { x: -3.6, y: -4.08 };
export const HIGHLIGHT_RX = 4.08;
export const HIGHLIGHT_RY = 2.16;
export const HIGHLIGHT_ROTATION_DEG = -35;
export const HIGHLIGHT_OPACITY = 0.14;

export const POINTER_BASE_RADIUS = 3.84;
export const POINTER_TIP_RADIUS = 1.56;
export const POINTER_TIP_DISTANCE = 10.2;
export const POINTER_HULL_STEPS = 96;
/** Pointer angle in degrees, clockwise from straight up. */
export const POINTER_START_ANGLE_DEG = -135;
export const POINTER_SWEEP_DEG = 270;

/**
 * The tails match the LED legs at half their length: they are 24 world units
 * long from the bottom edge of the body disc down to the pin anchor, with the
 * same metal look.
 */
export const TAIL_LENGTH = 24;
/** How far a tail reaches into the body disc so the joint stays seamless. */
export const TAIL_OVERLAP = 4;
export const TAIL_WIDTH = 4;
export const TAIL_EDGE_WIDTH = 0.5;

/** The y where a tail at `x` starts, tucked inside the body disc. */
export function tailTopY(x: number): number {
  const dx = x - BODY_CENTER.x;
  const edgeY = BODY_CENTER.y + Math.sqrt(Math.max(0, BODY_RADIUS * BODY_RADIUS - dx * dx));
  return edgeY - TAIL_OVERLAP;
}

/**
 * The app's three pins sit on one row of adjacent breadboard holes: the
 * wiper ("2") in the middle, "1" (VCC) on the left and "3" (GND) on the
 * right. The body disc sits above the pin row and the tails drop to the pins.
 */
export const APP_BOX = { width: 60, height: 90 } as const;

export const APP_PINS = [
  { id: "1", label: "1", x: 20, y: 90 },
  { id: "2", label: "W", x: 30, y: 90 },
  { id: "3", label: "3", x: 40, y: 90 },
] as const;

export const APP_ANCHOR_LOCAL = {
  left: { x: 20, y: 90 },
  middle: { x: 30, y: 90 },
  right: { x: 40, y: 90 },
} as const;

export const APP_ADJACENT_ANCHOR_DISTANCE = 10;
export const APP_SCALE = APP_ADJACENT_ANCHOR_DISTANCE / DESIGN_UNITS_PER_PITCH;

export const ANCHOR_LEFT: PotPoint = {
  x: (APP_ANCHOR_LOCAL.left.x - APP_ANCHOR_LOCAL.middle.x) / APP_SCALE,
  y: (APP_ANCHOR_LOCAL.left.y - APP_ANCHOR_LOCAL.middle.y) / APP_SCALE,
};
export const ANCHOR_MIDDLE: PotPoint = { x: 0, y: 0 };
export const ANCHOR_RIGHT: PotPoint = {
  x: (APP_ANCHOR_LOCAL.right.x - APP_ANCHOR_LOCAL.middle.x) / APP_SCALE,
  y: (APP_ANCHOR_LOCAL.right.y - APP_ANCHOR_LOCAL.middle.y) / APP_SCALE,
};

/** Opaque artwork bounds: the body disc plus the tails down to the pins. */
export const BBOX = {
  minX: BODY_CENTER.x - BODY_RADIUS - BODY_STROKE_WIDTH / 2,
  maxX: BODY_CENTER.x + BODY_RADIUS + BODY_STROKE_WIDTH / 2,
  minY: BODY_CENTER.y - BODY_RADIUS - BODY_STROKE_WIDTH / 2,
  maxY: ANCHOR_MIDDLE.y + TAIL_WIDTH / 2,
} as const;

export const DARK_TOKENS: PotTokens = {
  bodyOuter: "#0B1620",
  bodyRim: "#7FA3BE",
  well: "#16232E",
  tick: "#B7CCDD",
  dots: "#A9BFD1",
  knobTop: "#7DAAE6",
  knobBottom: "#4F86D0",
  knobRim: "#2F5A99",
  pointer: "#0F1822",
  tail: "#9AA1A8",
  tailEdge: "#6B7280",
  labelBg: "#12212E",
  labelText: "#D7E4F0",
};

export const LIGHT_TOKENS: PotTokens = {
  bodyOuter: "#14212B",
  bodyRim: "#A8C0D4",
  well: "#1B2A37",
  tick: "#A9BED0",
  dots: "#9DB2C4",
  knobTop: "#74A2DB",
  knobBottom: "#4C7DBE",
  knobRim: "#2F5F9A",
  pointer: "#0A1119",
  tail: "#6B7280",
  tailEdge: "#454C57",
  labelBg: "#E7EDF4",
  labelText: "#16242F",
};

export const BURNT_TOKENS = {
  bodyOuter: "#2B2420",
  well: "#191412",
  knob: "#3A322D",
  pointer: "#120F0E",
  tail: "#4A403A",
  tailEdge: "#2E2825",
} as const;

export const DEFAULT_PIN_NAMES = {
  left: "W",
  middle: "1",
  right: "3",
} as const;

export const LABEL_CHIP_WIDTH = 10;
export const LABEL_CHIP_HEIGHT = 8;
export const LABEL_CHIP_CORNER = 2;
export const LABEL_CHIP_GAP = 2;
export const LABEL_TEXT_SIZE = 6;
export const VALUE_CHIP_WIDTH = 44;
export const VALUE_CHIP_HEIGHT = 11;
export const VALUE_CHIP_GAP = 4;
export const VALUE_TEXT_SIZE = 7;

export function tokensFor(theme: PotTheme): PotTokens {
  return theme === "light" ? LIGHT_TOKENS : DARK_TOKENS;
}
