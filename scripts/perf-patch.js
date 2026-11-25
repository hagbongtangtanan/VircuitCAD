"use strict";

const PART_NODE_ANCHOR = "function PartNode(props) {";
const ELAPSED_SELECTOR = "const elapsedMs = useSimStore((state) => state.elapsedMs);";
const MOTOR_SET = 'const PERF_MOTOR_SPIN_TYPES = new Set(["dc-motor", "vibration-motor", "gear-motor"]);';
const GATED_SELECTOR = [
  "const elapsedMs = useSimStore((state) =>",
  "PERF_MOTOR_SPIN_TYPES.has(part?.type) ? state.elapsedMs : 0,",
  ");",
];
const OVERLAY_SNAPSHOT = "const current = engine.snapshot();";
const OVERLAY_SNAPSHOT_PATCHED = "const current = engine.overlaySnapshot?.() ?? engine.snapshot();";

function count(text, needle) {
  return text.split(needle).length - 1;
}

function patchElapsedSelector(source) {
  if (source.includes("PERF_MOTOR_SPIN_TYPES")) return source;
  const anchorIndex = source.indexOf(PART_NODE_ANCHOR);
  if (anchorIndex === -1) throw new Error("PartNode anchor not found");
  const selectorIndex = source.indexOf(ELAPSED_SELECTOR, anchorIndex);
  if (selectorIndex === -1) throw new Error("PartNode elapsedMs selector not found");
  const lineStart = source.lastIndexOf("\n", selectorIndex) + 1;
  const lineEnd = source.indexOf("\n", selectorIndex);
  const indent = source.slice(lineStart, selectorIndex);
  if (indent.trim() !== "") throw new Error("unexpected elapsedMs selector indentation");
  const gated =
    source.slice(0, lineStart) +
    indent +
    GATED_SELECTOR[0] +
    "\n" +
    indent +
    "  " +
    GATED_SELECTOR[1] +
    "\n" +
    indent +
    GATED_SELECTOR[2] +
    source.slice(lineEnd < 0 ? source.length : lineEnd);
  const insertAt = gated.indexOf(PART_NODE_ANCHOR);
  return (
    gated.slice(0, insertAt) +
    `${MOTOR_SET}\n\n` +
    gated.slice(insertAt)
  );
}

function patchOverlaySnapshot(source) {
  if (source.includes("engine.overlaySnapshot?.()")) return source;
  const occurrences = count(source, OVERLAY_SNAPSHOT);
  if (occurrences !== 1)
    throw new Error(`overlay snapshot anchor count mismatch: ${occurrences}`);
  return source.replace(OVERLAY_SNAPSHOT, OVERLAY_SNAPSHOT_PATCHED);
}

function patchPerf(source) {
  let out = source;
  out = patchElapsedSelector(out);
  out = patchOverlaySnapshot(out);
  return out;
}

function verifyPerf(source) {
  return {
    motorSet: count(source, MOTOR_SET),
    gatedSelector: count(source, "PERF_MOTOR_SPIN_TYPES.has(part?.type)"),
    overlaySnapshot: count(source, "engine.overlaySnapshot?.()"),
    elapsedSelectorTotal: count(source, ELAPSED_SELECTOR),
  };
}

module.exports = {
  MOTOR_SET,
  patchPerf,
  verifyPerf,
};
