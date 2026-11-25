"use strict";

/**
 * Makes the spacebar a shortcut for the simulation.
 *
 * A short press of the spacebar starts the sketch on the simulated board, a
 * second press stops it again. Holding the spacebar and dragging the canvas
 * still pans the circuit, so the pan gesture keeps working, and the shortcut
 * is ignored while a text field or the code editor has the focus.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

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

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function count(text, needle) {
  return text.split(needle).length - 1;
}

const sourcePath = resolveInput(
  arg("source", "work/readable/out/renderer/assets/index-BU2QbNS1.js"),
);
const outputPath = resolveInput(
  arg("output", "out/patched/space-simulation/out/renderer/assets/index-BU2QbNS1.js"),
);

const MARKER = "const SPACE_SIMULATION_PATCH_V1 = true;";

const ANCHOR_STATE = `  const [shortcutsOpen, setShortcutsOpen] = (0, import_react.useState)(false);`;

const ANCHOR_EFFECT_START = `  (0, import_react.useEffect)(() => {
    const onKeyDown = (event) => {
      if (onboarding !== null || startersOpen || shortcutsOpen) return;
      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();`;

const ANCHOR_SPACE_SLOT = `      if (isTextEntry(event.target)) return;
      if (modifier && key === "c") {`;

const ANCHOR_LISTENERS = `    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [`;

const ANCHOR_DEPS = `    undo,
  ]);`;

const ANCHOR_GROUPS = `  {
    title: "Edit",
    items: [`;

const EFFECT_START = `  (0, import_react.useEffect)(() => {
    const spacePress = { active: false, interacted: false, x: 0, y: 0 };
    const pointer = { x: 0, y: 0 };
    const onPointerMove = (event) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      if (!spacePress.active) return;
      if (Math.abs(event.clientX - spacePress.x) > 4 || Math.abs(event.clientY - spacePress.y) > 4) {
        spacePress.interacted = true;
      }
    };
    const onPointerDown = () => {
      if (!spacePress.active) return;
      spacePress.interacted = true;
    };
    const onKeyUp = (event) => {
      if (event.code !== "Space") return;
      if (!spacePress.active) return;
      spacePress.active = false;
      if (spacePress.interacted) return;
      const status = useSimStore.getState().status;
      if (status !== "running" && status !== "preparing") setCodeOpen(true);
      void toggleSimulationShortcut();
    };
    const onKeyDown = (event) => {
      if (onboarding !== null || startersOpen || shortcutsOpen) return;
      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();`;

const SPACE_SLOT = `      if (isTextEntry(event.target)) return;
      if (event.code === "Space") {
        event.preventDefault();
        if (event.repeat === true) return;
        spacePress.active = true;
        spacePress.interacted = false;
        spacePress.x = pointer.x;
        spacePress.y = pointer.y;
        return;
      }
      if (modifier && key === "c") {`;

const LISTENERS = `    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [`;

const DEPS = `    toggleSimulationShortcut,
    undo,
  ]);`;

const GROUPS = `  {
    title: "Simulation",
    items: [
      {
        keys: ["Space"],
        label: "Run or stop the simulation",
      },
    ],
  },
  {
    title: "Edit",
    items: [`;

const STATE = `${ANCHOR_STATE}
  const toggleSimulationShortcut = useSimStore((state) => state.toggle);
${MARKER}`;

function main() {
  const source = fs.readFileSync(sourcePath, "utf8");

  const markerCount = count(source, MARKER);
  if (markerCount > 1) throw new Error("space simulation marker count mismatch");

  let patched = source;
  let mode = "fresh";

  if (markerCount === 1) {
    mode = "upgrade";
    for (const [name, text] of [
      ["state", STATE],
      ["effect", EFFECT_START],
      ["space slot", SPACE_SLOT],
      ["listeners", LISTENERS],
      ["deps", DEPS],
      ["groups", GROUPS],
    ]) {
      if (count(patched, text) !== 1) throw new Error(`patched ${name} anchor mismatch`);
    }
  } else {
    const edits = [
      [ANCHOR_STATE, STATE],
      [ANCHOR_EFFECT_START, EFFECT_START],
      [ANCHOR_SPACE_SLOT, SPACE_SLOT],
      [ANCHOR_LISTENERS, LISTENERS],
      [ANCHOR_DEPS, DEPS],
      [ANCHOR_GROUPS, GROUPS],
    ];
    for (const [anchor] of edits) {
      if (count(patched, anchor) !== 1) {
        throw new Error(`anchor mismatch: ${anchor.slice(0, 60).replace(/\n/g, "\\n")}`);
      }
    }
    for (const [anchor, replacement] of edits) {
      patched = patched.replace(anchor, replacement);
    }
  }

  if (count(patched, MARKER) !== 1) throw new Error("patched marker count mismatch");
  if (count(patched, "void toggleSimulationShortcut();") !== 1) {
    throw new Error("simulation toggle call count mismatch");
  }
  if (count(patched, 'if (event.code !== "Space") return;') !== 1) {
    throw new Error("space keyup handler count mismatch");
  }
  if (count(patched, "if (event.repeat === true) return;") !== 1) {
    throw new Error("space repeat guard count mismatch");
  }
  if (count(patched, 'label: "Run or stop the simulation"') !== 1) {
    throw new Error("shortcut guide entry count mismatch");
  }
  if (count(patched, "const toggleSimulationShortcut = useSimStore((state) => state.toggle);") !== 1) {
    throw new Error("toggle simulation binding count mismatch");
  }
  if (
    count(
      patched,
      "window.addEventListener(\"keyup\", onKeyUp);\n    window.addEventListener(\"pointermove\", onPointerMove);",
    ) !== 1
  ) {
    throw new Error("keyup listener count mismatch");
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, patched);

  const sourceBuffer = fs.readFileSync(sourcePath);
  const patchedBuffer = fs.readFileSync(outputPath);
  console.log(`source=${path.relative(root, sourcePath).split(path.sep).join("/")}`);
  console.log(`output=${path.relative(root, outputPath).split(path.sep).join("/")}`);
  console.log(`mode=${mode}`);
  console.log(`source_bytes=${sourceBuffer.length}`);
  console.log(`output_bytes=${patchedBuffer.length}`);
  console.log(`source_sha256=${sha256(sourceBuffer)}`);
  console.log(`output_sha256=${sha256(patchedBuffer)}`);
  console.log(`marker_count=1`);
  console.log("PATCH: PASS");
}

main();
