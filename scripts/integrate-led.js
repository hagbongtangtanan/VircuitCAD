"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const {
  compareListings,
  listingFromDir,
  packAsar,
  readAsarHeader,
  sha256File,
  unpackAsar,
} = require("./asar-lib");

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

function rel(full) {
  return path.relative(root, full).split(path.sep).join("/");
}

function run(script, args) {
  return execFileSync(process.execPath, [path.join(root, script), ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
}

function valueFrom(output, key) {
  const match = output.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!match) throw new Error(`missing ${key} in script output`);
  return match[1];
}

function findLoadedBundle(appDir) {
  const packagePath = path.join(appDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const mainEntry = path.join(appDir, packageJson.main);
  const mainText = fs.readFileSync(mainEntry, "utf8");
  const loadFile = mainText.match(/window\.loadFile\([\s\S]{0,240}?["']([^"']+\.html)["']/);
  if (!loadFile) throw new Error("loadFile target not found");
  const htmlPath = path.resolve(path.dirname(mainEntry), loadFile[1]);
  const htmlText = fs.readFileSync(htmlPath, "utf8");
  const script = htmlText.match(
    /<script[^>]*type="module"[^>]*src=["']([^"']+)["']/,
  );
  if (!script) throw new Error("renderer module script not found");
  return path.resolve(path.dirname(htmlPath), script[1]);
}

const archivePath = resolveInput(arg("archive", "resources/app.asar"));
const outputPath = resolveInput(arg("output", "out/app-led.asar"));
const install = process.argv.includes("--install");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "vc-led-integrate-"));
try {
  const appDir = path.join(temp, "app");
  const verifyAppDir = path.join(temp, "verify-app");
  const readablePath = path.join(temp, "loaded-readable.js");
  const patchedPath = path.join(temp, "loaded-patched.js");
  const verifyReportPath = path.join(temp, "verify.json");
  const smokeReportPath = path.join(root, "reports/led-smoke-installed.json");
  const originalArchiveHash = sha256File(archivePath);
  const originalPrefix = readAsarHeader(archivePath).prefix;
  const unpackResult = unpackAsar(archivePath, appDir);
  const loadedBundle = findLoadedBundle(appDir);
  const loadedRelative = path.relative(appDir, loadedBundle).split(path.sep).join("/");
  const beforeListing = listingFromDir(appDir).files;

  fs.copyFileSync(loadedBundle, readablePath);
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
      readablePath,
    ],
    { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 32 * 1024 * 1024 },
  );

  const patchOutput = run("scripts/patch-led.js", [
    "--source",
    readablePath,
    "--output",
    patchedPath,
  ]);
  const verifyOutput = run("scripts/verify-patch.js", [
    "--source",
    readablePath,
    "--patched",
    patchedPath,
    "--report",
    verifyReportPath,
  ]);
  const verify = JSON.parse(fs.readFileSync(verifyReportPath, "utf8"));
  if (!verify.pass) throw new Error("patch verification failed");

  const fitScale = valueFrom(patchOutput, "fit_scale");
  const origin = valueFrom(patchOutput, "origin");
  const smokeOutput = run("scripts/smoke-led.js", [
    "--scale",
    fitScale,
    "--origin",
    origin,
    "--report",
    smokeReportPath,
  ]);

  fs.copyFileSync(patchedPath, loadedBundle);
  const afterListing = listingFromDir(appDir).files;
  const changedFiles = [...beforeListing.keys()].filter(
    (file) => beforeListing.get(file) !== afterListing.get(file),
  );
  const missingFiles = [...beforeListing.keys()].filter((file) => !afterListing.has(file));
  const extraFiles = [...afterListing.keys()].filter((file) => !beforeListing.has(file));
  const expectedChanged = loadedRelative;
  const sourceChangeOk =
    changedFiles.length === 1 &&
    changedFiles[0] === expectedChanged &&
    missingFiles.length === 0 &&
    extraFiles.length === 0;
  if (!sourceChangeOk) throw new Error(`unexpected changed files: ${changedFiles.join(",")}`);

  const packResult = packAsar(appDir, outputPath);
  const outputPrefix = readAsarHeader(outputPath).prefix;
  const prefixOk =
    outputPrefix.field4 === outputPrefix.jsonLength + outputPrefix.padding + 8 &&
    outputPrefix.field8 === outputPrefix.jsonLength + outputPrefix.padding + 4 &&
    outputPrefix.padding === originalPrefix.padding;
  if (!prefixOk) throw new Error("packed archive header prefix mismatch");
  unpackAsar(outputPath, verifyAppDir);
  const packedCompare = compareListings(listingFromDir(appDir), listingFromDir(verifyAppDir));
  if (!packedCompare.ok) throw new Error("packed archive comparison failed");
  const packedBundleHash = sha256File(path.join(verifyAppDir, loadedRelative));
  const patchedHash = sha256File(patchedPath);
  if (packedBundleHash !== patchedHash) throw new Error("packed bundle hash mismatch");

  const backupPath = path.join(os.tmpdir(), `vc-app-before-led-${Date.now()}.asar`);
  if (install) {
    fs.copyFileSync(archivePath, backupPath);
    fs.copyFileSync(outputPath, path.join(root, "resources/app.asar"));
    fs.copyFileSync(outputPath, path.join(root, "app-modified.asar"));
  }

  const report = {
    archive: rel(archivePath),
    output: rel(outputPath),
    install,
    backup: install ? backupPath : null,
    unpacked_files: unpackResult.fileCount,
    unpacked_dirs: unpackResult.dirCount,
    loaded_bundle: loadedRelative,
    original_archive_sha256: originalArchiveHash,
    original_prefix: originalPrefix,
    output_prefix: outputPrefix,
    prefix_ok: prefixOk,
    patched_bundle_sha256: patchedHash,
    output_sha256: sha256File(outputPath),
    fit_scale: fitScale,
    origin,
    changed_files: changedFiles,
    missing_files: missingFiles,
    extra_files: extraFiles,
    pack: packResult,
    packed_files: packedCompare.actualFileCount,
    packed_dirs: packedCompare.actualDirCount,
    packed_compare_ok: packedCompare.ok,
    packed_bundle_hash_ok: packedBundleHash === patchedHash,
    verify_pass: verify.pass,
    pass:
      verify.pass &&
      sourceChangeOk &&
      prefixOk &&
      packedCompare.ok &&
      packedBundleHash === patchedHash,
  };
  fs.mkdirSync(path.join(root, "reports"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "reports/led-integration.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );

  process.stdout.write(patchOutput);
  process.stdout.write(verifyOutput);
  process.stdout.write(smokeOutput);
  console.log(`archive_sha256=${originalArchiveHash}`);
  console.log(`output_sha256=${report.output_sha256}`);
  console.log(`prefix_ok=${Number(prefixOk)}`);
  console.log(`loaded_bundle=${loadedRelative}`);
  console.log(`changed_files=${changedFiles.length}`);
  console.log(`packed_files=${packedCompare.actualFileCount}`);
  console.log(`packed_dirs=${packedCompare.actualDirCount}`);
  console.log(`install=${Number(install)}`);
  if (install) console.log(`backup=${backupPath}`);
  console.log(`report=reports/led-integration.json`);
  console.log(report.pass ? "INTEGRATION: PASS" : "INTEGRATION: FAIL");
  if (!report.pass) process.exitCode = 1;
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
