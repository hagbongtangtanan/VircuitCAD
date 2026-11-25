"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "vc-pot-build-"));
const src = path.join(temp, "src");
fs.mkdirSync(src, { recursive: true });

for (const name of ["renderPotSvg.ts", "potSpec.ts"]) {
  const source = fs.readFileSync(path.join(root, "src", name), "utf8").replace(/from "\.\/potSpec\.ts"/g, 'from "./potSpec"');
  fs.writeFileSync(path.join(src, name), source);
}

const tsconfig = {
  compilerOptions: {
    target: "es2020",
    module: "commonjs",
    rootDir: "src",
    outDir: path.join(temp, "dist-cjs"),
    lib: ["es2020", "dom"],
    strict: false,
    declaration: false,
    sourceMap: false,
  },
  files: [path.join(src, "renderPotSvg.ts"), path.join(src, "potSpec.ts")],
};
const tsconfigPath = path.join(temp, "tsconfig.json");
fs.writeFileSync(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`);

execFileSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["--yes", "--package", "typescript@5.6.3", "tsc", "--project", tsconfigPath],
  { cwd: root, stdio: "inherit" },
);

const moduleSource = fs.readFileSync(path.join(temp, "dist-cjs", "renderPotSvg.js"), "utf8");
const specSource = fs.readFileSync(path.join(temp, "dist-cjs", "potSpec.js"), "utf8");

const bundle = [
  "(function (root, factory) {",
  "  var mod = { exports: {} };",
  "  factory(mod, mod.exports);",
  "  root.PotSvg = mod.exports;",
  "})(typeof globalThis !== 'undefined' ? globalThis : this, function (module, exports) {",
  '"use strict";',
  "var __potModules = {};",
  "var __potCache = {};",
  "function __potRequire(name) {",
  "  if (__potCache[name]) return __potCache[name].exports;",
  "  var factory = __potModules[name];",
  "  if (!factory) return require(name);",
  "  var module = { exports: {} };",
  "  __potCache[name] = module;",
  "  factory(module, module.exports, __potRequire);",
  "  return module.exports;",
  "}",
  '__potModules["./potSpec"] = function (module, exports, require) {',
  specSource,
  "};",
  '__potModules["./renderPotSvg"] = function (module, exports, require) {',
  moduleSource,
  "};",
  'module.exports = __potRequire("./renderPotSvg");',
  "});",
  "",
].join("\n");

const output = path.join(root, "dist", "renderPotSvg.js");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, bundle);
fs.rmSync(temp, { recursive: true, force: true });
console.log(`built ${output} (${fs.statSync(output).size} bytes)`);
