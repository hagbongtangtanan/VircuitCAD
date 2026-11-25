"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

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
const adapterPath = resolveInput(arg("adapter", "scripts/pot-patch-adapter.js"));
const modulePath = resolveInput(arg("module", "pot-new/dist/renderPotSvg.js"));

const OLD_ANCHORS = [
  '    case "potentiometer":',
  "const angle = ((-135 + 270 * Math.min(1, Math.max(0, potPosition))) * Math.PI) / 180;",
  "points: [30, 27, 30, 40],",
];

const MARKER = "const POT_PATCH_V1 = true;";

/** Replaces the potentiometer definition's size and pin positions in place. */
function patchDefinition(source, spec) {
  const anchor = "var potentiometerDefinition = {";
  const start = source.indexOf(anchor);
  if (start === -1) throw new Error("potentiometerDefinition not found");
  let depth = 0;
  let end = -1;
  for (let index = start + anchor.length - 1; index < source.length; index += 1) {
    const character = source[index];
    if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        end = index;
        break;
      }
    }
  }
  if (end === -1) throw new Error("potentiometerDefinition end not found");

  let block = source.slice(start, end + 1);

  const sizeMatch = block.match(/size:(\s*)\{([^}]*)\}/);
  if (!sizeMatch) throw new Error("potentiometerDefinition size not found");
  const sizeBody = sizeMatch[2];
  if (!/width:\s*[0-9.]+/.test(sizeBody) || !/height:\s*[0-9.]+/.test(sizeBody)) {
    throw new Error("potentiometerDefinition size values not found");
  }
  const newSizeBody = sizeBody
    .replace(/width:\s*[0-9.]+/, `width: ${spec.APP_BOX.width}`)
    .replace(/height:\s*[0-9.]+/, `height: ${spec.APP_BOX.height}`);
  block =
    block.slice(0, sizeMatch.index) +
    `size:${sizeMatch[1]}{${newSizeBody}}` +
    block.slice(sizeMatch.index + sizeMatch[0].length);

  for (const pin of spec.APP_PINS) {
    const pattern = new RegExp(
      `pin\\("${pin.id}",\\s*"${pin.label}",\\s*\\{([^}]*)\\}`,
    );
    const match = block.match(pattern);
    if (!match) throw new Error(`potentiometerDefinition pin ${pin.id} not found`);
    const body = match[1]
      .replace(/x:\s*[0-9.]+/, `x: ${pin.x}`)
      .replace(/y:\s*[0-9.]+/, `y: ${pin.y}`);
    block =
      block.slice(0, match.index) +
      `pin("${pin.id}", "${pin.label}", {${body}}` +
      block.slice(match.index + match[0].length);
  }

  return { start, end: end + 1, block };
}

async function main() {
  const spec = await import(path.join(root, "pot-new", "src", "potSpec.ts"));
  const source = fs.readFileSync(sourcePath, "utf8");
  const moduleSource = fs.readFileSync(modulePath, "utf8");

  const markerCount = count(source, MARKER);
  if (markerCount > 1) throw new Error("pot patch marker count mismatch");
  const upgrade = markerCount === 1;

  const partBodyIndex = source.indexOf("function PartBody({");
  const potMarker = '\n    case "potentiometer":\n';
  const potMarkerIndex = source.indexOf(potMarker, partBodyIndex);
  if (partBodyIndex === -1 || potMarkerIndex === -1) {
    throw new Error("PartBody potentiometer anchor not found");
  }
  const potStart = potMarkerIndex + 1;

  const nextCasePattern = /\n    case "[a-z0-9-]+":/g;
  nextCasePattern.lastIndex = potStart;
  const nextCaseMatch = nextCasePattern.exec(source);
  if (!nextCaseMatch) throw new Error("next PartBody case not found");
  const nextCaseStart = nextCaseMatch.index + 1;
  if (count(source.slice(partBodyIndex, nextCaseStart), potMarker) !== 1) {
    throw new Error("PartBody potentiometer anchor is not unique");
  }

  const oldBlock = source.slice(potStart, nextCaseStart);
  if (upgrade) {
    for (const anchor of OLD_ANCHORS.slice(1)) {
      if (count(oldBlock, anchor) !== 0) {
        throw new Error(`old pot drawing remains in the patched block: ${anchor}`);
      }
    }
  } else {
    for (const anchor of OLD_ANCHORS) {
      if (count(oldBlock, anchor) !== 1) throw new Error(`old pot anchor mismatch: ${anchor}`);
    }
  }

  const designScale = spec.APP_SCALE;
  const originX = spec.APP_ANCHOR_LOCAL.middle.x;
  const originY = spec.APP_ANCHOR_LOCAL.middle.y;
  const format = (value) => String(Math.round(value * 1e12) / 1e12);

  const adapterSource = fs.readFileSync(adapterPath, "utf8");
  const adapterReplacements = [
    ["const DESIGN_SCALE = 0.9013878188659973;", `const DESIGN_SCALE = ${format(designScale)};`],
    ["const ORIGIN_X = 30;", `const ORIGIN_X = ${format(originX)};`],
    ["const ORIGIN_Y = 40;", `const ORIGIN_Y = ${format(originY)};`],
  ];
  let adapter = adapterSource;
  for (const [from, to] of adapterReplacements) {
    if (count(adapter, from) !== 1) throw new Error(`adapter anchor mismatch: ${from}`);
    adapter = adapter.replace(from, to);
  }

  const newBlock = `    case "potentiometer":
      return globalThis.POT_PATCH_renderPotBody({
        runtime: import_jsx_runtime,
        value: potPosition,
        selected,
        lightMode,
        burnt: part.props.burnt === true,
      });
`;

  const previewIndex = source.indexOf("function InputPreview({");
  const previewPotMarker =
    '  if (type === "potentiometer")\n' +
    "    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, {\n" +
    "      children: [\n" +
    "        leads([";
  const previewPotMarkerPatched = '  if (type === "potentiometer") {';
  const previewPotIndex = upgrade
    ? source.indexOf(previewPotMarkerPatched, previewIndex)
    : source.indexOf(previewPotMarker, previewIndex);
  const previewNextMarker = '  if (type === "slide-switch")';
  const previewNextIndex = source.indexOf(previewNextMarker, previewPotIndex);
  if (previewIndex === -1 || previewPotIndex === -1 || previewNextIndex === -1) {
    throw new Error("InputPreview potentiometer anchor not found");
  }
  const oldPreviewBlock = source.slice(previewPotIndex, previewNextIndex);
  if (upgrade) {
    if (count(oldPreviewBlock, "const potThumbInner = potThumb") !== 1) {
      throw new Error("patched pot thumbnail anchor mismatch");
    }
    if (count(source, previewPotMarkerPatched) !== 1) {
      throw new Error("patched InputPreview potentiometer anchor is not unique");
    }
  } else {
    if (count(oldPreviewBlock, 'fill: "#2c5c8e"') !== 1) {
      throw new Error("old pot thumbnail anchor mismatch");
    }
    if (count(source, previewPotMarker) !== 1) {
      throw new Error("InputPreview potentiometer anchor is not unique");
    }
  }

  const thumbWidth = 56;
  const thumbHeight = 56;
  const thumbX = (96 - thumbWidth) / 2;
  const formatThumb = (value) => String(Math.round(value * 1e6) / 1e6);
  const viewBox = `${formatThumb(spec.BBOX.minX)} ${formatThumb(spec.BBOX.minY)} ${formatThumb(
    spec.BBOX.maxX - spec.BBOX.minX,
  )} ${formatThumb(spec.BBOX.maxY - spec.BBOX.minY)}`;

  const newPreviewBlock = `  if (type === "potentiometer") {
    const potThumb = globalThis.PotSvg.renderPotSvg({
      value: 0.5,
      theme: "light",
      showLabels: false,
    });
    const potThumbInner = potThumb
      .replace(/^<svg[^>]*>/, "")
      .replace(/<\\/svg>\\s*$/, "");
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
      x: ${formatThumb(thumbX)},
      y: 0,
      width: ${formatThumb(thumbWidth)},
      height: ${formatThumb(thumbHeight)},
      viewBox: "${viewBox}",
      dangerouslySetInnerHTML: { __html: potThumbInner },
    });
  }
`;

  const injection = `${MARKER}\n${moduleSource.trimEnd()}\n\n${adapter.trimEnd()}\n\n`;

  const edits = [];
  if (upgrade) {
    const markerIndex = source.indexOf(MARKER);
    if (markerIndex > partBodyIndex) throw new Error("pot patch marker is not before PartBody");
    edits.push({ start: markerIndex, end: partBodyIndex, text: injection });
  } else {
    edits.push({ start: partBodyIndex, end: partBodyIndex, text: injection });
  }
  edits.push({ start: potStart, end: nextCaseStart, text: newBlock });
  edits.push({ start: previewPotIndex, end: previewNextIndex, text: newPreviewBlock });

  const definition = patchDefinition(source, spec);
  const definitionSize = definition.block.match(/size:(\s*)\{([^}]*)\}/);
  if (
    !definitionSize ||
    !new RegExp(`width:\\s*${spec.APP_BOX.width}\\b`).test(definitionSize[2]) ||
    !new RegExp(`height:\\s*${spec.APP_BOX.height}\\b`).test(definitionSize[2])
  ) {
    throw new Error("potentiometerDefinition size patch mismatch");
  }
  for (const pin of spec.APP_PINS) {
    const pattern = new RegExp(
      `pin\\("${pin.id}",\\s*"${pin.label}",\\s*\\{\\s*x:\\s*${pin.x},\\s*y:\\s*${pin.y},?\\s*\\}`,
    );
    if (!pattern.test(definition.block)) {
      throw new Error(`potentiometerDefinition pin patch mismatch: ${pin.id}`);
    }
  }
  edits.push({
    start: definition.start,
    end: definition.end,
    text: definition.block,
  });

  edits.sort((a, b) => b.start - a.start);
  let patched = source;
  for (const edit of edits) {
    patched = patched.slice(0, edit.start) + edit.text + patched.slice(edit.end);
  }

  for (const oldAnchor of OLD_ANCHORS.slice(1)) {
    if (count(patched, oldAnchor) !== 0) throw new Error(`old pot drawing remains: ${oldAnchor}`);
  }
  if (count(patched, 'fill: "#2c5c8e"') !== 0) throw new Error("old pot thumbnail remains");
  if (count(patched, "const potThumbInner = potThumb") !== 1) {
    throw new Error("pot thumbnail renderer call count mismatch");
  }
  if (count(patched, MARKER) !== 1) throw new Error("patched marker count mismatch");
  if (count(patched, "globalThis.POT_PATCH_renderPotBody({") !== 1) {
    throw new Error("patched renderer call count mismatch");
  }
  if (count(patched, "root.PotSvg = mod.exports;") !== 1) {
    throw new Error("pot module injection count mismatch");
  }
  if (count(patched, `viewBox: "${viewBox}"`) !== 1) {
    throw new Error("pot thumbnail viewBox count mismatch");
  }
  const patchedDefinition = patched.slice(
    patched.indexOf("var potentiometerDefinition = {"),
    patched.indexOf("var buzzerDefinition = {"),
  );
  if (
    !new RegExp(`width:\\s*${spec.APP_BOX.width}\\b`).test(patchedDefinition) ||
    !new RegExp(`height:\\s*${spec.APP_BOX.height}\\b`).test(patchedDefinition)
  ) {
    throw new Error("potentiometerDefinition size patch mismatch");
  }
  for (const pin of spec.APP_PINS) {
    const pattern = new RegExp(
      `pin\\("${pin.id}",\\s*"${pin.label}",\\s*\\{\\s*x:\\s*${pin.x},\\s*y:\\s*${pin.y},?\\s*\\}`,
    );
    if (!pattern.test(patchedDefinition)) {
      throw new Error(`potentiometerDefinition pin patch mismatch: ${pin.id}`);
    }
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, patched);

  const sourceBuffer = fs.readFileSync(sourcePath);
  const patchedBuffer = fs.readFileSync(outputPath);
  console.log(`source=${path.relative(root, sourcePath).split(path.sep).join("/")}`);
  console.log(`output=${path.relative(root, outputPath).split(path.sep).join("/")}`);
  console.log(`mode=${upgrade ? "upgrade" : "fresh"}`);
  console.log(`source_bytes=${sourceBuffer.length}`);
  console.log(`output_bytes=${patchedBuffer.length}`);
  console.log(`old_block_bytes=${Buffer.byteLength(oldBlock)}`);
  console.log(`new_block_bytes=${Buffer.byteLength(newBlock)}`);
  console.log(`old_thumbnail_bytes=${Buffer.byteLength(oldPreviewBlock)}`);
  console.log(`new_thumbnail_bytes=${Buffer.byteLength(newPreviewBlock)}`);
  console.log(`design_scale=${format(designScale)}`);
  console.log(`origin=${format(originX)},${format(originY)}`);
  console.log(`definition_size=${spec.APP_BOX.width}x${spec.APP_BOX.height}`);
  console.log(`definition_pins=${spec.APP_PINS.map((pin) => `${pin.id}@${pin.x},${pin.y}`).join(" ")}`);
  console.log(`thumbnail_viewBox=${viewBox}`);
  console.log(`source_sha256=${sha256(sourceBuffer)}`);
  console.log(`output_sha256=${sha256(patchedBuffer)}`);
  console.log(`marker_count=1`);
  console.log("PATCH: PASS");
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
