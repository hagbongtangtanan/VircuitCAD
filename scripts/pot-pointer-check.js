"use strict";

/**
 * Drives the potentiometer slider in the running app and checks that the
 * pointer on the canvas follows the shared module's angle mapping.
 *
 * Usage:
 *   node scripts/pot-pointer-check.js [--app out/app-pot.asar] [--value 0.8]
 *                                     [--port <cdp port>]
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

async function main() {
  const spec = await import(path.join(root, "pot-new", "src", "potSpec.ts"));
  const renderer = await import(path.join(root, "pot-new", "src", "renderPotSvg.ts"));

  const port = Number(arg("port", "9346"));
  const appPath = resolveInput(arg("app", "out/app-pot.asar"));
  const samplePath = resolveInput(arg("sample", "resources/samples/potentiometer.vcc"));
  const reportPath = resolveInput(arg("report", "reports/pot-pointer-check.json"));
  const outDir = resolveInput(arg("out", "pot-new/out"));
  const targetValue = Number(arg("value", "0.2"));

  const screenshotPath = path.join(outDir, "app-pot-pointer.png");
  let sliderFound = false;

  const result = await probe({
    appPath,
    samplePath,
    port,
    spec,
    renderer,
    screenshotPath,
    interact: async ({ evaluate, client, measure }) => {
      const centre = measure.knob.centre;
      await client.send("Input.dispatchMouseEvent", {
        type: "mousePressed",
        x: centre.x,
        y: centre.y,
        button: "left",
        clickCount: 1,
      });
      await client.send("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x: centre.x,
        y: centre.y,
        button: "left",
        clickCount: 1,
      });
      await new Promise((resolve) => setTimeout(resolve, 900));
      sliderFound = await evaluate(`(() => {
        const slider = document.querySelector('[data-testid="pot-slider"]');
        if (!slider) return false;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        setter.call(slider, "${Math.round(targetValue * 100)}");
        slider.dispatchEvent(new Event("input", { bubbles: true }));
        slider.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      })()`);
      await new Promise((resolve) => setTimeout(resolve, 900));
    },
  });

  const samplePart = result.sample.circuit.parts.find((part) => part.type === "potentiometer");
  const partRotation = samplePart ? samplePart.rotation : 0;
  const expectedAngle = renderer.pointerAngleDeg(targetValue) + partRotation;
  const initialAngle = result.initial.pointer ? result.initial.pointer.angleDeg : null;
  const finalAngle = result.pointer ? result.pointer.angleDeg : null;

  const report = {
    app: path.relative(root, appPath).split(path.sep).join("/"),
    sample: path.relative(root, samplePath).split(path.sep).join("/"),
    screenshot: path.relative(root, screenshotPath).split(path.sep).join("/"),
    sliderFound,
    value: targetValue,
    pointer: {
      expectedDeg: expectedAngle,
      partRotationDeg: partRotation,
      initialDeg: initialAngle,
      finalDeg: finalAngle,
      deltaDeg: finalAngle === null ? null : Math.abs(finalAngle - expectedAngle),
      movedDeg:
        initialAngle === null || finalAngle === null ? null : Math.abs(finalAngle - initialAngle),
    },
    knob: {
      centre: result.knob.centre,
      radiusPx: result.knob.radiusPx,
      bodyRadiusPx: result.knob.bodyRadiusPx,
      zoom: result.zoom,
    },
    runtimeExceptions: result.runtimeExceptions,
  };
  report.pass =
    report.runtimeExceptions.length === 0 &&
    sliderFound &&
    report.pointer.deltaDeg !== null &&
    report.pointer.deltaDeg <= 8 &&
    report.pointer.movedDeg !== null &&
    report.pointer.movedDeg >= 20;

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`app=${report.app}`);
  console.log(`slider_found=${Number(sliderFound)} value=${targetValue}`);
  console.log(`pointer_initial=${initialAngle === null ? "none" : initialAngle.toFixed(2)}`);
  console.log(`pointer_final=${finalAngle === null ? "none" : finalAngle.toFixed(2)} expected=${expectedAngle}`);
  console.log(`runtime_exceptions=${report.runtimeExceptions.length}`);
  console.log(`screenshot=${report.screenshot}`);
  console.log(`report=${path.relative(root, reportPath)}`);
  console.log(report.pass ? "POINTER CHECK: PASS" : "POINTER CHECK: FAIL");
  if (!report.pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
