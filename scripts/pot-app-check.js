"use strict";

/**
 * Captures the potentiometer from a running app build and checks the pixels
 * that were rendered on the canvas.
 *
 * The pot is located by its body rim, then the pointer angle, the body
 * silhouette and the knob are measured from the canvas pixels and compared
 * with the shared module's specification.
 *
 * Usage:
 *   node scripts/pot-app-check.js [--app out/app-pot.asar] [--sample <path>]
 *                                 [--port <cdp port>] [--report <path>]
 */

const fs = require("node:fs");
const path = require("node:path");
const { probe } = require("./pot-app-probe");

const root = path.resolve(__dirname, "..");

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`missing value: --${name}`);
  return value;
}

function resolveInput(value) {
  return path.isAbsolute(value) ? value : path.join(root, value);
}

function rgb(hex) {
  const value = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function luminance(color) {
  const [r, g, b] = color.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

async function main() {
  const spec = await import(path.join(root, "pot-new", "src", "potSpec.ts"));
  const renderer = await import(path.join(root, "pot-new", "src", "renderPotSvg.ts"));

  const port = Number(arg("port", "9342"));
  const appPath = resolveInput(arg("app", "out/app-pot.asar"));
  const samplePath = resolveInput(arg("sample", "resources/samples/potentiometer.vcc"));
  const reportPath = resolveInput(arg("report", "reports/pot-app-check.json"));
  const outDir = resolveInput(arg("out", "pot-new/out"));
  const value = Number(arg("value", "0.5"));

  const screenshotPath = path.join(outDir, `app-${path.basename(appPath, ".asar")}-pot.png`);
  const result = await probe({
    appPath,
    samplePath,
    port,
    spec,
    renderer,
    screenshotPath,
  });

  const tokens = spec.tokensFor("dark");
  const samplePart = result.sample.circuit.parts.find((part) => part.type === "potentiometer");
  const partRotation = samplePart ? samplePart.rotation : 0;
  const expectedAngle = renderer.pointerAngleDeg(value) + partRotation;
  const measuredAngle = result.pointer ? result.pointer.angleDeg : null;
  const centreDelta = {
    x: result.knob.centre.x - result.knob.expectedCentre.x,
    y: result.knob.centre.y - result.knob.expectedCentre.y,
  };
  const expectedKnobRadius = spec.KNOB_RADIUS * spec.APP_SCALE * result.zoom;
  const expectedBodyRadius = spec.BODY_RADIUS * spec.APP_SCALE * result.zoom;
  if (!result.knob.bodyRadiusPx) throw new Error("the potentiometer body rim was not found");

  const report = {
    app: path.relative(root, appPath).split(path.sep).join("/"),
    sample: path.relative(root, samplePath).split(path.sep).join("/"),
    screenshot: path.relative(root, screenshotPath).split(path.sep).join("/"),
    value,
    canvasRect: result.canvasRect,
    knob: {
      centre: result.knob.centre,
      expectedCentre: result.knob.expectedCentre,
      centreDelta,
      radiusPx: result.knob.radiusPx,
      expectedRadiusPx: expectedKnobRadius,
      bodyRadiusPx: result.knob.bodyRadiusPx,
      expectedBodyRadiusPx: expectedBodyRadius,
      pixels: result.knob.pixels,
      zoom: result.zoom,
    },
    pointer: {
      expectedDeg: expectedAngle,
      partRotationDeg: partRotation,
      measuredDeg: measuredAngle,
      deltaDeg: measuredAngle === null ? null : Math.abs(measuredAngle - expectedAngle),
      pixels: result.pointer ? result.pointer.pixels : 0,
    },
    tokens: { pointer: tokens.pointer, knobTop: tokens.knobTop, knobBottom: tokens.knobBottom },
    contrasts: {
      pointerVsKnobTop: contrast(rgb(tokens.pointer), rgb(tokens.knobTop)),
      pointerVsKnobBottom: contrast(rgb(tokens.pointer), rgb(tokens.knobBottom)),
    },
    runtimeExceptions: result.runtimeExceptions,
  };
  // The canvas offset is owned by the app, so only the drawn sizes and the
  // pointer direction are compared; the anchor mapping is checked by
  // scripts/verify-pot-patch.js.
  report.pass =
    report.runtimeExceptions.length === 0 &&
    report.pointer.deltaDeg !== null &&
    report.pointer.deltaDeg <= 8 &&
    Math.abs(report.knob.radiusPx - expectedKnobRadius) <= 3 &&
    Math.abs(report.knob.bodyRadiusPx - expectedBodyRadius) <= 3;

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`app=${report.app}`);
  console.log(`knob_centre=${result.knob.centre.x.toFixed(1)},${result.knob.centre.y.toFixed(1)}`);
  console.log(`knob_radius_px=${result.knob.radiusPx.toFixed(2)} expected=${expectedKnobRadius.toFixed(2)}`);
  console.log(`body_radius_px=${result.knob.bodyRadiusPx.toFixed(2)} zoom=${result.zoom.toFixed(4)}`);
  console.log(`pointer_measured=${measuredAngle === null ? "none" : measuredAngle.toFixed(2)} expected=${expectedAngle}`);
  console.log(`runtime_exceptions=${report.runtimeExceptions.length}`);
  console.log(`screenshot=${report.screenshot}`);
  console.log(`report=${path.relative(root, reportPath)}`);
  console.log(report.pass ? "APP CHECK: PASS" : "APP CHECK: FAIL");
  if (!report.pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
