"use strict";

/**
 * Stops the toolchain from flashing console windows on Windows.
 *
 * The Arduino toolchain executables are console programs, so every compile
 * step opened a black console window that closed again a moment later.
 * `windowsHide` keeps those windows off the screen while the compiler still
 * writes its output to the log files.
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

const sourcePath = resolveInput(arg("source", "out/patched/toolchain-console/out/main/index.js"));
const outputPath = resolveInput(arg("output", "out/patched/toolchain-console/out/main/index.js"));

const MARKER = "const TOOLCHAIN_CONSOLE_PATCH_V1 = true;";

const ANCHOR_MARKER = `var partPropsSchemas = {`;

const ANCHOR_SPAWN = `    const child = (0, node_child_process.spawn)(command, [...args], {
      cwd,
      env,
      timeout: COMPILE_TIMEOUT_MS,
      stdio: ["ignore", stdoutFd, stderrFd],
    });`;

const REPLACEMENT_SPAWN = `    const child = (0, node_child_process.spawn)(command, [...args], {
      cwd,
      env,
      timeout: COMPILE_TIMEOUT_MS,
      stdio: ["ignore", stdoutFd, stderrFd],
      windowsHide: true,
    });`;

const EDITS = [["toolchain spawn", ANCHOR_SPAWN, REPLACEMENT_SPAWN]];

function main() {
  const source = fs.readFileSync(sourcePath, "utf8");

  const markerCount = count(source, MARKER);
  if (markerCount > 1) throw new Error("toolchain console marker count mismatch");
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
  if (count(patched, "windowsHide: true,") !== 1) {
    throw new Error("windowsHide flag count mismatch");
  }
  if (count(patched, "node_child_process.spawn") !== 1) {
    throw new Error("unexpected number of spawn calls");
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
