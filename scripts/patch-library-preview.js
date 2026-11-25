"use strict";

/**
 * Makes the parts library show the component exactly as it is drawn on the
 * canvas and makes the drag ghost the component instead of the library card.
 *
 * The patch replaces the hand drawn `PartPreview` SVG with a small offscreen
 * react-konva stage that renders `PartBody` (the very same component the
 * canvas draws), measures the drawing and exports it as a PNG. The PNG is
 * shown in the card and reused as the HTML5 drag image.
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
  arg("source", "work/readable/out/renderer/assets/index-BU2QbNS1.js"),
);
const outputPath = resolveInput(
  arg("output", "out/patched/library-preview/out/renderer/assets/index-BU2QbNS1.js"),
);

const MARKER = "const LIBRARY_PREVIEW_PATCH_V1 = true;";

const OLD_PREVIEW = `function PartPreview({ type }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
    className: "cb-part-thumb",
    "aria-hidden": "true",
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
      className: "cb-part-art",
      viewBox: "0 0 96 56",
      focusable: "false",
      children: partArt(type),
    }),
  });
}`;

const NEW_PREVIEW = `function PartPreview({ type }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LibraryCanvasPreview, {
    type,
  });
}`;

const OLD_DRAG_START = `  const handleDragStart = (event, definition) => {
    event.dataTransfer.setData(PART_DRAG_MIME, definition.type);
    event.dataTransfer.effectAllowed = "copy";
  };`;

const NEW_DRAG_START = `  const handleDragStart = (event, definition) => {
    event.dataTransfer.setData(PART_DRAG_MIME, definition.type);
    event.dataTransfer.effectAllowed = "copy";
    const card = event.currentTarget;
    const artwork =
      card instanceof HTMLElement ? card.querySelector("img.cb-part-art") : null;
    if (artwork instanceof HTMLImageElement) {
      event.dataTransfer.setDragImage(
        artwork,
        artwork.clientWidth / 2,
        artwork.clientHeight / 2,
      );
    }
  };`;

const PREVIEW_COMPONENT = `${MARKER}
var LIBRARY_THUMBNAIL_CACHE = new Map();
function LibraryCanvasPreview({ type }) {
  const definition = definitionOf(type);
  const part = import_react.useMemo(
    () => ({
      id: "library-preview-" + type,
      type,
      position: { x: 0, y: 0 },
      rotation: 0,
      flipX: false,
      flipY: false,
      props: Object.assign({}, definition.defaultProps),
    }),
    [type, definition],
  );
  const stageRef = import_react.useRef(null);
  const groupRef = import_react.useRef(null);
  const [fit, setFit] = import_react.useState(null);
  const [dataUrl, setDataUrl] = import_react.useState(null);
  import_react.useEffect(() => {
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      const group = groupRef.current;
      if (cancelled === true || group === null || group === void 0) return;
      const rect = group.getClientRect({ relativeTo: group, skipShadow: true });
      if (rect === null || rect === void 0) return;
      if (!(rect.width > 0) || !(rect.height > 0)) return;
      const scale = Math.min((96 - 8) / rect.width, (56 - 8) / rect.height);
      setFit({
        scale,
        x: (96 - rect.width * scale) / 2 - rect.x * scale,
        y: (56 - rect.height * scale) / 2 - rect.y * scale,
      });
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [part]);
  import_react.useEffect(() => {
    if (fit === null) return;
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      const stage = stageRef.current;
      if (cancelled === true || stage === null || stage === void 0) return;
      const canvas = stage.toCanvas({ pixelRatio: 2 });
      const url = canvas.toDataURL("image/png");
      LIBRARY_THUMBNAIL_CACHE.set(type, url);
      setDataUrl(url);
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [fit, type]);
  const body = (0, import_jsx_runtime.jsx)(PartBody, {
    part,
    selected: false,
    brightness: 0,
    pressed: false,
    potPosition: 0.5,
    switchOn: false,
    channels: {},
    spin: 0,
    dipBits: [],
    lcdDisplay: null,
    simRunning: false,
    scale: 1,
    hoveredPin: null,
    focusedPin: null,
    burnt: false,
  });
  return (0, import_jsx_runtime.jsxs)("span", {
    className: "cb-part-thumb",
    "aria-hidden": "true",
    children: [
      (0, import_jsx_runtime.jsx)("span", {
        className: "cb-library-preview-stage",
        style: {
          position: "fixed",
          left: "-10000px",
          top: "0px",
          width: "96px",
          height: "56px",
          pointerEvents: "none",
        },
        children: (0, import_jsx_runtime.jsx)(Stage, {
          ref: stageRef,
          width: 96,
          height: 56,
          children: (0, import_jsx_runtime.jsx)(Layer, {
            x: fit === null ? 0 : fit.x,
            y: fit === null ? 0 : fit.y,
            scaleX: fit === null ? 1 : fit.scale,
            scaleY: fit === null ? 1 : fit.scale,
            children: (0, import_jsx_runtime.jsx)(Group, {
              ref: groupRef,
              children: body,
            }),
          }),
        }),
      }),
      dataUrl === null
        ? (0, import_jsx_runtime.jsx)("svg", {
            className: "cb-part-art",
            viewBox: "0 0 96 56",
            focusable: "false",
            children: partArt(type),
          })
        : (0, import_jsx_runtime.jsx)("img", {
            className: "cb-part-art",
            src: dataUrl,
            alt: "",
            draggable: false,
            style: { objectFit: "contain" },
          }),
    ],
  });
}
`;

function main() {
  const source = fs.readFileSync(sourcePath, "utf8");

  const markerCount = count(source, MARKER);
  if (markerCount > 1) throw new Error("library preview marker count mismatch");

  let patched = source;
  let mode = "fresh";

  if (markerCount === 1) {
    mode = "upgrade";
    if (count(patched, NEW_PREVIEW) !== 1) {
      throw new Error("patched PartPreview anchor mismatch");
    }
    if (count(patched, NEW_DRAG_START) !== 1) {
      throw new Error("patched handleDragStart anchor mismatch");
    }
  } else {
    if (count(patched, OLD_PREVIEW) !== 1) {
      throw new Error("PartPreview anchor mismatch");
    }
    if (count(patched, OLD_DRAG_START) !== 1) {
      throw new Error("handleDragStart anchor mismatch");
    }

    const previewIndex = patched.indexOf(OLD_PREVIEW);
    patched =
      patched.slice(0, previewIndex) +
      PREVIEW_COMPONENT +
      "\n" +
      NEW_PREVIEW +
      patched.slice(previewIndex + OLD_PREVIEW.length);

    patched = patched.replace(OLD_DRAG_START, NEW_DRAG_START);
  }

  if (count(patched, MARKER) !== 1) throw new Error("patched marker count mismatch");
  if (count(patched, "function LibraryCanvasPreview({ type }) {") !== 1) {
    throw new Error("preview component count mismatch");
  }
  if (count(patched, "jsx)(LibraryCanvasPreview, {") !== 1) {
    throw new Error("preview component usage count mismatch");
  }
  if (count(patched, "event.dataTransfer.setDragImage(") !== 1) {
    throw new Error("drag image call count mismatch");
  }
  if (count(patched, OLD_PREVIEW) !== 0) throw new Error("old PartPreview remains");
  if (count(patched, OLD_DRAG_START) !== 0) throw new Error("old handleDragStart remains");
  if (count(patched, "jsx)(PartBody, {") < 1) throw new Error("PartBody usage missing");
  if (count(patched, "stage.toCanvas({ pixelRatio: 2 })") < 1) {
    throw new Error("preview capture call missing");
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
