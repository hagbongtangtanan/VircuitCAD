"use strict";

function count(text, needle) {
  return text.split(needle).length - 1;
}

function replaceOnce(source, from, to, label) {
  const matches = count(source, from);
  if (matches !== 1) throw new Error(`${label}: expected one match, found ${matches}`);
  return source.replace(from, to);
}

function patchBurntLed(source) {
  if (
    source.includes("burnt: options.burnt === true") &&
    source.includes("burnt: burned") &&
    !source.includes("window.__LCD_DAMAGE_ENGINE__?.reset?.();")
  ) {
    return source;
  }

  let patched = source;

  patched = replaceOnce(
    patched,
    "  focusedPin = null,\n}) {",
    "  focusedPin = null,\n  burnt = false,\n}) {",
    "PartBody burnt parameter",
  );
  patched = replaceOnce(
    patched,
    "        brightness,\n        selected,\n        lightMode,",
    "        brightness,\n        selected,\n        lightMode,\n        burnt,",
    "LED burnt option",
  );
  patched = replaceOnce(
    patched,
    "        focusedPin: props.focusedPin,\n      })",
    "        focusedPin: props.focusedPin,\n        burnt: burned,\n      })",
    "PartBody burnt prop",
  );
  patched = replaceOnce(
    patched,
    "      window.__LCD_DAMAGE_ENGINE__?.reset?.();\n",
    "",
    "damage reset on restart",
  );
  patched = replaceOnce(
    patched,
    "        failedParts: {},\n      });\n      const sketch = useSketchStore.getState();",
    "        failedParts: Object.fromEntries(\n          (window.__LCD_DAMAGE_ENGINE__?.snapshot?.().failedParts ?? []).map((id) => [id, true]),\n        ),\n      });\n      const sketch = useSketchStore.getState();",
    "persistent failed parts on start",
  );
  patched = replaceOnce(
    patched,
    "        const simulation = new ArduinoSimulation(hex, useCircuitStore.getState().document);",
    "        const simulation = new ArduinoSimulation(hex, useCircuitStore.getState().document);\n        simulation.failedParts = new Set(\n          window.__LCD_DAMAGE_ENGINE__?.snapshot?.().failedParts ?? [],\n        );",
    "persistent failed parts in simulation",
  );
  patched = replaceOnce(
    patched,
    "        lcdDisplays: {},\n        failedParts: {},\n      });\n    },\n    async toggle()",
    "        lcdDisplays: {},\n      });\n    },\n    async toggle()",
    "persistent failed parts on stop",
  );

  if (count(patched, "window.__LCD_DAMAGE_ENGINE__?.reset?.();") !== 0) {
    throw new Error("damage reset remains after restart patch");
  }
  return patched;
}

function replaceVariant(source, variants, to, label) {
  for (const from of variants) {
    const matches = count(source, from);
    if (matches === 1) return source.replace(from, to);
    if (matches > 1) throw new Error(`${label}: expected one match, found ${matches}`);
  }
  throw new Error(`${label}: no matching anchor`);
}

function patchSourceRenderer(source) {
  let patched = source;

  patched = replaceVariant(
    patched,
    ["  focusedPin = null,\n}) {"],
    "  focusedPin = null,\n  burnt = false,\n}) {",
    "PartBody burnt parameter",
  );
  const glowAnchor = "      const glow = Math.min(1, Math.max(0, brightness));";
  if (!patched.includes(glowAnchor)) throw new Error("source LED glow: no matching anchor");
  patched = patched.replace(glowAnchor, "      const glow = burnt ? 0 : Math.min(1, Math.max(0, brightness));");
  patched = replaceVariant(
    patched,
    ["        focusedPin: props.focusedPin,\n      })"],
    "        focusedPin: props.focusedPin,\n        burnt: burned,\n      })",
    "PartBody burnt prop",
  );
  patched = replaceVariant(
    patched,
    ["      window.__LCD_DAMAGE_ENGINE__?.reset?.();\n"],
    "",
    "damage reset on restart",
  );
  patched = replaceVariant(
    patched,
    ["        failedParts: {},\n      });\n      const sketch = useSketchStore.getState();"],
    "        failedParts: Object.fromEntries(\n          (window.__LCD_DAMAGE_ENGINE__?.snapshot?.().failedParts ?? []).map((id) => [id, true]),\n        ),\n      });\n      const sketch = useSketchStore.getState();",
    "persistent failed parts on start",
  );
  patched = replaceVariant(
    patched,
    [
      "        const simulation = new ArduinoSimulation(\n          hex,\n          useCircuitStore.getState().document,\n        );",
      "        const simulation = new ArduinoSimulation(hex, useCircuitStore.getState().document);",
    ],
    "        const simulation = new ArduinoSimulation(hex, useCircuitStore.getState().document);\n        simulation.failedParts = new Set(\n          window.__LCD_DAMAGE_ENGINE__?.snapshot?.().failedParts ?? [],\n        );",
    "persistent failed parts in simulation",
  );
  patched = replaceVariant(
    patched,
    ["        lcdDisplays: {},\n        failedParts: {},\n      });\n    },\n    async toggle()"],
    "        lcdDisplays: {},\n      });\n    },\n    async toggle()",
    "persistent failed parts on stop",
  );

  if (count(patched, "window.__LCD_DAMAGE_ENGINE__?.reset?.();") !== 0) {
    throw new Error("damage reset remains after restart patch");
  }
  return patched;
}

module.exports = { patchBurntLed, patchSourceRenderer };
