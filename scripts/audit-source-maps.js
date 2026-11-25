"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const scanRoots = ["work/app", "recovered-src", "extracted-raw"];
const reportDir = path.join(root, "reports");
const reportPath = path.join(reportDir, "source-maps.json");

function walk(dir, output) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, output);
    else if (entry.isFile() && entry.name.endsWith(".map")) output.push(full);
  }
}

function isNodeModulesSource(source) {
  return source.split(/[\\/]/).includes("node_modules");
}

function normalizeSource(source) {
  return source.replace(/\\/g, "/");
}

const mapPaths = [];
for (const scanRoot of scanRoots) {
  const full = path.join(root, scanRoot);
  if (!fs.existsSync(full)) continue;
  walk(full, mapPaths);
}
mapPaths.sort();

const files = mapPaths.map((full) => {
  const raw = fs.readFileSync(full, "utf8");
  let sources = [];
  let sourcesContent = null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.sources)) sources = parsed.sources.map(String);
    if (Array.isArray(parsed.sourcesContent)) sourcesContent = parsed.sourcesContent;
  } catch {}
  const relativePath = path.relative(root, full).split(path.sep).join("/");
  const mapInNodeModules = relativePath.split("/").includes("node_modules");
  const normalized = sources.map(normalizeSource);
  const nonNodeModules = mapInNodeModules
    ? []
    : normalized.filter((source) => !isNodeModulesSource(source));
  const contentSlots = Array.isArray(sourcesContent)
    ? sourcesContent.reduce((count, value) => count + (value === null ? 0 : 1), 0)
    : 0;
  return {
    path: relativePath,
    size: fs.statSync(full).size,
    mapInNodeModules,
    sourcesContent: Array.isArray(sourcesContent),
    sourcesContentSlots: contentSlots,
    sourcesCount: sources.length,
    nonNodeModulesSources: new Set(nonNodeModules).size,
  };
});

const byRoot = {};
for (const file of files) {
  const key = file.path.split("/")[0];
  byRoot[key] = (byRoot[key] || 0) + 1;
}

const report = {
  scanRoots,
  mapCount: files.length,
  realSourceMaps: files.filter((file) => file.nonNodeModulesSources > 0).length,
  sourcesContentTrue: files.filter((file) => file.sourcesContent).length,
  sourcesContentFalse: files.filter((file) => !file.sourcesContent).length,
  nonNodeModulesTotal: files.reduce((total, file) => total + file.nonNodeModulesSources, 0),
  byRoot,
  files,
};

fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`mapCount=${report.mapCount}`);
console.log(`realSourceMaps=${report.realSourceMaps}`);
console.log(`sourcesContentTrue=${report.sourcesContentTrue}`);
console.log(`sourcesContentFalse=${report.sourcesContentFalse}`);
console.log(`nonNodeModulesTotal=${report.nonNodeModulesTotal}`);
console.log(`byRoot=${JSON.stringify(report.byRoot)}`);
console.log(`report=${path.relative(root, reportPath).split(path.sep).join("/")}`);
