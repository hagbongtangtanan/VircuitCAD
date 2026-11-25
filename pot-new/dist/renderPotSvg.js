(function (root, factory) {
  var mod = { exports: {} };
  factory(mod, mod.exports);
  root.PotSvg = mod.exports;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (module, exports) {
"use strict";
var __potModules = {};
var __potCache = {};
function __potRequire(name) {
  if (__potCache[name]) return __potCache[name].exports;
  var factory = __potModules[name];
  if (!factory) return require(name);
  var module = { exports: {} };
  __potCache[name] = module;
  factory(module, module.exports, __potRequire);
  return module.exports;
}
__potModules["./potSpec"] = function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LABEL_CHIP_GAP = exports.LABEL_CHIP_CORNER = exports.LABEL_CHIP_HEIGHT = exports.LABEL_CHIP_WIDTH = exports.DEFAULT_PIN_NAMES = exports.BURNT_TOKENS = exports.LIGHT_TOKENS = exports.DARK_TOKENS = exports.BBOX = exports.ANCHOR_RIGHT = exports.ANCHOR_MIDDLE = exports.ANCHOR_LEFT = exports.APP_SCALE = exports.APP_ADJACENT_ANCHOR_DISTANCE = exports.APP_ANCHOR_LOCAL = exports.APP_PINS = exports.APP_BOX = exports.TAIL_EDGE_WIDTH = exports.TAIL_WIDTH = exports.TAIL_OVERLAP = exports.TAIL_LENGTH = exports.POINTER_SWEEP_DEG = exports.POINTER_START_ANGLE_DEG = exports.POINTER_HULL_STEPS = exports.POINTER_TIP_DISTANCE = exports.POINTER_TIP_RADIUS = exports.POINTER_BASE_RADIUS = exports.HIGHLIGHT_OPACITY = exports.HIGHLIGHT_ROTATION_DEG = exports.HIGHLIGHT_RY = exports.HIGHLIGHT_RX = exports.HIGHLIGHT_CENTER = exports.KNOB_STROKE_WIDTH = exports.KNOB_GRADIENT_RADIUS = exports.KNOB_GRADIENT_OFFSET = exports.KNOB_RADIUS = exports.TICK_WIDTH = exports.TICK_ANGLE_STEP_DEG = exports.TICK_OUTER_RADIUS = exports.TICK_INNER_RADIUS = exports.TICK_COUNT = exports.RIM_DOT_STEP_DEG = exports.RIM_DOT_ORBIT_RADIUS = exports.RIM_DOT_RADIUS = exports.RIM_DOT_COUNT = exports.WELL_RADIUS = exports.BODY_STROKE_WIDTH = exports.BODY_RADIUS = exports.BODY_CENTER = exports.DESIGN_UNITS_PER_PITCH = void 0;
exports.VALUE_TEXT_SIZE = exports.VALUE_CHIP_GAP = exports.VALUE_CHIP_HEIGHT = exports.VALUE_CHIP_WIDTH = exports.LABEL_TEXT_SIZE = void 0;
exports.tailTopY = tailTopY;
exports.tokensFor = tokensFor;
/** Design units: one design unit is one app world unit (one hole pitch is 10). */
exports.DESIGN_UNITS_PER_PITCH = 10;
/**
 * The design frame puts the middle anchor at (0, 0) and the body disc above
 * it, so the three tails run from the bottom of the disc down to the pins.
 */
exports.BODY_CENTER = { x: 0, y: -46.2 };
exports.BODY_RADIUS = 22.2;
exports.BODY_STROKE_WIDTH = 1.2;
exports.WELL_RADIUS = 15.6;
exports.RIM_DOT_COUNT = 8;
exports.RIM_DOT_RADIUS = 0.96;
exports.RIM_DOT_ORBIT_RADIUS = 18.96;
exports.RIM_DOT_STEP_DEG = 360 / exports.RIM_DOT_COUNT;
exports.TICK_COUNT = 24;
exports.TICK_INNER_RADIUS = 11.88;
exports.TICK_OUTER_RADIUS = 14.28;
exports.TICK_ANGLE_STEP_DEG = 360 / exports.TICK_COUNT;
exports.TICK_WIDTH = 0.72;
exports.KNOB_RADIUS = 10.8;
exports.KNOB_GRADIENT_OFFSET = { x: -3.12, y: -3.84 };
exports.KNOB_GRADIENT_RADIUS = 13.2;
exports.KNOB_STROKE_WIDTH = 0.72;
exports.HIGHLIGHT_CENTER = { x: -3.6, y: -4.08 };
exports.HIGHLIGHT_RX = 4.08;
exports.HIGHLIGHT_RY = 2.16;
exports.HIGHLIGHT_ROTATION_DEG = -35;
exports.HIGHLIGHT_OPACITY = 0.14;
exports.POINTER_BASE_RADIUS = 3.84;
exports.POINTER_TIP_RADIUS = 1.56;
exports.POINTER_TIP_DISTANCE = 10.2;
exports.POINTER_HULL_STEPS = 96;
/** Pointer angle in degrees, clockwise from straight up. */
exports.POINTER_START_ANGLE_DEG = -135;
exports.POINTER_SWEEP_DEG = 270;
/**
 * The tails match the LED legs at half their length: they are 24 world units
 * long from the bottom edge of the body disc down to the pin anchor, with the
 * same metal look.
 */
exports.TAIL_LENGTH = 24;
/** How far a tail reaches into the body disc so the joint stays seamless. */
exports.TAIL_OVERLAP = 4;
exports.TAIL_WIDTH = 4;
exports.TAIL_EDGE_WIDTH = 0.5;
/** The y where a tail at `x` starts, tucked inside the body disc. */
function tailTopY(x) {
    const dx = x - exports.BODY_CENTER.x;
    const edgeY = exports.BODY_CENTER.y + Math.sqrt(Math.max(0, exports.BODY_RADIUS * exports.BODY_RADIUS - dx * dx));
    return edgeY - exports.TAIL_OVERLAP;
}
/**
 * The app's three pins sit on one row of adjacent breadboard holes: the
 * wiper ("2") in the middle, "1" (VCC) on the left and "3" (GND) on the
 * right. The body disc sits above the pin row and the tails drop to the pins.
 */
exports.APP_BOX = { width: 60, height: 90 };
exports.APP_PINS = [
    { id: "1", label: "1", x: 20, y: 90 },
    { id: "2", label: "W", x: 30, y: 90 },
    { id: "3", label: "3", x: 40, y: 90 },
];
exports.APP_ANCHOR_LOCAL = {
    left: { x: 20, y: 90 },
    middle: { x: 30, y: 90 },
    right: { x: 40, y: 90 },
};
exports.APP_ADJACENT_ANCHOR_DISTANCE = 10;
exports.APP_SCALE = exports.APP_ADJACENT_ANCHOR_DISTANCE / exports.DESIGN_UNITS_PER_PITCH;
exports.ANCHOR_LEFT = {
    x: (exports.APP_ANCHOR_LOCAL.left.x - exports.APP_ANCHOR_LOCAL.middle.x) / exports.APP_SCALE,
    y: (exports.APP_ANCHOR_LOCAL.left.y - exports.APP_ANCHOR_LOCAL.middle.y) / exports.APP_SCALE,
};
exports.ANCHOR_MIDDLE = { x: 0, y: 0 };
exports.ANCHOR_RIGHT = {
    x: (exports.APP_ANCHOR_LOCAL.right.x - exports.APP_ANCHOR_LOCAL.middle.x) / exports.APP_SCALE,
    y: (exports.APP_ANCHOR_LOCAL.right.y - exports.APP_ANCHOR_LOCAL.middle.y) / exports.APP_SCALE,
};
/** Opaque artwork bounds: the body disc plus the tails down to the pins. */
exports.BBOX = {
    minX: exports.BODY_CENTER.x - exports.BODY_RADIUS - exports.BODY_STROKE_WIDTH / 2,
    maxX: exports.BODY_CENTER.x + exports.BODY_RADIUS + exports.BODY_STROKE_WIDTH / 2,
    minY: exports.BODY_CENTER.y - exports.BODY_RADIUS - exports.BODY_STROKE_WIDTH / 2,
    maxY: exports.ANCHOR_MIDDLE.y + exports.TAIL_WIDTH / 2,
};
exports.DARK_TOKENS = {
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
exports.LIGHT_TOKENS = {
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
exports.BURNT_TOKENS = {
    bodyOuter: "#2B2420",
    well: "#191412",
    knob: "#3A322D",
    pointer: "#120F0E",
    tail: "#4A403A",
    tailEdge: "#2E2825",
};
exports.DEFAULT_PIN_NAMES = {
    left: "W",
    middle: "1",
    right: "3",
};
exports.LABEL_CHIP_WIDTH = 10;
exports.LABEL_CHIP_HEIGHT = 8;
exports.LABEL_CHIP_CORNER = 2;
exports.LABEL_CHIP_GAP = 2;
exports.LABEL_TEXT_SIZE = 6;
exports.VALUE_CHIP_WIDTH = 44;
exports.VALUE_CHIP_HEIGHT = 11;
exports.VALUE_CHIP_GAP = 4;
exports.VALUE_TEXT_SIZE = 7;
function tokensFor(theme) {
    return theme === "light" ? exports.LIGHT_TOKENS : exports.DARK_TOKENS;
}

};
__potModules["./renderPotSvg"] = function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pointerAngleDeg = pointerAngleDeg;
exports.pointerHullPoints = pointerHullPoints;
exports.renderPotSvg = renderPotSvg;
const potSpec_1 = require("./potSpec");
const SVG_NS = "http://www.w3.org/2000/svg";
function num(value) {
    const rounded = Math.round(value * 1000) / 1000;
    return Object.is(rounded, -0) ? "0" : String(rounded);
}
function clamp(value, min, max) {
    if (Number.isNaN(value))
        return min;
    return Math.min(max, Math.max(min, value));
}
/** A point at `radius` from the centre, `angleDeg` clockwise from straight up. */
function polar(center, radius, angleDeg) {
    const radians = (angleDeg * Math.PI) / 180;
    return {
        x: center.x + Math.sin(radians) * radius,
        y: center.y - Math.cos(radians) * radius,
    };
}
function pointerAngleDeg(value) {
    const v = clamp(value, 0, 1);
    return potSpec_1.POINTER_START_ANGLE_DEG + potSpec_1.POINTER_SWEEP_DEG * v;
}
/**
 * The pointer is the convex hull of the base circle at the knob centre and the
 * tip circle along the pointing direction: the base arc on the far side, two
 * tangent lines and the tip arc on the near side.
 */
function pointerHullPoints(value) {
    const angleDeg = pointerAngleDeg(value);
    const radians = (angleDeg * Math.PI) / 180;
    const ux = Math.sin(radians);
    const uy = -Math.cos(radians);
    const nx = -uy;
    const ny = ux;
    const beta = Math.acos((potSpec_1.POINTER_BASE_RADIUS - potSpec_1.POINTER_TIP_RADIUS) / potSpec_1.POINTER_TIP_DISTANCE);
    const baseCenter = potSpec_1.BODY_CENTER;
    const tipCenter = {
        x: potSpec_1.BODY_CENTER.x + ux * potSpec_1.POINTER_TIP_DISTANCE,
        y: potSpec_1.BODY_CENTER.y + uy * potSpec_1.POINTER_TIP_DISTANCE,
    };
    const points = [];
    const baseArc = Math.max(2, Math.round((potSpec_1.POINTER_HULL_STEPS * (2 * Math.PI - 2 * beta)) / (2 * Math.PI)));
    for (let index = 0; index <= baseArc; index += 1) {
        const alpha = beta + (index / baseArc) * (2 * Math.PI - 2 * beta);
        const cos = Math.cos(alpha);
        const sin = Math.sin(alpha);
        points.push({
            x: baseCenter.x + potSpec_1.POINTER_BASE_RADIUS * (cos * ux + sin * nx),
            y: baseCenter.y + potSpec_1.POINTER_BASE_RADIUS * (cos * uy + sin * ny),
        });
    }
    const tipArc = Math.max(2, Math.round((potSpec_1.POINTER_HULL_STEPS * (2 * beta)) / (2 * Math.PI)));
    for (let index = 0; index <= tipArc; index += 1) {
        const alpha = -beta + (index / tipArc) * (2 * beta);
        const cos = Math.cos(alpha);
        const sin = Math.sin(alpha);
        points.push({
            x: tipCenter.x + potSpec_1.POINTER_TIP_RADIUS * (cos * ux + sin * nx),
            y: tipCenter.y + potSpec_1.POINTER_TIP_RADIUS * (cos * uy + sin * ny),
        });
    }
    return points;
}
function chipMarkup(centerX, centerY, width, height, text, fill, textFill, fontSize) {
    const x = num(centerX - width / 2);
    const y = num(centerY - height / 2);
    return (`<rect x="${x}" y="${y}" width="${num(width)}" height="${num(height)}" rx="${num(potSpec_1.LABEL_CHIP_CORNER)}" fill="${fill}"/>` +
        `<text x="${num(centerX)}" y="${num(centerY + fontSize * 0.36)}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="${num(fontSize)}" font-weight="600" fill="${textFill}">${text}</text>`);
}
function renderPotSvg(options) {
    const theme = options.theme === "light" ? "light" : "dark";
    const burnt = options.burnt === true;
    const showLabels = options.showLabels === true;
    const pinNames = options.pinNames ?? potSpec_1.DEFAULT_PIN_NAMES;
    const tokens = (0, potSpec_1.tokensFor)(theme);
    const v = clamp(options.value, 0, 1);
    const bodyFill = burnt ? potSpec_1.BURNT_TOKENS.bodyOuter : tokens.bodyOuter;
    const bodyRim = burnt
        ? potSpec_1.BURNT_TOKENS.bodyOuter
        : options.selected === true
            ? "#FFC928"
            : tokens.bodyRim;
    const wellFill = burnt ? potSpec_1.BURNT_TOKENS.well : tokens.well;
    const tickColor = burnt ? "#6B5C50" : tokens.tick;
    const dotColor = burnt ? "#6B5C50" : tokens.dots;
    const knobFill = burnt ? potSpec_1.BURNT_TOKENS.knob : tokens.knobBottom;
    const knobTop = burnt ? potSpec_1.BURNT_TOKENS.knob : tokens.knobTop;
    const knobRim = burnt ? "#241E1A" : tokens.knobRim;
    const pointerColor = burnt ? potSpec_1.BURNT_TOKENS.pointer : tokens.pointer;
    const tailColor = burnt ? potSpec_1.BURNT_TOKENS.tail : tokens.tail;
    const tailEdgeColor = burnt ? potSpec_1.BURNT_TOKENS.tailEdge : tokens.tailEdge;
    const gradientId = `potKnobGradient${burnt ? "Burnt" : ""}`;
    const gradientCx = num(potSpec_1.BODY_CENTER.x + potSpec_1.KNOB_GRADIENT_OFFSET.x);
    const gradientCy = num(potSpec_1.BODY_CENTER.y + potSpec_1.KNOB_GRADIENT_OFFSET.y);
    const gradientRadius = num(potSpec_1.KNOB_GRADIENT_RADIUS);
    const parts = [];
    const tails = [potSpec_1.ANCHOR_LEFT, potSpec_1.ANCHOR_MIDDLE, potSpec_1.ANCHOR_RIGHT];
    parts.push(`<g id="pot-tails" fill="none" stroke-linecap="round">`);
    for (const anchor of tails) {
        const path = `M ${num(anchor.x)} ${num((0, potSpec_1.tailTopY)(anchor.x))} L ${num(anchor.x)} ${num(anchor.y)}`;
        parts.push(`<path d="${path}" stroke="${tailColor}" stroke-width="${num(potSpec_1.TAIL_WIDTH)}"/>`);
        parts.push(`<path d="${path}" stroke="${tailEdgeColor}" stroke-width="${num(potSpec_1.TAIL_EDGE_WIDTH)}"/>`);
    }
    parts.push(`</g>`);
    parts.push(`<circle cx="${num(potSpec_1.BODY_CENTER.x)}" cy="${num(potSpec_1.BODY_CENTER.y)}" r="${num(potSpec_1.BODY_RADIUS)}" fill="${bodyFill}" stroke="${bodyRim}" stroke-width="${num(potSpec_1.BODY_STROKE_WIDTH)}"/>`);
    parts.push(`<g id="pot-rim-dots">`);
    for (let index = 0; index < potSpec_1.RIM_DOT_COUNT; index += 1) {
        const dot = polar(potSpec_1.BODY_CENTER, potSpec_1.RIM_DOT_ORBIT_RADIUS, index * potSpec_1.RIM_DOT_STEP_DEG);
        parts.push(`<circle cx="${num(dot.x)}" cy="${num(dot.y)}" r="${num(potSpec_1.RIM_DOT_RADIUS)}" fill="${dotColor}"/>`);
    }
    parts.push(`</g>`);
    parts.push(`<circle cx="${num(potSpec_1.BODY_CENTER.x)}" cy="${num(potSpec_1.BODY_CENTER.y)}" r="${num(potSpec_1.WELL_RADIUS)}" fill="${wellFill}"/>`);
    parts.push(`<g id="pot-ticks">`);
    for (let index = 0; index < potSpec_1.TICK_COUNT; index += 1) {
        const inner = polar(potSpec_1.BODY_CENTER, potSpec_1.TICK_INNER_RADIUS, index * potSpec_1.TICK_ANGLE_STEP_DEG);
        const outer = polar(potSpec_1.BODY_CENTER, potSpec_1.TICK_OUTER_RADIUS, index * potSpec_1.TICK_ANGLE_STEP_DEG);
        parts.push(`<line x1="${num(inner.x)}" y1="${num(inner.y)}" x2="${num(outer.x)}" y2="${num(outer.y)}" stroke="${tickColor}" stroke-width="${num(potSpec_1.TICK_WIDTH)}" stroke-linecap="butt"/>`);
    }
    parts.push(`</g>`);
    const hull = pointerHullPoints(v);
    const hullPath = hull
        .map((point, index) => `${index === 0 ? "M" : "L"}${num(point.x)} ${num(point.y)}`)
        .join(" ") + " Z";
    parts.push(`<g id="pot-knob">`);
    parts.push(`<defs><radialGradient id="${gradientId}" gradientUnits="userSpaceOnUse" cx="${gradientCx}" cy="${gradientCy}" r="${gradientRadius}">` +
        `<stop offset="0" stop-color="${knobTop}" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="${knobFill}" stop-opacity="1"/>` +
        `</radialGradient></defs>`);
    parts.push(`<circle cx="${num(potSpec_1.BODY_CENTER.x)}" cy="${num(potSpec_1.BODY_CENTER.y)}" r="${num(potSpec_1.KNOB_RADIUS)}" fill="url(#${gradientId})" stroke="${knobRim}" stroke-width="${num(potSpec_1.KNOB_STROKE_WIDTH)}"/>`);
    if (!burnt) {
        const highlightX = num(potSpec_1.BODY_CENTER.x + potSpec_1.HIGHLIGHT_CENTER.x);
        const highlightY = num(potSpec_1.BODY_CENTER.y + potSpec_1.HIGHLIGHT_CENTER.y);
        parts.push(`<ellipse cx="${highlightX}" cy="${highlightY}" rx="${num(potSpec_1.HIGHLIGHT_RX)}" ry="${num(potSpec_1.HIGHLIGHT_RY)}" fill="#FFFFFF" fill-opacity="${num(potSpec_1.HIGHLIGHT_OPACITY)}" transform="rotate(${num(potSpec_1.HIGHLIGHT_ROTATION_DEG)} ${highlightX} ${highlightY})"/>`);
    }
    parts.push(`<path d="${hullPath}" fill="${pointerColor}"/>`);
    parts.push(`</g>`);
    if (showLabels) {
        parts.push(`<g id="pot-labels">`);
        const labelFill = tokens.labelBg;
        const labelText = tokens.labelText;
        const labelY = potSpec_1.BBOX.maxY + potSpec_1.LABEL_CHIP_GAP + potSpec_1.LABEL_CHIP_HEIGHT / 2;
        parts.push(chipMarkup(potSpec_1.ANCHOR_LEFT.x, labelY, potSpec_1.LABEL_CHIP_WIDTH, potSpec_1.LABEL_CHIP_HEIGHT, pinNames.left, labelFill, labelText, potSpec_1.LABEL_TEXT_SIZE));
        parts.push(chipMarkup(potSpec_1.ANCHOR_MIDDLE.x, labelY, potSpec_1.LABEL_CHIP_WIDTH, potSpec_1.LABEL_CHIP_HEIGHT, pinNames.middle, labelFill, labelText, potSpec_1.LABEL_TEXT_SIZE));
        parts.push(chipMarkup(potSpec_1.ANCHOR_RIGHT.x, labelY, potSpec_1.LABEL_CHIP_WIDTH, potSpec_1.LABEL_CHIP_HEIGHT, pinNames.right, labelFill, labelText, potSpec_1.LABEL_TEXT_SIZE));
        const valueParts = [];
        if (options.resistanceText !== undefined && options.resistanceText !== "") {
            valueParts.push(options.resistanceText);
        }
        valueParts.push(`${Math.round(v * 100)}%`);
        const valueY = potSpec_1.BODY_CENTER.y - potSpec_1.BODY_RADIUS - potSpec_1.VALUE_CHIP_GAP - potSpec_1.VALUE_CHIP_HEIGHT / 2;
        parts.push(chipMarkup(potSpec_1.BODY_CENTER.x, valueY, potSpec_1.VALUE_CHIP_WIDTH, potSpec_1.VALUE_CHIP_HEIGHT, valueParts.join("  "), labelFill, labelText, potSpec_1.VALUE_TEXT_SIZE));
        parts.push(`</g>`);
    }
    const minX = potSpec_1.BBOX.minX;
    const maxX = potSpec_1.BBOX.maxX;
    const minY = potSpec_1.BBOX.minY;
    const maxY = potSpec_1.BBOX.maxY;
    const width = maxX - minX;
    const height = maxY - minY;
    return (`<svg xmlns="${SVG_NS}" width="${num(width)}" height="${num(height)}" ` +
        `viewBox="${num(minX)} ${num(minY)} ${num(width)} ${num(height)}" ` +
        `overflow="visible" data-pot-pitch="${potSpec_1.DESIGN_UNITS_PER_PITCH}">` +
        parts.join("") +
        `</svg>`);
}

};
module.exports = __potRequire("./renderPotSvg");
});
