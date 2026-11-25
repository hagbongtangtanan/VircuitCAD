"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const relative = path.join("out", "renderer", "assets", "index-BU2QbNS1.js");
const source = path.join(root, "work", "app", relative);
const output = path.join(root, "work", "readable", relative);

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.copyFileSync(source, output);
execFileSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  [
    "--yes",
    "prettier@3.6.2",
    "--no-config",
    "--no-editorconfig",
    "--parser",
    "babel",
    "--print-width",
    "100",
    "--end-of-line",
    "lf",
    "--write",
    output,
  ],
  { stdio: "inherit" },
);

console.log(`formatted ${source} -> ${output}`);
