"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
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

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function count(text, needle) {
  return text.split(needle).length - 1;
}

const sourcePath = resolveInput(
  arg("source", "work/readable/out/renderer/assets/index-BU2QbNS1.js"),
);
const outputPath = resolveInput(
  arg("output", "out/patched/work/readable/out/renderer/assets/index-BU2QbNS1.js"),
);
const adapterPath = resolveInput(arg("adapter", "scripts/led-patch-adapter.js"));
const modulePath = resolveInput(arg("module", "led-new/dist/renderLedSvg.js"));

const source = fs.readFileSync(sourcePath, "utf8");
const moduleSource = fs.readFileSync(modulePath, "utf8");
const marker = "const LED_PATCH_V1 = true;";

if (count(source, marker) !== 0) throw new Error("LED patch marker already present");

let profile = null;
let requiredAnchors = [];
if (count(source, "const glowRadius = 13 + 9 * glow;") === 1) {
  profile = "pristine";
  requiredAnchors = [
    "const glowRadius = 13 + 9 * glow;",
    "points: [10, 40, 10, 26],",
    "points: [30, 40, 30, 26],",
    "radius: 12,",
  ];
} else if (count(source, "const paint = ledPaint(part.props.color, false);") === 1) {
  profile = "current";
  requiredAnchors = [
    "const paint = ledPaint(part.props.color, false);",
    "window.__LED_GEOMETRY__ ??= {};",
    'name: "led-dome",',
    'name: "led-halo",',
  ];
} else {
  throw new Error("unrecognized LED drawing profile");
}

const partBodyIndex = source.indexOf("function PartBody({");
const ledStart = source.indexOf('    case "led": {\n', partBodyIndex);
if (partBodyIndex === -1 || ledStart === -1) throw new Error("PartBody LED anchor not found");

const nextCasePattern = /\n    case "[a-z0-9-]+":/g;
nextCasePattern.lastIndex = ledStart;
const nextCaseMatch = nextCasePattern.exec(source);
if (!nextCaseMatch) throw new Error("next PartBody case not found");
const nextCaseStart = nextCaseMatch.index + 1;
if (count(source.slice(partBodyIndex, nextCaseStart), '    case "led": {\n') !== 1) {
  throw new Error("PartBody LED anchor is not unique");
}

const oldBlock = source.slice(ledStart, nextCaseStart);
for (const anchor of requiredAnchors) {
  if (count(oldBlock, anchor) !== 1) throw new Error(`old LED anchor mismatch: ${anchor}`);
}

const fit = computeFit(source, moduleSource);
const adapterSource = fs.readFileSync(adapterPath, "utf8");
const adapterReplacements = [
  ["const DESIGN_SCALE = 0.5;", `const DESIGN_SCALE = ${formatNumber(fit.scale)};`],
  ["const ORIGIN_X = 20;", `const ORIGIN_X = ${formatNumber(fit.originX)};`],
  ["const ORIGIN_Y = 40;", `const ORIGIN_Y = ${formatNumber(fit.originY)};`],
];
let adapter = adapterSource;
for (const [from, to] of adapterReplacements) {
  if (count(adapter, from) !== 1) throw new Error(`adapter anchor mismatch: ${from}`);
  adapter = adapter.replace(from, to);
}

const newBlock = `    case "led": {
      return globalThis.LED_PATCH_renderLedBody({
        runtime: import_jsx_runtime,
        part,
        color: part.props.color,
        brightness,
        selected,
        lightMode,
      });
    }
`;

const injection = `${marker}\n${moduleSource.trimEnd()}\n\n${adapter.trimEnd()}\n\n`;
const patched =
  source.slice(0, partBodyIndex) +
  injection +
  source.slice(partBodyIndex, ledStart) +
  newBlock +
  source.slice(nextCaseStart);

for (const oldAnchor of [
  "const glowRadius = 13 + 9 * glow;",
  "const paint = ledPaint(part.props.color, false);",
  "window.__LED_GEOMETRY__ ??= {};",
]) {
  if (count(patched, oldAnchor) !== 0) throw new Error(`old LED drawing remains: ${oldAnchor}`);
}
if (count(patched, marker) !== 1) throw new Error("patched marker count mismatch");
if (count(patched, "globalThis.LED_PATCH_renderLedBody({") !== 1) {
  throw new Error("patched renderer call count mismatch");
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, patched);

const sourceBuffer = fs.readFileSync(sourcePath);
const patchedBuffer = fs.readFileSync(outputPath);
console.log(`profile=${profile}`);
console.log(`source=${path.relative(root, sourcePath).split(path.sep).join("/")}`);
console.log(`output=${path.relative(root, outputPath).split(path.sep).join("/")}`);
console.log(`source_bytes=${sourceBuffer.length}`);
console.log(`output_bytes=${patchedBuffer.length}`);
console.log(`old_block_bytes=${Buffer.byteLength(oldBlock)}`);
console.log(`new_block_bytes=${Buffer.byteLength(newBlock)}`);
console.log(`fit_scale=${formatNumber(fit.scale)}`);
console.log(`origin=${formatNumber(fit.originX)},${formatNumber(fit.originY)}`);
console.log(`existing_spacing=${formatNumber(fit.existingSpacing)}`);
console.log(`design_spacing=${formatNumber(fit.designSpacing)}`);
console.log(`source_sha256=${sha256(sourceBuffer)}`);
console.log(`output_sha256=${sha256(patchedBuffer)}`);
console.log(`marker_count=1`);
console.log(`PATCH: PASS`);
