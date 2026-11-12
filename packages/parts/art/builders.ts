import type { PartManifest } from '@vircuitcad/core';

import { circle, line, polyline, rect, text, type ArtColor, type ArtPrimitive, type Footprint } from './dsl';
import { ART_UNIT, LED_COLORS, PALETTE, RESISTOR_BANDS } from './palette';

export type ArtBody = { body: ArtColor; primitives: ArtPrimitive[] };
export type ArtBuilder = (manifest: PartManifest, footprint: Footprint) => ArtBody;

const OUTLINE = PALETTE.outline;

function panel(
  width: number,
  height: number,
  fill: ArtColor,
  radius = 4,
): ArtPrimitive {
  return rect(0, 0, width, height, fill, { radius, stroke: OUTLINE, strokeWidth: 1 });
}

function resistorLike(bands: readonly string[]): ArtBuilder {
  return (_manifest, footprint) => {
    const { width: w, height: h } = footprint;
    const bandWidth = Math.max(2, w * 0.08);
    const primitives: ArtPrimitive[] = [panel(w, h, PALETTE.resistorBody)];
    bands.forEach((color, index) => {
      primitives.push(rect(w * 0.3 + index * bandWidth * 1.8, 2, bandWidth, h - 4, color));
    });
    return { body: PALETTE.resistorBody, primitives };
  };
}

const buildResistor = resistorLike(RESISTOR_BANDS);

const buildLdr: ArtBuilder = (_manifest, footprint) => {
  const { width: w, height: h } = footprint;
  const base = buildResistor(_manifest, footprint);
  return {
    body: base.body,
    primitives: [
      ...base.primitives,
      line(w * 0.35, h * 0.1, w * 0.2, h * 0.35, OUTLINE, 1.5),
      line(w * 0.5, h * 0.1, w * 0.35, h * 0.35, OUTLINE, 1.5),
    ],
  };
};

const buildNtc: ArtBuilder = (_manifest, footprint) => {
  const { width: w, height: h } = footprint;
  const base = buildResistor(_manifest, footprint);
  return {
    body: base.body,
    primitives: [...base.primitives, line(w * 0.2, h, w * 0.5, 0, OUTLINE, 1.5)],
  };
};

const buildLed: ArtBuilder = (_manifest, footprint) => {
  const { width: w, height: h } = footprint;
  const radius = Math.min(w, h) * 0.4;
  return {
    body: LED_COLORS.red,
    primitives: [
      rect(0, h * 0.55, w, h * 0.45, PALETTE.metal, { radius: 3, stroke: OUTLINE, strokeWidth: 1 }),
      circle(w / 2, h * 0.45, radius, LED_COLORS.red, { stroke: OUTLINE, strokeWidth: 1 }),
    ],
  };
};

const buildRgbLed: ArtBuilder = (_manifest, footprint) => {
  const { width: w, height: h } = footprint;
  const radius = Math.min(w, h) * 0.2;
  const colors = [LED_COLORS.red, LED_COLORS.green, LED_COLORS.blue];
  return {
    body: LED_COLORS.red,
    primitives: [
      rect(0, h * 0.6, w, h * 0.4, PALETTE.metal, { radius: 3, stroke: OUTLINE, strokeWidth: 1 }),
      ...colors.map((color, index) =>
        circle((w * (index + 1)) / 4, h * 0.5, radius, color, { stroke: OUTLINE, strokeWidth: 1 }),
      ),
    ],
  };
};

const buildLedBar: ArtBuilder = (_manifest, footprint) => {
  const { width: w, height: h } = footprint;
  const radius = Math.min(w, h) * 0.14;
  const colors = [
    LED_COLORS.green,
    LED_COLORS.green,
    LED_COLORS.yellow,
    LED_COLORS.red,
    LED_COLORS.red,
  ];
  return {
    body: LED_COLORS.red,
    primitives: [
      rect(0, h * 0.6, w, h * 0.4, PALETTE.metal, { radius: 3, stroke: OUTLINE, strokeWidth: 1 }),
      ...colors.map((color, index) =>
        circle((w * (index + 1)) / 6, h * 0.5, radius, color, { stroke: OUTLINE, strokeWidth: 1 }),
      ),
    ],
  };
};

const buildBattery: ArtBuilder = (_manifest, footprint) => {
  const { width: w, height: h } = footprint;
  return {
    body: PALETTE.sourceBody,
    primitives: [
      panel(w, h, PALETTE.sourceBody, 3),
      rect(w * 0.06, h * 0.25, w * 0.12, h * 0.5, PALETTE.metal),
      rect(w * 0.8, h * 0.38, w * 0.14, h * 0.24, '#f59e0b'),
      text(w * 0.24, h * 0.66, '+', PALETTE.text, 12),
    ],
  };
};

const buildBatteryPack: ArtBuilder = (_manifest, footprint) => {
  const { width: w, height: h } = footprint;
  const lines: ArtPrimitive[] = [];
  for (let index = 1; index < 3; index += 1) {
    lines.push(line((w * index) / 3, h * 0.15, (w * index) / 3, h * 0.85, OUTLINE, 1.5));
  }
  return {
    body: PALETTE.sourceBody,
    primitives: [panel(w, h, PALETTE.sourceBody, 3), ...lines],
  };
};

const buildPowerSupply: ArtBuilder = (_manifest, footprint) => {
  const { width: w, height: h } = footprint;
  return {
    body: PALETTE.sourceBody,
    primitives: [
      panel(w, h, PALETTE.sourceBody, 4),
      rect(w * 0.6, h * 0.2, w * 0.32, h * 0.6, PALETTE.displayBody, { radius: 2 }),
      circle(w * 0.25, h * 0.5, Math.min(w, h) * 0.16, PALETTE.metal, { stroke: OUTLINE, strokeWidth: 1 }),
    ],
  };
};

const buildCapacitor: ArtBuilder = (_manifest, footprint) => {
  const { width: w, height: h } = footprint;
  return {
    body: PALETTE.capacitorBody,
    primitives: [
      panel(w, h, PALETTE.capacitorBody, 3),
      rect(w / 2 - 5, 0, 3, h, OUTLINE),
      rect(w / 2 + 2, 0, 3, h, OUTLINE),
    ],
  };
};

const buildInductor: ArtBuilder = (_manifest, footprint) => {
  const { width: w, height: h } = footprint;
  return {
    body: PALETTE.inductorBody,
    primitives: [
      panel(w, h, PALETTE.inductorBody, 3),
      polyline(
        [
          { x: w * 0.2, y: h * 0.7 },
          { x: w * 0.35, y: h * 0.3 },
          { x: w * 0.5, y: h * 0.7 },
          { x: w * 0.65, y: h * 0.3 },
          { x: w * 0.8, y: h * 0.7 },
        ],
        OUTLINE,
        1.5,
      ),
    ],
  };
};

const buildPushbutton: ArtBuilder = (_manifest, footprint) => {
  const { width: w, height: h } = footprint;
  return {
    body: PALETTE.switchBody,
    primitives: [
      panel(w, h, PALETTE.switchBody, 3),
      circle(w / 2, h / 2, Math.min(w, h) * 0.28, '#e2e8f0', { stroke: OUTLINE, strokeWidth: 1 }),
    ],
  };
};

const buildSlideSwitch: ArtBuilder = (_manifest, footprint) => {
  const { width: w, height: h } = footprint;
  return {
    body: PALETTE.switchBody,
    primitives: [
      panel(w, h, PALETTE.switchBody, 3),
      rect(w * 0.15, h * 0.28, w * 0.3, h * 0.44, '#e2e8f0', { radius: 2, stroke: OUTLINE, strokeWidth: 1 }),
    ],
  };
};

const buildMultimeter: ArtBuilder = (_manifest, footprint) => {
  const { width: w, height: h } = footprint;
  return {
    body: PALETTE.metal,
    primitives: [
      panel(w, h, PALETTE.metal, 4),
      rect(w * 0.1, h * 0.15, w * 0.8, h * 0.4, '#0f6f5c', { radius: 2, stroke: OUTLINE, strokeWidth: 1 }),
      circle(w * 0.5, h * 0.78, Math.min(w, h) * 0.12, PALETTE.displayBody, { stroke: OUTLINE, strokeWidth: 1 }),
    ],
  };
};

const buildSevenSegment: ArtBuilder = (_manifest, footprint) => {
  const { width: w, height: h } = footprint;
  const segments: ArtPrimitive[] = [
    rect(w * 0.2, h * 0.1, w * 0.3, 3, PALETTE.segment),
    rect(w * 0.2, h * 0.45, w * 0.3, 3, PALETTE.segment),
    rect(w * 0.2, h * 0.8, w * 0.3, 3, PALETTE.segment),
    rect(w * 0.2, h * 0.2, 3, h * 0.25, PALETTE.segment),
    rect(w * 0.47, h * 0.2, 3, h * 0.25, PALETTE.segment),
    rect(w * 0.2, h * 0.55, 3, h * 0.25, PALETTE.segment),
    rect(w * 0.47, h * 0.55, 3, h * 0.25, PALETTE.segment),
  ];
  return {
    body: PALETTE.metal,
    primitives: [
      panel(w, h, PALETTE.metal, 4),
      rect(w * 0.15, h * 0.05, w * 0.7, h * 0.9, PALETTE.displayBody, { radius: 3 }),
      ...segments,
      rect(w * 0.6, h * 0.85, 4, 4, PALETTE.segment),
    ],
  };
};

const buildArduinoUno: ArtBuilder = (manifest, footprint) => {
  const { width: w, height: h } = footprint;
  const primitives: ArtPrimitive[] = [
    panel(w, h, PALETTE.board, 5),
    rect(0, h * 0.36, w * 0.12, h * 0.28, PALETTE.metal, { radius: 2, stroke: OUTLINE, strokeWidth: 1 }),
    rect(w * 0.86, h * 0.36, w * 0.14, h * 0.28, '#1f2937', { radius: 2, stroke: OUTLINE, strokeWidth: 1 }),
    rect(w * 0.4, h * 0.26, w * 0.22, h * 0.5, PALETTE.boardDark, { radius: 2, stroke: OUTLINE, strokeWidth: 1 }),
    circle(w * 0.52, h * 0.72, Math.min(w, h) * 0.05, '#f59e0b', { stroke: OUTLINE, strokeWidth: 1 }),
  ];

  for (const pin of manifest.pins) {
    const x = (pin.position.x - footprint.minX) * ART_UNIT;
    const y = (pin.position.y - footprint.minY) * ART_UNIT;
    const labelY = pin.position.y === 0 ? y + ART_UNIT * 0.62 : y - ART_UNIT * 0.3;
    primitives.push(text(x, labelY, pin.name, PALETTE.text, 8, 'middle'));
  }

  return { body: PALETTE.board, primitives };
};

/** Builders keyed by sim model. A manifest with no builder gets a fallback card. */
export const ART_BUILDERS: Record<string, ArtBuilder> = {
  resistor: buildResistor,
  ldr: buildLdr,
  ntc: buildNtc,
  led: buildLed,
  'rgb-led': buildRgbLed,
  'led-bar': buildLedBar,
  battery: buildBattery,
  'battery-pack': buildBatteryPack,
  'power-supply': buildPowerSupply,
  capacitor: buildCapacitor,
  inductor: buildInductor,
  pushbutton: buildPushbutton,
  'slide-switch': buildSlideSwitch,
  multimeter: buildMultimeter,
  'seven-segment': buildSevenSegment,
  'arduino-uno': buildArduinoUno,
};
