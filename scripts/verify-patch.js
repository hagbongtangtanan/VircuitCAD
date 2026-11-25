"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { computeFit, formatNumber } = require("./led-patch-fit");

const root = path.resolve(__dirname, "..");

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`missing value for --${name}`);
  return value;
}

function resolveInput(value) {
  return path.isAbsolute(value) ? value : path.join(root, value);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function count(text, needle) {
  return text.split(needle).length - 1;
}

function definitionBlock(text) {
  const start = text.indexOf("var ledDefinition = {");
  if (start === -1) throw new Error("missing ledDefinition");
  const end = text.indexOf("\n};", start);
  if (end === -1) throw new Error("missing ledDefinition end");
  return text.slice(start, end);
}

function ledCaseBlock(text, from = 0) {
  const partBody = text.indexOf("function PartBody({", from);
  if (partBody === -1) throw new Error("missing PartBody");
  const start = text.indexOf('    case "led": {\n', partBody);
  if (start === -1) throw new Error("missing PartBody LED case");
  const pattern = /\n    case "[a-z0-9-]+":/g;
  pattern.lastIndex = start;
  const next = pattern.exec(text);
  if (!next) throw new Error("missing next PartBody case");
  const end = next.index + 1;
  return { start, end, text: text.slice(start, end) };
}

const sourcePath = resolveInput(
  arg("source", "work/readable/out/renderer/assets/index-BU2QbNS1.js"),
);
const patchedPath = resolveInput(
  arg("patched", "out/patched/work/readable/out/renderer/assets/index-BU2QbNS1.js"),
);
const reportPath = resolveInput(arg("report", "reports/led-verify.json"));
const modulePath = resolveInput(arg("module", "led-new/dist/renderLedSvg.js"));

const sourceBuffer = fs.readFileSync(sourcePath);
const patchedBuffer = fs.readFileSync(patchedPath);
const source = sourceBuffer.toString("utf8");
const patched = patchedBuffer.toString("utf8");
const moduleSource = fs.readFileSync(modulePath, "utf8");
const marker = "const LED_PATCH_V1 = true;";
const fit = computeFit(source, moduleSource);

const sourceLedDefinition = definitionBlock(source);
const patchedLedDefinition = definitionBlock(patched);
const sourceOldBlock = ledCaseBlock(source);

let restoreError = null;
let restoredMatchesSource = false;
let injectionBytes = 0;
try {
  const markerIndex = patched.indexOf(marker);
  if (markerIndex === -1) throw new Error("missing patch marker");
  const partBodyIndex = patched.indexOf("function PartBody({", markerIndex);
  if (partBodyIndex === -1) throw new Error("missing PartBody after marker");
  const patchedCase = ledCaseBlock(patched, partBodyIndex);
  injectionBytes = Buffer.byteLength(patched.slice(markerIndex, partBodyIndex));
  const restored =
    patched.slice(0, markerIndex) +
    patched.slice(partBodyIndex, patchedCase.start) +
    sourceOldBlock.text +
    patched.slice(patchedCase.end);
  restoredMatchesSource = restored === source;
} catch (error) {
  restoreError = error.message;
}

let syntaxOk = true;
let syntaxError = null;
try {
  execFileSync(process.execPath, ["--check", patchedPath], { stdio: "pipe" });
} catch (error) {
  syntaxOk = false;
  syntaxError = String(error.stderr || error.message).trim().slice(0, 400);
}

const expectedScale = `const DESIGN_SCALE = ${formatNumber(fit.scale)};`;
const expectedOriginX = `const ORIGIN_X = ${formatNumber(fit.originX)};`;
const expectedOriginY = `const ORIGIN_Y = ${formatNumber(fit.originY)};`;

const checks = {
  marker_count: count(patched, marker) === 1 && count(source, marker) === 0,
  renderer_call_count: count(patched, "globalThis.LED_PATCH_renderLedBody({") === 1,
  old_led_case_absent:
    count(patched, "const glowRadius = 13 + 9 * glow;") === 0 &&
    count(patched, "const paint = ledPaint(part.props.color, false);") === 0 &&
    count(patched, "window.__LED_GEOMETRY__ ??= {};") === 0,
  led_definition_unchanged: sourceLedDefinition === patchedLedDefinition,
  pin_hit_stroke_unchanged:
    count(patched, "hitStrokeWidth: 8 / props.scale") ===
    count(source, "hitStrokeWidth: 8 / props.scale"),
  led_colors_unchanged:
    count(patched, "var LED_COLORS = {") === count(source, "var LED_COLORS = {") &&
    count(source, "var LED_COLORS = {") === 1,
  module_present: count(patched, "exports.renderLedSvg = renderLedSvg;") === 1,
  adapter_scale_matches: count(patched, expectedScale) === 1,
  adapter_origin_matches:
    count(patched, expectedOriginX) === 1 && count(patched, expectedOriginY) === 1,
  fit_maps_pins:
    formatNumber(fit.originX + fit.scale * -20) === formatNumber(fit.anodePartLocal.x) &&
    formatNumber(fit.originY) === formatNumber(fit.anodePartLocal.y) &&
    formatNumber(fit.originX + fit.scale * 20) === formatNumber(fit.cathodePartLocal.x) &&
    formatNumber(fit.originY) === formatNumber(fit.cathodePartLocal.y),
  restored_matches_source: restoredMatchesSource,
  syntax_ok: syntaxOk,
};

const report = {
  source: path.relative(root, sourcePath).split(path.sep).join("/"),
  patched: path.relative(root, patchedPath).split(path.sep).join("/"),
  source_bytes: sourceBuffer.length,
  patched_bytes: patchedBuffer.length,
  source_lines: source.split("\n").length,
  patched_lines: patched.split("\n").length,
  source_sha256: sha256(sourceBuffer),
  patched_sha256: sha256(patchedBuffer),
  led_definition_sha256: sha256(sourceLedDefinition),
  fit_scale: formatNumber(fit.scale),
  origin: `${formatNumber(fit.originX)},${formatNumber(fit.originY)}`,
  anode_part_local: fit.anodePartLocal,
  cathode_part_local: fit.cathodePartLocal,
  injection_bytes: injectionBytes,
  old_led_block_bytes: Buffer.byteLength(sourceOldBlock.text),
  checks,
  restore_error: restoreError,
  syntax_error: syntaxError,
  pass: Object.values(checks).every(Boolean),
};
console.log("Failed checks:", Object.entries(checks).filter(([k,v]) => !v).map(([k]) => k).join(", "));

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`source_sha256=${report.source_sha256}`);
console.log(`patched_sha256=${report.patched_sha256}`);
console.log(`source_bytes=${report.source_bytes}`);
console.log(`patched_bytes=${report.patched_bytes}`);
console.log(`source_lines=${report.source_lines}`);
console.log(`patched_lines=${report.patched_lines}`);
console.log(`fit_scale=${report.fit_scale}`);
console.log(`origin=${report.origin}`);
console.log(`injection_bytes=${report.injection_bytes}`);
console.log(`old_led_block_bytes=${report.old_led_block_bytes}`);
console.log(`checks_passed=${Object.values(checks).filter(Boolean).length}`);
console.log(`checks_total=${Object.keys(checks).length}`);
console.log(`report=${path.relative(root, reportPath).split(path.sep).join("/")}`);
console.log(report.pass ? "VERIFY: PASS" : "VERIFY: FAIL");
if (!report.pass) process.exitCode = 1;
