"use strict";

function count(text, needle) {
  return text.split(needle).length - 1;
}

function matchCount(source, pattern) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  return (source.match(new RegExp(pattern.source, flags)) ?? []).length;
}

function replaceRegex(source, pattern, replacement, label) {
  const matches = matchCount(source, pattern);
  if (matches === 0) throw new Error(`${label}: no match`);
  if (matches > 1) throw new Error(`${label}: expected one match, found ${matches}`);
  return source.replace(pattern, replacement);
}

function replaceRegexFn(source, pattern, replacement, label) {
  const matches = matchCount(source, pattern);
  if (matches === 0) throw new Error(`${label}: no match`);
  if (matches > 1) throw new Error(`${label}: expected one match, found ${matches}`);
  return source.replace(pattern, replacement);
}

const LED_DAMAGE_HELPER = `function isLedDamageState(key) {
  if (!key.startsWith("part:")) return false;
  const partId = key.slice(5);
  const part = useCircuitStore
    .getState()
    .document.parts.find((candidate) => candidate.id === partId);
  return part?.type === "led";
}
`;

const SMOKE_HOOK = `  const [smokeAge, setSmokeAge] = import_react.useState(Number.POSITIVE_INFINITY);
  const smokeLingeringMs =
    window.__LCD_DAMAGE_ENGINE__?.ratings?.effects?.smokeLingeringMs ?? 10000;
  import_react.useEffect(() => {
    if (!burned) {
      setSmokeAge(Number.POSITIVE_INFINITY);
      return void 0;
    }
    const failedAt =
      window.__LCD_DAMAGE_ENGINE__?.snapshot?.().failedAt?.[props.partId];
    const startedAt = typeof failedAt === "number" ? failedAt : Date.now();
    const update = () => setSmokeAge(Date.now() - startedAt);
    update();
    const timer = setInterval(update, 120);
    return () => clearInterval(timer);
  }, [burned, props.partId]);
`;

function patchBurntVisuals(source) {
  if (source.includes("function isLedDamageState(key)")) return source;
  let patched = source;

  patched = replaceRegex(
    patched,
    /function DamageOverlay\(\{/,
    `${LED_DAMAGE_HELPER}function DamageOverlay({`,
    "damage overlay helper anchor",
  );

  patched = replaceRegex(
    patched,
    /state\.failed\s*\?\s*(\/\* @__PURE__ \*\/ \(0, import_jsx_runtime\.jsx\)\(\s*"Ellipse",[\s\S]*?"scorch-" \+ state\.key,?\s*\))/,
    "state.failed ? (isLedDamageState(state.key) ? null : $1)",
    "scorch ellipse on led",
  );

  patched = replaceRegex(
    patched,
    /const failedKeys = current\.states\s*\.filter\(\(state\) => state\.failed\)\s*\.map\(\(state\) => state\.key\);/,
    `const smokeTailMs = engine.ratings.effects.smokeLingeringMs ?? 10000;
        const failedKeys = current.states
          .filter((state) => state.failed)
          .map((state) => state.key);
        const smokeAges = failedKeys.map((key) => {
          const partId = key.split(":")[1] ?? key;
          const failedAt = current.failedAt?.[partId];
          return typeof failedAt === "number" ? Date.now() - failedAt : 0;
        });
        const smokeFade =
          smokeAges.length === 0
            ? 0
            : Math.max(0, 1 - Math.min(...smokeAges) / smokeTailMs);`,
    "smoke fade window",
  );

  patched = replaceRegex(
    patched,
    /dt \* engine\.ratings\.effects\.smokeSpawnRatePerSecond \* quality \* failedKeys\.length;/,
    "dt * engine.ratings.effects.smokeSpawnRatePerSecond * quality * failedKeys.length * smokeFade;",
    "smoke spawn fade",
  );

  patched = replaceRegex(
    patched,
    /(const elapsedMs = useSimStore\(\(state\) => state\.elapsedMs\);)\n(\s*)const channels = useSimStore\(/,
    `$1\n${SMOKE_HOOK}\n$2const channels = useSimStore(`,
    "smoke age hook",
  );

  patched = replaceRegex(
    patched,
    /burned &&\s*\n/,
    "burned &&\n        smokeAge < smokeLingeringMs &&\n",
    "burnt smoke condition",
  );

  patched = replaceRegexFn(
    patched,
    /\("Group", \{\s*opacity: (0\.72)(,)/,
    (match, value, suffix) => {
      const prefix = match.slice(0, match.length - value.length - suffix.length);
      return `${prefix}${value} * Math.max(0, 1 - smokeAge / smokeLingeringMs)${suffix}`;
    },
    "burnt smoke opacity",
  );

  patched = replaceRegex(
    patched,
    /const phase = \(elapsedMs % cycle\) \/ cycle;/,
    "const phase = ((smokeAge + index * 137) % cycle) / cycle;",
    "burnt smoke phase",
  );

  patched = replaceRegex(
    patched,
    /opacity: burned \? 0\.45 : 1,/,
    'opacity: burned ? (part.type === "led" ? 1 : 0.45) : 1,',
    "burnt led opacity",
  );

  if (count(patched, "damage-scorch") !== 1) {
    throw new Error("damage scorch marker missing after patch");
  }
  return patched;
}

module.exports = { patchBurntVisuals };
