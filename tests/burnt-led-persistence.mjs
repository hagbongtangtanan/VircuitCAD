import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { readAsarHeader } = require("../scripts/asar-lib.js");
const { patchBurntLed } = require("../scripts/led-burnt-patch.js");
const { patchBurntVisuals } = require("../scripts/led-burnt-visual-patch.js");

const root = new URL("../", import.meta.url).pathname;

const readArchiveFile = (archivePath, filePath) => {
  const { header, baseOffset } = readAsarHeader(archivePath);
  let node = header;
  for (const part of filePath.split("/")) {
    node = node.files[part];
    assert.ok(node, `missing ${filePath} in ${archivePath}`);
  }
  const fd = fs.openSync(archivePath, "r");
  try {
    const buffer = Buffer.alloc(node.size);
    fs.readSync(fd, buffer, 0, node.size, baseOffset + Number(node.offset));
    return buffer.toString("utf8");
  } finally {
    fs.closeSync(fd);
  }
};

const count = (text, needle) => text.split(needle).length - 1;

const assertRendererInvariants = (source, label, { sourceRenderer }) => {
  assert.equal(count(source, "window.__LCD_DAMAGE_ENGINE__?.reset?.();"), 0, `${label}: damage reset on restart`);
  assert.equal(count(source, "burnt = false,"), 1, `${label}: burnt parameter`);
  assert.equal(count(source, "burnt: burned,"), 1, `${label}: burnt prop`);
  assert.equal(count(source, "failedParts: Object.fromEntries("), 1, `${label}: start seeds failed parts`);
  assert.equal(count(source, "simulation.failedParts = new Set("), 1, `${label}: simulation seeds failed parts`);
  assert.equal(
    count(source, "lcdDisplays: {},\n      });\n    },\n    async toggle()"),
    1,
    `${label}: stop keeps failed parts`,
  );
  if (sourceRenderer) {
    assert.equal(
      count(source, "const glow = burnt ? 0 : Math.min(1, Math.max(0, brightness));"),
      1,
      `${label}: burnt LED has no glow`,
    );
  }
  assert.equal(count(source, "function isLedDamageState(key)"), 1, `${label}: led scorch helper`);
  assert.equal(
    count(source, "isLedDamageState(state.key) ? null"),
    1,
    `${label}: no scorch oval on leds`,
  );
  assert.equal(
    count(source, "failedKeys.length * smokeFade"),
    1,
    `${label}: smoke emission fades with the burn age`,
  );
  assert.equal(
    count(source, "smokeAge < smokeLingeringMs &&"),
    1,
    `${label}: burnt smoke stops after the fade window`,
  );
  assert.equal(
    count(source, 'opacity: burned ? (part.type === "led" ? 1 : 0.45) : 1,'),
    1,
    `${label}: burnt led is not dimmed`,
  );
};

{
  global.window = {};
  vm.runInThisContext(
    fs.readFileSync(
      new URL("../recovered-src/out/renderer/assets/damage-ratings.js", import.meta.url),
      "utf8",
    ),
    { filename: "damage-ratings.js" },
  );
  vm.runInThisContext(
    fs.readFileSync(
      new URL("../recovered-src/out/renderer/assets/damage-core.js", import.meta.url),
      "utf8",
    ),
    { filename: "damage-core.js" },
  );

  const engine = global.window.__LCD_DAMAGE_ENGINE__;
  assert.ok(engine, "damage engine loaded");
  engine.setSettings({ damageTimeScale: "demo", effects: true });

  engine.step({
    document: { parts: [{ id: "led1", type: "led", props: { color: "red" } }], wires: [] },
    solve: {
      ledCurrents: new Map([["led1", 0.5]]),
      netVoltages: new Map([["led1:anode", 5], ["led1:cathode", 0]]),
    },
    netlist: { netIdOf: ({ partId, pinId }) => `${partId}:${pinId}` },
    drivers: new Map(),
    deltaSeconds: 0.01,
    simMs: 0,
  });

  const burnt = engine.snapshot();
  assert.deepEqual(burnt.failedParts, ["led1"]);
  assert.equal(typeof burnt.failedAt.led1, "number", "burn time is recorded for smoke fading");

  const afterRestart = engine.snapshot();
  assert.deepEqual(afterRestart.failedParts, ["led1"], "burnt LED survives a restart");
  assert.equal(afterRestart.failedAt.led1, burnt.failedAt.led1, "burn time survives a restart");

  engine.repair("led1");
  const repaired = engine.snapshot();
  assert.equal(repaired.failedParts.length, 0, "repair clears the burnt LED");
  assert.equal(repaired.failedAt.led1, undefined, "repair clears the burn time");

  engine.step({
    document: { parts: [{ id: "led2", type: "led", props: { color: "red" } }], wires: [] },
    solve: {
      ledCurrents: new Map([["led2", 0.5]]),
      netVoltages: new Map([["led2:anode", 5], ["led2:cathode", 0]]),
    },
    netlist: { netIdOf: ({ partId, pinId }) => `${partId}:${pinId}` },
    drivers: new Map(),
    deltaSeconds: 0.01,
    simMs: 0,
  });
  assert.equal(typeof engine.snapshot().failedAt.led2, "number");
  engine.repairAll();
  assert.equal(Object.keys(engine.snapshot().failedAt).length, 0, "repair all clears burn times");
}

const sourceFiles = [
  "recovered-src/out/renderer/assets/index-N0START1.js",
  "recovered-src/out/renderer/assets/index-BU2QbNS1.js",
  "index-BU2QbNS1.js",
];
for (const file of sourceFiles) {
  const source = fs.readFileSync(`${root}${file}`, "utf8");
  assertRendererInvariants(source, file, { sourceRenderer: true });
}

const archiveBundle = readArchiveFile(
  `${root}resources/app.asar`,
  "out/renderer/assets/index-N0START1.js",
);
assertRendererInvariants(archiveBundle, "resources/app.asar", { sourceRenderer: false });
assert.equal(count(archiveBundle, "burnt: options.burnt === true"), 1, "archive adapter forwards burnt");
assert.equal(count(archiveBundle, "const lit = (options.lit === true"), 1, "archive renderer handles burnt");
assert.equal(
  count(archiveBundle, "const palette = burnt ? BURNT_PALETTE"),
  1,
  "archive renderer uses burnt palette",
);

assert.equal(patchBurntLed(archiveBundle), archiveBundle, "patch is idempotent");
assert.equal(patchBurntVisuals(archiveBundle), archiveBundle, "visual patch is idempotent");

const archiveCore = readArchiveFile(
  `${root}resources/app.asar`,
  "out/renderer/assets/damage-core.js",
);
assert.equal(count(archiveCore, "const failedAt = new Map();"), 1, "archive engine tracks burn times");
assert.equal(
  count(archiveCore, "failedAt: Object.fromEntries(failedAt)"),
  2,
  "archive engine exposes burn times in the snapshot and the overlay snapshot",
);

require(new URL("../led-new/dist/renderLedSvg.js", import.meta.url).pathname);
const burntSvg = globalThis.LedSvg.renderLedSvg({
  color: "red",
  lit: true,
  burnt: true,
  theme: "dark",
  showLabels: false,
});
assert.equal(burntSvg.includes('data-layer="glow"'), false, "burnt LED has no glow");
assert.equal(burntSvg.includes('data-layer="highlight"'), false, "burnt LED has no highlight");
assert.equal(burntSvg.includes('data-layer="exploded"'), true, "burnt LED has the exploded icon");
assert.equal(burntSvg.includes('data-layer="exploded-burst"'), true, "burnt LED has the burst icon");
assert.equal(burntSvg.includes("#0a0a0c"), true, "burnt LED body is black");
assert.equal(burntSvg.includes("#ffb020"), true, "burnt LED icon is visible");

console.log("burnt-led-persistence: passed");
