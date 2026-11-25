"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  compareListings,
  listingFromDir,
  packAsar,
  readAsarHeader,
  sha256File,
  unpackAsar,
} = require("./asar-lib");
const { patchBurntLed } = require("./led-burnt-patch");
const { patchBurntVisuals } = require("./led-burnt-visual-patch");
const { patchPerf, verifyPerf } = require("./perf-patch");

const root = path.resolve(__dirname, "..");

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`missing value for --${name}`);
  return value;
}

function resolveInput(value) {
  return path.isAbsolute(value) ? value : path.join(root, value);
}

function count(text, needle) {
  return text.split(needle).length - 1;
}

function findLoadedBundle(appDir) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(appDir, "package.json"), "utf8"));
  const mainEntry = path.join(appDir, packageJson.main);
  const mainText = fs.readFileSync(mainEntry, "utf8");
  const loadFile = mainText.match(/window\.loadFile\([\s\S]{0,240}?["']([^"']+\.html)["']/);
  if (!loadFile) throw new Error("loadFile target not found");
  const htmlPath = path.resolve(path.dirname(mainEntry), loadFile[1]);
  const htmlText = fs.readFileSync(htmlPath, "utf8");
  const script = htmlText.match(/<script[^>]*type="module"[^>]*src=["']([^"']+)["']/);
  if (!script) throw new Error("renderer module script not found");
  return path.resolve(path.dirname(htmlPath), script[1]);
}

function adapterConstant(source, name) {
  const match = source.match(new RegExp(`const ${name} = ([^;]+);`));
  if (!match) throw new Error(`adapter constant not found: ${name}`);
  return match[1];
}

const archivePath = resolveInput(arg("archive", "resources/app.asar"));
const outputPath = resolveInput(arg("output", "out/patched/app-persisted.asar"));
const install = process.argv.includes("--install");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "vc-led-persist-"));
try {
  const appDir = path.join(temp, "app");
  const verifyDir = path.join(temp, "verify");
  unpackAsar(archivePath, appDir);
  const loadedBundle = findLoadedBundle(appDir);
  const source = fs.readFileSync(loadedBundle, "utf8");
  const marker = "const LED_PATCH_V1 = true;";
  const partBodyAnchor = "function PartBody({";
  if (count(source, marker) !== 1) throw new Error("installed LED patch marker count mismatch");
  const markerIndex = source.indexOf(marker);
  const partBodyIndex = source.indexOf(partBodyAnchor, markerIndex);
  if (partBodyIndex === -1) throw new Error("PartBody anchor not found after LED patch");
  const oldInjection = source.slice(markerIndex, partBodyIndex);
  const oldAdapterStart = oldInjection.indexOf("(function () {");
  if (oldAdapterStart === -1) throw new Error("installed LED adapter not found");
  const oldAdapter = oldInjection.slice(oldAdapterStart);
  const designScale = adapterConstant(oldAdapter, "DESIGN_SCALE");
  const originX = adapterConstant(oldAdapter, "ORIGIN_X");
  const originY = adapterConstant(oldAdapter, "ORIGIN_Y");

  const moduleSource = fs.readFileSync(path.join(root, "led-new/dist/renderLedSvg.js"), "utf8");
  let adapter = fs.readFileSync(path.join(root, "scripts/led-patch-adapter.js"), "utf8");
  const replacements = [
    ["const DESIGN_SCALE = 0.5;", `const DESIGN_SCALE = ${designScale};`],
    ["const ORIGIN_X = 20;", `const ORIGIN_X = ${originX};`],
    ["const ORIGIN_Y = 40;", `const ORIGIN_Y = ${originY};`],
  ];
  for (const [from, to] of replacements) {
    if (count(adapter, from) !== 1) throw new Error(`adapter anchor mismatch: ${from}`);
    adapter = adapter.replace(from, to);
  }

  const injection = `${marker}\n${moduleSource.trimEnd()}\n\n${adapter.trimEnd()}\n\n`;
  const withLed = source.slice(0, markerIndex) + injection + source.slice(partBodyIndex);
  const patched = patchPerf(patchBurntVisuals(patchBurntLed(withLed)));
  const perfVerification = verifyPerf(patched);
  if (perfVerification.motorSet !== 1)
    throw new Error("perf motor type set marker mismatch");
  if (perfVerification.gatedSelector !== 1)
    throw new Error("perf gated elapsed selector mismatch");
  if (perfVerification.overlaySnapshot !== 1)
    throw new Error("perf overlay snapshot marker mismatch");
  if (perfVerification.elapsedSelectorTotal !== 1)
    throw new Error("perf stale elapsed selector mismatch");
  if (patchPerf(patched) !== patched)
    throw new Error("perf patch is not idempotent");
  if (count(patched, marker) !== 1) throw new Error("patched marker count mismatch");
  if (!patched.includes('"GLOW_RADIUS":225')) throw new Error("new glow radius missing");
  if (!patched.includes('"GLOW_PEAK_ALPHA_DARK":0.7')) throw new Error("new dark peak alpha missing");
  if (!patched.includes('"GLOW_PEAK_ALPHA_LIGHT":0.85')) throw new Error("new light peak alpha missing");
  if (!patched.includes("isLedDamageState")) throw new Error("burnt led visual patch missing");
  if (!patched.includes("failedKeys.length * smokeFade")) throw new Error("smoke fade patch missing");
  fs.writeFileSync(loadedBundle, patched);

  const damageCoreSource = path.join(root, "recovered-src/out/renderer/assets/damage-core.js");
  const damageCoreTarget = path.join(appDir, "out/renderer/assets/damage-core.js");
  if (!fs.existsSync(damageCoreTarget)) throw new Error("damage-core.js missing in archive");
  fs.copyFileSync(damageCoreSource, damageCoreTarget);

  const beforeListing = listingFromDir(appDir).files;
  const packed = packAsar(appDir, outputPath);
  const verifyDirPath = path.join(verifyDir, "app");
  unpackAsar(outputPath, verifyDirPath);
  const comparison = compareListings(listingFromDir(appDir), listingFromDir(verifyDirPath));
  if (!comparison.ok) throw new Error("packed archive comparison failed");
  const originalPrefix = readAsarHeader(archivePath).prefix;
  const outputPrefix = readAsarHeader(outputPath).prefix;
  const prefixOk =
    outputPrefix.field4 === outputPrefix.jsonLength + outputPrefix.padding + 8 &&
    outputPrefix.field8 === outputPrefix.jsonLength + outputPrefix.padding + 4 &&
    outputPrefix.padding === originalPrefix.padding;
  if (!prefixOk) throw new Error("packed archive header mismatch");

  if (install) {
    fs.copyFileSync(outputPath, archivePath);
    fs.copyFileSync(outputPath, path.join(root, "app-modified.asar"));
  }

  const report = {
    archive: path.relative(root, archivePath).split(path.sep).join("/"),
    output: path.relative(root, outputPath).split(path.sep).join("/"),
    install,
    loaded_bundle: path.relative(appDir, loadedBundle).split(path.sep).join("/"),
    design_scale: designScale,
    origin: `${originX},${originY}`,
    glow_radius: 225,
    peak_alpha: { dark: 0.7, light: 0.85 },
    perf: perfVerification,
    original_sha256: sha256File(archivePath),
    output_sha256: sha256File(outputPath),
    packed,
    prefix_ok: prefixOk,
    comparison,
    pass: true,
  };
  fs.writeFileSync(path.join(root, "reports/led-persist.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`loaded_bundle=${report.loaded_bundle}`);
  console.log(`design_scale=${designScale}`);
  console.log(`origin=${report.origin}`);
  console.log(`glow_radius=225`);
  console.log(`peak_alpha_dark=0.7`);
  console.log(`peak_alpha_light=0.85`);
  console.log(`output_sha256=${report.output_sha256}`);
  console.log(`install=${Number(install)}`);
  console.log("PERSIST: PASS");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
