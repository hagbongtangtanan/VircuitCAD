"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const appDir = path.join(root, "work/app");
const packagePath = path.join(appDir, "package.json");
const reportPath = path.join(root, "reports/bundle-chain.json");
const bundleNamePattern = /^index-[A-Za-z0-9_-]{8,}\.js$/;

function rel(full) {
  return path.relative(root, full).split(path.sep).join("/");
}

function sha256(full) {
  return crypto.createHash("sha256").update(fs.readFileSync(full)).digest("hex");
}

function findLine(file, pattern) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    if (pattern.test(lines[index])) {
      return { line: index + 1, text: lines[index].trim() };
    }
  }
  throw new Error(`no line matching ${pattern} in ${rel(file)}`);
}

function walk(dir, output) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, output);
    else if (entry.isFile() && bundleNamePattern.test(entry.name)) output.push(full);
  }
}

const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const mainLine = findLine(packagePath, /"main"\s*:/);
const mainEntry = path.join(appDir, packageJson.main);
const loadUrlLine = findLine(mainEntry, /window\.loadURL\(/);
const loadFileLine = findLine(mainEntry, /window\.loadFile\(/);
const htmlRelative = loadFileLine.text.match(/["']([^"']+\.html)["']/)[1];
const rendererHtml = path.resolve(path.dirname(mainEntry), htmlRelative);
const scriptLine = findLine(rendererHtml, /<script[^>]+src=["']([^"']+)["']/);
const scriptRelative = scriptLine.text.match(/src=["']([^"']+)["']/)[1];
const loadedBundle = path.resolve(path.dirname(rendererHtml), scriptRelative);
const workingBundle = path.join(root, "work/readable/out/renderer/assets/index-BU2QbNS1.js");

if (!fs.existsSync(loadedBundle)) throw new Error(`missing loaded bundle ${rel(loadedBundle)}`);

const bundlePaths = [];
walk(root, bundlePaths);
bundlePaths.sort();

const copies = bundlePaths.map((full) => {
  let role = "leftover";
  if (full === loadedBundle) role = "loaded";
  else if (full === workingBundle) role = "working-source";
  return {
    path: rel(full),
    size: fs.statSync(full).size,
    sha256: sha256(full),
    role,
  };
});

const report = {
  chain: {
    package: {
      path: rel(packagePath),
      mainValue: packageJson.main,
      line: mainLine.line,
    },
    mainEntry: {
      path: rel(mainEntry),
      loadUrlLine: loadUrlLine.line,
      loadFileLine: loadFileLine.line,
      loadFileTarget: htmlRelative,
    },
    rendererHtml: {
      path: rel(rendererHtml),
      scriptLine: scriptLine.line,
      scriptSrc: scriptRelative,
    },
    loadedBundle: rel(loadedBundle),
    workingBundle: rel(workingBundle),
    loadedSha256: sha256(loadedBundle),
    workingSha256: sha256(workingBundle),
    loadedNameMatchesWorkingName: path.basename(loadedBundle) === path.basename(workingBundle),
    loadedPathEqualsWorkingPath: loadedBundle === workingBundle,
    workingBundleReferencedByHtml: loadedBundle === workingBundle,
  },
  copyCount: copies.length,
  copies,
};

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`package_main=${report.chain.package.mainValue}@${report.chain.package.path}:${report.chain.package.line}`);
console.log(`main_loadurl=${report.chain.mainEntry.loadUrlLine}`);
console.log(`main_loadfile=${report.chain.mainEntry.loadFileLine}`);
console.log(`renderer_html=${report.chain.rendererHtml.path}:${report.chain.rendererHtml.scriptLine}`);
console.log(`loaded_bundle=${report.chain.loadedBundle}`);
console.log(`working_bundle=${report.chain.workingBundle}`);
console.log(`loaded_sha256=${report.chain.loadedSha256}`);
console.log(`working_sha256=${report.chain.workingSha256}`);
console.log(`name_match=${Number(report.chain.loadedNameMatchesWorkingName)}`);
console.log(`path_match=${Number(report.chain.loadedPathEqualsWorkingPath)}`);
console.log(`working_referenced_by_html=${Number(report.chain.workingBundleReferencedByHtml)}`);
console.log(`copy_count=${report.copyCount}`);
console.log(`report=${rel(reportPath)}`);
