"use strict";

/**
 * Verifies a potentiometer patch: the old drawing is gone, the adapter call
 * and the shared module are in place once, the bundle still parses and the
 * adapter constants match the shared specification.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`missing value: --${name}`);
  return value;
}

function resolveInput(value) {
  return path.isAbsolute(value) ? value : path.join(root, value);
}

function count(text, needle) {
  return text.split(needle).length - 1;
}

const sourcePath = resolveInput(
  arg("source", "work/readable/out/renderer/assets/index-BU2QbNS1.js"),
);
const patchedPath = resolveInput(
  arg("patched", "out/patched/work/readable/out/renderer/assets/index-BU2QbNS1.js"),
);
const reportPath = resolveInput(arg("report", "reports/pot-patch-verify.json"));

async function main() {
  const spec = await import(path.join(root, "pot-new", "src", "potSpec.ts"));
  const source = fs.readFileSync(sourcePath, "utf8");
  const patched = fs.readFileSync(patchedPath, "utf8");

  const checks = [];
  const check = (name, pass, detail) => checks.push({ name, pass, detail });

  for (const anchor of [
    "const angle = ((-135 + 270 * Math.min(1, Math.max(0, potPosition))) * Math.PI) / 180;",
    "points: [30, 27, 30, 40],",
  ]) {
    check(`old drawing removed: ${anchor.slice(0, 48)}`, count(patched, anchor) === 0, {
      source: count(source, anchor),
      patched: count(patched, anchor),
    });
  }

  check("marker count", count(patched, "const POT_PATCH_V1 = true;") === 1, {
    count: count(patched, "const POT_PATCH_V1 = true;"),
  });
  check("old pot thumbnail removed", count(patched, 'fill: "#2c5c8e"') === 0, {
    source: count(source, 'fill: "#2c5c8e"'),
    patched: count(patched, 'fill: "#2c5c8e"'),
  });
  check("pot thumbnail uses the shared module", count(patched, "const potThumbInner = potThumb") === 1, {
    count: count(patched, "const potThumbInner = potThumb"),
  });
  check("adapter call count", count(patched, "globalThis.POT_PATCH_renderPotBody({") === 1, {
    count: count(patched, "globalThis.POT_PATCH_renderPotBody({"),
  });
  check("module injection", count(patched, "root.PotSvg = mod.exports;") === 1, {
    count: count(patched, "root.PotSvg = mod.exports;"),
  });
  const partBodyStart = patched.indexOf("function PartBody({");
  const partBodyEnd = patched.indexOf("\nfunction ", partBodyStart + 1);
  const partBodyText =
    partBodyStart === -1 ? "" : patched.slice(partBodyStart, partBodyEnd === -1 ? undefined : partBodyEnd);
  const partBodyPotCases = count(partBodyText, 'case "potentiometer":');
  check("PartBody potentiometer case count", partBodyPotCases === 1, {
    count: partBodyPotCases,
  });

  const potSection = patched.slice(patched.indexOf("const POT_PATCH_V1 = true;"));
  const scaleMatch = potSection.match(/const DESIGN_SCALE = ([0-9.]+);/);
  const originXMatch = potSection.match(/const ORIGIN_X = ([0-9.]+);/);
  const originYMatch = potSection.match(/const ORIGIN_Y = ([0-9.]+);/);
  check("design scale matches the spec", Boolean(scaleMatch) && Math.abs(Number(scaleMatch[1]) - spec.APP_SCALE) < 1e-9, {
    patched: scaleMatch ? scaleMatch[1] : null,
    spec: spec.APP_SCALE,
  });
  check("origin matches the spec", Boolean(originXMatch) && Boolean(originYMatch) && Number(originXMatch[1]) === spec.APP_ANCHOR_LOCAL.middle.x && Number(originYMatch[1]) === spec.APP_ANCHOR_LOCAL.middle.y, {
    patched: originXMatch && originYMatch ? `${originXMatch[1]},${originYMatch[1]}` : null,
    spec: `${spec.APP_ANCHOR_LOCAL.middle.x},${spec.APP_ANCHOR_LOCAL.middle.y}`,
  });

  const definitionStart = patched.indexOf("var potentiometerDefinition = {");
  const definitionEnd = patched.indexOf("var buzzerDefinition = {");
  const definition =
    definitionStart === -1 || definitionEnd === -1
      ? ""
      : patched.slice(definitionStart, definitionEnd);
  const sizeMatch = definition.match(/size:(\s*)\{([^}]*)\}/);
  check(
    "potentiometer definition size",
    Boolean(sizeMatch) &&
      new RegExp(`width:\\s*${spec.APP_BOX.width}\\b`).test(sizeMatch[2]) &&
      new RegExp(`height:\\s*${spec.APP_BOX.height}\\b`).test(sizeMatch[2]),
    {
      patched: sizeMatch ? sizeMatch[2].replace(/\s+/g, " ").trim() : null,
      spec: `${spec.APP_BOX.width}x${spec.APP_BOX.height}`,
    },
  );
  for (const pin of spec.APP_PINS) {
    const pattern = new RegExp(
      `pin\\("${pin.id}",\\s*"${pin.label}",\\s*\\{\\s*x:\\s*([0-9.]+),\\s*y:\\s*([0-9.]+),?\\s*\\}`,
    );
    const match = definition.match(pattern);
    check(
      `potentiometer definition pin ${pin.id}`,
      Boolean(match) && Number(match[1]) === pin.x && Number(match[2]) === pin.y,
      {
        patched: match ? `${match[1]},${match[2]}` : null,
        spec: `${pin.x},${pin.y}`,
      },
    );
  }

  const anchors = [
    { name: "left", point: spec.ANCHOR_LEFT },
    { name: "middle", point: spec.ANCHOR_MIDDLE },
    { name: "right", point: spec.ANCHOR_RIGHT },
  ].map((entry) => ({
    name: entry.name,
    design: entry.point,
    world: {
      x: spec.APP_ANCHOR_LOCAL.middle.x + entry.point.x * spec.APP_SCALE,
      y: spec.APP_ANCHOR_LOCAL.middle.y + entry.point.y * spec.APP_SCALE,
    },
    app: spec.APP_ANCHOR_LOCAL[entry.name],
  }));
  const anchorPass = anchors.every(
    (entry) =>
      Math.abs(entry.world.x - entry.app.x) < 1e-9 && Math.abs(entry.world.y - entry.app.y) < 1e-9,
  );
  check("pins land on the app anchors", anchorPass, { anchors });

  let syntax = "ok";
  try {
    execFileSync(process.execPath, ["--check", patchedPath], { stdio: "pipe" });
  } catch (error) {
    syntax = String(error.stderr || error.message).slice(0, 400);
  }
  check("patched bundle parses", syntax === "ok", { detail: syntax });

  const report = {
    source: path.relative(root, sourcePath).split(path.sep).join("/"),
    patched: path.relative(root, patchedPath).split(path.sep).join("/"),
    source_sha256: crypto.createHash("sha256").update(source).digest("hex"),
    patched_sha256: crypto.createHash("sha256").update(patched).digest("hex"),
    checks,
    pass: checks.every((entry) => entry.pass),
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  for (const entry of checks) {
    console.log(`${entry.pass ? "PASS" : "FAIL"} ${entry.name}`);
  }
  console.log(`report ${path.relative(root, reportPath)}`);
  console.log(report.pass ? "VERIFY: PASS" : "VERIFY: FAIL");
  if (!report.pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
