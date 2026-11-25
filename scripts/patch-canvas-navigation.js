"use strict";

/**
 * Makes canvas navigation cheap enough to stay smooth while the developer
 * tools are open.
 *
 * Three things slowed the canvas down while the user panned around:
 *
 *  - the parts library subscribed to the viewport, so every pan frame
 *    re-rendered the library and redrew the twelve canvas previews,
 *  - the canvas kept hit testing the parts on every pointer move even while
 *    the user was dragging the canvas around, which reads the hit canvas
 *    back from the GPU,
 *  - every pointer move updated the viewport, so the canvas could be redrawn
 *    more often than the display refreshes.
 */

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
  arg("source", "out/patched/canvas-navigation/out/renderer/assets/index-N0START1.js"),
);
const outputPath = resolveInput(
  arg("output", "out/patched/canvas-navigation/out/renderer/assets/index-N0START1.js"),
);

const MARKER = "const CANVAS_NAVIGATION_PATCH_V1 = true;";

const ANCHOR_MARKER = `//#region src/renderer/ui/PartsPanel.tsx`;

const ANCHOR_LIBRARY_SUBSCRIPTION = `  const addPart = useCircuitStore((state) => state.addPart);
  const viewport = useViewportStore((state) => state.viewport);
  const size = useViewportStore((state) => state.size);
`;

const REPLACEMENT_LIBRARY_SUBSCRIPTION = `  const addPart = useCircuitStore((state) => state.addPart);
`;

const ANCHOR_LIBRARY_CLICK = `  const handleClick = (definition) => {
    const centre = screenToWorld(`;

const REPLACEMENT_LIBRARY_CLICK = `  const handleClick = (definition) => {
    const { viewport, size } = useViewportStore.getState();
    const centre = screenToWorld(`;

const ANCHOR_PARTS_LAYER = `        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Layer, {
          x: viewport.offsetX,
          y: viewport.offsetY,
          scaleX: viewport.scale,
          scaleY: viewport.scale,
          children: [
            ...visibleBreadboards.map((part) =>`;

const REPLACEMENT_PARTS_LAYER = `        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Layer, {
          x: viewport.offsetX,
          y: viewport.offsetY,
          scaleX: viewport.scale,
          scaleY: viewport.scale,
          listening: !isPanning,
          children: [
            ...visibleBreadboards.map((part) =>`;

const ANCHOR_STORE = `var useViewportStore = create()((set, get) => {`;

const REPLACEMENT_STORE = `var pendingPan = { x: 0, y: 0 };
var pendingPanFrame = null;
var useViewportStore = create()((set, get) => {`;

const ANCHOR_PAN = `    panBy(dx, dy) {
      const { viewport } = get();
      set({
        viewport: {
          ...viewport,
          offsetX: viewport.offsetX + dx,
          offsetY: viewport.offsetY + dy,
        },
      });
    },`;

const REPLACEMENT_PAN = `    panBy(dx, dy) {
      pendingPan.x += dx;
      pendingPan.y += dy;
      if (pendingPanFrame === null) {
        pendingPanFrame = requestAnimationFrame(() => {
          pendingPanFrame = null;
          const deltaX = pendingPan.x;
          const deltaY = pendingPan.y;
          pendingPan.x = 0;
          pendingPan.y = 0;
          if (deltaX === 0 && deltaY === 0) return;
          const { viewport } = get();
          set({
            viewport: {
              ...viewport,
              offsetX: viewport.offsetX + deltaX,
              offsetY: viewport.offsetY + deltaY,
            },
          });
        });
      }
    },`;

const EDITS = [
  ["library subscription", ANCHOR_LIBRARY_SUBSCRIPTION, REPLACEMENT_LIBRARY_SUBSCRIPTION],
  ["library click", ANCHOR_LIBRARY_CLICK, REPLACEMENT_LIBRARY_CLICK],
  ["parts layer", ANCHOR_PARTS_LAYER, REPLACEMENT_PARTS_LAYER],
  ["viewport store", ANCHOR_STORE, REPLACEMENT_STORE],
  ["pan by", ANCHOR_PAN, REPLACEMENT_PAN],
];

function main() {
  const source = fs.readFileSync(sourcePath, "utf8");

  const markerCount = count(source, MARKER);
  if (markerCount > 1) throw new Error("canvas navigation marker count mismatch");
  const mode = markerCount === 1 ? "upgrade" : "fresh";

  let patched = source;

  if (mode === "fresh") {
    if (count(patched, ANCHOR_MARKER) !== 1) throw new Error("anchor mismatch: marker");
    patched = patched.replace(ANCHOR_MARKER, `${ANCHOR_MARKER}\n${MARKER}`);
    for (const [name, anchor, replacement] of EDITS) {
      if (count(patched, anchor) !== 1) throw new Error(`anchor mismatch: ${name}`);
      patched = patched.replace(anchor, replacement);
    }
  } else {
    for (const [name, , replacement] of EDITS) {
      if (count(patched, replacement) !== 1) throw new Error(`replacement mismatch: ${name}`);
    }
  }

  if (count(patched, MARKER) !== 1) throw new Error("patched marker count mismatch");
  const panel = patched.slice(
    patched.indexOf("function PartsPanel() {"),
    patched.indexOf("function PartCard("),
  );
  if (panel.includes("useViewportStore((state) => state.viewport)")) {
    throw new Error("the parts library still follows the viewport");
  }
  if (count(patched, "const { viewport, size } = useViewportStore.getState();") !== 1) {
    throw new Error("library click does not read the viewport");
  }
  if (count(patched, "listening: !isPanning,") !== 1) {
    throw new Error("parts layer does not stop hit testing while panning");
  }
  if (count(patched, "pendingPanFrame = requestAnimationFrame(") !== 1) {
    throw new Error("pan is not throttled to a frame");
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, patched);

  const sourceBuffer = fs.readFileSync(sourcePath);
  const patchedBuffer = fs.readFileSync(outputPath);
  console.log(`source=${path.relative(root, sourcePath).split(path.sep).join("/")}`);
  console.log(`output=${path.relative(root, outputPath).split(path.sep).join("/")}`);
  console.log(`mode=${mode}`);
  console.log(`source_bytes=${sourceBuffer.length}`);
  console.log(`output_bytes=${patchedBuffer.length}`);
  console.log(`source_sha256=${sha256(sourceBuffer)}`);
  console.log(`output_sha256=${sha256(patchedBuffer)}`);
  console.log(`marker_count=1`);
  console.log("PATCH: PASS");
}

main();
