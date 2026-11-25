"use strict";

/**
 * Verifies the parts library changes: the jumper wire is gone from the
 * library, the "Basic" section is gone and "All parts" is the default, and
 * the main process accepts the jumper wire type so older projects still save.
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

function count(text, needle) {
  return text.split(needle).length - 1;
}

const patchedPath = resolveInput(
  arg("patched", "out/patched/library-sections/out/renderer/assets/index-N0START1.js"),
);
const mainPath = resolveInput(arg("main", "out/patched/library-sections/out/main/index.js"));
const reportPath = resolveInput(arg("report", "reports/library-sections-verify.json"));

const RENDERER_MARKER = "const LIBRARY_SECTIONS_PATCH_V1 = true;";
const MAIN_MARKER = "const MAIN_JUMPER_SCHEMA_PATCH_V1 = true;";

const EXPECTED_LIBRARY_TYPES = [
  "arduino-uno",
  "breadboard",
  "led",
  "resistor",
  "push-button",
  "potentiometer",
  "ldr",
  "ultrasonic-hcsr04",
  "lcd-16x2",
  "lcd-16x2-i2c",
  "servo",
  "seven-segment",
];

function main() {
  const patched = fs.readFileSync(patchedPath, "utf8");
  const mainText = fs.readFileSync(mainPath, "utf8");

  const libraryMatch = patched.match(/var LIBRARY_TYPES = \[([\s\S]*?)\];/);
  const libraryTypes = libraryMatch
    ? [...libraryMatch[1].matchAll(/"([^"]+)"/g)].map((match) => match[1])
    : [];
  const sectionMatch = patched.match(/var SECTION_LABELS = \{([\s\S]*?)\};/);
  const sectionLabels = sectionMatch
    ? [...sectionMatch[1].matchAll(/(\w+):\s*"([^"]+)"/g)].map((match) => match[1])
    : [];

  const checks = {
    renderer_marker: count(patched, RENDERER_MARKER) === 1,
    library_types_found: libraryTypes.length === EXPECTED_LIBRARY_TYPES.length,
    library_types_match:
      EXPECTED_LIBRARY_TYPES.every((type) => libraryTypes.includes(type)) &&
      libraryTypes.length === EXPECTED_LIBRARY_TYPES.length,
    jumper_wire_not_in_library: !libraryTypes.includes("jumper-wire"),
    basic_types_removed: count(patched, "BASIC_TYPES") === 0,
    basic_section_removed: !sectionLabels.includes("basic"),
    section_labels_kept: ["all", "boards", "outputs", "inputs", "passives"].every(
      (section) => sectionLabels.includes(section),
    ),
    all_section_default: count(patched, 'useState)("all")') === 1,
    basic_branch_removed: count(patched, 'section === "basic"') === 0,
    pool_simplified: count(patched, "const pool = CATEGORY_ORDER.includes(section)") === 1,
    tour_text_updated: count(patched, "Browse everything under All parts") === 1,
    tour_text_no_basic: count(patched, "Start with Basic parts") === 0,
    jumper_type_still_registered: count(patched, '"jumper-wire"') === 10,
    main_marker: count(mainText, MAIN_MARKER) === 1,
    main_marker_placed: count(mainText, `${MAIN_MARKER}\nvar partPropsSchemas = {`) === 1,
    main_jumper_props: count(mainText, '"jumper-wire": zod.z.strictObject({}),') === 1,
    main_jumper_variant: count(mainText, 'zod.z.strictObject(partVariant("jumper-wire")),') === 1,
  };

  const pass = Object.values(checks).every((value) => value === true);
  const report = {
    patched: path.relative(root, patchedPath).split(path.sep).join("/"),
    main: path.relative(root, mainPath).split(path.sep).join("/"),
    bytes: fs.statSync(patchedPath).size,
    sha256: crypto.createHash("sha256").update(fs.readFileSync(patchedPath)).digest("hex"),
    library_types: libraryTypes,
    section_labels: sectionLabels,
    checks,
    pass,
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  for (const [name, value] of Object.entries(checks)) {
    console.log(`${name}=${Number(value)}`);
  }
  console.log(`library_types=${libraryTypes.length}`);
  console.log(`sections=${sectionLabels.join(",")}`);
  console.log(`report=${path.relative(root, reportPath).split(path.sep).join("/")}`);
  console.log(pass ? "VERIFY: PASS" : "VERIFY: FAIL");
  if (!pass) process.exitCode = 1;
}

main();
