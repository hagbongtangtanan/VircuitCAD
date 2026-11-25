"use strict";

/**
 * Renders the standalone potentiometer module and checks it against the
 * brief: silhouette and detail contrast on five backgrounds, pixel geometry
 * (body, ticks, rim dots, legs, bounds) and the pointer angle sweep.
 *
 * Outputs:
 *   pot-new/out/sheet-<theme>-<background>.png   three values side by side
 *   pot-new/out/sheet-crop-400-<theme>.png       400 % crop of value 0.5
 *   reports/pot-check.json                       every measured number
 *
 * Usage: node scripts/pot-check.js
 */

const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "pot-new", "out");
const reportPath = path.join(root, "reports", "pot-check.json");
const backgroundReportPath = path.join(root, "reports", "pot-backgrounds.json");

const PX_PER_UNIT = 4;
const DENSITY = PX_PER_UNIT * 72;

const CANONICAL_BACKGROUNDS = [
  { name: "near-black", hex: "#050A14" },
  { name: "near-white", hex: "#EEF2F7" },
];

async function main() {
  const spec = await import(path.join(root, "pot-new", "src", "potSpec.ts"));
  const renderer = await import(path.join(root, "pot-new", "src", "renderPotSvg.ts"));

  let sampled = null;
  if (fs.existsSync(backgroundReportPath)) {
    sampled = JSON.parse(fs.readFileSync(backgroundReportPath, "utf8"));
  }
  const backgrounds = [
    ...CANONICAL_BACKGROUNDS,
    { name: "cream", hex: sampled ? sampled.dark.cream.hex : "#EFEBDD" },
    { name: "red-rail", hex: sampled ? sampled.dark.redRail.hex : "#D64545" },
    { name: "blue-rail", hex: sampled ? sampled.dark.blueRail.hex : "#2F6FD6" },
  ];
  const extraBackgrounds = sampled
    ? [
        { name: "red-rail-canonical", hex: "#D64545" },
        { name: "blue-rail-canonical", hex: "#2F6FD6" },
        { name: "cream-light", hex: "#EFEBDD" },
        { name: "cream-dark", hex: "#D8D5CC" },
      ]
    : [];

  fs.mkdirSync(outDir, { recursive: true });

  const renders = new Map();
  async function render(theme, value, burnt = false) {
    const key = `${theme}:${value}:${burnt}`;
    if (renders.has(key)) return renders.get(key);
    const svg = renderer.renderPotSvg({ value, theme, burnt, showLabels: false });
    const image = await sharp(Buffer.from(svg), { density: DENSITY })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const entry = { svg, ...image };
    renders.set(key, entry);
    return entry;
  }

  const rgb = (hex) => {
    const value = hex.replace("#", "");
    return [
      parseInt(value.slice(0, 2), 16),
      parseInt(value.slice(2, 4), 16),
      parseInt(value.slice(4, 6), 16),
    ];
  };
  const luminance = (color) => {
    const [r, g, b] = color.map((channel) => {
      const c = channel / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => {
    const la = luminance(a);
    const lb = luminance(b);
    const light = Math.max(la, lb);
    const dark = Math.min(la, lb);
    return (light + 0.05) / (dark + 0.05);
  };

  function analyse(image) {
    const { data, info } = image;
    const { width, height, channels } = info;
    const view = {
      minX: spec.BBOX.minX,
      minY: spec.BBOX.minY,
      maxX: spec.BBOX.maxX,
      maxY: spec.BBOX.maxY,
    };
    const toPxX = (unit) => (unit - view.minX) * PX_PER_UNIT;
    const toPxY = (unit) => (unit - view.minY) * PX_PER_UNIT;
    const toUnitX = (px) => view.minX + px / PX_PER_UNIT;
    const toUnitY = (py) => view.minY + py / PX_PER_UNIT;
    const at = (px, py) => {
      const index = (py * width + px) * channels;
      return [data[index], data[index + 1], data[index + 2], data[index + 3]];
    };
    const opaqueAt = (px, py) => {
      if (px < 0 || py < 0 || px >= width || py >= height) return null;
      const pixel = at(px, py);
      return pixel[3] > 250 ? pixel : null;
    };
    const nearestOpaque = (unitX, unitY) => {
      const px = Math.round(toPxX(unitX));
      const py = Math.round(toPxY(unitY));
      let best = null;
      for (let dy = -3; dy <= 3; dy += 1) {
        for (let dx = -3; dx <= 3; dx += 1) {
          const pixel = opaqueAt(px + dx, py + dy);
          if (!pixel) continue;
          const distance = Math.hypot(dx, dy);
          if (!best || distance < best.distance) best = { pixel, distance };
        }
      }
      return best ? best.pixel.slice(0, 3) : null;
    };
    const centre = { x: spec.BODY_CENTER.x, y: spec.BODY_CENTER.y };
    const polarPoint = (radius, angleDeg) => {
      const radians = (angleDeg * Math.PI) / 180;
      return {
        x: centre.x + Math.sin(radians) * radius,
        y: centre.y - Math.cos(radians) * radius,
      };
    };

    const alphaBox = () => {
      let minX = width;
      let maxX = -1;
      let minY = height;
      let maxY = -1;
      for (let py = 0; py < height; py += 1) {
        for (let px = 0; px < width; px += 1) {
          if (data[(py * width + px) * channels + 3] === 0) continue;
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
        }
      }
      return { minX, maxX, minY, maxY };
    };

    const columnMaxY = () => {
      const tops = new Array(width).fill(null);
      for (let px = 0; px < width; px += 1) {
        for (let py = height - 1; py >= 0; py -= 1) {
          if (data[(py * width + px) * channels + 3] > 0) {
            tops[px] = py;
            break;
          }
        }
      }
      return tops;
    };

    return {
      width,
      height,
      channels,
      data,
      view,
      toPxX,
      toPxY,
      toUnitX,
      toUnitY,
      at,
      opaqueAt,
      nearestOpaque,
      polarPoint,
      alphaBox,
      columnMaxY,
      centre,
    };
  }

  function paletteFor(theme) {
    const tokens = spec.tokensFor(theme);
    return [
      { name: "bodyOuter", color: rgb(tokens.bodyOuter) },
      { name: "bodyRim", color: rgb(tokens.bodyRim) },
      { name: "well", color: rgb(tokens.well) },
      { name: "tick", color: rgb(tokens.tick) },
      { name: "dots", color: rgb(tokens.dots) },
      { name: "knobTop", color: rgb(tokens.knobTop) },
      { name: "knobBottom", color: rgb(tokens.knobBottom) },
      { name: "knobRim", color: rgb(tokens.knobRim) },
      { name: "pointer", color: rgb(tokens.pointer) },
      { name: "tail", color: rgb(tokens.tail) },
      { name: "tailEdge", color: rgb(tokens.tailEdge) },
    ];
  }

  function classify(pixel, palette) {
    if (!pixel) return null;
    let best = null;
    for (const entry of palette) {
      const distance = Math.hypot(
        pixel[0] - entry.color[0],
        pixel[1] - entry.color[1],
        pixel[2] - entry.color[2],
      );
      if (!best || distance < best.distance) best = { name: entry.name, distance, color: entry.color };
    }
    return best.distance <= 40 ? best : null;
  }

  function countAngularMarks(image, palette, radius, wantedName) {
    const step = 0.25;
    const runs = [];
    let current = null;
    for (let angle = 0; angle < 360; angle += step) {
      const point = image.polarPoint(radius, angle);
      const pixel = image.nearestOpaque(point.x, point.y);
      const hit = classify(pixel, palette);
      const isMark = hit !== null && hit.name === wantedName;
      if (isMark) {
        if (!current) current = { start: angle, end: angle };
        else current.end = angle;
      } else if (current) {
        runs.push(current);
        current = null;
      }
    }
    if (current) runs.push(current);
    if (runs.length > 1) {
      const first = runs[0];
      const last = runs[runs.length - 1];
      if (first.start === 0 && last.end >= 360 - step - 0.01) {
        runs.pop();
        runs[0] = { start: last.start - 360, end: first.end };
      }
    }
    return runs;
  }

  function measureGeometry(image, palette) {
    const box = image.alphaBox();
    const bodyBottomLimitPx = Math.round(
      image.toPxY(spec.BODY_CENTER.y + spec.BODY_RADIUS + spec.BODY_STROKE_WIDTH / 2),
    );

    let bodyMinX = Infinity;
    let bodyMaxX = -Infinity;
    let bodyMinY = Infinity;
    let bodyMaxY = -Infinity;
    for (let px = 0; px < image.width; px += 1) {
      const unitX = image.toUnitX(px);
      let top = null;
      let bottom = null;
      for (let py = 0; py < image.height; py += 1) {
        if (image.data[(py * image.width + px) * image.channels + 3] === 0) continue;
        if (top === null) top = py;
        if (py <= bodyBottomLimitPx) bottom = py;
      }
      if (top === null) continue;
      const topY = image.toUnitY(top);
      const bottomY = bottom === null ? null : image.toUnitY(bottom);
      if (topY < bodyMinY) bodyMinY = topY;
      if (bottomY !== null && bottomY > bodyMaxY) bodyMaxY = bottomY;
      if (unitX < bodyMinX) bodyMinX = unitX;
      if (unitX > bodyMaxX) bodyMaxX = unitX;
    }

    let bodyBottom = -Infinity;
    for (let px = 0; px < image.width; px += 1) {
      for (let py = Math.min(bodyBottomLimitPx, image.height - 1); py >= 0; py -= 1) {
        if (image.data[(py * image.width + px) * image.channels + 3] > 0) {
          const unitY = image.toUnitY(py);
          if (unitY > bodyBottom) bodyBottom = unitY;
          break;
        }
      }
    }

    const tickRuns = countAngularMarks(image, palette, (spec.TICK_INNER_RADIUS + spec.TICK_OUTER_RADIUS) / 2, "tick");
    const dotRuns = countAngularMarks(image, palette, spec.RIM_DOT_ORBIT_RADIUS, "dots");

    const pointerPixels = [];
    for (let py = 0; py < image.height; py += 1) {
      for (let px = 0; px < image.width; px += 1) {
        const index = (py * image.width + px) * image.channels;
        if (image.data[index + 3] === 0) continue;
        const unitX = image.toUnitX(px);
        const unitY = image.toUnitY(py);
        const distance = Math.hypot(unitX - image.centre.x, unitY - image.centre.y);
        if (distance > 12) continue;
        const hit = classify([image.data[index], image.data[index + 1], image.data[index + 2]], palette);
        if (hit && hit.name === "pointer") pointerPixels.push({ unitX, unitY, distance });
      }
    }
    let pointer = null;
    if (pointerPixels.length > 0) {
      pointerPixels.sort((a, b) => b.distance - a.distance);
      const tip = pointerPixels[0];
      const tipRing = pointerPixels.filter((pixel) => pixel.distance >= tip.distance - 0.6);
      let sumX = 0;
      let sumY = 0;
      for (const pixel of tipRing) {
        const dx = pixel.unitX - image.centre.x;
        const dy = pixel.unitY - image.centre.y;
        const length = Math.hypot(dx, dy);
        if (length === 0) continue;
        sumX += dx / length;
        sumY += dy / length;
      }
      let angle = (Math.atan2(sumX, -sumY) * 180) / Math.PI;
      if (angle > 180) angle -= 360;
      pointer = { angleDeg: angle, pixels: pointerPixels.length, tipRadius: tip.distance };
    }

    const pinTargets = [
      { name: "left", point: spec.ANCHOR_LEFT },
      { name: "middle", point: spec.ANCHOR_MIDDLE },
      { name: "right", point: spec.ANCHOR_RIGHT },
    ];
    const pins = pinTargets.map((target) => {
      const px = Math.round(image.toPxX(target.point.x));
      const py = Math.round(image.toPxY(target.point.y));
      const pixel = image.opaqueAt(px, py);
      const dx = target.point.x - image.centre.x;
      const edgeY =
        image.centre.y + Math.sqrt(Math.max(0, spec.BODY_RADIUS * spec.BODY_RADIUS - dx * dx));
      const visibleTail = target.point.y - edgeY;
      return {
        name: target.name,
        x: target.point.x,
        y: target.point.y,
        covered: pixel !== null,
        visibleTail,
        tailLengthPass: Math.abs(visibleTail - spec.TAIL_LENGTH) <= 2.5,
        distanceFromCentre: Math.hypot(dx, target.point.y - image.centre.y),
      };
    });

    return {
      body: {
        diameter: bodyMaxX - bodyMinX,
        diameterStrokeCorrected: bodyMaxX - bodyMinX - spec.BODY_STROKE_WIDTH,
        centreX: (bodyMinX + bodyMaxX) / 2,
        centreY: (bodyMinY + bodyMaxY) / 2,
        lowestPixelY: bodyBottom,
        lowestPixelYStrokeCorrected: bodyBottom - spec.BODY_STROKE_WIDTH / 2,
      },
      pins,
      ticks: { count: tickRuns.length, runs: tickRuns.slice(0, 4) },
      rimDots: { count: dotRuns.length },
      pointer,
      opaqueBox: {
        minX: image.toUnitX(box.minX),
        maxX: image.toUnitX(box.maxX + 1),
        minY: image.toUnitY(box.minY),
        maxY: image.toUnitY(box.maxY + 1),
      },
    };
  }

  function measureContrast(image, palette, theme, backgroundHex) {
    const background = rgb(backgroundHex);
    const tokens = spec.tokensFor(theme);
    const bodyOuterPoint = image.polarPoint(spec.BODY_RADIUS - 1, 22.5);
    const bodyRimPoint = image.polarPoint(spec.BODY_RADIUS - 0.1, 22.5);
    const wellPoint = image.polarPoint(spec.WELL_RADIUS - 1, 3.75);
    const tickPoint = image.polarPoint((spec.TICK_INNER_RADIUS + spec.TICK_OUTER_RADIUS) / 2, 90);
    const knobPoint = image.polarPoint(spec.KNOB_RADIUS - 1, 180);
    const pointerPoint = image.polarPoint(spec.POINTER_TIP_DISTANCE - 1, 0);
    const tailPoint = { x: spec.ANCHOR_MIDDLE.x + 1, y: spec.TAIL_LENGTH / -2 };

    const bodyOuter = image.nearestOpaque(bodyOuterPoint.x, bodyOuterPoint.y);
    const bodyRim = image.nearestOpaque(bodyRimPoint.x, bodyRimPoint.y);
    const well = image.nearestOpaque(wellPoint.x, wellPoint.y);
    const tick = image.nearestOpaque(tickPoint.x, tickPoint.y);
    const knob = image.nearestOpaque(knobPoint.x, knobPoint.y);
    const pointer = image.nearestOpaque(pointerPoint.x, pointerPoint.y);
    const tail = image.nearestOpaque(tailPoint.x, tailPoint.y);

    const knobSamples = [];
    for (let angle = 150; angle <= 210; angle += 5) {
      for (const radius of [4, 5.5, 7, 8.5]) {
        const point = image.polarPoint(radius, angle);
        const pixel = image.nearestOpaque(point.x, point.y);
        if (pixel) knobSamples.push(pixel);
      }
    }
    const knobMean = knobSamples.length
      ? [0, 1, 2].map((channel) => knobSamples.reduce((sum, pixel) => sum + pixel[channel], 0) / knobSamples.length)
      : null;

    const ratios = {
      bodyOuterVsBackground: bodyOuter ? contrast(bodyOuter, background) : null,
      bodyRimVsBackground: bodyRim ? contrast(bodyRim, background) : null,
      pointerVsKnob: pointer && knobMean ? contrast(pointer, knobMean) : null,
      tickVsWell: tick && well ? contrast(tick, well) : null,
      knobMeanVsWell: knobMean && well ? contrast(knobMean, well) : null,
      tailVsBody: tail && bodyOuter ? contrast(tail, bodyOuter) : null,
      tailVsBackground: tail ? contrast(tail, background) : null,
    };
    const silhouette = Math.max(ratios.bodyOuterVsBackground ?? 0, ratios.bodyRimVsBackground ?? 0);
    return {
      background: backgroundHex,
      sampled: {
        bodyOuter: bodyOuter ? `#${bodyOuter.map((v) => v.toString(16).padStart(2, "0")).join("")}` : null,
        bodyRim: bodyRim ? `#${bodyRim.map((v) => v.toString(16).padStart(2, "0")).join("")}` : null,
        well: well ? `#${well.map((v) => v.toString(16).padStart(2, "0")).join("")}` : null,
        tick: tick ? `#${tick.map((v) => v.toString(16).padStart(2, "0")).join("")}` : null,
        knobMean: knobMean
          ? `#${knobMean.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`
          : null,
        pointer: pointer ? `#${pointer.map((v) => v.toString(16).padStart(2, "0")).join("")}` : null,
      },
      ratios,
      silhouetteBest: silhouette,
      pass: {
        silhouette: silhouette >= 3,
        pointerVsKnob: (ratios.pointerVsKnob ?? 0) >= 4.5,
        tickVsWell: (ratios.tickVsWell ?? 0) >= 4.5,
        knobMeanVsWell: (ratios.knobMeanVsWell ?? 0) >= 3,
        tailVsBody: (ratios.tailVsBody ?? 0) >= 3,
      },
      tokens: {
        bodyOuter: tokens.bodyOuter,
        bodyRim: tokens.bodyRim,
        well: tokens.well,
        tick: tokens.tick,
        pointer: tokens.pointer,
      },
    };
  }

  const report = {
    generatedAt: new Date().toISOString(),
    pxPerUnit: PX_PER_UNIT,
    backgroundSource: sampled ? "reports/pot-backgrounds.json (live app canvas pixels)" : "fallback constants",
    backgrounds: backgrounds.map((entry) => entry.name),
    extraBackgrounds: extraBackgrounds.map((entry) => entry.name),
    contrast: {},
    extraContrast: {},
    geometry: {},
    pointerSweep: {},
    sheets: [],
  };

  for (const theme of ["dark", "light"]) {
    const palette = paletteFor(theme);
    const image = analyse(await render(theme, 0.5));
    const geometry = measureGeometry(image, palette);
    report.geometry[theme] = geometry;

    const pointerSweep = [];
    for (const value of [0, 0.25, 0.5, 0.75, 1]) {
      const sweepImage = analyse(await render(theme, value));
      const sweepPalette = paletteFor(theme);
      const measured = measureGeometry(sweepImage, sweepPalette);
      const expected = renderer.pointerAngleDeg(value);
      pointerSweep.push({
        value,
        expectedDeg: expected,
        measuredDeg: measured.pointer ? measured.pointer.angleDeg : null,
        deltaDeg: measured.pointer ? Math.abs(measured.pointer.angleDeg - expected) : null,
        pass: measured.pointer ? Math.abs(measured.pointer.angleDeg - expected) <= 2 : false,
      });
    }
    report.pointerSweep[theme] = pointerSweep;

    for (const background of [...backgrounds, ...extraBackgrounds]) {
      const key = `${theme}/${background.name}`;
      const measured = measureContrast(image, palette, theme, background.hex);
      if (extraBackgrounds.includes(background)) report.extraContrast[key] = measured;
      else report.contrast[key] = measured;
    }
  }

  const geometryChecks = (theme) => {
    const geometry = report.geometry[theme];
    const sweep = report.pointerSweep[theme];
    const pinResults = geometry.pins.map((pin) => ({
      name: pin.name,
      x: pin.x,
      y: pin.y,
      covered: pin.covered,
      visibleTail: pin.visibleTail,
      tailLengthPass: pin.tailLengthPass,
      pass: pin.covered && pin.tailLengthPass,
    }));
    return {
      bodyDiameter: {
        measured: geometry.body.diameterStrokeCorrected,
        target: spec.BODY_RADIUS * 2,
        pass: Math.abs(geometry.body.diameterStrokeCorrected - spec.BODY_RADIUS * 2) <= 1,
      },
      bodyCentre: {
        measuredX: geometry.body.centreX,
        measuredY: geometry.body.centreY,
        targetX: spec.BODY_CENTER.x,
        targetY: spec.BODY_CENTER.y,
        pass:
          Math.abs(geometry.body.centreX - spec.BODY_CENTER.x) <= 1 &&
          Math.abs(geometry.body.centreY - spec.BODY_CENTER.y) <= 1,
      },
      lowestBodyPixel: {
        measured: geometry.body.lowestPixelYStrokeCorrected,
        target: spec.BODY_CENTER.y + spec.BODY_RADIUS,
        pass:
          Math.abs(
            geometry.body.lowestPixelYStrokeCorrected - (spec.BODY_CENTER.y + spec.BODY_RADIUS),
          ) <= 1,
      },
      tickCount: { measured: geometry.ticks.count, target: spec.TICK_COUNT, pass: geometry.ticks.count === spec.TICK_COUNT },
      rimDotCount: {
        measured: geometry.rimDots.count,
        target: spec.RIM_DOT_COUNT,
        pass: geometry.rimDots.count === spec.RIM_DOT_COUNT,
      },
      pins: pinResults,
      opaqueBox: {
        measured: geometry.opaqueBox,
        target: {
          minX: spec.BBOX.minX,
          maxX: spec.BBOX.maxX,
          minY: spec.BBOX.minY,
          maxY: spec.BBOX.maxY,
        },
        pass:
          Math.abs(geometry.opaqueBox.minX - spec.BBOX.minX) <= 1 &&
          Math.abs(geometry.opaqueBox.maxX - spec.BBOX.maxX) <= 1 &&
          Math.abs(geometry.opaqueBox.minY - spec.BBOX.minY) <= 1 &&
          Math.abs(geometry.opaqueBox.maxY - spec.BBOX.maxY) <= 1,
      },
      pointerSweep: {
        values: sweep.map((entry) => ({
          value: entry.value,
          expectedDeg: entry.expectedDeg,
          measuredDeg: entry.measuredDeg,
          deltaDeg: entry.deltaDeg,
          pass: entry.pass,
        })),
        pass: sweep.every((entry) => entry.pass),
      },
    };
  };

  report.geometryChecks = { dark: geometryChecks("dark"), light: geometryChecks("light") };

  for (const theme of ["dark", "light"]) {
    for (const background of backgrounds) {
      const sheetName = `sheet-${theme}-${background.name}.png`;
      const sheetPath = path.join(outDir, sheetName);
      const pots = [];
      for (const value of [0, 0.5, 1]) {
        const image = await render(theme, value);
        pots.push({
          value,
          buffer: await sharp(image.data, { raw: { width: image.info.width, height: image.info.height, channels: image.info.channels } })
            .png()
            .toBuffer(),
        });
      }
      const potWidth = pots[0].buffer ? (await sharp(pots[0].buffer).metadata()).width : 0;
      const potHeight = (await sharp(pots[0].buffer).metadata()).height;
      const gap = 20;
      const margin = 20;
      const width = margin * 2 + potWidth * 3 + gap * 2;
      const height = margin * 2 + potHeight;
      const composite = pots.map((pot, index) => ({
        input: pot.buffer,
        left: margin + index * (potWidth + gap),
        top: margin,
      }));
      await sharp({
        create: { width, height, channels: 4, background: rgb(background.hex) },
      })
        .composite(composite)
        .png()
        .toFile(sheetPath);
      report.sheets.push(path.relative(root, sheetPath).split(path.sep).join("/"));
    }

    const cropName = `sheet-crop-400-${theme}.png`;
    const cropPath = path.join(outDir, cropName);
    const image = await render(theme, 0.5);
    const raw = sharp(image.data, { raw: { width: image.info.width, height: image.info.height, channels: image.info.channels } });
    const cropLeft = Math.round((-12 - spec.BBOX.minX) * PX_PER_UNIT);
    const cropTop = Math.round((spec.BODY_CENTER.y - 12 - spec.BBOX.minY) * PX_PER_UNIT);
    await raw
      .extract({ left: cropLeft, top: cropTop, width: 24 * PX_PER_UNIT, height: 24 * PX_PER_UNIT })
      .resize(24 * PX_PER_UNIT * 4, 24 * PX_PER_UNIT * 4, { kernel: "nearest" })
      .flatten({ background: "#050A14" })
      .png()
      .toFile(cropPath);
    report.sheets.push(path.relative(root, cropPath).split(path.sep).join("/"));
  }

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log("contrast checks");
  console.log("theme/background            silhouette  pointer  tick  knob   result");
  for (const [key, entry] of Object.entries({ ...report.contrast, ...report.extraContrast })) {
    const allPass = Object.values(entry.pass).every(Boolean);
    console.log(
      `${key.padEnd(28)} ${entry.ratios.bodyRimVsBackground.toFixed(2).padStart(6)}/${entry.ratios.bodyOuterVsBackground
        .toFixed(2)
        .padStart(6)} ${entry.ratios.pointerVsKnob.toFixed(2).padStart(7)} ${entry.ratios.tickVsWell
        .toFixed(2)
        .padStart(5)} ${entry.ratios.knobMeanVsWell.toFixed(2).padStart(5)}  ${allPass ? "PASS" : "FAIL"}`,
    );
  }
  console.log("");
  console.log("geometry checks");
  for (const theme of ["dark", "light"]) {
    const checks = report.geometryChecks[theme];
    const rows = [
      [
        "body diameter",
        `${checks.bodyDiameter.measured.toFixed(2)} (target ${checks.bodyDiameter.target})`,
        checks.bodyDiameter.pass,
      ],
      [
        "body centre",
        `${checks.bodyCentre.measuredX.toFixed(2)}, ${checks.bodyCentre.measuredY.toFixed(2)} (target ${checks.bodyCentre.targetX}, ${checks.bodyCentre.targetY})`,
        checks.bodyCentre.pass,
      ],
      [
        "lowest body px",
        `${checks.lowestBodyPixel.measured.toFixed(2)} (target ${checks.lowestBodyPixel.target})`,
        checks.lowestBodyPixel.pass,
      ],
      ["tick count", `${checks.tickCount.measured} (target ${checks.tickCount.target})`, checks.tickCount.pass],
      [
        "rim dot count",
        `${checks.rimDotCount.measured} (target ${checks.rimDotCount.target})`,
        checks.rimDotCount.pass,
      ],
      [
        "tails at pins",
        checks.pins
          .map((pin) => `${pin.name} ${pin.covered ? "reached" : "OPEN"} len=${pin.visibleTail.toFixed(2)}`)
          .join(" | "),
        checks.pins.every((pin) => pin.pass),
      ],
      [
        "opaque box",
        `x ${checks.opaqueBox.measured.minX.toFixed(2)}..${checks.opaqueBox.measured.maxX.toFixed(2)} y ${checks.opaqueBox.measured.minY.toFixed(2)}..${checks.opaqueBox.measured.maxY.toFixed(2)}`,
        checks.opaqueBox.pass,
      ],
      [
        "pointer sweep",
        checks.pointerSweep.values.map((entry) => `${entry.value}:${entry.measuredDeg.toFixed(1)}/${entry.expectedDeg}`).join(" "),
        checks.pointerSweep.pass,
      ],
    ];
    for (const [name, value, pass] of rows) {
      console.log(`${theme.padEnd(6)} ${name.padEnd(16)} ${String(value).padEnd(64)} ${pass ? "PASS" : "FAIL"}`);
    }
  }
  console.log("");
  for (const sheet of report.sheets) console.log(`sheet ${sheet}`);
  console.log(`report ${path.relative(root, reportPath)}`);
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
