"use strict";

/**
 * Teaches the main process about the jumper wire part.
 *
 * The renderer keeps the jumper wire registered so older projects still open,
 * but the main process never accepted the type, so any project that contained
 * one could not be written to disk. Adding the type to the shared project
 * schema makes those projects save again; the jumper wire stays out of the
 * parts library.
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

const sourcePath = resolveInput(arg("source", "out/patched/library-sections/out/main/index.js"));
const outputPath = resolveInput(arg("output", "out/patched/library-sections/out/main/index.js"));

const MARKER = "const MAIN_JUMPER_SCHEMA_PATCH_V1 = true;";

const ANCHOR_MARKER = `var partPropsSchemas = {`;

const ANCHOR_PROPS = `  cd4511: zod.z.strictObject({}),
};`;

const REPLACEMENT_PROPS = `  cd4511: zod.z.strictObject({}),
  "jumper-wire": zod.z.strictObject({}),
};`;

const ANCHOR_UNION = `  zod.z.strictObject(partVariant("cd4511")),
]);`;

const REPLACEMENT_UNION = `  zod.z.strictObject(partVariant("cd4511")),
  zod.z.strictObject(partVariant("jumper-wire")),
]);`;

const EDITS = [
  ["props schema", ANCHOR_PROPS, REPLACEMENT_PROPS],
  ["part union", ANCHOR_UNION, REPLACEMENT_UNION],
];

function main() {
  const source = fs.readFileSync(sourcePath, "utf8");

  const markerCount = count(source, MARKER);
  if (markerCount > 1) throw new Error("main jumper marker count mismatch");
  const mode = markerCount === 1 ? "upgrade" : "fresh";

  let patched = source;

  if (mode === "fresh") {
    if (count(patched, ANCHOR_MARKER) !== 1) throw new Error("anchor mismatch: marker");
    patched = patched.replace(ANCHOR_MARKER, `${MARKER}\n${ANCHOR_MARKER}`);
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
  if (count(patched, `${MARKER}\n${ANCHOR_MARKER}`) !== 1) {
    throw new Error("marker is not placed before the props schema");
  }
  if (count(patched, '"jumper-wire": zod.z.strictObject({}),') !== 1) {
    throw new Error("jumper wire props schema count mismatch");
  }
  if (count(patched, 'zod.z.strictObject(partVariant("jumper-wire")),') !== 1) {
    throw new Error("jumper wire part variant count mismatch");
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
