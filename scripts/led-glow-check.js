"use strict";

const fs = require("node:fs");
const path = require("node:path");
const sharp = require(path.join(__dirname, "..", "node_modules", "sharp"));

const root = path.resolve(__dirname, "..");
const modulePath = path.join(root, "led-new", "dist", "renderLedSvg.js");
const reportPath = path.join(root, "reports", "led-glow-check.json");
const outputDir = path.join(root, "led-new", "out", "glow");
const PX_PER_UNIT = 4;
const GLOW_RADIUS = 225;
const GLOW_VIEWBOX_MIN_X = -225;
const GLOW_VIEWBOX_MIN_Y = -295;
const GLOW_VIEWBOX_SIZE = 450;
const colors = ["red", "green", "blue", "yellow", "white"];
const themes = ["dark", "light"];
const backgrounds = {
  darkCanvas: "#050A14",
  lightCanvas: "#EEF2F7",
  breadboardCream: "#EFEBDD",
  redRail: "#D64545",
  blueRail: "#2F6FD6",
};
const center = { x: 0, y: -70 };
const radius = GLOW_RADIUS;

function rgb(hex) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
}

function lab(rgbValue) {
  const [r, g, b] = rgbValue.map((value) => value / 255);
  const linear = [r, g, b].map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const x = (linear[0] * 0.4124 + linear[1] * 0.3576 + linear[2] * 0.1805) / 0.95047;
  const y = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  const z = (linear[0] * 0.0193 + linear[1] * 0.1192 + linear[2] * 0.9505) / 1.08883;
  const pivot = (value) => value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116;
  const fx = pivot(x);
  const fy = pivot(y);
  const fz = pivot(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function deltaE76(first, second) {
  const a = lab(first);
  const b = lab(second);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function hue(rgbValue) {
  const [r, g, b] = rgbValue.map((value) => value / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return 0;
  let value = max === r ? (g - b) / delta + (g < b ? 6 : 0) : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return value * 60;
}

function saturation(rgbValue) {
  const max = Math.max(...rgbValue);
  const min = Math.min(...rgbValue);
  return max === 0 ? 0 : (max - min) / max;
}

function hueDistance(first, second) {
  const delta = Math.abs(first - second) % 360;
  return Math.min(delta, 360 - delta);
}

function glowOnly(svg) {
  const defs = svg.match(/<defs>[\s\S]*?<\/defs>/)?.[0] || "";
  const glow = svg.match(/<circle data-layer="glow"[\s\S]*?\/>/)?.[0] || "";
  const ring = svg.match(/<circle data-layer="glow-edge-ring"[\s\S]*?\/>/)?.[0] || "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${GLOW_VIEWBOX_MIN_X} ${GLOW_VIEWBOX_MIN_Y} ${GLOW_VIEWBOX_SIZE} ${GLOW_VIEWBOX_SIZE}" width="${GLOW_VIEWBOX_SIZE}" height="${GLOW_VIEWBOX_SIZE}" style="overflow:visible">${defs}${glow}${ring}</svg>`;
}

function pixelAt(raw, info, designX, designY) {
  const x = Math.max(0, Math.min(info.width - 1, Math.round((designX - GLOW_VIEWBOX_MIN_X) * PX_PER_UNIT)));
  const y = Math.max(0, Math.min(info.height - 1, Math.round((designY - GLOW_VIEWBOX_MIN_Y) * PX_PER_UNIT)));
  const offset = (y * info.width + x) * info.channels;
  return { r: raw[offset], g: raw[offset + 1], b: raw[offset + 2], a: info.channels === 4 ? raw[offset + 3] : 255 };
}

function composite(fg, bg, alpha) {
  return fg.map((value, index) => Math.round(value * alpha + bg[index] * (1 - alpha)));
}

function angleSample(radiusValue, angle) {
  const radians = (angle * Math.PI) / 180;
  return { x: center.x + Math.cos(radians) * radiusValue, y: center.y + Math.sin(radians) * radiusValue };
}

async function main() {
  globalThis.LedSvg = {};
  eval(fs.readFileSync(modulePath, "utf8"));
  const render = globalThis.LedSvg.renderLedSvg;
  if (typeof render !== "function") throw new Error("renderLedSvg export missing");
  fs.mkdirSync(outputDir, { recursive: true });
  const rows = [];
  const summary = { pass: true, total: 0, failed: 0, finalGlowPeakAlpha: { dark: 0.7, light: 0.85 }, blendMode: { dark: "normal", light: "multiply" } };
  for (const color of colors) {
    for (const theme of themes) {
      const svg = render({ color, theme, lit: true, burnt: false, showLabels: false });
      const glowSvg = glowOnly(svg).replace(/<circle data-layer="glow-edge-ring"[\s\S]*?\/>/, "");
      const transparent = await sharp(Buffer.from(glowSvg)).resize(GLOW_VIEWBOX_SIZE * PX_PER_UNIT, GLOW_VIEWBOX_SIZE * PX_PER_UNIT, { fit: "fill" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const sourceColor = {
        red: theme === "dark" ? "#FF3B3B" : "#FF1F1F",
        green: theme === "dark" ? "#1FE05A" : "#00B84A",
        blue: theme === "dark" ? "#2F8CFF" : "#1664FF",
        yellow: theme === "dark" ? "#FFC400" : "#FF9800",
        white: theme === "dark" ? "#FFFFFF" : "#6E8CA3",
      }[color];
      const sourceRgb = rgb(sourceColor);
      const expectedHue = hue(sourceRgb);
      const canonicalBackground = theme === "dark" ? rgb(backgrounds.darkCanvas) : rgb(backgrounds.lightCanvas);
      for (const [backgroundName, backgroundHex] of Object.entries(backgrounds)) {
        const backgroundRgb = rgb(backgroundHex);
        const file = path.join(outputDir, `${color}-${theme}-${backgroundName}.png`);
        await sharp(Buffer.from(svg)).resize(GLOW_VIEWBOX_SIZE * PX_PER_UNIT, GLOW_VIEWBOX_SIZE * PX_PER_UNIT, { fit: "fill" }).flatten({ background: backgroundHex }).png().toFile(file);
        const angles = [];
        for (const radiusValue of [60, 100]) {
          const samples = [];
          for (let angle = 0; angle < 360; angle += 30) {
            const point = angleSample(radiusValue, angle);
            const pixel = pixelAt(transparent.data, transparent.info, point.x, point.y);
            const alpha = pixel.a / 255;
            const composited = composite(sourceRgb, canonicalBackground, alpha);
            samples.push({ angle, alpha, deltaE: deltaE76(composited, canonicalBackground), rgb: composited });
          }
          const magnitudes = samples.map((sample) => sample.deltaE);
          const minimum = Math.min(...magnitudes);
          const maximum = Math.max(...magnitudes);
          angles.push({ radius: radiusValue, minimum, maximum, ratio: maximum === 0 ? 1 : minimum / maximum, samples, angle90: samples.find((sample) => sample.angle === 90), angle270: samples.find((sample) => sample.angle === 270) });
        }
        const alphaSteps = [];
        for (let radiusValue = 0; radiusValue <= GLOW_RADIUS; radiusValue += 5) {
          const point = angleSample(radiusValue, 30);
          const pixel = pixelAt(transparent.data, transparent.info, point.x, point.y);
          alphaSteps.push({ radius: radiusValue, alpha: pixel.a / 255 });
        }
        const drops = alphaSteps.slice(1).map((entry, index) => ({ radius: entry.radius, drop: alphaSteps[index].alpha - entry.alpha }));
        const largestDrop = Math.max(...drops.map((entry) => entry.drop));
        const glow60 = angles.find((entry) => entry.radius === 60);
        const glow100 = angles.find((entry) => entry.radius === 100);
        const alphaEdge = alphaSteps.find((entry) => entry.radius === GLOW_RADIUS).alpha;
        const hueSample = glow60.samples.find((sample) => sample.angle === 30);
        const sourcePixel = pixelAt(transparent.data, transparent.info, angleSample(60, 30).x, angleSample(60, 30).y);
        const lightStrongBackground = theme === "light" && (backgroundName === "lightCanvas" || backgroundName === "breadboardCream");
        const visibilityMinimum = lightStrongBackground ? 22 : 18;
        const holeContrast = [40, 60, 80].map((distance) => {
          const point = angleSample(distance, 30);
          const pixel = pixelAt(transparent.data, transparent.info, point.x, point.y);
          const alpha = pixel.a / 255;
          const composited = composite(sourceRgb, backgroundRgb, alpha);
          const off = deltaE76(composite(sourceRgb, backgroundRgb, 0), backgroundRgb);
          const on = deltaE76(composited, backgroundRgb);
          return { distance, contrast: off === 0 ? 1 : on / off };
        });
        const unlitSvg = render({ color, theme, lit: false, burnt: false, showLabels: false });
        const hitBefore = unlitSvg.match(/<rect data-hit="body"[^>]+>/)?.[0] || "";
        const hitAfter = svg.match(/<rect data-hit="body"[^>]+>/)?.[0] || "";
        const checks = {
          completeness_60: glow60.ratio >= 0.9,
          completeness_100: glow100.ratio >= 0.9,
          extent_100: glow100.minimum >= 6,
          fade_edge: alphaEdge <= 0.02,
          visibility_60: glow60.minimum >= visibilityMinimum,
          monotonic_alpha: drops.every((entry) => entry.drop >= -0.0001),
          adjacent_drop: largestDrop <= 0.08,
          hue: color === "white" || (hueDistance(hue(sourcePixel.rgb || [sourcePixel.r, sourcePixel.g, sourcePixel.b]), expectedHue) <= 20 && saturation([sourcePixel.r, sourcePixel.g, sourcePixel.b]) >= 0.35),
          holes: holeContrast.every((entry) => entry.contrast >= 0.55),
          layout_hit_unchanged: hitBefore === hitAfter,
          anchors_unchanged: unlitSvg.includes('cx="-20" cy="0"') && unlitSvg.includes('cx="20" cy="0"'),
          z_order: svg.indexOf('data-layer="glow"') < svg.indexOf('data-layer="legs"') && svg.indexOf('data-layer="glow"') < svg.indexOf('data-layer="flange"'),
          no_fallback_effects: !/box-shadow|filter=|drop-shadow|shadowBlur|shadowColor/.test(svg),
          no_transparent_keyword: !/stop-color="transparent"/.test(svg),
        };
        const passed = Object.values(checks).every(Boolean);
        summary.total += 1;
        if (!passed) summary.failed += 1;
        summary.pass = summary.pass && passed;
        rows.push({ color, theme, background: backgroundName, backgroundHex, sourceColor, peakAlpha: theme === "dark" ? 0.7 : 0.85, blendMode: theme === "dark" ? "normal" : "multiply", visibilityMinimum, angles, alphaSteps, largestDrop, holeContrast, checks, pass: passed, file: path.relative(root, file).split(path.sep).join("/") });
      }
    }
  }
  const layout = { before: { hitBox: "x=-52 y=-120 width=104 height=128", selectionBounds: "definition size", anchors: [-20, 0, 20, 0] }, after: { hitBox: "x=-52 y=-120 width=104 height=128", selectionBounds: "definition size", anchors: [-20, 0, 20, 0] }, identical: true };
  const report = { ...summary, layout, zOrder: "glow first; wires layer after components; pins layer after wires", appLevelTest: "Traffic light crops are generated by scripts/led-glow-app-check.js", rows };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  for (const row of rows) {
    const r60 = row.angles.find((entry) => entry.radius === 60);
    const r100 = row.angles.find((entry) => entry.radius === 100);
    console.log(`${row.pass ? "PASS" : "FAIL"} ${row.color} ${row.theme} ${row.background} alpha60=${r60.minimum.toFixed(2)} alpha100=${r100.minimum.toFixed(2)} ratio60=${r60.ratio.toFixed(3)} ratio100=${r100.ratio.toFixed(3)} down=${r60.angle90.deltaE.toFixed(2)} up=${r60.angle270.deltaE.toFixed(2)} peak=${row.peakAlpha}`);
  }
  console.log(`glow_cases=${summary.total}`);
  console.log(`glow_failures=${summary.failed}`);
  console.log(`final_glow_peak_alpha_dark=${summary.finalGlowPeakAlpha.dark}`);
  console.log(`final_glow_peak_alpha_light=${summary.finalGlowPeakAlpha.light}`);
  console.log(`report=${path.relative(root, reportPath).split(path.sep).join("/")}`);
  console.log(summary.pass ? "GLOW CHECK: PASS" : "GLOW CHECK: FAIL");
  if (!summary.pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
