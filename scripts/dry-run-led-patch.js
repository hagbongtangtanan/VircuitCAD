"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const reportPath = path.join(root, "reports/led-dry-run.json");
const sourcePath = path.join(root, "work/readable/out/renderer/assets/index-BU2QbNS1.js");
const protectedPaths = [
  "work/app/out/renderer/assets/index-BU2QbNS1.js",
  "resources/app.asar",
  "out/app.asar",
];

function sha256File(file) {
  if (!fs.existsSync(file)) return null;
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function run(script, args) {
  return execFileSync(process.execPath, [path.join(root, script), ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 32 * 1024 * 1024,
  });
}

const before = Object.fromEntries(
  protectedPaths.map((relative) => [relative, sha256File(path.join(root, relative))]),
);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "vc-led-dry-run-"));
try {
  const tempSource = path.join(temp, "source.js");
  const tempPatched = path.join(temp, "patched.js");
  const tempVerify = path.join(temp, "verify.json");
  fs.copyFileSync(sourcePath, tempSource);
  const patchOutput = run("scripts/patch-led.js", [
    "--source",
    tempSource,
    "--output",
    tempPatched,
  ]);
  const verifyOutput = run("scripts/verify-patch.js", [
    "--source",
    tempSource,
    "--patched",
    tempPatched,
    "--report",
    tempVerify,
  ]);
  const smokeOutput = run("scripts/smoke-led.js", []);
  const verify = JSON.parse(fs.readFileSync(tempVerify, "utf8"));
  const sourceBuffer = fs.readFileSync(tempSource);
  const patchedBuffer = fs.readFileSync(tempPatched);
  const after = Object.fromEntries(
    protectedPaths.map((relative) => [relative, sha256File(path.join(root, relative))]),
  );
  const protectedUnchanged = protectedPaths.every((relative) => before[relative] === after[relative]);
  const report = {
    source: path.relative(root, sourcePath).split(path.sep).join("/"),
    temp_source: tempSource,
    temp_patched: tempPatched,
    source_bytes: sourceBuffer.length,
    patched_bytes: patchedBuffer.length,
    bytes_delta: patchedBuffer.length - sourceBuffer.length,
    source_lines: sourceBuffer.toString("utf8").split("\n").length,
    patched_lines: patchedBuffer.toString("utf8").split("\n").length,
    protected_paths: protectedPaths,
    protected_hashes_before: before,
    protected_hashes_after: after,
    protected_unchanged: protectedUnchanged,
    verify,
    pass: verify.pass && protectedUnchanged,
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(patchOutput);
  process.stdout.write(verifyOutput);
  process.stdout.write(smokeOutput);
  console.log(`bytes_delta=${report.bytes_delta}`);
  console.log(`lines_delta=${report.patched_lines - report.source_lines}`);
  console.log(`protected_unchanged=${Number(protectedUnchanged)}`);
  console.log(`dry_run_report=${path.relative(root, reportPath).split(path.sep).join("/")}`);
  console.log(report.pass ? "DRY RUN: PASS" : "DRY RUN: FAIL");
  if (!report.pass) process.exitCode = 1;
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
