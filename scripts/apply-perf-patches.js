"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { patchPerf, verifyPerf } = require("./perf-patch");

const root = path.resolve(__dirname, "..");

const targets = [
  "recovered-src/out/renderer/assets/index-N0START1.js",
  "recovered-src/out/renderer/assets/index-BU2QbNS1.js",
  "index-BU2QbNS1.js",
];

const report = [];
for (const target of targets) {
  const filePath = path.join(root, target);
  if (!fs.existsSync(filePath)) throw new Error(`missing mirror: ${target}`);
  const source = fs.readFileSync(filePath, "utf8");
  const patched = patchPerf(source);
  const verification = verifyPerf(patched);
  if (verification.motorSet !== 1)
    throw new Error(`motor set marker mismatch in ${target}`);
  if (verification.gatedSelector !== 1)
    throw new Error(`gated selector mismatch in ${target}`);
  if (verification.overlaySnapshot !== 1)
    throw new Error(`overlay snapshot mismatch in ${target}`);
  if (verification.elapsedSelectorTotal !== 1)
    throw new Error(`stale elapsed selector in ${target}`);
  if (patchPerf(patched) !== patched)
    throw new Error(`perf patch is not idempotent for ${target}`);
  if (patched !== source) fs.writeFileSync(filePath, patched);
  report.push({ target, changed: patched !== source, verification });
}

fs.writeFileSync(
  path.join(root, "reports/perf-patch.json"),
  `${JSON.stringify({ pass: true, report }, null, 2)}\n`,
);
for (const entry of report) {
  console.log(`${entry.target} changed=${Number(entry.changed)}`);
}
console.log("PERF PATCH: PASS");
