"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { patchBurntVisuals } = require("./led-burnt-visual-patch");

const root = path.resolve(__dirname, "..");
const targets = [
  "recovered-src/out/renderer/assets/index-N0START1.js",
  "recovered-src/out/renderer/assets/index-BU2QbNS1.js",
  "index-BU2QbNS1.js",
];

for (const target of targets) {
  const file = path.join(root, target);
  const source = fs.readFileSync(file, "utf8");
  const patched = patchBurntVisuals(source);
  if (patched !== source) fs.writeFileSync(file, patched);
  console.log(`${target}: ${patched === source ? "already-patched" : "patched"}`);
}
