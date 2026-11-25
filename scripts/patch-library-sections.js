"use strict";

/**
 * Removes the jumper wire from the parts library and drops the "Basic"
 * section so the library opens on "All parts".
 *
 * The jumper wire stays registered as a part type so projects that already
 * contain one still open and save; it is simply no longer offered in the
 * library drawer.
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
  arg("source", "out/patched/library-sections/out/renderer/assets/index-N0START1.js"),
);
const outputPath = resolveInput(
  arg("output", "out/patched/library-sections/out/renderer/assets/index-N0START1.js"),
);

const MARKER = "const LIBRARY_SECTIONS_PATCH_V1 = true;";

const ANCHOR_MARKER = `//#region src/renderer/ui/PartsPanel.tsx`;

const ANCHOR_JUMPER = `var LIBRARY_TYPES = [
  "arduino-uno",
  "breadboard",
  "jumper-wire",
  "led",`;

const REPLACEMENT_JUMPER = `var LIBRARY_TYPES = [
  "arduino-uno",
  "breadboard",
  "led",`;

const ANCHOR_BASIC_TYPES = `/** Curated starting set, closest to what a beginner reaches for first. */
var BASIC_TYPES = ["led", "resistor", "push-button", "potentiometer"];
`;

const ANCHOR_SECTION_LABELS = `var SECTION_LABELS = {
  basic: "Basic",
  all: "All parts",`;

const REPLACEMENT_SECTION_LABELS = `var SECTION_LABELS = {
  all: "All parts",`;

const ANCHOR_DEFAULT_SECTION = `  const [section, setSection] = (0, import_react.useState)("basic");`;

const REPLACEMENT_DEFAULT_SECTION = `  const [section, setSection] = (0, import_react.useState)("all");`;

const ANCHOR_POOL = `    const pool =
      section === "basic"
        ? library.filter((definition) => BASIC_TYPES.includes(definition.type))
        : CATEGORY_ORDER.includes(section)
          ? library.filter((definition) => definition.category === section)
          : library;`;

const REPLACEMENT_POOL = `    const pool = CATEGORY_ORDER.includes(section)
      ? library.filter((definition) => definition.category === section)
      : library;`;

const ANCHOR_RENDER = `          section === "basic"
            ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
                className: "cb-part-grid",
                children: visible.map((definition) =>
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                    PartCard,
                    {
                      definition,
                      onDragStart: handleDragStart,
                      onClick: handleClick,
                    },
                    definition.type,
                  ),
                ),
              })
            : CATEGORY_ORDER.map((category) => {`;

const REPLACEMENT_RENDER = `          CATEGORY_ORDER.map((category) => {`;

const ANCHOR_TOUR = `    body: "Start with Basic parts, browse everything under All parts, or use a category to narrow things down. Search by name when you know what you need.",`;

const REPLACEMENT_TOUR = `    body: "Browse everything under All parts, or use a category to narrow things down. Search by name when you know what you need.",`;

const EDITS = [
  ["library types", ANCHOR_JUMPER, REPLACEMENT_JUMPER],
  ["basic types", ANCHOR_BASIC_TYPES, ""],
  ["section labels", ANCHOR_SECTION_LABELS, REPLACEMENT_SECTION_LABELS],
  ["default section", ANCHOR_DEFAULT_SECTION, REPLACEMENT_DEFAULT_SECTION],
  ["part pool", ANCHOR_POOL, REPLACEMENT_POOL],
  ["panel render", ANCHOR_RENDER, REPLACEMENT_RENDER],
  ["tour text", ANCHOR_TOUR, REPLACEMENT_TOUR],
];

function main() {
  const source = fs.readFileSync(sourcePath, "utf8");

  const markerCount = count(source, MARKER);
  if (markerCount > 1) throw new Error("library sections marker count mismatch");
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
    for (const [name, anchor, replacement] of EDITS) {
      if (replacement === "") {
        if (count(patched, anchor) !== 0) throw new Error(`anchor still present: ${name}`);
      } else if (count(patched, replacement) !== 1) {
        throw new Error(`replacement mismatch: ${name}`);
      }
    }
  }

  if (count(patched, MARKER) !== 1) throw new Error("patched marker count mismatch");
  if (count(patched, "BASIC_TYPES") !== 0) throw new Error("basic types list still present");
  if (count(patched, 'basic: "Basic"') !== 0) throw new Error("basic section still offered");
  if (count(patched, 'useState)("basic")') !== 0) throw new Error("basic section still default");
  if (count(patched, 'section === "basic"') !== 0) {
    throw new Error("basic section branch still present");
  }
  if (count(patched, 'useState)("all")') !== 1) throw new Error("all section default count mismatch");
  if (count(patched, "Start with Basic parts") !== 0) {
    throw new Error("tour text still mentions basic");
  }
  const libraryTypes = patched.match(/var LIBRARY_TYPES = \[([\s\S]*?)\];/);
  if (!libraryTypes) throw new Error("library type list not found");
  if (libraryTypes[1].includes("jumper-wire")) {
    throw new Error("jumper wire still listed in the library");
  }
  if (count(patched, '"jumper-wire"') !== 10) {
    throw new Error("jumper wire type registration changed");
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
