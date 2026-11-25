"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
execFileSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["--yes", "--package", "typescript@5.6.3", "tsc", "--project", path.join(root, "tsconfig.json")],
  { cwd: root, stdio: "inherit" },
);

const cjs = path.join(root, "dist-cjs", "renderLedSvg.js");
const output = path.join(root, "dist", "renderLedSvg.js");
const source = fs.readFileSync(cjs, "utf8");
const spec = require(path.join(root, "dist-cjs", "ledSpec.js")).LED_SPEC;
const inlineSource = source.replace(
  'const ledSpec_1 = require("./ledSpec");',
  `const LED_SPEC = ${JSON.stringify(spec)}; const ledSpec_1 = { LED_SPEC };`,
);
const bundle = [
  "(function (root, factory) {",
  "  var mod = { exports: {} };",
  "  factory(mod, mod.exports);",
  "  root.LedSvg = mod.exports;",
  "})(typeof globalThis !== 'undefined' ? globalThis : this, function (module, exports) {",
  inlineSource,
  "});",
  "",
].join("\n");

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, bundle);
fs.rmSync(path.join(root, "dist-cjs"), { recursive: true, force: true });
console.log(`built ${output} (${fs.statSync(output).size} bytes)`);
